import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Row, Col, Card, Typography, Spin, Empty, Tag, Table, Avatar,
  Progress,
} from "antd";
import {
  TeamOutlined, CalendarOutlined, ClockCircleOutlined,
  UserAddOutlined, WalletOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined,
} from "@ant-design/icons";
import { Pie } from "@ant-design/charts";
import dayjs from "dayjs";
import { get } from "@/services/api";
import { DEPT_COLORS } from "@/utils/chartColors";
import { useThemeStore } from "@/store/theme";

const { Title, Text } = Typography;

// ── Types ──────────────────────────────────────────────────────────────────────
interface DeptDist  { department: string; count: number }
interface RoleDist  { role: string; count: number }
interface PendingLeave {
  id: string; employee: string; employee_code: string;
  leave_type: string; color: string;
  start_date: string; end_date: string; days_count: number; reason: string;
}
interface RecentJoiner {
  id: string; full_name: string; employee_code: string;
  designation: string; department: string; joining_date: string;
}
interface HRMSData {
  date: string;
  headcount: {
    total_active: number; new_joiners_month: number;
    dept_distribution: DeptDist[]; role_distribution: RoleDist[];
  };
  attendance_today: {
    PRESENT: number; WFH: number; HALF_DAY: number;
    ON_LEAVE: number; ABSENT: number; not_marked: number;
    attendance_rate: number;
  };
  leave: {
    pending_count: number;
    stats_this_month: { pending: number; approved: number; rejected: number };
    pending_list: PendingLeave[];
  };
  recent_joiners: RecentJoiner[];
  payroll: { total: number; draft: number; finalized: number; paid: number };
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color, icon, progress,
}: {
  label: string; value: React.ReactNode; sub?: string;
  color: string; icon: React.ReactNode; progress?: number;
}) {
  return (
    <Card
      size="small"
      style={{
        borderRadius: 12,
        border: "1px solid var(--bms-border)",
        height: "100%",
        background: "var(--bms-surface)",
      }}
      styles={{ body: { padding: "16px 18px" } }}
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
          {sub && <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 2 }}>{sub}</div>}
          {progress !== undefined && (
            <Progress
              percent={progress}
              strokeColor={color}
              showInfo={false}
              size="small"
              style={{ marginTop: 6, marginBottom: 0 }}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Section card wrapper ───────────────────────────────────────────────────────
function Section({
  title, icon, iconColor = "#1677ff",
  lightBg, lightBorder, darkBg, darkBorder,
  children,
}: {
  title: string; icon: React.ReactNode; iconColor?: string;
  lightBg?: string; lightBorder?: string;
  darkBg?: string; darkBorder?: string;
  children: React.ReactNode;
}) {
  const isDark = useThemeStore((s) => s.isDark);
  const headerBg     = isDark ? (darkBg     ?? "var(--bms-surface-2)") : (lightBg     ?? "#f8fafc");
  const borderColor  = isDark ? (darkBorder ?? "var(--bms-border)")    : (lightBorder ?? "#e2e8f0");

  return (
    <Card
      size="small"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: iconColor }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--bms-text)" }}>{title}</span>
        </div>
      }
      styles={{
        body: {
          padding: "14px 16px",
          background: "var(--bms-surface)",
          borderRadius: "0 0 12px 12px",
        },
        header: {
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
        },
      }}
      style={{
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        height: "100%",
        background: "var(--bms-surface)",
      }}
    >
      {children}
    </Card>
  );
}

// ── Attendance status row ──────────────────────────────────────────────────────
const ATT_CFG: Record<string, { label: string; color: string }> = {
  PRESENT:    { label: "Present",    color: "#059669" },
  WFH:        { label: "WFH",        color: "#2563eb" },
  HALF_DAY:   { label: "Half Day",   color: "#d97706" },
  ON_LEAVE:   { label: "On Leave",   color: "#7c3aed" },
  ABSENT:     { label: "Absent",     color: "#dc2626" },
  not_marked: { label: "Not Marked", color: "#9ca3af" },
};

function AttendanceSummary({ att }: { att: HRMSData["attendance_today"] }) {
  const isDark = useThemeStore((s) => s.isDark);
  const items = (["PRESENT", "WFH", "HALF_DAY", "ON_LEAVE", "ABSENT", "not_marked"] as const)
    .map((k) => ({ key: k, value: att[k as keyof typeof att] as number, ...ATT_CFG[k] }));

  const pieData = items
    .filter((i) => (i.value as number) > 0)
    .map((i) => ({ status: i.label, value: i.value as number, color: i.color }));

  return (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        {pieData.length === 0 ? (
          <Empty
            description="No attendance data today"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: 24 }}
          />
        ) : (
          <Pie
            data={pieData}
            theme={isDark ? "dark" : "light"}
            angleField="value"
            colorField="status"
            color={({ status }: any) => pieData.find((d) => d.status === status)?.color ?? "#ccc"}
            scale={{
              color: {
                range: pieData.map((d) => d.color),
              },
            }}
            style={{
              fill: (d: any) => d?.color || pieData.find((item) => item.status === d?.status)?.color || "#ccc",
            }}
            radius={0.85}
            innerRadius={0.55}
            label={{ text: (d: any) => d.value, style: { fontSize: 12, fill: isDark ? "#e8eaed" : "#202124" } }}
            legend={false}
            height={220}
            tooltip={{
              title: (d: any) => d.status,
              items: [{ field: "value", name: "Count" }],
            }}
            statistic={{
              title: { content: "Rate", style: { color: isDark ? "#9aa0a6" : "#5f6368" } },
              content: { content: `${att.attendance_rate}%`, style: { color: isDark ? "#e8eaed" : "#202124" } },
            }}
          />
        )}
      </Col>
      <Col xs={24} md={12}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
          {items.map(({ key, label, value, color }) => (
            <div
              key={key}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 12px", borderRadius: 8,
                background: color + "18",
                border: `1px solid ${color}33`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <Text style={{ fontSize: 12, color: "var(--bms-text)" }}>{label}</Text>
              </div>
              <Text style={{ fontSize: 14, fontWeight: 700, color }}>{value as number}</Text>
            </div>
          ))}
        </div>
      </Col>
    </Row>
  );
}

// ── Department distribution ────────────────────────────────────────────────────
function DeptChart({ data }: { data: DeptDist[] }) {
  const isDark = useThemeStore((s) => s.isDark);
  if (!data.length)
    return <Empty description="No department data" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const total = data.reduce((s, d) => s + d.count, 0);
  const pieData = data.map((d, i) => ({
    department: d.department,
    value: d.count,
    color: DEPT_COLORS[i % DEPT_COLORS.length],
  }));

  return (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Pie
          data={pieData}
          theme={isDark ? "dark" : "light"}
          angleField="value"
          colorField="department"
          color={({ department }: any) => pieData.find((d) => d.department === department)?.color ?? "#ccc"}
          scale={{
            color: {
              range: pieData.map((d) => d.color),
            },
          }}
          style={{
            fill: (d: any) => d?.color || pieData.find((item) => item.department === d?.department)?.color || "#ccc",
          }}
          radius={0.85}
          innerRadius={0.55}
          label={false}
          legend={false}
          height={238}
          tooltip={{
            title: (d: any) => d.department,
            items: [{ field: "value", name: "Count" }],
          }}
          statistic={{
            title: { content: "Total", style: { color: isDark ? "#9aa0a6" : "#5f6368" } },
            content: { content: String(total), style: { color: isDark ? "#e8eaed" : "#202124" } },
          }}
        />
      </Col>
      <Col xs={24} md={12}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
          {data.slice(0, 8).map((d, i) => (
            <div key={d.department} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 10, height: 10, borderRadius: 2,
                background: DEPT_COLORS[i % DEPT_COLORS.length],
                flexShrink: 0,
              }} />
              <Text style={{ fontSize: 12, flex: 1, color: "var(--bms-text)" }}>{d.department}</Text>
              <Text style={{ fontSize: 12, fontWeight: 600, color: DEPT_COLORS[i % DEPT_COLORS.length] }}>
                {d.count}
              </Text>
              <div style={{ width: 60 }}>
                <Progress
                  percent={total > 0 ? Math.round((d.count / total) * 100) : 0}
                  strokeColor={DEPT_COLORS[i % DEPT_COLORS.length]}
                  showInfo={false}
                  size="small"
                />
              </div>
            </div>
          ))}
        </div>
      </Col>
    </Row>
  );
}

// ── Leave requests table ───────────────────────────────────────────────────────
function PendingLeaveTable({ rows }: { rows: PendingLeave[] }) {
  const cols = [
    {
      title: "Employee",
      dataIndex: "employee",
      render: (name: string, r: PendingLeave) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar
            size={28}
            style={{ background: "#1677ff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}
          >
            {name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--bms-text)" }}>{name}</div>
            <div style={{ fontSize: 11, color: "var(--bms-text-3)", fontFamily: "monospace" }}>
              {r.employee_code}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Leave Type",
      dataIndex: "leave_type",
      render: (t: string, r: PendingLeave) => (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
          color: r.color, background: r.color + "20", border: `1px solid ${r.color}40`,
        }}>{t}</span>
      ),
    },
    {
      title: "Dates",
      render: (_: any, r: PendingLeave) => (
        <div style={{ fontSize: 12 }}>
          <div style={{ color: "var(--bms-text)" }}>{r.start_date} → {r.end_date}</div>
          <div style={{ color: "var(--bms-text-3)" }}>{r.days_count}d</div>
        </div>
      ),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      ellipsis: true,
      render: (v: string) => (
        <Text style={{ fontSize: 12, color: "var(--bms-text-2)" }}>{v || "—"}</Text>
      ),
    },
  ];

  return (
    <Table
      dataSource={rows}
      columns={cols}
      rowKey="id"
      size="small"
      pagination={false}
      locale={{
        emptyText: (
          <Empty
            description="No pending leave requests"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ),
      }}
    />
  );
}

// ── Recent joiners ─────────────────────────────────────────────────────────────
function RecentJoiners({ joiners }: { joiners: RecentJoiner[] }) {
  if (!joiners.length)
    return (
      <Empty
        description="No new joiners in the last 30 days"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: 24 }}
      />
    );

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {joiners.map((j) => (
        <div
          key={j.id}
          style={{
            flex: "1 1 200px", maxWidth: 260,
            padding: "12px 14px", borderRadius: 10,
            border: "1px solid var(--bms-border)",
            background: "var(--bms-surface-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Avatar
              size={36}
              style={{ background: "#059669", fontSize: 13, fontWeight: 700, flexShrink: 0 }}
            >
              {j.full_name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "var(--bms-text)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {j.full_name}
              </div>
              <div style={{ fontSize: 11, color: "var(--bms-text-3)", fontFamily: "monospace" }}>
                {j.employee_code}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginBottom: 6 }}>
            {j.designation || "—"}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Tag
              color="blue"
              style={{ fontSize: 10, borderRadius: 20, padding: "0 6px", margin: 0 }}
            >
              {j.department || "—"}
            </Tag>
            <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
              {dayjs(j.joining_date).format("DD MMM YYYY")}
            </Text>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Payroll status bar ─────────────────────────────────────────────────────────
function PayrollStatus({ p }: { p: HRMSData["payroll"] }) {
  const items = [
    { label: "Draft",     value: p.draft,     color: "#d97706", icon: <ClockCircleOutlined />  },
    { label: "Finalized", value: p.finalized, color: "#1677ff", icon: <CheckCircleOutlined />  },
    { label: "Paid",      value: p.paid,      color: "#059669", icon: <CheckCircleOutlined />  },
  ];

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
          {dayjs().format("MMMM YYYY")} — {p.total} payroll record{p.total !== 1 ? "s" : ""} total
        </Text>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {items.map(({ label, value, color, icon }) => (
          <div
            key={label}
            style={{
              flex: "1 1 80px", textAlign: "center",
              padding: "14px 8px", borderRadius: 10,
              background: color + "18",
              border: `1px solid ${color}33`,
            }}
          >
            <div style={{ fontSize: 18, color, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      {p.total > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Paid progress</Text>
            <Text style={{ fontSize: 11, fontWeight: 600, color: "#059669" }}>
              {p.total > 0 ? Math.round((p.paid / p.total) * 100) : 0}%
            </Text>
          </div>
          <Progress
            percent={p.total > 0 ? Math.round((p.paid / p.total) * 100) : 0}
            strokeColor="#059669"
            showInfo={false}
            size="small"
          />
        </div>
      )}
    </div>
  );
}

// ── Leave this month pills ─────────────────────────────────────────────────────
function LeaveMonthStats({ stats }: { stats: HRMSData["leave"]["stats_this_month"] }) {
  const items = [
    { label: "Pending",  value: stats.pending,  color: "#f59e0b", icon: <ExclamationCircleOutlined /> },
    { label: "Approved", value: stats.approved, color: "#059669", icon: <CheckCircleOutlined />       },
    { label: "Rejected", value: stats.rejected, color: "#dc2626", icon: <CloseCircleOutlined />       },
  ];

  return (
    <div style={{ display: "flex", gap: 10 }}>
      {items.map(({ label, value, color, icon }) => (
        <div
          key={label}
          style={{
            flex: 1, textAlign: "center", padding: "10px 6px",
            borderRadius: 10,
            background: color + "18",
            border: `1px solid ${color}33`,
          }}
        >
          <div style={{ fontSize: 16, color, marginBottom: 2 }}>{icon}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          <div style={{ fontSize: 11, color: "var(--bms-text-2)" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function HRMSDashboardPage() {
  const { data, isLoading, isError } = useQuery<HRMSData>({
    queryKey: ["hrms-dashboard"],
    queryFn:  () => get("/dashboard/hrms/"),
    staleTime: 60_000,
  });

  if (isLoading)
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );

  if (isError || !data)
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <Empty description="Failed to load HRMS dashboard. Contact admin if this persists." />
      </div>
    );

  const totalTracked =
    data.attendance_today.PRESENT +
    data.attendance_today.WFH +
    data.attendance_today.HALF_DAY +
    data.attendance_today.ON_LEAVE +
    data.attendance_today.ABSENT;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bms-bg)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>HRMS Dashboard</Title>
        <Text style={{ color: "var(--bms-text-2)", fontSize: 13 }}>
          People, attendance, leave and payroll overview · {dayjs(data.date).format("DD MMM YYYY")}
        </Text>
      </div>

      {/* ── KPI row ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 0 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            label="Active Employees"
            value={data.headcount.total_active}
            color="#1677ff"
            icon={<TeamOutlined />}
            sub={`${data.headcount.new_joiners_month} joined this month`}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            label="Attendance Rate Today"
            value={`${data.attendance_today.attendance_rate}%`}
            color={data.attendance_today.attendance_rate >= 80 ? "#059669" : "#d97706"}
            icon={<CalendarOutlined />}
            sub={`${totalTracked} of ${data.headcount.total_active} tracked`}
            progress={data.attendance_today.attendance_rate}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            label="Pending Leave Requests"
            value={data.leave.pending_count}
            color={data.leave.pending_count > 0 ? "#f59e0b" : "#059669"}
            icon={<ExclamationCircleOutlined />}
            sub="Awaiting approval"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            label="Payroll This Month"
            value={data.payroll.paid}
            color="#7c3aed"
            icon={<WalletOutlined />}
            sub={`${data.payroll.total} total · ${data.payroll.draft} draft`}
          />
        </Col>
      </Row>

      {/* ── Charts row ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Section
            title="Today's Attendance"
            icon={<CalendarOutlined />}
            iconColor="#059669"
            lightBg="#ecfdf5"   lightBorder="#a7f3d0"
            darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
          >
            <AttendanceSummary att={data.attendance_today} />
          </Section>
        </Col>
        <Col xs={24} lg={12}>
          <Section
            title="Department Distribution"
            icon={<TeamOutlined />}
            iconColor="#1677ff"
            lightBg="#eff6ff"   lightBorder="#bfdbfe"
            darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
          >
            <DeptChart data={data.headcount.dept_distribution} />
          </Section>
        </Col>
      </Row>

      {/* ── Leave row ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Section
            title={`Pending Leave Requests (${data.leave.pending_count})`}
            icon={<ExclamationCircleOutlined />}
            iconColor="#f59e0b"
            lightBg="#fffbeb"   lightBorder="#fde68a"
            darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
          >
            <PendingLeaveTable rows={data.leave.pending_list} />
          </Section>
        </Col>
        <Col xs={24} lg={8}>
          <Row gutter={[16, 16]} style={{ height: "100%" }}>
            <Col span={24}>
              <Section
                title={`Leave This Month — ${dayjs().format("MMM YYYY")}`}
                icon={<CalendarOutlined />}
                iconColor="#7c3aed"
                lightBg="#faf5ff"   lightBorder="#e9d5ff"
                darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
              >
                <LeaveMonthStats stats={data.leave.stats_this_month} />
              </Section>
            </Col>
            <Col span={24}>
              <Section
                title="Payroll Status"
                icon={<WalletOutlined />}
                iconColor="#db2777"
                lightBg="#fff1f2"   lightBorder="#fecdd3"
                darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
              >
                <PayrollStatus p={data.payroll} />
              </Section>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* ── Recent joiners ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Section
            title={`New Joiners — Last 30 Days (${data.recent_joiners.length})`}
            icon={<UserAddOutlined />}
            iconColor="#059669"
            lightBg="#f0fdf4"   lightBorder="#bbf7d0"
            darkBg="var(--bms-surface-2)" darkBorder="var(--bms-border)"
          >
            <RecentJoiners joiners={data.recent_joiners} />
          </Section>
        </Col>
      </Row>
    </div>
  );
}