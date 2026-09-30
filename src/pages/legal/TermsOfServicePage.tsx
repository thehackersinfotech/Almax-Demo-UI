import { Typography } from "antd";
import { Link } from "react-router-dom";

const { Title, Paragraph, Text } = Typography;

export default function TermsOfServicePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bms-bg, #f5f7fb)",
        padding: "48px 24px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 720, width: "100%" }}>
        <Title level={2}>Terms of Service</Title>
        <Paragraph type="secondary">
          This page is a placeholder. Replace this content with your organization's actual
          terms of service before going live.
        </Paragraph>
        <Paragraph>
          By using this workspace, you agree to use it in accordance with your organization's
          policies and applicable law. Contact your workspace administrator with any questions
          about acceptable use.
        </Paragraph>
        <Text>
          <Link to="/login">← Back to login</Link>
        </Text>
      </div>
    </div>
  );
}
