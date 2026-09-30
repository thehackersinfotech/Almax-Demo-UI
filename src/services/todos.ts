import { get, post, patch, del } from "./api";

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  content?: string;
  comments?: string;
  priority: string;
  priority_label?: string;
  assignee?: string;
  assignee_name?: string;
  assignees?: string[];
  assignees_data?: Array<{ id: string; full_name: string }>;
  reporter?: string;
  reporter_name?: string;
  start_date?: string | null;
  due_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  source?: string;
  lead?: string | null;
  lead_name?: string;
  lead_company?: string;
  lead_client_name?: string;
  is_overdue?: boolean;
  is_completed?: boolean;
  status?: string;
  workflow_state?: string;
  workflow_state_name?: string;
  workflow_state_slug?: string;
  workflow_state_color?: string;
  can_transition?: boolean;
  allowed_destination_slugs?: string[];
  created_at?: string;
}

export interface TodoCreate {
  title: string;
  description?: string;
  content?: string;
  priority?: string;
  assignee?: string;
  assignees?: string[];
  reporter?: string | null;
  lead?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  comments?: string;
  source?: string;
}

import { PRIORITY_TONES } from "@/utils/semanticColors";

export const TODO_PRIORITIES = [
  { value: "HIGH",   label: "High",   ...PRIORITY_TONES.IMPORTANT },
  { value: "MEDIUM", label: "Medium", ...PRIORITY_TONES.MEDIUM },
  { value: "LOW",    label: "Low",    ...PRIORITY_TONES.LOW },
];

export const TODO_BOARD_COLUMNS = [
  { slug: "open", label: "Open", color: "#8B5CF6" },
  { slug: "inprogress", label: "In Progress", color: "#3B82F6" },
  { slug: "done", label: "Done", color: "#10B981" },
  { slug: "cancelled", label: "Cancelled", color: "#EF4444" },
];

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
}

export const todoApi = {
  list: (params?: Record<string, string | number>) =>
    get<PaginatedResponse<TodoItem>>("/todos/", params),

  board: (params?: Record<string, string>) =>
    get<{ columns: Record<string, TodoItem[]>; count: number }>("/todos/board/", params),

  retrieve: (id: string) => get<TodoItem>(`/todos/${id}/`),
  get: (id: string) => get<TodoItem>(`/todos/${id}/`),

  create: (data: TodoCreate) => post<TodoItem>("/todos/", data),

  update: (id: string, data: Partial<TodoCreate>) => patch<TodoItem>(`/todos/${id}/`, data),

  delete: (id: string) => del(`/todos/${id}/`),

  transition: (id: string, destination_state: string, comments?: string) =>
    post(`/todos/${id}/transition/`, { destination_state, comments: comments ?? "" }),
};
