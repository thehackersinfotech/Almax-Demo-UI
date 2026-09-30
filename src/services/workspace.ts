import { get } from "./api";

export interface WorkspaceCalendarEvent {
  id: string;
  source: "todo" | "followup";
  title: string;
  subtitle?: string;
  event_kind: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  color: string;
  priority?: string;
  due_date?: string | null;
  workflow_state_slug?: string;
  workflow_state_name?: string;
  assignee_name?: string | null;
  description?: string;
  comments?: string;
  note?: string;
  is_due_reminder?: boolean;
  updated_at?: string | null;
}

export const workspaceApi = {
  calendar: (dateFrom: string, dateTo: string) =>
    get<{ events: WorkspaceCalendarEvent[]; count: number }>("/workspace/calendar/", {
      date_from: dateFrom,
      date_to: dateTo,
    }),
};
