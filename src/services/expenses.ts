import { get, post, patch, del, upload } from "./api";
import { ENDPOINTS } from "@/constants/api";

export interface ExpenseListItem {
  id: string;
  expense_number: string;
  date: string;
  category: string;
  category_label: string;
  description: string;
  amount: number;
  paid_by: string;
  paid_by_name: string;
  project: string | null;
  project_name: string | null;
  project_code: string | null;
  client: string | null;
  client_name: string | null;
  payment_mode: string;
  payment_mode_label: string;
  reference_number: string;
  status: string;
  status_label: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  is_from_reimbursement: boolean;
  reimbursement_claim_number: string | null;
  created_at: string;
}

export interface ExpenseAttachment {
  id: string;
  file: string;
  original_name: string;
  file_size: number;
  content_type: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface ExpenseDetail extends ExpenseListItem {
  attachment: string | null;
  attachments: ExpenseAttachment[];
  rejection_reason: string;
  notes: string;
  is_active: boolean;
  updated_at: string;
}

export interface ExpenseCreate {
  date: string;
  category: string;
  description: string;
  amount: number;
  paid_by: string;
  approved_by?: string | null;
  project?: string | null;
  client?: string | null;
  payment_mode: string;
  reference_number?: string;
  notes?: string;
}

export interface ExpenseSummary {
  total_amount: number;
  total_count: number;
  by_status: Record<string, { count: number; amount: number }>;
}

export interface ExpenseListResponse {
  summary: ExpenseSummary;
  results: ExpenseListItem[];
  count: number;
}

export const expenseApi = {
  list: (params?: Record<string, string>) =>
    get<ExpenseListResponse>(ENDPOINTS.CRM_EXPENSES, params),

  retrieve: (id: string) =>
    get<ExpenseDetail>(`${ENDPOINTS.CRM_EXPENSES}${id}/`),

  create: (data: ExpenseCreate) =>
    post<ExpenseDetail>(ENDPOINTS.CRM_EXPENSES, data),

  update: (id: string, data: Partial<ExpenseCreate>) =>
    patch<ExpenseDetail>(`${ENDPOINTS.CRM_EXPENSES}${id}/`, data),

  delete: (id: string) =>
    del(`${ENDPOINTS.CRM_EXPENSES}${id}/`),

  submit: (id: string) =>
    post<ExpenseDetail>(`${ENDPOINTS.CRM_EXPENSES}${id}/submit/`, {}),

  uploadAttachment: (id: string, formData: FormData) =>
    upload<ExpenseAttachment>(`${ENDPOINTS.CRM_EXPENSES}${id}/attachments/`, formData),

  deleteAttachment: (expenseId: string, attachmentId: string) =>
    del(`${ENDPOINTS.CRM_EXPENSES}${expenseId}/attachments/${attachmentId}/`),

  approve: (id: string) =>
    post<ExpenseDetail>(`${ENDPOINTS.CRM_EXPENSES}${id}/approve/`, {}),

  reject: (id: string, reason: string) =>
    post<ExpenseDetail>(`${ENDPOINTS.CRM_EXPENSES}${id}/reject/`, { reason }),

  reimburse: (id: string) =>
    post<ExpenseDetail>(`${ENDPOINTS.CRM_EXPENSES}${id}/reimburse/`, {}),

  summary: (params?: Record<string, string | number | undefined | null>) =>
    get<{
      total_all_time: number;
      total_this_month: number;
      pending_approval: { count: number; amount: number };
      approved_reimbursed?: { count: number; amount: number };
      by_category: Array<{ category: string; count: number; amount: number }>;
      by_department?: Array<{ department_id: string | null; department_name: string; count: number; amount: number }>;
    }>(ENDPOINTS.CRM_EXPENSE_SUMMARY, params),
};

export interface ReimbursementListItem {
  id: string;
  claim_number: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  department_name: string | null;
  title: string;
  category: string;
  category_label: string;
  description: string;
  project: string | null;
  project_name: string | null;
  project_code: string | null;
  client: string | null;
  client_name: string | null;
  expense_date: string;
  amount_claimed: number;
  payment_method: string;
  payment_method_label: string;
  additional_notes: string;
  status: string;
  status_label: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_comments: string;
  paid_by: string | null;
  paid_by_name: string | null;
  paid_at: string | null;
  linked_expense: string | null;
  created_at: string;
  // Custom workflow engine fields (null when no workflow has been configured)
  workflow_state: string | null;
  workflow_state_name: string | null;
  workflow_state_slug: string | null;
  workflow_state_color: string | null;
  workflow_state_is_final: boolean | null;
  workflow_state_is_initial: boolean | null;
}

export interface ReimbursementAttachment {
  id: string;
  file: string;
  original_name: string;
  file_size: number;
  content_type: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface ReimbursementAuditLog {
  id: number;
  from_status: string;
  from_status_label: string;
  to_status: string;
  to_status_label: string;
  performed_by: string | null;
  performed_by_name: string | null;
  comments: string;
  created_at: string;
}

export interface ReimbursementDetail extends ReimbursementListItem {
  attachment: string | null;
  attachments: ReimbursementAttachment[];
  audit_logs: ReimbursementAuditLog[];
  updated_at: string;
}

export interface ReimbursementCreate {
  title: string;
  category: string;
  description: string;
  project?: string | null;
  client?: string | null;
  expense_date: string;
  amount_claimed: number;
  payment_method: string;
  additional_notes?: string;
}

export interface ReimbursementListResponse {
  summary: {
    total_amount: number;
    total_count: number;
    by_status: Record<string, { count: number; amount: number }>;
  };
  results: ReimbursementListItem[];
  count: number;
}

export interface WorkflowAllowedTransition {
  id: string;
  label: string;
  destination_state: string;
  destination_state_slug: string;
  destination_state_name: string;
  destination_state_color: string;
  is_final: boolean;
  group_names: string[];
}

export const reimbursementApi = {
  list: (params?: Record<string, string | number | undefined | null>) =>
    get<ReimbursementListResponse>(ENDPOINTS.CRM_REIMBURSEMENTS, params),

  retrieve: (id: string) =>
    get<ReimbursementDetail>(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/`),

  create: (data: ReimbursementCreate) =>
    post<ReimbursementDetail>(ENDPOINTS.CRM_REIMBURSEMENTS, data),

  update: (id: string, data: Partial<ReimbursementCreate>) =>
    patch<ReimbursementDetail>(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/`, data),

  delete: (id: string) =>
    del(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/`),

  submit: (id: string) =>
    post<ReimbursementDetail>(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/submit/`, {}),

  /** Approver requests more information — moves claim to INFO_REQUESTED */
  review: (id: string, action_type: "review" | "request_info", comments?: string) =>
    post<ReimbursementDetail>(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/request-info/`, { comments }),

  approve: (id: string, comments?: string) =>
    post<ReimbursementDetail>(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/approve/`, { comments }),

  reject: (id: string, comments: string) =>
    post<ReimbursementDetail>(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/reject/`, { comments }),

  markPaid: (id: string, comments?: string) =>
    post<ReimbursementDetail>(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/mark-paid/`, { comments }),

  uploadAttachment: (id: string, formData: FormData) =>
    upload<ReimbursementAttachment>(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/attachments/`, formData),

  // ── Custom Workflow Engine ─────────────────────────────────────────────────

  /** Returns the list of workflow transitions the current user can execute from the claim's current state. */
  allowedTransitions: (id: string) =>
    get<WorkflowAllowedTransition[]>(`${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/allowed-transitions/`),

  /** Advance the claim to a new custom workflow state (slug), optionally with comments. */
  workflowTransition: (id: string, destination_state: string, comments?: string) =>
    post<{ message: string; claim: ReimbursementDetail; workflow_state: string | null; workflow_state_name: string | null; workflow_state_slug: string | null; workflow_state_color: string | null; workflow_state_is_final: boolean | null; linked_expense: string | null; }>(
      `${ENDPOINTS.CRM_REIMBURSEMENTS}${id}/transition/`,
      { destination_state, comments: comments ?? "" },
    ),
};

