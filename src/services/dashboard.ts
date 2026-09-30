import { get } from "./api";
import { ENDPOINTS } from "@/constants/api";

export type PMOAlertKey =
  | "overdue_tickets"
  | "delayed_projects"
  | "at_risk_projects"
  | "over_allocated"
  | "missing_timesheets"
  | "pending_leave_acks";

export interface PendingLeaveAckSummary {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  leave_color: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  projects: Array<{ id: string; code: string; name: string }>;
}

export interface PMOAlert {
  key: PMOAlertKey;
  severity: "error" | "warning" | "info";
  title: string;
  count: number;
  path: string;
  detail: string;
}

export interface OverdueTicketSummary {
  id: string;
  ticket_id: string;
  title: string;
  project_code: string | null;
  project_name: string | null;
  due_date: string;
  days_overdue: number;
}

export interface MissingTimesheetSummary {
  employee_id: string;
  employee_name: string;
  week_start: string;
  status: string;
}

export interface PortfolioProject {
  id: string;
  name: string;
  code: string;
  client: string | null;
  manager: string | null;
  start_date: string | null;
  end_date: string | null;
  days_left: number | null;
  health: "ON_TRACK" | "AT_RISK" | "DELAYED";
  total_tickets: number;
  open_tickets: number;
  completion_pct: number;
  estimated_hours: number;
  logged_hours_month: number;
  hours_utilization_pct: number;
}

export interface PMODashboard {
  date: string;
  period: { year: number; month: number };
  projects: {
    total: number;
    active: number;
    inactive: number;
    on_track: number;
    at_risk: number;
    delayed: number;
    project_type_breakdown: Array<{ business_type: string; count: number; pct: number }>;
  };
  portfolio: {
    summary: { on_track: number; at_risk: number; delayed: number };
    projects: PortfolioProject[];
  };
  work_items: {
    open: number;
    in_progress: number;
    done: number;
    total: number;
    overdue: number;
    overdue_tickets: OverdueTicketSummary[];
  };
  ticket_by_type: Array<{ type: string; count: number }>;
  logging: {
    total_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    billing_utilization_percent: number;
    hours_by_project: Array<{ project_id: string; name: string; code: string; hours: number }>;
    weekly_trend: Array<{
      week_start: string;
      label: string;
      total_hours: number;
      billable_hours: number;
    }>;
  };
  team: {
    total_active: number;
    over_allocated_count: number;
    over_allocated: Array<{ name: string; id: string }>;
    avg_utilization_percent: number;
  };
  timesheet_week: {
    week_start: string;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    missing: number;
    missing_details: MissingTimesheetSummary[];
  };
  pending_leave_acks: PendingLeaveAckSummary[];
  alerts: PMOAlert[];
}

export interface ExecutiveClientMapPoint {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  address: string;
  country: string;
  project_count: number;
  invoiced_fy: number;
}

export interface ExecutiveProjectRow {
  id: string;
  code: string;
  name: string;
  client_name: string | null;
  budget: number;
  estimated_hours: number;
  logged_hours_fy: number;
  revenue_invoiced: number;
  revenue_received: number;
  employee_cost: number;
  expense_cost: number;
  total_cost: number;
  gross_margin: number;
  gross_margin_pct: number | null;
}

export interface ExecutiveDashboard {
  fy: { start_year: number; label: string; start_date: string; end_date: string };
  available_fy_years: number[];
  employees: { total: number; active: number };
  vendors: { total: number; active: number };
  projects: { total: number; active: number };
  finance: {
    budget_total: number;
    invoiced: number;
    received: number;
    pending: number;
    expenses: number;
  };
  clients_map: ExecutiveClientMapPoint[];
  payment_monthly: Array<{ year: number; month: number; label: string; invoiced: number; received: number }>;
  billing_monthly: Array<{ year: number; month: number; label: string; billable_hours: number; non_billable_hours: number }>;
  project_portfolio: ExecutiveProjectRow[];
  project_pipeline: ExecutiveProjectPipeline;
  revenue_by_project_type: Array<{ business_type: string; invoiced: number; received: number }>;
}

export interface ExecutiveProjectPipeline {
  total: number;
  fy_new: number;
  pipeline: number;
  active: number;
  completed: number;
  cancelled: number;
  conversion_pct: number;
  completion_pct: number;
  win_pct: number;
  breakdown: Array<{
    key: string;
    label: string;
    count: number;
    pct: number;
    color: string;
  }>;
}

export interface ExecutiveProjectDetail {
  project: {
    id: string;
    code: string;
    name: string;
    client_name: string | null;
    manager_name: string | null;
    budget: number;
    estimated_hours: number;
  };
  fy: { start_year: number; label: string; start_date: string; end_date: string };
  hours: { logged_fy: number; billable_fy: number; non_billable_fy: number };
  financials: {
    revenue_invoiced: number;
    revenue_received: number;
    employee_cost: number;
    expense_cost: number;
    total_cost: number;
    gross_margin: number;
    gross_margin_pct: number | null;
  };
}

export interface HRMSDashboard {
  date: string;
  headcount: {
    total_active: number;
    new_joiners_month: number;
    dept_distribution: Array<{ department: string; count: number }>;
    role_distribution: Array<{ role: string; count: number }>;
  };
  attendance_today: {
    PRESENT: number;
    WFH: number;
    HALF_DAY: number;
    ON_LEAVE: number;
    ABSENT: number;
    not_marked: number;
    attendance_rate: number;
  };
  leave: {
    pending_count: number;
    stats_this_month: { pending: number; approved: number; rejected: number };
    pending_list: Array<{
      id: string;
      employee: string;
      employee_code: string;
      leave_type: string;
      color: string;
      start_date: string;
      end_date: string;
      days_count: number;
      reason: string;
    }>;
  };
  recent_joiners: Array<{
    id: string;
    full_name: string;
    employee_code: string;
    designation: string;
    department: string;
    joining_date: string;
  }>;
  payroll: { total: number; draft: number; finalized: number; paid: number };
}

export interface ProjectProgressReport {
  project: { id: string; name: string; code: string };
  estimated_hours: number;
  logged_hours: number;
  tickets: {
    total: number;
    open: number;
    done: number;
    by_type: Array<{ type: string; count: number }>;
    by_priority: Array<{ priority: string; count: number }>;
    by_status: Array<{
      slug: string; name: string; color: string;
      order: number; is_final: boolean; count: number;
    }>;
    by_assignee: Array<{ assignee: string | null; assignee_name: string; count: number }>;
  };
  epics: Array<{
    id: string; ticket_id: string; title: string;
    total: number; done: number; in_progress: number; todo: number; pct: number;
  }>;
}

export const dashboardApi = {
  pmo: (year?: number, month?: number) =>
    get<PMODashboard>(ENDPOINTS.PMO_DASHBOARD, { year, month }),
  hrms: () => get<HRMSDashboard>(ENDPOINTS.HRMS_DASHBOARD),
  utilizationHeatmap: (year?: number, month?: number) =>
    get(ENDPOINTS.UTILIZATION_HEATMAP, { year, month }),
  projectHealth: (year?: number, month?: number) =>
    get(ENDPOINTS.PROJECT_HEALTH, { year, month }),
  executive: (fyStartYear: number) =>
    get<ExecutiveDashboard>(ENDPOINTS.EXECUTIVE_DASHBOARD, { fy_start_year: fyStartYear }),
  executiveProject: (projectId: string, fyStartYear: number) =>
    get<ExecutiveProjectDetail>(`${ENDPOINTS.EXECUTIVE_PROJECT}${projectId}/`, { fy_start_year: fyStartYear }),
};

export const reportsApi = {
  dailyLog: (params: Record<string, unknown>) =>
    get(ENDPOINTS.REPORT_DAILY_LOG, params),
  utilization: (year: number, month: number, employee?: string) =>
    get(ENDPOINTS.REPORT_UTILIZATION, { year, month, employee }),
  projectProgress: (projectId: string) =>
    get<ProjectProgressReport>(ENDPOINTS.REPORT_PROJECT_PROGRESS, { project: projectId }),
  portfolio: () => get(ENDPOINTS.REPORT_PORTFOLIO),
  allocationMatrix: () => get(ENDPOINTS.REPORT_ALLOCATION_MATRIX),
};
