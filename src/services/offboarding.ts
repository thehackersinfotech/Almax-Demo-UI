import client from "@/services/api";

export interface NoticePeriodPolicy {
  id: string;
  name: string;
  notice_period_days: number;
  is_default: boolean;
  is_active: boolean;
}

export interface OffboardingStepLog {
  id: string;
  step_number: number;
  step_name: string;
  status: "pending" | "in_progress" | "completed" | "bypassed";
  notes?: string;
  action_by?: string;
  completed_at?: string;
}

export interface OffboardingKTItem {
  id: string;
  topic: string;
  details?: string;
  git_links?: string;
  file_name?: string;
  file_url?: string;
  submitted_to_id?: string;
  submitted_to_name?: string;
  status: string;
  created_at: string;
}

export interface ExitInterviewAnswer {
  id: string;
  answer_text: string;
  submitted_at: string;
}

export interface ExitInterviewQuestion {
  id: string;
  question_text: string;
  order: number;
  answers?: ExitInterviewAnswer[];
}

export interface OffboardingRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  designation: string;
  joining_date?: string;
  reporting_manager_id?: string;
  reporting_manager_name?: string;
  resignation_date: string;
  notice_period_days: number;
  proposed_lwd: string;
  pm_approved_lwd?: string;
  hr_approved_lwd?: string;
  approved_lwd?: string;
  reason: string;
  resignation_proof_url?: string;
  current_step: number; // 1..10
  current_step_display?: string;
  status: "submitted" | "pm_review" | "hr_review" | "task_setup" | "kt_in_progress" | "exit_interview" | "assets_return" | "documents_issued" | "finance_clearance" | "completed" | "rejected";
  status_display?: string;
  hr_approved?: boolean;
  finance_clearance_required?: boolean;
  it_assets_revoke_requested?: boolean;
  it_assets_revoked?: boolean;
  documents_issued?: boolean;
  task_setup_confirmed?: boolean;
  pm_kt_acknowledged?: boolean;
  hr_kt_acknowledged?: boolean;
  exit_interview_sent?: boolean;
  exit_interview_completed?: boolean;
  exit_interview_approved?: boolean;
  finance_cleared?: boolean;
  finance_base_salary?: number;
  finance_additions?: number;
  finance_deductions?: number;
  finance_net_amount?: number;
  finance_notes?: string;
  pm_notes?: string;
  hr_notes?: string;
  created_at: string;
  step_logs?: OffboardingStepLog[];
  kt_items?: OffboardingKTItem[];
  exit_questions?: ExitInterviewQuestion[];
}

export const offboardingApi = {
  async getNoticePeriodPolicy(): Promise<NoticePeriodPolicy> {
    const res = await client.get("/offboarding/notice-period-policy/");
    const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
    return list[0] || { id: "1", name: "Standard Notice Period", notice_period_days: 60, is_default: true, is_active: true };
  },

  async updateNoticePeriodPolicy(days: number): Promise<NoticePeriodPolicy> {
    const res = await client.post("/offboarding/notice-period-policy/", {
      name: "Standard Notice Period",
      notice_period_days: days,
      is_default: true,
      is_active: true,
    });
    return res.data;
  },

  async getRequests(params?: { employee_id?: string; reporting_manager_id?: string; status?: string; hr_mode?: string }): Promise<OffboardingRequest[]> {
    const res = await client.get("/offboarding/requests/", { params });
    return Array.isArray(res.data) ? res.data : res.data?.results || [];
  },

  async submitResignation(data: {
    employee_id: string;
    employee_name: string;
    employee_code?: string;
    department?: string;
    designation?: string;
    joining_date?: string;
    reporting_manager_id?: string;
    reporting_manager_name?: string;
    resignation_date: string;
    proposed_lwd?: string;
    reason: string;
    resignation_proof_url?: string;
  }): Promise<OffboardingRequest> {
    const res = await client.post("/offboarding/requests/", data);
    return res.data;
  },

  async updateResignationProof(id: string, proofUrl: string): Promise<OffboardingRequest> {
    const res = await client.patch(`/offboarding/requests/${id}/`, { resignation_proof_url: proofUrl });
    return res.data;
  },

  async pmReviewLwd(id: string, pm_approved_lwd: string, pm_notes?: string, pm_name?: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/pm_review_lwd/`, {
      pm_approved_lwd,
      pm_notes,
      pm_name,
    });
    return res.data;
  },

  async hrApproveRequest(id: string, hr_approved_lwd: string, hr_notes?: string, hr_name?: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/hr_approve_request/`, {
      hr_approved_lwd,
      hr_notes,
      hr_name,
    });
    return res.data;
  },

  async confirmTaskSetup(id: string, finance_clearance_required: boolean, it_assets_revoke_requested: boolean, hr_name?: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/confirm_task_setup/`, {
      finance_clearance_required,
      it_assets_revoke_requested,
      hr_name,
    });
    return res.data;
  },

  async submitKt(
    id: string,
    topic: string,
    details?: string,
    submitted_to_id?: string,
    submitted_to_name?: string,
    git_links?: string,
    file_name?: string,
    file_url?: string
  ): Promise<OffboardingKTItem> {
    const res = await client.post(`/offboarding/requests/${id}/submit_kt/`, {
      topic,
      details,
      submitted_to_id,
      submitted_to_name,
      git_links,
      file_name,
      file_url,
    });
    return res.data;
  },

  async acknowledgeKtPm(id: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/acknowledge_kt_pm/`);
    return res.data;
  },

  async acknowledgeKtHr(id: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/acknowledge_kt_hr/`);
    return res.data;
  },

  async sendExitQuestions(id: string, questions: string[]): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/send_exit_questions/`, { questions });
    return res.data;
  },

  async addExitQuestion(id: string, question_text: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/add_exit_question/`, { question_text });
    return res.data;
  },

  async submitExitAnswers(id: string, answers: { question_id: string; answer_text: string }[]): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/submit_exit_answers/`, { answers });
    return res.data;
  },

  async approveExitInterview(id: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/approve_exit_interview/`);
    return res.data;
  },

  async confirmAssetRevoke(id: string, action_by?: string, notes?: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/confirm_asset_revoke/`, { action_by, notes });
    return res.data;
  },

  async issueDocuments(id: string, action_by?: string, notes?: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/issue_documents/`, { action_by, notes });
    return res.data;
  },

  async completeFinanceClearance(
    id: string,
    data: {
      action_by?: string;
      notes?: string;
      base_salary?: number;
      additions?: number;
      deductions?: number;
      net_amount?: number;
    }
  ): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/complete_finance_clearance/`, data);
    return res.data;
  },

  async hrConfirmFinance(id: string, action_by?: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/hr_confirm_finance/`, { action_by });
    return res.data;
  },

  async advanceStep(id: string, target_step: number, notes?: string, action_by?: string): Promise<OffboardingRequest> {
    const res = await client.post(`/offboarding/requests/${id}/advance_step/`, {
      target_step,
      notes,
      action_by,
    });
    return res.data;
  },
};

