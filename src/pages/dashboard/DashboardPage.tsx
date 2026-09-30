import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Table, Typography, Button, Collapse, Progress, Empty,
} from "antd";
import {
  ProjectOutlined, RocketOutlined, SafetyCertificateOutlined, WarningOutlined,
  FileTextOutlined, FolderOpenOutlined, CheckCircleOutlined, ClockCircleOutlined,
} from "@ant-design/icons";
import { Pie } from "@ant-design/charts";
import dayjs from "dayjs";
import { dashboardApi, type PMOAlert, type PMODashboard, type PortfolioProject } from "@/services/dashboard";
import WeeklyHoursTrendChart from "@/components/dashboard/widgets/WeeklyHoursTrendChart";
import ProjectHoursBarChart from "@/components/dashboard/widgets/ProjectHoursBarChart";
import { useThemeStore } from "@/store/theme";
import { PROJECT_TYPE_COLORS, PROJECT_BAR_COLORS } from "@/utils/chartColors";
import {
  DashboardShell,
  DashboardHeader,
  DashboardGrid,
  DashboardPanel,
  AttentionQueue,
  PeriodControl,
  QuickActionBar,
  ActionMetric,
  HealthRing,
  WorkQueue,
  WorkPipelinePanel,
  AnimatedNumber,
  EmptyGuide,
  DashboardPageSkeleton,
  DashboardAlertModal,
  useDashboardPeriod,
  usePMOQuickActions,
} from "@/components/dashboard";
import HealthStatusTag, { healthMetaColor } from "@/components/common/HealthStatusTag";
import PercentChip from "@/components/common/PercentChip";
import { HEALTH_DELAYED, HEALTH_AT_RISK } from "@/utils/semanticColors";
import { useAuthStore } from "@/store/auth";

const { Text } = Typography;

const HEALTH_ORDER: Record<string, number> = {
  DELAYED: 0,
  AT_RISK: 1,
  ON_TRACK: 2,
};

function sortPortfolio(projects: PortfolioProject[]) {
  return [...projects].sort((a, b) => {
    const h = (HEALTH_ORDER[a.health] ?? 9) - (HEALTH_ORDER[b.health] ?? 9);
    if (h !== 0) return h;
    if (a.days_left == null && b.days_left == null) return 0;
    if (a.days_left == null) return 1;
    if (b.days_left == null) return -1;
    return a.days_left - b.days_left;
  });
}

function deliveryQueueMeta(project: PortfolioProject): { meta: string; metaColor?: string } {
  if (project.days_left == null) {
    return {
      meta: `${project.open_tickets} open tickets`,
      metaColor: project.health !== "ON_TRACK" ? healthMetaColor(project.health) : undefined,
    };
  }
  if (project.days_left < 0) {
    return {
      meta: `${Math.abs(project.days_left)}d overdue · ${project.completion_pct}% done`,
      metaColor: HEALTH_DELAYED.text,
    };
  }
  if (project.days_left < 14) {
    return {
      meta: `${project.days_left}d left · ${project.open_tickets} open`,
      metaColor: project.health === "DELAYED" ? HEALTH_DELAYED.text : HEALTH_AT_RISK.text,
    };
  }
  return { meta: `${project.days_left}d left · ${project.open_tickets} open tickets` };
}

function ProjectTypeChart({ data }: { data: PMODashboard["projects"]["project_type_breakdown"] }) {
  const isDark = useThemeStore((s) => s.isDark);
  if (!data.length)
    return <Empty description="No active projects" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const sorted = [...data].sort((a, b) => a.business_type.localeCompare(b.business_type));
  const total = sorted.reduce((s, d) => s + d.count, 0);
  const pieData = sorted.map((d, i) => ({
    business_type: d.business_type,
    value: d.count,
    color: PROJECT_TYPE_COLORS[i % PROJECT_TYPE_COLORS.length],
  }));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 28 }}>
      <div style={{ width: 180, flexShrink: 0 }}>
        <Pie
          data={pieData}
          theme={isDark ? "dark" : "light"}
          angleField="value"
          colorField="business_type"
          color={({ business_type }: any) => pieData.find((p) => p.business_type === business_type)?.color ?? "#ccc"}
          radius={0.85}
          innerRadius={0.6}
          label={false}
          legend={false}
          height={180}
          tooltip={{
            title: (d: any) => d.business_type,
            items: [{ field: "value", name: "Count" }],
          }}
          statistic={{
            title: { content: "Active", style: { color: isDark ? "#9aa0a6" : "#5f6368" } },
            content: { content: String(total), style: { color: isDark ? "#e8eaed" : "#202124" } },
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200, maxWidth: 320, flex: "1 1 260px" }}>
        {sorted.map((d, i) => {
          const color = PROJECT_TYPE_COLORS[i % PROJECT_TYPE_COLORS.length];
          return (
            <div key={d.business_type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
              <Text style={{ fontSize: 12, flex: 1, color: "var(--bms-text)" }}>{d.business_type}</Text>
              <Text style={{ fontSize: 12, fontWeight: 600, color }}>{d.count}</Text>
              <div style={{ width: 60 }}>
                <Progress percent={d.pct} strokeColor={color} showInfo={false} size="small" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TicketTypeChart({ data }: { data: PMODashboard["ticket_by_type"] }) {
  const isDark = useThemeStore((s) => s.isDark);
  if (!data.length)
    return <Empty description="No tickets yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const total = data.reduce((s, d) => s + d.count, 0);
  const pieData = data.map((d, i) => ({
    ticket_type: d.type,
    value: d.count,
    color: PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length],
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ width: 150 }}>
        <Pie
          data={pieData}
          theme={isDark ? "dark" : "light"}
          angleField="value"
          colorField="ticket_type"
          color={({ ticket_type }: any) => pieData.find((p) => p.ticket_type === ticket_type)?.color ?? "#ccc"}
          radius={0.85}
          innerRadius={0.6}
          label={false}
          legend={false}
          height={150}
          tooltip={{
            title: (d: any) => d.ticket_type,
            items: [{ field: "value", name: "Count" }],
          }}
          statistic={{
            title: { content: "Total", style: { color: isDark ? "#9aa0a6" : "#5f6368" } },
            content: { content: String(total), style: { color: isDark ? "#e8eaed" : "#202124" } },
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
        {data.map((d, i) => {
          const color = PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length];
          return (
            <div key={d.type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <Text style={{ fontSize: 12, flex: 1, color: "var(--bms-text)" }}>{d.type}</Text>
              <Text style={{ fontSize: 12, fontWeight: 600, color }}>{d.count}</Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { period, setPeriod, year, month, label } = useDashboardPeriod();
  const quickActions = usePMOQuickActions();
  const [activeAlert, setActiveAlert] = useState<PMOAlert | null>(null);
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pmo-dashboard", year, month],
    queryFn: () => dashboardApi.pmo(year, month),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const alertKey = searchParams.get("alert");
    if (!alertKey) return;
    const found = data.alerts.find((a) => a.key === alertKey);
    if (found) setActiveAlert(found);
    const next = new URLSearchParams(searchParams);
    next.delete("alert");
    setSearchParams(next, { replace: true });
  }, [data, searchParams, setSearchParams]);

  const weeklyTrend = data?.logging.weekly_trend ?? [];

  const deliveryItems = useMemo(() => {
    if (!data) return [];
    return sortPortfolio(data.portfolio.projects)
      .slice(0, 8)
      .map((p) => {
        const { meta, metaColor } = deliveryQueueMeta(p);
        return {
          id: p.id,
          title: `${p.code} — ${p.name}`,
          subtitle: p.client ?? "No client",
          badge: { label: "", healthStatus: p.health },
          meta,
          metaColor,
          onClick: () => navigate(`/projects/${p.id}`),
        };
      });
  }, [data, navigate]);

  if (isLoading) {
    return (
      <DashboardShell>
        <DashboardPageSkeleton />
      </DashboardShell>
    );
  }

  if (error || !data) {
    return (
      <DashboardShell>
        <Alert type="error" message="Failed to load project dashboard" showIcon />
      </DashboardShell>
    );
  }

  const d: PMODashboard = data;

  const projectColumns = [
    {
      title: "Project", key: "name", ellipsis: true,
      render: (_: unknown, r: PortfolioProject) => (
        <div>
          <code style={{ fontSize: 11, color: "var(--bms-primary)", marginRight: 6 }}>{r.code}</code>
          <Text strong style={{ fontSize: 13 }}>{r.name}</Text>
          <div><Text type="secondary" style={{ fontSize: 11 }}>{r.client ?? "—"}</Text></div>
        </div>
      ),
    },
    {
      title: "Health", dataIndex: "health", width: 100,
      render: (h: string) => <HealthStatusTag status={h} />,
    },
    {
      title: "Completion", dataIndex: "completion_pct", width: 110, align: "right" as const,
      render: (v: number) => <PercentChip value={v} mode="completion" decimals={0} />,
    },
    {
      title: "Tickets", key: "tickets", width: 90,
      render: (_: unknown, r: PortfolioProject) => (
        <span style={{ fontSize: 12 }}>{r.open_tickets} / {r.total_tickets}</span>
      ),
    },
    {
      title: "Hours", key: "hours", width: 100,
      render: (_: unknown, r: PortfolioProject) => (
        <span style={{ fontSize: 12 }}>{r.logged_hours_month}h</span>
      ),
    },
    {
      title: "Due", key: "due", width: 90,
      render: (_: unknown, r: PortfolioProject) => {
        if (r.days_left == null) return "—";
        const color = r.days_left < 0 ? "var(--bms-danger)" : r.days_left < 14 ? "var(--bms-warning)" : undefined;
        return (
          <span style={{ fontSize: 12, color }}>
            {r.days_left < 0 ? `${Math.abs(r.days_left)}d late` : `${r.days_left}d`}
          </span>
        );
      },
    },
  ];

  const handleAlertClick = (alert: PMOAlert) => setActiveAlert(alert);

  const openFirstAlert = (key: PMOAlert["key"]) => {
    const found = d.alerts.find((a) => a.key === key);
    if (found) setActiveAlert(found);
  };

  return (
    <DashboardShell>
      <DashboardHeader
        title="Portfolio Command Center"
        subtitle={`Delivery, resources & compliance — ${label}`}
        periodControl={<PeriodControl value={period} onChange={setPeriod} />}
        actions={<QuickActionBar actions={quickActions} />}
      />

      <AttentionQueue
        items={d.alerts}
        onItemClick={handleAlertClick}
        emptyMessage="All clear — no items need immediate attention this period."
      />

      <div className="dash-metrics" key={`metrics-${year}-${month}`}>
        <ActionMetric
          label="Total projects"
          countTo={d.projects.total}
          value={d.projects.total}
          sub="In portfolio"
          accent="neutral"
          icon={<ProjectOutlined />}
          animateDelay={0}
          actions={[{ label: "View all", onClick: () => navigate("/projects") }]}
        />
        <ActionMetric
          label="Active projects"
          countTo={d.projects.active}
          value={d.projects.active}
          sub="Currently in delivery"
          accent="primary"
          icon={<RocketOutlined />}
          animateDelay={40}
          actions={[{ label: "Allocation", onClick: () => navigate("/allocation") }]}
        />
        <ActionMetric
          label="On-track projects"
          countTo={d.projects.on_track}
          value={d.projects.on_track}
          sub="Healthy delivery status"
          accent="success"
          icon={<SafetyCertificateOutlined />}
          animateDelay={80}
        />
        <ActionMetric
          label="Delayed projects"
          countTo={d.projects.delayed}
          value={d.projects.delayed}
          sub={`${d.projects.at_risk} more at risk`}
          accent={d.projects.delayed > 0 ? "danger" : "neutral"}
          icon={<WarningOutlined />}
          animateDelay={120}
          actions={d.projects.delayed > 0 ? [{ label: "Review", onClick: () => openFirstAlert("delayed_projects") }] : []}
        />
        <ActionMetric
          label="Total tickets"
          countTo={d.work_items.total}
          value={d.work_items.total}
          sub="Across all projects"
          accent="neutral"
          icon={<FileTextOutlined />}
          animateDelay={160}
          actions={[{ label: "View tickets", onClick: () => navigate("/tickets") }]}
        />
        <ActionMetric
          label="Open tickets"
          countTo={d.work_items.open}
          value={d.work_items.open}
          sub={`${d.work_items.overdue} overdue`}
          accent={d.work_items.overdue > 0 ? "warning" : "info"}
          icon={<FolderOpenOutlined />}
          animateDelay={200}
          actions={d.work_items.overdue > 0 ? [{ label: "View overdue", onClick: () => openFirstAlert("overdue_tickets") }] : []}
        />
        <ActionMetric
          label="Closed tickets"
          countTo={d.work_items.done}
          value={d.work_items.done}
          sub="Completed"
          accent="success"
          icon={<CheckCircleOutlined />}
          animateDelay={240}
        />
        <ActionMetric
          label="Billable utilization"
          countTo={Math.round(d.logging.billing_utilization_percent)}
          formatCount={(n) => `${n}%`}
          value={`${Math.round(d.logging.billing_utilization_percent)}%`}
          accent="info"
          icon={<ClockCircleOutlined />}
          progress={Math.min(100, Math.round(d.logging.billing_utilization_percent))}
          progressLabel={`${d.logging.billable_hours}h billable this month`}
          animateDelay={280}
          actions={[{ label: "Timesheets", onClick: () => navigate("/timesheets?tab=team") }]}
        />
      </div>

      <div className="exec-dash-section exec-dash-section--reveal" key={`pmo-grid-${year}-${month}`}>
      <div className="dash-grid dash-grid--pmo">
        <DashboardPanel
          className="dash-grid-area-queue exec-chart-panel--reveal"
          title="Delivery queue"
          meta="Sorted by urgency — delayed and at-risk first"
          extra={
            <Button type="link" size="small" onClick={() => navigate("/projects")}>
              All projects
            </Button>
          }
          flush
        >
          <WorkQueue
            items={deliveryItems}
            emptyTitle="No active projects"
            emptyDescription="Create a project or adjust filters to see delivery work here."
            emptyAction={
              <Button type="primary" onClick={() => navigate("/projects")}>
                View projects
              </Button>
            }
          />
        </DashboardPanel>

        <DashboardPanel
          className="dash-grid-area-health exec-chart-panel--reveal exec-chart-panel--reveal-d1"
          title="Portfolio health"
          meta={`${d.projects.active} active projects`}
        >
          <HealthRing
            centerLabel="Tracked"
            centerCountTo={d.projects.active}
            animate
            segments={[
              { key: "on_track", label: "On track", value: d.projects.on_track, color: "#188038" },
              { key: "at_risk", label: "At risk", value: d.projects.at_risk, color: "#e37400" },
              { key: "delayed", label: "Delayed", value: d.projects.delayed, color: "#c5221f" },
            ]}
          />
        </DashboardPanel>

        <DashboardPanel className="dash-grid-area-trend exec-chart-panel--reveal exec-chart-panel--reveal-d1" title="Weekly hours trend" meta="Last 8 weeks">
          {weeklyTrend.length > 0 ? (
            <WeeklyHoursTrendChart
              weeks={weeklyTrend}
              utilizationPct={d.team.avg_utilization_percent}
            />
          ) : (
            <EmptyGuide
              title="No time logged yet"
              description="Hours will appear here once the team logs work this period."
              actionLabel="Open timesheets"
              onAction={() => navigate("/timesheets")}
            />
          )}
        </DashboardPanel>

        <DashboardPanel className="dash-grid-area-hours exec-chart-panel--reveal exec-chart-panel--reveal-d2" title="Hours by project" meta={label}>
          {d.logging.hours_by_project.length > 0 ? (
            <div className="dash-chart-fill">
              <ProjectHoursBarChart rows={d.logging.hours_by_project} />
            </div>
          ) : (
            <EmptyGuide
              title="No hours logged"
              description="Project hours will appear here for the selected period."
              actionLabel="Open timesheets"
              onAction={() => navigate("/timesheets")}
            />
          )}
        </DashboardPanel>

        <DashboardPanel
          className="dash-grid-area-pipeline exec-chart-panel--reveal exec-chart-panel--reveal-d2"
          title="Work pipeline"
          meta={`${d.work_items.overdue} overdue`}
        >
          <WorkPipelinePanel
            items={d.work_items}
            onOverdueClick={d.work_items.overdue > 0 ? () => openFirstAlert("overdue_tickets") : undefined}
          />
        </DashboardPanel>
      </div>
      </div>

      <div className="exec-dash-section exec-dash-section--reveal exec-dash-section--reveal-d2" key={`type-breakdown-${year}-${month}`}>
        <DashboardGrid
          primary={
            <DashboardPanel
              title="Project allocation by type"
              meta={`${d.projects.active} active projects`}
            >
              <ProjectTypeChart data={d.projects.project_type_breakdown} />
            </DashboardPanel>
          }
          secondary={
            <DashboardPanel title="Tickets by type" meta={`${d.work_items.total} total tickets`}>
              <TicketTypeChart data={d.ticket_by_type} />
            </DashboardPanel>
          }
        />
      </div>

      <div className="dash-portfolio-section exec-dash-section exec-dash-section--reveal exec-dash-section--reveal-d2">
        <Collapse
          defaultActiveKey={["portfolio"]}
          items={[
            {
              key: "portfolio",
              label: (
                <span style={{ fontWeight: 600 }}>
                  Full portfolio ({d.portfolio.projects.length} projects)
                </span>
              ),
              children: (
                <div className="dash-table-wrap">
                  <Table
                    dataSource={sortPortfolio(d.portfolio.projects)}
                    columns={projectColumns}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"] }}
                    scroll={{ x: 800, y: 420 }}
                    onRow={(r) => ({
                      style: { cursor: "pointer" },
                      onClick: () => navigate(`/projects/${r.id}`),
                    })}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      <DashboardAlertModal
        alert={activeAlert}
        data={d}
        open={!!activeAlert}
        onClose={() => setActiveAlert(null)}
        onNavigate={(path) => {
          setActiveAlert(null);
          navigate(path);
        }}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ["pmo-dashboard", year, month] });
        }}
      />
    </DashboardShell>
  );
}
