import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import type {
  ApiResponse,
  UserResponse,
  UpdateProfileRequest,
  DeactivateAccountRequest,
} from "@/types/auth";

export function useProfile() {
  const { setUser } = useAuthStore();

  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<UserResponse>>("/users/me");
      const u = res.data.data;
      // Keep store in sync
      setUser({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username,
        phoneNumber: u.phoneNumber,
        roles: u.roles,
        emailVerified: u.emailVerified,
        mfaEnabled: u.mfaEnabled,
        profilePicture: u.profilePicture,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      });
      return u;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileRequest) => {
      const res = await apiClient.put<ApiResponse<UserResponse>>("/users/me", data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeactivateAccount() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DeactivateAccountRequest) => {
      const res = await apiClient.post<ApiResponse>("/users/me/deactivate", data);
      return res.data;
    },
    onSuccess: () => {
      logout();
      queryClient.clear();
      toast.success("Account deactivated");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post<ApiResponse<UserResponse>>(
        "/users/me/avatar",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Avatar uploaded");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<UserResponse>>("/users/me/avatar");
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Avatar removed");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUserById(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<UserResponse>>(`/users/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
