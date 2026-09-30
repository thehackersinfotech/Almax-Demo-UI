import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table, Typography, Empty, Spin, Segmented, Button, Space, Tooltip,
} from "antd";
import {
  LeftOutlined, RightOutlined, CheckCircleOutlined, SyncOutlined,
  BarChartOutlined, UnorderedListOutlined, ClockCircleOutlined,
  RiseOutlined, FlagFilled, WarningFilled,
} from "@ant-design/icons";
import { Line, Column } from "@ant-design/charts";
import dayjs, { Dayjs } from "dayjs";
import { employeeApi, type EmployeePerformance } from "@/services/employees";
import DashboardPanel from "@/components/dashboard/shell/DashboardPanel";
import ActionMetric from "@/components/dashboard/widgets/ActionMetric";
import WorkflowChip from "@/components/projects/WorkflowChip";
import {
  HEALTH_DELAYED, HEALTH_ON_TRACK, MARGIN_NEUTRAL, pastelTagStyle, type PastelTone,
} from "@/utils/semanticColors";
import "@/components/dashboard/dashboard.css";

const { Text } = Typography;

type Period = "week" | "month";
type ViewMode = "chart" | "table";

const SERIES = {
  logged: "Logged hours",
  estimated: "Estimated hours",
} as const;

const COLORS = {
  logged: "#2563eb",
  estimated: "#94a3b8",
  monthlyLogged: "#7c3aed",
  monthlyEstimated: "#c4b5fd",
  barLogged: "#2563eb",
  barEstimated: "#e2e8f0",
};

const FLAG_META: Record<string, { tone: PastelTone; label: string; icon: React.ReactNode }> = {
  green:  { tone: HEALTH_ON_TRACK, label: "Good", icon: <CheckCircleOutlined /> },
  normal: { tone: MARGIN_NEUTRAL, label: "On track", icon: <RiseOutlined /> },
  red:    { tone: HEALTH_DELAYED, label: "Escalate", icon: <WarningFilled /> },
};

const IN_PROGRESS_TONE: PastelTone = {
  bg: "#e0f2fe",
  text: "#0369a1",
  border: "#7dd3fc",
  accent: "#0891b2",
};

function performancePctTone(pct: number, isDone: boolean): PastelTone {
  if (pct > 100) return HEALTH_DELAYED;
  if (!isDone) return IN_PROGRESS_TONE;
  if (pct < 90) return HEALTH_ON_TRACK;
  return MARGIN_NEUTRAL;
}

function HoursCell({ value }: { value: number }) {
  return (
    <span className="emp-perf-hours">{fmtHours(value)}</span>
  );
}

function UtilizationCell({
  pct,
  logged,
  estimate,
  isDone,
}: {
  pct: number | null;
  logged: number;
  estimate: number;
  isDone: boolean;
}) {
  if (pct == null) return <span className="emp-perf-muted">—</span>;
  const tone = performancePctTone(pct, isDone);
  return (
    <Tooltip title={`${fmtHours(logged)} logged of ${fmtHours(estimate)} estimated`}>
      <div className="emp-perf-util">
        <div className="emp-perf-util__bar-track">
          <div
            className="emp-perf-util__bar-fill"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: tone.accent,
            }}
          />
        </div>
        <div className="emp-perf-util__meta">
          <span className="emp-perf-util__pct" style={{ color: tone.text }}>
            {pct}%
          </span>
          <span className="emp-perf-util__hours">
            {fmtHours(logged)} / {fmtHours(estimate)}
          </span>
        </div>
      </div>
    </Tooltip>
  );
}

function PerformanceFlagChip({
  flag,
  isDone,
}: {
  flag: string | null | undefined;
  isDone: boolean;
}) {
  if (!isDone) {
    return (
      <span className="emp-perf-flag" style={pastelTagStyle(IN_PROGRESS_TONE)}>
        <SyncOutlined style={{ fontSize: 11 }} />
        In progress
      </span>
    );
  }
  const meta = FLAG_META[flag ?? "normal"] ?? FLAG_META.normal;
  return (
    <span className="emp-perf-flag" style={pastelTagStyle(meta.tone)}>
      <span className="emp-perf-flag__icon">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

const columnTheme = {
  columnWidthRatio: 0.55,
  style: { radiusTopLeft: 4, radiusTopRight: 4 },
  interaction: { elementHighlight: true },
  legend: { position: "top-right" as const, marker: { symbol: "square" as const } },
};

function fmtHours(n: number) {
  return `${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 1 })}h`;
}

function shortTicketId(id: string) {
  const parts = id.split("-");
  return parts.length > 1 ? parts.slice(-1)[0] : id;
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="exec-chart-kpis" style={{ marginBottom: 14 }}>
      {items.map(({ label, color, dashed }) => (
        <div key={label} className="exec-chart-kpis__item">
          <span
            className="exec-chart-kpis__dot"
            style={{
              background: dashed ? "transparent" : color,
              border: dashed ? `2px dashed ${color}` : undefined,
              borderRadius: dashed ? 0 : "50%",
              width: dashed ? 14 : 8,
              height: dashed ? 0 : 8,
              marginTop: dashed ? 6 : 4,
            }}
          />
          <div>
            <div className="exec-chart-kpis__label">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompletionFlagList({ markers }: {
  markers: Array<{ period: string; ticket: string; flag: string; title: string; logged: number; estimate?: number }>;
}) {
  if (!markers.length) return null;
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--bms-border)" }}>
      <Text strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>
        Completed ticket flags
      </Text>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
        {markers.map((m) => {
          const meta = FLAG_META[m.flag] ?? FLAG_META.normal;
          return (
            <Tooltip key={`${m.ticket}-${m.period}`} title={m.title}>
              <div
                className="emp-perf-flag-card"
                style={pastelTagStyle(meta.tone)}
              >
                <span className="emp-perf-flag-card__icon" style={{ color: meta.tone.text }}>
                  {meta.icon}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--bms-text)" }}>
                    {m.ticket}
                  </div>
                  <div style={{
                    fontSize: 11, color: "var(--bms-text-3)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--bms-text-3)", marginTop: 4 }}>
                    {m.period} · {fmtHours(m.logged)} logged
                  </div>
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function PerformanceChartView({ data, period }: { data: EmployeePerformance; period: Period }) {
  const timelineData = useMemo(() => {
    if (!data.chart_series?.length) return [];
    return data.chart_series.flatMap((s) => [
      { period: s.period, type: SERIES.logged, hours: s.logged },
      { period: s.period, type: SERIES.estimated, hours: s.estimated },
    ]);
  }, [data]);

  const monthlyAvgItems = useMemo(() => {
    if (period !== "week" || !data.monthly_avg_series?.length) return [];
    return data.monthly_avg_series.map((m) => ({
      label: m.month.replace(" (avg/wk)", ""),
      logged: m.avg_logged,
      estimated: m.avg_estimated,
    }));
  }, [data, period]);

  const ticketBarData = useMemo(() => {
    if (!data.ticket_bars?.length) return [];
    return data.ticket_bars.flatMap((t) => [
      {
        ticket: shortTicketId(t.label),
        ticketFull: t.ticket_id,
        type: "Logged",
        hours: t.logged,
        flag: t.flag,
        is_done: t.is_done,
      },
      {
        ticket: shortTicketId(t.label),
        ticketFull: t.ticket_id,
        type: "Estimated",
        hours: t.estimated,
        flag: t.flag,
        is_done: t.is_done,
      },
    ]);
  }, [data]);

  const flagMarkers = useMemo(() => {
    return (data.timeline ?? []).flatMap((t) =>
      (t.flags ?? []).map((f) => ({
        period: t.label,
        ticket: f.ticket_id,
        flag: f.flag ?? "normal",
        title: f.title,
        logged: f.logged,
        estimate: f.estimate,
      }))
    );
  }, [data]);

  const lineLegend = [
    { label: "Logged", color: COLORS.logged },
    { label: "Estimated", color: COLORS.estimated, dashed: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {timelineData.length > 0 ? (
        <DashboardPanel
          title="Performance timeline"
          meta={
            period === "week"
              ? "Actual vs planned hours by week"
              : "Average hours per active week by month"
          }
        >
          <ChartLegend items={lineLegend} />
          <Line
            data={timelineData}
            xField="period"
            yField="hours"
            colorField="type"
            shapeField="smooth"
            height={280}
            insetTop={12}
            color={[COLORS.logged, COLORS.estimated]}
            scale={{
              color: {
                domain: [SERIES.logged, SERIES.estimated],
                range: [COLORS.logged, COLORS.estimated],
              },
            }}
            style={{
              lineWidth: (d: { type: string }) => (d.type === SERIES.logged ? 2.5 : 1.5),
              lineDash: (d: { type: string }) => (d.type === SERIES.estimated ? [5, 4] : undefined),
            }}
            point={{
              size: (d: { type: string }) => (d.type === SERIES.logged ? 4 : 0),
              shape: "circle",
              style: { fill: COLORS.logged, stroke: "#fff", lineWidth: 1.5 },
            }}
            axis={{
              y: {
                title: "Hours",
                gridLineDash: [4, 4],
                labelFormatter: (v: number) => `${v}h`,
              },
              x: {
                labelAutoRotate: false,
                labelAutoHide: true,
                labelFormatter: (v: string) => v.replace(" (avg/wk)", ""),
              },
            }}
            legend={false}
            tooltip={{
              title: (d: { period: string }) => d.period,
              items: [(item: { type: string; hours: number }) => ({
                name: item.type,
                value: fmtHours(item.hours),
                color: item.type === SERIES.logged ? COLORS.logged : COLORS.estimated,
              })],
            }}
          />

          {monthlyAvgItems.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--bms-border)" }}>
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Monthly average (per active week)
              </Text>
              <div className="exec-chart-kpis">
                {monthlyAvgItems.map((m) => (
                  <div key={m.label} className="exec-chart-kpis__item">
                    <span className="exec-chart-kpis__dot" style={{ background: COLORS.monthlyLogged }} />
                    <div>
                      <div className="exec-chart-kpis__label">{m.label}</div>
                      <div className="exec-chart-kpis__value">
                        {fmtHours(m.logged)}
                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}> / {fmtHours(m.estimated)} est.</Text>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <CompletionFlagList markers={flagMarkers} />
        </DashboardPanel>
      ) : (
        <Empty description="No timeline activity in this period" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}

      {ticketBarData.length > 0 && (
        <DashboardPanel
          title="Ticket breakdown"
          meta="Logged vs estimated hours per ticket"
        >
          <ChartLegend items={[
            { label: "Logged", color: COLORS.barLogged },
            { label: "Estimated", color: COLORS.barEstimated },
          ]} />
          <Column
            data={ticketBarData}
            xField="ticket"
            yField="hours"
            seriesField="type"
            colorField="type"
            isGroup
            height={Math.max(240, (data.ticket_bars?.length ?? 1) * 64)}
            color={[COLORS.barLogged, COLORS.barEstimated]}
            scale={{
              color: {
                domain: ["Logged", "Estimated"],
                range: [COLORS.barLogged, COLORS.barEstimated],
              },
            }}
            {...columnTheme}
            axis={{
              y: {
                title: "Hours",
                gridLineDash: [4, 4],
                labelFormatter: (v: number) => `${v}h`,
              },
              x: { labelAutoRotate: false, title: false },
            }}
            legend={false}
            tooltip={{
              title: (d: { ticket: string; ticketFull: string }) => d.ticketFull ?? d.ticket,
              items: [(item: { type: string; hours: number }) => ({
                name: item.type,
                value: fmtHours(item.hours),
                color: item.type === "Logged" ? COLORS.barLogged : COLORS.barEstimated,
              })],
            }}
            label={{
              text: (d: { hours: number }) => (d.hours > 0 ? fmtHours(d.hours) : ""),
              position: "top" as const,
              style: { fontSize: 10, fill: "#80868b", fontWeight: 500 },
            }}
          />
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--bms-border)",
            display: "flex", flexWrap: "wrap", gap: 8,
          }}>
            {(data.ticket_bars ?? []).map((t) => (
              <Tooltip key={t.ticket_id} title={t.title}>
                <span className="emp-perf-flag" style={pastelTagStyle(
                  !t.is_done
                    ? IN_PROGRESS_TONE
                    : (FLAG_META[t.flag ?? "normal"] ?? FLAG_META.normal).tone,
                )}>
                  {shortTicketId(t.ticket_id)}
                  <span className="emp-perf-flag__sep">·</span>
                  {!t.is_done ? "In progress" : (FLAG_META[t.flag ?? "normal"] ?? FLAG_META.normal).label}
                </span>
              </Tooltip>
            ))}
          </div>
        </DashboardPanel>
      )}
    </div>
  );
}

export default function EmployeePerformanceTab({ empId }: { empId: string }) {
  const [period, setPeriod] = useState<Period>("week");
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf("month"));

  const range = useMemo(() => {
    if (period === "month") {
      const to = month.endOf("month");
      const from = month.subtract(5, "month").startOf("month");
      return { from: from.format("YYYY-MM-DD"), to: to.format("YYYY-MM-DD") };
    }
    const from = month.startOf("month");
    const to = month.endOf("month");
    return { from: from.format("YYYY-MM-DD"), to: to.format("YYYY-MM-DD") };
  }, [month, period]);

  const { data, isLoading } = useQuery<EmployeePerformance>({
    queryKey: ["emp-performance", empId, period, range.from, range.to],
    queryFn: () => employeeApi.performance(empId, { period, from: range.from, to: range.to }),
    staleTime: 30_000,
  });

  const summary = data?.summary;
  const utilizationPct = useMemo(() => {
    if (!summary?.total_estimated) return 0;
    return Math.min(100, Math.round((summary.total_logged / summary.total_estimated) * 100));
  }, [summary]);

  const columns = [
    {
      title: "Ticket",
      key: "ticket",
      fixed: "left" as const,
      width: 220,
      render: (_: unknown, r: EmployeePerformance["tickets"][0]) => (
        <div className="emp-perf-ticket">
          <span className="emp-perf-ticket__id">{r.ticket_id}</span>
          <span className="emp-perf-ticket__title" title={r.title}>{r.title}</span>
        </div>
      ),
    },
    {
      title: "Project",
      dataIndex: "project",
      key: "project",
      ellipsis: true,
      width: 120,
      render: (v: string) => <span className="emp-perf-project">{v}</span>,
    },
    {
      title: "Estimate",
      dataIndex: "estimate",
      key: "est",
      width: 80,
      align: "right" as const,
      render: (v: number) => <HoursCell value={v} />,
    },
    {
      title: "Logged",
      dataIndex: "logged",
      key: "log",
      width: 80,
      align: "right" as const,
      render: (v: number) => <HoursCell value={v} />,
    },
    {
      title: "Utilization",
      key: "pct",
      width: 148,
      render: (_: unknown, r: EmployeePerformance["tickets"][0]) => (
        <UtilizationCell
          pct={r.pct}
          logged={r.logged}
          estimate={r.estimate}
          isDone={r.is_done}
        />
      ),
    },
    {
      title: "Flag",
      dataIndex: "flag",
      key: "flag",
      width: 118,
      render: (v: string | null, r: EmployeePerformance["tickets"][0]) => (
        <PerformanceFlagChip flag={v} isDone={r.is_done} />
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 108,
      render: (v: string, r: EmployeePerformance["tickets"][0]) => (
        <WorkflowChip
          name={v || (r.is_done ? "Done" : "In progress")}
          color={r.is_done ? "#188038" : "#0891b2"}
        />
      ),
    },
  ];

  return (
    <div className="emp-performance-tab" style={{ paddingTop: 4 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 12, marginBottom: 16,
      }}>
        <Space wrap size={8}>
          <Segmented
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={[
              { label: "Weekly", value: "week" },
              { label: "Monthly (avg)", value: "month" },
            ]}
          />
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { label: "Chart", value: "chart", icon: <BarChartOutlined /> },
              { label: "Table", value: "table", icon: <UnorderedListOutlined /> },
            ]}
          />
        </Space>
        <Space.Compact>
          <Button icon={<LeftOutlined />} onClick={() => setMonth((m) => m.subtract(1, "month"))} />
          <Button style={{ minWidth: 108, fontWeight: 600, pointerEvents: "none" }}>
            {month.format("MMM YYYY")}
          </Button>
          <Button icon={<RightOutlined />} onClick={() => setMonth((m) => m.add(1, "month"))} />
          <Button type="link" onClick={() => setMonth(dayjs().startOf("month"))}>This month</Button>
        </Space.Compact>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>
      ) : !data?.tickets?.length ? (
        <Empty
          description="No ticket performance data for this period"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: "64px 0" }}
        />
      ) : (
        <>
          <div className="dash-metrics">
            <ActionMetric
              label="Completed"
              value={summary?.tickets_completed ?? 0}
              accent="primary"
              icon={<CheckCircleOutlined />}
              animateDelay={0}
            />
            <ActionMetric
              label="In progress"
              value={summary?.tickets_in_progress ?? 0}
              accent="default"
              icon={<SyncOutlined />}
              animateDelay={60}
            />
            <ActionMetric
              label="Good"
              value={summary?.green ?? 0}
              sub="<90% est."
              accent="success"
              icon={<FlagFilled />}
              animateDelay={120}
            />
            <ActionMetric
              label="Escalate"
              value={summary?.red ?? 0}
              sub="> estimate"
              accent="danger"
              icon={<WarningFilled />}
              animateDelay={180}
            />
            <ActionMetric
              label="Logged"
              value={`${summary?.total_logged ?? 0}h`}
              sub={`${summary?.total_estimated ?? 0}h est.`}
              accent="purple"
              icon={<ClockCircleOutlined />}
              progress={utilizationPct}
              animateDelay={240}
            />
          </div>

          {viewMode === "chart" ? (
            <PerformanceChartView data={data} period={period} />
          ) : (
            <DashboardPanel title="Ticket performance" meta={`${data.tickets.length} tickets in range`}>
              <Table
                className="emp-perf-table"
                columns={columns}
                dataSource={data.tickets}
                rowKey="ticket_uuid"
                size="middle"
                pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
                scroll={{ x: 900 }}
              />
            </DashboardPanel>
          )}
        </>
      )}
    </div>
  );
}
