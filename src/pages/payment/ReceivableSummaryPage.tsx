import { useMemo } from "react";
import { Tabs, Typography } from "antd";
import { useSearchParams } from "react-router-dom";
import ClientReceivableSection from "./receivables/ClientReceivableSection";
import ProjectReceivableSection from "./receivables/ProjectReceivableSection";

const { Title } = Typography;

type ReceivableTab = "client" | "project";

export default function ReceivableSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: ReceivableTab = searchParams.get("tab") === "project" ? "project" : "client";

  const items = useMemo(
    () => [
      {
        key: "client",
        label: "Client-wise",
        children: <ClientReceivableSection showTitle={false} />,
      },
      {
        key: "project",
        label: "Project-wise",
        children: <ProjectReceivableSection showTitle={false} />,
      },
    ],
    [],
  );

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>Receivable Summary</Title>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setSearchParams(key === "client" ? {} : { tab: key }, { replace: true })}
        items={items}
        destroyOnHidden={false}
      />
    </div>
  );
}
