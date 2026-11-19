import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";
import apiClient from "@/lib/api-client";
import {
  useDashboardStats,
  useCheckIn,
  useCheckInsByEvent,
  useCheckInCount,
} from "@/hooks/use-dashboard";

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

describe("Dashboard Hooks", () => {
  const mockGet = vi.mocked(apiClient.get);
  const mockPost = vi.mocked(apiClient.post);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useDashboardStats", () => {
    it("should fetch dashboard stats", async () => {
      const mockStats = {
        totalEvents: 10,
        onSaleEvents: 5,
        soldOutEvents: 2,
        totalReservations: 100,
        totalRevenue: 50000000,
        totalTicketsSold: 200,
        totalCheckIns: 150,
        averageOccupancyRate: 75.0,
        topSellingEvents: [],
        revenueByDay: [],
      };
      mockGet.mockResolvedValueOnce({ data: mockStats });

      const { result } = renderHook(() => useDashboardStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/admin/dashboard");
      expect(result.current.data?.totalEvents).toBe(10);
      expect(result.current.data?.totalTicketsSold).toBe(200);
      expect(result.current.data?.averageOccupancyRate).toBe(75.0);
    });
  });

  describe("useCheckIn", () => {
    it("should perform check-in", async () => {
      const mockResponse = {
        id: "ci-1",
        successful: true,
        ticketCode: "TKT-ABC1",
        attendeeName: "John Doe",
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useCheckIn(), {
        wrapper: createWrapper(),
      });

      let checkInResult: any;
      await act(async () => {
        checkInResult = await result.current.mutateAsync({
          ticketCode: "TKT-ABC1",
        });
      });

      expect(mockPost).toHaveBeenCalledWith("/check-in", {
        ticketCode: "TKT-ABC1",
      });
      expect(checkInResult.successful).toBe(true);
    });

    it("should handle failed check-in", async () => {
      const mockResponse = {
        id: "ci-2",
        successful: false,
        failureReason: "Ticket already used",
      };
      mockPost.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useCheckIn(), {
        wrapper: createWrapper(),
      });

      let checkInResult: any;
      await act(async () => {
        checkInResult = await result.current.mutateAsync({
          ticketCode: "TKT-USED",
        });
      });

      expect(checkInResult.successful).toBe(false);
      expect(checkInResult.failureReason).toBe("Ticket already used");
    });
  });

  describe("useCheckInsByEvent", () => {
    it("should fetch check-ins for event", async () => {
      const mockData = {
        content: [
          { id: "ci-1", successful: true, ticketCode: "TKT-1" },
        ],
        totalPages: 1,
        totalElements: 1,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useCheckInsByEvent("event-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith("/check-in/event/event-1", {
        params: { page: 0, size: 50 },
      });
    });

    it("should not fetch when eventId is empty", () => {
      const { result } = renderHook(() => useCheckInsByEvent(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useCheckInCount", () => {
    it("should fetch check-in count for event", async () => {
      mockGet.mockResolvedValueOnce({ data: { checkInCount: 42 } });

      const { result } = renderHook(() => useCheckInCount("event-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe(42);
    });
  });
});
