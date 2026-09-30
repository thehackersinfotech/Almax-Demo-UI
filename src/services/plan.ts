import { get } from "./api";
import type { PlanDefinition } from "./platformTenants";

export interface WorkspacePlan {
  tenant: { name: string; slug: string; status: string };
  plan: PlanDefinition;
  catalog: PlanDefinition[];
  usage?: { employees: number; projects: number };
  limits?: {
    max_employees: number | null;
    max_projects: number | null;
    max_storage_mb: number | null;
  };
  modules?: string[];
  at_limit?: { employees: boolean; projects: boolean };
}

export const planApi = {
  current: () => get<WorkspacePlan>("/plan/"),
};
