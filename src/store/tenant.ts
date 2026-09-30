import { create } from "zustand";
import type { TenantInfo } from "@/services/tenant";

interface TenantState {
  tenant: TenantInfo | null;
  setTenant: (tenant: TenantInfo | null) => void;
}

/** Current workspace from TenantGate (slug, is_platform, realm, …). */
export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  setTenant: (tenant) => set({ tenant }),
}));
