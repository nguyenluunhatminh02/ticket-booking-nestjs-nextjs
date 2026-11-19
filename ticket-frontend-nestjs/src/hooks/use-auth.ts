import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { getDeviceId, getDeviceName, getDeviceType } from "@/lib/utils";
import { toast } from "sonner";
import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  MfaVerifyRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  LoginHistoryResponse,
  SecurityEventResponse,
  PageResponse,
  OAuth2Provider,
  ConnectedAccount,
} from "@/types/auth";

/* ===== Login ===== */

export function useLogin() {
  const { setAuth, setMfaRequired } = useAuthStore();

  return useMutation({
    mutationFn: async (data: { email: string; password: string; rememberMe?: boolean }) => {
      const payload: LoginRequest = {
        ...data,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        deviceType: getDeviceType(),
      };
      const res = await apiClient.post<ApiResponse<AuthResponse>>("/auth/login", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      if (data.mfaRequired && data.mfaToken) {
        setMfaRequired(data.mfaToken);
        toast.info("MFA verification required");
      } else {
        setAuth(data.user);
        toast.success("Logged in successfully");
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/* ===== Register ===== */

export function useRegister() {
  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const res = await apiClient.post<ApiResponse>("/auth/register", data);
      return res.data;
    },
    onSuccess: (data) => toast.success(data.message || "Registration successful. Check your email."),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/* ===== Verify MFA (post-login) ===== */

export function useVerifyMfa() {
  const { setAuth, mfaToken } = useAuthStore();

  return useMutation({
    mutationFn: async (totpCode: string) => {
      const payload: MfaVerifyRequest = {
        mfaToken: mfaToken!,
        totpCode,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        deviceType: getDeviceType(),
      };
      const res = await apiClient.post<ApiResponse<AuthResponse>>("/auth/verify-mfa", payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setAuth(data.user);
      toast.success("MFA verified");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/* ===== Logout ===== */

export function useLogout() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post("/auth/logout"),
    onSettled: () => {
      logout();
      queryClient.clear();
      toast.success("Logged out");
    },
  });
}

export function useLogoutAll() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post("/auth/logout-all"),
    onSettled: () => {
      logout();
      queryClient.clear();
      toast.success("Logged out from all devices");
    },
  });
}

/* ===== Password ===== */

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (data: ForgotPasswordRequest) => {
      const res = await apiClient.post<ApiResponse>("/auth/forgot-password", data);
      return res.data;
    },
    onSuccess: () => toast.success("If the email exists, a reset link has been sent."),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (data: ResetPasswordRequest) => {
      const res = await apiClient.post<ApiResponse>("/auth/reset-password", data);
      return res.data;
    },
    onSuccess: () => toast.success("Password reset successfully. Please log in."),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      const res = await apiClient.post<ApiResponse>("/auth/change-password", data);
      return res.data;
    },
    onSuccess: () => toast.success("Password changed successfully"),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/* ===== Email Verification ===== */

export function useVerifyEmail(token: string | null) {
  return useQuery({
    queryKey: ["verify-email", token],
    queryFn: async () => {
      const res = await apiClient.post<ApiResponse>("/auth/verify-email", { token });
      return res.data;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await apiClient.post<ApiResponse>("/auth/resend-verification", { email });
      return res.data;
    },
    onSuccess: () => toast.success("Verification email sent"),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/* ===== History ===== */

export function useLoginHistory(page = 0, size = 20) {
  return useQuery({
    queryKey: ["login-history", page, size],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PageResponse<LoginHistoryResponse>>>(
        "/auth/login-history",
        { params: { page, size } }
      );
      return res.data.data;
    },
  });
}

export function useSecurityEvents(page = 0, size = 20) {
  return useQuery({
    queryKey: ["security-events", page, size],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PageResponse<SecurityEventResponse>>>(
        "/auth/security-events",
        { params: { page, size } }
      );
      return res.data.data;
    },
  });
}

/* ===== OAuth2 ===== */
export function useOAuth2Providers() {
  return useQuery({
    queryKey: ["oauth2-providers"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<OAuth2Provider[]>>("/auth/oauth2/providers");
      return res.data.data;
    },
  });
}

export function useConnectedAccounts() {
  return useQuery({
    queryKey: ["connected-accounts"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ConnectedAccount[]>>("/auth/oauth2/connected-accounts");
      return res.data.data;
    },
  });
}

export function useDisconnectOAuth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: string) => {
      const res = await apiClient.delete<ApiResponse>(`/auth/oauth2/connected-accounts/${provider}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      toast.success("OAuth account disconnected");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
