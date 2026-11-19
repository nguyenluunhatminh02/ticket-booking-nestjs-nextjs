"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "@/lib/api-client";
import type {
  EventResponse,
  SeatMapResponse,
  ReservationResponse,
  PaymentResponse,
  PaymentProviderInfo,
  QueuePositionResponse,
  ReserveTicketsRequest,
  Page,
  CouponResponse,
  ApplyCouponResponse,
  CreateCouponRequest,
} from "@/types/booking";
import type { ApiResponse } from "@/types/auth";

import { toast } from "sonner";

/* ===== Events ===== */

export function useEvents(page = 0, size = 12) {
  return useQuery({
    queryKey: ["events", page, size],
    queryFn: async () => {
      const { data } = await apiClient.get<Page<EventResponse>>("/events", {
        params: { page, size, status: "ON_SALE,PRESALE" },
      });
      return data;
    },
  });
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await apiClient.get<EventResponse>(`/events/${eventId}`);
      return data;
    },
    enabled: !!eventId,
  });
}

export function useEventSearch(query: string) {
  const trimmedQuery = query.trim();
  return useQuery({
    queryKey: ["events", "search", trimmedQuery],
    queryFn: async () => {
      const { data } = await apiClient.get<Page<EventResponse>>("/events/search", {
        params: { q: trimmedQuery },
      });
      return data;
    },
    enabled: trimmedQuery.length > 0,
  });
}

export function useSeatMap(eventId: string) {
  return useQuery({
    queryKey: ["seatMap", eventId],
    queryFn: async () => {
      const { data } = await apiClient.get<SeatMapResponse>(`/events/${eventId}/seats`);
      return data;
    },
    enabled: !!eventId,
  });
}

/* ===== Reservations ===== */

export function useReservations() {
  return useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      const { data } = await apiClient.get<ReservationResponse[]>("/bookings");
      return data;
    },
  });
}

export function useReservation(reservationId: string) {
  return useQuery({
    queryKey: ["reservation", reservationId],
    queryFn: async () => {
      const { data } = await apiClient.get<ReservationResponse>(`/bookings/${reservationId}`);
      return data;
    },
    enabled: !!reservationId,
  });
}

export function useReserveTickets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: ReserveTicketsRequest) => {
      const { data } = await apiClient.post<ReservationResponse>("/bookings/reserve", request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["seatMap"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reservationId: string) => {
      const { data } = await apiClient.post<ReservationResponse>(`/bookings/${reservationId}/cancel`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["seatMap"] });
      toast.success("Reservation cancelled");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/* ===== Payments ===== */

export function useInitiatePayment() {
  return useMutation({
    mutationFn: async ({ reservationId, provider }: { reservationId: string; provider: string }) => {
      const { data } = await apiClient.post<PaymentResponse>("/payments/initiate", { reservationId, provider });
      return data;
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function usePaymentProviders() {
  return useQuery({
    queryKey: ["paymentProviders"],
    queryFn: async () => {
      const { data } = await apiClient.get<PaymentProviderInfo[]>("/payments/providers");
      return data;
    },
    staleTime: 60 * 1000,
  });
}

export function usePaymentStatus(reservationId: string | undefined) {
  return useQuery({
    queryKey: ["paymentStatus", reservationId],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<PaymentResponse>(`/payments/status/${reservationId}`);
        return data;
      } catch (err: unknown) {
        // 404 means no payment exists yet — return null instead of throwing
        if (err && typeof err === "object" && "response" in err) {
          const response = (err as { response?: { status?: number } }).response;
          if (response?.status === 404) return null;
        }
        throw err;
      }
    },
    enabled: !!reservationId,
    refetchInterval: 10000,
    retry: false,
  });
}

/* ===== Queue ===== */

export function useJoinQueue() {
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data } = await apiClient.post<QueuePositionResponse>(`/queue/join/${eventId}`);
      return data;
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useQueuePosition(queueToken: string | null) {
  return useQuery({
    queryKey: ["queuePosition", queueToken],
    queryFn: async () => {
      const { data } = await apiClient.get<QueuePositionResponse>(`/queue/position/${queueToken}`);
      return data;
    },
    enabled: !!queueToken,
    refetchInterval: 3000,
  });
}

export function useLeaveQueue() {
  return useMutation({
    mutationFn: async (queueToken: string) => {
      await apiClient.post(`/queue/leave/${queueToken}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/* ===== Refund ===== */

export function useRefundPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reservationId: string) => {
      const { data } = await apiClient.post<PaymentResponse>(
        `/payments/refund/${reservationId}`
      );
      return data;
    },
    onSuccess: (_data, reservationId) => {
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["paymentStatus", reservationId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/* ===== Coupons (User) ===== */

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async ({ reservationId, couponCode }: { reservationId: string; couponCode: string }) => {
      const { data } = await apiClient.post<ApplyCouponResponse>("/coupons/validate", {
        reservationId,
        couponCode,
      });
      return data;
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useApplyCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reservationId, couponCode }: { reservationId: string; couponCode: string }) => {
      const { data } = await apiClient.post<ApplyCouponResponse>("/coupons/apply", {
        reservationId,
        couponCode,
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reservation", variables.reservationId] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRemoveCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reservationId: string) => {
      await apiClient.delete(`/coupons/remove/${reservationId}`);
    },
    onSuccess: (_data, reservationId) => {
      queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/* ===== Coupons (Admin) ===== */

export function useAdminCoupons(page = 0, size = 20) {
  return useQuery({
    queryKey: ["admin", "coupons", page, size],
    queryFn: async () => {
      const { data } = await apiClient.get<Page<CouponResponse>>("/coupons", {
        params: { page, size },
      });
      return data;
    },
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateCouponRequest) => {
      const { data } = await apiClient.post<CouponResponse>("/coupons", request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useToggleCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ couponId, active }: { couponId: string; active: boolean }) => {
      await apiClient.post(`/coupons/${couponId}/${active ? "activate" : "deactivate"}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (couponId: string) => {
      await apiClient.delete(`/coupons/${couponId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
