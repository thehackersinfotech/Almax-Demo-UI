import { get, post, patch, del } from "./api";
import { API_BASE, ENDPOINTS } from "@/constants/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocumentType =
  | "quotation"
  | "proforma_invoice"
  | "gst_invoice"
  | "purchase_order"
  | "receipt";

export type DocumentStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "generated"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "cancelled";

export interface DocumentLineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  gst_percentage: number;
  amount?: number;
  sort_order?: number;
}

export interface FinanceDocument {
  id: string;
  document_number: string;
  document_type: DocumentType;
  document_type_display: string;
  client: string;
  client_name: string;
  client_email: string;
  client_gst_number: string;
  billing_address: string;
  shipping_address: string;
  project?: string;
  project_name?: string;
  division?: string;
  division_name?: string;
  currency: string;
  status: DocumentStatus;
  status_display: string;
  valid_until?: string;
  notes: string;
  subtotal: string;
  gst_amount: string;
  total_amount: string;
  line_items?: DocumentLineItem[];
  created_at: string;
  updated_at: string;
}

export interface DocumentFormData {
  document_type: DocumentType;
  client: string;
  project?: string | null;
  division?: string | null;
  currency: string;
  status: DocumentStatus;
  valid_until?: string | null;
  notes?: string;
  billing_address?: string;
  shipping_address?: string;
  line_items: DocumentLineItem[];
}

export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ClientDropdownItem {
  id: string;
  name: string;
  code: string;
  client_name?: string;
  project_name?: string;
  display_name?: string;
  contact_email?: string;
  gst_number?: string;
  address?: string;
  formatted_address?: string;
}

export interface ProjectDropdownItem {
  id: string;
  name: string;
  code: string;
  client?: string;
  client_name?: string;
}

export interface DivisionDropdownItem {
  id: string;
  name: string;
  city?: string;
  state?: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────

export const ALLOWED_STATUSES: Record<DocumentType, DocumentStatus[]> = {
  quotation:        ["draft", "sent", "accepted", "rejected", "expired"],
  proforma_invoice: ["draft", "generated", "sent", "paid", "partially_paid", "overdue", "cancelled"],
  gst_invoice:      ["draft", "generated", "sent", "paid", "partially_paid", "overdue", "cancelled"],
  purchase_order:   ["draft", "sent", "accepted", "rejected", "expired"],
  receipt:          ["draft", "generated", "sent"],
};

export const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft:          "default",
  sent:           "processing",
  accepted:       "success",
  rejected:       "error",
  expired:        "warning",
  generated:      "processing",
  paid:           "success",
  partially_paid: "warning",
  overdue:        "error",
  cancelled:      "default",
};

/** Visual tokens for status pills (list + dropdown). */
export const STATUS_STYLE: Record<
  DocumentStatus,
  { label: string; dot: string; bg: string; border: string; text: string }
> = {
  draft:          { label: "Draft",          dot: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", text: "#374151" },
  sent:           { label: "Sent",           dot: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  accepted:       { label: "Accepted",       dot: "#059669", bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  rejected:       { label: "Rejected",       dot: "#dc2626", bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" },
  expired:        { label: "Expired",        dot: "#d97706", bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  generated:      { label: "Generated",      dot: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", text: "#0e7490" },
  paid:           { label: "Paid",           dot: "#059669", bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  partially_paid: { label: "Partially Paid", dot: "#d97706", bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  overdue:        { label: "Overdue",        dot: "#dc2626", bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" },
  cancelled:      { label: "Cancelled",      dot: "#6b7280", bg: "#f3f4f6", border: "#d1d5db", text: "#4b5563" },
};

export function formatDocumentStatusLabel(status: DocumentStatus): string {
  return STATUS_STYLE[status]?.label ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  quotation:        "Quotation",
  proforma_invoice: "Proforma Invoice",
  gst_invoice:      "GST Invoice",
  purchase_order:   "Purchase Order",
  receipt:          "Receipt",
};

// ── API ───────────────────────────────────────────────────────────────────────

export const financeApi = {
  list: (params?: Record<string, unknown>) =>
    get<PaginatedResponse<FinanceDocument>>(ENDPOINTS.FINANCE_DOCUMENTS, params),

  get: (id: string) =>
    get<FinanceDocument>(`${ENDPOINTS.FINANCE_DOCUMENTS}${id}/`),

  create: (data: DocumentFormData) =>
    post<FinanceDocument>(ENDPOINTS.FINANCE_DOCUMENTS, data),

  update: (id: string, data: Partial<DocumentFormData>) =>
    patch<FinanceDocument>(`${ENDPOINTS.FINANCE_DOCUMENTS}${id}/`, data),

  delete: (id: string) =>
    del(`${ENDPOINTS.FINANCE_DOCUMENTS}${id}/`),

  updateStatus: (id: string, status: DocumentStatus) =>
    patch<{ status: DocumentStatus; status_display: string }>(
      `${ENDPOINTS.FINANCE_DOCUMENTS}${id}/status/`,
      { status }
    ),

  /** Returns URL for iframe/window preview — requires same-origin auth fetch */
  previewUrl: (id: string) =>
    `${API_BASE}${ENDPOINTS.FINANCE_DOCUMENTS}${id}/preview/`,

  pdfUrl: (id: string) =>
    `${API_BASE}${ENDPOINTS.FINANCE_DOCUMENTS}${id}/pdf/`,

  clientsDropdown: () =>
    get<ClientDropdownItem[]>(ENDPOINTS.FINANCE_CLIENTS_DROPDOWN),

  projectsDropdown: (clientId?: string) =>
    get<ProjectDropdownItem[]>(
      ENDPOINTS.FINANCE_PROJECTS_DROPDOWN,
      clientId ? { client: clientId } : undefined
    ),

  divisionsDropdown: () =>
    get<DivisionDropdownItem[]>(ENDPOINTS.FINANCE_DIVISIONS_DROPDOWN),
};
