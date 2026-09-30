import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Card, Form, Input, Button, Avatar, message,
  Row, Col, Divider, Spin, Modal, Popconfirm, Alert, Tag, Space, Switch,
} from "antd";
import {
  UserOutlined, CameraOutlined, SaveOutlined, SafetyOutlined,
  CopyOutlined, DownloadOutlined, KeyOutlined, ReloadOutlined,
  SafetyCertificateOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
} from "@ant-design/icons";
import { get, post } from "@/services/api";
import client from "@/services/api";
import PhoneInput from "@/components/common/PhoneInput";
import { phoneFormRules } from "@/utils/phone";
import { useAuthStore } from "@/store/auth";

const { Title, Text, Paragraph } = Typography;

interface MeProfile {
  id: string;
  username?: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  employee_code: string;
  designation: string;
  department: string;
  phone_number: string;
  bio: string;
  profile_picture_url: string | null;
  keycloak_group: string;
  joining_date: string | null;
  totp_enabled?: boolean;
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const [form] = Form.useForm();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [totpModalOpen, setTotpModalOpen] = useState(false);
  const [totpData, setTotpData] = useState<{ secret: string; qr_code: string; totp_enabled: boolean } | null>(null);
  const [totpCodeInput, setTotpCodeInput] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);

  const [backupCodesModalOpen, setBackupCodesModalOpen] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [regenCode, setRegenCode] = useState("");

  const { data: me, isLoading } = useQuery<MeProfile>({
    queryKey: ["me"],
    queryFn: () => get("/users/me/"),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (me) {
      form.setFieldsValue({
        first_name:   (me.full_name ?? "").split(" ")[0] ?? "",
        last_name:    (me.full_name ?? "").split(" ").slice(1).join(" ") ?? "",
        phone_number: me.phone_number ?? "",
        bio:          me.bio ?? "",
      });
    }
  }, [me, form]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { message.error("Image must be under 2MB"); return; }
    setPendingFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const fd = new FormData();
      fd.append("first_name",   values.first_name ?? "");
      fd.append("last_name",    values.last_name  ?? "");
      fd.append("phone_number", values.phone_number ?? "");
      fd.append("bio",          values.bio ?? "");
      if (pendingFile) fd.append("profile_picture", pendingFile);

      await client.patch("/users/me/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      message.success("Profile updated successfully");
      setPendingFile(null);

      // Re-fetch user details from the backend and update the global Zustand store
      const updatedMe = await get<any>("/users/me/");
      // Bust browser cache on profile picture so both Settings and navbar avatar refresh immediately
      if (updatedMe.profile_picture_url) {
        updatedMe.profile_picture_url = `${updatedMe.profile_picture_url}?t=${Date.now()}`;
      }
      setUser(updatedMe);
      qc.setQueryData(["me"], updatedMe);
    } catch (e: any) {
      // Extract error message from various API response formats
      const data = e?.response?.data;
      const errMsg =
        data?.errors   ??                         // {"status":"error","errors":"..."} (custom exception handler)
        data?.detail   ??                         // {"detail": "..."}
        data?.message  ??                         // {"status":"error","message":"..."} (fallback message)
        (Array.isArray(data) ? data[0] : null) ?? // DRF ValidationError detail as array
        (typeof data === "string" ? data : null) ?? // Plain string response
        "Failed to update profile";
      message.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenTotpModal = async () => {
    setTotpLoading(true);
    try {
      const res = await post<any>("/auth/mfa/setup/", {});
      setTotpData(res);
      setTotpCodeInput("");
      setTotpModalOpen(true);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to initialize 2FA setup");
    } finally {
      setTotpLoading(false);
    }
  };

  const handleVerifyEnableTotp = async () => {
    if (!totpCodeInput.trim()) return;
    setTotpLoading(true);
    try {
      const res = await post<any>("/auth/mfa/verify-setup/", { code: totpCodeInput.trim() });
      message.success("Google Authenticator (2FA) enabled successfully!");
      setTotpModalOpen(false);
      setTotpCodeInput("");
      qc.invalidateQueries({ queryKey: ["me"] });

      if (res.backup_codes && res.backup_codes.length > 0) {
        setBackupCodes(res.backup_codes);
        setBackupCodesModalOpen(true);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Invalid 6-digit code");
    } finally {
      setTotpLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!disablePassword.trim() || !disableCode.trim()) {
      message.error("Password and 6-digit authenticator code are required.");
      return;
    }
    setTotpLoading(true);
    try {
      await post<any>("/auth/mfa/disable/", {
        password: disablePassword.trim(),
        code: disableCode.trim(),
      });
      message.success("Google Authenticator (2FA) disabled");
      setDisableModalOpen(false);
      setDisablePassword("");
      setDisableCode("");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to disable 2FA");
    } finally {
      setTotpLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!regenPassword.trim() || !regenCode.trim()) {
      message.error("Password and 6-digit authenticator code are required.");
      return;
    }
    setTotpLoading(true);
    try {
      const res = await post<any>("/auth/mfa/regenerate-backup-codes/", {
        password: regenPassword.trim(),
        code: regenCode.trim(),
      });
      message.success("New backup codes generated!");
      setRegenModalOpen(false);
      setRegenPassword("");
      setRegenCode("");
      if (res.backup_codes && res.backup_codes.length > 0) {
        setBackupCodes(res.backup_codes);
        setBackupCodesModalOpen(true);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to regenerate backup codes");
    } finally {
      setTotpLoading(false);
    }
  };

  const downloadBackupCodesTxt = () => {
    const text = `ALMAX WORKSPACE - 2-FACTOR AUTHENTICATION BACKUP CODES\nGenerated: ${new Date().toISOString()}\nAccount: ${me?.email || me?.username}\n\n` +
      backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n") +
      "\n\nEach backup code can be used only once to log in if you lose access to Google Authenticator.\nKeep these in a secure location.";
    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `almax-backup-codes-${me?.username || "user"}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyBackupCodesToClipboard = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    message.success("All backup codes copied to clipboard!");
  };

  if (isLoading) return <div style={{ textAlign: "center", paddingTop: 80 }}><Spin size="large" /></div>;
  if (!me) return null;

  const avatarSrc = avatarPreview ?? me.profile_picture_url ?? undefined;
  const initials = me.full_name?.slice(0, 2).toUpperCase() || "U";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Settings</Title>
        <Text style={{ color: "#6b7280", fontSize: 13 }}>Update your profile and personal details</Text>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 20 }}>
        {/* Avatar section */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24 }}>
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
            <Avatar
              size={88}
              src={avatarSrc}
              icon={!avatarSrc ? <UserOutlined /> : undefined}
              style={{ background: "#1677ff", fontSize: 28, fontWeight: 700 }}
            >
              {!avatarSrc ? initials : undefined}
            </Avatar>
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: "50%",
              background: "#1677ff", display: "flex", alignItems: "center",
              justifyContent: "center", border: "2px solid #fff",
            }}>
              <CameraOutlined style={{ color: "#fff", fontSize: 12 }} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{me.full_name}</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>{me.employee_code} · {me.designation || me.keycloak_group}</div>
            {me.department && <div style={{ fontSize: 12, color: "#9ca3af" }}>{me.department}</div>}
            <Text type="secondary" style={{ fontSize: 12 }}>Click avatar to change photo (max 2MB)</Text>
          </div>
        </div>

        <Divider style={{ margin: "0 0 20px" }} />

        {/* Read-only info */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          {[
            { label: "Email",        value: me.email           },
            { label: "Employee Code",value: me.employee_code   },
            { label: "Designation",  value: me.designation || "—" },
            { label: "Department",   value: me.department  || "—" },
          ].map(({ label, value }) => (
            <Col span={12} key={label}>
              <div style={{
                background: "#f8fafc", borderRadius: 8,
                padding: "10px 14px", marginBottom: 12,
              }}>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{value}</div>
              </div>
            </Col>
          ))}
        </Row>

        <Divider orientation="left" style={{ fontSize: 12, color: "#9ca3af" }}>Editable Details</Divider>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="first_name" label="First Name" rules={[{ required: true, message: "Required" }]}>
                <Input placeholder="John" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_name" label="Last Name">
                <Input placeholder="Doe" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="phone_number" label="Phone Number" rules={phoneFormRules({ label: "Phone number" })}>
            <PhoneInput />
          </Form.Item>
          <Form.Item name="bio" label="Bio / About">
            <Input.TextArea rows={3} placeholder="Write a short bio about yourself..." />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </div>
        </Form>

        <Divider orientation="left" style={{ fontSize: 12, color: "#9ca3af" }}>Security & Multi-Factor Authentication</Divider>

        <div style={{
          background: "var(--bms-surface-2)",
          borderRadius: 10,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          border: "1px solid var(--bms-border)",
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--bms-text)", display: "flex", alignItems: "center", gap: 8 }}>
              <SafetyCertificateOutlined style={{ color: me?.totp_enabled ? "#059669" : "#6366f1", fontSize: 16 }} />
              Two-Factor Authentication (MFA)
              {me?.totp_enabled ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  Active
                </Tag>
              ) : (
                <Tag color="default">Disabled</Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
              {me?.totp_enabled
                ? "Your account is secured with Google Authenticator TOTP."
                : "Enable 6-digit TOTP verification with Google Authenticator for login security."}
            </Text>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Switch
              checked={!!me?.totp_enabled}
              loading={totpLoading}
              checkedChildren="ON"
              unCheckedChildren="OFF"
              onChange={(checked) => {
                if (checked) {
                  handleOpenTotpModal();
                } else {
                  setDisablePassword("");
                  setDisableCode("");
                  setDisableModalOpen(true);
                }
              }}
              style={{ minWidth: 75 }}
            />
          </div>
        </div>
      </Card>

      {/* ── TOTP Setup Modal ── */}
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
              onClick={handleVerifyEnableTotp}
            >
              Verify & Enable 2FA
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── 8 Single-Use Backup Codes Modal (Shown only once) ── */}
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

      {/* ── Disable 2FA Modal (Requires Password + Code) ── */}
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
            onClick={handleDisableTotp}
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

      {/* ── Regenerate Backup Codes Modal ── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ReloadOutlined style={{ color: "#6366f1" }} />
            <span>Regenerate Emergency Backup Codes</span>
          </div>
        }
        open={regenModalOpen}
        onCancel={() => {
          setRegenModalOpen(false);
          setRegenPassword("");
          setRegenCode("");
        }}
        footer={[
          <Button key="cancel" onClick={() => setRegenModalOpen(false)}>Cancel</Button>,
          <Button
            key="submit"
            type="primary"
            loading={totpLoading}
            disabled={!regenPassword.trim() || !regenCode.trim()}
            onClick={handleRegenerateBackupCodes}
          >
            Generate New Codes
          </Button>,
        ]}
        width={440}
        centered
      >
        <div style={{ paddingTop: 8 }}>
          <Alert
            message="Previous backup codes will become invalid"
            type="info"
            showIcon
            style={{ marginBottom: 16, borderRadius: 8 }}
          />

          <Form layout="vertical">
            <Form.Item label="Account Password" required>
              <Input.Password
                prefix={<KeyOutlined />}
                placeholder="Enter account password"
                value={regenPassword}
                onChange={(e) => setRegenPassword(e.target.value)}
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
            <Form.Item label="Current 6-Digit Authenticator Code" required>
              <Input
                placeholder="000000"
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value.trim())}
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
