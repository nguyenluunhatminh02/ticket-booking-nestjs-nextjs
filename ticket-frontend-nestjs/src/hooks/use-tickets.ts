"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import type { TicketResponse, Page, DynamicQrResponse } from "@/types/booking";

export function useMyTickets(page = 0, size = 20) {
  return useQuery({
    queryKey: ["tickets", "my", page, size],
    queryFn: async () => {
      const { data } = await apiClient.get<Page<TicketResponse>>("/tickets/my", {
        params: { page, size },
      });
      return data;
    },
  });
}

export function useTicket(ticketCode: string) {
  return useQuery({
    queryKey: ["ticket", ticketCode],
    queryFn: async () => {
      const { data } = await apiClient.get<TicketResponse>(`/tickets/${ticketCode}`);
      return data;
    },
    enabled: !!ticketCode,
  });
}

export function useTicketsByEvent(eventId: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ["tickets", "event", eventId, page, size],
    queryFn: async () => {
      const { data } = await apiClient.get<Page<TicketResponse>>(`/tickets/event/${eventId}`, {
        params: { page, size },
      });
      return data;
    },
    enabled: !!eventId,
  });
}

export function useCancelTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticketCode: string) => {
      const { data } = await apiClient.post<TicketResponse>(`/tickets/${ticketCode}/cancel`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/**
 * Fetch QR code image as a blob URL via authenticated API client.
 * <img src> can't send Bearer token headers, so we fetch via axios and
 * convert to an object URL.
 */
export function useTicketQrCode(ticketCode: string | null) {
  return useQuery({
    queryKey: ["ticket-qr", ticketCode],
    queryFn: async () => {
      const { data } = await apiClient.get(`/tickets/${ticketCode}/qr`, {
        responseType: "blob",
      });
      return URL.createObjectURL(data);
    },
    enabled: !!ticketCode,
    staleTime: 1000 * 60 * 30, // 30 min cache
    gcTime: 1000 * 60 * 60,
    // Revoke old ObjectURL when query data is replaced to prevent memory leaks
    structuralSharing: (oldData, newData) => {
      if (typeof oldData === 'string' && oldData.startsWith('blob:')) {
        URL.revokeObjectURL(oldData);
      }
      return newData;
    },
  });
}

/**
 * Fetch a dynamic TOTP-based QR code that rotates every 30 seconds.
 * Auto-refreshes based on the refresh interval returned by the server.
 */
export function useDynamicQr(ticketCode: string | null) {
  return useQuery<DynamicQrResponse>({
    queryKey: ["ticket-dynamic-qr", ticketCode],
    queryFn: async () => {
      const { data } = await apiClient.get<DynamicQrResponse>(
        `/tickets/${ticketCode}/dynamic-qr`
      );
      return data;
    },
    enabled: !!ticketCode,
    refetchInterval: 25_000, // Refresh slightly before 30s TOTP window
    staleTime: 0, // Always considered stale
  });
}
