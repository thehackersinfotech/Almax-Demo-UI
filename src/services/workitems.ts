import { get, post, patch, del, upload } from "./api";
import { ENDPOINTS } from "@/constants/api";

export interface WorkItem {
  id: string;
  ticket_number: string;
  type: "TASK" | "BUG" | "CR";
  title: string;
  description?: string;
  priority: string;
  status: string;
  story: string;
  story_title?: string;
  project_name?: string;
  project_id?: string;
  assignee?: string;
  assignee_name?: string;
  estimated_hours: number;
  logged_hours?: number;
  remaining_hours?: number;
  variance?: number;
  due_date?: string;
  created_at: string;
}

export interface WorkLog {
  id: string;
  employee: string;
  employee_name?: string;
  work_item: string;
  work_item_title?: string;
  ticket_number?: string;
  log_date: string;
  hours: number;
  remarks?: string;
  is_billable: boolean;
  created_at: string;
}

export const workItemsApi = {
  list: (params?: Record<string, unknown>) => get(ENDPOINTS.WORK_ITEMS, params),
  get: (id: string) => get(`${ENDPOINTS.WORK_ITEMS}${id}/`),
  create: (data: Record<string, unknown>) => post(ENDPOINTS.WORK_ITEMS, data),
  update: (id: string, data: Record<string, unknown>) => patch(`${ENDPOINTS.WORK_ITEMS}${id}/`, data),
  delete: (id: string) => del(`${ENDPOINTS.WORK_ITEMS}${id}/`),
  transition: (id: string, destinationState: string, comments?: string) =>
    post(`${ENDPOINTS.WORK_ITEMS}${id}/transition/`, { destination_state: destinationState, comments }),
  history: (id: string) => get(`${ENDPOINTS.WORK_ITEMS}${id}/history/`),
  attachments: (id: string) => get(`${ENDPOINTS.WORK_ITEMS}${id}/attachments/`),
  uploadAttachment: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return upload(`${ENDPOINTS.WORK_ITEMS}${id}/attachments/`, fd);
  },
};

export const workLogsApi = {
  list: (params?: Record<string, unknown>) => get(ENDPOINTS.WORK_LOGS, params),
  create: (data: Record<string, unknown>) => post(ENDPOINTS.WORK_LOGS, data),
  update: (id: string, data: Record<string, unknown>) => patch(`${ENDPOINTS.WORK_LOGS}${id}/`, data),
  delete: (id: string) => del(`${ENDPOINTS.WORK_LOGS}${id}/`),
};
