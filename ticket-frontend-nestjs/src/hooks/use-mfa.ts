import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import type { ApiResponse, MfaSetupResponse, MfaSetupConfirmRequest, MfaStatusResponse } from "@/types/auth";
import { useAuthStore } from "@/stores/auth-store";

export function useMfaStatus() {
  return useQuery({
    queryKey: ["mfa-status"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MfaStatusResponse>>("/mfa/status");
      return res.data.data;
    },
  });
}

export function useMfaSetup() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<MfaSetupResponse>>("/mfa/setup");
      return res.data.data;
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useMfaConfirm() {
  const queryClient = useQueryClient();
  const { setUser, user } = useAuthStore();

  return useMutation({
    mutationFn: async (data: MfaSetupConfirmRequest) => {
      const res = await apiClient.post<ApiResponse>("/mfa/setup/confirm", data);
      return res.data;
    },
    onSuccess: () => {
      if (user) setUser({ ...user, mfaEnabled: true });
      queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      toast.success("MFA enabled successfully");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useMfaDisable() {
  const queryClient = useQueryClient();
  const { setUser, user } = useAuthStore();

  return useMutation({
    mutationFn: async (totpCode: string) => {
      const res = await apiClient.delete<ApiResponse>("/mfa/disable", { params: { totpCode } });
      return res.data;
    },
    onSuccess: () => {
      if (user) setUser({ ...user, mfaEnabled: false });
      queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      toast.success("MFA disabled");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useMfaVerify() {
  return useMutation({
    mutationFn: async (totpCode: string) => {
      const res = await apiClient.post<ApiResponse>("/mfa/verify", null, { params: { totpCode } });
      return res.data;
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRegenerateBackupCodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (totpCode: string) => {
      const res = await apiClient.post<ApiResponse<string[]>>("/mfa/backup-codes/regenerate", null, {
        params: { totpCode },
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      queryClient.invalidateQueries({ queryKey: ["backup-codes-count"] });
      toast.success("Backup codes regenerated");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useBackupCodesCount() {
  return useQuery({
    queryKey: ["backup-codes-count"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<number>>("/mfa/backup-codes/count");
      return res.data.data;
    },
  });
}
