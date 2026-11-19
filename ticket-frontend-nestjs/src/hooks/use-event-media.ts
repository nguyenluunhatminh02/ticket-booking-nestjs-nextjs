"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";

/* ────── Types ────── */
export interface EventMediaResponse {
  id: string;
  eventId: string;
  mediaType: "IMAGE" | "VIDEO";
  filePath: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  caption: string | null;
  sortOrder: number;
  url: string;
  createdAt: string;
}

/* ────── Queries ────── */
export function useEventMedia(eventId: string | undefined) {
  return useQuery({
    queryKey: ["events", eventId, "media"],
    queryFn: async () => {
      const { data } = await apiClient.get<EventMediaResponse[]>(
        `/events/${eventId}/media`
      );
      return data;
    },
    enabled: !!eventId,
  });
}

export function useEventImages(eventId: string | undefined) {
  return useQuery({
    queryKey: ["events", eventId, "media", "images"],
    queryFn: async () => {
      const { data } = await apiClient.get<EventMediaResponse[]>(
        `/events/${eventId}/media?type=IMAGE`
      );
      return data;
    },
    enabled: !!eventId,
  });
}

export function useEventVideos(eventId: string | undefined) {
  return useQuery({
    queryKey: ["events", eventId, "media", "videos"],
    queryFn: async () => {
      const { data } = await apiClient.get<EventMediaResponse[]>(
        `/events/${eventId}/media?type=VIDEO`
      );
      return data;
    },
    enabled: !!eventId,
  });
}

/* ────── Mutations ────── */
export function useUploadImages(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const { data } = await apiClient.post<EventMediaResponse[]>(
        `/events/${eventId}/media/images`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "media"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUploadVideo(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (caption) formData.append("caption", caption);
      const { data } = await apiClient.post<EventMediaResponse>(
        `/events/${eventId}/media/videos`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "media"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateMediaCaption(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mediaId, caption }: { mediaId: string; caption: string }) => {
      const { data } = await apiClient.put<EventMediaResponse>(
        `/events/${eventId}/media/${mediaId}`,
        { caption }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "media"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteMedia(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mediaId: string) => {
      await apiClient.delete(`/events/${eventId}/media/${mediaId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", eventId, "media"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
