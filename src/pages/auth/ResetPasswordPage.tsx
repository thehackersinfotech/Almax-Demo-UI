import { useState } from "react";
import { Form, Button, Alert, message } from "antd";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { post } from "@/services/api";
import AuthLayout from "@/components/auth/AuthLayout";
import PasswordStrengthInput, { evaluatePasswordStrength } from "@/components/auth/PasswordStrengthInput";
import { passwordMatchValidator } from "@/utils/passwordValidation";

export default function ResetPasswordPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const resetToken = (location.state as { resetToken?: string })?.resetToken || "";

  if (!resetToken) {
    return (
      <AuthLayout title="Reset password" subtitle="Please complete verification first.">
        <Link to="/forgot-password">Start over</Link>
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
      await post("/auth/reset-password/", {
        reset_token: resetToken,
        password: values.password,
        confirm_password: values.confirm_password,
      });
      message.success("Password updated! You can now sign in.");
      navigate("/login", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Set new password"
      subtitle="Choose a strong password for your account."
    >
      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 20, borderRadius: 8 }} closable onClose={() => setError(null)} />
      )}

      <Form form={form} onFinish={onFinish} layout="vertical" requiredMark={false} size="large">
        <Form.Item
          name="password"
          label={<span style={{ fontWeight: 500, fontSize: 13.5 }}>New password</span>}
          rules={[{ required: true, message: "Please enter a new password" }]}
        >
          <PasswordStrengthInput placeholder="Enter new password" />
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
          <PasswordStrengthInput placeholder="Confirm new password" showRules={false} />
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
            Reset password
          </Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
}
