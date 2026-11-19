import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";
import apiClient from "@/lib/api-client";
import {
  useLivestreamToken,
  useLivestreamAccess,
} from "@/hooks/use-livestream";

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

describe("Livestream Hooks", () => {
  const mockGet = vi.mocked(apiClient.get);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useLivestreamToken", () => {
    it("should fetch playback token for authorized user", async () => {
      const mockTokenResponse = {
        playbackId: "S84CVC01D52WJWkYhwiHsdOE8QQF1ubf7YJ014JcHJoAo",
        playbackToken: "eyJhbGciOiJSUzI1NiJ9.mock.token",
        thumbnailToken: "eyJhbGciOiJSUzI1NiJ9.mock.thumb",
        storyboardToken: "eyJhbGciOiJSUzI1NiJ9.mock.story",
        eventName: "Online Concert",
        expiresInSeconds: 7200,
      };
      mockGet.mockResolvedValueOnce({ data: mockTokenResponse });

      const { result } = renderHook(
        () => useLivestreamToken("event-123"),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/livestream/event-123/token");
      expect(result.current.data?.playbackId).toBe(
        "S84CVC01D52WJWkYhwiHsdOE8QQF1ubf7YJ014JcHJoAo"
      );
      expect(result.current.data?.playbackToken).toBeTruthy();
      expect(result.current.data?.expiresInSeconds).toBe(7200);
    });

    it("should not fetch when eventId is undefined", () => {
      const { result } = renderHook(
        () => useLivestreamToken(undefined),
        { wrapper: createWrapper() }
      );

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should not fetch when enabled is false", () => {
      const { result } = renderHook(
        () => useLivestreamToken("event-123", false),
        { wrapper: createWrapper() }
      );

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle 403 error when user has no ticket", async () => {
      const error = {
        response: {
          status: 403,
          data: {
            error: "You need a valid ticket to watch this livestream",
            requiresTicket: true,
          },
        },
      };
      mockGet.mockRejectedValueOnce(error);

      const { result } = renderHook(
        () => useLivestreamToken("event-456"),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("should handle 503 when Mux is not configured", async () => {
      const error = {
        response: {
          status: 503,
          data: { error: "Video streaming service is not available" },
        },
      };
      mockGet.mockRejectedValueOnce(error);

      const { result } = renderHook(
        () => useLivestreamToken("event-789"),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useLivestreamAccess", () => {
    it("should return access info for streaming event", async () => {
      const mockAccess = {
        eventId: "event-123",
        isStreamingEvent: true,
        hasPlayback: true,
        hasValidTicket: true,
        canWatch: true,
      };
      mockGet.mockResolvedValueOnce({ data: mockAccess });

      const { result } = renderHook(
        () => useLivestreamAccess("event-123"),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/livestream/event-123/access");
      expect(result.current.data?.canWatch).toBe(true);
      expect(result.current.data?.isStreamingEvent).toBe(true);
      expect(result.current.data?.hasValidTicket).toBe(true);
    });

    it("should return canWatch false when no ticket", async () => {
      const mockAccess = {
        eventId: "event-123",
        isStreamingEvent: true,
        hasPlayback: true,
        hasValidTicket: false,
        canWatch: false,
      };
      mockGet.mockResolvedValueOnce({ data: mockAccess });

      const { result } = renderHook(
        () => useLivestreamAccess("event-123"),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.canWatch).toBe(false);
    });

    it("should return canWatch false for offline events", async () => {
      const mockAccess = {
        eventId: "event-123",
        isStreamingEvent: false,
        hasPlayback: false,
        hasValidTicket: true,
        canWatch: false,
      };
      mockGet.mockResolvedValueOnce({ data: mockAccess });

      const { result } = renderHook(
        () => useLivestreamAccess("event-123"),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.canWatch).toBe(false);
      expect(result.current.data?.isStreamingEvent).toBe(false);
    });

    it("should not fetch when eventId is undefined", () => {
      const { result } = renderHook(
        () => useLivestreamAccess(undefined),
        { wrapper: createWrapper() }
      );

      expect(result.current.fetchStatus).toBe("idle");
    });
  });
});
