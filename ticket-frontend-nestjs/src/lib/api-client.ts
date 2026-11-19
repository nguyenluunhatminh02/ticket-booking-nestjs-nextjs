import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "/api";

const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const deviceId = localStorage.getItem("device_id");
    if (deviceId) {
      config.headers["X-Device-Id"] = deviceId;
    }
  }
  return config;
});

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  const res = await axios.post(
    `${baseURL}/auth/refresh-token`,
    {},
    { timeout: 15000, withCredentials: true }
  );
  const payload = res.data?.data ?? res.data;
  if (res.status !== 200 || payload?.success === false) {
    throw new Error("Session refresh failed");
  }
}

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify-mfa",
  "/oauth2/redirect",
];

function forceLogout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth-storage");
  const path = window.location.pathname;
  const isPublic = path === "/" || PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (!isPublic) {
    window.location.assign(`/login?redirect=${encodeURIComponent(path)}`);
  }
}

const AUTH_EXCLUDED_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/verify-mfa",
  "/auth/refresh-token",
  "/auth/forgot-password",
  "/auth/reset-password",
];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";
    const excluded = AUTH_EXCLUDED_PATHS.some((p) => url.includes(p));

    if (status !== 401 || !original || original._retry || excluded) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      refreshPromise =
        refreshPromise ??
        refreshSession().finally(() => {
          refreshPromise = null;
        });
      await refreshPromise;
      return apiClient(original);
    } catch (refreshError) {
      forceLogout();
      return Promise.reject(refreshError);
    }
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; error?: string }
      | undefined;
    return data?.message || data?.error || error.message || "Request failed";
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}

export default apiClient;
