import { get, post, patch, del } from "./api";

const BASE = "/workflow";

export interface WorkflowGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface WorkflowState {
  id: string;
  name: string;
  slug: string;
  label: string;
  color_code: string;
  content_type: number;
  content_type_label: string;
  order: number;
  is_initial: boolean;
  is_final: boolean;
}

export interface WorkflowTransition {
  id: string;
  content_type: number;
  source_state: string;
  destination_state: string;
  label: string;
  position: Record<string, unknown>;
  groups: string[];
  group_names: string[];          // Keycloak group names (read)
  source_state_detail: WorkflowState;
  destination_state_detail: WorkflowState;
  group_details: WorkflowGroup[];
}

export const workflowGroupApi = {
  list: () => get<{ results: WorkflowGroup[] }>(`${BASE}/groups/`).then((r: any) => (Array.isArray(r) ? r : r.results ?? [])),
  create: (data: Partial<WorkflowGroup>) => post<WorkflowGroup>(`${BASE}/groups/`, data),
  update: (id: string, data: Partial<WorkflowGroup>) => patch<WorkflowGroup>(`${BASE}/groups/${id}/`, data),
  delete: (id: string) => del(`${BASE}/groups/${id}/`),
};

export const workflowStateApi = {
  list: (appLabel: string, model: string) =>
    get<any>(`${BASE}/states/?app_label=${appLabel}&model=${model}`).then((r: any) => (Array.isArray(r) ? r : r.results ?? [])),
  contentTypeId: (appLabel: string, model: string) =>
    get<{ id: number; app_label: string; model: string }>(`${BASE}/states/content-type-id/?app_label=${appLabel}&model=${model}`),
  create: (data: Partial<WorkflowState>) => post<WorkflowState>(`${BASE}/states/`, data),
  update: (id: string, data: Partial<WorkflowState>) => patch<WorkflowState>(`${BASE}/states/${id}/`, data),
  delete: (id: string) => del(`${BASE}/states/${id}/`),
};

export const workflowTransitionApi = {
  list: (appLabel: string, model: string) =>
    get<any>(`${BASE}/transitions/?app_label=${appLabel}&model=${model}`).then((r: any) => (Array.isArray(r) ? r : r.results ?? [])),
  create: (data: Partial<WorkflowTransition>) => post<WorkflowTransition>(`${BASE}/transitions/`, data),
  update: (id: string, data: Partial<WorkflowTransition>) => patch<WorkflowTransition>(`${BASE}/transitions/${id}/`, data),
  delete: (id: string) => del(`${BASE}/transitions/${id}/`),
};
