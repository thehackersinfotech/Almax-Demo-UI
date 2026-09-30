import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Typography, Tabs } from "antd";
import { UserOutlined, TeamOutlined } from "@ant-design/icons";
import { get } from "@/services/api";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";
import { hasPermission } from "@/utils/access";
import MyAttendanceTab from "./MyAttendanceTab";
import TeamAttendanceTab from "./TeamAttendanceTab";
import "./attendanceMatrix.css";

const { Title, Text } = Typography;

interface TeamMeta {
  has_team: boolean;
  direct_count: number;
  indirect_count: number;
}

export default function AttendanceTrackerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  const canHrAttendance = useMemo(
    () => hasPermission(user, permissions, PERMS.HRMS_ATTENDANCE_VIEW),
    [user, permissions],
  );

  const { data: teamMeta } = useQuery<TeamMeta>({
    queryKey: ["leave-team-meta"],
    queryFn: () => get("/leave/team/meta/"),
  });

  const canViewTeam = canHrAttendance || !!teamMeta?.has_team;

  const tabFromUrl = searchParams.get("tab");
  const resolvedTab = tabFromUrl === "team" && canViewTeam ? "team" : "mine";
  const [activeTab, setActiveTab] = useState(resolvedTab);

  useEffect(() => {
    if (tabFromUrl === "team" && !canViewTeam) {
      setActiveTab("mine");
      return;
    }
    setActiveTab(resolvedTab);
  }, [tabFromUrl, canViewTeam, resolvedTab]);

  const tabItems = useMemo(() => {
    const items = [
      {
        key: "mine",
        label: <span><UserOutlined /> My Attendance</span>,
        children: <MyAttendanceTab />,
      },
    ];
    if (canViewTeam) {
      items.push({
        key: "team",
        label: <span><TeamOutlined /> Team Attendance</span>,
        children: <TeamAttendanceTab />,
      });
    }
    return items;
  }, [canViewTeam]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>Attendance</Title>
        <Text style={{ color: "var(--bms-text-2)", fontSize: 13 }}>
          View your monthly calendar or review team attendance by reporting line.
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
