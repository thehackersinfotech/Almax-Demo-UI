export interface AttendanceBreak {
  id: string;
  break_type: string;
  break_type_label: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
}

export interface AttendanceToday {
  status: string | null;
  check_in: string | null;
  check_out: string | null;
  duration_hours: number;
  working_hours?: number;
  total_break_minutes?: number;
  breaks?: AttendanceBreak[];
  clockin_enabled?: boolean;
  shift_start?: string | null;
  shift_end?: string | null;
  can_clock_in?: boolean;
  can_clock_out?: boolean;
  clock_in_window?: string | null;
  clock_out_window?: string | null;
}

export interface LeaveBalance {
  leave_type: string;
  code: string;
  color: string;
  is_paid: boolean;
  total: number;
  used: number;
  remaining: number;
}

export interface LeaveRequest {
  id: string;
  leave_type: string;
  color: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  reason: string;
}

export interface WorkStats {
  avg_working_hours: number;
  avg_break_minutes: number;
  total_working_hours: number;
  total_break_minutes: number;
  working_days_count: number;
  on_time: number;
  late: number;
  early: number;
}

export interface EmpDashboard {
  profile: {
    id: string;
    full_name: string;
    employee_code: string;
    email: string;
    designation: string;
    department: string;
    keycloak_group: string;
    joining_date: string | null;
    profile_picture_url: string | null;
    shift_applicable: boolean;
  };
  work_items: {
    open: number;
    in_progress: number;
    in_review: number;
    done: number;
    total: number;
    overdue: number;
  };
  ticket_workflow?: Array<{
    slug: string;
    name: string;
    color: string;
    count: number;
    is_initial: boolean;
    is_final: boolean;
    tickets: Array<{
      id: string;
      ticket_number: string;
      title: string;
      type: string;
      priority: string;
      due_date: string | null;
      project_code: string;
      project_name: string;
      is_overdue: boolean;
    }>;
  }>;
  recent_items: Array<{
    id: string;
    ticket_number: string;
    title: string;
    type: string;
    status: string;
    status_color?: string;
    priority: string;
    due_date: string | null;
    project: string;
    project_code?: string;
  }>;
  my_projects: Array<{
    id: string;
    name: string;
    code: string;
    client: string;
    status: string;
    allocation_percentage: number;
    start_date: string;
    end_date: string | null;
  }>;
  timesheet: {
    weekly_hours: number;
    expected_hours: number;
    daily_logs: Array<{ log_date: string; hours: number }>;
  };
  recent_logs: Array<{
    id: string;
    log_date: string;
    hours: number;
    notes: string;
    work_item: string;
    ticket: string;
    project: string;
    is_billable: boolean;
  }>;
  attendance_today: AttendanceToday;
  attendance_month: { present: number; wfh: number; half_day: number; on_leave: number };
  checkin_stats: WorkStats;
  leave_balances: LeaveBalance[];
  leave_requests: LeaveRequest[];
  payslips: Array<{
    id: string;
    month: number;
    month_name: string;
    year: number;
    status: string;
    net_salary: number;
  }>;
  payslips_fy: string;
  reporting_hierarchy?: {
    manager: {
      id: string;
      name: string;
      employee_code: string;
      designation: string;
      avatar: string | null;
    } | null;
    direct_reports: Array<{ id: string; name: string; employee_code: string }>;
    total_team: number;
  };
}

export const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#d97706",
  LOW: "#6b7280",
};

export const TICKET_STATUS_COLOR: Record<string, string> = {
  OPEN: "processing",
  IN_PROGRESS: "warning",
  IN_REVIEW: "cyan",
  DONE: "success",
  CLOSED: "default",
};

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "success",
  ON_HOLD: "warning",
  COMPLETED: "default",
  DELAYED: "error",
  PLANNING: "processing",
};

export const ATTENDANCE_STATUS_COLOR: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  PRESENT: { bg: "#f0fdf4", border: "#bbf7d0", text: "#059669", label: "Present" },
  WFH: { bg: "#eff6ff", border: "#bfdbfe", text: "#2563eb", label: "Work From Home" },
  ABSENT: { bg: "#fff1f2", border: "#fecdd3", text: "#e11d48", label: "Absent" },
  HALF_DAY: { bg: "#fffbeb", border: "#fde68a", text: "#d97706", label: "Half Day" },
  ON_LEAVE: { bg: "#fdf4ff", border: "#e9d5ff", text: "#7c3aed", label: "On Leave" },
  HOLIDAY: { bg: "#f0fdfa", border: "#99f6e4", text: "#0d9488", label: "Holiday" },
};

export const LEAVE_STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  CANCELLED: "#6b7280",
};

export function avatarInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function captureGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 },
    );
  });
}
