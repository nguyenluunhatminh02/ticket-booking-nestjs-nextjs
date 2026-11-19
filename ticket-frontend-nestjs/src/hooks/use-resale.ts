import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import type {
  Page,
  ResaleListingResponse,
  ResaleListingRequest,
} from "@/types/booking";

// === Queries ===

export function useMarketplaceListings(eventId?: string, page = 0, size = 20) {
  return useQuery<Page<ResaleListingResponse>>({
    queryKey: ["resale", "marketplace", eventId, page, size],
    queryFn: async () => {
      const url = eventId
        ? `/resale/event/${eventId}?page=${page}&size=${size}`
        : `/resale/marketplace?page=${page}&size=${size}`;
      const { data } = await apiClient.get(url);
      return data;
    },
  });
}

export function useMyResaleListings(page = 0, size = 20) {
  return useQuery<Page<ResaleListingResponse>>({
    queryKey: ["resale", "my-listings", page, size],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/resale/my-listings?page=${page}&size=${size}`
      );
      return data;
    },
  });
}

export function useResaleListingDetails(listingId?: string) {
  return useQuery<ResaleListingResponse>({
    queryKey: ["resale", "listing", listingId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/resale/${listingId}`);
      return data;
    },
    enabled: !!listingId,
  });
}

// === Mutations ===

export function useListForResale() {
  const queryClient = useQueryClient();
  return useMutation<ResaleListingResponse, Error, ResaleListingRequest>({
    mutationFn: async (request) => {
      const { data } = await apiClient.post("/resale/list", request);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resale"] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Ticket listed for resale");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useLockResaleListing() {
  const queryClient = useQueryClient();
  return useMutation<ResaleListingResponse, Error, string>({
    mutationFn: async (listingId) => {
      const { data } = await apiClient.post(`/resale/${listingId}/lock`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resale"] });
    },
  });
}

export function usePurchaseResaleListing() {
  const queryClient = useQueryClient();
  return useMutation<ResaleListingResponse, Error, string>({
    mutationFn: async (listingId) => {
      const { data } = await apiClient.post(`/resale/${listingId}/purchase`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resale"] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useCancelResaleListing() {
  const queryClient = useQueryClient();
  return useMutation<ResaleListingResponse, Error, string>({
    mutationFn: async (listingId) => {
      const { data } = await apiClient.post(`/resale/${listingId}/cancel`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resale"] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
