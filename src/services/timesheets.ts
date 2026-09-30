import { get, post, patch, del } from "./api";
import { ENDPOINTS } from "@/constants/api";

export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type WorkLogCategory =
  | "BILLABLE"
  | "NON_BILLABLE"
  | "INTERNAL"
  | "TRAINING"
  | "SUPPORT";

export interface WorkLog {
  id: string;
  employee: string;
  employee_name?: string;
  ticket: string;
  ticket_id: string;
  ticket_title: string;
  ticket_type?: string;
  project_name: string;
  project_id?: string;
  epic_title?: string;
  story_title?: string;
  log_date: string;
  hours: number;
  description: string;
  remarks: string;
  category: WorkLogCategory;
  is_billable: boolean;
  weekly_timesheet?: string;
  warnings?: Record<string, string>;
  created_at?: string;
}

export interface WeeklyTimesheet {
  id: string;
  employee: string;
  employee_name: string;
  week_start: string;
  week_end: string;
  status: TimesheetStatus;
  total_hours: number;
  expected_hours: number;
  hours_behind: number;
  submitted_at?: string;
  reviewed_at?: string;
  review_comment?: string;
  can_review?: boolean;
}

export interface DaySummary {
  date: string;
  day_name: string;
  total_hours: number;
  capacity: number;
  over_capacity: boolean;
  log_count: number;
  can_log: boolean;
  attendance_hint?: string | null;
  is_weekend?: boolean;
}

export interface WeekView {
  weekly_timesheet: WeeklyTimesheet;
  days: DaySummary[];
  logs: WorkLog[];
  daily_capacity: number;
  is_editable?: boolean;
  is_current_week?: boolean;
}

export interface LoggableTicket {
  id: string;
  ticket_id: string;
  title: string;
  type: string;
  project_id: string;
  project_name: string;
  epic_title: string;
  story_title: string;
}

export interface ManagerDashboard {
  pending_reviews: number;
  approved_this_week: number;
  rejected_this_week: number;
  missing_timesheets: number;
  missing_details: Array<{
    employee_id: string;
    employee_name: string;
    week_start: string;
    status: string;
  }>;
}

export interface WorkLogCreate {
  ticket: string;
  log_date: string;
  hours: number;
  description?: string;
  remarks?: string;
  category?: WorkLogCategory;
}

export const CATEGORY_OPTIONS = [
  { value: "BILLABLE", label: "Billable" },
  { value: "NON_BILLABLE", label: "Non-Billable" },
  { value: "INTERNAL", label: "Internal" },
  { value: "TRAINING", label: "Training" },
  { value: "SUPPORT", label: "Support" },
] as const;

export const STATUS_COLOR: Record<TimesheetStatus, string> = {
  DRAFT: "default",
  SUBMITTED: "processing",
  APPROVED: "success",
  REJECTED: "error",
};

export const timesheetApi = {
  week: (weekStart?: string, selectedEmployee?: string) =>
    get<WeekView>(ENDPOINTS.TIMESHEET_WEEK, weekStart ? { week_start: weekStart } : {}),
  loggableTickets: (logDate: string, search?: string) =>
    get<{
      tickets: LoggableTicket[];
      hints: string[];
      can_log: boolean;
      attendance_hint?: string | null;
    }>(ENDPOINTS.LOGGABLE_TICKETS, {
      log_date: logDate,
      ...(search ? { search } : {}),
    }),
  loggableDates: (dateFrom: string, dateTo: string) =>
    get<{ dates: string[] }>(ENDPOINTS.LOGGABLE_DATES, { date_from: dateFrom, date_to: dateTo }),
  submit: (timesheetId: string, weekStart?: string) =>
    post<WeeklyTimesheet>(`${ENDPOINTS.TIMESHEET_SUBMIT}${timesheetId}/`, {
      ...(weekStart ? { week_start: weekStart } : {}),
    }),
  copyDay: (sourceDate: string, targetDate: string) =>
    post<{ copied: number }>(ENDPOINTS.TIMESHEET_COPY_DAY, { source_date: sourceDate, target_date: targetDate }),
  copyWeek: (sourceWeekStart: string, targetWeekStart: string) =>
    post<{ copied: number }>(ENDPOINTS.TIMESHEET_COPY_WEEK, {
      source_week_start: sourceWeekStart,
      target_week_start: targetWeekStart,
    }),
  config: () => get<{ daily_capacity_hours: number }>(ENDPOINTS.TIMESHEET_CONFIG),

  // Work logs (canonical CRUD)
  createLog: (data: WorkLogCreate) => post<WorkLog>(ENDPOINTS.WORK_LOGS, data),
  updateLog: (id: string, data: Partial<WorkLogCreate>) =>
    patch<WorkLog>(`${ENDPOINTS.WORK_LOGS}${id}/`, data),
  deleteLog: (id: string) => del(`${ENDPOINTS.WORK_LOGS}${id}/`),

  // Manager
  reportingDashboard: () => get<ManagerDashboard>(ENDPOINTS.TIMESHEET_REPORTING_DASHBOARD),
  reportingReview: (params?: Record<string, string>) =>
    get<WeeklyTimesheet[]>(ENDPOINTS.TIMESHEET_REPORTING_REVIEW, params),
  approve: (timesheetId: string, comment?: string) =>
    post<WeeklyTimesheet>(ENDPOINTS.TIMESHEET_APPROVE, { timesheet_id: timesheetId, comment }),
  reject: (timesheetId: string, comment?: string) =>
    post<WeeklyTimesheet>(ENDPOINTS.TIMESHEET_REJECT, { timesheet_id: timesheetId, comment }),
  bulkApprove: (timesheetIds: string[], comment?: string) =>
    post<WeeklyTimesheet[]>(ENDPOINTS.TIMESHEET_BULK_APPROVE, { timesheet_ids: timesheetIds, comment }),
  bulkReject: (timesheetIds: string[], comment?: string) =>
    post<WeeklyTimesheet[]>(ENDPOINTS.TIMESHEET_BULK_REJECT, { timesheet_ids: timesheetIds, comment }),
  missing: () => get(ENDPOINTS.TIMESHEET_MISSING),
  utilization: (params?: Record<string, string | number>) =>
    get(ENDPOINTS.TIMESHEET_UTILIZATION, params),
};
