"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import type { EventResponse, Page } from "@/types/booking";

/* ────── Types ────── */
export interface CreateEventPayload {
  venueId: string;
  name: string;
  description?: string;
  artistName?: string;
  category: string;
  eventDate: string; // ISO
  doorsOpenAt?: string;
  coverImageUrl?: string;
  maxTicketsPerUser?: number;
  queueEnabled?: boolean;
}

export interface CreateTierPayload {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  totalQuantity: number;
  maxPerUser?: number;
  sortOrder?: number;
}

/* ────── Queries ────── */

/** Fetch all events (including DRAFT) for admin calendar view */
export function useAdminEvents(page = 0, size = 100) {
  return useQuery({
    queryKey: ["admin", "events", page, size],
    queryFn: async () => {
      const { data } = await apiClient.get<Page<EventResponse>>("/events", {
        params: { page, size },
      });
      return data;
    },
  });
}

/* ────── Mutations ────── */

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEventPayload) => {
      const { data } = await apiClient.post<EventResponse>("/events", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CreateEventPayload>) => {
      const { data } = await apiClient.put<EventResponse>(`/events/${eventId}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function usePublishEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<EventResponse>(`/events/${eventId}/publish`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCancelEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<EventResponse>(`/events/${eventId}/cancel`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useAddTicketTier(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTierPayload) => {
      const { data } = await apiClient.post(`/events/${eventId}/tiers`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
