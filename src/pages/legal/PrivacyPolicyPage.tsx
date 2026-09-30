import { Typography } from "antd";
import { Link } from "react-router-dom";

const { Title, Paragraph, Text } = Typography;

export default function PrivacyPolicyPage() {
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
        <Title level={2}>Privacy Policy</Title>
        <Paragraph type="secondary">
          This page is a placeholder. Replace this content with your organization's actual
          privacy policy before going live.
        </Paragraph>
        <Paragraph>
          Data entered into this workspace is used to provide the product's project,
          HR, and business-management features. Contact your workspace administrator for
          details on how your organization handles data retention and access.
        </Paragraph>
        <Text>
          <Link to="/login">← Back to login</Link>
        </Text>
      </div>
    </div>
  );
}
