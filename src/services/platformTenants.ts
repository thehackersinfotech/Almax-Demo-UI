import { get, patch, post, upload } from "./api";

export type TenantStatus = "pending" | "active" | "suspended" | string;

/** Optional company-profile fields shared by create + update (Phase 8 branding). */
export interface TenantCompanyDetails {
  industry?: string;
  website?: string;
  contact_phone?: string;
  address?: string;
  tax_id?: string;
}

export interface PlanDefinition {
  slug: string;
  name: string;
  description: string;
  max_employees: number | null;
  max_projects: number | null;
  max_storage_mb: number | null;
  modules: string[];
  monthly_inr?: number | null;
  annual_inr?: number | null;
}

export interface TenantBillingSnapshot {
  plan: PlanDefinition;
  usage: { employees: number; projects: number };
  limits: {
    max_employees: number | null;
    max_projects: number | null;
    max_storage_mb: number | null;
  };
  at_limit: { employees: boolean; projects: boolean };
}

export interface PlatformTenantSummary {
  id: number;
  name: string;
  slug: string;
  schema_name: string;
  status: TenantStatus;
  plan: string;
  plan_name?: string;
  keycloak_realm: string;
  minio_bucket: string;
  domain: string | null;
  logo_url?: string | null;
  created_at: string | null;
}

export interface PlatformTenantCreatePayload extends TenantCompanyDetails {
  name: string;
  slug: string;
  admin_email: string;
  plan?: string;
  admin_first_name?: string;
  admin_last_name?: string;
  domain?: string;
}

export interface PlatformTenantCreateResult {
  id: number;
  slug: string;
  schema_name: string;
  status: TenantStatus;
  domain: string;
  task_id: string | null;
}

export interface ProvisioningStepRow {
  id: number;
  step: string;
  status: string;
  error_detail: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface PlatformTenantDetail extends PlatformTenantSummary, TenantCompanyDetails {
  provisioning_status: "pending" | "in_progress" | "active" | "failed" | string;
  is_platform: boolean;
  /** Workspace sign-in URL, e.g. http://acme.localhost:3000/bms/login */
  login_url: string;
  /** One-time set-password URL when invite email did not arrive (first visit only). */
  invite_link: string;
  billing?: TenantBillingSnapshot | null;
  steps: Record<string, ProvisioningStepRow>;
  logs: ProvisioningStepRow[];
}

export interface PlatformTenantRetryResult {
  id: number;
  slug: string;
  admin_email: string;
  task_id: string | null;
}

export const platformTenantsApi = {
  list: () =>
    get<{ count: number; results: PlatformTenantSummary[] }>("/platform/tenants/"),

  plans: () => get<{ results: PlanDefinition[] }>("/platform/plans/"),

  create: (payload: PlatformTenantCreatePayload) =>
    post<PlatformTenantCreateResult>("/platform/tenants/", payload),

  status: (tenantId: number) =>
    get<PlatformTenantDetail>(`/platform/tenants/${tenantId}/`),

  retry: (tenantId: number) =>
    post<PlatformTenantRetryResult>(`/platform/tenants/${tenantId}/retry/`, {}),

  updatePlan: (tenantId: number, plan: string) =>
    patch<{ id: number; slug: string; plan: string; billing: TenantBillingSnapshot | null }>(
      `/platform/tenants/${tenantId}/plan/`,
      { plan },
    ),

  updateDetails: (tenantId: number, details: TenantCompanyDetails) =>
    patch<PlatformTenantDetail>(`/platform/tenants/${tenantId}/`, details),

  uploadLogo: (tenantId: number, file: File) => {
    const formData = new FormData();
    formData.append("logo", file);
    return upload<{ id: number; logo_url: string | null }>(
      `/platform/tenants/${tenantId}/logo/`,
      formData,
    );
  },
};
