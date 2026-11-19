import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";
import apiClient from "@/lib/api-client";
import {
  useComments,
  useAverageRating,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from "@/hooks/use-comments";

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

describe("Comment Hooks", () => {
  const mockGet = vi.mocked(apiClient.get);
  const mockPost = vi.mocked(apiClient.post);
  const mockPut = vi.mocked(apiClient.put);
  const mockDelete = vi.mocked(apiClient.delete);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const eventId = "event-123";

  describe("useComments", () => {
    it("should fetch comments for event", async () => {
      const mockData = {
        content: [
          { id: "c1", content: "Great!", rating: 5, badgeType: "VIP", replies: [] },
        ],
        totalPages: 1,
        totalElements: 1,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useComments(eventId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith(`/events/${eventId}/comments`, {
        params: { page: 0, size: 20 },
      });
      expect(result.current.data?.content[0].content).toBe("Great!");
    });

    it("should not fetch when eventId is empty", () => {
      const { result } = renderHook(() => useComments(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useAverageRating", () => {
    it("should fetch average rating", async () => {
      mockGet.mockResolvedValueOnce({ data: { averageRating: 4.5 } });

      const { result } = renderHook(() => useAverageRating(eventId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe(4.5);
    });
  });

  describe("useCreateComment", () => {
    it("should create a comment", async () => {
      const newComment = { id: "c2", content: "Nice!", rating: 4, replies: [] };
      mockPost.mockResolvedValueOnce({ data: newComment });

      const { result } = renderHook(() => useCreateComment(eventId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ content: "Nice!", rating: 4 });
      });

      expect(mockPost).toHaveBeenCalledWith(`/events/${eventId}/comments`, {
        content: "Nice!",
        rating: 4,
      });
    });
  });

  describe("useUpdateComment", () => {
    it("should update a comment", async () => {
      const updated = { id: "c1", content: "Updated!", edited: true, replies: [] };
      mockPut.mockResolvedValueOnce({ data: updated });

      const { result } = renderHook(() => useUpdateComment(eventId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ commentId: "c1", content: "Updated!" });
      });

      expect(mockPut).toHaveBeenCalledWith(`/events/${eventId}/comments/c1`, {
        content: "Updated!",
      });
    });
  });

  describe("useDeleteComment", () => {
    it("should delete a comment", async () => {
      mockDelete.mockResolvedValueOnce({ data: undefined });

      const { result } = renderHook(() => useDeleteComment(eventId), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("c1");
      });

      expect(mockDelete).toHaveBeenCalledWith(`/events/${eventId}/comments/c1`);
    });
  });
});
