import { get, post, patch, del } from "./api";
import { ENDPOINTS } from "@/constants/api";

export interface Allocation {
  id: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  designation_name: string | null;
  project: string;
  project_name: string;
  project_code: string;
  allocation_percentage: number;
  daily_hours: number;
  start_date: string;
  end_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AllocationCreatePayload {
  employee: string;
  project: string;
  allocation_percentage: number;
  start_date: string;
  end_date?: string | null;
  notes?: string;
}

export interface ProjectDropdown {
  id: string;
  name: string;
  code: string;
}

export const allocationApi = {
  list: (params?: Record<string, unknown>) =>
    get<any>(ENDPOINTS.ALLOCATIONS, params).then((r: any) =>
      Array.isArray(r) ? r : r.results ?? r
    ),
  get: (id: string) => get<Allocation>(`${ENDPOINTS.ALLOCATIONS}${id}/`),
  create: (data: AllocationCreatePayload) => post<Allocation>(ENDPOINTS.ALLOCATIONS, data),
  update: (id: string, data: Partial<AllocationCreatePayload>) =>
    patch<Allocation>(`${ENDPOINTS.ALLOCATIONS}${id}/`, data),
  delete: (id: string) => del(`${ENDPOINTS.ALLOCATIONS}${id}/`),
  projectDropdown: () => get<ProjectDropdown[]>(ENDPOINTS.PROJECT_DROPDOWN),
};
