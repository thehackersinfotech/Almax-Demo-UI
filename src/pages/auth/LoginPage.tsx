import { useState, useEffect } from "react";
import { Form, Input, Button, Alert, Typography, Tag, message } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeTwoTone,
  EyeInvisibleOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useTenantStore } from "@/store/tenant";
import { get, post } from "@/services/api";
import { resolveLandingPath } from "@/utils/access";
import { resolveTenantSlug } from "@/services/tenant";
import { mfaApi } from "@/services/mfa";
import { apiErrorMsg } from "@/utils/apiError";
import ThemeToggle from "@/components/common/ThemeToggle";
import logoImage from "@/assets/logo-AlMax.png";
import fullLogoImage from "@/assets/almax-logo-horizontal.png";
import fullLogoImageDark from "@/assets/almax-logo-horizontal-dark.png";
import { useThemeStore } from "@/store/theme";

const { Title, Text } = Typography;

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 3h7v9H3V3zm11 0h7v5h-7V3zm0 9h7v9h-7v-9zm-11 4h7v5H3v-5z" />
      </svg>
    ),
    label: "Business Management",
    desc: "Kanban boards, milestones & delivery",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05C16.19 13.89 17 15.02 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
    label: "HRMS & Attendance",
    desc: "Employees, leaves & HR compliance",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
      </svg>
    ),
    label: "Payroll & Finance",
    desc: "Salary processing, TDS & payslips",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23L12.5 13V7z" />
      </svg>
    ),
    label: "Timesheets",
    desc: "Time tracking, logs & approvals",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
      </svg>
    ),
    label: "Ticketing & Tasks",
    desc: "Epics, stories, bugs & change requests",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z" />
      </svg>
    ),
    label: "Analytics & Reports",
    desc: "Dashboards, utilization & portfolio",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
      </svg>
    ),
    label: "Payments & Vendors",
    desc: "Invoices, vendors & payment tracking",
  },
];

function BMSLogo({ size = 24, logoUrl, style }: { size?: number; logoUrl?: string | null; style?: React.CSSProperties }) {
  return (
    <img
      src={logoUrl || logoImage}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = logoImage;
      }}
      alt="Logo"
      width={size}
      height={size}
      style={{ objectFit: "contain", ...style }}
    />
  );
}

const WAVE_CSS = `
  @keyframes blobDrift1 {
    0%,100% { transform: translate(0px, 0px) scale(1) rotate(0deg); border-radius: 62% 38% 46% 54% / 60% 44% 56% 40%; }
    20%      { transform: translate(45px,-70px) scale(1.12) rotate(8deg);  border-radius: 38% 62% 54% 46% / 44% 56% 44% 56%; }
    45%      { transform: translate(-35px,55px) scale(0.92) rotate(-6deg); border-radius: 54% 46% 38% 62% / 56% 38% 62% 44%; }
    70%      { transform: translate(60px,25px)  scale(1.08) rotate(12deg); border-radius: 46% 54% 62% 38% / 38% 62% 38% 62%; }
  }
  @keyframes blobDrift2 {
    0%,100% { transform: translate(0px, 0px) scale(1) rotate(0deg); border-radius: 44% 56% 62% 38% / 54% 38% 62% 46%; }
    30%      { transform: translate(-55px,65px)  scale(1.18) rotate(-10deg); border-radius: 62% 38% 44% 56% / 38% 62% 46% 54%; }
    65%      { transform: translate(40px,-45px)  scale(0.88) rotate(7deg);  border-radius: 38% 62% 56% 44% / 62% 44% 38% 56%; }
  }
  @keyframes blobDrift3 {
    0%,100% { transform: translate(0px, 0px) scale(1); border-radius: 50%; }
    40%      { transform: translate(35px,-55px) scale(1.22); border-radius: 60% 40% 50% 50% / 40% 60% 40% 60%; }
    80%      { transform: translate(-25px,40px) scale(0.85); border-radius: 40% 60% 40% 60% / 60% 40% 60% 40%; }
  }
  @keyframes blobDrift4 {
    0%,100% { transform: translate(0px,0px) scale(1) rotate(0deg); border-radius: 56% 44% 38% 62% / 44% 56% 44% 56%; }
    50%      { transform: translate(-40px,-60px) scale(1.15) rotate(-15deg); border-radius: 44% 56% 62% 38% / 56% 44% 56% 44%; }
  }
`;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpRequired, setTotpRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingCredentials, setPendingCredentials] = useState<{ username: string; password: string } | null>(null);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [emailSentMsg, setEmailSentMsg] = useState<string | null>(null);

  const { setToken, setRefreshToken, setUser, setPermissions } = useAuthStore();
  const navigate = useNavigate();

  const tenant = useTenantStore((s) => s.tenant);
  const isDark = useThemeStore((s) => s.isDark);
  const brandLogoUrl = tenant && !tenant.is_platform ? tenant.logo_url : null;
  const brandName = brandLogoUrl ? tenant!.name : "AlMax";
  const tenantSlug = tenant?.slug || resolveTenantSlug();
  const isSubdomain = !!tenantSlug && tenantSlug !== "public" && tenantSlug !== "platform";
  const workspaceTitle = tenant && !tenant.is_platform ? tenant.name : "AlMax";
  const tenantLogo = brandLogoUrl;

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  useEffect(() => {
    if (token && user) {
      navigate(
        resolveLandingPath(user, permissions, {
          isPlatformTenant: !!tenant?.is_platform,
          modules: tenant?.modules,
        }),
        { replace: true }
      );
    }
  }, [token, user, permissions, tenant, navigate]);

  const onFinish = async (values: { username: string; password: string; otp?: string }) => {
    setLoading(true);
    setError(null);
    try {
      let res: any;

      if (totpRequired && mfaToken) {
        // Direct MFA Verify endpoint
        res = await post<any>("/auth/mfa/verify-login/", {
          mfa_token: mfaToken,
          code: otpCode.trim(),
        });
      } else {
        const payload = pendingCredentials
          ? { ...pendingCredentials, otp: otpCode.trim() }
          : values;

        res = await post<any>("/auth/token/", payload);

        if (res.mfa_required || res.totp_required) {
          setTotpRequired(true);
          setMfaToken(res.mfa_token || null);
          setPendingCredentials(values);
          setLoading(false);
          return;
        }
      }

      setToken(res.access_token);
      if (res.refresh_token) setRefreshToken(res.refresh_token);

      let me: any;
      try {
        me = await get<any>("/users/me/");
      } catch {
        me = res.user || {};
      }

      const fullUser = {
        ...me,
        last_login: res.user?.last_login ?? me.last_login ?? null,
      };
      const perms = me.permissions || [];
      setUser(fullUser);
      setPermissions(perms);

      const tenantObj = useTenantStore.getState().tenant;
      const targetPath = resolveLandingPath(fullUser, perms, {
        isPlatformTenant: !!tenantObj?.is_platform,
        modules: tenantObj?.modules,
      });
      navigate(targetPath, { replace: true });
    } catch (err: any) {
      setError(apiErrorMsg(err, "Invalid credentials or verification code."));
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!mfaToken) return;
    setSendingEmailOtp(true);
    setError(null);
    try {
      const res = await mfaApi.sendEmailOtp(mfaToken);
      setEmailSentMsg(res.message || "Verification code sent to your registered email.");
      message.success(res.message || "Code sent to your email!");
    } catch (e: any) {
      setError(apiErrorMsg(e, "Failed to send verification code to email."));
    } finally {
      setSendingEmailOtp(false);
    }
  };

  return (
    <div className="bms-login-page">
      {/* ── Left brand panel ── */}
      <div className="bms-login-brand">
        <style>{WAVE_CSS}</style>

        <div style={{
          position: "absolute",
          width: 520, height: 520,
          top: "10%", left: "-15%",
          background: "radial-gradient(circle at 40% 40%, color-mix(in srgb, var(--bms-primary) 42%, transparent) 0%, rgba(10,61,143,0.22) 45%, transparent 70%)",
          filter: "blur(72px)",
          animation: "blobDrift1 14s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          width: 380, height: 380,
          top: "-8%", right: "-8%",
          background: "radial-gradient(circle at 55% 55%, rgba(13,82,181,0.5) 0%, color-mix(in srgb, var(--bms-primary) 18%, transparent) 50%, transparent 72%)",
          filter: "blur(60px)",
          animation: "blobDrift2 10s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          width: 280, height: 280,
          bottom: "8%", right: "5%",
          background: "radial-gradient(circle, color-mix(in srgb, var(--bms-primary) 30%, transparent) 0%, rgba(6,42,110,0.2) 55%, transparent 75%)",
          filter: "blur(50px)",
          animation: "blobDrift3 8s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          width: 200, height: 200,
          bottom: "20%", left: "5%",
          background: "radial-gradient(circle, rgba(79,148,255,0.28) 0%, transparent 70%)",
          filter: "blur(40px)",
          animation: "blobDrift4 11s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13,
              background: "#ffffff",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 6px color-mix(in srgb, var(--bms-primary) 18%, transparent), 0 4px 16px color-mix(in srgb, var(--bms-primary) 35%, transparent)",
            }}>
              <BMSLogo size={26} logoUrl={null} />
            </div>
            <div>
              <div style={{
                color: "#ffffff", fontSize: 21, fontWeight: 800,
                letterSpacing: -0.6, lineHeight: 1.1,
              }}>
                AlMax
              </div>
              <div style={{
                color: "rgba(255,255,255,0.38)", fontSize: 10.5,
                letterSpacing: 1.8, textTransform: "uppercase", marginTop: 2, fontWeight: 500,
              }}>
                Your Business Ally
              </div>
            </div>
          </div>
        </div>

        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "center", position: "relative", zIndex: 1,
          paddingTop: 48, paddingBottom: 32,
        }}>
          <Title level={2} style={{
            color: "#ffffff", margin: 0, fontWeight: 800,
            lineHeight: 1.22, fontSize: 31, letterSpacing: -0.7, marginBottom: 12,
          }}>
            Unify your teams,<br />projects & performance.
          </Title>
          <Text style={{
            color: "rgba(255,255,255,0.5)", fontSize: 14,
            display: "block", lineHeight: 1.65, marginBottom: 36,
          }}>
            From project delivery to payroll — everything your<br />
            enterprise needs in one intelligent platform.
          </Text>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.075)",
                borderRadius: 11,
                padding: "13px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 11,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: "color-mix(in srgb, var(--bms-primary) 18%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--bms-primary) 28%, transparent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  color: "#5aa8ff",
                }}>
                  {f.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    color: "rgba(255,255,255,0.88)", fontSize: 12.5,
                    fontWeight: 600, lineHeight: 1.1, marginBottom: 4,
                  }}>
                    {f.label}
                  </div>
                  <div style={{
                    color: "rgba(255,255,255,0.36)", fontSize: 11,
                    lineHeight: 1.45,
                  }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: 20,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: "rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.4)", fontSize: 13,
            }}>
              <CheckCircleOutlined />
            </div>
            <div>
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 500 }}>
                Enterprise-grade security
              </span>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, display: "block" }}>
                Multi-factor authentication & role-based access control
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="bms-login-form-panel">
        <div style={{ position: "absolute", top: 20, right: 24 }}>
          <ThemeToggle />
        </div>

        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ marginBottom: 36 }}>
            {brandLogoUrl ? (
              <div style={{
                width: 46, height: 46, borderRadius: 13,
                background: "#ffffff",
                border: "1px solid var(--bms-border, rgba(0, 0, 0, 0.08))",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 22,
                padding: 5,
                boxShadow: "0 0 0 5px color-mix(in srgb, var(--bms-primary) 14%, transparent), 0 4px 14px color-mix(in srgb, var(--bms-primary) 22%, transparent)",
                overflow: "hidden",
              }}>
                <BMSLogo size={32} logoUrl={brandLogoUrl} style={{ width: "100%", height: "100%", borderRadius: 8, objectFit: "contain" }} />
              </div>
            ) : (
              <img
                src={isDark ? fullLogoImageDark : fullLogoImage}
                alt="AlMax"
                style={{ height: 36, width: "auto", display: "block", marginBottom: 26 }}
              />
            )}
            <Title level={2} style={{
              margin: 0, fontWeight: 800, color: "var(--bms-text)",
              fontSize: 26, letterSpacing: -0.5,
            }}>
              Welcome back
            </Title>
            <Text style={{
              color: "var(--bms-text-2)", fontSize: 14,
              marginTop: 6, display: "block", lineHeight: 1.5,
            }}>
              {tenant?.is_platform
                ? "Sign in to the Platform Control Plane to continue."
                : `Sign in to your ${tenant?.name || "AlMax"} workspace to continue.`}
            </Text>
            <Text style={{
              color: "var(--bms-text-3)", fontSize: 12,
              marginTop: 8, display: "block",
            }}>
              You're signing in at {window.location.host}
            </Text>
          </div>

          {error && (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ marginBottom: 20, borderRadius: 8 }}
              closable
              onClose={() => setError(null)}
            />
          )}

          {totpRequired ? (
            <div style={{ background: "var(--bms-surface)", padding: 24, borderRadius: 14, border: "1px solid var(--bms-border)" }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <SafetyOutlined style={{ fontSize: 36, color: "#6366f1", marginBottom: 8 }} />
                <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>
                  {useBackupCode ? "Emergency Backup Code" : "Two-Factor Authentication"}
                </Title>
                <Text style={{ fontSize: 13, color: "var(--bms-text-2)", marginTop: 4, display: "block" }}>
                  {useBackupCode
                    ? "Enter an unused 8-character backup code generated during MFA setup."
                    : (emailSentMsg
                      ? "Enter the 6-digit verification code sent to your email inbox."
                      : "Enter the 6-digit code from Google Authenticator, or send code to email.")}
                </Text>
              </div>

              {emailSentMsg && (
                <Alert
                  message={emailSentMsg}
                  type="success"
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 8 }}
                />
              )}

              <div style={{ marginBottom: 18 }}>
                {useBackupCode ? (
                  <Input
                    size="large"
                    placeholder="XXXX-XXXX"
                    maxLength={9}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.toUpperCase())}
                    onPressEnter={() => {
                      if (otpCode.trim().length >= 8) onFinish({ username: "", password: "" });
                    }}
                    style={{ textAlign: "center", fontSize: 20, letterSpacing: 4, height: 50, fontWeight: 700, borderRadius: 10 }}
                    autoFocus
                  />
                ) : (
                  <Input
                    size="large"
                    placeholder="000000"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    onPressEnter={() => {
                      if (otpCode.trim().length === 6) onFinish({ username: "", password: "" });
                    }}
                    style={{ textAlign: "center", fontSize: 24, letterSpacing: 8, height: 50, fontWeight: 700, borderRadius: 10 }}
                    autoFocus
                  />
                )}
              </div>

              <Button
                type="primary"
                block
                size="large"
                loading={loading}
                disabled={useBackupCode ? otpCode.trim().length < 8 : otpCode.trim().length !== 6}
                onClick={() => onFinish({ username: "", password: "" })}
                style={{ height: 46, borderRadius: 9, fontWeight: 700 }}
              >
                Verify & Continue →
              </Button>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, alignItems: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setUseBackupCode(!useBackupCode);
                      setOtpCode("");
                      setError(null);
                    }}
                    style={{ padding: 0, color: "var(--bms-primary)", fontSize: 12.5 }}
                  >
                    {useBackupCode ? "← Use 6-digit code" : "🔑 Use a backup code"}
                  </Button>

                  {!useBackupCode && (
                    <Button
                      type="link"
                      size="small"
                      loading={sendingEmailOtp}
                      onClick={handleSendEmailOtp}
                      style={{ padding: 0, color: "#6366f1", fontSize: 12.5 }}
                    >
                      📧 Send code to email instead
                    </Button>
                  )}
                </div>

                <Button
                  type="text"
                  size="small"
                  onClick={() => {
                    setTotpRequired(false);
                    setMfaToken(null);
                    setOtpCode("");
                    setError(null);
                    setUseBackupCode(false);
                    setEmailSentMsg(null);
                  }}
                  style={{ padding: 0, color: "var(--bms-text-3)", fontSize: 12 }}
                >
                  Back to Login
                </Button>
              </div>
            </div>
          ) : (
            <Form onFinish={onFinish} layout="vertical" requiredMark={false} size="large">
              <Form.Item
                name="username"
                label={<span style={{ fontWeight: 500, fontSize: 13.5, color: "var(--bms-text)" }}>Username</span>}
                rules={[{ required: true, message: "Please enter your username" }]}
                style={{ marginBottom: 18 }}
              >
                <Input
                  prefix={<UserOutlined style={{ color: "var(--bms-text-3)" }} />}
                  placeholder="Enter your username"
                  style={{ borderRadius: 9, height: 46 }}
                  autoComplete="username"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={<span style={{ fontWeight: 500, fontSize: 13.5, color: "var(--bms-text)" }}>Password</span>}
                rules={[{ required: true, message: "Please enter your password" }]}
                style={{ marginBottom: 6 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: "var(--bms-text-3)" }} />}
                  placeholder="Enter your password"
                  style={{ borderRadius: 9, height: 46 }}
                  autoComplete="current-password"
                  iconRender={(visible) =>
                    visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                  }
                />
              </Form.Item>

              <div style={{ textAlign: "right", marginBottom: 8 }}>
                <Link to="/forgot-password" style={{ color: "var(--bms-primary)", fontSize: 13, fontWeight: 500 }}>
                  Forgot password?
                </Link>
              </div>

              <Form.Item style={{ marginTop: 24 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  style={{
                    height: 48, borderRadius: 9,
                    fontWeight: 700, fontSize: 15,
                    letterSpacing: 0.2,
                  }}
                >
                  {loading ? "Signing in…" : "Sign In →"}
                </Button>
              </Form.Item>
            </Form>
          )}

          <div style={{
            borderTop: "1px solid var(--bms-border)",
            marginTop: 24, paddingTop: 24,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--bms-text-3)">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
            </svg>
            <Text style={{ color: "var(--bms-text-3)", fontSize: 12 }}>
              Secured by Keycloak SSO
            </Text>
          </div>

          <Text style={{
            display: "block", textAlign: "center",
            color: "var(--bms-text-3)", fontSize: 11.5, marginTop: 20,
          }}>
            © 2025 Hackers Infotech
          </Text>
        </div>
      </div>
    </div>
  );
}
