/**
 * Mock API handler — intercepts all HTTP requests and returns mock data.
 * Routes are matched against URL patterns and return appropriate mock data.
 */

import {
  MOCK_EMPLOYEES,
  MOCK_CLIENTS,
  MOCK_PROJECTS,
  MOCK_TICKETS,
  MOCK_PMO_DASHBOARD,
  MOCK_EXECUTIVE_DASHBOARD,
  MOCK_TIMESHEETS,
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  MOCK_MILESTONES,
  MOCK_LEAVE_REQUESTS,
  MOCK_ATTENDANCE,
  MOCK_EXPENSES,
  MOCK_LEADS,
  MOCK_TODOS,
  MOCK_MEETINGS,
  MOCK_FOLLOWUPS,
  MOCK_NOTIFICATIONS,
  MOCK_PAYROLL,
  MOCK_REPORTS,
  MOCK_MASTER,
  MOCK_ALLOCATIONS,
  MOCK_SOCIAL_POSTS,
  MOCK_POLICIES,
  MOCK_HRMS_DASHBOARD,
  MOCK_CALENDAR_EVENTS,
  MOCK_FINANCE_DOCS,
  MOCK_PAYMENT_DASHBOARD,
  MOCK_IT_ASSETS,
  MOCK_ROLES,
  MOCK_USER,
  MOCK_PERMISSIONS,
  MOCK_TENANT,
  MOCK_PROJECT_WORKFLOW_STATES,
  MOCK_PROJECT_WORKFLOW_TRANSITIONS,
  MOCK_TICKET_WORKFLOW_STATES,
  MOCK_WEEK_VIEW,
  MOCK_WORK_LOGS,
  MOCK_LEAD_DASHBOARD,
  MOCK_CRM_FOLDERS,
  MOCK_CRM_DOCUMENTS,
  MOCK_COMPLIANCE_DOCS,
  MOCK_OFFBOARDING_REQUESTS,
  MOCK_CHAT_ROOMS,
  MOCK_ONBOARDING,
  MOCK_EXPENSE_SUMMARY,
  MOCK_REIMBURSEMENTS,
  MOCK_WEEKLY_TIMESHEETS_REVIEW,
  MOCK_TEAM_AGGREGATE,
  MOCK_ATTENDANCE_OVERVIEW,
  MOCK_ATTENDANCE_LIST,
  MOCK_EMPLOYEE_SHIFTS,
  MOCK_WFH_SETTINGS,
  MOCK_WFH_REQUESTS,
  MOCK_SHIFT_CHANGE_REQUESTS,
  MOCK_REGULARIZATION_REQUESTS,
  MOCK_MONTHLY_REPORTS,
  MOCK_INVENTORY_ITEMS,
  MOCK_EMPLOYEE_ASSETS,
  MOCK_ASSET_REQUESTS,
  MOCK_SALES_DOCUMENTS,
  MOCK_SALES_FOLLOWUPS,
  MOCK_LEAD_TASKS,
  MOCK_ADMIN_MFA_USERS,
  MOCK_ADMIN_MFA_AUDIT_LOGS,
  MOCK_NOTIFICATION_RULES,
  paginate,
} from "./mockData";

// Small delay to simulate network latency (ms)
const MOCK_DELAY = 150;

function delay<T>(val: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(val), MOCK_DELAY));
}

// ─── Route matcher ────────────────────────────────────────────────────────────
type MockHandler = (url: string, method: string, data?: any) => any;

const routes: Array<{ pattern: RegExp; methods: string[]; handler: MockHandler }> = [
  // Auth / user
  { pattern: /\/auth\/token\/$/, methods: ["POST"], handler: () => ({
      access_token: "mock-access-token", refresh_token: "mock-refresh-token",
      user: { ...MOCK_USER, last_login: new Date().toISOString() },
    }),
  },
  { pattern: /\/users\/me\/$/, methods: ["GET"], handler: () => ({
      ...MOCK_USER, permissions: MOCK_PERMISSIONS,
    }),
  },
  { pattern: /\/auth\/logout\/$/, methods: ["POST"], handler: () => ({}) },

  // Tenant info
  { pattern: /\/tenant-info\//, methods: ["GET"], handler: () => MOCK_TENANT },

  // Dashboard
  { pattern: /\/dashboard\/pmo\//, methods: ["GET"], handler: () => MOCK_PMO_DASHBOARD },
  { pattern: /\/dashboard\/executive\//, methods: ["GET"], handler: () => MOCK_EXECUTIVE_DASHBOARD },
  { pattern: /\/dashboard\/hrms\//, methods: ["GET"], handler: () => MOCK_HRMS_DASHBOARD },
  { pattern: /\/dashboard\/employee\//, methods: ["GET"], handler: () => ({
      profile: {
        id: "emp-001",
        full_name: "Alex Johnson",
        employee_code: "EMP001",
        email: "alex.johnson@nexusdemo.com",
        designation: "Chief Technology Officer",
        department: "Technology",
        keycloak_group: "Admin",
        joining_date: "2020-01-15",
        profile_picture_url: null,
        shift_applicable: true,
      },
      work_items: { open: 4, in_progress: 3, in_review: 1, done: 12, total: 20, overdue: 1 },
      ticket_workflow: [
        { slug: "open",        name: "Open",        color: "#6366f1", count: 4,  is_initial: true,  is_final: false, tickets: [] },
        { slug: "in_progress", name: "In Progress", color: "#2563eb", count: 3,  is_initial: false, is_final: false, tickets: [] },
        { slug: "in_review",   name: "In Review",   color: "#d97706", count: 1,  is_initial: false, is_final: false, tickets: [] },
        { slug: "done",        name: "Done",        color: "#059669", count: 12, is_initial: false, is_final: true,  tickets: [] },
      ],
      recent_items: [
        { id: "tkt-002", ticket_number: "AIAP-002", title: "Design ML model pipeline", type: "STORY", status: "IN_PROGRESS", status_color: "#2563eb", priority: "CRITICAL", due_date: "2024-10-15", project: "AI Analytics Platform", project_code: "AIAP" },
        { id: "tkt-003", ticket_number: "AIAP-003", title: "Implement data ingestion layer", type: "TASK", status: "IN_PROGRESS", status_color: "#2563eb", priority: "HIGH", due_date: "2024-09-30", project: "AI Analytics Platform", project_code: "AIAP" },
        { id: "tkt-007", ticket_number: "HMS-001", title: "Patient registration module", type: "EPIC", status: "IN_PROGRESS", status_color: "#2563eb", priority: "HIGH", due_date: "2024-10-31", project: "Hospital Management System", project_code: "HMS" },
      ],
      pending_followups: [],
      my_projects: [
        { id: "proj-001", name: "AI Analytics Platform", code: "AIAP", client: "TechVision Corp", status: "ACTIVE", allocation_percentage: 60, start_date: "2024-01-01", end_date: "2024-12-31" },
        { id: "proj-003", name: "Hospital Management System", code: "HMS", client: "HealthFirst Medical", status: "ACTIVE", allocation_percentage: 40, start_date: "2024-02-15", end_date: "2024-11-30" },
      ],
      timesheet: {
        weekly_hours: 38,
        expected_hours: 45,
        daily_logs: [
          { log_date: "Mon", hours: 8 },
          { log_date: "Tue", hours: 7.5 },
          { log_date: "Wed", hours: 8 },
          { log_date: "Thu", hours: 7.5 },
          { log_date: "Fri", hours: 7 },
        ],
      },
      recent_logs: [
        { id: "te-001", log_date: "2024-09-27", hours: 8, notes: "Sprint demo preparation", work_item: "HMS Sprint Demo", ticket: "HMS-001", project: "Hospital Management System", is_billable: true },
        { id: "te-003", log_date: "2024-09-26", hours: 8, notes: "Code review and sprint planning", work_item: "ML Pipeline Review", ticket: "AIAP-002", project: "AI Analytics Platform", is_billable: true },
        { id: "te-002", log_date: "2024-09-25", hours: 6, notes: "Client meeting and requirements review", work_item: "Client Sync", ticket: "", project: "Hospital Management System", is_billable: true },
      ],
      attendance_today: {
        status: "PRESENT",
        check_in: "09:02",
        check_out: null,
        duration_hours: 6.5,
        working_hours: 6.5,
        total_break_minutes: 30,
        breaks: [],
        clockin_enabled: true,
        can_clock_in: false,
        can_clock_out: true,
        shift_start: "09:00",
        shift_end: "18:00",
      },
      attendance_month: { present: 17, wfh: 1, half_day: 0, on_leave: 1 },
      checkin_stats: {
        avg_working_hours: 9.1,
        avg_break_minutes: 45,
        total_working_hours: 154.7,
        total_break_minutes: 765,
        working_days_count: 17,
        on_time: 15,
        late: 2,
        early: 0,
      },
      leave_balances: [
        { id: "lb-001", leave_type_id: "lt-001", leave_type: "Annual Leave", leave_type_name: "Annual Leave", code: "AL", leave_type_code: "AL", color: "#4CAF50", leave_type_color: "#4CAF50", is_paid: true, total: 21, total_days: 21, used: 5, used_days: 5, remaining: 16, remaining_days: 16 },
        { id: "lb-002", leave_type_id: "lt-002", leave_type: "Sick Leave", leave_type_name: "Sick Leave", code: "SL", leave_type_code: "SL", color: "#F44336", leave_type_color: "#F44336", is_paid: true, total: 14, total_days: 14, used: 2, used_days: 2, remaining: 12, remaining_days: 12 },
        { id: "lb-003", leave_type_id: "lt-005", leave_type: "Compensatory Off", leave_type_name: "Compensatory Off", code: "CO", leave_type_code: "CO", color: "#FF9800", leave_type_color: "#FF9800", is_paid: false, total: 3, total_days: 3, used: 1, used_days: 1, remaining: 2, remaining_days: 2 },
      ],
      leave_requests: [
        { id: "lr-001", leave_type: "Annual Leave", leave_type_name: "Annual Leave", color: "#4CAF50", leave_type_color: "#4CAF50", start_date: "2024-10-14", end_date: "2024-10-18", days_count: 5, status: "APPROVED", reason: "Family vacation" },
      ],
      wfh_status: { wfh_enabled: true, pending_wfh_request: false, approved_wfh_today: false },
      payslips: [
        { id: "pay-roll-001", month: 9, month_name: "September", year: 2024, status: "PAID", net_salary: 15400 },
        { id: "pay-roll-002", month: 8, month_name: "August",    year: 2024, status: "PAID", net_salary: 15400 },
        { id: "pay-roll-003", month: 7, month_name: "July",      year: 2024, status: "PAID", net_salary: 15200 },
      ],
      payslips_fy: "FY 2024-25",
      reporting_hierarchy: {
        manager: null,
      },
    }),
  },
  { pattern: /\/dashboard\/pmo\/alerts\//, methods: ["GET"], handler: () => MOCK_PMO_DASHBOARD.alerts },
  { pattern: /\/dashboard\/executive\/client-map\//, methods: ["GET"], handler: () => MOCK_EXECUTIVE_DASHBOARD.client_map },
  { pattern: /\/dashboard\/executive\/margin-rank\//, methods: ["GET"], handler: () => MOCK_EXECUTIVE_DASHBOARD.executive_margin_rank },
  { pattern: /\/dashboard\/executive\/projects\/([^/]+)\//, methods: ["GET"], handler: (url) => {
      const id = url.match(/\/dashboard\/executive\/projects\/([^/]+)\//)?.[1];
      const p = MOCK_PROJECTS.find(x => x.id === id) || MOCK_PROJECTS[0];
      return {
        project: p,
        financials: { budget: p.budget || 350000, cost: (p.budget || 350000) * 0.55, margin: (p.budget || 350000) * 0.45, margin_pct: 45, invoiced: (p.budget || 350000) * 0.7, received: (p.budget || 350000) * 0.6 },
        monthly_data: [
          { month: "Apr", revenue: 45000, cost: 25000, margin: 20000 },
          { month: "May", revenue: 50000, cost: 26000, margin: 24000 },
          { month: "Jun", revenue: 55000, cost: 28000, margin: 27000 },
        ],
      };
    },
  },
  { pattern: /\/dashboard\/utilization-heatmap\//, methods: ["GET"], handler: () => MOCK_EMPLOYEES.map(e => ({
      employee_id: e.id,
      employee_name: e.full_name,
      days: Array.from({ length: 30 }, (_, i) => ({
        date: `2024-09-${String(i + 1).padStart(2, "0")}`,
        hours: [0, 6].includes(i % 7) ? 0 : 8,
        utilization_pct: [0, 6].includes(i % 7) ? 0 : 100,
      })),
    })),
  },
  { pattern: /\/dashboard\/project-health\//, methods: ["GET"], handler: () => MOCK_PROJECTS.map(p => ({
      project_id: p.id,
      project_name: p.name,
      health: p.status === "ACTIVE" ? "ON_TRACK" : "AT_RISK",
      schedule_variance: 2,
      budget_variance: -5,
      risk_count: 1,
    })),
  },


  // Employees
  { pattern: /\/employees\/simple-dropdown\//, methods: ["GET"], handler: () => MOCK_EMPLOYEES.map(e => ({ id: e.id, full_name: e.full_name, employee_code: e.employee_code, designation: e.designation })) },
  { pattern: /\/employees\/dropdown\//, methods: ["GET"], handler: () => MOCK_EMPLOYEES.map(e => ({ id: e.id, full_name: e.full_name, employee_code: e.employee_code, designation: e.designation })) },
  { pattern: /\/employees\/sync\/keycloak\//, methods: ["POST"], handler: () => ({ success: true, count: MOCK_EMPLOYEES.length }) },
  { pattern: /\/employees\/([^/]+)\/reporting-chain\/$/, methods: ["GET"], handler: () => ({
      chain: [
        { id: "emp-001", name: "Alex Johnson", designation: "CTO", profile_picture_url: null },
      ],
    }),
  },
  { pattern: /\/employees\/([^/]+)\/attendance\/$/, methods: ["GET"], handler: () => MOCK_ATTENDANCE },
  { pattern: /\/employees\/([^/]+)\/performance\/$/, methods: ["GET"], handler: () => ({
      utilization_pct: 85, billable_pct: 78, tasks_completed: 24, tasks_in_progress: 5,
      avg_task_completion_days: 3.2,
    }),
  },
  { pattern: /\/employees\/([^/]+)\/leave-summary\/$/, methods: ["GET"], handler: () => ({
      annual: { total: 21, used: 5, balance: 16 },
      sick: { total: 14, used: 2, balance: 12 },
      comp_off: { total: 3, used: 1, balance: 2 },
    }),
  },
  { pattern: /\/employees\/search\//, methods: ["GET"], handler: (url) => {
      const q = (new URLSearchParams(url.includes("?") ? url.split("?")[1] : "")).get("q")?.toLowerCase() || "";
      return MOCK_EMPLOYEES.filter(e => e.full_name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q));
    },
  },
  { pattern: /\/employees\/org-tree\//, methods: ["GET"], handler: () => [
      {
        id: "emp-001",
        full_name: "Alex Johnson",
        designation: "Chief Technology Officer",
        department: "Technology",
        children: MOCK_EMPLOYEES.slice(1).map(e => ({
          id: e.id,
          full_name: e.full_name,
          designation: e.designation,
          department: e.department,
          children: [],
        })),
      },
    ],
  },
  { pattern: /\/employees\/([^/]+)\/$/, methods: ["GET", "PATCH", "PUT"], handler: (url) => {
      const id = url.match(/\/employees\/([^/]+)\//)?.[1];
      return MOCK_EMPLOYEES.find(e => e.id === id) || MOCK_EMPLOYEES[0];
    },
  },
  { pattern: /\/employees\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `emp-${Date.now()}`, employee_code: `EMP00${MOCK_EMPLOYEES.length + 1}` };
      return paginate(MOCK_EMPLOYEES);
    },
  },

  // Clients
  { pattern: /\/clients\/dropdown\//, methods: ["GET"], handler: () => MOCK_CLIENTS.map(c => ({ id: c.id, name: c.name, code: c.code })) },
  { pattern: /\/clients\/([^/]+)\/$/, methods: ["GET", "PATCH", "PUT", "DELETE"], handler: (url) => {
      const id = url.match(/\/clients\/([^/]+)\//)?.[1];
      return MOCK_CLIENTS.find(c => c.id === id) || MOCK_CLIENTS[0];
    },
  },
  { pattern: /\/clients\/?(\?.*)?$/, methods: ["GET", "POST"], handler: (url, method, data) => {
      if (method === "POST") return { ...data, id: `cli-${Date.now()}` };
      const q = url.includes("?") ? url.split("?")[1] : "";
      const searchParam = new URLSearchParams(q).get("search")?.toLowerCase().trim();
      const catParam = new URLSearchParams(q).get("category")?.toLowerCase().trim();
      let list = MOCK_CLIENTS;
      if (searchParam) {
        list = list.filter(c =>
          c.name.toLowerCase().includes(searchParam) ||
          c.code.toLowerCase().includes(searchParam) ||
          (c.contact_person && c.contact_person.toLowerCase().includes(searchParam))
        );
      }
      if (catParam) {
        list = list.filter(c => c.category?.toLowerCase() === catParam || c.category_id?.toLowerCase() === catParam);
      }
      return paginate(list);
    },
  },

  // Projects
  { pattern: /\/projects\/dropdown\//, methods: ["GET"], handler: () => MOCK_PROJECTS.map(p => ({ id: p.id, name: p.name, code: p.code })) },
  { pattern: /\/projects\/generate-code\//, methods: ["GET"], handler: () => ({ code: `PRJ-${new Date().getFullYear()}${String(Math.floor(Math.random() * 9000) + 1000)}` }) },
  { pattern: /\/projects\/([^/]+)\/summary\/$/, methods: ["GET"], handler: (url) => {
      const id = url.match(/\/projects\/([^/]+)\//)?.[1];
      const p = MOCK_PROJECTS.find(x => x.id === id) || MOCK_PROJECTS[0];
      return { project: p, total_tickets: 45, open_tickets: 12, estimated_hours: p.estimated_hours || 2000, budget: p.budget || 300000 };
    },
  },
  { pattern: /\/projects\/([^/]+)\/billing-summary\/$/, methods: ["GET"], handler: () => ({
      budget: 500000, milestone_planned: 400000, milestone_remaining: 100000, invoiced: 350000, invoice_remaining: 150000, received: 300000, outstanding_receivable: 50000,
    }),
  },
  { pattern: /\/projects\/([^/]+)\/history\/$/, methods: ["GET"], handler: () => [] },
  { pattern: /\/projects\/([^/]+)\/transition\/$/, methods: ["POST"], handler: () => ({
      message: "Success", workflow_state_name: "In Progress", workflow_state_slug: "in_progress", workflow_state_color: "#10b981", manager: null, manager_name: null,
    }),
  },
  { pattern: /\/projects\/([^/]+)\/allowed-transitions\/$/, methods: ["GET"], handler: () => [] },
  { pattern: /\/projects\/([^/]+)\/allocated-employees\/$/, methods: ["GET"], handler: () => MOCK_EMPLOYEES.slice(0, 4).map(e => ({ id: e.id, full_name: e.full_name, employee_code: e.employee_code, designation: e.designation })) },
  { pattern: /\/projects\/([^/]+)\/comments\/$/, methods: ["GET", "POST"], handler: (url, method, data) => {
      if (method === "POST") return { id: `cmt-${Date.now()}`, ...data, author_name: MOCK_USER.full_name, created_at: new Date().toISOString() };
      return paginate([]);
    },
  },
  { pattern: /\/projects\/([^/]+)\/$/, methods: ["GET", "PATCH", "PUT", "DELETE"], handler: (url) => {
      const id = url.match(/\/projects\/([^/]+)\//)?.[1];
      return MOCK_PROJECTS.find(p => p.id === id) || MOCK_PROJECTS[0];
    },
  },
  { pattern: /\/projects\/?(\?.*)?$/, methods: ["GET", "POST"], handler: (url, method, data) => {
      if (method === "POST") return { ...data, id: `proj-${Date.now()}`, code: data.code || `PRJ-${Date.now().toString().slice(-4)}`, completion_pct: 0, status: "active", is_active: true };
      const q = url.includes("?") ? url.split("?")[1] : "";
      const searchParam = new URLSearchParams(q).get("search")?.toLowerCase().trim();
      let list = MOCK_PROJECTS;
      if (searchParam) {
        list = list.filter(p =>
          p.name.toLowerCase().includes(searchParam) ||
          p.code.toLowerCase().includes(searchParam) ||
          (p.client_name && p.client_name.toLowerCase().includes(searchParam))
        );
      }
      return paginate(list);
    },
  },

  // Keycloak Groups
  { pattern: /\/keycloak-groups\//, methods: ["GET"], handler: () => ({ groups: ["Admin", "Manager", "Employee", "HR", "Finance", "Developer", "QA"] }) },

  // Workflows (for ProjectBoard & others)
  { pattern: /\/workflow\/states\/content-type-id\//, methods: ["GET"], handler: (url) => ({
      id: url.includes("ticket") ? 2 : 1,
      app_label: url.includes("ticket") ? "tickets" : "projects",
      model: url.includes("ticket") ? "ticket" : "project",
    }),
  },
  { pattern: /\/workflow\/states\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (url, method, data) => {
      if (method === "POST") return { ...data, id: `wfs-${Date.now()}` };
      if (method === "DELETE") return {};
      if (url.includes("ticket")) return MOCK_TICKET_WORKFLOW_STATES;
      return MOCK_PROJECT_WORKFLOW_STATES;
    },
  },
  { pattern: /\/workflow\/transitions\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `wft-${Date.now()}` };
      if (method === "DELETE") return {};
      return MOCK_PROJECT_WORKFLOW_TRANSITIONS;
    },
  },
  { pattern: /\/workflow\/groups\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: () => [] },

  // Tickets (ticketsApi)
  { pattern: /\/tickets\/([^/]+)\/comments\/([^/]+)\/$/, methods: ["PATCH", "DELETE"], handler: () => ({}) },
  { pattern: /\/tickets\/([^/]+)\/comments\/$/, methods: ["GET", "POST"], handler: (_url, method, data) => {
      if (method === "POST") return { id: `cmt-${Date.now()}`, ...data, author_name: MOCK_USER.full_name, created_at: new Date().toISOString() };
      return [];
    },
  },
  { pattern: /\/tickets\/([^/]+)\/attachments\/([^/]+)\/$/, methods: ["DELETE"], handler: () => ({}) },
  { pattern: /\/tickets\/([^/]+)\/attachments\/$/, methods: ["GET", "POST"], handler: () => [] },
  { pattern: /\/tickets\/([^/]+)\/history\/$/, methods: ["GET"], handler: () => [] },
  { pattern: /\/tickets\/([^/]+)\/children\/$/, methods: ["GET"], handler: (url) => {
      const id = url.match(/\/tickets\/([^/]+)\//)?.[1];
      return MOCK_TICKETS.filter(t => t.parent === id);
    },
  },
  { pattern: /\/tickets\/([^/]+)\/transition\/$/, methods: ["POST"], handler: (_url, _m, data) => ({
      message: "Status updated",
      workflow_state_slug: data?.destination_state || "in_progress",
      workflow_state_name: data?.destination_state || "In Progress",
    }),
  },
  { pattern: /\/tickets\/([^/]+)\/verify\/$/, methods: ["POST"], handler: () => ({
      message: "Verified",
      verified_by_name: MOCK_USER.full_name,
      verified_at: new Date().toISOString(),
    }),
  },
  { pattern: /\/tickets\/([^/]+)\/$/, methods: ["GET", "PATCH", "PUT", "DELETE"], handler: (url, method, data) => {
      const id = url.match(/\/tickets\/([^/]+)\//)?.[1];
      const t = MOCK_TICKETS.find(x => x.id === id || x.ticket_id === id) || MOCK_TICKETS[0];
      if (method === "PATCH" || method === "PUT") return { ...t, ...data };
      if (method === "DELETE") return {};
      return t;
    },
  },
  { pattern: /\/tickets\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `tkt-${Date.now()}`, ticket_id: `TKT-${Date.now().toString().slice(-4)}`, ticket_number: `TKT-${Date.now().toString().slice(-4)}` };
      return paginate(MOCK_TICKETS);
    },
  },

  // Work Items (workItemsApi)
  { pattern: /\/work-items\/([^/]+)\/comments\/$/, methods: ["GET", "POST"], handler: (_url, method, data) => {
      if (method === "POST") return { id: `cmt-${Date.now()}`, ...data, author_name: MOCK_USER.full_name, created_at: new Date().toISOString() };
      return [];
    },
  },
  { pattern: /\/work-items\/([^/]+)\/attachments\/$/, methods: ["GET", "POST"], handler: () => [] },
  { pattern: /\/work-items\/([^/]+)\/history\/$/, methods: ["GET"], handler: () => [] },
  { pattern: /\/work-items\/([^/]+)\/transition\/$/, methods: ["POST"], handler: () => ({ message: "Status updated" }) },
  { pattern: /\/work-items\/([^/]+)\/$/, methods: ["GET", "PATCH", "PUT", "DELETE"], handler: (url) => {
      const id = url.match(/\/work-items\/([^/]+)\//)?.[1];
      return MOCK_TICKETS.find(t => t.id === id || t.ticket_id === id) || MOCK_TICKETS[0];
    },
  },
  { pattern: /\/work-items\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `tkt-${Date.now()}`, ticket_id: `PROJ-${Date.now()}`, ticket_number: `PROJ-${Date.now()}` };
      return paginate(MOCK_TICKETS);
    },
  },

  // Timesheets & Work Logs
  { pattern: /\/timesheets\/my\/week\//, methods: ["GET"], handler: () => MOCK_WEEK_VIEW },
  { pattern: /\/timesheets\/my\/submit\/([^/]+)\//, methods: ["POST"], handler: () => ({ ...MOCK_WEEK_VIEW.weekly_timesheet, status: "SUBMITTED" }) },
  { pattern: /\/timesheets\/my\/copy-day\//, methods: ["POST"], handler: () => ({ copied: 3 }) },
  { pattern: /\/timesheets\/my\/copy-week\//, methods: ["POST"], handler: () => ({ copied: 15 }) },
  { pattern: /\/timesheets\/my\//, methods: ["GET"], handler: () => paginate(MOCK_TIMESHEETS) },
  { pattern: /\/timesheets\/loggable-tickets\//, methods: ["GET"], handler: () => ({
      tickets: MOCK_TICKETS.map(t => ({
        id: t.id,
        ticket_id: t.ticket_id,
        title: t.title,
        type: t.type,
        project_id: t.project,
        project_name: t.project_name,
        epic_title: t.parent_title || "",
        story_title: t.parent_title || "",
      })),
      hints: [],
      can_log: true,
      attendance_hint: null,
    }),
  },
  { pattern: /\/timesheets\/loggable-dates\//, methods: ["GET"], handler: () => ({ dates: ["Mon", "Tue", "Wed", "Thu", "Fri"] }) },
  { pattern: /\/timesheets\/config\//, methods: ["GET"], handler: () => ({ daily_capacity_hours: 8 }) },
  { pattern: /\/timesheets\/reporting\/dashboard\//, methods: ["GET"], handler: () => ({
      pending_reviews: 2,
      approved_this_week: 14,
      rejected_this_week: 1,
      missing_timesheets: 2,
      missing_details: [
        { employee_id: "emp-004", employee_name: "Emily Davis", week_start: "2024-09-23", status: "DRAFT" },
        { employee_id: "emp-005", employee_name: "James Wilson", week_start: "2024-09-23", status: "DRAFT" },
      ],
    }),
  },
  { pattern: /\/timesheets\/team\/aggregate\//, methods: ["GET"], handler: () => MOCK_TEAM_AGGREGATE },
  { pattern: /\/timesheets\/reporting\/review\//, methods: ["GET"], handler: () => MOCK_WEEKLY_TIMESHEETS_REVIEW },
  { pattern: /\/timesheets\/reporting\/approve\//, methods: ["POST"], handler: () => ({ ...MOCK_WEEKLY_TIMESHEETS_REVIEW[0], status: "APPROVED" }) },
  { pattern: /\/timesheets\/reporting\/reject\//, methods: ["POST"], handler: () => ({ ...MOCK_WEEKLY_TIMESHEETS_REVIEW[0], status: "REJECTED" }) },
  { pattern: /\/timesheets\/reporting\/request-changes\//, methods: ["POST"], handler: () => ({ success: true, message: "Changes requested" }) },
  { pattern: /\/timesheets\/reporting\/bulk-approve\//, methods: ["POST"], handler: () => MOCK_WEEKLY_TIMESHEETS_REVIEW.map(t => ({ ...t, status: "APPROVED" })) },
  { pattern: /\/timesheets\/reporting\/bulk-reject\//, methods: ["POST"], handler: () => MOCK_WEEKLY_TIMESHEETS_REVIEW.map(t => ({ ...t, status: "REJECTED" })) },
  { pattern: /\/timesheets\/missing\//, methods: ["GET"], handler: () => [] },
  { pattern: /\/timesheets\/utilization\//, methods: ["GET"], handler: () => MOCK_REPORTS.utilization },
  { pattern: /\/timesheets\/team\//, methods: ["GET"], handler: () => paginate(MOCK_TIMESHEETS) },
  { pattern: /\/work-logs\/([^/]+)\//, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/work-logs\/([^/]+)\//)?.[1];
      return MOCK_WORK_LOGS.find(w => w.id === id) || MOCK_WORK_LOGS[0];
    },
  },
  { pattern: /\/work-logs\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `wl-${Date.now()}` };
      return paginate(MOCK_WORK_LOGS);
    },
  },
  { pattern: /\/timesheets\/([^/]+)\/entries\/$/, methods: ["GET", "POST"], handler: (url) => {
      const id = url.match(/\/timesheets\/([^/]+)\//)?.[1];
      const ts = MOCK_TIMESHEETS.find(t => t.id === id) || MOCK_TIMESHEETS[0];
      return ts.entries;
    },
  },
  { pattern: /\/timesheets\/([^/]+)\/(submit|approve|reject)\/$/, methods: ["POST"], handler: () => ({ status: "success" }) },
  { pattern: /\/timesheets\/([^/]+)\/$/, methods: ["GET", "PATCH"], handler: (url) => {
      const id = url.match(/\/timesheets\/([^/]+)\//)?.[1];
      return MOCK_TIMESHEETS.find(t => t.id === id) || MOCK_TIMESHEETS[0];
    },
  },
  { pattern: /\/timesheets\/$/, methods: ["GET", "POST"], handler: () => paginate(MOCK_TIMESHEETS) },
  { pattern: /\/timesheet-entries\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "DELETE") return {};
      if (method === "POST") return { id: `te-${Date.now()}`, ...data };
      return paginate(MOCK_TIMESHEETS.flatMap(t => t.entries));
    },
  },

  // Allocation
  { pattern: /\/allocations\/employee-capacity\//, methods: ["GET"], handler: () => [
      {
        employee_id: "emp-001",
        employee_name: "Alex Johnson",
        working_days: 22,
        total_capacity_hours: 176,
        allocated_hours: 160,
        logged_hours: 168,
        utilization_percent: 95.5,
        billing_utilization_percent: 90.0,
        allocation_percent: 90.9,
        is_over_allocated: false,
      },
      {
        employee_id: "emp-003",
        employee_name: "Michael Rivera",
        working_days: 22,
        total_capacity_hours: 176,
        allocated_hours: 176,
        logged_hours: 180,
        utilization_percent: 102.3,
        billing_utilization_percent: 98.0,
        allocation_percent: 100.0,
        is_over_allocated: false,
      },
      {
        employee_id: "emp-004",
        employee_name: "Emily Davis",
        working_days: 22,
        total_capacity_hours: 176,
        allocated_hours: 123,
        logged_hours: 140,
        utilization_percent: 79.5,
        billing_utilization_percent: 75.0,
        allocation_percent: 69.9,
        is_over_allocated: false,
      },
      {
        employee_id: "emp-005",
        employee_name: "James Wilson",
        working_days: 22,
        total_capacity_hours: 176,
        allocated_hours: 176,
        logged_hours: 165,
        utilization_percent: 93.8,
        billing_utilization_percent: 88.0,
        allocation_percent: 100.0,
        is_over_allocated: false,
      },
      {
        employee_id: "emp-007",
        employee_name: "David Park",
        working_days: 22,
        total_capacity_hours: 176,
        allocated_hours: 88,
        logged_hours: 110,
        utilization_percent: 62.5,
        billing_utilization_percent: 55.0,
        allocation_percent: 50.0,
        is_over_allocated: false,
      },
    ],
  },
  { pattern: /\/allocations\/team-pipeline\//, methods: ["GET"], handler: () => [] },
  { pattern: /\/allocations\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/allocations\/([^/]+)\//)?.[1];
      return MOCK_ALLOCATIONS.find(a => a.id === id) || MOCK_ALLOCATIONS[0];
    },
  },
  { pattern: /\/allocations\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `alloc-${Date.now()}` };
      return paginate(MOCK_ALLOCATIONS);
    },
  },

  // Invoices & Payments & Receivables
  {
    pattern: /\/payment\/invoices\/receivable-summary\//,
    methods: ["GET"],
    handler: () => ({
      total_invoiced: 306000,
      total_received: 132500,
      total_pending: 173500,
      overdue_amount: 56000,
      overdue_count: 1,
      partial_count: 1,
      collection_pct: 43.3,
    }),
  },
  {
    pattern: /\/payment\/milestones\/budget-summary\//,
    methods: ["GET"],
    handler: () => ({
      total_budget: 350000,
      milestone_total: 180000,
      remaining_budget: 170000,
      milestone_count: 2,
    }),
  },
  {
    pattern: /\/payment\/milestones\/([^/]+)\/generate-invoice\//,
    methods: ["POST"],
    handler: () => ({ detail: "Invoice generated successfully", invoice_number: "INV-2024-005" }),
  },
  { pattern: /\/payment\/milestones\/([^/]+)\//, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/payment\/milestones\/([^/]+)\//)?.[1];
      return MOCK_MILESTONES.find(m => m.id === id) || MOCK_MILESTONES[0];
    },
  },
  { pattern: /\/payment\/milestones\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `ms-${Date.now()}`, status: "PENDING", status_label: "Pending", invoice_count: 0, is_active: true };
      return paginate(MOCK_MILESTONES);
    },
  },
  {
    pattern: /\/payment\/invoices\/([^/]+)\/cancel\//,
    methods: ["POST"],
    handler: () => ({ detail: "Invoice cancelled" }),
  },
  { pattern: /\/payment\/invoices\/([^/]+)\//, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/payment\/invoices\/([^/]+)\//)?.[1];
      return MOCK_INVOICES.find(i => i.id === id) || MOCK_INVOICES[0];
    },
  },
  { pattern: /\/payment\/invoices\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `inv-${Date.now()}`, invoice_number: `INV-${Date.now()}`, status: "UNPAID", total_amount: data?.invoice_amount || 50000, received_amount: 0, pending_amount: data?.invoice_amount || 50000, days_overdue: 0, allocations: [], is_active: true };
      return paginate(MOCK_INVOICES);
    },
  },
  {
    pattern: /\/payment\/payments\/([^/]+)\/allocate\//,
    methods: ["POST"],
    handler: () => ({ detail: "Payment allocated successfully", allocated_amount: 47500 }),
  },
  { pattern: /\/payment\/payments\/([^/]+)\//, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/payment\/payments\/([^/]+)\//)?.[1];
      return MOCK_PAYMENTS.find(p => p.id === id) || MOCK_PAYMENTS[0];
    },
  },
  { pattern: /\/payment\/payments\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `pay-${Date.now()}`, payment_reference: `PAY-${Date.now()}`, allocated_amount: 0, unallocated_amount: data?.payment_amount || 10000, is_active: true };
      return paginate(MOCK_PAYMENTS);
    },
  },
  { pattern: /\/payment\/reports\/client\//, methods: ["GET"], handler: () => ({
      results: MOCK_PAYMENT_DASHBOARD.receivables_by_client,
      count: MOCK_PAYMENT_DASHBOARD.receivables_by_client.length,
    }),
  },
  { pattern: /\/payment\/reports\/project\//, methods: ["GET"], handler: () => ({
      results: MOCK_PAYMENT_DASHBOARD.receivables_by_project,
      count: MOCK_PAYMENT_DASHBOARD.receivables_by_project.length,
    }),
  },
  { pattern: /\/payment\/dashboard\//, methods: ["GET"], handler: () => MOCK_PAYMENT_DASHBOARD },
  { pattern: /\/receivables\//, methods: ["GET"], handler: () => ({
      client_receivables: MOCK_PAYMENT_DASHBOARD.receivables_by_client,
      project_receivables: MOCK_PAYMENT_DASHBOARD.receivables_by_project,
      total_outstanding: MOCK_PAYMENT_DASHBOARD.summary.total_outstanding,
      aging: MOCK_PAYMENT_DASHBOARD.aging,
    }),
  },
  { pattern: /\/invoices\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/invoices\/([^/]+)\//)?.[1];
      return MOCK_INVOICES.find(i => i.id === id) || MOCK_INVOICES[0];
    },
  },
  { pattern: /\/invoices\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `inv-${Date.now()}`, invoice_number: `INV-${Date.now()}` };
      return paginate(MOCK_INVOICES);
    },
  },
  { pattern: /\/payments\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/payments\/([^/]+)\//)?.[1];
      return MOCK_PAYMENTS.find(p => p.id === id) || MOCK_PAYMENTS[0];
    },
  },
  { pattern: /\/payments\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `pay-${Date.now()}` };
      return paginate(MOCK_PAYMENTS);
    },
  },

  // Milestones
  { pattern: /\/milestones\/$/, methods: ["GET", "POST"], handler: () => paginate(MOCK_MILESTONES) },
  { pattern: /\/milestones\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_MILESTONES[0] },

  // Leave & Attendance
  { pattern: /\/attendance\/break\/(start|end)\/$/, methods: ["POST"], handler: () => ({ status: "success" }) },
  { pattern: /\/attendance\/check-in\/$/, methods: ["POST"], handler: () => ({ status: "CHECKED_IN", time: new Date().toISOString() }) },
  { pattern: /\/attendance\/check-out\/$/, methods: ["POST"], handler: () => ({ status: "CHECKED_OUT", time: new Date().toISOString() }) },
  { pattern: /\/attendance\/today\/$/, methods: ["GET"], handler: () => ({ status: "PRESENT", check_in: "09:02", check_out: null }) },
  { pattern: /\/attendance\/overview\//, methods: ["GET"], handler: () => MOCK_ATTENDANCE_OVERVIEW },
  { pattern: /\/attendance\/employee-calendar\//, methods: ["GET"], handler: (url) => {
      const q = url.includes("?") ? url.split("?")[1] : "";
      const year = parseInt(new URLSearchParams(q).get("year") || "2024", 10);
      const month = parseInt(new URLSearchParams(q).get("month") || "9", 10);
      const daysCount = new Date(year, month, 0).getDate();
      const days = Array.from({ length: daysCount }, (_, i) => {
        const d = i + 1;
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isFuture = d > 28 && month >= 9;
        const isToday = d === 28;
        let displayStatus = isWeekend ? "WEEKEND" : (isFuture ? "FUTURE" : "PRESENT");
        if (d === 10) displayStatus = "ON_LEAVE";
        if (d === 15) displayStatus = "WFH";
        return {
          date: dateStr,
          day: d,
          weekday: dayOfWeek,
          is_weekend: isWeekend,
          is_today: isToday,
          is_future: isFuture,
          display_status: displayStatus,
          att_status: isWeekend ? null : (isFuture ? null : (displayStatus === "ON_LEAVE" ? null : "PRESENT")),
          check_in: (!isWeekend && !isFuture && displayStatus !== "ON_LEAVE") ? "09:00" : null,
          check_out: (!isWeekend && !isFuture && displayStatus !== "ON_LEAVE") ? "18:00" : null,
          working_hours: (!isWeekend && !isFuture && displayStatus !== "ON_LEAVE") ? 9 : 0,
          notes: "",
          leave: displayStatus === "ON_LEAVE" ? { id: "l-1", type: "Sick Leave", color: "#F44336", status: "APPROVED", days_count: 1, reason: "Health checkup" } : null,
          clockin_enabled: true,
        };
      });
      return {
        year, month,
        employee_id: "emp-001",
        employee_name: "Alex Johnson",
        effective_days: 20,
        summary: { PRESENT: 18, WFH: 1, ON_LEAVE: 1, ABSENT: 0, WEEKEND: 8 },
        days,
      };
    },
  },
  { pattern: /\/attendance\/tracker\//, methods: ["GET"], handler: () => ({
      employee: { id: "emp-001", full_name: "Alex Johnson", employee_code: "EMP001", designation: "Chief Technology Officer", department: "Technology" },
      date: "2024-09-30",
      record: {
        status: "PRESENT",
        check_in: "09:02",
        check_out: null,
        duration_hours: 6.5,
        working_hours: 6.5,
        total_break_minutes: 30,
        check_in_lat: null, check_in_lng: null,
        check_out_lat: null, check_out_lng: null,
        breaks: [],
      },
      events: [
        { type: "CHECK_IN", time: "09:02", label: "Checked In" },
      ],
    }),
  },
  { pattern: /\/attendance\/schedule\//, methods: ["GET"], handler: () => [
      { date: "2024-10-01", shift_name: "Morning Shift (9:00 - 18:00)", start_time: "09:00", end_time: "18:00", status: "SCHEDULED" },
      { date: "2024-10-02", shift_name: "Morning Shift (9:00 - 18:00)", start_time: "09:00", end_time: "18:00", status: "SCHEDULED" },
      { date: "2024-10-03", shift_name: "Morning Shift (9:00 - 18:00)", start_time: "09:00", end_time: "18:00", status: "SCHEDULED" },
      { date: "2024-10-04", shift_name: "Morning Shift (9:00 - 18:00)", start_time: "09:00", end_time: "18:00", status: "SCHEDULED" },
    ],
  },
  { pattern: /\/attendance\/employee-shifts\/([^/]+)\//, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_EMPLOYEE_SHIFTS[0] },
  { pattern: /\/attendance\/employee-shifts\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `esh-${Date.now()}` };
      return paginate(MOCK_EMPLOYEE_SHIFTS);
    },
  },
  { pattern: /\/attendance\/wfh-settings\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { success: true, ...data };
      return paginate(MOCK_WFH_SETTINGS);
    },
  },
  { pattern: /\/attendance\/wfh-requests\/admin\//, methods: ["GET"], handler: () => ({ results: MOCK_WFH_REQUESTS, pending_count: 1 }) },
  { pattern: /\/attendance\/wfh-requests\/([^/]+)\//, methods: ["POST"], handler: () => ({ success: true }) },
  { pattern: /\/attendance\/shift-change-requests\/admin\//, methods: ["GET"], handler: () => ({ results: MOCK_SHIFT_CHANGE_REQUESTS, pending_count: 1 }) },
  { pattern: /\/attendance\/shift-change-requests\/([^/]+)\//, methods: ["POST"], handler: () => ({ success: true }) },
  { pattern: /\/attendance\/regularization\/admin\//, methods: ["GET"], handler: () => MOCK_REGULARIZATION_REQUESTS },
  { pattern: /\/attendance\/regularization\/([^/]+)\//, methods: ["POST"], handler: () => ({ success: true }) },
  { pattern: /\/attendance\/regularization\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `reg-${Date.now()}`, status: "PENDING" };
      return MOCK_REGULARIZATION_REQUESTS;
    },
  },
  { pattern: /\/attendance\/monthly-report\/list\//, methods: ["GET"], handler: () => MOCK_MONTHLY_REPORTS },
  { pattern: /\/attendance\/monthly-report\/([^/]+)\//, methods: ["POST"], handler: () => ({ success: true }) },
  { pattern: /\/attendance\/list\//, methods: ["GET"], handler: () => paginate(MOCK_ATTENDANCE_LIST) },
  { pattern: /\/attendance\/monthly\//, methods: ["GET"], handler: () => paginate(MOCK_ATTENDANCE.records) },
  { pattern: /\/attendance\/export\//, methods: ["GET"], handler: () => new Blob([], { type: "text/csv" }) },
  { pattern: /\/attendance\//, methods: ["GET"], handler: () => paginate(MOCK_ATTENDANCE_LIST) },

  // Leave
  { pattern: /\/leave\/team\/meta\//, methods: ["GET"], handler: () => ({ has_team: true, direct_count: 5, indirect_count: 3 }) },
  { pattern: /\/leave\/admin\/assign\//, methods: ["GET", "POST"], handler: (_, method) => {
      if (method === "POST") return { summary: { assigned: 5, duplicate: 0, max_days_exceeded: 0, error: 0 }, details: [] };
      return { available_years: [{ year: 2024, label: "FY 2024-25", working_days: 250 }, { year: 2023, label: "FY 2023-24", working_days: 250 }] };
    },
  },
  { pattern: /\/leave\/types\//, methods: ["GET"], handler: () => paginate(MOCK_MASTER.leave_types) },
  { pattern: /\/leave\/balances\//, methods: ["GET"], handler: () => [
      { id: "lb-001", leave_type_id: "lt-001", leave_type: "Annual Leave", leave_type_name: "Annual Leave", leave_type_code: "AL", leave_type_color: "#4CAF50", total_days: 21, used_days: 5, remaining_days: 16 },
      { id: "lb-002", leave_type_id: "lt-002", leave_type: "Sick Leave", leave_type_name: "Sick Leave", leave_type_code: "SL", leave_type_color: "#F44336", total_days: 14, used_days: 2, remaining_days: 12 },
      { id: "lb-003", leave_type_id: "lt-005", leave_type: "Compensatory Off", leave_type_name: "Compensatory Off", leave_type_code: "CO", leave_type_color: "#FF9800", total_days: 3, used_days: 1, remaining_days: 2 },
    ],
  },
  { pattern: /\/leave\/requests\/([^/]+)\/(review|ack)\//, methods: ["POST"], handler: () => ({ success: true }) },
  { pattern: /\/leave\/requests\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `lr-${Date.now()}`, status: "PENDING" };
      if (method === "DELETE") return {};
      return paginate(MOCK_LEAVE_REQUESTS);
    },
  },
  { pattern: /\/leave-requests\/([^/]+)\/(approve|reject)\/$/, methods: ["POST"], handler: () => ({ status: "success" }) },
  { pattern: /\/leave-requests\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/leave-requests\/([^/]+)\//)?.[1];
      return MOCK_LEAVE_REQUESTS.find(l => l.id === id) || MOCK_LEAVE_REQUESTS[0];
    },
  },
  { pattern: /\/leave-requests\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `lr-${Date.now()}`, status: "PENDING" };
      return paginate(MOCK_LEAVE_REQUESTS);
    },
  },
  { pattern: /\/leave-balances\//, methods: ["GET"], handler: () => ({
      annual: { total: 21, used: 5, balance: 16 },
      sick: { total: 14, used: 2, balance: 12 },
    }),
  },

  // Payroll
  { pattern: /\/payroll\/generate\//, methods: ["GET", "POST"], handler: () => ({
      has_rate_card: true,
      basic_salary: 8500,
      hra: 4250,
      allowances: 2650,
      pf: 1200,
      tds: 800,
      working_days: 22,
      present_days: 21,
      leave_days: 1,
    }),
  },
  { pattern: /\/payroll\/([^/]+)\/(approve|mark-paid)\//, methods: ["POST"], handler: () => ({ status: "success" }) },
  { pattern: /\/payroll\/([^/]+)\/$/, methods: ["GET"], handler: () => MOCK_PAYROLL[0] },
  { pattern: /\/payroll\/$/, methods: ["GET", "POST"], handler: () => paginate(MOCK_PAYROLL) },
  { pattern: /\/payslips\//, methods: ["GET"], handler: () => paginate(MOCK_PAYROLL) },

  // Expenses & Reimbursements
  {
    pattern: /\/expenses\/summary\//,
    methods: ["GET"],
    handler: () => ({
      total_all_time: 83750,
      total_this_month: 56500,
      pending_approval: { count: 1, amount: 32000 },
      approved_reimbursed: { count: 2, amount: 27250 },
      by_category: [
        { category: "TRAVEL", count: 1, amount: 18500 },
        { category: "SOFTWARE", count: 1, amount: 32000 },
        { category: "MEALS", count: 1, amount: 8750 },
        { category: "EQUIPMENT", count: 1, amount: 24500 },
      ],
      by_department: [
        { department_id: "dept-001", department_name: "Engineering", count: 2, amount: 43000 },
        { department_id: "dept-002", department_name: "Design", count: 1, amount: 32000 },
        { department_id: "dept-003", department_name: "Management", count: 1, amount: 8750 },
      ],
    }),
  },
  { pattern: /\/expenses\/([^/]+)\/(approve|reject|submit|reimburse)\/$/, methods: ["POST"], handler: () => ({ status: "success" }) },
  { pattern: /\/expenses\/([^/]+)\/attachments\/([^/]+)\/$/, methods: ["DELETE"], handler: () => ({ status: "deleted" }) },
  { pattern: /\/expenses\/([^/]+)\/attachments\/$/, methods: ["POST"], handler: () => ({ id: `att-${Date.now()}`, file: "receipt.pdf", original_name: "receipt.pdf", file_size: 1024, content_type: "application/pdf", created_at: new Date().toISOString() }) },
  { pattern: /\/expenses\/([^/]+)\/workflow-transition\/$/, methods: ["POST"], handler: () => ({ message: "Transition complete", claim: MOCK_EXPENSES[0] }) },
  { pattern: /\/expenses\/([^/]+)\/allowed-transitions\/$/, methods: ["GET"], handler: () => [] },
  { pattern: /\/expenses\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/expenses\/([^/]+)\//)?.[1];
      return MOCK_EXPENSES.find(e => e.id === id) || MOCK_EXPENSES[0];
    },
  },
  { pattern: /\/expenses\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `exp-${Date.now()}`, expense_number: `EXP-${Date.now()}`, status: "DRAFT", status_label: "Draft" };
      return {
        summary: MOCK_EXPENSE_SUMMARY,
        results: MOCK_EXPENSES,
        count: MOCK_EXPENSES.length,
      };
    },
  },

  // Reimbursements
  {
    pattern: /\/reimbursements\/active-config\//,
    methods: ["GET"],
    handler: () => ({
      is_configured: true,
      approver_id: "emp-001",
      approver_name: "Alex Johnson",
      max_claim_amount: 50000,
    }),
  },
  {
    pattern: /\/reimbursements\/summary\//,
    methods: ["GET"],
    handler: () => ({
      total_claimed: 26550,
      total_approved: 7200,
      total_pending: 4850,
      total_claims: 3,
    }),
  },
  {
    pattern: /\/reimbursements\/([^/]+)\/allowed-transitions\//,
    methods: ["GET"],
    handler: () => [
      { id: "trans-1", destination_state_slug: "approved", destination_state_name: "Approve Claim", destination_state_color: "#52c41a", label: "Approve" },
      { id: "trans-2", destination_state_slug: "rejected", destination_state_name: "Reject Claim", destination_state_color: "#ff4d4f", label: "Reject" },
    ],
  },
  {
    pattern: /\/reimbursements\/([^/]+)\/workflow-transition\//,
    methods: ["POST"],
    handler: () => ({
      message: "Transition successful",
      workflow_state_name: "Approved",
      workflow_state_is_final: true,
      claim: MOCK_REIMBURSEMENTS[0],
    }),
  },
  { pattern: /\/reimbursements\/([^/]+)\/(submit|approve|reject)\/$/, methods: ["POST"], handler: () => ({ status: "success" }) },
  { pattern: /\/reimbursements\/([^/]+)\/attachments\/$/, methods: ["POST"], handler: () => ({ id: `ratt-${Date.now()}`, file: "claim_receipt.pdf", original_name: "claim_receipt.pdf", file_size: 2048, content_type: "application/pdf", created_at: new Date().toISOString() }) },
  {
    pattern: /\/reimbursements\/([^/]+)\/$/,
    methods: ["GET", "PATCH", "DELETE"],
    handler: (url) => {
      const id = url.match(/\/reimbursements\/([^/]+)\//)?.[1];
      const found = MOCK_REIMBURSEMENTS.find(r => r.id === id) || MOCK_REIMBURSEMENTS[0];
      return {
        ...found,
        attachment: null,
        attachments: [],
        audit_logs: [
          {
            id: 1,
            from_status: "DRAFT",
            from_status_label: "Draft",
            to_status: "SUBMITTED",
            to_status_label: "Submitted",
            performed_by: "emp-003",
            performed_by_name: "Michael Rivera",
            comments: "Initial claim submission with receipts",
            created_at: "2024-09-19T09:30:00Z",
          },
        ],
        updated_at: "2024-09-19T09:30:00Z",
      };
    },
  },
  {
    pattern: /\/reimbursements\/$/,
    methods: ["GET", "POST"],
    handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `clm-${Date.now()}`, claim_number: `CLM-${Date.now()}`, status: "SUBMITTED", status_label: "Submitted" };
      return {
        results: MOCK_REIMBURSEMENTS,
        summary: {
          total_claimed: 26550,
          total_approved: 7200,
          total_pending: 4850,
          total_claims: 3,
        },
        count: MOCK_REIMBURSEMENTS.length,
      };
    },
  },

  // CRM Leads & Documents & Folders
  { pattern: /\/leads\/dashboard\//, methods: ["GET"], handler: () => MOCK_LEAD_DASHBOARD },
  { pattern: /\/leads\/project-managers\//, methods: ["GET"], handler: () => MOCK_EMPLOYEES.slice(0, 3).map(e => ({ id: e.id, full_name: e.full_name, employee_code: e.employee_code })) },
  { pattern: /\/leads\/statuses\//, methods: ["GET"], handler: () => ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] },
  { pattern: /\/leads\/([^/]+)\/(convert|kickoff|toggle-complete|assign-pm)\//, methods: ["POST"], handler: () => ({ success: true, message: "Action completed" }) },
  { pattern: /\/leads\/([^/]+)\/documents\//, methods: ["GET", "POST"], handler: () => paginate(MOCK_CRM_DOCUMENTS) },
  { pattern: /\/leads\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/leads\/([^/]+)\//)?.[1];
      return MOCK_LEADS.find(l => l.id === id) || MOCK_LEADS[0];
    },
  },
  { pattern: /\/leads\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `lead-${Date.now()}`, status: "new" };
      return paginate(MOCK_LEADS);
    },
  },
  { pattern: /\/crm-folders\/([^/]+)\/download\//, methods: ["GET"], handler: () => new Blob([], { type: "application/zip" }) },
  { pattern: /\/crm-folders\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/crm-folders\/([^/]+)\//)?.[1];
      return MOCK_CRM_FOLDERS.find(f => f.id === id) || MOCK_CRM_FOLDERS[0];
    },
  },
  { pattern: /\/crm-folders\/$/, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `cf-${Date.now()}` };
      if (method === "DELETE") return {};
      return MOCK_CRM_FOLDERS;
    },
  },
  { pattern: /\/crm-documents\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/crm-documents\/([^/]+)\//)?.[1];
      return MOCK_CRM_DOCUMENTS.find(d => d.id === id) || MOCK_CRM_DOCUMENTS[0];
    },
  },
  { pattern: /\/crm-documents\/$/, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `cd-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_CRM_DOCUMENTS);
    },
  },

  // Sales Management documents & followups & tasks
  { pattern: /\/sales-documents\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_SALES_DOCUMENTS[0] },
  { pattern: /\/sales-documents\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `sdoc-${Date.now()}`, file_url: "#", created_at: new Date().toISOString() };
      return paginate(MOCK_SALES_DOCUMENTS);
    },
  },
  { pattern: /\/sales-followups\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_SALES_FOLLOWUPS[0] },
  { pattern: /\/sales-followups\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `sfu-${Date.now()}`, is_completed: false, created_at: new Date().toISOString() };
      return paginate(MOCK_SALES_FOLLOWUPS);
    },
  },
  { pattern: /\/lead-followups\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_SALES_FOLLOWUPS[0] },
  { pattern: /\/lead-followups\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `lfu-${Date.now()}`, is_completed: false, created_at: new Date().toISOString() };
      return paginate(MOCK_SALES_FOLLOWUPS);
    },
  },
  { pattern: /\/lead-tasks\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_LEAD_TASKS[0] },
  { pattern: /\/lead-tasks\/$/, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `ltask-${Date.now()}`, is_completed: false, status: "PENDING", created_at: new Date().toISOString() };
      return paginate(MOCK_LEAD_TASKS);
    },
  },
  { pattern: /\/lead-documents\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_SALES_DOCUMENTS[0] },
  { pattern: /\/lead-documents\/$/, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `ldoc-${Date.now()}`, file_url: "#", created_at: new Date().toISOString() };
      return paginate(MOCK_SALES_DOCUMENTS);
    },
  },
  { pattern: /\/custom-followup-types\/$/, methods: ["GET", "POST"], handler: () => paginate(MOCK_MASTER.followup_types) },

  // Workspace Calendar & Dashboard & Followups & Todos & Meetings
  { pattern: /\/workspace\/calendar\//, methods: ["GET"], handler: () => ({
      events: MOCK_CALENDAR_EVENTS,
      count: MOCK_CALENDAR_EVENTS.length,
    }),
  },
  { pattern: /\/workspace\/dashboard\//, methods: ["GET"], handler: () => ({
      todos_pending: MOCK_TODOS.filter(t => t.status !== "DONE").length,
      meetings_today: 1,
      followups_due: 2,
      events: MOCK_CALENDAR_EVENTS,
    }),
  },
  { pattern: /\/todos\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/todos\/([^/]+)\//)?.[1];
      return MOCK_TODOS.find(t => t.id === id) || MOCK_TODOS[0];
    },
  },
  { pattern: /\/todos\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `todo-${Date.now()}`, status: "PENDING" };
      return paginate(MOCK_TODOS);
    },
  },
  { pattern: /\/meetings\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/meetings\/([^/]+)\//)?.[1];
      return MOCK_MEETINGS.find(m => m.id === id) || MOCK_MEETINGS[0];
    },
  },
  { pattern: /\/meetings\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `meet-${Date.now()}` };
      return paginate(MOCK_MEETINGS);
    },
  },
  { pattern: /\/followups\/([^/]+)\/transition\/$/, methods: ["POST"], handler: () => ({ message: "success", workflow_state_name: "Completed", workflow_state_slug: "completed" }) },
  { pattern: /\/followups\/board\//, methods: ["GET"], handler: () => ({
      count: MOCK_FOLLOWUPS.length,
      columns: {
        open: MOCK_FOLLOWUPS,
        in_progress: [],
        completed: [],
      },
    }),
  },
  { pattern: /\/followups\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      if (url.includes("DELETE")) return {};
      const id = url.match(/\/followups\/([^/]+)\//)?.[1];
      return MOCK_FOLLOWUPS.find(f => f.id === id) || MOCK_FOLLOWUPS[0];
    },
  },
  { pattern: /\/followups\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return {
        ...data, id: `fu-${Date.now()}`,
        type_label: data?.type || "Call",
        priority_label: data?.priority || "Medium",
        workflow_state: "open", workflow_state_name: "Open",
        workflow_state_slug: "open", workflow_state_color: "#6366f1",
        is_overdue: false, can_transition: true,
        assignees: [], assignees_data: [], comments: "",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      return { count: MOCK_FOLLOWUPS.length, results: MOCK_FOLLOWUPS, total_pages: 1, current_page: 1, next: null, previous: null };
    },
  },
  { pattern: /\/follow-ups\/([^/]+)\/transition\/$/, methods: ["POST"], handler: () => ({ message: "success", workflow_state_name: "Completed", workflow_state_slug: "completed" }) },
  { pattern: /\/follow-ups\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      if (url.includes("DELETE")) return {};
      const id = url.match(/\/follow-ups\/([^/]+)\//)?.[1];
      return MOCK_FOLLOWUPS.find(f => f.id === id) || MOCK_FOLLOWUPS[0];
    },
  },
  { pattern: /\/follow-ups\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `fu-${Date.now()}`, type_label: data?.type || "Call", workflow_state_slug: "open", workflow_state_name: "Open", workflow_state_color: "#6366f1", is_overdue: false, can_transition: true, assignees: [], assignees_data: [], comments: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      return { count: MOCK_FOLLOWUPS.length, results: MOCK_FOLLOWUPS, total_pages: 1, current_page: 1, next: null, previous: null };
    },
  },

  // Notifications
  { pattern: /\/notifications\/rules\/([^/]+)\/trigger\//, methods: ["POST"], handler: () => ({ success: true, message: "Rule triggered" }) },
  { pattern: /\/notifications\/rules\/([^/]+)\//, methods: ["GET", "PUT", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "DELETE") return {};
      if (method === "PUT" || method === "PATCH") return { ...MOCK_NOTIFICATION_RULES[0], ...data };
      return MOCK_NOTIFICATION_RULES[0];
    },
  },
  { pattern: /\/notifications\/rules\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `nrule-${Date.now()}` };
      return paginate(MOCK_NOTIFICATION_RULES);
    },
  },
  { pattern: /\/notifications\/unread-count\//, methods: ["GET"], handler: () => ({ count: MOCK_NOTIFICATIONS.filter(n => !n.is_read).length }) },
  { pattern: /\/notifications\/([^/]+)\/read\/$/, methods: ["POST"], handler: () => ({}) },
  { pattern: /\/notifications\/read-all\/$/, methods: ["POST"], handler: () => ({}) },
  { pattern: /\/notifications\//, methods: ["GET"], handler: () => ({
      count: MOCK_NOTIFICATIONS.filter(n => !n.is_read).length,
      results: MOCK_NOTIFICATIONS,
    }),
  },

  // Reports
  { pattern: /\/reports\/pmo-portfolio\//, methods: ["GET"], handler: () => MOCK_PROJECTS },
  { pattern: /\/reports\/portfolio\//, methods: ["GET"], handler: () => MOCK_PROJECTS.map(p => ({ ...p, client: p.client_name, manager: p.manager_name })) },
  { pattern: /\/reports\/employee-utilization\//, methods: ["GET"], handler: () => MOCK_EMPLOYEES.map(e => ({
      employee_id: e.id,
      employee_name: e.full_name,
      working_days: 22,
      total_capacity_hours: 176,
      logged_hours: 160,
      utilization_percent: 91,
      billing_utilization_percent: 85,
      allocation_percent: 100,
      is_over_allocated: false,
    })),
  },
  { pattern: /\/reports\/utilization\//, methods: ["GET"], handler: () => MOCK_REPORTS.utilization },
  { pattern: /\/reports\/allocation-matrix\//, methods: ["GET"], handler: () => MOCK_EMPLOYEES.map(e => ({
      employee: e.full_name,
      projects: [
        { project: "AI-Powered Analytics Platform", allocation_pct: 60, daily_hours: 4.8, start_date: "2024-01-01", end_date: "2024-12-31" },
        { project: "E-Commerce Redesign", allocation_pct: 40, daily_hours: 3.2, start_date: "2024-03-01", end_date: null },
      ],
    })),
  },
  { pattern: /\/reports\/allocation\//, methods: ["GET"], handler: () => MOCK_REPORTS.allocation },
  { pattern: /\/reports\/employee-daily-log\//, methods: ["GET"], handler: () => MOCK_WORK_LOGS },
  { pattern: /\/reports\/project-progress\//, methods: ["GET"], handler: () => ({
      project_id: "proj-001",
      project_name: "AI-Powered Analytics Platform",
      total_milestones: 4,
      completed_milestones: 2,
      progress_pct: 65,
      logged_hours: 145,
      budget_hours: 200,
    }),
  },

  // Finance Documents
  { pattern: /\/finance\/documents\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_FINANCE_DOCS[0] },
  { pattern: /\/finance\/documents\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `fin-${Date.now()}` };
      return paginate(MOCK_FINANCE_DOCS);
    },
  },
  { pattern: /\/finance-documents\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_FINANCE_DOCS[0] },
  { pattern: /\/finance-documents\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `fin-${Date.now()}` };
      return paginate(MOCK_FINANCE_DOCS);
    },
  },

  // Social Feed
  { pattern: /\/social-feed\/([^/]+)\/(like|unlike)\/$/, methods: ["POST"], handler: () => ({}) },
  { pattern: /\/social-feed\/([^/]+)\/comments\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { id: `cmt-${Date.now()}`, ...data, author_name: MOCK_USER.full_name, created_at: new Date().toISOString() };
      return [];
    },
  },
  { pattern: /\/social-feed\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_SOCIAL_POSTS[0] },
  { pattern: /\/social-feed\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `post-${Date.now()}`, likes_count: 0, comments_count: 0, is_liked: false };
      return paginate(MOCK_SOCIAL_POSTS);
    },
  },

  // Policy Documents
  { pattern: /\/policy-documents\/([^/]+)\/acknowledge\/$/, methods: ["POST"], handler: () => ({ acknowledged: true, created: true }) },
  { pattern: /\/policy-documents\/([^/]+)\/acknowledgments\/$/, methods: ["GET"], handler: () => [] },
  { pattern: /\/policy-documents\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_POLICIES[0] },
  { pattern: /\/policy-documents\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `pol-${Date.now()}` };
      return MOCK_POLICIES;
    },
  },

  // HR Compliance
  { pattern: /\/hr-compliance\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/hr-compliance\/([^/]+)\//)?.[1];
      return MOCK_COMPLIANCE_DOCS.find(d => d.id === id) || MOCK_COMPLIANCE_DOCS[0];
    },
  },
  { pattern: /\/hr-compliance\/$/, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `hrc-${Date.now()}` };
      if (method === "DELETE") return {};
      return MOCK_COMPLIANCE_DOCS;
    },
  },

  // Offboarding
  { pattern: /\/offboarding\/notice-period-policy\//, methods: ["GET", "POST"], handler: () => ({ id: "1", name: "Standard Notice Period", notice_period_days: 60, is_default: true, is_active: true }) },
  { pattern: /\/offboarding\/requests\/([^/]+)\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_url, _m, data) => {
      const req = MOCK_OFFBOARDING_REQUESTS[0];
      return { ...req, ...data };
    },
  },
  { pattern: /\/offboarding\/requests\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...MOCK_OFFBOARDING_REQUESTS[0], ...data, id: `off-${Date.now()}` };
      return MOCK_OFFBOARDING_REQUESTS;
    },
  },
  { pattern: /\/offboarding\//, methods: ["GET", "POST", "PATCH"], handler: () => MOCK_OFFBOARDING_REQUESTS },

  // Onboarding
  { pattern: /\/onboarding\//, methods: ["GET", "POST", "PATCH"], handler: () => paginate(MOCK_ONBOARDING) },

  // IT Assets
  { pattern: /\/assets\/inventory\/([^/]+)\/refill\/$/, methods: ["POST"], handler: () => ({ success: true }) },
  { pattern: /\/assets\/inventory\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { id: `inv-${Date.now()}`, ...data };
      if (method === "DELETE") return {};
      return paginate(MOCK_INVENTORY_ITEMS);
    },
  },
  { pattern: /\/assets\/assignments\/([^/]+)\/revoke\/$/, methods: ["POST"], handler: () => ({ success: true }) },
  { pattern: /\/assets\/assignments\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { id: `ea-${Date.now()}`, ...data };
      if (method === "DELETE") return {};
      return paginate(MOCK_EMPLOYEE_ASSETS);
    },
  },
  { pattern: /\/assets\/requests\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { id: `req-${Date.now()}`, ...data, status: "pending" };
      if (method === "DELETE") return {};
      return paginate(MOCK_ASSET_REQUESTS);
    },
  },
  { pattern: /\/it-assets\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_IT_ASSETS[0] },
  { pattern: /\/it-assets\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `asset-${Date.now()}` };
      return paginate(MOCK_IT_ASSETS);
    },
  },

  // Chat
  { pattern: /\/chat\/conversations\/([^/]+)\/attachments\/presign\//, methods: ["POST"], handler: () => ({ upload_url: "#", object_key: "key-1" }) },
  { pattern: /\/chat\/conversations\/([^/]+)\//, methods: ["GET", "PATCH", "DELETE"], handler: () => MOCK_CHAT_ROOMS[0] },
  { pattern: /\/chat\/conversations\//, methods: ["GET", "POST"], handler: () => paginate(MOCK_CHAT_ROOMS) },
  { pattern: /\/chat\/rooms\//, methods: ["GET", "POST"], handler: () => paginate(MOCK_CHAT_ROOMS) },
  { pattern: /\/chat\/messages\/mentions\//, methods: ["GET"], handler: () => paginate([]) },
  { pattern: /\/chat\/messages\/starred\//, methods: ["GET"], handler: () => paginate([]) },
  { pattern: /\/chat\/messages\/([^/]+)\/(reaction|vote-poll)\//, methods: ["POST"], handler: () => ({}) },
  { pattern: /\/chat\/messages\/([^/]+)\//, methods: ["GET", "PATCH", "DELETE"], handler: () => ({}) },
  { pattern: /\/chat\/messages\//, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { id: `msg-${Date.now()}`, body: data?.body || "", sender: { id: "emp-001", full_name: "Alex Johnson" }, created_at: new Date().toISOString() };
      return paginate([]);
    },
  },
  { pattern: /\/chat\/search\//, methods: ["GET"], handler: () => ({ messages: [], conversations: [] }) },
  { pattern: /\/chat\/calls\/active\//, methods: ["GET"], handler: () => null },
  { pattern: /\/chat\/calls\/history\//, methods: ["GET"], handler: () => [] },
  { pattern: /\/chat\/calls\/initiate\//, methods: ["POST"], handler: () => ({ _id: "call-1", caller_id: "emp-001", recipient_id: "emp-002", call_type: "VOICE" }) },
  { pattern: /\/chat\/calls\/respond\//, methods: ["POST"], handler: () => ({ _id: "call-1", caller_id: "emp-001", recipient_id: "emp-002", call_type: "VOICE" }) },
  { pattern: /\/chat\/calls\/end\//, methods: ["POST"], handler: () => ({}) },
  { pattern: /\/chat\/presence\//, methods: ["GET", "POST"], handler: () => ({ presence: { "emp-001": "online", "emp-002": "online", "emp-003": "online" } }) },
  { pattern: /\/chat\/ai\//, methods: ["POST"], handler: () => ({ reply: "Hello! How can I assist you with your projects today?", conversation_id: "conv-ai", model: "nexus-ai", timestamp: new Date().toISOString() }) },

  // Roles & Permissions
  { pattern: /\/roles\/([^/]+)\/permissions\/$/, methods: ["GET", "POST", "PUT"], handler: () => MOCK_PERMISSIONS.map(p => ({ id: p, name: p })) },
  { pattern: /\/roles\/([^/]+)\/$/, methods: ["GET", "PATCH", "DELETE"], handler: (url) => {
      const id = url.match(/\/roles\/([^/]+)\//)?.[1];
      return MOCK_ROLES.find(r => r.id === id) || MOCK_ROLES[0];
    },
  },
  { pattern: /\/roles\/$/, methods: ["GET", "POST"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `role-${Date.now()}` };
      return paginate(MOCK_ROLES);
    },
  },
  { pattern: /\/permissions\//, methods: ["GET"], handler: () => MOCK_PERMISSIONS.map(p => ({ id: p, name: p, codename: p })) },

  // Settings & Company Profile
  { pattern: /\/settings\//, methods: ["GET", "PATCH"], handler: () => ({
      timezone: "America/New_York", date_format: "MM/DD/YYYY",
      currency: "USD", fiscal_year_start: 4,
    }),
  },
  { pattern: /\/company-profile\//, methods: ["GET", "PATCH", "PUT"], handler: () => ({
      name: "Nexus Demo Corp", industry: "Technology",
      website: "https://nexusdemo.com", email: "contact@nexusdemo.com",
      phone: "+1-555-0000", address: "123 Demo Street, New York, NY",
      logo_url: null, founded_year: 2020,
    }),
  },

  // Master dropdowns
  { pattern: /\/master\/dropdown\/shift-categories\//, methods: ["GET"], handler: () => MOCK_MASTER.shift_categories },
  { pattern: /\/master\/dropdown\/locations\//, methods: ["GET"], handler: () => MOCK_MASTER.locations },
  { pattern: /\/master\/dropdown\/designations\//, methods: ["GET"], handler: () => MOCK_MASTER.designations },
  { pattern: /\/master\/dropdown\/departments\//, methods: ["GET"], handler: () => MOCK_MASTER.departments },
  { pattern: /\/master\/dropdown\/employment-types\//, methods: ["GET"], handler: () => MOCK_MASTER.employment_types },
  { pattern: /\/master\/dropdown\/leave-types\//, methods: ["GET"], handler: () => MOCK_MASTER.leave_types },
  { pattern: /\/master\/dropdown\/workflows\//, methods: ["GET"], handler: () => MOCK_MASTER.workflows },
  { pattern: /\/master\/dropdown\/client-categories\//, methods: ["GET"], handler: () => MOCK_MASTER.client_categories },
  { pattern: /\/master\/dropdown\/business-types\//, methods: ["GET"], handler: () => MOCK_MASTER.business_types },
  { pattern: /\/master\/dropdown\/billing-types\//, methods: ["GET"], handler: () => MOCK_MASTER.billing_types },
  { pattern: /\/master\/dropdown\//, methods: ["GET"], handler: () => [] },

  // Master endpoints
  { pattern: /\/designations\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `des-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.designations);
    },
  },
  { pattern: /\/departments\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `dept-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.departments);
    },
  },
  { pattern: /\/locations\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `loc-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.locations);
    },
  },
  { pattern: /\/employment-types\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `et-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.employment_types);
    },
  },
  { pattern: /\/leave-types\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `lt-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.leave_types);
    },
  },
  { pattern: /\/holidays\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `hol-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.holidays);
    },
  },
  { pattern: /\/workflows\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `wf-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.workflows);
    },
  },
  { pattern: /\/client-categories\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `cc-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.client_categories);
    },
  },
  { pattern: /\/business-types\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `bt-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.business_types);
    },
  },
  { pattern: /\/billing-types\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `bt-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.billing_types);
    },
  },
  { pattern: /\/notice-periods\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `np-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.notice_periods);
    },
  },
  { pattern: /\/rate-cards\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `rc-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.rate_cards);
    },
  },
  { pattern: /\/shift-categories\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `sc-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.shift_categories);
    },
  },
  { pattern: /\/reimbursement(-types|-configs|-categories)?\/$/, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `rei-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.reimbursements);
    },
  },
  { pattern: /\/followup-types\//, methods: ["GET", "POST", "PATCH", "DELETE"], handler: (_, method, data) => {
      if (method === "POST") return { ...data, id: `ft-${Date.now()}` };
      if (method === "DELETE") return {};
      return paginate(MOCK_MASTER.followup_types);
    },
  },

  // MFA Admin & Auth
  { pattern: /\/admin\/mfa\/policy\//, methods: ["GET", "PUT"], handler: () => ({ require_mfa_for_all: false, updated_at: "2024-09-01T00:00:00Z", updated_by: "Alex Johnson" }) },
  { pattern: /\/admin\/mfa\/users\//, methods: ["GET"], handler: () => MOCK_ADMIN_MFA_USERS },
  { pattern: /\/admin\/mfa\/audit-logs\//, methods: ["GET"], handler: () => MOCK_ADMIN_MFA_AUDIT_LOGS },
  { pattern: /\/admin\/mfa\/reset\/([^/]+)\//, methods: ["POST"], handler: () => ({ message: "MFA reset successful" }) },
  { pattern: /\/admin\/mfa\/toggle\/([^/]+)\//, methods: ["POST"], handler: () => ({ message: "MFA updated", mfa_enabled: true }) },
  { pattern: /\/auth\/mfa\/status\//, methods: ["GET"], handler: () => ({ mfa_enabled: false, mfa_enrolled_at: null, remaining_backup_codes: 0, org_require_mfa_for_all: false }) },
  { pattern: /\/auth\/mfa\/setup\//, methods: ["POST"], handler: () => ({ secret: "JBSWY3DPEHPK3PXP", qr_code: "data:image/svg+xml;utf8,<svg></svg>", mfa_enabled: false, email: "alex.johnson@nexusdemo.com" }) },
  { pattern: /\/auth\/mfa\/verify-setup\//, methods: ["POST"], handler: () => ({ message: "MFA setup complete", mfa_enabled: true, backup_codes: ["1234-5678", "8765-4321"] }) },
  { pattern: /\/auth\/mfa\/disable\//, methods: ["POST"], handler: () => ({ message: "MFA disabled", mfa_enabled: false }) },
  { pattern: /\/auth\/mfa\/regenerate-backup-codes\//, methods: ["POST"], handler: () => ({ message: "Backup codes regenerated", backup_codes: ["1234-5678", "8765-4321"] }) },
  { pattern: /\/auth\/mfa\/send-email-otp\//, methods: ["POST"], handler: () => ({ message: "OTP sent", masked_email: "a***@nexusdemo.com" }) },
  { pattern: /\/auth\/mfa\/verify-login\//, methods: ["POST"], handler: () => ({ access_token: "mock-access-token", refresh_token: "mock-refresh-token" }) },
  { pattern: /\/auth\/mfa\//, methods: ["GET", "POST"], handler: () => ({ enabled: false, method: null }) },

  // Platform tenants & Plan
  { pattern: /\/platform\/tenants\//, methods: ["GET", "POST", "PATCH"], handler: () => paginate([MOCK_TENANT]) },
  { pattern: /\/plan\//, methods: ["GET"], handler: () => ({
      plan: "enterprise", plan_name: "Enterprise",
      modules: MOCK_TENANT.modules,
      limits: MOCK_TENANT.limits,
      usage: { employees: 8, projects: 5, storage_mb: 245 },
    }),
  },

  // Browser push / SMTP / Notification config / Master Divisions
  { pattern: /\/master\/divisions\//, methods: ["GET"], handler: () => paginate(MOCK_MASTER.departments) },
  { pattern: /\/master\/smtp-config\//, methods: ["GET", "PATCH", "POST"], handler: () => ({
      host: "smtp.gmail.com",
      port_encryption: "587_tls",
      email_address: "notifications@nexusdemo.com",
      email_password: "••••••••••••",
      sender_name: "Nexus Hub",
      test_email: "admin@nexusdemo.com",
    }),
  },
  { pattern: /\/master\/smtp-test\//, methods: ["POST"], handler: () => ({ success: true, message: "Test email sent successfully" }) },
  { pattern: /\/notification-config\//, methods: ["GET", "PATCH"], handler: () => ({}) },
  { pattern: /\/smtp-config\//, methods: ["GET", "PATCH"], handler: () => ({
      host: "smtp.gmail.com",
      port_encryption: "587_tls",
      email_address: "notifications@nexusdemo.com",
      email_password: "••••••••••••",
      sender_name: "Nexus Hub",
      test_email: "admin@nexusdemo.com",
    }),
  },
  { pattern: /\/browser-push-config\//, methods: ["GET", "PATCH"], handler: () => ({}) },

  // Global search
  { pattern: /\/search\//, methods: ["GET"], handler: () => ({
      employees: MOCK_EMPLOYEES.slice(0, 3).map(e => ({ id: e.id, name: e.full_name, type: "employee" })),
      projects: MOCK_PROJECTS.slice(0, 3).map(p => ({ id: p.id, name: p.name, type: "project" })),
      tickets: MOCK_TICKETS.slice(0, 3).map(t => ({ id: t.id, name: t.title, type: "ticket" })),
    }),
  },

  // Signaling / WebRTC (no-op)
  { pattern: /\/signaling\//, methods: ["GET", "POST"], handler: () => ({}) },

  // Catch-all — return empty paginated
  { pattern: /.*/, methods: ["GET", "POST", "PATCH", "PUT", "DELETE"], handler: (_url, method, data) => {
      if (method === "DELETE") return {};
      if (method === "POST") return { id: `mock-${Date.now()}`, ...data };
      if (method === "PATCH" || method === "PUT") return { id: `mock-${Date.now()}`, ...data };
      return paginate([]);
    },
  },
];

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function handleMockRequest(
  url: string,
  method: string,
  data?: any,
): Promise<any> {
  // Strip base path to get the endpoint path
  const cleanUrl = url.replace(/^.*\/api\/v\d\//, "/").replace(/^.*\/api\//, "/");
  const pathOnly = cleanUrl.split("?")[0];
  const pathWithSlash = pathOnly.endsWith("/") ? pathOnly : `${pathOnly}/`;
  const pathWithoutSlash = pathOnly.replace(/\/$/, "");

  for (const route of routes) {
    if (
      route.methods.includes(method.toUpperCase()) &&
      (
        route.pattern.test(cleanUrl) ||
        route.pattern.test(pathOnly) ||
        route.pattern.test(pathWithSlash) ||
        route.pattern.test(pathWithoutSlash)
      )
    ) {
      const urlForHandler = cleanUrl.includes("?") ? cleanUrl : pathWithSlash;
      const result = route.handler(urlForHandler, method.toUpperCase(), data);
      return delay(result);
    }
  }
  return delay(paginate([]));
}

export { MOCK_USER, MOCK_PERMISSIONS, MOCK_TENANT };
