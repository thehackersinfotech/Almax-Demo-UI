/**
 * BMS permission constants — must match backend/permissions.json names.
 * Grouped by category for navigation and guards.
 */
export const PERMS = {
  // Dashboard
  DASHBOARD_OWN:              "bms.dashboard.own.view",
  DASHBOARD_PROJECT:          "bms.dashboard.project.view",
  DASHBOARD_HRMS:             "bms.dashboard.hrms.view",
  DASHBOARD_EXECUTIVE:        "bms.dashboard.executive.view",

  // Master — HRMS
  MASTER_HRMS_VIEW:           "bms.master.hrms.view",
  MASTER_HRMS_CREATE:         "bms.master.hrms.create",
  MASTER_HRMS_UPDATE:         "bms.master.hrms.update",
  MASTER_HRMS_DELETE:         "bms.master.hrms.delete",

  // Master — Client
  MASTER_CLIENT_VIEW:         "bms.master.client.view",
  MASTER_CLIENT_CREATE:       "bms.master.client.create",
  MASTER_CLIENT_UPDATE:       "bms.master.client.update",
  MASTER_CLIENT_DELETE:       "bms.master.client.delete",

  // Master — Project
  MASTER_PROJECT_VIEW:        "bms.master.project.view",
  MASTER_PROJECT_CREATE:      "bms.master.project.create",
  MASTER_PROJECT_UPDATE:      "bms.master.project.update",
  MASTER_PROJECT_DELETE:      "bms.master.project.delete",

  // Master — Workflow
  MASTER_WORKFLOW_VIEW:       "bms.master.workflow.view",
  MASTER_WORKFLOW_MANAGE:     "bms.master.workflow.manage",

  // Role
  ROLE_VIEW:                  "bms.role.view",
  ROLE_CREATE:                "bms.role.create",
  ROLE_DELETE:                "bms.role.delete",
  ROLE_PERMISSION_ASSIGN:     "bms.role.permission.assign",

  // Plan
  PLAN_VIEW:                  "bms.plan.view",

  // HRMS — Employee
  HRMS_EMPLOYEE_VIEW:         "bms.hrms.employee.view",
  HRMS_EMPLOYEE_CREATE:       "bms.hrms.employee.create",
  HRMS_EMPLOYEE_UPDATE:       "bms.hrms.employee.update",
  HRMS_EMPLOYEE_DELETE:       "bms.hrms.employee.delete",
  HRMS_EMPLOYEE_SYNC:         "bms.hrms.employee.sync",

  // HRMS — Attendance / Leave / Payroll / Compliance
  HRMS_ATTENDANCE_VIEW:       "bms.hrms.attendance.view",
  HRMS_ATTENDANCE_MANAGE:     "bms.hrms.attendance.manage",
  HRMS_LEAVE_VIEW:            "bms.hrms.leave.view",
  HRMS_LEAVE_APPROVE:         "bms.hrms.leave.approve",
  HRMS_LEAVE_MANAGE:          "bms.hrms.leave.manage",
  HRMS_PAYROLL_VIEW:          "bms.hrms.payroll.view",
  HRMS_PAYROLL_CREATE:        "bms.hrms.payroll.create",
  HRMS_PAYROLL_UPDATE:        "bms.hrms.payroll.update",
  HRMS_PAYROLL_DELETE:        "bms.hrms.payroll.delete",
  HRMS_PAYROLL_APPROVE:       "bms.hrms.payroll.approve",
  HRMS_COMPLIANCE_VIEW:       "bms.hrms.compliance.view",
  HRMS_COMPLIANCE_CREATE:     "bms.hrms.compliance.create",
  HRMS_COMPLIANCE_UPDATE:     "bms.hrms.compliance.update",
  HRMS_COMPLIANCE_DELETE:     "bms.hrms.compliance.delete",

  // IT Asset Management
  HRMS_ASSET_MANAGE:          "bms.hrms.asset.manage",

  // HRMS — Onboarding
  HRMS_ONBOARDING_VIEW:       "bms.hrms.onboarding.view",
  HRMS_ONBOARDING_MANAGE:     "bms.hrms.onboarding.manage",
  HRMS_EMPLOYEE_ONBOARDING:   "bms.hrms.onboarding.self",

  // HRMS — Offboarding
  HRMS_OFFBOARDING_VIEW:      "bms.hrms.offboarding.view",
  HRMS_OFFBOARDING_MANAGE:    "bms.hrms.offboarding.manage",
  HRMS_EMPLOYEE_OFFBOARDING:  "bms.hrms.offboarding.self",
  HRMS_OFFBOARDING_FINANCE:   "bms.hrms.offboarding.finance",

  // Chat
  CHAT_VIEW:                  "bms.chat.view",

  // Policy Document
  POLICY_VIEW:                "bms.policy.view",
  POLICY_CREATE:              "bms.policy.create",
  POLICY_UPDATE:              "bms.policy.update",
  POLICY_DELETE:              "bms.policy.delete",

  // Project MS
  PROJECT_VIEW:               "bms.project.view",
  PROJECT_VIEW_ALL:           "bms.project.view_all",
  PROJECT_CREATE:             "bms.project.create",
  PROJECT_UPDATE:             "bms.project.update",
  PROJECT_DELETE:             "bms.project.delete",

  PROJECT_CLIENT_VIEW:        "bms.project.client.view",
  PROJECT_CLIENT_CREATE:      "bms.project.client.create",
  PROJECT_CLIENT_UPDATE:      "bms.project.client.update",
  PROJECT_CLIENT_DELETE:      "bms.project.client.delete",

  PROJECT_ALLOCATION_VIEW:    "bms.project.allocation.view",
  PROJECT_ALLOCATION_CREATE:  "bms.project.allocation.create",
  PROJECT_ALLOCATION_UPDATE:  "bms.project.allocation.update",
  PROJECT_ALLOCATION_DELETE:  "bms.project.allocation.delete",

  PROJECT_WORKITEM_VIEW:      "bms.project.workitem.view",
  PROJECT_WORKITEM_CREATE:    "bms.project.workitem.create",
  PROJECT_WORKITEM_UPDATE:    "bms.project.workitem.update",
  PROJECT_WORKITEM_DELETE:    "bms.project.workitem.delete",
  PROJECT_WORKITEM_TRANSITION:"bms.project.workitem.transition",

  PROJECT_TICKET_VIEW:        "bms.project.workitem.view",
  PROJECT_TICKET_CREATE:      "bms.project.workitem.create",
  PROJECT_TICKET_UPDATE:      "bms.project.workitem.update",
  PROJECT_TICKET_DELETE:      "bms.project.workitem.delete",
  PROJECT_TICKET_TRANSITION:  "bms.project.workitem.transition",

  PROJECT_TIMESHEET_VIEW:     "bms.project.timesheet.view",
  PROJECT_TIMESHEET_CREATE:   "bms.project.timesheet.create",
  PROJECT_TIMESHEET_UPDATE:   "bms.project.timesheet.update",
  PROJECT_TIMESHEET_DELETE:   "bms.project.timesheet.delete",
  PROJECT_TIMESHEET_SUBMIT:   "bms.project.timesheet.submit",
  PROJECT_TIMESHEET_APPROVE:  "bms.project.timesheet.approve",

  PROJECT_REPORT_UTILIZATION: "bms.project.report.utilization",
  PROJECT_REPORT_PORTFOLIO:   "bms.project.report.portfolio",
  PROJECT_REPORT_ALLOCATION:  "bms.project.report.allocation",

  // Payment & Receivables
  PAYMENT_DASHBOARD_VIEW:     "bms.payment.dashboard.view",
  PAYMENT_INVOICE_VIEW:       "bms.payment.invoice.view",
  PAYMENT_INVOICE_CREATE:     "bms.payment.invoice.create",
  PAYMENT_INVOICE_UPDATE:     "bms.payment.invoice.update",
  PAYMENT_INVOICE_DELETE:     "bms.payment.invoice.delete",
  PAYMENT_PAYMENT_VIEW:       "bms.payment.payment.view",
  PAYMENT_PAYMENT_CREATE:     "bms.payment.payment.create",
  PAYMENT_PAYMENT_UPDATE:     "bms.payment.payment.update",
  PAYMENT_PAYMENT_DELETE:     "bms.payment.payment.delete",

  // Finance Documents
  FINANCE_DOCUMENT_VIEW:   "bms.finance.document.view",
  FINANCE_DOCUMENT_CREATE: "bms.finance.document.create",
  FINANCE_DOCUMENT_UPDATE: "bms.finance.document.update",
  FINANCE_DOCUMENT_DELETE: "bms.finance.document.delete",

  // CRM — Company Expenses
  CRM_EXPENSE_VIEW:   "bms.crm.expense.view",
  CRM_EXPENSE_CREATE: "bms.crm.expense.create",
  CRM_EXPENSE_UPDATE: "bms.crm.expense.update",
  CRM_EXPENSE_DELETE: "bms.crm.expense.delete",
  CRM_EXPENSE_APPROVE:"bms.crm.expense.approve",

  // CRM — Follow-up (also gates workspace To-Do)
  CRM_FOLLOWUP_VIEW:       "bms.crm.followup.view",
  CRM_FOLLOWUP_VIEW_ALL:   "bms.crm.followup.view_all",
  CRM_FOLLOWUP_CREATE:     "bms.crm.followup.create",
  CRM_FOLLOWUP_UPDATE:     "bms.crm.followup.update",
  CRM_FOLLOWUP_DELETE:     "bms.crm.followup.delete",
  CRM_FOLLOWUP_TRANSITION: "bms.crm.followup.transition",

  CRM_MEETING_VIEW:       "bms.crm.meeting.view",
  CRM_MEETING_VIEW_ALL:   "bms.crm.meeting.view_all",
  CRM_MEETING_CREATE:     "bms.crm.meeting.create",
  CRM_MEETING_UPDATE:     "bms.crm.meeting.update",
  CRM_MEETING_DELETE:     "bms.crm.meeting.delete",
  CRM_MEETING_TRANSITION: "bms.crm.meeting.transition",

  // CRM — Lead Management
  CRM_LEAD_VIEW:   "bms.crm.lead.view",
  CRM_LEAD_CREATE: "bms.crm.lead.create",
  CRM_LEAD_UPDATE: "bms.crm.lead.update",
  CRM_LEAD_DELETE: "bms.crm.lead.delete",

  WORKSPACE_CALENDAR_VIEW:   "bms.workspace.calendar.view",

  // Social Feed
  SOCIAL_FEED_VIEW:       "bms.social_feed.view",
  SOCIAL_FEED_CREATE:     "bms.social_feed.create",
  SOCIAL_FEED_UPDATE:     "bms.social_feed.update",
  SOCIAL_FEED_DELETE:     "bms.social_feed.delete",
  SOCIAL_FEED_TRANSITION: "bms.social_feed.transition",
  SOCIAL_FEED_MANAGE:     "bms.social_feed.manage",
} as const;

export type BmsPermission = (typeof PERMS)[keyof typeof PERMS];

/** Any master view permission (shows Master menu — data masters only). */
export const ANY_MASTER_VIEW: BmsPermission[] = [
  PERMS.MASTER_HRMS_VIEW,
  PERMS.MASTER_CLIENT_VIEW,
  PERMS.MASTER_PROJECT_VIEW,
];

/** Any payment view permission (shows Payment & AR menu). */
export const ANY_PAYMENT_VIEW: BmsPermission[] = [
  PERMS.PAYMENT_DASHBOARD_VIEW,
  PERMS.PAYMENT_INVOICE_VIEW,
  PERMS.PAYMENT_PAYMENT_VIEW,
];

/** Any workspace view permission (shows Workspace menu). */
export const ANY_WORKSPACE_VIEW: BmsPermission[] = [
  PERMS.CRM_FOLLOWUP_VIEW,
  PERMS.CRM_MEETING_VIEW,
];

/** Any CRM view permission (shows CRM top-level menu). */
export const ANY_CRM_VIEW: BmsPermission[] = [
  PERMS.PROJECT_CLIENT_VIEW,
  PERMS.FINANCE_DOCUMENT_VIEW,
  PERMS.CRM_LEAD_VIEW,
];

/** Any finance view permission (shows Finance menu — available to all employees for Reimbursements). */
export const ANY_FINANCE_VIEW: BmsPermission[] = [
  PERMS.DASHBOARD_OWN,
  PERMS.PAYMENT_DASHBOARD_VIEW,
  PERMS.PAYMENT_INVOICE_VIEW,
  PERMS.PAYMENT_PAYMENT_VIEW,
  PERMS.CRM_EXPENSE_VIEW,
];

