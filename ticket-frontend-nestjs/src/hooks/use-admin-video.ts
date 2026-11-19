"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

/* ===== Types ===== */

export interface UploadUrlResponse {
  uploadUrl: string;
  uploadId: string;
  eventId: string;
  eventName: string;
}

export interface LinkUploadResponse {
  status: string;
  assetId?: string;
  playbackId?: string;
  eventMode?: string;
  message: string;
}

export interface VideoStatusResponse {
  eventId: string;
  hasVideo: boolean;
  assetId?: string;
  playbackId?: string;
  assetStatus?: string;
  duration?: string;
  eventMode: string;
}

export interface FromUrlResponse {
  assetId: string;
  playbackId: string;
  assetStatus: string;
  eventMode: string;
  message: string;
}

/* ===== Hooks ===== */

/** Get video status for an event */
export function useVideoStatus(eventId: string) {
  return useQuery({
    queryKey: ["admin", "video-status", eventId],
    queryFn: async () => {
      const { data } = await apiClient.get<VideoStatusResponse>(
        `/admin/events/${eventId}/video/status`
      );
      return data;
    },
    enabled: !!eventId,
    staleTime: 10_000,
  });
}

/** Create a direct upload URL */
export function useCreateUploadUrl() {
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data } = await apiClient.post<UploadUrlResponse>(
        `/admin/events/${eventId}/video/upload-url`
      );
      return data;
    },
  });
}

/** Link an upload to an event (after upload completes) */
export function useLinkUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, uploadId }: { eventId: string; uploadId: string }) => {
      const { data } = await apiClient.post<LinkUploadResponse>(
        `/admin/events/${eventId}/video/link-upload`,
        { uploadId }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "video-status", variables.eventId] });
    },
  });
}

/** Add video from external URL */
export function useAddVideoFromUrl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, videoUrl }: { eventId: string; videoUrl: string }) => {
      const { data } = await apiClient.post<FromUrlResponse>(
        `/admin/events/${eventId}/video/from-url`,
        { videoUrl }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "video-status", variables.eventId] });
    },
  });
}

/** Update video settings manually */
export function useUpdateVideoSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      playbackId,
      assetId,
      eventMode,
    }: {
      eventId: string;
      playbackId?: string;
      assetId?: string;
      eventMode?: string;
    }) => {
      const { data } = await apiClient.put(
        `/admin/events/${eventId}/video`,
        { playbackId, assetId, eventMode }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "video-status", variables.eventId] });
    },
  });
}

/** Remove video from event */
export function useRemoveVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, deleteMuxAsset = false }: { eventId: string; deleteMuxAsset?: boolean }) => {
      const { data } = await apiClient.delete(
        `/admin/events/${eventId}/video`,
        { params: { deleteMuxAsset } }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "video-status", variables.eventId] });
    },
  });
}
