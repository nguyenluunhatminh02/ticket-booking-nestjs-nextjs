"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type {
  CommentResponse,
  CreateCommentRequest,
  Page,
} from "@/types/booking";

export function useComments(eventId: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ["comments", eventId, page, size],
    queryFn: async () => {
      const { data } = await apiClient.get<Page<CommentResponse>>(
        `/events/${eventId}/comments`,
        { params: { page, size } }
      );
      return data;
    },
    enabled: !!eventId,
  });
}

export function useAverageRating(eventId: string) {
  return useQuery({
    queryKey: ["comments", eventId, "rating"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ averageRating: number }>(
        `/events/${eventId}/comments/rating`
      );
      return data.averageRating;
    },
    enabled: !!eventId,
  });
}

export function useCommentEligibility(eventId: string, userId?: string) {
  return useQuery({
    queryKey: ["comments", eventId, "eligibility", userId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ canComment: boolean }>(
        `/events/${eventId}/comments/eligibility`
      );
      return data.canComment;
    },
    enabled: !!eventId && !!userId,
  });
}

export function useCreateComment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateCommentRequest) => {
      const { data } = await apiClient.post<CommentResponse>(
        `/events/${eventId}/comments`,
        request
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", eventId] });
    },
  });
}

export function useUpdateComment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const { data } = await apiClient.put<CommentResponse>(
        `/events/${eventId}/comments/${commentId}`,
        { content }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", eventId] });
    },
  });
}

export function useDeleteComment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      await apiClient.delete(`/events/${eventId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", eventId] });
    },
  });
}
