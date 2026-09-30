import { get, post, patch, del, upload } from "@/services/api";

export type TicketType =
  | "EPIC" | "STORY" | "TASK" | "SUBTASK"
  | "BUG" | "CHANGE_REQUEST" | "DEPLOYMENT" | "DOCUMENT" | "MILESTONE";

export type TicketPriority = "IMMEDIATE" | "CRITICAL" | "HIGH" | "MEDIUM" | "DEFERRED";

export interface TicketState {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface TicketListItem {
  id: string;
  ticket_id: string;
  title: string;
  type: TicketType;
  priority: TicketPriority;
  workflow_state: string | null;
  workflow_state_name: string;
  workflow_state_slug: string;
  workflow_state_color: string;
  is_final: boolean;
  project: string;
  project_name: string;
  project_code: string;
  project_manager_id: string | null;
  assignee: string | null;
  assignee_name: string | null;
  reporter: string | null;
  reporter_name: string | null;
  parent: string | null;
  parent_ticket_id: string | null;
  parent_title: string | null;
  children_count: number;
  due_date: string | null;
  original_estimate: number;
  logged_hours: number;
  approved: boolean;
  verified_by_name: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketAttachment {
  id: string;
  file: string;
  file_url: string | null;
  file_name: string;
  file_size: number;
  content_type: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface TicketComment {
  id: string;
  ticket: string;
  author: string | null;
  author_name: string | null;
  author_avatar: string | null;
  body: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketHistoryEntry {
  id: string;
  action: string;
  changes: Record<string, { old: string | null; new: string | null }>;
  changed_by_name: string;
  changed_at: string;
  comments?: string;
}

export interface TicketChildItem extends TicketListItem {
  available_states: TicketState[];
}

export interface TicketDetail extends TicketListItem {
  description: string;
  available_states: TicketState[];
  parent_title: string | null;
  parent_chain?: Array<{ id: string; ticket_id: string; title: string; type: TicketType }>;
  excluded_parent_ids: string[];
  remaining_hours: number;
  notify_users: string[];
  notify_users_info: Array<{ id: string; name: string }>;
  attachments: TicketAttachment[];
  verified_by_name: string | null;
  verified_at: string | null;
  updated_at: string;
}

export interface CreateTicketPayload {
  project: string;
  title: string;
  description?: string;
  type: TicketType;
  priority?: TicketPriority;
  assignee?: string | null;
  reporter?: string | null;
  due_date?: string | null;
  original_estimate?: number;
  parent?: string | null;
  approved?: boolean;
  notify_users?: string[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const ticketsApi = {
  list: (params?: Record<string, any>) =>
    get<PaginatedResponse<TicketListItem>>("/tickets/", params),

  retrieve: (id: string) =>
    get<TicketDetail>(`/tickets/${id}/`),

  create: (data: CreateTicketPayload) =>
    post<TicketDetail>("/tickets/", data),

  update: (id: string, data: Partial<CreateTicketPayload>) =>
    patch<TicketDetail>(`/tickets/${id}/`, data),

  delete: (id: string) =>
    del(`/tickets/${id}/`),

  transition: (id: string, destination_state: string, comments?: string) =>
    post(`/tickets/${id}/transition/`, { destination_state, comments }),

  verify: (id: string) =>
    post<{ message: string; verified_by_name: string; verified_at: string }>(`/tickets/${id}/verify/`, {}),

  getComments: (id: string) =>
    get<TicketComment[]>(`/tickets/${id}/comments/`),

  addComment: (id: string, body: string, mentionedUserIds?: string[]) =>
    post<TicketComment>(`/tickets/${id}/comments/`, { body, mentioned_user_ids: mentionedUserIds ?? [] }),

  updateComment: (ticketId: string, commentId: string, body: string) =>
    patch<TicketComment>(`/tickets/${ticketId}/comments/${commentId}/`, { body }),

  deleteComment: (ticketId: string, commentId: string) =>
    del(`/tickets/${ticketId}/comments/${commentId}/`),

  getHistory: (id: string) =>
    get<TicketHistoryEntry[]>(`/tickets/${id}/history/`),

  getAttachments: (id: string) =>
    get<TicketAttachment[]>(`/tickets/${id}/attachments/`),

  uploadAttachment: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return upload<TicketAttachment>(`/tickets/${id}/attachments/`, fd);
  },

  deleteAttachment: (ticketId: string, attachmentId: string) =>
    del(`/tickets/${ticketId}/attachments/${attachmentId}/`),

  getChildren: (id: string) =>
    get<TicketChildItem[]>(`/tickets/${id}/children/`),
};

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  EPIC: "Epic",
  STORY: "Story",
  TASK: "Task",
  SUBTASK: "Sub-Task",
  BUG: "Bug",
  CHANGE_REQUEST: "Change Request",
  DEPLOYMENT: "Deployment",
  DOCUMENT: "Document",
  MILESTONE: "Milestone",
};

export const TICKET_TYPE_COLORS: Record<TicketType, string> = {
  EPIC: "purple",
  STORY: "green",
  TASK: "blue",
  SUBTASK: "cyan",
  BUG: "red",
  CHANGE_REQUEST: "orange",
  DEPLOYMENT: "geekblue",
  DOCUMENT: "default",
  MILESTONE: "gold",
};

export const TICKET_TYPE_ICONS: Record<TicketType, string> = {
  EPIC: "⚡",
  STORY: "📖",
  TASK: "✅",
  SUBTASK: "↳",
  BUG: "🐛",
  CHANGE_REQUEST: "🔄",
  DEPLOYMENT: "🚀",
  DOCUMENT: "📄",
  MILESTONE: "🏁",
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  IMMEDIATE: "#ef4444",
  CRITICAL:  "#ef4444",
  HIGH:      "#f97316",
  MEDIUM:    "#f59e0b",
  DEFERRED:  "#9ca3af",
};

export const PRIORITY_ICONS: Record<TicketPriority, string> = {
  IMMEDIATE: "⊖",
  CRITICAL:  "▲",
  HIGH:      "↑",
  MEDIUM:    "◐",
  DEFERRED:  "○",
};

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];
