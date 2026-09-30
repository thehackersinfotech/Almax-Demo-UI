import { offboardingApi, type OffboardingRequest, type NoticePeriodPolicy, type OffboardingKTItem, type ExitInterviewQuestion } from "@/services/offboarding";
import { useAuthStore } from "@/store/auth";

const STORE_KEY = "bms_offboarding_store_v1";

interface StoreData {
  requests: OffboardingRequest[];
  noticeDays: number;
}

function load(): StoreData {
  try {
    const raw = localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { requests: [], noticeDays: 60 };
}

function save(data: StoreData) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    sessionStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

const listeners: Array<() => void> = [];
function notify() {
  listeners.forEach((fn) => fn());
}

/** Trigger local notification for top Bell Icon dropdown */
function triggerNotification(payload: {
  event_type: string;
  title: string;
  message: string;
  reference_id: string;
  severity: "info" | "warning" | "urgent";
}) {
  try {
    const raw = localStorage.getItem("bms_it_asset_notifications") || sessionStorage.getItem("bms_it_asset_notifications");
    const list = raw ? JSON.parse(raw) : [];

    const notif = {
      ...payload,
      id: `off-notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      is_read: false,
      read_at: null,
      actor_name: useAuthStore.getState().user?.full_name || "System",
      created_at: new Date().toISOString(),
    };

    list.push(notif);
    localStorage.setItem("bms_it_asset_notifications", JSON.stringify(list));
    sessionStorage.setItem("bms_it_asset_notifications", JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("local-notifications-updated"));
  } catch { /* ignore */ }
}

export const offboardingStore = {
  subscribe(fn: () => void): () => void {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },

  getNoticeDays(): number {
    return load().noticeDays || 60;
  },

  setNoticeDays(days: number) {
    const data = load();
    data.noticeDays = Number(days) || 60;
    save(data);
    notify();
  },

  getRequests(): OffboardingRequest[] {
    return load().requests;
  },

  getRequestByEmployeeId(empId: string): OffboardingRequest | undefined {
    const list = load().requests;
    // Match by employee_id OR employee_code — never fall back to a random item
    return list.find(
      (r) =>
        String(r.employee_id) === String(empId) ||
        String(r.employee_code) === String(empId)
    );
  },

  async syncWithBackend(): Promise<void> {
    try {
      const [policy, requests] = await Promise.all([
        offboardingApi.getNoticePeriodPolicy(),
        offboardingApi.getRequests(),
      ]);
      const data = load();
      if (policy && policy.notice_period_days) {
        data.noticeDays = Number(policy.notice_period_days);
      }
      if (requests && requests.length > 0) {
        data.requests = requests;
      }
      save(data);
      notify();
    } catch (e) {
      console.warn("Offboarding backend sync notice:", e);
    }
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
    const created = await offboardingApi.submitResignation(data);
    const currentData = load();
    const existingIdx = currentData.requests.findIndex((r) => r.id === created.id || String(r.employee_id) === String(data.employee_id));
    if (existingIdx !== -1) {
      currentData.requests[existingIdx] = created;
    } else {
      currentData.requests.unshift(created);
    }
    save(currentData);
    notify();

    triggerNotification({
      event_type: "employee.resignation_submitted",
      title: "New Resignation Request",
      message: `Resignation submitted by ${data.employee_name} (${data.employee_code || data.employee_id}). Pending Project Manager review.`,
      reference_id: created.id,
      severity: "warning",
    });

    return created;
  },

  async updateResignationProof(id: string, proofUrl: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.updateResignationProof(id, proofUrl);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }
    return updated;
  },

  async pmReviewLwd(id: string, pm_approved_lwd: string, pm_notes?: string, pm_name?: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.pmReviewLwd(id, pm_approved_lwd, pm_notes, pm_name);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.pm_lwd_approved",
      title: "PM Reviewed LWD & Sent to HR",
      message: `Project Manager ${pm_name || ""} reviewed & approved LWD (${pm_approved_lwd}) for ${updated.employee_name}. Sent to HR for approval.`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async hrApproveRequest(id: string, hr_approved_lwd: string, hr_notes?: string, hr_name?: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.hrApproveRequest(id, hr_approved_lwd, hr_notes, hr_name);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.hr_resignation_approved",
      title: "HR Approved Resignation",
      message: `HR ${hr_name || ""} approved resignation & final LWD (${hr_approved_lwd}) for ${updated.employee_name}. Knowledge Transfer is now unlocked!`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async confirmTaskSetup(id: string, finance_clearance_required: boolean, it_assets_revoke_requested: boolean = true, hr_name?: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.confirmTaskSetup(id, finance_clearance_required, it_assets_revoke_requested, hr_name);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.task_setup_confirmed",
      title: "Task Setup Confirmed",
      message: `Task setup confirmed for ${updated.employee_name}. IT Asset Revoke requested: ${it_assets_revoke_requested ? "Yes" : "No"}. Moved to Knowledge Transfer phase.`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
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
    const item = await offboardingApi.submitKt(
      id,
      topic,
      details,
      submitted_to_id,
      submitted_to_name,
      git_links,
      file_name,
      file_url
    );
    await this.syncWithBackend();

    triggerNotification({
      event_type: "employee.kt_submitted",
      title: "Knowledge Transfer Submitted",
      message: `New KT topic "${topic}" submitted to ${submitted_to_name || "team member"}. Sent to Project Manager for acknowledgment.`,
      reference_id: id,
      severity: "info",
    });

    return item;
  },

  async acknowledgeKtPm(id: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.acknowledgeKtPm(id);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.kt_acknowledged_pm",
      title: "PM Acknowledged Knowledge Transfer",
      message: `Project Manager acknowledged KT for ${updated.employee_name}. Sent to HR for final acknowledgment.`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async acknowledgeKtHr(id: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.acknowledgeKtHr(id);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.kt_acknowledged_hr",
      title: "HR Final Acknowledged KT",
      message: `HR final acknowledged KT for ${updated.employee_name}. Advanced to Exit Interview.`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async sendExitQuestions(id: string, questions: string[]): Promise<OffboardingRequest> {
    const updated = await offboardingApi.sendExitQuestions(id, questions);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.exit_questions_sent",
      title: "Exit Interview Questions Sent",
      message: `HR sent ${questions.length} exit interview questions to ${updated.employee_name}.`,
      reference_id: updated.id,
      severity: "warning",
    });

    return updated;
  },

  async addExitQuestion(id: string, questionText: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.addExitQuestion(id, questionText);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    } else {
      currentData.requests.push(updated);
      save(currentData);
      notify();
    }
    return updated;
  },

  async submitExitAnswers(id: string, answers: { question_id: string; answer_text: string }[]): Promise<OffboardingRequest> {
    const updated = await offboardingApi.submitExitAnswers(id, answers);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.exit_answers_submitted",
      title: "Exit Interview Answers Submitted",
      message: `${updated.employee_name} completed and submitted exit interview responses to HR.`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async approveExitInterview(id: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.approveExitInterview(id);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.exit_interview_approved",
      title: "Exit Interview Approved",
      message: `HR approved exit interview for ${updated.employee_name}. Advanced to IT Assets & Facilities Return.`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async confirmAssetRevoke(id: string, actionBy?: string, notes?: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.confirmAssetRevoke(id, actionBy, notes);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.assets_revoked",
      title: "IT Assets & Facilities Revoked",
      message: `IT Assets & Facilities confirmed revoked for ${updated.employee_name}. Advanced to Documents Issued phase.`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async issueDocuments(id: string, actionBy?: string, notes?: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.issueDocuments(id, actionBy, notes);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.documents_issued",
      title: "Offboarding Documents Issued",
      message: `Relieving letter & Service certificate issued for ${updated.employee_name}. ${updated.finance_clearance_required ? "Advanced to Finance Clearance." : "Offboarding Completed!"}`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async completeFinanceClearance(id: string, data: { actionBy?: string; notes?: string; base_salary?: number; additions?: number; deductions?: number; net_amount?: number }): Promise<OffboardingRequest> {
    const updated = await offboardingApi.completeFinanceClearance(id, {
      action_by: data.actionBy,
      notes: data.notes,
      base_salary: data.base_salary,
      additions: data.additions,
      deductions: data.deductions,
      net_amount: data.net_amount,
    });
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.finance_clearance_submitted",
      title: "Finance Clearance Submitted",
      message: `Finance Admin submitted F&F settlement for ${updated.employee_name}. Awaiting HR confirmation.`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async hrConfirmFinance(id: string, actionBy?: string): Promise<OffboardingRequest> {
    const updated = await offboardingApi.hrConfirmFinance(id, actionBy);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }

    triggerNotification({
      event_type: "employee.offboarding_completed",
      title: "Offboarding Completed 🎉",
      message: `HR confirmed finance clearance. Offboarding for ${updated.employee_name} is fully Completed!`,
      reference_id: updated.id,
      severity: "info",
    });

    return updated;
  },

  async advanceStep(id: string, targetStep: number, notes?: string, actionBy?: string): Promise<OffboardingRequest | null> {
    const updated = await offboardingApi.advanceStep(id, targetStep, notes, actionBy);
    const currentData = load();
    const idx = currentData.requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      currentData.requests[idx] = updated;
      save(currentData);
      notify();
    }
    return updated;
  },
};


// Note: syncWithBackend() is called inside components when the user is authenticated.
// Do NOT call it here at module init — it would fire unauthenticated requests and
// trigger the 401 redirect loop (window.location.href = "/bms/login") before login.
