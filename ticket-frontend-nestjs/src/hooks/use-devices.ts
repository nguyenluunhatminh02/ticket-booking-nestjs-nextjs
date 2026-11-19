import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import type { ApiResponse, DeviceResponse, ActiveSessionsResponse, RenameDeviceRequest } from "@/types/auth";

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<DeviceResponse[]>>("/devices");
      return res.data.data;
    },
  });
}

export function useActiveSessions() {
  return useQuery({
    queryKey: ["active-sessions"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ActiveSessionsResponse>>("/devices/sessions");
      return res.data.data;
    },
  });
}

export function useDeactivateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await apiClient.delete<ApiResponse>(`/devices/${deviceId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
      toast.success("Device removed");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeactivateOtherDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse>("/devices/others");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
      toast.success("Other devices removed");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useTrustDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await apiClient.post<ApiResponse>(`/devices/${deviceId}/trust`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Device trusted");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUntrustDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await apiClient.delete<ApiResponse>(`/devices/${deviceId}/trust`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Device untrusted");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRenameDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deviceId, data }: { deviceId: string; data: RenameDeviceRequest }) => {
      const res = await apiClient.put<ApiResponse>(`/devices/${deviceId}/name`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Device renamed");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
