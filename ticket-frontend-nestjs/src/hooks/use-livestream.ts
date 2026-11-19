"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export interface LivestreamTokenResponse {
  playbackId: string;
  playbackToken: string;
  thumbnailToken: string;
  storyboardToken: string;
  eventName: string;
  expiresInSeconds: number;
}

export interface LivestreamAccessResponse {
  eventId: string;
  isStreamingEvent: boolean;
  hasPlayback: boolean;
  hasValidTicket: boolean;
  eventStarted: boolean;
  eventDate: string;
  canWatch: boolean;
}

/**
 * Hook to get signed Mux playback tokens for a livestream event.
 * Only succeeds if the user has a valid ticket for the event.
 */
export function useLivestreamToken(eventId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["livestream", "token", eventId],
    queryFn: async () => {
      const { data } = await apiClient.get<LivestreamTokenResponse>(
        `/livestream/${eventId}/token`
      );
      return data;
    },
    enabled: !!eventId && enabled,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - tokens may expire sooner than 30min
    refetchInterval: 4 * 60 * 1000, // refresh before token expiry
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to check if a user has access to watch a livestream.
 * Does not generate tokens — just checks ticket ownership.
 */
export function useLivestreamAccess(eventId: string | undefined) {
  return useQuery({
    queryKey: ["livestream", "access", eventId],
    queryFn: async () => {
      const { data } = await apiClient.get<LivestreamAccessResponse>(
        `/livestream/${eventId}/access`
      );
      return data;
    },
    enabled: !!eventId,
    staleTime: 60 * 1000, // 1 minute
  });
}
