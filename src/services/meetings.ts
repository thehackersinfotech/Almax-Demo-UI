import { get, post, patch, del } from "./api";

import { PRIORITY_TONES } from "@/utils/semanticColors";

export const MEETING_PRIORITIES = [
  { value: "HIGH",      label: "High",      ...PRIORITY_TONES.HIGH },
  { value: "MEDIUM",    label: "Medium",    ...PRIORITY_TONES.MEDIUM },
  { value: "LOW",       label: "Low",       ...PRIORITY_TONES.LOW },
] as const;

export interface MeetingItem {
  id: string;
  title: string;
  type?: string;
  priority: string;
  priority_label: string;
  description: string;
  content?: string;
  comments: string;
  assignees: string[];
  assignees_data: Array<{ id: string; full_name: string }>;
  reporter: string | null;
  reporter_name: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  meeting_mode: "ONLINE" | "OFFLINE" | null;
  source?: string;
  lead?: string | null;
  lead_name?: string;
  lead_company?: string;
  lead_client_name?: string;
  is_overdue: boolean;
  is_completed?: boolean;
  workflow_state: string | null;
  workflow_state_name: string;
  workflow_state_slug: string;
  workflow_state_color: string;
  can_transition: boolean;
  allowed_destination_slugs?: string[];
  created_at: string;
  updated_at: string;
  available_states?: Array<{ id: string; name: string; slug: string; color: string }>;
}

export interface MeetingCreate {
  title: string;
  type?: string;
  priority?: string;
  description?: string;
  content?: string;
  comments?: string;
  assignees?: string[];
  reporter?: string | null;
  lead?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  meeting_mode?: "ONLINE" | "OFFLINE" | null;
  source?: string;
}

export interface MeetingBoardResponse {
  columns: Record<string, MeetingItem[]>;
  count: number;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
}

export const meetingApi = {
  list: (params?: Record<string, string | number>) =>
    get<PaginatedResponse<MeetingItem>>("/meetings/", params),

  /** Fetch all items (e.g. calendar modal) — uses a large page size. */
  listAll: async (params?: Record<string, string>) => {
    const res = await get<PaginatedResponse<MeetingItem>>("/meetings/", {
      ...params,
      page_size: 500,
    });
    return res.results;
  },

  retrieve: (id: string) =>
    get<MeetingItem>(`/meetings/${id}/`),

  get: (id: string) =>
    get<MeetingItem>(`/meetings/${id}/`),

  create: (data: MeetingCreate) =>
    post<MeetingItem>("/meetings/", data),

  update: (id: string, data: Partial<MeetingCreate>) =>
    patch<MeetingItem>(`/meetings/${id}/`, data),

  delete: (id: string) =>
    del(`/meetings/${id}/`),

  transition: (id: string, destination_state: string, comments = "") =>
    post<{ message: string; workflow_state_name: string; workflow_state_slug: string }>(
      `/meetings/${id}/transition/`,
      { destination_state, comments },
    ),

  board: (params?: Record<string, string>) =>
    get<MeetingBoardResponse>("/meetings/board/", params),
};
