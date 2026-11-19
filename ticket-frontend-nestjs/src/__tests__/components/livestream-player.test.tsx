import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import apiClient from "@/lib/api-client";

// Mock api-client
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

// Mock next/dynamic to render components synchronously in tests
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: (importFn: () => Promise<any>) => {
    // Return a wrapper component that renders loading initially
    const Component = React.lazy(importFn);
    return function DynamicWrapper(props: any) {
      return React.createElement(React.Suspense, { fallback: React.createElement("div", null, "Loading...") },
        React.createElement(Component, props)
      );
    };
  },
}));

// Mock @mux/mux-player-react
vi.mock("@mux/mux-player-react", () => ({
  __esModule: true,
  default: ({ playbackId, tokens, metadata }: any) =>
    React.createElement("div", {
      "data-testid": "mux-player",
      "data-playback-id": playbackId,
      "data-has-tokens": !!tokens?.playback,
    }, `MuxPlayer: ${metadata?.video_title || playbackId}`),
}));

// Mock useParams
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/livestream/test-event",
  useParams: () => ({ eventId: "test-event-id" }),
}));

import LivestreamPlayer from "@/components/booking/livestream-player";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("LivestreamPlayer Component", () => {
  const mockGet = vi.mocked(apiClient.get);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state initially", () => {
    mockGet.mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      React.createElement(
        createWrapper(),
        null,
        React.createElement(LivestreamPlayer, {
          eventId: "test-event-id",
          eventName: "Test Event",
        })
      )
    );

    expect(screen.getByText("Đang kiểm tra vé...")).toBeInTheDocument();
  });

  it("should show MuxPlayer when token is fetched successfully", async () => {
    const mockTokenResponse = {
      playbackId: "test-playback-id",
      playbackToken: "mock-playback-token",
      thumbnailToken: "mock-thumb-token",
      storyboardToken: "mock-story-token",
      eventName: "Test Event",
      expiresInSeconds: 7200,
    };
    mockGet.mockResolvedValueOnce({ data: mockTokenResponse });

    render(
      React.createElement(
        createWrapper(),
        null,
        React.createElement(LivestreamPlayer, {
          eventId: "test-event-id",
          eventName: "Test Event",
        })
      )
    );

    // Wait for MuxPlayer to appear
    const player = await screen.findByTestId("mux-player");
    expect(player).toBeInTheDocument();
    expect(player.getAttribute("data-playback-id")).toBe("test-playback-id");
    expect(player.getAttribute("data-has-tokens")).toBe("true");
  });

  it("should show 'buy ticket' prompt when user has no ticket", async () => {
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

    render(
      React.createElement(
        createWrapper(),
        null,
        React.createElement(LivestreamPlayer, {
          eventId: "test-event-id",
          eventName: "Test Event",
        })
      )
    );

    expect(await screen.findByText("Bạn cần mua vé để xem")).toBeInTheDocument();
    expect(screen.getByText("Mua vé ngay")).toBeInTheDocument();
  });

  it("should show error message for non-ticket related errors", async () => {
    const error = {
      response: {
        status: 503,
        data: {
          error: "Video streaming service is not available",
        },
      },
    };
    mockGet.mockRejectedValueOnce(error);

    render(
      React.createElement(
        createWrapper(),
        null,
        React.createElement(LivestreamPlayer, {
          eventId: "test-event-id",
        })
      )
    );

    expect(
      await screen.findByText("Video streaming service is not available")
    ).toBeInTheDocument();
  });
});
