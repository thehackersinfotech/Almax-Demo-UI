import { useEffect, type ReactNode } from "react";
import { useTenantStore } from "@/store/tenant";
import { MOCK_TENANT } from "@/mock/mockApi";

/**
 * Loads tenant-info before rendering the app.
 * In mock/demo mode, uses MOCK_TENANT directly — no backend needed.
 */
export default function TenantGate({ children }: { children: ReactNode }) {
  const setTenant = useTenantStore((s) => s.setTenant);
  const tenant = useTenantStore((s) => s.tenant);

  useEffect(() => {
    if (!tenant) {
      setTenant(MOCK_TENANT);
    }
  }, []);

  return <>{children}</>;
}

