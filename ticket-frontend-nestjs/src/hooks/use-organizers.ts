"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type {
  OrganizerResponse,
  CreateOrganizerRequest,
  Page,
} from "@/types/booking";

export function useOrganizers(search?: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ["organizers", search, page, size],
    queryFn: async () => {
      const { data } = await apiClient.get<Page<OrganizerResponse>>("/organizers", {
        params: { search, page, size },
      });
      return data;
    },
  });
}

export function useOrganizer(id: string) {
  return useQuery({
    queryKey: ["organizer", id],
    queryFn: async () => {
      const { data } = await apiClient.get<OrganizerResponse>(`/organizers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateOrganizer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateOrganizerRequest) => {
      const { data } = await apiClient.post<OrganizerResponse>("/organizers", request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizers"] });
    },
  });
}

export function useFollowOrganizer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (organizerId: string) => {
      const { data } = await apiClient.post<OrganizerResponse>(`/organizers/${organizerId}/follow`);
      return data;
    },
    onSuccess: (_, organizerId) => {
      queryClient.invalidateQueries({ queryKey: ["organizer", organizerId] });
    },
  });
}

export function useUnfollowOrganizer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (organizerId: string) => {
      const { data } = await apiClient.delete<OrganizerResponse>(`/organizers/${organizerId}/follow`);
      return data;
    },
    onSuccess: (_, organizerId) => {
      queryClient.invalidateQueries({ queryKey: ["organizer", organizerId] });
    },
  });
}
