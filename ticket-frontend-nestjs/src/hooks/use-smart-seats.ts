import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { SeatSuggestion, DynamicPriceInfo } from "@/types/booking";

export function useSeatSuggestions(
  eventId?: string,
  quantity?: number,
  tierId?: string,
  section?: string
) {
  return useQuery<SeatSuggestion[]>({
    queryKey: ["smart-seats", "suggest", eventId, quantity, tierId, section],
    queryFn: async () => {
      const params = new URLSearchParams({ quantity: String(quantity) });
      if (tierId) params.set("tierId", tierId);
      if (section) params.set("section", section);
      const { data } = await apiClient.get(
        `/smart-seats/suggest/${eventId}?${params}`
      );
      return data;
    },
    enabled: !!eventId && !!quantity && quantity > 0,
  });
}

export function useDynamicPrice(tierId?: string) {
  return useQuery<DynamicPriceInfo>({
    queryKey: ["smart-seats", "pricing", tierId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/smart-seats/pricing/${tierId}`);
      return data;
    },
    enabled: !!tierId,
    refetchInterval: 60_000, // Refresh pricing every minute
  });
}

export function useEventDynamicPrices(eventId?: string) {
  return useQuery<Record<string, DynamicPriceInfo>>({
    queryKey: ["smart-seats", "pricing", "event", eventId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/smart-seats/pricing/event/${eventId}`
      );
      return data;
    },
    enabled: !!eventId,
    refetchInterval: 60_000,
  });
}
