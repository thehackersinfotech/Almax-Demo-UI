export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/bms/api/v1";

export const ENDPOINTS = {
  // Auth
  EMPLOYEES: "/employees/",
  EMPLOYEES_DROPDOWN: "/employees/simple-dropdown/",
  EMPLOYEE_SYNC: "/employees/sync/keycloak/",
  CERTIFICATES: "/employee-certificates/",

  // Projects
  CLIENTS: "/clients/",
  PROJECTS: "/projects/",
  PROJECT_DROPDOWN: "/projects/dropdown/",
  PROJECT_COMMENTS: "/project-comments/",
  EPICS: "/epics/",
  STORIES: "/stories/",

  // Work Items
  WORK_ITEMS: "/work-items/",
  WORK_LOGS: "/work-logs/",

  // Allocation
  ALLOCATIONS: "/allocations/",
  EMPLOYEE_CAPACITY: "/allocations/employee-capacity/",
  TEAM_PIPELINE: "/allocations/team-pipeline/",

  // Timesheets
  MY_TIMESHEET: "/timesheets/my/",
  TIMESHEET_WEEK: "/timesheets/my/week/",
  TIMESHEET_SUBMIT: "/timesheets/my/submit/",
  TIMESHEET_COPY_DAY: "/timesheets/my/copy-day/",
  TIMESHEET_COPY_WEEK: "/timesheets/my/copy-week/",
  LOGGABLE_TICKETS: "/timesheets/loggable-tickets/",
  LOGGABLE_DATES: "/timesheets/loggable-dates/",
  TIMESHEET_CONFIG: "/timesheets/config/",
  TIMESHEET_REPORTING_DASHBOARD: "/timesheets/reporting/dashboard/",
  TIMESHEET_REPORTING_REVIEW: "/timesheets/reporting/review/",
  TIMESHEET_APPROVE: "/timesheets/reporting/approve/",
  TIMESHEET_REJECT: "/timesheets/reporting/reject/",
  TIMESHEET_BULK_APPROVE: "/timesheets/reporting/bulk-approve/",
  TIMESHEET_BULK_REJECT: "/timesheets/reporting/bulk-reject/",
  TIMESHEET_MISSING: "/timesheets/missing/",
  TIMESHEET_UTILIZATION: "/timesheets/utilization/",
  TEAM_TIMESHEET: "/timesheets/team/",

  // Dashboard
  PMO_DASHBOARD: "/dashboard/pmo/",
  HRMS_DASHBOARD: "/dashboard/hrms/",
  EMPLOYEE_DASHBOARD: "/dashboard/employee/",
  UTILIZATION_HEATMAP: "/dashboard/utilization-heatmap/",
  PROJECT_HEALTH: "/dashboard/project-health/",
  EXECUTIVE_DASHBOARD: "/dashboard/executive/",
  EXECUTIVE_PROJECT: "/dashboard/executive/projects/",

  // Attendance & Leave
  ATTENDANCE_TODAY:    "/attendance/today/",
  ATTENDANCE_CHECK_IN: "/attendance/check-in/",
  ATTENDANCE_CHECK_OUT:"/attendance/check-out/",
  ATTENDANCE_MONTHLY:  "/attendance/monthly/",
  LEAVE_TYPES:         "/leave/types/",
  LEAVE_BALANCES:      "/leave/balances/",
  LEAVE_REQUESTS:      "/leave/requests/",

  // Reports
  REPORT_DAILY_LOG: "/reports/employee-daily-log/",
  REPORT_UTILIZATION: "/reports/employee-utilization/",
  REPORT_PROJECT_PROGRESS: "/reports/project-progress/",
  REPORT_PORTFOLIO: "/reports/pmo-portfolio/",
  REPORT_ALLOCATION_MATRIX: "/reports/allocation-matrix/",

  // Finance Documents
  FINANCE_DOCUMENTS:          "/finance/documents/",
  FINANCE_CLIENTS_DROPDOWN:   "/clients/dropdown/",
  FINANCE_PROJECTS_DROPDOWN:  "/projects/dropdown/",
  FINANCE_DIVISIONS_DROPDOWN: "/master/dropdown/locations/",

  // Payment & Receivables
  PAYMENT_MILESTONES:       "/payment/milestones/",
  PAYMENT_INVOICES:         "/payment/invoices/",
  PAYMENT_PAYMENTS:         "/payment/payments/",
  PAYMENT_ALLOCATIONS:      "/payment/allocations/",
  PAYMENT_DASHBOARD:        "/payment/dashboard/",
  PAYMENT_CLIENT_REPORT:    "/payment/reports/client/",
  PAYMENT_PROJECT_REPORT:   "/payment/reports/project/",

  TIMESHEET_ADMIN_WEEK:        "/timesheets/admin/week/",
    TIMESHEET_TEAM_AGGREGATE:    "/timesheets/team/aggregate/",
    TIMESHEET_DISCREPANCY:       "/timesheets/discrepancy/",
    TIMESHEET_EXPORT:            "/timesheets/export/",
    TIMESHEET_TEAM_EXPORT:       "/timesheets/team/export/",
    TIMESHEET_REQUEST_CHANGES:   "/timesheets/reporting/request-changes/",

  // CRM — Company Expenses & Employee Reimbursements
  CRM_EXPENSES:        "/expenses/",
  CRM_EXPENSE_SUMMARY: "/expenses/summary/",
  CRM_REIMBURSEMENTS:  "/reimbursements/",

  // CRM — Todo / Follow-up
  CRM_FOLLOWUPS: "/followups/",
} as const;

