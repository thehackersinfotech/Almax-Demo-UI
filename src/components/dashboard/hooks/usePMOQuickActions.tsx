import { useNavigate } from "react-router-dom";
import {
  ProjectOutlined,
  BugOutlined,
  ScheduleOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import type { QuickAction } from "../shell/QuickActionBar";

export function usePMOQuickActions(): QuickAction[] {
  const navigate = useNavigate();

  return [
    {
      key: "projects",
      label: "Projects",
      icon: <ProjectOutlined />,
      onClick: () => navigate("/projects"),
    },
    {
      key: "tickets",
      label: "Tickets",
      icon: <BugOutlined />,
      onClick: () => navigate("/tickets"),
    },
    {
      key: "timesheets",
      label: "Review timesheets",
      icon: <ScheduleOutlined />,
      onClick: () => navigate("/timesheets?tab=team"),
      primary: true,
    },
    {
      key: "reports",
      label: "Reports",
      icon: <BarChartOutlined />,
      onClick: () => navigate("/reports"),
    },
  ];
}
