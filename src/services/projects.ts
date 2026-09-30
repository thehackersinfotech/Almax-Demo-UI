import { get, post, patch, del } from "./api";
import { ENDPOINTS } from "@/constants/api";

export interface ProjectBillingSummary {
  budget: number;
  milestone_planned: number;
  milestone_remaining: number;
  invoiced: number;
  invoice_remaining: number;
  received: number;
  outstanding_receivable: number;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description?: string;
  client?: string;
  client_name?: string;
  business_type?: string;
  business_type_name?: string;
  billing_type?: string;
  billing_type_name?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  estimated_hours: number;
  budget: number;
  logged_hours?: number;
  remaining_hours?: number;
  manager?: string;
  manager_name?: string;
  workflow_state?: string;
  workflow_state_name?: string;
  workflow_state_slug?: string;
  workflow_state_color?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ClientDropdownItem {
  id: string;
  name: string;
  code: string;
}

export interface ProjectHistoryEntry {
  id: string;
  action: "create" | "update";
  changes: Record<string, { old: string | null; new: string | null }>;
  changed_by_name: string;
  changed_by_avatar: string | null;
  changed_at: string;
}

export interface ProjectSummary {
  project: Project;
  total_tickets: number;
  open_tickets: number;
  estimated_hours: number;
  budget: number;
}

export const projectsApi = {
  list: (params?: Record<string, unknown>) =>
    get<PaginatedResponse<Project>>(ENDPOINTS.PROJECTS, params),
  get: (id: string) => get<Project>(`${ENDPOINTS.PROJECTS}${id}/`),
  create: (data: Partial<Project>) => post<Project>(ENDPOINTS.PROJECTS, data),
  update: (id: string, data: Partial<Project>) => patch<Project>(`${ENDPOINTS.PROJECTS}${id}/`, data),
  delete: (id: string) => del(`${ENDPOINTS.PROJECTS}${id}/`),
  summary: (id: string) => get<ProjectSummary>(`${ENDPOINTS.PROJECTS}${id}/summary/`),
  billingSummary: (id: string) =>
    get<ProjectBillingSummary>(`${ENDPOINTS.PROJECTS}${id}/billing-summary/`),
  history: (id: string) => get<ProjectHistoryEntry[]>(`${ENDPOINTS.PROJECTS}${id}/history/`),
  generateCode: (businessTypeId?: string) =>
    get<{ code: string }>(`${ENDPOINTS.PROJECTS}generate-code/`, businessTypeId ? { business_type_id: businessTypeId } : {}),
  clientDropdown: () => get<ClientDropdownItem[]>(`${ENDPOINTS.CLIENTS}dropdown/`),
  createClient: (data: { name: string; contact_person?: string; contact_email?: string; code?: string }) =>
    post<ClientDropdownItem>(ENDPOINTS.CLIENTS, data),
  transition: (id: string, destinationState: string, comments?: string, managerId?: string) =>
    post<{
      message: string;
      workflow_state_name: string;
      workflow_state_slug: string;
      workflow_state_color: string;
      manager: string | null;
      manager_name: string | null;
    }>(`${ENDPOINTS.PROJECTS}${id}/transition/`, {
      destination_state: destinationState,
      comments,
      ...(managerId !== undefined ? { manager: managerId } : {}),
    }),
  allowedTransitions: (id: string) =>
    get<Array<{
      destination_state_slug: string;
      destination_state_name: string;
      destination_state_color: string;
      label: string;
      group_names: string[];
    }>>(`${ENDPOINTS.PROJECTS}${id}/allowed-transitions/`),
  dropdown: () =>
    get<Array<{ id: string; name: string; code: string }>>(
      `${ENDPOINTS.PROJECTS}dropdown/`
    ),
  allocatedEmployees: (projectId: string) =>
    get<Array<{ id: string; full_name: string; employee_code: string; designation: string }>>(
      `${ENDPOINTS.PROJECTS}${projectId}/allocated-employees/`
    ),
};

export const epicsApi = {
  list: (params?: Record<string, unknown>) => get(ENDPOINTS.EPICS, params),
  get: (id: string) => get(`${ENDPOINTS.EPICS}${id}/`),
  create: (data: Record<string, unknown>) => post(ENDPOINTS.EPICS, data),
  update: (id: string, data: Record<string, unknown>) => patch(`${ENDPOINTS.EPICS}${id}/`, data),
  delete: (id: string) => del(`${ENDPOINTS.EPICS}${id}/`),
};

export const storiesApi = {
  list: (params?: Record<string, unknown>) => get(ENDPOINTS.STORIES, params),
  get: (id: string) => get(`${ENDPOINTS.STORIES}${id}/`),
  create: (data: Record<string, unknown>) => post(ENDPOINTS.STORIES, data),
  update: (id: string, data: Record<string, unknown>) => patch(`${ENDPOINTS.STORIES}${id}/`, data),
  delete: (id: string) => del(`${ENDPOINTS.STORIES}${id}/`),
};
