import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, Typography, Badge } from "antd";
import { UserOutlined, TeamOutlined } from "@ant-design/icons";
import { usePermission } from "@/hooks/usePermission";
import { PERMS } from "@/constants/permissions";
import { timesheetApi } from "@/services/timesheets";
import MyTimesheetPage from "./MyTimesheetPage";
import ReportingTimesheetPage from "./ReportingTimesheetPage";

const { Title, Text } = Typography;

export default function TimesheetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewMine = usePermission(PERMS.PROJECT_TIMESHEET_VIEW);
  const canViewTeam = usePermission(PERMS.PROJECT_TIMESHEET_APPROVE);

  const { data: teamDash } = useQuery({
    queryKey: ["reporting-dashboard"],
    queryFn: () => timesheetApi.reportingDashboard(),
    enabled: canViewTeam,
    staleTime: 60_000,
  });

  const tabFromUrl = searchParams.get("tab");
  const resolvedTab = useMemo(() => {
    if (tabFromUrl === "team" && canViewTeam) return "team";
    if (canViewMine) return "mine";
    if (canViewTeam) return "team";
    return "mine";
  }, [tabFromUrl, canViewMine, canViewTeam]);
  const [activeTab, setActiveTab] = useState(resolvedTab);

  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  const tabItems = useMemo(() => {
    const items = [];
    if (canViewMine) {
      items.push({
        key: "mine",
        label: <span><UserOutlined /> My Timesheet</span>,
        children: <MyTimesheetPage embedded />,
      });
    }
    if (canViewTeam) {
      items.push({
        key: "team",
        label: (
          <span>
            <TeamOutlined /> Team Timesheet
            {(teamDash?.pending_reviews ?? 0) > 0 && (
              <Badge count={teamDash?.pending_reviews} style={{ marginLeft: 6 }} size="small" />
            )}
          </span>
        ),
        children: <ReportingTimesheetPage embedded />,
      });
    }
    return items;
  }, [canViewMine, canViewTeam, teamDash?.pending_reviews]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>Timesheets</Title>
        <Text style={{ color: "var(--bms-text-2)", fontSize: 13 }}>
          Log your weekly hours and review team submissions for projects you manage.
        </Text>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setSearchParams(key === "mine" ? {} : { tab: key });
        }}
        items={tabItems}
        type="card"
      />
    </div>
  );
}
