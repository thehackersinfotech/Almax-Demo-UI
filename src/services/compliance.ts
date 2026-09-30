import { get, post, patch, del, upload } from "./api";

// ── HR Compliance Documents ────────────────────────────────────────────────────

export type DocumentType = "NDA" | "UNDERTAKING" | "OFFER" | "POLICY" | "OTHER";

export interface HRComplianceDocument {
  id: string;
  employee: string;
  employee_name: string;
  document_type: DocumentType;
  document_type_display: string;
  title: string;
  description: string;
  effective_date: string | null;
  version: string;
  file: string | null;
  file_url: string | null;
  is_acknowledged: boolean;
  acknowledged_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRComplianceCreatePayload {
  employee: string;
  document_type: DocumentType;
  title: string;
  description?: string;
  effective_date?: string | null;
  version?: string;
  file: File;
}

export const hrComplianceApi = {
  list: (params?: { employee?: string; document_type?: string }) =>
    get<HRComplianceDocument[]>("/hr-compliance/", { params }),

  create: (formData: FormData) =>
    upload<HRComplianceDocument>("/hr-compliance/", formData),

  update: (id: string, data: Partial<HRComplianceDocument>) =>
    patch<HRComplianceDocument>(`/hr-compliance/${id}/`, data),

  delete: (id: string) => del(`/hr-compliance/${id}/`),

  acknowledge: (id: string, acknowledgedDate: string) =>
    patch<HRComplianceDocument>(`/hr-compliance/${id}/`, {
      is_acknowledged: true,
      acknowledged_date: acknowledgedDate,
    }),
};

// ── Policy Documents ───────────────────────────────────────────────────────────

export interface PolicyDocument {
  id: string;
  title: string;
  version: string;
  description: string;
  effective_date: string | null;
  file: string | null;
  file_url: string | null;
  is_published: boolean;
  is_active: boolean;
  created_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
  // Acknowledgment fields (injected by list endpoint)
  is_acknowledged_by_me?: boolean;
  acknowledgment_count?: number;
}

export interface PolicyAcknowledgment {
  id: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  profile_picture_url?: string | null;
  acknowledged_at: string;
}

export const policyApi = {
  list: () => get<PolicyDocument[]>("/policy-documents/"),

  create: (formData: FormData) =>
    upload<PolicyDocument>("/policy-documents/", formData),

  update: (id: string, data: Partial<PolicyDocument>) =>
    patch<PolicyDocument>(`/policy-documents/${id}/`, data),

  delete: (id: string) => del(`/policy-documents/${id}/`),

  togglePublish: (id: string, isPublished: boolean) =>
    patch<PolicyDocument>(`/policy-documents/${id}/`, { is_published: isPublished }),

  acknowledge: (id: string) =>
    post<{ acknowledged: boolean; created: boolean }>(`/policy-documents/${id}/acknowledge/`, {}),

  getAcknowledgments: (id: string) =>
    get<PolicyAcknowledgment[]>(`/policy-documents/${id}/acknowledgments/`),
};

export const DOCUMENT_TYPE_OPTIONS: { label: string; value: DocumentType }[] = [
  { label: "Non-Disclosure Agreement (NDA)", value: "NDA" },
  { label: "Undertaking", value: "UNDERTAKING" },
  { label: "Offer Letter", value: "OFFER" },
  { label: "Internal Policy", value: "POLICY" },
  { label: "Other", value: "OTHER" },
];
