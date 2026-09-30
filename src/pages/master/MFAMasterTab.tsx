import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Switch,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Input,
  Modal,
  Form,
  Avatar,
  Alert,
  Tabs,
  message,
  Select,
  Spin,
} from "antd";
import {
  SafetyCertificateOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  KeyOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuthStore } from "@/store/auth";
import { mfaApi, type AdminMfaUserItem, type AdminMfaAuditLogItem } from "@/services/mfa";
import { apiErrorMsg } from "@/utils/apiError";

const { Text, Paragraph, Title } = Typography;

export default function MFAMasterTab() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  // Check if logged-in user is Admin or CEO
  const isAdminOrCeo = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.is_pmo || currentUser.is_superuser || currentUser.is_staff || currentUser.is_system_account) return true;
    const kg = (currentUser.keycloak_group ?? "").toLowerCase();
    if (kg === "admin") return true;
    const desig = (currentUser.designation ?? "").toLowerCase();
    if (desig.includes("ceo") || desig.includes("founder") || desig.includes("admin") || desig.includes("director") || desig.includes("chief")) return true;
    return false;
  }, [currentUser]);

  const [activeTab, setActiveTab] = useState<string>("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Admin Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminMfaUserItem | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // Employee Personal Setup / Disable Modals State
  const [totpModalOpen, setTotpModalOpen] = useState(false);
  const [totpData, setTotpData] = useState<{ qr_code: string; secret: string } | null>(null);
  const [totpCodeInput, setTotpCodeInput] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [backupCodesModalOpen, setBackupCodesModalOpen] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  // 1. Fetch Org MFA Policy (Admin only)
  const { data: policyData, isLoading: policyLoading } = useQuery({
    queryKey: ["admin-mfa-policy"],
    queryFn: () => mfaApi.getAdminPolicy(),
    enabled: isAdminOrCeo,
  });

  // 2. Fetch Users MFA Status List (Admin sees all; Employee sees self)
  const { data: usersData = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["admin-mfa-users"],
    queryFn: () => mfaApi.getAdminUsers(),
  });

  // 3. Fetch MFA Audit Logs (Admin only)
  const { data: auditLogs = [], isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["admin-mfa-audit-logs"],
    queryFn: () => mfaApi.getAdminAuditLogs(),
    enabled: isAdminOrCeo && activeTab === "audit",
  });

  // Policy toggle mutation (Admin only)
  const policyMutation = useMutation({
    mutationFn: (requireAll: boolean) => mfaApi.updateAdminPolicy(requireAll),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-mfa-policy"] });
      message.success(res.message || "Organization MFA policy updated.");
    },
    onError: (err: any) => {
      message.error(apiErrorMsg(err, "Failed to update organization MFA policy."));
    },
  });

  // Admin Toggle User MFA mutation
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const toggleMutation = useMutation({
    mutationFn: ({ userId, enable }: { userId: string; enable: boolean }) =>
      mfaApi.toggleUserMfa(userId, enable),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-mfa-users"] });
      qc.invalidateQueries({ queryKey: ["admin-mfa-audit-logs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      message.success(res.message || "Employee MFA status updated.");
    },
    onError: (err: any) => {
      message.error(apiErrorMsg(err, "Failed to update employee MFA status."));
    },
    onSettled: () => {
      setTogglingId(null);
    },
  });

  // Handle Admin Reset User
  const handleAdminReset = async () => {
    if (!selectedUser) return;
    if (!adminPassword.trim()) {
      message.error("Please enter your admin password to confirm.");
      return;
    }

    setResetting(true);
    try {
      const res = await mfaApi.adminResetUser(selectedUser.id, adminPassword);
      message.success(res.message || `2FA for ${selectedUser.full_name} has been reset.`);
      setResetModalOpen(false);
      setSelectedUser(null);
      setAdminPassword("");
      qc.invalidateQueries({ queryKey: ["admin-mfa-users"] });
      qc.invalidateQueries({ queryKey: ["admin-mfa-audit-logs"] });
    } catch (err: any) {
      message.error(apiErrorMsg(err, "Failed to reset 2FA for employee."));
    } finally {
      setResetting(false);
    }
  };

  // Personal Employee Setup handlers
  const handleOpenPersonalSetup = async () => {
    setTotpLoading(true);
    try {
      const res = await mfaApi.setup();
      setTotpData(res);
      setTotpCodeInput("");
      setTotpModalOpen(true);
    } catch (e: any) {
      message.error(apiErrorMsg(e, "Failed to initialize 2FA setup"));
    } finally {
      setTotpLoading(false);
    }
  };

  const handleVerifyPersonalEnable = async () => {
    if (!totpCodeInput.trim()) return;
    setTotpLoading(true);
    try {
      const res = await mfaApi.verifySetup(totpCodeInput.trim());
      message.success("Two-Factor Authentication enabled successfully!");
      setTotpModalOpen(false);
      setTotpCodeInput("");
      qc.invalidateQueries({ queryKey: ["admin-mfa-users"] });
      qc.invalidateQueries({ queryKey: ["me"] });

      if (res.backup_codes && res.backup_codes.length > 0) {
        setBackupCodes(res.backup_codes);
        setBackupCodesModalOpen(true);
      }
    } catch (e: any) {
      message.error(apiErrorMsg(e, "Invalid 6-digit code. Please try again."));
    } finally {
      setTotpLoading(false);
    }
  };

  const handlePersonalDisable = async () => {
    if (!disablePassword.trim() || !disableCode.trim()) {
      message.error("Password and 6-digit authenticator code are required.");
      return;
    }
    setTotpLoading(true);
    try {
      await mfaApi.disable(disablePassword.trim(), disableCode.trim());
      message.success("Two-Factor Authentication disabled.");
      setDisableModalOpen(false);
      setDisablePassword("");
      setDisableCode("");
      qc.invalidateQueries({ queryKey: ["admin-mfa-users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e: any) {
      message.error(apiErrorMsg(e, "Failed to disable 2FA"));
    } finally {
      setTotpLoading(false);
    }
  };

  const downloadBackupCodesTxt = () => {
    const text = `ALMAX WORKSPACE - 2-FACTOR AUTHENTICATION BACKUP CODES\nGenerated: ${new Date().toISOString()}\nAccount: ${currentUser?.email || currentUser?.username}\n\n` +
      backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n") +
      "\n\nEach backup code can be used only once to log in if you lose access to Google Authenticator.\nKeep these in a secure location.";
    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `almax-backup-codes-${currentUser?.username || "user"}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyBackupCodesToClipboard = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    message.success("All backup codes copied to clipboard!");
  };

  // Filter Users
  const filteredUsers = useMemo(() => {
    let list = usersData;
    if (statusFilter === "active") {
      list = list.filter((u) => u.mfa_enabled);
    } else if (statusFilter === "disabled") {
      list = list.filter((u) => !u.mfa_enabled);
    } else if (statusFilter === "locked") {
      list = list.filter((u) => u.is_locked);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.employee_code?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q) ||
          u.designation?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [usersData, statusFilter, searchQuery]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = usersData.length;
    const active = usersData.filter((u) => u.mfa_enabled).length;
    const locked = usersData.filter((u) => u.is_locked).length;
    const percentage = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, active, locked, percentage };
  }, [usersData]);

  // Users Table Columns (Admin only)
  const userColumns = [
    {
      title: "Employee",
      key: "employee",
      width: 250,
      render: (_: any, r: AdminMfaUserItem) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220 }}>
          <Avatar
            src={r.profile_picture_url}
            icon={!r.profile_picture_url && <UserOutlined />}
            size={36}
            style={{ backgroundColor: "#6366f1", flexShrink: 0 }}
          />
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontWeight: 600, color: "var(--bms-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.full_name}
            </div>
            <div style={{ fontSize: 12, color: "var(--bms-text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.employee_code ? `[${r.employee_code}] ` : ""}@{r.username}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 240,
      render: (email: string) => (
        <div style={{ whiteSpace: "nowrap" }}>
          <Text copyable={{ text: email }}>{email || "—"}</Text>
        </div>
      ),
    },
    {
      title: "Department & Role",
      key: "dept",
      width: 200,
      render: (_: any, r: AdminMfaUserItem) => (
        <div style={{ whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--bms-text)" }}>{r.designation || "Employee"}</div>
          <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>{r.department || "General"}</div>
        </div>
      ),
    },
    {
      title: "MFA Status",
      key: "status",
      width: 150,
      render: (_: any, r: AdminMfaUserItem) => (
        <div style={{ whiteSpace: "nowrap", display: "inline-block" }}>
          {r.is_locked ? (
            <Tag
              color="error"
              icon={<WarningOutlined />}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 10px",
                fontSize: 12.5,
                fontWeight: 500,
                borderRadius: 6,
                margin: 0,
                whiteSpace: "nowrap",
                width: "fit-content",
                minWidth: 86,
                justifyContent: "center",
              }}
            >
              Locked
            </Tag>
          ) : r.mfa_enabled ? (
            <Tag
              color="success"
              icon={<CheckCircleOutlined />}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 10px",
                fontSize: 12.5,
                fontWeight: 500,
                borderRadius: 6,
                margin: 0,
                whiteSpace: "nowrap",
                width: "fit-content",
                minWidth: 86,
                justifyContent: "center",
              }}
            >
              Active
            </Tag>
          ) : (
            <Tag
              icon={<CloseCircleOutlined />}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 10px",
                fontSize: 12.5,
                fontWeight: 500,
                borderRadius: 6,
                margin: 0,
                color: "#64748b",
                background: "#f8fafc",
                borderColor: "#e2e8f0",
                whiteSpace: "nowrap",
                width: "fit-content",
                minWidth: 86,
                justifyContent: "center",
              }}
            >
              Disabled
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Enrolled On",
      dataIndex: "mfa_enrolled_at",
      key: "enrolled",
      width: 180,
      render: (d: string | null) => (
        <span style={{ whiteSpace: "nowrap", color: d ? "var(--bms-text)" : "var(--bms-text-3)" }}>
          {d ? dayjs(d).format("DD MMM YYYY, hh:mm A") : "—"}
        </span>
      ),
    },
    {
      title: "Backup Codes",
      key: "backup_codes",
      width: 140,
      render: (_: any, r: AdminMfaUserItem) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {r.mfa_enabled ? (
            <Tag color={r.remaining_backup_codes > 2 ? "blue" : "warning"} style={{ margin: 0 }}>
              {r.remaining_backup_codes} / 8 left
            </Tag>
          ) : (
            <Text type="secondary">—</Text>
          )}
        </span>
      ),
    },
  ];

  // Audit Logs Columns (Admin only)
  const auditColumns = [
    {
      title: "Timestamp",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (d: string) => <span style={{ whiteSpace: "nowrap" }}>{dayjs(d).format("DD MMM YYYY, hh:mm A")}</span>,
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      width: 190,
      render: (act: string, r: AdminMfaAuditLogItem) => {
        let color = "blue";
        if (act === "enabled") color = "green";
        if (act === "disabled") color = "red";
        if (act === "admin_reset") color = "orange";
        if (act === "locked" || act === "failed_attempt") color = "volcano";
        if (act === "backup_code_used") color = "purple";
        return (
          <Tag color={color} style={{ whiteSpace: "nowrap", margin: 0 }}>
            {r.action_display || act.replace(/_/g, " ").toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: "Target User",
      dataIndex: "user_name",
      key: "user_name",
      width: 200,
      render: (u: string) => <strong style={{ whiteSpace: "nowrap" }}>{u}</strong>,
    },
    {
      title: "Performed By",
      dataIndex: "performed_by_name",
      key: "performed_by_name",
      width: 180,
      render: (p: string) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {p ? <Text code>{p}</Text> : <Text type="secondary">Self</Text>}
        </span>
      ),
    },
    {
      title: "IP Address",
      dataIndex: "ip_address",
      key: "ip_address",
      width: 140,
      render: (ip: string) => <span style={{ whiteSpace: "nowrap" }}>{ip || "—"}</span>,
    },
  ];

  // Self status item for employee view
  const myStatusItem = usersData[0] || null;
  const isMyMfaActive = myStatusItem ? myStatusItem.mfa_enabled : !!currentUser?.totp_enabled;

  // ──────────────────────────────────────────────────────────
  // VIEW 1: REGULAR EMPLOYEE VIEW (Personal Account MFA Only)
  // ──────────────────────────────────────────────────────────
  if (!isAdminOrCeo) {
    return (
      <div style={{ padding: "28px 24px" }}>
        <div
          style={{
            background: "var(--bms-surface-2)",
            borderRadius: 14,
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 20,
            border: "1px solid var(--bms-border)",
            maxWidth: 800,
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: isMyMfaActive ? "#10b981" : "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              <SafetyCertificateOutlined />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: "var(--bms-text)" }}>
                  Multi-Factor Authentication (MFA)
                </span>
                {isMyMfaActive ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>Active</Tag>
                ) : (
                  <Tag color="default">Disabled</Tag>
                )}
              </div>
              <Paragraph type="secondary" style={{ fontSize: 13.5, margin: "6px 0 0 0", maxWidth: 480 }}>
                {isMyMfaActive
                  ? "Your account is secured with Google Authenticator. You will be prompted for a 6-digit code on login."
                  : "Protect your account by adding 6-digit TOTP verification with Google Authenticator for login security."}
              </Paragraph>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Switch
              checked={isMyMfaActive}
              loading={totpLoading}
              checkedChildren="ON"
              unCheckedChildren="OFF"
              onChange={(checked) => {
                if (checked) {
                  handleOpenPersonalSetup();
                } else {
                  setDisablePassword("");
                  setDisableCode("");
                  setDisableModalOpen(true);
                }
              }}
              style={{ minWidth: 84 }}
            />
          </div>
        </div>

        {/* ── Employee Personal QR Setup Modal ── */}
        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SafetyCertificateOutlined style={{ color: "#6366f1" }} />
              <span>Setup Google Authenticator (2FA)</span>
            </div>
          }
          open={totpModalOpen}
          onCancel={() => { setTotpModalOpen(false); setTotpCodeInput(""); }}
          footer={null}
          width={440}
          centered
        >
          <div style={{ textAlign: "center", paddingTop: 12 }}>
            {totpData?.qr_code ? (
              <div style={{ background: "#ffffff", padding: 16, borderRadius: 12, display: "inline-block", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 16 }}>
                <img src={totpData.qr_code} alt="2FA QR Code" style={{ width: 180, height: 180, display: "block" }} />
              </div>
            ) : (
              <Spin style={{ margin: "24px 0" }} />
            )}

            <div style={{ fontSize: 13, color: "var(--bms-text-2)", marginBottom: 16, textAlign: "left" }}>
              <ol style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Open <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> on your phone.</li>
                <li>Tap <b>+</b> ➔ <b>Scan a QR code</b> and scan the QR code above.</li>
                <li>Enter the 6-digit verification code below:</li>
              </ol>
            </div>

            {totpData?.secret && (
              <div style={{ marginBottom: 16, background: "var(--bms-surface-2)", padding: "8px 12px", borderRadius: 8, fontSize: 12, color: "var(--bms-text-3)" }}>
                Manual Setup Key: <Text copyable code style={{ fontSize: 12, fontWeight: 700 }}>{totpData.secret}</Text>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <Input
                size="large"
                placeholder="000000"
                maxLength={6}
                value={totpCodeInput}
                onChange={(e) => setTotpCodeInput(e.target.value.replace(/\D/g, ""))}
                style={{ textAlign: "center", fontSize: 22, letterSpacing: 6, fontWeight: 700, borderRadius: 8 }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button onClick={() => { setTotpModalOpen(false); setTotpCodeInput(""); }}>Cancel</Button>
              <Button
                type="primary"
                disabled={totpCodeInput.trim().length !== 6}
                loading={totpLoading}
                onClick={handleVerifyPersonalEnable}
              >
                Verify & Enable 2FA
              </Button>
            </div>
          </div>
        </Modal>

        {/* ── 8 Single-Use Backup Codes Modal ── */}
        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <KeyOutlined style={{ color: "#10b981" }} />
              <span>Your Emergency Backup Codes</span>
            </div>
          }
          open={backupCodesModalOpen}
          onCancel={() => setBackupCodesModalOpen(false)}
          footer={[
            <Button key="copy" icon={<CopyOutlined />} onClick={copyBackupCodesToClipboard}>
              Copy All
            </Button>,
            <Button key="download" icon={<DownloadOutlined />} onClick={downloadBackupCodesTxt}>
              Download (.txt)
            </Button>,
            <Button key="done" type="primary" onClick={() => setBackupCodesModalOpen(false)}>
              I have saved these codes
            </Button>,
          ]}
          width={500}
          centered
          maskClosable={false}
        >
          <div style={{ paddingTop: 8 }}>
            <Alert
              message="Save these backup codes in a safe place"
              description="Each code can be used once if you lose access to your authenticator app. These codes will NOT be displayed again."
              type="warning"
              showIcon
              style={{ marginBottom: 18, borderRadius: 8 }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                background: "var(--bms-surface-2)",
                padding: "16px 20px",
                borderRadius: 10,
                border: "1px solid var(--bms-border)",
                marginBottom: 16,
              }}
            >
              {backupCodes.map((code, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11, width: 18 }}>{idx + 1}.</Text>
                  <Text copyable code style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
                    {code}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </Modal>

        {/* ── Personal Disable 2FA Modal ── */}
        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ExclamationCircleOutlined style={{ color: "#ef4444" }} />
              <span>Disable 2-Factor Authentication</span>
            </div>
          }
          open={disableModalOpen}
          onCancel={() => {
            setDisableModalOpen(false);
            setDisablePassword("");
            setDisableCode("");
          }}
          footer={[
            <Button key="cancel" onClick={() => setDisableModalOpen(false)}>Cancel</Button>,
            <Button
              key="submit"
              type="primary"
              danger
              loading={totpLoading}
              disabled={!disablePassword.trim() || !disableCode.trim()}
              onClick={handlePersonalDisable}
            >
              Confirm & Disable 2FA
            </Button>,
          ]}
          width={440}
          centered
        >
          <div style={{ paddingTop: 8 }}>
            <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
              For your security, please enter your account password and a current 6-digit Google Authenticator code to turn off 2FA.
            </Paragraph>

            <Form layout="vertical">
              <Form.Item label="Account Password" required>
                <Input.Password
                  prefix={<KeyOutlined />}
                  placeholder="Enter account password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
              <Form.Item label="Current 6-Digit Authenticator Code (or Backup Code)" required>
                <Input
                  placeholder="000000"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.trim())}
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
            </Form>
          </div>
        </Modal>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // VIEW 2: ADMIN & CEO VIEW (Full Org Policy + All Employees)
  // ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* ── Organization MFA Policy Header Section ── */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--bms-border)",
          background: "var(--bms-surface)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", maxWidth: 720 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              <SafetyCertificateOutlined />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--bms-text)" }}>
                Require Multi-Factor Authentication for All Users
              </div>
              <Paragraph type="secondary" style={{ fontSize: 13, margin: "4px 0 0 0" }}>
                When enabled, all employees and administrators across the organization are mandated to pair Google Authenticator (TOTP) to access their workspace.
              </Paragraph>
              {policyData?.updated_at && (
                <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 6 }}>
                  Last updated by <strong>{policyData.updated_by || "Admin"}</strong> on{" "}
                  {dayjs(policyData.updated_at).format("DD MMM YYYY, hh:mm A")}
                </Text>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Switch
              checked={policyData?.require_mfa_for_all ?? false}
              loading={policyLoading || policyMutation.isPending}
              onChange={(checked) => policyMutation.mutate(checked)}
              checkedChildren="Mandatory"
              unCheckedChildren="Optional"
              style={{ minWidth: 96 }}
            />
          </div>
        </div>

        {policyData?.require_mfa_for_all && (
          <Alert
            message="Organization-Wide MFA Policy Active"
            description="All employees without 2FA will be prompted to complete Google Authenticator setup upon their next login."
            type="info"
            showIcon
            style={{ marginTop: 16, borderRadius: 8 }}
          />
        )}
      </div>

      {/* ── Tabs Navigation ── */}
      <div style={{ padding: "0 24px", background: "var(--bms-surface)" }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={[
            {
              key: "users",
              label: (
                <span>
                  <UserOutlined /> Employee 2FA Status ({filteredUsers.length})
                </span>
              ),
            },
            {
              key: "audit",
              label: (
                <span>
                  <HistoryOutlined /> Security Audit Logs ({auditLogs.length})
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* ── Tab Content Panel ── */}
      <div style={{ padding: "16px 24px 24px 24px" }}>
        {activeTab === "users" ? (
          <div>
            {/* Search, Status Filter & Summary Toolbar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <Space wrap size="middle">
                <Input
                  placeholder="Search employee, email, dept…"
                  prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
                  allowClear
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: 280, borderRadius: 8 }}
                />
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 160 }}
                  options={[
                    { value: "all", label: "All Statuses" },
                    { value: "active", label: "2FA Active" },
                    { value: "disabled", label: "2FA Disabled" },
                    { value: "locked", label: "Locked Accounts" },
                  ]}
                />
              </Space>

              <Space wrap size="middle">
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--bms-text-2)" }}>
                  <span>Total: <strong>{stats.total}</strong></span>
                  <span>•</span>
                  <span>Active: <strong style={{ color: "#10b981" }}>{stats.active} ({stats.percentage}%)</strong></span>
                  {stats.locked > 0 && (
                    <>
                      <span>•</span>
                      <span style={{ color: "#ef4444" }}>Locked: <strong>{stats.locked}</strong></span>
                    </>
                  )}
                </div>
                <Button icon={<ReloadOutlined />} onClick={() => refetchUsers()} loading={usersLoading}>
                  Refresh
                </Button>
              </Space>
            </div>

            {/* Users Table with Full Width & Horizontal Scroll */}
            <Table
              columns={userColumns}
              dataSource={filteredUsers}
              rowKey="id"
              loading={usersLoading}
              scroll={{ x: 1100 }}
              pagination={{
                pageSize: 15,
                showSizeChanger: true,
                showTotal: (t) => `Total ${t} employees`,
              }}
              locale={{ emptyText: "No employee accounts found matching your filter." }}
            />
          </div>
        ) : (
          <div>
            {/* Audit Logs Toolbar */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <Button icon={<ReloadOutlined />} onClick={() => refetchAudit()} loading={auditLoading}>
                Refresh Logs
              </Button>
            </div>

            {/* Audit Logs Table */}
            <Table
              columns={auditColumns}
              dataSource={auditLogs}
              rowKey="id"
              loading={auditLoading}
              scroll={{ x: 950 }}
              pagination={{ pageSize: 20, showTotal: (t) => `Total ${t} audit events` }}
              locale={{ emptyText: "No MFA security audit events recorded yet." }}
            />
          </div>
        )}
      </div>

      {/* ── Admin Force Reset User Confirmation Modal ── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ExclamationCircleOutlined style={{ color: "#ef4444" }} />
            <span>Force Reset 2-Factor Authentication</span>
          </div>
        }
        open={resetModalOpen}
        onCancel={() => {
          setResetModalOpen(false);
          setSelectedUser(null);
          setAdminPassword("");
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setResetModalOpen(false);
              setSelectedUser(null);
              setAdminPassword("");
            }}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            loading={resetting}
            disabled={!adminPassword.trim()}
            onClick={handleAdminReset}
          >
            Confirm & Reset 2FA
          </Button>,
        ]}
        width={480}
        centered
      >
        <div style={{ marginTop: 12 }}>
          <Paragraph>
            You are about to reset 2FA for <strong>{selectedUser?.full_name}</strong> ({selectedUser?.email}).
          </Paragraph>
          <Alert
            message="Security Impact"
            description="The employee's Google Authenticator secret and all backup codes will be revoked. A security email alert will be dispatched to the employee, and an audit entry will be recorded."
            type="warning"
            showIcon
            style={{ marginBottom: 18, borderRadius: 8 }}
          />

          <Form layout="vertical">
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>Admin Password Re-Authentication</span>}
              required
              help="Please enter your admin account password to authorize this action."
            >
              <Input.Password
                prefix={<KeyOutlined />}
                placeholder="Enter your current admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onPressEnter={handleAdminReset}
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
