import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert, Select, Typography, Modal, Spin, Empty,
} from "antd";
import {
  TeamOutlined, ShopOutlined, ProjectOutlined, DollarOutlined,
  RiseOutlined, FallOutlined, GlobalOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, RocketOutlined,
  FunnelPlotOutlined,
} from "@ant-design/icons";
import { Pie } from "@ant-design/charts";
import { useThemeStore } from "@/store/theme";
import { PROJECT_TYPE_COLORS } from "@/utils/chartColors";
import {
  DashboardShell,
  DashboardHeader,
  DashboardGrid,
  DashboardPanel,
  AttentionQueue,
  QuickActionBar,
  ActionMetric,
  DashboardPageSkeleton,
  HealthRing,
  type AttentionItem,
  type QuickAction,
} from "@/components/dashboard";
import ExecutiveClientMap from "@/components/dashboard/ExecutiveClientMap";
import ExecutivePipelinePanel from "@/components/dashboard/ExecutivePipelinePanel";
import ExecutivePortfolioPanel from "@/components/dashboard/ExecutivePortfolioPanel";
import { BillingMonthlyChart, PaymentMonthlyChart } from "@/components/dashboard/ExecutiveMonthlyCharts";
import {
  dashboardApi,
  type ExecutiveDashboard,
  type ExecutiveProjectDetail,
} from "@/services/dashboard";

const { Text } = Typography;

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function RevenueByTypeChart({ data }: { data: ExecutiveDashboard["revenue_by_project_type"] }) {
  const isDark = useThemeStore((s) => s.isDark);
  if (!data.length)
    return <Empty description="No invoices recorded for this financial year yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const sorted = [...data].sort((a, b) => a.business_type.localeCompare(b.business_type));
  const totalCollected = sorted.reduce((s, d) => s + d.received, 0);
  const pieData = sorted.map((d, i) => ({
    type: d.business_type,
    value: d.received,
    color: PROJECT_TYPE_COLORS[i % PROJECT_TYPE_COLORS.length],
  }));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 28 }}>
      <div style={{ width: 180, flexShrink: 0 }}>
        <Pie
          data={pieData}
          theme={isDark ? "dark" : "light"}
          angleField="value"
          colorField="type"
          color={({ type }: any) => pieData.find((p) => p.type === type)?.color ?? "#ccc"}
          radius={0.85}
          innerRadius={0.6}
          label={false}
          legend={false}
          height={180}
          tooltip={{
            items: [{ field: "value", name: "Collected", valueFormatter: (v: number) => fmt(v) }],
          }}
          statistic={{
            title: { content: "Collected", style: { color: isDark ? "#9aa0a6" : "#5f6368" } },
            content: { content: fmt(totalCollected), style: { color: isDark ? "#e8eaed" : "#202124", fontSize: 15 } },
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 260, maxWidth: 380, flex: "1 1 320px" }}>
        {sorted.map((d, i) => {
          const color = PROJECT_TYPE_COLORS[i % PROJECT_TYPE_COLORS.length];
          return (
            <div key={d.business_type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
              <Text style={{ fontSize: 12, flex: 1, color: "var(--bms-text)" }}>{d.business_type}</Text>
              <Text style={{ fontSize: 11, color: "var(--bms-text-3)", whiteSpace: "nowrap" }}>
                Billed {fmt(d.invoiced)}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: 600, color, minWidth: 80, textAlign: "right", whiteSpace: "nowrap" }}>
                {fmt(d.received)}
              </Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopProjectTypeCard({ data, fyLabel }: { data: ExecutiveDashboard["revenue_by_project_type"]; fyLabel: string }) {
  if (!data.length)
    return <Empty description="No invoices recorded for this financial year yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const topByReceived = [...data].sort((a, b) => b.received - a.received)[0];
  const topByInvoiced = [...data].sort((a, b) => b.invoiced - a.invoiced)[0];
  const totalInvoiced = data.reduce((s, d) => s + d.invoiced, 0);
  const totalReceived = data.reduce((s, d) => s + d.received, 0);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalReceived / totalInvoiced) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>
      <div>
        <Text type="secondary" style={{ fontSize: 11 }}>Top collected — {fyLabel}</Text>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--bms-success)" }}>{topByReceived.business_type}</div>
        <Text style={{ fontSize: 13 }}>{fmt(topByReceived.received)} collected</Text>
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 11 }}>Top billed</Text>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--bms-primary)" }}>{topByInvoiced.business_type}</div>
        <Text style={{ fontSize: 13 }}>{fmt(topByInvoiced.invoiced)} billed</Text>
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 11 }}>Overall collection rate</Text>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{collectionRate}%</div>
      </div>
    </div>
  );
}

function currentFyStart(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function ProjectDetailModal({
  projectId,
  fyStartYear,
  open,
  onClose,
}: {
  projectId: string | null;
  fyStartYear: number;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<ExecutiveProjectDetail>({
    queryKey: ["exec-project", projectId, fyStartYear],
    queryFn: () => dashboardApi.executiveProject(projectId!, fyStartYear),
    enabled: open && !!projectId,
  });

  const f = data?.financials;
  const marginColor = (f?.gross_margin ?? 0) >= 0 ? "var(--bms-success)" : "var(--bms-danger)";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      title={data ? `${data.project.code} — ${data.project.name}` : "Project financials"}
      destroyOnHidden
      styles={{ body: { paddingTop: 12 } }}
    >
      {isLoading && <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>}
      {data && f && (
        <div className="exec-project-detail">
          <Text type="secondary" className="exec-project-detail__fy">
            {data.fy.label} · {data.fy.start_date} → {data.fy.end_date}
          </Text>

          <div className="dash-metrics dash-metrics--modal">
            <ActionMetric
              label="Logged (FY)"
              value={`${data.hours.logged_fy}h`}
              sub={`Est. ${data.project.estimated_hours}h`}
              accent="primary"
              icon={<ProjectOutlined />}
            />
            <ActionMetric
              label="Invoiced"
              value={fmt(f.revenue_invoiced)}
              accent="primary"
              icon={<DollarOutlined />}
            />
            <ActionMetric
              label="Received"
              value={fmt(f.revenue_received)}
              accent="success"
              icon={<CheckCircleOutlined />}
            />
            <ActionMetric
              label="Gross margin"
              value={fmt(f.gross_margin)}
              sub={f.gross_margin_pct != null ? `${f.gross_margin_pct}%` : undefined}
              accent={(f.gross_margin ?? 0) >= 0 ? "success" : "danger"}
              icon={(f.gross_margin ?? 0) >= 0 ? <RiseOutlined /> : <FallOutlined />}
            />
          </div>

          <div className="exec-project-detail__breakdown">
            {[
              { label: "Billable hours", value: `${data.hours.billable_fy} h` },
              { label: "Non-billable", value: `${data.hours.non_billable_fy} h` },
              { label: "Employee cost", value: fmt(f.employee_cost) },
              { label: "Expenses", value: fmt(f.expense_cost) },
            ].map(({ label, value }) => (
              <div key={label} className="exec-project-detail__stat">
                <span className="exec-project-detail__stat-label">{label}</span>
                <span className="exec-project-detail__stat-value">{value}</span>
              </div>
            ))}
          </div>

          <div className="exec-project-detail__formula">
            {(f.gross_margin ?? 0) >= 0 ? (
              <RiseOutlined className="exec-project-detail__formula-icon" style={{ color: marginColor }} />
            ) : (
              <FallOutlined className="exec-project-detail__formula-icon" style={{ color: marginColor }} />
            )}
            <Text strong style={{ color: marginColor }}>
              Gross margin = Invoiced − (employee cost + expenses)
            </Text>
          </div>

          <div className="exec-project-detail__footer">
            <button
              type="button"
              className="dash-quick-btn dash-quick-btn--primary"
              onClick={() => { onClose(); navigate(`/projects/${data.project.id}`); }}
            >
              Open project
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ExecutiveDashboardPage() {
  const navigate = useNavigate();
  const [fyStartYear, setFyStartYear] = useState(currentFyStart());
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ExecutiveDashboard>({
    queryKey: ["executive-dashboard", fyStartYear],
    queryFn: () => dashboardApi.executive(fyStartYear),
    staleTime: 60_000,
  });

  const attentionItems = useMemo((): AttentionItem[] => {
    if (!data) return [];
    const items: AttentionItem[] = [];
    const negativeMargin = data.project_portfolio.filter((p) => p.gross_margin < 0);
    if (negativeMargin.length > 0) {
      items.push({
        key: "negative-margin",
        severity: "error",
        title: "Negative margin projects",
        count: negativeMargin.length,
        detail: "Costs exceed invoiced revenue this FY",
        actionLabel: `View ${negativeMargin.length} project${negativeMargin.length === 1 ? "" : "s"} →`,
      });
    }
    const collectionPct = data.finance.invoiced > 0
      ? (data.finance.received / data.finance.invoiced) * 100
      : 100;
    if (collectionPct < 80 && data.finance.invoiced > 0) {
      items.push({
        key: "collection",
        severity: "warning",
        title: "FY collection gap",
        count: Math.round(100 - collectionPct),
        detail: `${fmt(data.finance.pending)} still pending`,
        path: "/payment/dashboard",
        actionLabel: "Open finance →",
      });
    }
    const overHours = data.project_portfolio.filter(
      (p) => p.estimated_hours > 0 && p.logged_hours_fy > p.estimated_hours * 1.1,
    );
    if (overHours.length > 0) {
      items.push({
        key: "hours",
        severity: "warning",
        title: "Hours over estimate",
        count: overHours.length,
        detail: "Logged above 110% of estimated hours",
        actionLabel: `Review ${overHours.length} project${overHours.length === 1 ? "" : "s"} →`,
      });
    }
    if (data.clients_map.length === 0 && data.projects.active > 0) {
      items.push({
        key: "map",
        severity: "info",
        title: "Clients missing geo",
        count: 1,
        detail: "Add latitude/longitude on Clients page for map view",
        path: "/clients",
        actionLabel: "Add locations →",
      });
    }
    return items;
  }, [data]);

  const quickActions = useMemo((): QuickAction[] => [
    { key: "projects", label: "Projects", icon: <ProjectOutlined />, onClick: () => navigate("/projects"), primary: true },
    { key: "finance", label: "Finance", icon: <DollarOutlined />, onClick: () => navigate("/payment/dashboard") },
    { key: "clients", label: "Clients", icon: <ShopOutlined />, onClick: () => navigate("/clients") },
    { key: "employees", label: "Team", icon: <TeamOutlined />, onClick: () => navigate("/employees") },
  ], [navigate]);

  const collectionPct = data && data.finance.invoiced > 0
    ? Math.round((data.finance.received / data.finance.invoiced) * 100)
    : 0;

  const invoiceTrend = useMemo(
    () => data?.payment_monthly.slice(-6).map((m) => m.invoiced) ?? [],
    [data],
  );
  const receivedTrend = useMemo(
    () => data?.payment_monthly.slice(-6).map((m) => m.received) ?? [],
    [data],
  );

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
        <Alert type="error" message="Failed to load executive dashboard" showIcon />
      </DashboardShell>
    );
  }

  const fyOptions = data.available_fy_years.map((y) => ({
    value: y,
    label: `FY ${y}-${String(y + 1).slice(-2)}`,
  }));

  return (
    <DashboardShell>
      <DashboardHeader
        title="Executive Overview"
        subtitle={`${data.fy.label} · ${data.fy.start_date} → ${data.fy.end_date}`}
        periodControl={
          <Select
            value={fyStartYear}
            onChange={setFyStartYear}
            options={fyOptions}
            style={{ width: 148 }}
          />
        }
        actions={<QuickActionBar actions={quickActions} />}
      />

      <AttentionQueue
        items={attentionItems}
        onItemClick={(item) => {
          if (item.path) navigate(item.path);
          else document.getElementById("exec-portfolio")?.scrollIntoView({ behavior: "smooth" });
        }}
        emptyMessage="FY performance is on track — no executive alerts."
      />

      <div className="dash-metrics" key={`metrics-${fyStartYear}`}>
        <ActionMetric
          label="Total projects"
          countTo={data.projects.total}
          value={data.projects.total}
          sub="In portfolio"
          accent="neutral"
          icon={<ProjectOutlined />}
          animateDelay={0}
          actions={[{ label: "View portfolio", onClick: () => navigate("/projects") }]}
        />
        <ActionMetric
          label="Active projects"
          countTo={data.projects.active}
          value={data.projects.active}
          sub="Currently in delivery"
          accent="primary"
          icon={<RocketOutlined />}
          animateDelay={40}
          actions={[{ label: "View portfolio", onClick: () => navigate("/projects") }]}
        />
        <ActionMetric
          label="Completed projects"
          countTo={data.project_pipeline.completed}
          value={data.project_pipeline.completed}
          sub={`${data.project_pipeline.win_pct}% win rate`}
          accent="success"
          icon={<CheckCircleOutlined />}
          animateDelay={80}
        />
        <ActionMetric
          label="Cancelled projects"
          countTo={data.project_pipeline.cancelled}
          value={data.project_pipeline.cancelled}
          sub="This FY lifecycle"
          accent={data.project_pipeline.cancelled > 0 ? "danger" : "neutral"}
          icon={<CloseCircleOutlined />}
          animateDelay={120}
        />
        <ActionMetric
          label="FY invoiced"
          countTo={data.finance.invoiced}
          formatCount={fmt}
          value={fmt(data.finance.invoiced)}
          accent="primary"
          icon={<DollarOutlined />}
          trend={invoiceTrend}
          animateDelay={160}
          actions={[{ label: "Open finance", onClick: () => navigate("/payment/dashboard") }]}
        />
        <ActionMetric
          label="FY received"
          countTo={data.finance.received}
          formatCount={fmt}
          value={fmt(data.finance.received)}
          accent="success"
          icon={<RiseOutlined />}
          trend={receivedTrend}
          progress={collectionPct}
          progressLabel={`${collectionPct}% of invoiced collected`}
          animateDelay={200}
        />
        <ActionMetric
          label="FY pending"
          countTo={data.finance.pending}
          formatCount={fmt}
          value={fmt(data.finance.pending)}
          sub="Awaiting collection"
          accent={data.finance.pending > 0 ? "warning" : "neutral"}
          icon={<ClockCircleOutlined />}
          animateDelay={240}
          actions={[{ label: "Open finance", onClick: () => navigate("/payment/dashboard") }]}
        />
        <ActionMetric
          label="Active team"
          countTo={data.employees.active}
          value={data.employees.active}
          sub={`${data.employees.total} employees · ${data.vendors.active} vendors`}
          accent="purple"
          icon={<TeamOutlined />}
          animateDelay={280}
          actions={[{ label: "View team", onClick: () => navigate("/employees") }]}
        />
      </div>

      <div className="exec-dash-section exec-dash-section--reveal" key={`pipeline-${fyStartYear}`}>
      <DashboardGrid
        primary={
          <DashboardPanel
            title="Project enquiry pipeline"
            meta={`${data.project_pipeline.total} projects in portfolio`}
            extra={<FunnelPlotOutlined style={{ color: "var(--bms-text-3)" }} />}
          >
            <ExecutivePipelinePanel pipeline={data.project_pipeline} />
          </DashboardPanel>
        }
        secondary={
          <DashboardPanel title="FY collection" meta="Received vs invoiced">
            <div className="exec-finance-panel">
              {data.finance.invoiced > 0 ? (
                <>
                  <HealthRing
                    showLegend={false}
                    centerLabel="Collected"
                    centerCountTo={collectionPct}
                    centerSuffix="%"
                    size={168}
                    animate
                    segments={[
                      { key: "received", label: "Received", value: data.finance.received, color: "#059669" },
                      { key: "pending", label: "Pending", value: Math.max(0, data.finance.pending), color: "#f59e0b" },
                    ]}
                  />
                  <div className="exec-finance-pills">
                    {[
                      { label: "Invoiced", value: fmt(data.finance.invoiced), color: "var(--bms-primary)", dot: "#6366f1" },
                      { label: "Received", value: fmt(data.finance.received), color: "var(--bms-success)", dot: "#059669" },
                      { label: "Pending", value: fmt(data.finance.pending), color: "var(--bms-warning)", dot: "#f59e0b" },
                    ].map(({ label, value, color, dot }, idx) => (
                      <div
                        key={label}
                        className="exec-finance-pills__item exec-finance-pills__item--reveal"
                        style={{ animationDelay: `${500 + idx * 90}ms` }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--bms-text-2)" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                          {label}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Text type="secondary" style={{ fontSize: 13, textAlign: "center", display: "block", padding: "24px 0" }}>
                  No invoices recorded for this financial year yet
                </Text>
              )}
            </div>
          </DashboardPanel>
        }
      />
      </div>

      <div className="exec-dash-section exec-dash-section--reveal exec-dash-section--reveal-d1" key={`charts-${fyStartYear}`}>
      <div className="dash-grid dash-grid--exec-charts">
        <DashboardPanel
          className="dash-grid-area-map exec-chart-panel--reveal"
          title="Clients on map"
          extra={<GlobalOutlined style={{ color: "var(--bms-text-3)" }} />}
        >
          {data.clients_map.length > 0 ? (
            <ExecutiveClientMap clients={data.clients_map} />
          ) : (
            <div className="exec-map-empty">
              <GlobalOutlined style={{ fontSize: 32, color: "var(--bms-text-3)", marginBottom: 12 }} />
              <Text type="secondary">No clients with geo coordinates yet</Text>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                Add latitude / longitude on the Clients page to plot them here
              </Text>
              <button type="button" className="dash-quick-btn" style={{ marginTop: 16 }} onClick={() => navigate("/clients")}>
                Manage clients
              </button>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          className="dash-grid-area-payment exec-chart-panel exec-chart-panel--reveal exec-chart-panel--reveal-d1"
          title="Invoice vs payment (monthly)"
        >
          <PaymentMonthlyChart months={data.payment_monthly ?? []} />
        </DashboardPanel>

        <DashboardPanel
          className="dash-grid-area-billing exec-chart-panel exec-chart-panel--reveal exec-chart-panel--reveal-d2"
          title="Billable vs non-billable hours (monthly)"
        >
          <BillingMonthlyChart months={data.billing_monthly ?? []} />
        </DashboardPanel>
      </div>
      </div>

      <div className="exec-dash-section exec-dash-section--reveal exec-dash-section--reveal-d2" key={`revenue-type-${fyStartYear}`}>
        <DashboardGrid
          primary={
            <DashboardPanel
              title="Revenue by project type"
              meta={`${data.fy.label} — billed & collected`}
            >
              <RevenueByTypeChart data={data.revenue_by_project_type} />
            </DashboardPanel>
          }
          secondary={
            <DashboardPanel title="Top project type" meta="This FY">
              <TopProjectTypeCard data={data.revenue_by_project_type} fyLabel={data.fy.label} />
            </DashboardPanel>
          }
        />
      </div>

      <div className="exec-dash-section exec-dash-section--reveal exec-dash-section--reveal-d2" id="exec-portfolio" key={`portfolio-${fyStartYear}`}>
        <DashboardPanel
          title={`Project portfolio (${data.project_portfolio.length})`}
          meta="FY margin, hours, revenue & cost — click a row for details"
        >
          <ExecutivePortfolioPanel
            projects={data.project_portfolio}
            onProjectClick={setSelectedProject}
          />
        </DashboardPanel>
      </div>

      <ProjectDetailModal
        projectId={selectedProject}
        fyStartYear={fyStartYear}
        open={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </DashboardShell>
  );
}
