import { useState } from "react";
import { Form, Input, Button, Alert, message } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { post } from "@/services/api";
import AuthLayout from "@/components/auth/AuthLayout";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onFinish = async (values: { identifier: string }) => {
    setLoading(true);
    setError(null);
    try {
      await post("/auth/forgot-password/", { identifier: values.identifier.trim() });
      message.success("If your account exists, a verification code has been sent to your email.");
      navigate("/verify-code", { state: { identifier: values.identifier.trim() } });
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Unable to send verification code. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your username or email address. We'll send you a 6-digit verification code."
    >
      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 20, borderRadius: 8 }} closable onClose={() => setError(null)} />
      )}

      <Form onFinish={onFinish} layout="vertical" requiredMark={false} size="large">
        <Form.Item
          name="identifier"
          label={<span style={{ fontWeight: 500, fontSize: 13.5 }}>Username or email</span>}
          rules={[{ required: true, message: "Please enter your username or email" }]}
        >
          <Input
            prefix={<UserOutlined style={{ color: "#a0abbe" }} />}
            placeholder="Enter username or email"
            style={{ borderRadius: 9, height: 46 }}
            autoComplete="username"
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
            Send verification code
          </Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
}
