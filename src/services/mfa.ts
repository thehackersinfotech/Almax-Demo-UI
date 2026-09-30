import { get, post, put } from "@/services/api";

export interface MfaStatusResponse {
  mfa_enabled: boolean;
  mfa_enrolled_at: string | null;
  remaining_backup_codes: number;
  org_require_mfa_for_all: boolean;
}

export interface MfaSetupResponse {
  secret: string;
  qr_code: string;
  mfa_enabled: boolean;
  email: string;
  issuer?: string;
}

export interface MfaVerifySetupResponse {
  message: string;
  mfa_enabled: boolean;
  backup_codes: string[];
}

export interface AdminMfaPolicyResponse {
  require_mfa_for_all: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export interface AdminMfaUserItem {
  id: string;
  employee_code: string;
  username: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  profile_picture_url: string | null;
  mfa_enabled: boolean;
  mfa_enrolled_at: string | null;
  remaining_backup_codes: number;
  is_locked: boolean;
}

export interface AdminMfaAuditLogItem {
  id: string;
  action: string;
  action_display: string;
  user_id: string | null;
  user_name: string;
  performed_by_id: string | null;
  performed_by_name: string | null;
  ip_address: string | null;
  details: Record<string, any>;
  created_at: string;
}

export const mfaApi = {
  getStatus: () => get<MfaStatusResponse>("/auth/mfa/status/"),

  setup: () => post<MfaSetupResponse>("/auth/mfa/setup/", {}),

  verifySetup: (code: string) => post<MfaVerifySetupResponse>("/auth/mfa/verify-setup/", { code }),

  disable: (password: string, code: string) =>
    post<{ message: string; mfa_enabled: boolean }>("/auth/mfa/disable/", { password, code }),

  regenerateBackupCodes: (password: string, code: string) =>
    post<{ message: string; backup_codes: string[] }>("/auth/mfa/regenerate-backup-codes/", { password, code }),

  sendEmailOtp: (mfa_token: string) =>
    post<{ message: string; masked_email: string }>("/auth/mfa/send-email-otp/", { mfa_token }),

  verifyLogin: (mfa_token: string, code: string) =>
    post<any>("/auth/mfa/verify-login/", { mfa_token, code }),

  // Admin endpoints (Master Settings)
  getAdminPolicy: () => get<AdminMfaPolicyResponse>("/admin/mfa/policy/"),

  updateAdminPolicy: (require_mfa_for_all: boolean) =>
    put<{ message: string; require_mfa_for_all: boolean; updated_at: string; updated_by: string }>(
      "/admin/mfa/policy/",
      { require_mfa_for_all }
    ),

  getAdminUsers: () => get<AdminMfaUserItem[]>("/admin/mfa/users/"),

  adminResetUser: (userId: string, adminPassword: string) =>
    post<{ message: string }>(`/admin/mfa/reset/${userId}/`, { admin_password: adminPassword }),

  toggleUserMfa: (userId: string, enable: boolean) =>
    post<{ message: string; mfa_enabled: boolean }>(`/admin/mfa/toggle/${userId}/`, { enable }),

  getAdminAuditLogs: () => get<AdminMfaAuditLogItem[]>("/admin/mfa/audit-logs/"),
};
