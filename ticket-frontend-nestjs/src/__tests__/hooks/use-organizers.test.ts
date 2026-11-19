import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";
import apiClient from "@/lib/api-client";
import {
  useOrganizers,
  useOrganizer,
  useCreateOrganizer,
  useFollowOrganizer,
  useUnfollowOrganizer,
} from "@/hooks/use-organizers";

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

describe("Organizer Hooks", () => {
  const mockGet = vi.mocked(apiClient.get);
  const mockPost = vi.mocked(apiClient.post);
  const mockDelete = vi.mocked(apiClient.delete);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useOrganizers", () => {
    it("should fetch organizers list", async () => {
      const mockData = {
        content: [{ id: "org-1", name: "Live Events Co", followerCount: 100 }],
        totalPages: 1,
        totalElements: 1,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useOrganizers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith("/organizers", {
        params: { search: undefined, page: 0, size: 20 },
      });
      expect(result.current.data?.content[0].name).toBe("Live Events Co");
    });

    it("should search organizers by name", async () => {
      const mockData = {
        content: [{ id: "org-1", name: "Live Events Co" }],
        totalPages: 1,
        totalElements: 1,
      };
      mockGet.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useOrganizers("Live"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith("/organizers", {
        params: { search: "Live", page: 0, size: 20 },
      });
    });
  });

  describe("useOrganizer", () => {
    it("should fetch single organizer", async () => {
      const mockOrg = { id: "org-1", name: "Live Events Co", following: true };
      mockGet.mockResolvedValueOnce({ data: mockOrg });

      const { result } = renderHook(() => useOrganizer("org-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGet).toHaveBeenCalledWith("/organizers/org-1");
      expect(result.current.data?.following).toBe(true);
    });

    it("should not fetch when id is empty", () => {
      const { result } = renderHook(() => useOrganizer(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useCreateOrganizer", () => {
    it("should create an organizer", async () => {
      const newOrg = { id: "org-2", name: "New Org" };
      mockPost.mockResolvedValueOnce({ data: newOrg });

      const { result } = renderHook(() => useCreateOrganizer(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ name: "New Org" });
      });

      expect(mockPost).toHaveBeenCalledWith("/organizers", { name: "New Org" });
    });
  });

  describe("useFollowOrganizer", () => {
    it("should follow an organizer", async () => {
      const followed = { id: "org-1", following: true, followerCount: 101 };
      mockPost.mockResolvedValueOnce({ data: followed });

      const { result } = renderHook(() => useFollowOrganizer(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("org-1");
      });

      expect(mockPost).toHaveBeenCalledWith("/organizers/org-1/follow");
    });
  });

  describe("useUnfollowOrganizer", () => {
    it("should unfollow an organizer", async () => {
      const unfollowed = { id: "org-1", following: false, followerCount: 99 };
      mockDelete.mockResolvedValueOnce({ data: unfollowed });

      const { result } = renderHook(() => useUnfollowOrganizer(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("org-1");
      });

      expect(mockDelete).toHaveBeenCalledWith("/organizers/org-1/follow");
    });
  });
});
