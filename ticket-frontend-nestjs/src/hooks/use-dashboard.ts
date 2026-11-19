"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type {
  DashboardStats,
  CheckInRequest,
  CheckInResponse,
  Page,
} from "@/types/booking";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>("/admin/dashboard");
      return data;
    },
  });
}

export function useCheckIn() {
  return useMutation({
    mutationFn: async (request: CheckInRequest) => {
      const { data } = await apiClient.post<CheckInResponse>("/check-in", request);
      return data;
    },
  });
}

export function useCheckInsByEvent(eventId: string, page = 0, size = 50) {
  return useQuery({
    queryKey: ["check-ins", eventId, page, size],
    queryFn: async () => {
      const { data } = await apiClient.get<Page<CheckInResponse>>(
        `/check-in/event/${eventId}`,
        { params: { page, size } }
      );
      return data;
    },
    enabled: !!eventId,
  });
}

export function useCheckInCount(eventId: string) {
  return useQuery({
    queryKey: ["check-in-count", eventId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ checkInCount: number }>(
        `/check-in/event/${eventId}/count`
      );
      return data.checkInCount;
    },
    enabled: !!eventId,
  });
}

// Revenue Analytics hooks
export interface TierBreakdown {
  tierName: string;
  totalQuantity: number;
  soldQuantity: number;
  revenue: number;
  price: number;
}

export interface CategoryStats {
  category: string;
  eventCount: number;
  ticketsSold: number;
  revenue: number;
  averageOccupancy: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  ticketsSold: number;
  eventCount: number;
}

export interface RevenueAnalytics {
  eventId?: string;
  eventName?: string;
  category?: string;
  status?: string;
  totalTickets?: number;
  ticketsSold?: number;
  checkIns?: number;
  totalRevenue?: number;
  occupancyRate?: number;
  tierBreakdown?: TierBreakdown[];
  categoryStats?: CategoryStats[];
  monthlyRevenue?: MonthlyRevenue[];
  overallRevenue?: number;
}

export function useEventAnalytics(eventId: string) {
  return useQuery({
    queryKey: ["admin", "analytics", "event", eventId],
    queryFn: async () => {
      const { data } = await apiClient.get<RevenueAnalytics>(`/admin/analytics/event/${eventId}`);
      return data;
    },
    enabled: !!eventId,
  });
}

export function useCategoryAnalytics() {
  return useQuery({
    queryKey: ["admin", "analytics", "categories"],
    queryFn: async () => {
      const { data } = await apiClient.get<RevenueAnalytics>("/admin/analytics/categories");
      return data;
    },
  });
}

export function downloadPdf(url: string, filename: string) {
  return apiClient.get(url, { responseType: "blob" }).then((res) => {
    const blob = new Blob([res.data], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}
