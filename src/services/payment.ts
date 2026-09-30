import { get, post, patch, del, upload } from "./api";
import { ENDPOINTS } from "@/constants/api";
import type { ProjectBillingSummary } from "./projects";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type InvoiceType = "ADVANCE" | "MILESTONE" | "FINAL" | "PROFORMA" | "REGULAR";

export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

export type MilestoneStatus = "PENDING" | "INVOICED" | "PAID";

export type PaymentMode =
  | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "CASH"
  | "ONLINE_GATEWAY" | "NEFT" | "RTGS";

export interface Milestone {
  id: string;
  project: string;
  project_name: string;
  project_code: string;
  milestone_name: string;
  description: string;
  percentage: number;
  amount: number;
  due_date: string | null;
  sequence: number;
  status: MilestoneStatus;
  status_label: string;
  invoice_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocation {
  id: string;
  payment: string;
  payment_reference: string;
  invoice: string;
  invoice_number: string;
  allocated_amount: number;
  notes: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  invoice_type_label: string;
  invoice_date: string;
  due_date: string | null;
  client: string;
  client_name: string;
  project: string | null;
  project_name: string | null;
  project_code: string | null;
  milestone: string | null;
  milestone_name: string | null;
  invoice_amount: number;
  tax_percentage: number;
  tax_amount: number;
  total_amount: number;
  received_amount: number;
  pending_amount: number;
  status: InvoiceStatus;
  days_overdue: number;
  notes: string;
  attachment: string | null;
  is_cancelled: boolean;
  allocations?: PaymentAllocation[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  payment_reference: string;
  payment_date: string;
  client: string;
  client_name: string;
  project: string | null;
  project_name: string | null;
  project_code: string | null;
  payment_amount: number;
  payment_mode: PaymentMode;
  payment_mode_label: string;
  bank_reference: string;
  remarks: string;
  attachment: string | null;
  allocated_amount: number;
  unallocated_amount: number;
  allocations?: PaymentAllocation[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardKPI {
  total_receivable: number;
  total_received: number;
  total_invoiced: number;
  partial_count: number;
  overdue_amount: number;
  overdue_count: number;
  collection_pct: number;
}

export interface MonthlyTrend {
  month: string;
  label: string;
  collected: number;
  invoiced: number;
}

export interface DashboardData {
  kpi: DashboardKPI;
  monthly_trend: MonthlyTrend[];
}

export interface ClientReceivable {
  client_id: string;
  client_name: string;
  total_invoiced: number;
  total_received: number;
  total_pending: number;
  overdue_amount: number;
  invoice_count: number;
  collection_pct: number;
  avg_collection_days: number | null;
}

export interface ProjectReceivable {
  project_id: string;
  project_name: string;
  project_code: string;
  client_name: string;
  total_invoiced: number;
  total_received: number;
  total_pending: number;
  overdue_amount: number;
  invoice_count: number;
  collection_pct: number;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone API
// ─────────────────────────────────────────────────────────────────────────────

export const milestonesApi = {
  list:   (params?: Record<string, unknown>) =>
    get<PaginatedResponse<Milestone>>(ENDPOINTS.PAYMENT_MILESTONES, params),
  get:    (id: string) =>
    get<Milestone>(`${ENDPOINTS.PAYMENT_MILESTONES}${id}/`),
  create: (data: Partial<Milestone>) =>
    post<Milestone>(ENDPOINTS.PAYMENT_MILESTONES, data),
  update: (id: string, data: Partial<Milestone>) =>
    patch<Milestone>(`${ENDPOINTS.PAYMENT_MILESTONES}${id}/`, data),
  delete: (id: string) =>
    del(`${ENDPOINTS.PAYMENT_MILESTONES}${id}/`),
  generateInvoice: (id: string) =>
    post<{ detail: string; invoice_number: string }>(
      `${ENDPOINTS.PAYMENT_MILESTONES}${id}/generate-invoice/`
    ),
  budgetSummary: (projectId: string) =>
    get<ProjectBillingSummary>(
      `${ENDPOINTS.PAYMENT_MILESTONES}budget-summary/`,
      { project: projectId },
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Invoice API
// ─────────────────────────────────────────────────────────────────────────────

export const invoicesApi = {
  list:   (params?: Record<string, unknown>) =>
    get<PaginatedResponse<Invoice>>(ENDPOINTS.PAYMENT_INVOICES, params),
  get:    (id: string) =>
    get<Invoice>(`${ENDPOINTS.PAYMENT_INVOICES}${id}/`),
  create: (data: FormData | Record<string, unknown>) =>
    data instanceof FormData
      ? upload<Invoice>(ENDPOINTS.PAYMENT_INVOICES, data)
      : post<Invoice>(ENDPOINTS.PAYMENT_INVOICES, data),
  update: (id: string, data: Partial<Invoice>) =>
    patch<Invoice>(`${ENDPOINTS.PAYMENT_INVOICES}${id}/`, data),
  delete: (id: string) =>
    del(`${ENDPOINTS.PAYMENT_INVOICES}${id}/`),
  cancel: (id: string) =>
    post<{ detail: string }>(`${ENDPOINTS.PAYMENT_INVOICES}${id}/cancel/`),
  receivableSummary: (params?: Record<string, unknown>) =>
    get<{
      total_invoiced: number; total_received: number; total_pending: number;
      overdue_amount: number; overdue_count: number; partial_count: number;
      collection_pct: number;
    }>(`${ENDPOINTS.PAYMENT_INVOICES}receivable-summary/`, params),
};

// ─────────────────────────────────────────────────────────────────────────────
// Payment API
// ─────────────────────────────────────────────────────────────────────────────

export const paymentsApi = {
  list:   (params?: Record<string, unknown>) =>
    get<PaginatedResponse<Payment>>(ENDPOINTS.PAYMENT_PAYMENTS, params),
  get:    (id: string) =>
    get<Payment>(`${ENDPOINTS.PAYMENT_PAYMENTS}${id}/`),
  create: (data: FormData | Record<string, unknown>) =>
    data instanceof FormData
      ? upload<Payment>(ENDPOINTS.PAYMENT_PAYMENTS, data)
      : post<Payment>(ENDPOINTS.PAYMENT_PAYMENTS, data),
  update: (id: string, data: Partial<Payment>) =>
    patch<Payment>(`${ENDPOINTS.PAYMENT_PAYMENTS}${id}/`, data),
  delete: (id: string) =>
    del(`${ENDPOINTS.PAYMENT_PAYMENTS}${id}/`),
  allocate: (id: string, data: { invoice: string; allocated_amount: number; notes?: string }) =>
    post<{ detail: string; allocated_amount: number }>(
      `${ENDPOINTS.PAYMENT_PAYMENTS}${id}/allocate/`, data
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Reports & Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export const paymentReportsApi = {
  dashboard: () =>
    get<DashboardData>(ENDPOINTS.PAYMENT_DASHBOARD),
  clientReceivable: () =>
    get<{ results: ClientReceivable[]; count: number }>(ENDPOINTS.PAYMENT_CLIENT_REPORT),
  projectReceivable: () =>
    get<{ results: ProjectReceivable[]; count: number }>(ENDPOINTS.PAYMENT_PROJECT_REPORT),
};
