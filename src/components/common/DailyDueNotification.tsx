import { useEffect } from "react";
import { notification } from "antd";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { workspaceApi } from "@/services/workspace";
import { projectsApi } from "@/services/projects";
import { useTenantStore } from "@/store/tenant";

export default function DailyDueNotification() {
  const todayStr = dayjs().format("YYYY-MM-DD");
  const modules = useTenantStore((s) => s.tenant?.modules);
  // Wait until tenant plan modules are known; never call Project APIs on Startups.
  const hasProjectModule = Array.isArray(modules) && modules.includes("project");

  const { data: calData } = useQuery({
    queryKey: ["workspace_calendar", todayStr, todayStr],
    queryFn: () => workspaceApi.calendar(todayStr, todayStr),
  });

  // Starter / Startups plans do not include Project — skip that API entirely.
  const { data: projectsData } = useQuery({
    queryKey: ["due_projects"],
    queryFn: () => projectsApi.list({ limit: 100 }),
    enabled: hasProjectModule,
  });

  useEffect(() => {
    if (!calData?.events) return;
    if (hasProjectModule && !projectsData?.results) return;

    const lastNotified = localStorage.getItem("last_daily_notification_date");
    if (lastNotified === todayStr) return;

    const dueToday = calData.events.filter(
      (ev) =>
        ev.due_date === todayStr ||
        ev.start_date === todayStr ||
        ev.end_date === todayStr
    );

    const dueProjects = hasProjectModule
      ? (projectsData?.results ?? []).filter(
          (proj) => proj.end_date === todayStr && proj.is_active
        )
      : [];

    if (dueToday.length > 0 || dueProjects.length > 0) {
      const todoCount = dueToday.filter((e) => e.source === "todo").length;
      const followUpCount = dueToday.filter((e) => e.source === "followup").length;
      const projectCount = dueProjects.length;

      const msg = [];
      if (todoCount > 0) msg.push(`${todoCount} To-Do(s)`);
      if (followUpCount > 0) msg.push(`${followUpCount} Follow-Up(s)/Meeting(s)`);
      if (projectCount > 0) msg.push(`${projectCount} Project(s)`);

      notification.info({
        message: "Due Today",
        description: `You have ${msg.join(", ")} scheduled or due today.`,
        placement: "topRight",
        duration: 10,
      });

      localStorage.setItem("last_daily_notification_date", todayStr);
    } else {
      localStorage.setItem("last_daily_notification_date", todayStr);
    }
  }, [calData, projectsData, todayStr, hasProjectModule]);

  return null;
}
