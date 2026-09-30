import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Row, Col, Card, Typography, Button, Tag, Space, Select,
  Empty, Spin, Badge, Modal, Progress,
} from "antd";
import {
  CheckCircleOutlined, ClockCircleOutlined,
  CalendarOutlined, PhoneOutlined, UserOutlined,
  ArrowRightOutlined, FilterOutlined,
  FileTextOutlined, BarChartOutlined,
  ThunderboltOutlined, RiseOutlined,
  AlertOutlined, AimOutlined,
  TeamOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { Pie } from "@ant-design/charts";
import dayjs from "dayjs";
import RelativeTime from "dayjs/plugin/relativeTime";
import { todoApi } from "@/services/todos";
import { followUpApi } from "@/services/followups";
import { workspaceApi } from "@/services/workspace";
import { useThemeStore } from "@/store/theme";

dayjs.extend(RelativeTime);

const { Title, Text } = Typography;
const { Option } = Select;

// ─── Constants ─────────────────────────────────────────────────────────────
const TIME_FILTER_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

const TODO_STATUS_COLORS: Record<string, string> = {
  open: "#8B5CF6",
  inprogress: "#3B82F6",
  done: "#10B981",
  cancelled: "#EF4444",
};

const FOLLOWUP_STATUS_COLORS: Record<string, string> = {
  planning: "#8B5CF6",
  inprogress: "#3B82F6",
  completed: "#10B981",
  cancelled: "#EF4444",
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "#EF4444",
  MEDIUM: "#F59E0B",
  LOW: "#6B7280",
  IMPORTANT: "#DC2626",
};

const TODO_STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <InboxOutlined />,
  inprogress: <ThunderboltOutlined />,
  done: <CheckCircleOutlined />,
  cancelled: <ClockCircleOutlined />,
};

const FOLLOWUP_STATUS_ICONS: Record<string, React.ReactNode> = {
  planning: <AimOutlined />,
  inprogress: <ThunderboltOutlined />,
  completed: <CheckCircleOutlined />,
  cancelled: <AlertOutlined />,
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface TodoStatusCounts { open: number; inprogress: number; done: number; cancelled: number; }
interface FollowUpStatusCounts { planning: number; inprogress: number; completed: number; cancelled: number; }

// ─── Helpers ───────────────────────────────────────────────────────────────
function getDateRange(filter: string): { from: string; to: string } {
  const today = dayjs();
  switch (filter) {
    case "today": return { from: today.format("YYYY-MM-DD"), to: today.format("YYYY-MM-DD") };
    case "week": return { from: today.startOf("week").format("YYYY-MM-DD"), to: today.endOf("week").format("YYYY-MM-DD") };
    case "month": return { from: today.startOf("month").format("YYYY-MM-DD"), to: today.endOf("month").format("YYYY-MM-DD") };
    default: return { from: today.subtract(2, "year").format("YYYY-MM-DD"), to: today.add(1, "year").format("YYYY-MM-DD") };
  }
}

// ─── KPI Card (matches HRMS KpiCard exactly) ───────────────────────────────
function KpiCard({
  label, value, sub, color, icon, progress, onClick,
}: {
  label: string; value: React.ReactNode; sub?: string;
  color: string; icon: React.ReactNode; progress?: number;
  onClick?: () => void;
}) {
  return (
    <Card
      size="small"
      onClick={onClick}
      style={{
        borderRadius: 14,
        border: "1px solid var(--bms-border)",
        height: "100%",
        background: "var(--bms-surface)",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease-in-out",
        boxShadow: "var(--shadow-sm)",
      }}
      styles={{ body: { padding: "20px 24px" } }}
      hoverable={!!onClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: color + "14",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, color, flexShrink: 0,
          border: `1px solid ${color}20`,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--bms-text-3)", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--bms-text)", lineHeight: 1.1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: "var(--bms-text-2)", marginTop: 4 }}>{sub}</div>}
          {progress !== undefined && (
            <Progress
              percent={progress}
              strokeColor={color}
              showInfo={false}
              size="small"
              style={{ marginTop: 8, marginBottom: 0 }}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Section Card (matches HRMS Section exactly) ──────────────────────────
function Section({
  title, icon, iconColor = "#1a73e8",
  lightBg, lightBorder, darkBg, darkBorder,
  extra, children,
}: {
  title: string; icon: React.ReactNode; iconColor?: string;
  lightBg?: string; lightBorder?: string;
  darkBg?: string; darkBorder?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isDark = useThemeStore((s) => s.isDark);
  const headerBg    = isDark ? (darkBg     ?? "var(--bms-surface-2)") : (lightBg     ?? "var(--bms-surface)");
  const borderColor = isDark ? (darkBorder ?? "var(--bms-border)")    : (lightBorder ?? "var(--bms-border)");

  return (
    <Card
      size="small"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: iconColor, fontSize: 16, display: "flex", alignItems: "center" }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--bms-text)", letterSpacing: "-0.01em" }}>{title}</span>
        </div>
      }
      extra={extra}
      styles={{
        body: {
          padding: "16px 20px",
          background: "var(--bms-surface)",
          borderRadius: "0 0 14px 14px",
        },
        header: {
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
          padding: "12px 20px",
          minHeight: 48,
        },
      }}
      style={{
        borderRadius: 14,
        border: `1px solid ${borderColor}`,
        height: "100%",
        background: "var(--bms-surface)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {children}
    </Card>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────
const DonutChart = ({
  data, colors, total, emptyMessage = "No data available",
}: {
  data: Array<{ type: string; value: number; color: string }>;
  colors: Record<string, string>;
  total: number;
  emptyMessage?: string;
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const nonZeroData = data.filter(d => d.value > 0);

  if (total === 0 || nonZeroData.length === 0) {
    return (
      <Empty
        description={emptyMessage}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: 24 }}
      />
    );
  }

  const config: any = {
    data: nonZeroData,
    theme: isDark ? "dark" : "light",
    angleField: "value",
    colorField: "type",
    color: ({ type }: any) => {
      const match = nonZeroData.find((d) => d.type === type || d.type.toLowerCase() === (type || "").toLowerCase());
      return match?.color || colors[type?.toLowerCase()] || "#94A3B8";
    },
    scale: {
      color: {
        range: nonZeroData.map((d) => d.color),
      },
    },
    style: {
      fill: (d: any) => d?.color || nonZeroData.find((item) => item.type === d?.type)?.color || "#94A3B8",
    },
    radius: 0.85,
    innerRadius: 0.55,
    label: false,
    legend: false,
    tooltip: {
      title: (d: { type: string }) => d.type,
      items: [{
        field: "value",
        name: "Count",
        valueFormatter: (v: number) => `${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`,
      }],
    },
    height: 238,
    statistic: {
      title: { content: "Total", style: { color: isDark ? "#9aa0a6" : "#5f6368" } },
      content: { content: String(total), style: { color: isDark ? "#e8eaed" : "#202124" } },
    },
  };

  return <Pie {...config} />;
};

// ─── Status Legend Row ──────────────────────────────────────────────────────
const StatusLegend = ({ data, total }: {
  data: Array<{ type: string; value: number; color: string }>;
  total: number;
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((item) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <div
            key={item.type}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: 8,
              background: "var(--bms-bg)",
              border: `1px solid var(--bms-border)`,
              transition: "transform 0.15s ease-in-out",
            }}
            className="bms-legend-item"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
              <Text style={{ fontSize: 12, color: "var(--bms-text)", fontWeight: 500 }}>{item.type}</Text>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</Text>
              <Text style={{ fontSize: 10, color: "var(--bms-text-3)" }}>{pct}%</Text>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Timeline Item ─────────────────────────────────────────────────────────
const TimelineItem = ({
  title, subtitle, date, dateFormat, status, statusColor,
  priority, priorityColor, isOverdue, assignee, onClick, accent, icon,
}: {
  title: string; subtitle?: string; date?: string; dateFormat?: string;
  status?: string; statusColor?: string; priority?: string; priorityColor?: string;
  isOverdue?: boolean; assignee?: string; onClick?: () => void;
  accent: string; icon: React.ReactNode;
}) => {
  return (
    <div
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderRadius: 10,
        background: "var(--bms-surface-2)",
        border: `1px solid var(--bms-border)`,
        borderLeft: `3px solid ${accent}`,
        cursor: onClick ? "pointer" : "default",
        marginBottom: 10,
        transition: "all 0.15s ease-in-out",
      }}
      className="bms-timeline-hover-card"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${accent}14`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accent, fontSize: 14, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 13, color: "var(--bms-text)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </Text>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 4 }}>
            {date && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <CalendarOutlined style={{ fontSize: 10, color: "var(--bms-text-3)" }} />
                <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
                  {dateFormat ? dayjs(date).format(dateFormat) : dayjs(date).fromNow()}
                </Text>
              </div>
            )}
            {status && statusColor && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{status}</Text>
              </div>
            )}
            {assignee && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <UserOutlined style={{ fontSize: 10, color: "var(--bms-text-3)" }} />
                <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{assignee}</Text>
              </div>
            )}
            {subtitle && (
              <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{subtitle}</Text>
            )}
          </div>
        </div>
      </div>
      <Space size={4} wrap style={{ flexShrink: 0, marginLeft: 8 }}>
        {priority && (
          <Tag
            color={priorityColor}
            style={{ fontSize: 9, borderRadius: 20, margin: 0, fontWeight: 600, padding: "0 8px", lineHeight: "18px" }}
          >
            {priority}
          </Tag>
        )}
        {isOverdue && (
          <Tag color="error" style={{ fontSize: 9, borderRadius: 20, margin: 0, fontWeight: 600 }}>
            Overdue
          </Tag>
        )}
      </Space>
    </div>
  );
};

// ─── Status Pills (matches HRMS LeaveMonthStats / PayrollStatus style) ────
const StatusPills = ({ items }: {
  items: Array<{ label: string; value: number; color: string; icon: React.ReactNode; onClick?: () => void }>;
}) => {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {items.map(({ label, value, color, icon, onClick }) => (
        <div
          key={label}
          onClick={onClick}
          style={{
            flex: 1, textAlign: "center", padding: "14px 8px", borderRadius: 10,
            background: color + "18", border: `1px solid ${color}33`,
            cursor: onClick ? "pointer" : "default",
            transition: "transform 0.15s",
          }}
          onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)")}
          onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.transform = "translateY(0)")}
        >
          <div style={{ fontSize: 18, color, marginBottom: 4 }}>{icon}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Status Progress Card (dept-list style matching HRMS DeptChart list) ──
const StatusProgressRow = ({ status, count, total, color }: {
  status: string; count: number; total: number; color: string;
}) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 12px", borderRadius: 8,
        background: color + "18",
        border: `1px solid ${color}33`,
        marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <Text style={{ fontSize: 12, color: "var(--bms-text)" }}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: 700, color }}>{count}</Text>
        <div style={{ width: 60 }}>
          <Progress percent={pct} strokeColor={color} showInfo={false} size="small" />
        </div>
      </div>
    </div>
  );
};

const OverdueList = ({ items }: { items: Array<any> }) => {
  return (
    <div
      style={{
        maxHeight: 204, // Approx 3 items (60px height + 8px margin each)
        overflowY: "auto",
        paddingRight: 4,
      }}
    >
      {items.map((item) => (
        <TimelineItem
          key={`${item.type}-${item.id}`}
          title={item.title}
          date={item.due_date || undefined}
          dateFormat="MMM D"
          status={item.status}
          statusColor={item.statusColor}
          priority={item.priority}
          priorityColor={item.priorityColor}
          subtitle={`${item.type === "todo" ? "To-Do" : "Follow-up"} · ${item.overdueLabel}`}
          onClick={item.onClick}
          accent={item.accent}
          icon={item.icon}
        />
      ))}
    </div>
  );
};

// ─── Daily Briefing Panel ─────────────────────────────────────────────────
const DailyBriefingPanel = ({
  todosYellowCount = 0, todosRedCount = 0,
  followupsYellowCount = 0, followupsRedCount = 0,
  onClickTodosYellow, onClickTodosRed,
  onClickFollowupsYellow, onClickFollowupsRed,
}: {
  todosYellowCount?: number; todosRedCount?: number;
  followupsYellowCount?: number; followupsRedCount?: number;
  onClickTodosYellow?: () => void; onClickTodosRed?: () => void;
  onClickFollowupsYellow?: () => void; onClickFollowupsRed?: () => void;
}) => {
  const briefingItems = [
    { label: "To-Dos (3-5 Days)", value: todosYellowCount, color: "#D97706", icon: <ClockCircleOutlined />, onClick: onClickTodosYellow },
    { label: "To-Dos (Overdue & ≤ 2 Days)", value: todosRedCount, color: "#DC2626", icon: <AlertOutlined />, onClick: onClickTodosRed },
    { label: "Follow-ups (3-5 Days)", value: followupsYellowCount, color: "#D97706", icon: <ClockCircleOutlined />, onClick: onClickFollowupsYellow },
    { label: "Follow-ups (Overdue & ≤ 2 Days)", value: followupsRedCount, color: "#DC2626", icon: <AlertOutlined />, onClick: onClickFollowupsRed },
  ];
  const totalItems = todosRedCount + todosYellowCount + followupsRedCount + followupsYellowCount;
  const urgentCount = todosRedCount + followupsRedCount;

  return (
    <Section
      title="Daily Briefing"
      icon={<BarChartOutlined />}
      iconColor="#6366F1"
      lightBg="#f5f3ff" lightBorder="#ddd6fe"
      darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
    >
      <Text style={{ fontSize: 13, color: "var(--bms-text-2)", lineHeight: 1.6, display: "block", marginBottom: 18 }}>
        You have <strong>{totalItems}</strong> upcoming task{totalItems !== 1 ? "s" : ""} in the next 5 days.{" "}
        {urgentCount > 0
          ? `⚠️ ${urgentCount} item${urgentCount !== 1 ? "s are" : " is"} due within 2 days or overdue.`
          : "Nice — no items are urgent or overdue!"}
      </Text>
      <Row gutter={[16, 16]}>
        {briefingItems.map(({ label, value, color, icon, onClick }) => (
          <Col xs={12} sm={6} key={label}>
            <div
              onClick={onClick}
              style={{
                borderRadius: 12,
                border: `1px solid var(--bms-border)`,
                background: "var(--bms-surface)",
                padding: "16px 18px",
                cursor: onClick ? "pointer" : "default",
                height: "100%",
                transition: "box-shadow 0.2s, transform 0.2s",
              }}
              onMouseEnter={e => onClick && Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow: "0 4px 16px rgba(0,0,0,0.1)", transform: "translateY(-2px)" })}
              onMouseLeave={e => onClick && Object.assign((e.currentTarget as HTMLDivElement).style, { boxShadow: "none", transform: "translateY(0)" })}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: color + "20",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, color, flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--bms-text-3)", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </Section>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
export default function WorkspaceDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [timeFilter, setTimeFilter] = useState<string>("all");

  const [overdueFilter, setOverdueFilter] = useState<string>("overdue");
  const [upcomingFollowUpsModalOpen, setUpcomingFollowUpsModalOpen] = useState(false);

  const dateRange = useMemo(() => getDateRange(timeFilter), [timeFilter]);

  const { data: todosData, isLoading: todosLoading } = useQuery({
    queryKey: ["workspace-dashboard-todos", timeFilter],
    queryFn: () => {
      const params: Record<string, string | number> = { page_size: 100 };
      if (timeFilter !== "all") {
        params.due_date_from = dateRange.from;
        params.due_date_to = dateRange.to;
      }
      return todoApi.list(params);
    },
  });

  const { data: followUpsData, isLoading: followUpsLoading } = useQuery({
    queryKey: ["workspace-dashboard-followups", timeFilter],
    queryFn: () => {
      const params: Record<string, string | number> = { page_size: 100 };
      if (timeFilter !== "all") {
        params.due_date_from = dateRange.from;
        params.due_date_to = dateRange.to;
      }
      return followUpApi.list(params);
    },
  });

  const { data: allTodosData, isLoading: allTodosLoading } = useQuery({
    queryKey: ["workspace-dashboard-all-todos"],
    queryFn: () => todoApi.list({ page_size: 100 }),
  });

  const { data: allFollowUpsData, isLoading: allFollowUpsLoading } = useQuery({
    queryKey: ["workspace-dashboard-all-followups"],
    queryFn: () => followUpApi.list({ page_size: 100 }),
  });

  const { data: calendarData } = useQuery({
    queryKey: ["workspace-dashboard-calendar", timeFilter],
    queryFn: () => workspaceApi.calendar(dateRange.from, dateRange.to),
    enabled: timeFilter !== "all",
  });

  // ── Derived stats ──────────────────────────────────────────────────────────
  const todoStats = useMemo(() => {
    const counts: TodoStatusCounts = { open: 0, inprogress: 0, done: 0, cancelled: 0 };
    const colors: Record<string, string> = { ...TODO_STATUS_COLORS };
    (todosData?.results || []).forEach((todo) => {
      const status = todo.workflow_state_slug?.toLowerCase() || "open";
      if (status in counts) counts[status as keyof TodoStatusCounts]++;
      else (counts as any)[status] = ((counts as any)[status] || 0) + 1;

      if (TODO_STATUS_COLORS[status]) {
        colors[status] = TODO_STATUS_COLORS[status];
      } else if (todo.workflow_state_color) {
        colors[status] = todo.workflow_state_color;
      }
    });
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    return { counts, colors, total, pending: counts.open + counts.inprogress };
  }, [todosData]);

  const followUpStats = useMemo(() => {
    const counts: FollowUpStatusCounts = { planning: 0, inprogress: 0, completed: 0, cancelled: 0 };
    const colors: Record<string, string> = { ...FOLLOWUP_STATUS_COLORS };
    (followUpsData?.results || []).forEach((f) => {
      const status = f.workflow_state_slug?.toLowerCase() || "planning";
      if (status in counts) counts[status as keyof FollowUpStatusCounts]++;
      else (counts as any)[status] = ((counts as any)[status] || 0) + 1;

      if (FOLLOWUP_STATUS_COLORS[status]) {
        colors[status] = FOLLOWUP_STATUS_COLORS[status];
      } else if (f.workflow_state_color) {
        colors[status] = f.workflow_state_color;
      }
    });
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    return { counts, colors, total, pending: counts.planning + counts.inprogress };
  }, [followUpsData]);

  const upcomingFollowUpsList = useMemo(() => {
    const now = dayjs().startOf("day");
    return [...(allFollowUpsData?.results || [])]
      .filter(f => {
        const isDoneOrCancelled = ["completed", "cancelled"].includes(f.workflow_state_slug?.toLowerCase() || "");
        const endDate = f.end_date ? dayjs(f.end_date).startOf("day") : null;
        return !isDoneOrCancelled && endDate && (endDate.isAfter(now) || endDate.isSame(now));
      })
      .sort((a, b) => dayjs(a.end_date || "").diff(dayjs(b.end_date || "")));
  }, [allFollowUpsData]);

  const upcomingFollowUpsCount = useMemo(() => upcomingFollowUpsList.length, [upcomingFollowUpsList]);

  const filteredOverdueItems = useMemo(() => {
    const now = dayjs().startOf("day");
    const todos = (allTodosData?.results || []).map((t) => {
      const isDoneOrCancelled = ["done", "cancelled"].includes(t.workflow_state_slug?.toLowerCase() || "");
      const dueDate = t.due_date ? dayjs(t.due_date).startOf("day") : null;
      const isOverdue = t.is_overdue || (dueDate && dueDate.isBefore(now));
      const daysDiff = dueDate ? dueDate.diff(now, "day") : null;
      const statusSlug = t.workflow_state_slug?.toLowerCase() || "";
      return {
        id: t.id, title: t.title, due_date: t.due_date, priority: t.priority,
        priorityColor: PRIORITY_COLORS[t.priority] || "#6B7280",
        status: t.workflow_state_name || t.workflow_state_slug || "",
        statusColor: t.workflow_state_color || todoStats.colors[statusSlug] || TODO_STATUS_COLORS[statusSlug] || "#94A3B8",
        type: "todo" as const, accent: "#EF4444", icon: <FileTextOutlined />,
        overdueLabel: t.due_date ? (isOverdue ? `${Math.abs(daysDiff)}d overdue` : `Due in ${daysDiff}d`) : "Overdue",
        isOverdue, isDoneOrCancelled, daysDiff,
      };
    });

    const followUps = (allFollowUpsData?.results || []).map((f) => {
      const isDoneOrCancelled = ["completed", "cancelled"].includes(f.workflow_state_slug?.toLowerCase() || "");
      const endDate = f.end_date ? dayjs(f.end_date).startOf("day") : null;
      const isOverdue = endDate && endDate.isBefore(now);
      const daysDiff = endDate ? endDate.diff(now, "day") : null;
      const statusSlug = f.workflow_state_slug?.toLowerCase() || "";
      return {
        id: f.id, title: f.title, due_date: f.end_date, priority: f.priority,
        priorityColor: PRIORITY_COLORS[f.priority] || "#6B7280",
        status: f.workflow_state_name || f.workflow_state_slug || "",
        statusColor: f.workflow_state_color || followUpStats.colors[statusSlug] || FOLLOWUP_STATUS_COLORS[statusSlug] || "#94A3B8",
        type: "followup" as const, accent: "#DC2626", icon: <PhoneOutlined />,
        overdueLabel: f.end_date ? (isOverdue ? `${Math.abs(daysDiff)}d overdue` : `Due in ${daysDiff}d`) : "Overdue",
        isOverdue, isDoneOrCancelled, daysDiff,
      };
    });

    const allItems = [...todos, ...followUps].filter(item => !item.isDoneOrCancelled);

    return allItems.filter(item => {
      if (overdueFilter === "overdue") {
        return item.isOverdue;
      }
      const days = item.daysDiff;
      if (days === null) return false;
      if (overdueFilter === "2days") {
        return item.isOverdue || (days >= 0 && days <= 2);
      }
      if (overdueFilter === "3days") {
        return item.isOverdue || (days >= 0 && days <= 3);
      }
      if (overdueFilter === "5days") {
        return item.isOverdue || (days >= 0 && days <= 5);
      }
      return true;
    }).sort((a, b) => {
      if (a.due_date && b.due_date) {
        return dayjs(a.due_date).diff(dayjs(b.due_date));
      }
      return 0;
    });
  }, [allTodosData, allFollowUpsData, overdueFilter, todoStats.colors, followUpStats.colors]);

  const todayScheduleItems = useMemo(() => {
    const now = dayjs().startOf("day");
    
    const todos = (allTodosData?.results || []).map((t) => {
      const isDoneOrCancelled = ["done", "cancelled"].includes(t.workflow_state_slug?.toLowerCase() || "");
      const dueDate = t.due_date ? dayjs(t.due_date).startOf("day") : null;
      const isToday = dueDate && dueDate.isSame(now);
      const statusSlug = t.workflow_state_slug?.toLowerCase() || "";
      return {
        id: t.id, title: t.title, due_date: t.due_date, priority: t.priority,
        priorityColor: PRIORITY_COLORS[t.priority] || "#6B7280",
        status: t.workflow_state_name || t.workflow_state_slug || "",
        statusColor: t.workflow_state_color || todoStats.colors[statusSlug] || TODO_STATUS_COLORS[statusSlug] || "#94A3B8",
        type: "todo" as const, accent: "#6366F1", icon: <FileTextOutlined />,
        overdueLabel: "Today",
        isToday, isDoneOrCancelled,
        onClick: () => navigate(`/workspace/todos?id=${t.id}`)
      };
    });

    const followUps = (allFollowUpsData?.results || []).map((f) => {
      const isDoneOrCancelled = ["completed", "cancelled"].includes(f.workflow_state_slug?.toLowerCase() || "");
      const endDate = f.end_date ? dayjs(f.end_date).startOf("day") : null;
      const isToday = endDate && endDate.isSame(now);
      const statusSlug = f.workflow_state_slug?.toLowerCase() || "";
      return {
        id: f.id, title: f.title, due_date: f.end_date, priority: f.priority,
        priorityColor: PRIORITY_COLORS[f.priority] || "#6B7280",
        status: f.workflow_state_name || f.workflow_state_slug || "",
        statusColor: f.workflow_state_color || followUpStats.colors[statusSlug] || FOLLOWUP_STATUS_COLORS[statusSlug] || "#94A3B8",
        type: "followup" as const, accent: "#0D9488", icon: <PhoneOutlined />,
        overdueLabel: "Today",
        isToday, isDoneOrCancelled,
        onClick: () => navigate(`/workspace/followups?id=${f.id}`)
      };
    });

    return [...todos, ...followUps].filter(item => !item.isDoneOrCancelled && item.isToday).sort((a, b) => {
      if (a.due_date && b.due_date) {
        return dayjs(a.due_date).diff(dayjs(b.due_date));
      }
      return 0;
    });
  }, [allTodosData, allFollowUpsData, navigate, todoStats.colors, followUpStats.colors]);

  const todoChartData = useMemo(() =>
    Object.entries(todoStats.counts).map(([type, value]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1), value,
      color: todoStats.colors[type] || TODO_STATUS_COLORS[type] || "#94A3B8",
    })),
    [todoStats]
  );

  const followUpChartData = useMemo(() =>
    Object.entries(followUpStats.counts).map(([type, value]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1), value,
      color: followUpStats.colors[type] || FOLLOWUP_STATUS_COLORS[type] || "#94A3B8",
    })),
    [followUpStats]
  );

  // CEO morning briefing – workspace-only queries
  const todayStr = dayjs().format("YYYY-MM-DD");
  const { data: todayCalendarData } = useQuery({
    queryKey: ["workspace-dashboard-today-calendar"],
    queryFn: () => workspaceApi.calendar(todayStr, todayStr),
  });

  const todayMeetingsCount = useMemo(() => {
    const list = todayCalendarData?.events || [];
    return list.filter((ev) => (ev.start_date === todayStr || ev.end_date === todayStr) && ev.event_kind === "meeting").length;
  }, [todayCalendarData, todayStr]);

  const todayScheduleEvents = useMemo(() => {
    const list = todayCalendarData?.events || [];
    return [...list]
      .filter((ev) => (ev.start_date === todayStr || ev.end_date === todayStr) && ev.event_kind === "meeting")
      .map((ev) => {
        const timeStr = ev.start_time
          ? dayjs(`${todayStr}T${ev.start_time}`).format("hh:mm A")
          : "All Day";
        const titleLower = (ev.title || "").toLowerCase();
        let priority = ev.priority?.toUpperCase() || "MEDIUM";
        let label = "Normal Discussion";
        let color = "#10B981";

        if (
          titleLower.includes("investor") || titleLower.includes("board meeting") ||
          titleLower.includes("government") || titleLower.includes("major client") ||
          priority === "IMPORTANT" || priority === "CRITICAL"
        ) {
          priority = "CRITICAL"; label = "Critical"; color = "#EF4444";
        } else if (
          titleLower.includes("product review") || titleLower.includes("sales review") || priority === "HIGH"
        ) {
          priority = "HIGH"; label = "High Importance"; color = "#F97316";
        } else if (
          titleLower.includes("optional") || titleLower.includes("ceo briefing") ||
          titleLower.includes("lunch") || priority === "LOW"
        ) {
          priority = "LOW"; label = "Optional"; color = "#6B7280";
        }

        return { time: timeStr, rawTime: ev.start_time || "00:00:00", title: ev.title, priority, pText: label, pColor: color };
      })
      .sort((a, b) => a.rawTime.localeCompare(b.rawTime));
  }, [todayCalendarData, todayStr]);

  const isLoading = todosLoading || followUpsLoading || allTodosLoading || allFollowUpsLoading;
  const todayEvents = calendarData?.events?.length || 0;

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bms-bg)" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>Workspace Dashboard</Title>
            <Text style={{ color: "var(--bms-text-2)", fontSize: 13 }}>
              Todos, follow-ups and calendar overview · {dayjs().format("DD MMM YYYY")}
            </Text>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Select
              value={timeFilter}
              onChange={setTimeFilter}
              style={{ width: 130, borderRadius: 10 }}
              suffixIcon={<FilterOutlined style={{ fontSize: 12 }} />}
            >
              {TIME_FILTER_OPTIONS.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 0 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            label="Total To-Dos"
            value={todoStats.total}
            color="#6366F1"
            icon={<FileTextOutlined />}
            sub={`${todoStats.pending} pending`}
            onClick={() => navigate("/workspace/todos")}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            label="Upcoming Follow-ups"
            value={upcomingFollowUpsCount}
            color="#10B981"
            icon={<RiseOutlined />}
            sub={`${upcomingFollowUpsCount} follow-ups scheduled`}
            onClick={() => setUpcomingFollowUpsModalOpen(true)}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            label="Total Follow-ups"
            value={followUpStats.total}
            color="#0D9488"
            icon={<PhoneOutlined />}
            sub={`${followUpStats.pending} active`}
            onClick={() => navigate("/workspace/followups")}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            label="Today's Meetings"
            value={todayMeetingsCount}
            color="#F59E0B"
            icon={<CalendarOutlined />}
            sub={`${todayEvents} total events (filter)`}
            onClick={() => navigate("/workspace/meetings")}
          />
        </Col>
      </Row>

      {/* ── Charts Row ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Section
            title="To-Do Overview"
            icon={<BarChartOutlined />}
            iconColor="#6366F1"
            lightBg="#eff6ff" lightBorder="#bfdbfe"
            darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
            extra={
              <Button type="link" size="small" onClick={() => navigate("/workspace/todos")} style={{ fontSize: 12, fontWeight: 600, padding: 0 }}>
                View All <ArrowRightOutlined />
              </Button>
            }
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <DonutChart data={todoChartData} colors={todoStats.colors} total={todoStats.total} />
              </Col>
              <Col xs={24} md={12}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
                  {Object.entries(todoStats.counts).map(([status, count]) => (
                    <div
                      key={status}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: (todoStats.colors[status] || TODO_STATUS_COLORS[status] || "#94A3B8") + "14",
                        border: `1px solid ${(todoStats.colors[status] || TODO_STATUS_COLORS[status] || "#94A3B8")}30`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: todoStats.colors[status] || TODO_STATUS_COLORS[status] || "#94A3B8",
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--bms-text)" }}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 700, color: todoStats.colors[status] || TODO_STATUS_COLORS[status] || "#94A3B8" }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </Col>
            </Row>
          </Section>
        </Col>

        <Col xs={24} lg={12}>
          <Section
            title="Follow-ups Overview"
            icon={<PhoneOutlined />}
            iconColor="#0D9488"
            lightBg="#f0fdfa" lightBorder="#99f6e4"
            darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
            extra={
              <Button type="link" size="small" onClick={() => navigate("/workspace/followups")} style={{ fontSize: 12, fontWeight: 600, padding: 0 }}>
                View All <ArrowRightOutlined />
              </Button>
            }
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <DonutChart data={followUpChartData} colors={followUpStats.colors} total={followUpStats.total} emptyMessage="No follow-ups available" />
              </Col>
              <Col xs={24} md={12}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
                  {Object.entries(followUpStats.counts).map(([status, count]) => (
                    <StatusProgressRow
                      key={status}
                      status={status}
                      count={count}
                      total={followUpStats.total}
                      color={followUpStats.colors[status] || FOLLOWUP_STATUS_COLORS[status] || "#94A3B8"}
                    />
                  ))}
                </div>
              </Col>
            </Row>
          </Section>
        </Col>
      </Row>

      {/* ── Status Overview Row ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Section
            title="Today's Schedule"
            icon={<ClockCircleOutlined />}
            iconColor="#6366F1"
            lightBg="#f5f3ff" lightBorder="#ddd6fe"
            darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
          >
            {todayScheduleItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(99, 102, 241, 0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  <CheckCircleOutlined style={{ fontSize: 24, color: "#6366F1" }} />
                </div>
                <Text style={{ fontSize: 14, fontWeight: 600, color: "var(--bms-text)", display: "block" }}>Free day!</Text>
                <Text style={{ fontSize: 12, color: "var(--bms-text-2)" }}>Nothing scheduled for today.</Text>
              </div>
            ) : (
              <OverdueList items={todayScheduleItems} />
            )}
          </Section>
        </Col>
        <Col xs={24} lg={12}>
          <Section
            title={`Overdue & Near Due Items (${filteredOverdueItems.length})`}
            icon={<AlertOutlined />}
            iconColor="#EF4444"
            lightBg="#fff1f2" lightBorder="#fecdd3"
            darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
            extra={
              <Select
                value={overdueFilter}
                onChange={setOverdueFilter}
                style={{ width: 160 }}
                size="small"
              >
                <Option value="overdue">Overdue Only</Option>
                <Option value="2days">Within 2 Days</Option>
                <Option value="3days">Within 3 Days</Option>
                <Option value="5days">Within 5 Days</Option>
              </Select>
            }
          >
            {filteredOverdueItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  <CheckCircleOutlined style={{ fontSize: 24, color: "#10B981" }} />
                </div>
                <Text style={{ fontSize: 14, fontWeight: 600, color: "var(--bms-text)", display: "block" }}>All caught up!</Text>
                <Text style={{ fontSize: 12, color: "var(--bms-text-2)" }}>No items matching the filter.</Text>
              </div>
            ) : (
              <OverdueList items={filteredOverdueItems} />
            )}
          </Section>
        </Col>
      </Row>

      {/* ── Upcoming Follow-ups Modal ── */}
      <Modal
        title="Upcoming Follow-ups"
        open={upcomingFollowUpsModalOpen}
        onCancel={() => setUpcomingFollowUpsModalOpen(false)}
        footer={null}
        width={600}
        bodyStyle={{ maxHeight: 400, overflowY: "auto", padding: "8px 0" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {upcomingFollowUpsList.length === 0 ? (
            <Empty description="No upcoming follow-ups scheduled" />
          ) : (
            upcomingFollowUpsList.map(item => (
              <div
                key={item.id}
                onClick={() => {
                  setUpcomingFollowUpsModalOpen(false);
                  navigate(`/workspace/followups?id=${item.id}`);
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 8, background: "var(--bms-surface-2)",
                  border: "1px solid var(--bms-border)", cursor: "pointer",
                  borderLeft: "3px solid #0D9488",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <PhoneOutlined style={{ color: "#0D9488" }} />
                  <Text strong style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</Text>
                </div>
                <Space>
                  {item.end_date && <span style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Due {dayjs(item.end_date).format("DD MMM YYYY")}</span>}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                    background: (FOLLOWUP_STATUS_COLORS[item.workflow_state_slug?.toLowerCase() || ""] || "#94A3B8") + "15",
                    color: FOLLOWUP_STATUS_COLORS[item.workflow_state_slug?.toLowerCase() || ""] || "#94A3B8"
                  }}>
                    {item.workflow_state_name || item.workflow_state_slug}
                  </span>
                </Space>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}