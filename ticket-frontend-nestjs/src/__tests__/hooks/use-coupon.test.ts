import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";
import apiClient from "@/lib/api-client";
import {
  useValidateCoupon,
  useApplyCoupon,
  useRemoveCoupon,
  useAdminCoupons,
  useCreateCoupon,
  useToggleCoupon,
  useDeleteCoupon,
} from "@/hooks/use-booking";

// Mock apiClient
vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: "http://localhost:8080/api/v1", headers: {}, timeout: 15000 },
  },
  getErrorMessage: vi.fn((err) => err?.message || "Error"),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("Coupon Hooks", () => {
  const mockGet = vi.mocked(apiClient.get);
  const mockPost = vi.mocked(apiClient.post);
  const mockDelete = vi.mocked(apiClient.delete);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== User Coupon Hooks =====

  describe("useValidateCoupon", () => {
    it("should validate a coupon and return discount preview", async () => {
      const mockResponse = {
        couponCode: "SUMMER20",
        description: "20% off summer sale",
        discountType: "PERCENTAGE",
        discountValue: 20,
        discountAmount: 16.0,
        originalAmount: 80.0,
        finalAmount: 64.0,
        currency: "USD",
        message: "Coupon is valid! You save $16.00",
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useValidateCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          reservationId: "res-123",
          couponCode: "SUMMER20",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/coupons/validate", {
        reservationId: "res-123",
        couponCode: "SUMMER20",
      });
      expect(result.current.data?.discountAmount).toBe(16.0);
      expect(result.current.data?.finalAmount).toBe(64.0);
      expect(result.current.data?.discountType).toBe("PERCENTAGE");
    });

    it("should handle invalid coupon code", async () => {
      mockPost.mockRejectedValueOnce(new Error("Coupon not found"));

      const { result } = renderHook(() => useValidateCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          reservationId: "res-123",
          couponCode: "INVALID",
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Coupon not found");
    });
  });

  describe("useApplyCoupon", () => {
    it("should apply coupon to reservation", async () => {
      const mockResponse = {
        couponCode: "FLAT10",
        description: "$10 off",
        discountType: "FIXED_AMOUNT",
        discountValue: 10,
        discountAmount: 10.0,
        originalAmount: 50.0,
        finalAmount: 40.0,
        currency: "USD",
        message: "Coupon applied! You save $10.00",
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useApplyCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          reservationId: "res-456",
          couponCode: "FLAT10",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/coupons/apply", {
        reservationId: "res-456",
        couponCode: "FLAT10",
      });
      expect(result.current.data?.discountAmount).toBe(10.0);
      expect(result.current.data?.finalAmount).toBe(40.0);
    });

    it("should handle apply failure for expired coupon", async () => {
      mockPost.mockRejectedValueOnce(new Error("Coupon has expired"));

      const { result } = renderHook(() => useApplyCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          reservationId: "res-456",
          couponCode: "EXPIRED",
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Coupon has expired");
    });
  });

  describe("useRemoveCoupon", () => {
    it("should remove coupon from reservation", async () => {
      mockDelete.mockResolvedValueOnce({ data: undefined });

      const { result } = renderHook(() => useRemoveCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("res-789");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDelete).toHaveBeenCalledWith("/coupons/remove/res-789");
    });

    it("should handle remove failure", async () => {
      mockDelete.mockRejectedValueOnce(new Error("No coupon applied"));

      const { result } = renderHook(() => useRemoveCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("res-789");
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("No coupon applied");
    });
  });

  // ===== Admin Coupon Hooks =====

  describe("useAdminCoupons", () => {
    it("should fetch paginated admin coupons", async () => {
      const mockData = {
        content: [
          {
            id: "c1",
            code: "SUMMER20",
            discountType: "PERCENTAGE",
            discountValue: 20,
            active: true,
            currentUses: 5,
            currency: "USD",
            validFrom: "2024-01-01T00:00:00",
            createdAt: "2024-01-01T00:00:00",
          },
          {
            id: "c2",
            code: "FLAT10",
            discountType: "FIXED_AMOUNT",
            discountValue: 10,
            active: false,
            currentUses: 0,
            currency: "USD",
            validFrom: "2024-01-01T00:00:00",
            createdAt: "2024-01-01T00:00:00",
          },
        ],
        totalPages: 1,
        totalElements: 2,
        number: 0,
        size: 20,
        first: true,
        last: true,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useAdminCoupons(0, 20), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/coupons", {
        params: { page: 0, size: 20 },
      });
      expect(result.current.data?.content).toHaveLength(2);
      expect(result.current.data?.content[0].code).toBe("SUMMER20");
      expect(result.current.data?.content[1].active).toBe(false);
    });

    it("should fetch with custom pagination", async () => {
      const mockData = {
        content: [],
        totalPages: 3,
        totalElements: 50,
        number: 2,
        size: 10,
        first: false,
        last: true,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useAdminCoupons(2, 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/coupons", {
        params: { page: 2, size: 10 },
      });
      expect(result.current.data?.number).toBe(2);
    });
  });

  describe("useCreateCoupon", () => {
    it("should create a percentage coupon", async () => {
      const mockResponse = {
        id: "c-new",
        code: "NEW25",
        description: "25% off new users",
        discountType: "PERCENTAGE",
        discountValue: 25,
        active: true,
        currentUses: 0,
        maxUses: 100,
        maxUsesPerUser: 1,
        currency: "USD",
        validFrom: "2024-06-01T00:00:00",
        validUntil: "2024-12-31T23:59:59",
        createdAt: "2024-06-01T00:00:00",
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useCreateCoupon(), {
        wrapper: createWrapper(),
      });

      const request = {
        code: "NEW25",
        description: "25% off new users",
        discountType: "PERCENTAGE" as const,
        discountValue: 25,
        maxUses: 100,
        maxUsesPerUser: 1,
        validFrom: "2024-06-01T00:00:00",
        validUntil: "2024-12-31T23:59:59",
      };

      await act(async () => {
        result.current.mutate(request);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/coupons", request);
      expect(result.current.data?.code).toBe("NEW25");
      expect(result.current.data?.discountType).toBe("PERCENTAGE");
    });

    it("should create a fixed-amount coupon", async () => {
      const mockResponse = {
        id: "c-fixed",
        code: "SAVE15",
        discountType: "FIXED_AMOUNT",
        discountValue: 15,
        active: true,
        currentUses: 0,
        currency: "USD",
        validFrom: "2024-06-01T00:00:00",
        createdAt: "2024-06-01T00:00:00",
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useCreateCoupon(), {
        wrapper: createWrapper(),
      });

      const request = {
        code: "SAVE15",
        discountType: "FIXED_AMOUNT" as const,
        discountValue: 15,
      };

      await act(async () => {
        result.current.mutate(request);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/coupons", request);
      expect(result.current.data?.discountType).toBe("FIXED_AMOUNT");
    });

    it("should handle duplicate code error", async () => {
      mockPost.mockRejectedValueOnce(new Error("Coupon code already exists"));

      const { result } = renderHook(() => useCreateCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          code: "EXISTING",
          discountType: "PERCENTAGE",
          discountValue: 10,
        });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Coupon code already exists");
    });
  });

  describe("useToggleCoupon", () => {
    it("should activate a coupon", async () => {
      mockPost.mockResolvedValueOnce({ data: undefined });

      const { result } = renderHook(() => useToggleCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ couponId: "c1", active: true });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/coupons/c1/activate");
    });

    it("should deactivate a coupon", async () => {
      mockPost.mockResolvedValueOnce({ data: undefined });

      const { result } = renderHook(() => useToggleCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ couponId: "c2", active: false });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/coupons/c2/deactivate");
    });
  });

  describe("useDeleteCoupon", () => {
    it("should delete a coupon", async () => {
      mockDelete.mockResolvedValueOnce({ data: undefined });

      const { result } = renderHook(() => useDeleteCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("c1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDelete).toHaveBeenCalledWith("/coupons/c1");
    });

    it("should handle delete failure for used coupon", async () => {
      mockDelete.mockRejectedValueOnce(new Error("Cannot delete coupon that has been used"));

      const { result } = renderHook(() => useDeleteCoupon(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("c-used");
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Cannot delete coupon that has been used");
    });
  });
});
