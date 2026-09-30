import axios, { type InternalAxiosRequestConfig, type AxiosResponse } from "axios";
import { message } from "antd";
import { API_BASE } from "@/constants/api";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, useAuthStore } from "@/store/auth";
import { resolveTenantSlug } from "@/services/tenant";
import { handleMockRequest } from "@/mock/mockApi";

// ── Mock mode — bypass all real HTTP calls ─────────────────────────────────────
const USE_MOCK = true; // Always use mock data — no backend needed

async function mockRequest<T>(url: string, method: string, data?: unknown): Promise<T> {
  // Strip leading slash and API base prefix to normalise
  return handleMockRequest(url, method, data) as Promise<T>;
}

// ── Axios instance ─────────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ── Token refresh queue ────────────────────────────────────────────────────────
// Prevents race conditions: if multiple requests fail with 401 simultaneously,
// only ONE refresh call is made; the rest wait in the queue.
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

function clearAuthAndRedirect() {
  useAuthStore.getState().clearAuth();
  window.location.href = "/bms/login";
}

function tenantHeaders(): Record<string, string> {
  const slug = resolveTenantSlug();
  return slug ? { "X-Tenant-Slug": slug } : {};
}

// ── Request interceptor — attach Bearer token + tenant slug ───────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY) || useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const slug = resolveTenantSlug();
  if (slug) {
    config.headers["X-Tenant-Slug"] = slug;
  }
  // Let the browser set multipart boundary for file uploads
  if (config.data instanceof FormData) {
    if (config.headers) {
      if (typeof config.headers.delete === "function") {
        config.headers.delete("Content-Type");
        config.headers.delete("content-type");
      } else {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }
  }
  return config;
});

// ── Response interceptor — handle 401 (refresh) and 403 (show toast) ──────────
client.interceptors.response.use(
  (res) => {
    // Auto-unwrap ViewSet success envelope: { status:"success", data: {...} }
    // Auth endpoints (APIView) return plain objects — they pass through unchanged.
    if (res.data?.status === "success" && Object.prototype.hasOwnProperty.call(res.data, "data")) {
      res.data = res.data.data;
    }
    return res;
  },
  async (error) => {
    const status: number | undefined = error.response?.status;
    const url: string = error.config?.url || "";
    const originalRequest: InternalAxiosRequestConfig & { _retry?: boolean } =
      error.config;

    // ── 401: attempt silent token refresh ─────────────────────────────────────
    if (status === 401) {
      // Login endpoint failures should bubble up to the LoginPage error handler
      if (url.includes("/auth/token/") || url.includes("/auth/login/")) {
        return Promise.reject(error);
      }

      // If another refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // Prevent retrying the same request twice
      if (originalRequest._retry) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      if (!refreshToken) {
        // No refresh token stored — session is gone
        isRefreshing = false;
        processQueue(error, null);
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        // Call refresh endpoint (bypass our interceptor by using axios directly)
        const { data } = await axios.post<{
          access_token: string;
          refresh_token?: string;
        }>(
          `${API_BASE}/auth/token/refresh/`,
          { refresh_token: refreshToken },
          { headers: { "Content-Type": "application/json", ...tenantHeaders() } }
        );

        const newAccessToken = data.access_token;

        // Persist new tokens
        useAuthStore.getState().setToken(newAccessToken);
        if (data.refresh_token) {
          useAuthStore.getState().setRefreshToken(data.refresh_token);
        }

        // Unblock all queued requests with the new token
        processQueue(null, newAccessToken);

        // Retry the original failed request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        // Refresh itself failed (token expired/revoked) — force re-login
        processQueue(refreshError, null);
        message.error("Session expired. Please log in again.", 4);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── 403: show permission error (skip if it's actually an auth/token error) ──
    if (status === 403) {
      const d = error.response?.data;
      const detail: string = d?.errors?.detail || d?.message || "";
      const isAuthError = /token|authentication|expired/i.test(detail);
      // Plan entitlement denials are expected on lower tiers — don't toast them.
      // Callers / nav already hide modules the plan does not include.
      const isPlanModuleGate =
        !!d?.errors?.plan_module ||
        /not included in plan/i.test(detail) ||
        /not included in plan/i.test(String(d?.message || ""));
      if (isAuthError) {
        // Treat stale-token 403s the same as 401 — attempt refresh
        clearAuthAndRedirect();
      } else if (!isPlanModuleGate) {
        message.error(detail || "You do not have permission to perform this action.", 4);
      }
    }

    return Promise.reject(error);
  }
);

// ── Public HTTP helpers ────────────────────────────────────────────────────────
export function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  if (USE_MOCK) return mockRequest<T>(url, "GET", params);
  return client.get<T>(url, { params }).then((r) => r.data);
}

export function post<T>(url: string, data?: unknown, p0?: { headers: { "Content-Type": string; }; }): Promise<T> {
  if (USE_MOCK) return mockRequest<T>(url, "POST", data);
  return client.post<T>(url, data).then((r) => r.data);
}

export function patch<T>(url: string, data?: unknown): Promise<T> {
  if (USE_MOCK) return mockRequest<T>(url, "PATCH", data);
  return client.patch<T>(url, data).then((r) => r.data);
}

export function put<T>(url: string, data?: unknown): Promise<T> {
  if (USE_MOCK) return mockRequest<T>(url, "PUT", data);
  return client.put<T>(url, data).then((r) => r.data);
}

export function del<T>(url: string): Promise<T> {
  if (USE_MOCK) return mockRequest<T>(url, "DELETE");
  return client.delete<T>(url).then((r) => r.data);
}

export function upload<T>(url: string, formData: FormData): Promise<T> {
  if (USE_MOCK) {
    const data: Record<string, any> = {};
    formData.forEach((v, k) => { if (typeof v === "string") data[k] = v; });
    return mockRequest<T>(url, "POST", data);
  }
  return client.post<T>(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);
}

export default client;
