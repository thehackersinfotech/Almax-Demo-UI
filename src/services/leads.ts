import { get, post, patch, del, upload } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | "new_lead"
  | "contacted"
  | "proposal_sent"
  | "qualified"
  | "converted"
  | "lost";

export type LeadPriority = "low" | "medium" | "high";
export type FollowUpType = "CALL" | "MESSAGE" | "MEETING" | "EMAIL";

export interface Lead {
  id: string;
  institution_name: string;   // Project Name
  client_name: string;         // Client Name
  company: string;
  college_department: string;
  contact_person: string;
  designation: string;
  phone: string;               // Mobile Number
  whatsapp: string;
  email: string;
  business_type?: string | null;
  business_type_name?: string;
  billing_type?: string | null;
  billing_type_name?: string;
  expected_deal_value: string;
  next_followup_date: string | null;
  training_requirements: string;
  status: LeadStatus;
  priority: LeadPriority;
  is_converted: boolean;
  converted_client: string | null;
  converted_client_name: string;
  is_kicked_off?: boolean;
  kickoff_date?: string | null;
  project_manager?: string | null;
  project_manager_name?: string;
  is_project_completed?: boolean;
  project_completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadPayload {
  institution_name: string;    // Project Name
  client_name?: string;        // Client Name
  company: string;
  college_department?: string;
  contact_person?: string;
  designation?: string;
  phone?: string;              // Mobile Number
  whatsapp?: string;
  email?: string;
  business_type?: string | null;
  billing_type?: string | null;
  expected_deal_value?: number;
  next_followup_date?: string | null;
  training_requirements?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
}

export interface LeadDashboard {
  total: number;
  converted: number;
  pending_followup: number;
  total_expected_value: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  recent_leads?: Lead[];
}

export interface LeadFollowUp {
  id: string;
  lead: string;
  lead_name?: string;
  type: FollowUpType;
  type_display: string;
  title: string;
  date: string;
  time: string | null;
  notes: string;
  order: number;
  is_completed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadTask {
  id: string;
  lead: string;
  lead_name?: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: LeadPriority;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadDocument {
  id: string;
  lead: string;
  lead_name?: string;
  title: string;
  file: string;
  file_url: string;
  original_name: string;
  file_size: number;
  content_type: string;
  created_at: string;
}

export interface CustomFollowUpType {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export const fetchLeadDashboard = (): Promise<LeadDashboard> =>
  get("/leads/dashboard/");

export const fetchLeads = (params?: Record<string, unknown>): Promise<PaginatedResponse<Lead>> =>
  get("/leads/", params);

export const fetchLead = (id: string): Promise<Lead> =>
  get(`/leads/${id}/`);

export const createLead = (data: LeadPayload): Promise<Lead> =>
  post("/leads/", data);

export const updateLead = (id: string, data: Partial<LeadPayload>): Promise<Lead> =>
  patch(`/leads/${id}/`, data);

export const deleteLead = (id: string): Promise<void> =>
  del(`/leads/${id}/`);

export const convertLead = (id: string): Promise<Lead> =>
  post(`/leads/${id}/convert/`);

export const kickoffLead = (id: string): Promise<Lead> =>
  post(`/leads/${id}/kickoff/`);

export const assignProjectManager = (id: string, pmId: string): Promise<Lead> =>
  post(`/leads/${id}/assign-pm/`, { project_manager: pmId });

export interface ProjectManagerUser {
  id: string;
  name: string;
  username: string;
  email: string;
  designation?: string;
  employee_code?: string;
}

export const fetchProjectManagers = (): Promise<ProjectManagerUser[]> =>
  get("/leads/project-managers/");

export const toggleProjectComplete = (id: string): Promise<Lead> =>
  post(`/leads/${id}/toggle-complete/`);

export interface LeadStatusOption {
  value: LeadStatus;
  label: string;
}

export const fetchLeadStatuses = (): Promise<LeadStatusOption[]> =>
  get("/leads/statuses/");

// ─── Follow-ups ───────────────────────────────────────────────────────────────

export const fetchFollowUps = (leadId?: string): Promise<PaginatedResponse<LeadFollowUp>> =>
  get("/lead-followups/", leadId ? { lead: leadId } : undefined);

export const createFollowUp = (data: Partial<LeadFollowUp>): Promise<LeadFollowUp> =>
  post("/lead-followups/", data);

export const updateFollowUp = (id: string, data: Partial<LeadFollowUp>): Promise<LeadFollowUp> =>
  patch(`/lead-followups/${id}/`, data);

export const deleteFollowUp = (id: string): Promise<void> =>
  del(`/lead-followups/${id}/`);

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const fetchTasks = (leadId?: string): Promise<PaginatedResponse<LeadTask>> =>
  get("/lead-tasks/", leadId ? { lead: leadId } : undefined);

export const createTask = (data: Partial<LeadTask>): Promise<LeadTask> =>
  post("/lead-tasks/", data);

export const updateTask = (id: string, data: Partial<LeadTask>): Promise<LeadTask> =>
  patch(`/lead-tasks/${id}/`, data);

export const deleteTask = (id: string): Promise<void> =>
  del(`/lead-tasks/${id}/`);

// ─── Documents ────────────────────────────────────────────────────────────────

export const fetchDocuments = (leadId?: string): Promise<PaginatedResponse<LeadDocument>> =>
  get("/lead-documents/", leadId ? { lead: leadId } : undefined);

export const uploadDocument = (leadId: string, file: File, title?: string): Promise<LeadDocument> => {
  const fd = new FormData();
  fd.append("lead", leadId);
  fd.append("file", file);
  fd.append("title", title || file.name);
  return upload("/lead-documents/", fd);
};

export const deleteDocument = (id: string): Promise<void> =>
  del(`/lead-documents/${id}/`);

// ─── Custom Follow-up Types ───────────────────────────────────────────────────

export const fetchCustomFollowUpTypes = (): Promise<PaginatedResponse<CustomFollowUpType>> =>
  get("/custom-followup-types/");

export const createCustomFollowUpType = (data: { name: string; code?: string; color?: string; icon?: string }): Promise<CustomFollowUpType> =>
  post("/custom-followup-types/", data);

// ─── Sales Management Independent Follow-ups & Documents ───────────────────────

export interface SalesFollowUp {
  id: string;
  lead?: string | null;
  lead_name?: string;
  type: string;
  type_display: string;
  title: string;
  date: string;
  time: string | null;
  notes: string;
  order: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesDocument {
  id: string;
  lead?: string | null;
  lead_name?: string;
  title: string;
  file: string;
  file_url: string;
  original_name: string;
  file_size: number;
  content_type: string;
  created_at: string;
}

export const fetchSalesFollowUps = (leadId?: string): Promise<PaginatedResponse<SalesFollowUp>> =>
  get("/sales-followups/", leadId ? { lead: leadId } : undefined);

export const createSalesFollowUp = (data: Partial<SalesFollowUp>): Promise<SalesFollowUp> =>
  post("/sales-followups/", data);

export const updateSalesFollowUp = (id: string, data: Partial<SalesFollowUp>): Promise<SalesFollowUp> =>
  patch(`/sales-followups/${id}/`, data);

export const deleteSalesFollowUp = (id: string): Promise<void> =>
  del(`/sales-followups/${id}/`);

export const fetchSalesDocuments = (): Promise<PaginatedResponse<SalesDocument>> =>
  get("/sales-documents/");

export const uploadSalesDocument = (file: File, title?: string, leadId?: string): Promise<SalesDocument> => {
  const fd = new FormData();
  if (leadId) fd.append("lead", leadId);
  fd.append("file", file);
  fd.append("title", title || file.name);
  return upload("/sales-documents/", fd);
};

export const deleteSalesDocument = (id: string): Promise<void> =>
  del(`/sales-documents/${id}/`);

