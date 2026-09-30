import { useEffect, useState } from "react";
import { Form, Button, Alert, Spin, message } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { get, post } from "@/services/api";
import AuthLayout from "@/components/auth/AuthLayout";
import PasswordStrengthInput, { evaluatePasswordStrength } from "@/components/auth/PasswordStrengthInput";
import { passwordMatchValidator } from "@/utils/passwordValidation";

export default function SetPasswordPage() {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    get("/auth/reset-password/validate/?token=" + encodeURIComponent(token) + "&onboard=true")
      .then(() => setTokenValid(true))
      .catch(() => setTokenValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  if (validating) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" tip="Validating your link…" />
      </div>
    );
  }

  if (!token || !tokenValid) {
    return (
      <AuthLayout
        title="Link expired"
        subtitle="This password setup link is invalid or has expired. Please contact HR for a new invitation."
        backLabel="Go to sign in"
      >
        <Alert
          type="warning"
          message="Invalid or expired link"
          description="Ask your administrator to resend the welcome email."
          showIcon
        />
      </AuthLayout>
    );
  }

  const onFinish = async (values: { password: string; confirm_password: string }) => {
    const strength = evaluatePasswordStrength(values.password);
    if (!strength.valid) {
      setError("Please meet all password requirements.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await post("/auth/onboard/set-password/", {
        token,
        password: values.password,
        confirm_password: values.confirm_password,
      });
      message.success("Password set successfully! You can now sign in.");
      navigate("/login", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Unable to set password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome to Hackers Infotech"
      subtitle="Set your password to activate your account."
    >
      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 20, borderRadius: 8 }} closable onClose={() => setError(null)} />
      )}

      <Form form={form} onFinish={onFinish} layout="vertical" requiredMark={false} size="large">
        <Form.Item
          name="password"
          label={<span style={{ fontWeight: 500, fontSize: 13.5 }}>Password</span>}
          rules={[{ required: true, message: "Please enter a password" }]}
        >
          <PasswordStrengthInput placeholder="Create your password" />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label={<span style={{ fontWeight: 500, fontSize: 13.5 }}>Confirm password</span>}
          dependencies={["password"]}
          rules={[
            { required: true, message: "Please confirm your password" },
            ({ getFieldValue }) => ({
              validator: passwordMatchValidator(() => getFieldValue("password")),
            }),
          ]}
        >
          <PasswordStrengthInput placeholder="Confirm your password" showRules={false} />
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
            Activate account
          </Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
}
