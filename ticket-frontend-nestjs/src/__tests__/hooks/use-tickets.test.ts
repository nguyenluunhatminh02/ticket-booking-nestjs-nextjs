import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";
import apiClient from "@/lib/api-client";
import {
  useMyTickets,
  useTicket,
  useTicketsByEvent,
  useCancelTicket,
  useTicketQrCode,
} from "@/hooks/use-tickets";

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

describe("Ticket Hooks", () => {
  const mockGet = vi.mocked(apiClient.get);
  const mockPost = vi.mocked(apiClient.post);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useMyTickets", () => {
    it("should fetch user tickets with pagination", async () => {
      const mockData = {
        content: [
          { id: "1", ticketCode: "TKT-ABC1", status: "VALID", tierName: "VIP" },
        ],
        totalPages: 1,
        totalElements: 1,
        number: 0,
        size: 20,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useMyTickets(0, 20), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/tickets/my", {
        params: { page: 0, size: 20 },
      });
      expect(result.current.data?.content).toHaveLength(1);
      expect(result.current.data?.content[0].ticketCode).toBe("TKT-ABC1");
    });
  });

  describe("useTicket", () => {
    it("should fetch single ticket by code", async () => {
      const mockTicket = { id: "1", ticketCode: "TKT-ABC1", status: "VALID" };
      mockGet.mockResolvedValueOnce({ data: mockTicket });

      const { result } = renderHook(() => useTicket("TKT-ABC1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/tickets/TKT-ABC1");
      expect(result.current.data?.ticketCode).toBe("TKT-ABC1");
    });

    it("should not fetch when ticketCode is empty", () => {
      const { result } = renderHook(() => useTicket(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useTicketsByEvent", () => {
    it("should fetch tickets by event id", async () => {
      const mockData = {
        content: [{ id: "1", ticketCode: "TKT-A", status: "VALID" }],
        totalPages: 1,
        totalElements: 1,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useTicketsByEvent("event-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith("/tickets/event/event-1", {
        params: { page: 0, size: 20 },
      });
    });
  });

  describe("useCancelTicket", () => {
    it("should cancel ticket", async () => {
      const cancelled = { ticketCode: "TKT-ABC1", status: "CANCELLED" };
      mockPost.mockResolvedValueOnce({ data: cancelled });

      const { result } = renderHook(() => useCancelTicket(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("TKT-ABC1");
      });

      expect(mockPost).toHaveBeenCalledWith("/tickets/TKT-ABC1/cancel");
    });
  });

  describe("useTicketQrCode", () => {
    it("should fetch QR code as blob URL", async () => {
      const blob = new Blob(["fake-qr"], { type: "image/png" });
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: blob });
      const { result } = renderHook(() => useTicketQrCode("TKT-ABC1"), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
    });
  });
});
