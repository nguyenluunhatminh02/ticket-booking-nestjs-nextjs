import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

// Mock the hooks
const mockComments = {
  content: [
    {
      id: "c1",
      userId: "user-1",
      userName: "John Doe",
      content: "Amazing event!",
      rating: 5,
      badgeType: "VIP",
      badgeLabel: "VIP Attendee",
      edited: false,
      replies: [],
      createdAt: "2026-01-15T10:00:00Z",
    },
    {
      id: "c2",
      userId: "user-2",
      userName: "Jane Smith",
      content: "Good show",
      rating: 4,
      badgeType: "ATTENDEE",
      badgeLabel: "Verified Attendee",
      edited: true,
      replies: [
        {
          id: "r1",
          userId: "user-1",
          userName: "John Doe",
          content: "I agree!",
          badgeType: "VIP",
          badgeLabel: "VIP Attendee",
          edited: false,
          replies: [],
          createdAt: "2026-01-15T11:00:00Z",
        },
      ],
      createdAt: "2026-01-15T09:00:00Z",
    },
  ],
  totalElements: 2,
  totalPages: 1,
};

const mockMutateAsync = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("@/hooks/use-comments", () => ({
  useComments: vi.fn(() => ({
    data: mockComments,
    isLoading: false,
  })),
  useAverageRating: vi.fn(() => ({
    data: 4.5,
  })),
  useCreateComment: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
  useDeleteComment: vi.fn(() => ({
    mutate: mockDeleteMutate,
    isPending: false,
  })),
  useCommentEligibility: vi.fn(() => ({
    data: true,
  })),
}));

import CommentSection from "@/components/booking/comment-section";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("CommentSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it("should render comments", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" />
      </QueryClientProvider>
    );

    expect(screen.getByText("Amazing event!")).toBeDefined();
    expect(screen.getByText("Good show")).toBeDefined();
  });

  it("should display comment count", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Comments \(2\)/)).toBeDefined();
  });

  it("should display average rating", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" />
      </QueryClientProvider>
    );

    expect(screen.getByText("4.5")).toBeDefined();
  });

  it("should display VIP badge", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" />
      </QueryClientProvider>
    );

    const vipBadges = screen.getAllByText("VIP Attendee");
    expect(vipBadges.length).toBeGreaterThan(0);
  });

  it("should display edited indicator", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" />
      </QueryClientProvider>
    );

    expect(screen.getByText("(edited)")).toBeDefined();
  });

  it("should render nested replies", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" />
      </QueryClientProvider>
    );

    expect(screen.getByText("I agree!")).toBeDefined();
  });

  it("should show comment form when user is logged in", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" currentUserId="user-1" />
      </QueryClientProvider>
    );

    expect(screen.getByPlaceholderText("Share your experience...")).toBeDefined();
    expect(screen.getByText("Your rating:")).toBeDefined();
  });

  it("should not show comment form when user not logged in", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" />
      </QueryClientProvider>
    );

    expect(screen.queryByPlaceholderText("Share your experience...")).toBeNull();
  });

  it("should show delete button only for own comments", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" currentUserId="user-1" />
      </QueryClientProvider>
    );

    // user-1 should see delete on their comments but not on user-2's
    const deleteButtons = screen.getAllByText("Delete");
    // user-1 has 2 comments (c1 + reply r1)
    expect(deleteButtons.length).toBe(2);
  });

  it("should submit new comment", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CommentSection eventId="event-1" currentUserId="user-1" />
      </QueryClientProvider>
    );

    const input = screen.getByPlaceholderText("Share your experience...");
    fireEvent.change(input, { target: { value: "New comment!" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        content: "New comment!",
        rating: undefined,
      });
    });
  });
});
