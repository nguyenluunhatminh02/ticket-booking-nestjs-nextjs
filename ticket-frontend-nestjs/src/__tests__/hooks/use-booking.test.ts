import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";
import apiClient from "@/lib/api-client";
import {
  useEvents,
  useEvent,
  useEventSearch,
  useReservations,
  useReservation,
  useReserveTickets,
  useCancelReservation,
  useInitiatePayment,
  usePaymentProviders,
  useRefundPayment,
  useJoinQueue,
  useQueuePosition,
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

describe("Booking Hooks", () => {
  const mockGet = vi.mocked(apiClient.get);
  const mockPost = vi.mocked(apiClient.post);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== Events =====

  describe("useEvents", () => {
    it("should fetch events with default pagination", async () => {
      const mockData = {
        content: [
          { id: "1", name: "Concert", status: "ON_SALE", availableTickets: 50 },
        ],
        totalPages: 1,
        totalElements: 1,
        number: 0,
        size: 12,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useEvents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/events", {
        params: { page: 0, size: 12, status: "ON_SALE,PRESALE" },
      });
      expect(result.current.data?.content).toHaveLength(1);
      expect(result.current.data?.content[0].name).toBe("Concert");
    });
  });

  describe("useEvent", () => {
    it("should fetch a single event by ID", async () => {
      const mockEvent = {
        id: "abc-123",
        name: "Jazz Night",
        status: "ON_SALE",
      };
      mockGet.mockResolvedValueOnce({ data: mockEvent });

      const { result } = renderHook(() => useEvent("abc-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/events/abc-123");
      expect(result.current.data?.name).toBe("Jazz Night");
    });

    it("should not fetch when eventId is empty", () => {
      const { result } = renderHook(() => useEvent(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useEventSearch", () => {
    it("should search events by query", async () => {
      const mockData = {
        content: [{ id: "1", name: "Rock Concert" }],
        totalPages: 1,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useEventSearch("rock"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/events/search", {
        params: { q: "rock" },
      });
    });

    it("should not search when query is empty", () => {
      const { result } = renderHook(() => useEventSearch(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  // ===== Reservations =====

  describe("useReservations", () => {
    it("should fetch user reservations", async () => {
      const mockData = [
        { id: "r1", eventName: "Event 1", status: "PENDING", ticketCount: 2 },
      ];
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useReservations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/bookings");
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe("useReservation", () => {
    it("should fetch a single reservation", async () => {
      const mockData = {
        id: "r1",
        eventName: "Concert",
        status: "PENDING",
        totalAmount: 100,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useReservation("r1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/bookings/r1");
      expect(result.current.data?.totalAmount).toBe(100);
    });
  });

  describe("useReserveTickets", () => {
    it("should reserve tickets and invalidate queries", async () => {
      const mockResponse = {
        id: "r1",
        status: "PENDING",
        ticketCount: 2,
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useReserveTickets(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          eventId: "e1",
          tierId: "t1",
          quantity: 2,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/bookings/reserve", {
        eventId: "e1",
        tierId: "t1",
        quantity: 2,
      });
      expect(result.current.data?.status).toBe("PENDING");
    });
  });

  describe("useCancelReservation", () => {
    it("should cancel a reservation", async () => {
      const mockResponse = { id: "r1", status: "CANCELLED" };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useCancelReservation(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("r1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/bookings/r1/cancel");
      expect(result.current.data?.status).toBe("CANCELLED");
    });
  });

  // ===== Payments =====

  describe("useInitiatePayment", () => {
    it("should initiate payment with provider", async () => {
      const mockResponse = {
        id: "p1",
        status: "PENDING",
        clientSecret: "pi_secret_123",
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useInitiatePayment(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          reservationId: "r1",
          provider: "STRIPE",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/payments/initiate", {
        reservationId: "r1",
        provider: "STRIPE",
      });
      expect(result.current.data?.clientSecret).toBe("pi_secret_123");
    });
  });

  describe("usePaymentProviders", () => {
    it("should fetch available payment providers", async () => {
      const mockData = [
        { provider: "STRIPE", displayName: "Stripe" },
        { provider: "PAYPAL", displayName: "PayPal" },
      ];
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => usePaymentProviders(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/payments/providers");
      expect(result.current.data).toHaveLength(2);
    });
  });

  // ===== Refund =====

  describe("useRefundPayment", () => {
    it("should refund a payment and invalidate related queries", async () => {
      const mockResponse = {
        id: "p1",
        reservationId: "r1",
        status: "REFUNDED",
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useRefundPayment(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("r1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/payments/refund/r1");
      expect(result.current.data?.status).toBe("REFUNDED");
    });

    it("should handle refund failure", async () => {
      mockPost.mockRejectedValueOnce(new Error("Refund failed"));

      const { result } = renderHook(() => useRefundPayment(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("r1");
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Refund failed");
    });
  });

  // ===== Queue =====

  describe("useJoinQueue", () => {
    it("should join event queue", async () => {
      const mockResponse = {
        id: "q1",
        eventId: "e1",
        queueToken: "token-abc",
        position: 5,
        status: "WAITING",
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useJoinQueue(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate("e1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockPost).toHaveBeenCalledWith("/queue/join/e1");
      expect(result.current.data?.position).toBe(5);
    });
  });

  describe("useQueuePosition", () => {
    it("should poll queue position with token", async () => {
      const mockResponse = {
        id: "q1",
        position: 3,
        status: "WAITING",
      };
      mockGet.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useQueuePosition("token-abc"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/queue/position/token-abc");
      expect(result.current.data?.position).toBe(3);
    });

    it("should not poll when token is null", () => {
      const { result } = renderHook(() => useQueuePosition(null), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });
});
