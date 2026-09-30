import { create } from "zustand";
import { persist } from "zustand/middleware";
import { API_BASE } from "@/constants/api";
import { resolveTenantSlug } from "@/services/tenant";

export const ACCESS_TOKEN_KEY  = "kc_access_token";
export const REFRESH_TOKEN_KEY = "kc_refresh_token";

export interface AuthUser {
  id: string;
  employee_id?: string | null;
  username: string;
  full_name: string;
  email: string;
  employee_code: string;
  designation: string;
  department: string;
  keycloak_group: string;
  joining_date: string | null;
  profile_picture_url: string | null;
  is_pmo: boolean;
  is_manager: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  last_login: string | null;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  permissions: string[];

  setToken: (token: string) => void;
  setRefreshToken: (token: string) => void;
  setUser: (user: AuthUser) => void;
  setPermissions: (permissions: string[]) => void;
  /** Clear all auth state + localStorage without making an API call. */
  clearAuth: () => void;
  /** Full logout — fires API call then clears. */
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      permissions: [],

      setToken: (token) => {
        set({ token });
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
      },

      setRefreshToken: (token) => {
        set({ refreshToken: token });
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
      },

      setUser: (user) => set({ user }),

      setPermissions: (permissions) => set({ permissions }),

      clearAuth: () => {
        set({ token: null, refreshToken: null, user: null, permissions: [] });
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      },

      logout: () => {
        const { refreshToken } = get();
        if (refreshToken) {
          const slug = resolveTenantSlug();
          fetch(`${API_BASE}/auth/logout/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY) ?? ""}`,
              "X-Tenant-Slug": slug,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }).catch(() => {});
        }
        set({ token: null, refreshToken: null, user: null, permissions: [] });
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      },
    }),
    {
      name: "bms-auth",
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        permissions: state.permissions,
      }),
    }
  )
);
