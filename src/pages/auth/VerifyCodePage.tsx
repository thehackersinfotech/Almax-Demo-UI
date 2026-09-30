import { useState } from "react";
import { Form, Input, Button, Alert, message, Typography } from "antd";
import { SafetyOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { post } from "@/services/api";
import AuthLayout from "@/components/auth/AuthLayout";

const { Text } = Typography;

export default function VerifyCodePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const identifier = (location.state as { identifier?: string })?.identifier || "";

  if (!identifier) {
    return (
      <AuthLayout title="Verification required" subtitle="Please start the password reset process first.">
        <Link to="/forgot-password">Go to forgot password</Link>
      </AuthLayout>
    );
  }

  const onFinish = async (values: { otp: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await post<{ reset_token: string }>("/auth/forgot-password/verify/", {
        identifier,
        otp: values.otp.trim(),
      });
      message.success("Code verified! Set your new password.");
      navigate("/reset-password", { state: { resetToken: res.reset_token } });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await post("/auth/forgot-password/", { identifier });
      message.success("A new verification code has been sent.");
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Unable to resend code.");
    }
  };

  return (
    <AuthLayout
      title="Enter verification code"
      subtitle={`We sent a 6-digit code to the email linked with "${identifier}".`}
    >
      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 20, borderRadius: 8 }} closable onClose={() => setError(null)} />
      )}

      <Form onFinish={onFinish} layout="vertical" requiredMark={false} size="large">
        <Form.Item
          name="otp"
          label={<span style={{ fontWeight: 500, fontSize: 13.5 }}>6-digit code</span>}
          rules={[
            { required: true, message: "Please enter the verification code" },
            { len: 6, message: "Code must be exactly 6 digits" },
            { pattern: /^\d{6}$/, message: "Code must contain only numbers" },
          ]}
        >
          <Input
            prefix={<SafetyOutlined style={{ color: "#a0abbe" }} />}
            placeholder="000000"
            style={{ borderRadius: 9, height: 46, letterSpacing: 6, fontSize: 18, fontFamily: "monospace" }}
            maxLength={6}
            inputMode="numeric"
          />
        </Form.Item>

        <Form.Item style={{ marginTop: 8 }}>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{
              height: 48, borderRadius: 9, fontWeight: 700, fontSize: 15,
              background: "#1677ff", boxShadow: "0 4px 14px rgba(22,119,255,0.35)",
            }}
          >
            Verify code
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: "center", marginTop: 8 }}>
        <Text style={{ color: "var(--bms-text-2)", fontSize: 13 }}>
          Didn't receive the code?{" "}
          <Button type="link" onClick={handleResend} style={{ padding: 0, fontSize: 13 }}>
            Resend
          </Button>
        </Text>
      </div>
    </AuthLayout>
  );
}
