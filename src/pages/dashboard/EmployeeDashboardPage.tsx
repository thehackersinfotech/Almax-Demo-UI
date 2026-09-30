import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Row, Col, Card, Tag, Typography, Progress, Table, Empty, Spin,
  Avatar, Divider, Button, Tooltip, message, Modal, Form, Input,
  Select, DatePicker, Badge, Space,
} from "antd";
import {
  ClockCircleOutlined, CheckCircleOutlined,
  UserOutlined, ProjectOutlined,
  CalendarOutlined, LoginOutlined,
  LogoutOutlined, CoffeeOutlined, PauseCircleOutlined,
  PlayCircleOutlined, PlusOutlined, WalletOutlined,
  FilePdfOutlined, DownloadOutlined, EyeOutlined, EyeInvisibleOutlined,
  ScheduleOutlined, SyncOutlined, FolderOpenOutlined, AppstoreOutlined,
  PhoneOutlined, MailOutlined, WhatsAppOutlined, EnvironmentOutlined,
  WarningOutlined, CheckOutlined, HomeOutlined, InfoCircleOutlined,
  FileProtectOutlined, RightOutlined, LeftOutlined,
} from "@ant-design/icons";
import { Pie } from "@ant-design/charts";
import AttendanceCalendar from "@/components/common/AttendanceCalendar";
import "@/components/dashboard/dashboard.css";
import SocialFeedWidget from "@/pages/social-feed/components/SocialFeedWidget";
import { useNavigate } from "react-router-dom";
import { get, post } from "@/services/api";
import { followUpApi, type FollowUpItem } from "@/services/followups";
import { OPERATIONS } from "@/pages/workspace/workspaceCalendarTheme";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { LeaveStatusBadge } from "@/pages/employees/leave/leaveStatus";
import { ApplyLeaveModal } from "@/components/employee/LeaveAndPayslip";
import dayjs, { Dayjs } from "dayjs";
import {
  canClockInNow, canClockOutNow, clockInUnavailableReason, clockOutUnavailableReason,
} from "@/utils/attendanceClockRules";
import { HOURS_PIE_COLORS, ALLOCATION_PIE_COLORS } from "@/utils/chartColors";

const { Text, Title } = Typography;

// ── Types ─────────────────────────────────────────────────────────────────────
interface AttendanceBreak {
  id: string; break_type: string; break_type_label: string;
  start_time: string; end_time: string | null; duration_minutes: number;
}
interface AttendanceToday {
  status: string | null; check_in: string | null; check_out: string | null;
  duration_hours: number; working_hours?: number; total_break_minutes?: number;
  breaks?: AttendanceBreak[];
  clockin_enabled?: boolean;
  shift_start?: string | null;
  shift_end?: string | null;
  can_clock_in?: boolean;
  can_clock_out?: boolean;
  clock_in_window?: string | null;
  clock_out_window?: string | null;
}
interface LeaveBalance {
  id: string;
  leave_type_id: string;        // ← was missing, now added via serializer
  leave_type: string;           // ← this was wrong, backend sends leave_type_name
  leave_type_name: string;      // ← actual field name
  code: string;                 // ← wrong, backend sends leave_type_code
  leave_type_code: string;      // ← actual field name
  color: string;                // ← wrong, backend sends leave_type_color
  leave_type_color: string;     // ← actual field name
  is_paid: boolean;
  total: number;                // ← wrong, backend sends total_days
  total_days: number;           // ← actual field name
  used: number;                 // ← wrong, backend sends used_days
  used_days: number;            // ← actual field name
  remaining: number;            // ← wrong, backend sends remaining_days
  remaining_days: number;       // ← actual field name
}
interface LeaveRequest {
  id: string;
  leave_type_name: string;  // ← renamed from leave_type
  leave_type: string;       // ← keep for backwards compat, maps to leave_type_name
  color: string;            // ← maps to leave_type_color
  leave_type_color: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  reason: string;
}
interface WorkStats {
  avg_working_hours: number; avg_break_minutes: number;
  total_working_hours: number; total_break_minutes: number;
  working_days_count: number; on_time: number; late: number; early: number;
}
interface WFHStatus {
  wfh_enabled: boolean;
  pending_wfh_request: boolean;
  approved_wfh_today: boolean;
}
interface TicketWorkflowTicket {
  id: string;
  ticket_number: string;
  title: string;
  type: string;
  priority: string;
  due_date: string | null;
  project_code: string;
  project_name: string;
  is_overdue: boolean;
}
interface TicketWorkflowState {
  slug: string;
  name: string;
  color: string;
  count: number;
  is_initial: boolean;
  is_final: boolean;
  tickets: TicketWorkflowTicket[];
}
interface EmpDashboard {
  profile: {
    id: string; full_name: string; employee_code: string; email: string;
    designation: string; department: string;
    keycloak_group: string; joining_date: string | null;
    profile_picture_url: string | null;
    shift_applicable: boolean;
  };
  work_items: { open: number; in_progress: number; in_review: number; done: number; total: number; overdue: number };
  ticket_workflow?: TicketWorkflowState[];
  recent_items: Array<{
    id: string; ticket_number: string; title: string; type: string;
    status: string; status_color?: string; priority: string; due_date: string | null;
    project: string; project_code?: string;
  }>;
  pending_followups?: Array<{
    id: string; title: string; type: string; type_label: string;
    priority: string; priority_label: string;
    description: string; due_date: string | null;
    start_time: string | null; end_time: string | null;
    is_overdue: boolean;
    assignee_name: string; workflow_state_slug: string; workflow_state_name: string;
  }>;
  my_projects: Array<{
    id: string; name: string; code: string; client: string;
    status: string; allocation_percentage: number;
    start_date: string; end_date: string | null;
  }>;
  timesheet: { weekly_hours: number; expected_hours: number; daily_logs: Array<{ log_date: string; hours: number }> };
  recent_logs: Array<{
    id: string; log_date: string; hours: number; notes: string;
    work_item: string; ticket: string; project: string; is_billable: boolean;
  }>;
  attendance_today: AttendanceToday;
  attendance_month: { present: number; wfh: number; half_day: number; on_leave: number };
  checkin_stats: WorkStats;
  leave_balances: LeaveBalance[];
  leave_requests: LeaveRequest[];
  wfh_status: WFHStatus;
  payslips: Array<{ id: string; month: number; month_name: string; year: number; status: string; net_salary: number }>;
  payslips_fy: string;
  reporting_hierarchy?: { manager?: { id: string; name: string; employee_code: string; designation: string; avatar: string | null } };
}

// ── Color maps ────────────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#d97706", LOW: "#6b7280",
};
const PROJECT_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#10b981", ON_HOLD: "#f59e0b", COMPLETED: "#6b7280", DELAYED: "#ef4444", PLANNING: "#3b82f6",
};
const BREAK_COLORS: Record<string, string> = { TEA: "#f59e0b", LUNCH: "#059669", OTHER: "#6b7280" };
const BREAK_ICONS: Record<string, React.ReactNode> = {
  TEA: <CoffeeOutlined />, LUNCH: <CoffeeOutlined />, OTHER: <PauseCircleOutlined />,
};
const PAYSLIP_STYLE: Record<string, { color: string; bg: string }> = {
  DRAFT:     { color: "#d97706", bg: "#fffbeb" },
  FINALIZED: { color: "#1677ff", bg: "#eff6ff" },
  PAID:      { color: "#059669", bg: "#f0fdf4" },
};
const LEAVE_STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b", APPROVED: "#10b981", REJECTED: "#ef4444", CANCELLED: "#6b7280",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}
function getGreeting(hour: number) {
  if (hour >= 5  && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}
function useGreetingClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(id); }, []);
  return now;
}
function captureGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), { timeout: 5000 },
    );
  });
}

import PastelTag from "@/components/common/PastelTag";
import PercentChip from "@/components/common/PercentChip";
import { PriorityIcon, TypeIcon } from "@/components/tickets/TicketIcons";
import type { TicketPriority, TicketType } from "@/services/tickets";
import { DANGER, priorityTone } from "@/utils/semanticColors";

function formatFollowUpTimeRange(start: string | null | undefined, end: string | null | undefined) {
  const fmt = (t: string) => dayjs(t, ["HH:mm", "HH:mm:ss"]).format("h:mm A");
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return null;
}

const FOLLOWUP_TYPE_ICON: Record<string, React.ReactNode> = {
  EMAIL: <MailOutlined />, CALL: <PhoneOutlined />, MEETING: <CalendarOutlined />,
  WHATSAPP: <WhatsAppOutlined />, SITE_VISIT: <EnvironmentOutlined />,
};

function followUpTypeStyle(type: string) {
  const key = type.toLowerCase();
  return OPERATIONS[key] ?? OPERATIONS.followup;
}

function formatScheduleTime(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return "All day";
  const fmt = (t: string) => dayjs(`2000-01-01T${t}`).format("h:mm A");
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function FollowUpDaySchedule({
  selectedDay,
  onDayChange,
  onDone,
  onOpenCalendar,
}: {
  selectedDay: Dayjs;
  onDayChange: (d: Dayjs) => void;
  onDone: (id: string) => void;
  onOpenCalendar: () => void;
}) {
  const dateKey = selectedDay.format("YYYY-MM-DD");
  const isToday = selectedDay.isSame(dayjs(), "day");

  // Fetch all follow-ups for the date range (start_date <= date <= end_date)
  // Use start_date=gte and end_date=lte filters from the API
  const { data: items = [], isLoading } = useQuery<FollowUpItem[]>({
    queryKey: ["emp-followups-day", dateKey],
    queryFn: () => followUpApi.listAll({ start_date: dateKey, end_date: dateKey }),
    staleTime: 30_000,
  });

  // Separate meetings from other follow-ups
  const meetings = useMemo(() => items.filter((f) => f.type === "MEETING"), [items]);
  const others = useMemo(() => items.filter((f) => f.type !== "MEETING"), [items]);

  const sortItems = (arr: FollowUpItem[]) =>
    [...arr].sort((a, b) => {
      const active = (f: FollowUpItem) =>
        f.workflow_state_slug !== "completed" && f.workflow_state_slug !== "cancelled";
      if (active(a) !== active(b)) return active(a) ? -1 : 1;
      return (a.start_time ?? "23:59").localeCompare(b.start_time ?? "23:59");
    });

  const sortedMeetings = useMemo(() => sortItems(meetings), [meetings]);
  const sortedOthers = useMemo(() => sortItems(others), [others]);

  const dayLabel = isToday
    ? "Today"
    : selectedDay.isSame(dayjs().add(1, "day"), "day")
      ? "Tomorrow"
      : selectedDay.format("ddd, DD MMM");

  function ScheduleItem({ f }: { f: FollowUpItem }) {
    const op = followUpTypeStyle(f.type);
    const done = f.workflow_state_slug === "completed" || f.workflow_state_slug === "cancelled";
    const isMeeting = f.type === "MEETING";
    return (
      <div className={`emp-followup-schedule__row${done ? " emp-followup-schedule__row--done" : ""}`}>
        <div
          className="emp-followup-schedule__card"
          style={{ background: op.bg, borderColor: op.border, opacity: done ? 0.65 : 1 }}
        >
          <div className="emp-followup-schedule__card-title">{f.title}</div>
          <div className="emp-followup-schedule__card-meta" style={{ color: op.dot, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{f.type_label.toUpperCase()}</span>
            {isMeeting && f.meeting_mode && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                background: f.meeting_mode === "ONLINE" ? "#e8f0fe" : "#e6f4ea",
                color: f.meeting_mode === "ONLINE" ? "#1a73e8" : "#137333",
                border: `1px solid ${f.meeting_mode === "ONLINE" ? "#4285f4" : "#34a853"}`,
              }}>
                {f.meeting_mode === "ONLINE" ? "Online" : "Offline"}
              </span>
            )}
          </div>
          {f.is_overdue && !done && (
            <span className="emp-followup-schedule__overdue">
              <WarningOutlined /> Overdue
            </span>
          )}
          {!done && (
            <Button
              size="small" type="text" icon={<CheckOutlined />}
              className="emp-followup-schedule__done-btn"
              onClick={() => onDone(f.id)}
            >Done</Button>
          )}
        </div>
        <div className="emp-followup-schedule__rail">
          <span className="emp-followup-schedule__dot" style={{ background: op.dot, borderColor: op.border }} />
          <span className="emp-followup-schedule__time">{formatScheduleTime(f.start_time, f.end_time)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="emp-followup-schedule emp-followup-schedule--embedded">
      <div className="emp-followup-schedule__head">
        <div className="emp-followup-schedule__head-title">
          <CalendarOutlined />
          <span>Schedule</span>
        </div>
        <Space size={2} className="emp-followup-schedule__head-controls">
          <Button type="text" size="small" icon={<LeftOutlined />} aria-label="Previous day"
            onClick={() => onDayChange(selectedDay.subtract(1, "day"))} />
          <Button type="text" size="small" className="emp-followup-schedule__day-btn"
            onClick={() => onDayChange(dayjs())}>
            {dayLabel}
          </Button>
          <Button type="text" size="small" icon={<RightOutlined />} aria-label="Next day"
            onClick={() => onDayChange(selectedDay.add(1, "day"))} />
          <Tooltip title="Open calendar">
            <Button type="text" size="small" icon={<CalendarOutlined />} onClick={onOpenCalendar} />
          </Tooltip>
        </Space>
      </div>

      {isLoading ? (
        <div className="emp-followup-schedule__loading"><Spin size="small" /></div>
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={isToday ? "Nothing scheduled today" : "No follow-ups this day"}
          style={{ margin: "8px 0 4px" }}
        />
      ) : (
        <div className={`emp-followup-schedule__list${items.length > 2 ? " emp-followup-schedule__list--scroll" : ""}`}>

          {/* Meetings section */}
          {sortedMeetings.length > 0 && (
            <>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#1a73e8", letterSpacing: "0.05em",
                textTransform: "uppercase", padding: "4px 2px 2px", display: "flex", alignItems: "center", gap: 4,
              }}>
                <CalendarOutlined /> Meetings ({sortedMeetings.length})
              </div>
              {sortedMeetings.map((f) => <ScheduleItem key={f.id} f={f} />)}
            </>
          )}

          {/* Other follow-ups */}
          {sortedOthers.length > 0 && (
            <>
              {sortedMeetings.length > 0 && (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "var(--bms-text-3)", letterSpacing: "0.05em",
                  textTransform: "uppercase", padding: "6px 2px 2px",
                }}>
                  Follow-ups ({sortedOthers.length})
                </div>
              )}
              {sortedOthers.map((f) => <ScheduleItem key={f.id} f={f} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Widget wrapper ────────────────────────────────────────────────────────────
function Widget({ title, icon, children, extra, iconColor = "#1677ff", bgColor, borderColor, className, fill }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  extra?: React.ReactNode; iconColor?: string; bgColor?: string; borderColor?: string;
  className?: string; fill?: boolean;
}) {
  const isDark  = useThemeStore((s) => s.isDark);
  const hBg     = isDark ? "var(--bms-surface-2)" : (bgColor     ?? "var(--bms-surface-2)");
  const hBorder = isDark ? "var(--bms-border)"    : (borderColor ?? "#eaecf0");
  return (
    <Card size="small"
      title={<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: iconColor }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      </div>}
      extra={extra}
      styles={{
        body: {
          padding: "14px 16px",
          background: "var(--bms-surface)",
          borderRadius: "0 0 12px 12px",
          ...(fill ? { flex: 1, display: "flex", flexDirection: "column" } : {}),
        },
        header: { background: hBg, borderBottom: `1px solid ${hBorder}`, minHeight: 44 },
      }}
      style={{
        borderRadius: 12,
        border: `1px solid ${hBorder}`,
        background: "var(--bms-surface)",
        ...(fill ? { height: "100%", display: "flex", flexDirection: "column" } : {}),
      }}
      className={[className, fill ? "emp-dash-widget" : ""].filter(Boolean).join(" ") || undefined}
    >
      {children}
    </Card>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(95, 99, 104, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function WorkflowStatusChip({ name, color }: { name: string; color?: string }) {
  const accent = color || "#80868b";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 6,
      background: hexToRgba(accent, 0.12),
      border: `1px solid ${hexToRgba(accent, 0.28)}`,
      fontSize: 11, fontWeight: 600, color: accent, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
      {name}
    </span>
  );
}

function WorkflowStatCard({
  state,
  onClick,
}: {
  state: TicketWorkflowState;
  onClick: () => void;
}) {
  const color = state.color || "#80868b";
  const active = state.count > 0;

  return (
    <button
      type="button"
      className={`emp-ticket-stat-card${active ? " emp-ticket-stat-card--active" : ""}`}
      style={{ "--stat-color": color } as React.CSSProperties}
      disabled={!active}
      onClick={active ? onClick : undefined}
      aria-disabled={!active}
      aria-label={`${state.name}: ${state.count} ${state.count === 1 ? "ticket" : "tickets"}`}
    >
      <div className="emp-ticket-stat-card__head">
        <span className="emp-ticket-stat-card__dot" />
        <span className="emp-ticket-stat-card__name">{state.name}</span>
      </div>
      <div className="emp-ticket-stat-card__value">{state.count}</div>
      <div className="emp-ticket-stat-card__label">
        {state.count === 1 ? "ticket" : "tickets"}
      </div>
    </button>
  );
}

function TicketWorkflowModal({
  state,
  open,
  onClose,
  onOpenTicket,
}: {
  state: TicketWorkflowState | null;
  open: boolean;
  onClose: () => void;
  onOpenTicket: (id: string) => void;
}) {
  if (!state) return null;
  const color = state.color || "#80868b";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      title={(
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{state.name}</span>
          <span style={{
            fontSize: 12, fontWeight: 700, color,
            background: hexToRgba(color, 0.12),
            border: `1px solid ${hexToRgba(color, 0.28)}`,
            borderRadius: 999, padding: "2px 10px",
          }}>
            {state.count}
          </span>
        </div>
      )}
      destroyOnHidden
    >
      {state.tickets.length === 0 ? (
        <Empty description={`No tickets in ${state.name}`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {state.tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onClose(); onOpenTicket(t.id); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${hexToRgba(color, 0.2)}`,
                background: "var(--bms-surface)",
                transition: "background 0.12s, border-color 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = hexToRgba(color, 0.06);
                e.currentTarget.style.borderColor = hexToRgba(color, 0.35);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--bms-surface)";
                e.currentTarget.style.borderColor = hexToRgba(color, 0.2);
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ paddingTop: 2, flexShrink: 0 }}>
                  <TypeIcon type={t.type as TicketType} size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <code style={{ fontSize: 11, color: "var(--bms-text-2)", fontFamily: "monospace" }}>{t.ticket_number}</code>
                    {t.is_overdue && <Tag color="error" style={{ margin: 0, fontSize: 10, borderRadius: 20 }}>Overdue</Tag>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--bms-text)", marginBottom: 6 }}>{t.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {(t.project_code || t.project_name) && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t.project_code ? `${t.project_code} · ` : ""}{t.project_name}
                      </Text>
                    )}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <PriorityIcon priority={t.priority as TicketPriority} />
                      <Text style={{ fontSize: 11, color: PRIORITY_COLOR[t.priority] ?? "var(--bms-text-2)" }}>{t.priority}</Text>
                    </span>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Due: {t.due_date ? dayjs(t.due_date).format("DD MMM YYYY") : "—"}
                    </Text>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {state.count > state.tickets.length && (
        <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 10, textAlign: "center" }}>
          Showing {state.tickets.length} of {state.count} — open Tickets for full list
        </Text>
      )}
    </Modal>
  );
}


function MiniHoursPieChart({ logs }: { logs: Array<{ log_date: string; hours: number }> }) {
  const pieData = useMemo(
    () => logs.map((l, i) => ({
      type: dayjs(l.log_date).format("D MMM"),
      fullDate: l.log_date,
      value: l.hours,
      color: HOURS_PIE_COLORS[i % HOURS_PIE_COLORS.length],
    })),
    [logs],
  );

  const total = useMemo(() => logs.reduce((s, l) => s + l.hours, 0), [logs]);

  if (!logs.length) {
    return <div style={{ color: "#9ca3af", fontSize: 12, paddingTop: 6 }}>No logs this month</div>;
  }

  return (
    <div className="emp-hours-pie">
      <Pie
        data={pieData}
        angleField="value"
        colorField="type"
        color={({ type }: { type: string }) => pieData.find((d) => d.type === type)?.color ?? "#cbd5e1"}
        radius={0.92}
        innerRadius={0.58}
        height={132}
        label={false}
        legend={false}
        tooltip={{
          title: (d: { fullDate?: string; type?: string }) => d.fullDate ?? d.type ?? "",
          items: [{ field: "value", name: "Hours", valueFormatter: (v: number) => `${v}h` }],
        }}
        statistic={{
          title: { content: "Logged", style: { fontSize: 11, color: "#9ca3af" } },
          content: { content: `${total.toFixed(1)}h`, style: { fontSize: 15, fontWeight: 600 } },
        }}
      />
    </div>
  );
}

function ProjectAllocationChart({ projects }: { projects: EmpDashboard["my_projects"] }) {
  const pieData = useMemo(
    () => projects.map((p, i) => ({
      type: p.code || p.name.slice(0, 14),
      name: p.name,
      value: p.allocation_percentage,
      color: ALLOCATION_PIE_COLORS[i % ALLOCATION_PIE_COLORS.length],
    })),
    [projects],
  );

  const total = useMemo(
    () => projects.reduce((s, p) => s + p.allocation_percentage, 0),
    [projects],
  );

  if (!projects.length) {
    return <div style={{ color: "#9ca3af", fontSize: 12, paddingTop: 6 }}>No allocations</div>;
  }

  return (
    <div className="emp-allocation-pie">
      <Pie
        data={pieData}
        angleField="value"
        colorField="type"
        color={({ type }: { type: string }) => pieData.find((d) => d.type === type)?.color ?? "#cbd5e1"}
        radius={0.92}
        innerRadius={0.58}
        height={148}
        label={false}
        legend={false}
        tooltip={{
          title: (d: { name?: string; type?: string }) => d.name ?? d.type ?? "",
          items: [{ field: "value", name: "Allocation", valueFormatter: (v: number) => `${v}%` }],
        }}
        statistic={{
          title: { content: "Allocated", style: { fontSize: 10, color: "#9ca3af" } },
          content: { content: `${total}%`, style: { fontSize: 14, fontWeight: 600 } },
        }}
      />
    </div>
  );
}

function ActiveProjectsWidget({
  projects,
  onOpenProject,
}: {
  projects: EmpDashboard["my_projects"];
  onOpenProject: () => void;
}) {
  return (
    <Widget title="My Active Projects" icon={<ProjectOutlined />} bgColor="#fffbeb" borderColor="#fde68a" iconColor="#d97706" fill
      extra={projects.length > 0 ? (
        <Button type="link" size="small" onClick={onOpenProject} style={{ padding: 0, fontSize: 12 }}>
          All projects
        </Button>
      ) : undefined}
    >
      {projects.length === 0 ? (
        <Empty description="No active project allocations" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="emp-projects-split">
          <div className="emp-projects-split__list">
            {projects.map((p) => (
              <div key={p.id} className="emp-project-card" onClick={onOpenProject} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpenProject()}>
                <div className="emp-project-card__head">
                  <Text strong style={{ fontSize: 13, lineHeight: 1.3, color: "var(--bms-text)" }}>{p.name}</Text>
                  <Tag color={PROJECT_STATUS_COLOR[p.status] ?? "#6b7280"} style={{ fontSize: 10, borderRadius: 20, padding: "0 7px", marginLeft: 6, flexShrink: 0 }}>{p.status}</Tag>
                </div>
                {p.client && <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{p.client}</Text>}
                <div className="emp-project-card__alloc">
                  <Text style={{ fontSize: 11, color: "var(--bms-text-2)" }}>Allocation</Text>
                  <PercentChip value={p.allocation_percentage} mode="allocation" />
                </div>
                {p.end_date && (
                  <div className="emp-project-card__date">
                    <CalendarOutlined style={{ fontSize: 11, color: "var(--bms-text-3)" }} />
                    <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Until {p.end_date}</Text>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="emp-projects-split__chart">
            <Text className="emp-projects-split__chart-label">Allocation mix</Text>
            <ProjectAllocationChart projects={projects} />
          </div>
        </div>
      )}
    </Widget>
  );
}

// ── Work hours stats ──────────────────────────────────────────────────────────
function WorkHoursStats({ stats, fill = true }: { stats: WorkStats; fill?: boolean }) {
  const totalDays        = stats.working_days_count;
  const hasData          = totalDays > 0;
  const allowedBreakMins = 45 + 20 * 2 + 5;
  const breakPct = hasData ? Math.min(100, Math.round((stats.avg_break_minutes / allowedBreakMins) * 100)) : 0;
  const workPct  = hasData ? Math.min(100, Math.round((stats.avg_working_hours  / 9) * 100)) : 0;
  return (
    <Widget title="Monthly Work Statistics" icon={<ClockCircleOutlined />} iconColor="#7c3aed" bgColor="#faf5ff" borderColor="#e9d5ff" fill={fill}>
      {!hasData ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>No attendance data this month</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1677ff" }} />
                <Text style={{ fontSize: 12 }}>Avg Working Hours / Day</Text>
              </div>
              <Text style={{ fontSize: 12, fontWeight: 700, color: workPct >= 90 ? "#059669" : workPct >= 70 ? "#1677ff" : "#d97706" }}>
                {stats.avg_working_hours.toFixed(1)}h
              </Text>
            </div>
            <Progress percent={workPct} strokeColor={workPct >= 90 ? "#059669" : workPct >= 70 ? "#1677ff" : "#d97706"} showInfo={false} size="small" />
            <div style={{ fontSize: 10, color: "var(--bms-text-3)", marginTop: 2 }}>
              Total: {stats.total_working_hours.toFixed(1)}h across {totalDays} day{totalDays > 1 ? "s" : ""}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                <Text style={{ fontSize: 12 }}>Avg Break / Day</Text>
              </div>
              <Text style={{ fontSize: 12, fontWeight: 700, color: breakPct > 90 ? "#dc2626" : "#f59e0b" }}>
                {stats.avg_break_minutes.toFixed(0)} min
              </Text>
            </div>
            <Progress percent={breakPct} strokeColor={breakPct > 90 ? "#dc2626" : "#f59e0b"} showInfo={false} size="small" />
            <div style={{ fontSize: 10, color: "var(--bms-text-3)", marginTop: 2 }}>
              Allowed: Lunch 45m · Tea 20m × 2 · Other 5m = {allowedBreakMins}m total
            </div>
          </div>
          {(stats.on_time + stats.late + stats.early) > 0 && (
            <div>
              <Text style={{ fontSize: 11, color: "var(--bms-text-2)", display: "block", marginBottom: 6 }}>Punctuality</Text>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { label: "On Time", value: stats.on_time, color: "#059669" },
                  { label: "Late",    value: stats.late,    color: "#dc2626" },
                  { label: "Early",   value: stats.early,   color: "#1677ff" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, textAlign: "center", padding: "6px 4px", background: color + "0d", borderRadius: 8, border: `1px solid ${color}22` }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 10, color: "var(--bms-text-2)" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Widget>
  );
}

// ── WFH Request Modal ─────────────────────────────────────────────────────────
function WFHRequestModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm();
  const mutation = useMutation({
    mutationFn: (values: { date: Dayjs; reason: string }) =>
      post("/attendance/wfh-requests/", {
        requested_date: values.date.format("YYYY-MM-DD"),
        date:           values.date.format("YYYY-MM-DD"),
        reason:         values.reason,
      }),
    onSuccess: () => { message.success("WFH request submitted — your Reporting Manager will review it"); form.resetFields(); onSuccess(); },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail
        || Object.entries(e?.response?.data ?? {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(", ")
        || "Failed to submit WFH request";
      message.error(detail);
    },
  });
  return (
    <Modal title={<span><HomeOutlined style={{ color: "#2563eb", marginRight: 8 }} />Request Work From Home</span>}
      open={open} onCancel={() => { form.resetFields(); onClose(); }} footer={null} width={440} destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}
        onFinish={(v) => mutation.mutate({ date: v.date, reason: v.reason || "" })}>
        <Form.Item name="date" label="WFH Date" rules={[{ required: true, message: "Please select a date" }]}>
          <DatePicker style={{ width: "100%" }} format="DD MMM YYYY"
            disabledDate={(d) => d && d < dayjs().startOf("day")} />
        </Form.Item>
        <Form.Item name="reason" label="Reason" rules={[{ required: true, message: "Please provide a reason" }]}>
          <Input.TextArea rows={3} placeholder="Why do you need to work from home?" />
        </Form.Item>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={() => { form.resetFields(); onClose(); }}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}
            style={{ background: "#2563eb", borderColor: "#2563eb" }}>Submit Request</Button>
        </div>
      </Form>
    </Modal>
  );
}

// ── Shift Change Modal ────────────────────────────────────────────────────────
function ShiftChangeModal({ open, onClose, onSuccess, employeeId }: { open: boolean; onClose: () => void; onSuccess: () => void; employeeId: string }) {
  const [form] = Form.useForm();
  const requestType = Form.useWatch("request_type", form);
  const { data: shifts } = useQuery<Array<{ id: string; name: string; start_time: string; end_time: string }>>({
    queryKey: ["shifts-dropdown"],
    queryFn: () => get("/master/dropdown/shift-categories/")
                  .then((d: any) => d.results ?? d),
    enabled: open, staleTime: 120_000,
  });
   const mutation = useMutation({
    mutationFn: (payload: any) => post("/attendance/shift-change-requests/", payload),
    onSuccess: () => { message.success("Shift change request submitted — your Reporting Manager will review it"); form.resetFields(); onSuccess(); },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail
        || Object.entries(e?.response?.data ?? {}).map(([k, v]: any) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(", ")
        || "Failed to submit request";
      message.error(detail);
    },
  });
  return (
    <Modal title={<span><ScheduleOutlined style={{ color: "#7c3aed", marginRight: 8 }} />Request Shift Change</span>}
      open={open} onCancel={() => { form.resetFields(); onClose(); }} footer={null} width={460} destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 12 }} initialValues={{ request_type: "TEMPORARY" }}
        onFinish={(v) => mutation.mutate({
          employee:        employeeId,
          request_type:    v.request_type,
          requested_date:  v.request_type === "TEMPORARY" ? v.requested_date?.format("YYYY-MM-DD") : null,
          requested_shift: v.requested_shift,
          reason:          v.reason || "",
        })}>
        <Form.Item name="request_type" label="Change Type" rules={[{ required: true }]}>
          <Select options={[
            { value: "TEMPORARY", label: "Temporary — one specific date" },
            { value: "PERMANENT", label: "Permanent — update my default shift" },
          ]} />
        </Form.Item>
        {requestType === "TEMPORARY" && (
          <Form.Item name="requested_date" label="Date" rules={[{ required: true, message: "Select a date" }]}>
            <DatePicker style={{ width: "100%" }} format="DD MMM YYYY"
              disabledDate={(d) => !d || d < dayjs().startOf("day")} />
          </Form.Item>
        )}
        <Form.Item name="requested_shift" label="Requested Shift" rules={[{ required: true, message: "Select a shift" }]}>
          <Select showSearch placeholder="Select shift"
            filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            options={(shifts ?? []).map((s) => ({
              value: s.id,
              label: `${s.name} (${s.start_time?.slice(0, 5)} – ${s.end_time?.slice(0, 5)})`,
            }))} />
        </Form.Item>
        <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
          <Input.TextArea rows={3} placeholder="Why do you need this shift change?" />
        </Form.Item>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={() => { form.resetFields(); onClose(); }}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}
            style={{ background: "#7c3aed", borderColor: "#7c3aed" }}>Submit Request</Button>
        </div>
      </Form>
    </Modal>
  );
}

// ── View Leave Balances Modal (shows admin-assigned leaves + Apply button) ────
// ── View Leave Balances Modal ─────────────────────────────────────────────────
function ViewLeavesModal({
  open, onClose, balances, requests, onApplyLeave,
}: {
  open: boolean;
  onClose: () => void;
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  onApplyLeave: (leaveTypeId?: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<"policy" | "history">("policy");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const { data: historyData, isLoading: historyLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["leave-history", selectedYear],
    queryFn: () =>
      get("/leave/requests/", { year: selectedYear, page_size: 100 }).then(
        (d: any) => d.results ?? d
      ),
    enabled: open && activeTab === "history",
    staleTime: 30_000,
  });

  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - i).map((y) => ({
    value: y, label: `${y}`,
  }));

  useEffect(() => {
    if (!open) { setActiveTab("policy"); setSelectedYear(currentYear); }
  }, [open]);

  const TAB_STYLE = (active: boolean, color: string) => ({
    flex: 1, padding: "9px 0", border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 600, transition: "all 0.15s",
    background: active ? color : "var(--bms-surface-2)",
    color: active ? "#fff" : "var(--bms-text-2)",
  });

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileProtectOutlined style={{ color: "#7c3aed" }} />
          <span>My Leave — {currentYear}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
            Balances assigned by HR · history filtered by year
          </Text>
          <Button
            type="primary" icon={<PlusOutlined />}
            onClick={() => { onClose(); onApplyLeave(); }}
            style={{ background: "#7c3aed", borderColor: "#7c3aed", borderRadius: 8 }}
          >
            Apply Leave
          </Button>
        </div>
      }
      width={620}
      destroyOnHidden
    >
      <div style={{
        display: "flex", gap: 0, marginBottom: 16,
        borderRadius: 10, overflow: "hidden", border: "1px solid var(--bms-border)",
      }}>
        <button onClick={() => setActiveTab("policy")}
          style={{ ...TAB_STYLE(activeTab === "policy", "#7c3aed"), borderRight: "1px solid var(--bms-border)" }}>
          <FileProtectOutlined style={{ marginRight: 6 }} />Leave Policy
        </button>
        <button onClick={() => setActiveTab("history")} style={TAB_STYLE(activeTab === "history", "#0891b2")}>
          <ClockCircleOutlined style={{ marginRight: 6 }} />Leave History
        </button>
      </div>

      {activeTab === "policy" && (
        <>
          {balances.length === 0 ? (
            <Empty
              description={<span>No leave balances assigned yet. <Text style={{ color: "#9ca3af" }}>Contact HR.</Text></span>}
              image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "24px 0" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {balances.map((b) => {
                const usedPct  = b.total_days > 0 ? Math.round((b.used_days / b.total_days) * 100) : 0;
                const overUsed = b.used_days > b.total_days;
                return (
                  <div
                    key={b.leave_type_code}
                    style={{
                      padding: "14px 16px", borderRadius: 12,
                      border: `1px solid ${b.leave_type_color}30`,
                      background: b.leave_type_color + "08",
                      display: "flex", flexDirection: "column", gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: b.leave_type_color + "18", border: `1px solid ${b.leave_type_color}30`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <WalletOutlined style={{ color: b.leave_type_color, fontSize: 16 }} />
                        </div>
                        <div>
                          <Text style={{ fontSize: 14, fontWeight: 600, color: "var(--bms-text)", display: "block" }}>
                            {b.leave_type_name}
                          </Text>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                            <Tag style={{
                              fontSize: 10, borderRadius: 20, padding: "0 7px", margin: 0,
                              background: b.leave_type_color + "18", color: b.leave_type_color,
                              borderColor: b.leave_type_color + "40",
                            }}>
                              {b.leave_type_code}
                            </Tag>
                            <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
                              {b.is_paid ? "Paid" : "Unpaid"}
                            </Text>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {[
                          { label: "Total",     value: b.total_days,     color: "var(--bms-text-2)" },
                          { label: "Used",      value: b.used_days,      color: "#f59e0b" },
                          { label: "Remaining", value: b.remaining_days, color: overUsed ? "#ef4444" : "#059669" },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                            <div style={{ fontSize: 10, color: "var(--bms-text-3)" }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Progress
                        percent={usedPct}
                        strokeColor={overUsed ? "#ef4444" : b.leave_type_color}
                        trailColor={b.leave_type_color + "18"}
                        showInfo={false} size="small" style={{ marginBottom: 2 }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 10, color: "var(--bms-text-3)" }}>
                          {b.used_days} used of {b.total_days} allocated
                        </Text>
                        {overUsed && (
                          <Text style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>
                            Over by {b.used_days - b.total_days}d
                          </Text>
                        )}
                      </div>
                    </div>

                    {b.remaining_days > 0 && (
                      <Button
                        size="small"
                        onClick={() => { onClose(); onApplyLeave(b.leave_type_id); }}
                        style={{
                          alignSelf: "flex-end", borderRadius: 20, fontSize: 12,
                          color: b.leave_type_color, borderColor: b.leave_type_color, background: "transparent",
                        }}
                      >
                        Apply {b.leave_type_name}
                      </Button>
                    )}
                  </div>
                );
              })}

            </div>
          )}
        </>
      )}

      {activeTab === "history" && (
        <>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, padding: "10px 14px", borderRadius: 10,
            background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)",
          }}>
            <Text style={{ fontSize: 13, fontWeight: 600, color: "var(--bms-text)" }}>Leave History</Text>
            <Select value={selectedYear} onChange={(v) => setSelectedYear(v)}
              options={yearOptions} size="small" style={{ width: 100 }} />
          </div>

          {historyLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}><Spin /></div>
          ) : !historyData || historyData.length === 0 ? (
            <Empty description={`No leave requests found for ${selectedYear}`}
              image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "24px 0" }} />
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {([
                  { status: "PENDING",   color: "#f59e0b" },
                  { status: "APPROVED",  color: "#10b981" },
                  { status: "REJECTED",  color: "#ef4444" },
                  { status: "CANCELLED", color: "#6b7280" },
                ] as const).map(({ status, color }) => {
                  const count = historyData.filter((r) => r.status === status).length;
                  if (!count) return null;
                  return (
                    <div key={status} style={{
                      flex: 1, textAlign: "center", padding: "8px 6px",
                      borderRadius: 10, background: color + "12", border: `1px solid ${color}30`,
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color }}>{count}</div>
                      <div style={{ fontSize: 10, color: "var(--bms-text-3)" }}>{status}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto", paddingRight: 2 }}>
                {historyData.map((r) => {
                  return (
                    <div key={r.id} style={{
                      padding: "12px 14px", borderRadius: 10,
                      border: "1px solid var(--bms-border)", background: "var(--bms-surface-2)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: r.leave_type_color ?? "#1677ff", flexShrink: 0, marginTop: 2,
                          }} />
                          <Text style={{ fontSize: 13, fontWeight: 600, color: "var(--bms-text)" }}>
                            {r.leave_type_name ?? r.leave_type}
                          </Text>
                        </div>
                        <LeaveStatusBadge status={r.status} />
                      </div>

                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--bms-text-3)" }}>From</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--bms-text)" }}>{r.start_date}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--bms-text-3)" }}>To</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--bms-text)" }}>{r.end_date}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "var(--bms-text-3)" }}>Days</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#1677ff" }}>{r.days_count}d</div>
                        </div>
                      </div>

                      {r.reason && (
                        <div style={{
                          marginTop: 8, padding: "6px 10px", borderRadius: 6,
                          background: "var(--bms-surface)", border: "1px solid var(--bms-border)",
                          fontSize: 11, color: "var(--bms-text-2)",
                        }}>
                          {r.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
// ── Attendance widget ─────────────────────────────────────────────────────────
function AttendanceWidget({
  today, month, shiftApplicable, wfhStatus,
  onCheckIn, onCheckOut, onBreakStart, onBreakEnd,
  checkingIn, checkingOut, breakStarting, breakEnding,
  onViewCalendar, onRequestWFH, onRequestShiftChange,
}: {
  today: AttendanceToday; month: EmpDashboard["attendance_month"];
  shiftApplicable: boolean; wfhStatus: WFHStatus;
  onCheckIn: (s: string) => void; onCheckOut: () => void;
  onBreakStart: (bt: string) => void; onBreakEnd: () => void;
  checkingIn: boolean; checkingOut: boolean; breakStarting: boolean; breakEnding: boolean;
  onViewCalendar: () => void; onRequestWFH: () => void; onRequestShiftChange: () => void;
}) {
  const breaks      = today.breaks ?? [];
  const activeBreak = breaks.find((b) => !b.end_time);
  const onBreak     = !!activeBreak;
  const workingHrs  = today.working_hours ?? today.duration_hours;
  const breakMins   = today.total_break_minutes ?? 0;
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    if (!shiftApplicable) return;
    const timer = window.setInterval(() => setNow(dayjs()), 30_000);
    return () => window.clearInterval(timer);
  }, [shiftApplicable]);

  const canClockIn = useMemo(() => canClockInNow({
    shiftApplicable,
    shiftStart: today.shift_start,
    hrEnabled: today.clockin_enabled,
    now,
  }), [shiftApplicable, today.shift_start, today.clockin_enabled, now]);

  const canClockOut = useMemo(() => canClockOutNow({
    shiftApplicable,
    shiftEnd: today.shift_end,
    hrEnabled: today.clockin_enabled,
    now,
  }), [shiftApplicable, today.shift_end, today.clockin_enabled, now]);

  const clockInTip = useMemo(() => clockInUnavailableReason({
    shiftApplicable,
    shiftStart: today.shift_start,
    hrEnabled: today.clockin_enabled,
    clockInWindow: today.clock_in_window,
  }), [shiftApplicable, today.shift_start, today.clockin_enabled, today.clock_in_window]);

  const clockOutTip = useMemo(() => clockOutUnavailableReason({
    shiftApplicable,
    shiftEnd: today.shift_end,
    hrEnabled: today.clockin_enabled,
    clockOutWindow: today.clock_out_window,
  }), [shiftApplicable, today.shift_end, today.clockin_enabled, today.clock_out_window]);

  const statusBg = today.status === "PRESENT"  ? "#10b981"
                 : today.status === "WFH"       ? "#2563eb"
                 : today.status === "HALF_DAY"  ? "#f59e0b"
                 : today.status === "ON_LEAVE"  ? "#7c3aed"
                 : today.status === "ABSENT"    ? "#ef4444"
                 : "#6b7280";
  const statusLabel: Record<string, string> = {
    PRESENT: "Present", WFH: "Work From Home", HALF_DAY: "Half Day",
    ON_LEAVE: "On Leave", ABSENT: "Absent", HOLIDAY: "Holiday",
  };

  return (
    <Widget title="Attendance" icon={<CalendarOutlined />} iconColor="#059669"
      bgColor="var(--bms-surface-2)" borderColor="var(--bms-border)" fill className="emp-att-widget-card">

      <div className="emp-att-widget">
        {/* Today */}
        <div className="emp-att-widget__today">
          <div className="emp-att-widget__today-head">
            <span className="emp-att-widget__today-label">Today</span>
            <div className="emp-att-widget__badges">
              {!shiftApplicable && today.clockin_enabled && (
                <span className="emp-att-widget__badge emp-att-widget__badge--hr">HR Enabled</span>
              )}
              {shiftApplicable && today.shift_start && today.shift_end && (
                <span className="emp-att-widget__badge emp-att-widget__badge--shift">
                  Shift {today.shift_start} – {today.shift_end}
                </span>
              )}
              {onBreak && (
                <span className="emp-att-widget__badge emp-att-widget__badge--break">On Break</span>
              )}
              {today.status ? (
                <span className="emp-att-widget__badge" style={{ background: statusBg, color: "#fff" }}>
                  {statusLabel[today.status] ?? today.status}
                </span>
              ) : (
                <span className="emp-att-widget__badge emp-att-widget__badge--muted">Not marked</span>
              )}
            </div>
          </div>
          <div className="emp-att-widget__stats">
            {[
              { label: "Start Time", value: today.check_in ?? "--:--", highlight: !!today.check_in },
              { label: "End Time", value: today.check_out ?? "--:--", highlight: !!today.check_out },
              { label: "Working", value: workingHrs > 0 ? `${workingHrs}h` : "--", highlight: workingHrs > 0 },
              { label: "Break", value: breakMins > 0 ? `${breakMins}m` : "--", highlight: breakMins > 0 },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="emp-att-widget__stat">
                <span className="emp-att-widget__stat-label">{label}</span>
                <span className={`emp-att-widget__stat-value${highlight ? " emp-att-widget__stat-value--active" : ""}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Clock-in / active day */}
        {!today.check_in ? (
          canClockIn ? (
            <div className="emp-att-widget__start-row">
              <Button
                type="primary"
                size="large"
                icon={<LoginOutlined />}
                loading={checkingIn}
                className="emp-att-widget__start-btn"
                onClick={() => onCheckIn("PRESENT")}
              >
                Start Day
              </Button>
              {wfhStatus.wfh_enabled && (
                <Tooltip title="Clock in as Work From Home">
                  <Button
                    size="large"
                    icon={<HomeOutlined />}
                    loading={checkingIn}
                    className="emp-att-widget__wfh-btn"
                    onClick={() => onCheckIn("WFH")}
                  >
                    WFH
                  </Button>
                </Tooltip>
              )}
            </div>
          ) : (
            <div className="emp-att-widget__waiting">
              <div className="emp-att-widget__waiting-icon">
                <ClockCircleOutlined />
              </div>
              <div className="emp-att-widget__waiting-text">
                <strong>Check-in not open yet</strong>
                <span>{clockInTip || "Your shift window hasn't started. Check back soon."}</span>
              </div>
              <Button type="primary" ghost className="emp-att-widget__calendar-btn" onClick={onViewCalendar}>
                View My Attendance
              </Button>
            </div>
          )
        ) : today.check_out ? (
          <div className="emp-att-widget__done">
            <CheckCircleOutlined />
            <span>Day completed — see you tomorrow!</span>
          </div>
        ) : (
          <div className="emp-att-widget__active-row">
            {!onBreak ? (
              <>
                <Select
                  size="large"
                  placeholder="Start Break"
                  className="emp-att-widget__break-select"
                  loading={breakStarting}
                  onChange={(val: string) => onBreakStart(val)}
                  value={undefined}
                  suffixIcon={<PauseCircleOutlined />}
                >
                  <Select.Option value="TEA">Tea Break</Select.Option>
                  <Select.Option value="LUNCH">Lunch Break</Select.Option>
                  <Select.Option value="OTHER">Other Break</Select.Option>
                </Select>
                <Tooltip title={!canClockOut ? (clockOutTip || "Check-out is not available right now") : ""}>
                  <Button
                    danger
                    size="large"
                    icon={<LogoutOutlined />}
                    loading={checkingOut}
                    disabled={!canClockOut}
                    className="emp-att-widget__end-btn"
                    onClick={() => canClockOut && onCheckOut()}
                  >
                    End Day
                  </Button>
                </Tooltip>
              </>
            ) : (
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                loading={breakEnding}
                block
                className="emp-att-widget__resume-btn"
                onClick={onBreakEnd}
              >
                Resume — {activeBreak?.break_type_label}
              </Button>
            )}
          </div>
        )}

        {/* Quick requests */}
        <div className="emp-att-widget__quick">
          <span className="emp-att-widget__quick-label">Need a change?</span>
          <div className="emp-att-widget__quick-actions">
            {!today.check_in && wfhStatus.approved_wfh_today && (
              <span className="emp-att-widget__pill emp-att-widget__pill--success">
                <CheckCircleOutlined /> WFH approved
              </span>
            )}
            {!today.check_in && wfhStatus.pending_wfh_request && (
              <span className="emp-att-widget__pill emp-att-widget__pill--pending">
                <ClockCircleOutlined /> WFH pending
              </span>
            )}
            {!today.check_in && !wfhStatus.approved_wfh_today && !wfhStatus.pending_wfh_request && (
              <Button size="small" icon={<HomeOutlined />} onClick={onRequestWFH} className="emp-att-widget__chip-btn emp-att-widget__chip-btn--wfh">
                Request WFH
              </Button>
            )}
            <Button size="small" icon={<ScheduleOutlined />} onClick={onRequestShiftChange} className="emp-att-widget__chip-btn emp-att-widget__chip-btn--shift">
              Shift change
            </Button>
          </div>
        </div>

        {breaks.length > 0 && (
          <>
            <Divider style={{ margin: "10px 0" }} />
            <Text style={{ fontSize: 11, color: "var(--bms-text-3)", display: "block", marginBottom: 6 }}>Today&apos;s breaks</Text>
            <div className="emp-att-widget__breaks">
              {breaks.map((b) => (
                <div key={b.id} className="emp-att-widget__break-row" style={{ borderColor: `${BREAK_COLORS[b.break_type] ?? "#6b7280"}33`, background: `${BREAK_COLORS[b.break_type] ?? "#6b7280"}12` }}>
                  <span style={{ color: BREAK_COLORS[b.break_type] ?? "#6b7280" }}>{BREAK_ICONS[b.break_type]}</span>
                  <Text style={{ fontSize: 12 }}>{b.break_type_label}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{b.start_time}{b.end_time ? ` – ${b.end_time}` : " (ongoing)"}</Text>
                  {b.end_time && <Text strong style={{ fontSize: 12, marginLeft: "auto" }}>{b.duration_minutes}m</Text>}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="emp-att-widget__month-block">
        <Divider style={{ margin: "12px 0 10px" }} />
        <div className="emp-att-widget__month-head">
          <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>This month</Text>
          <button type="button" className="emp-att-widget__month-link" onClick={onViewCalendar}>
            Full calendar <RightOutlined />
          </button>
        </div>
        <div className="emp-att-widget__month">
          {[
            { label: "Present", value: month.present, color: "#059669" },
            { label: "WFH", value: month.wfh, color: "#2563eb" },
            { label: "Leave", value: (month.on_leave ?? (month as { leave?: number }).leave ?? 0), color: "#7c3aed" },
          ].map(({ label, value, color }) => (
            <div key={label} className="emp-att-widget__month-stat" style={{ borderColor: `${color}33`, background: `${color}10` }}>
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 10, color: "var(--bms-text-3)", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </Widget>
  );
}

// ── Leave widget ──────────────────────────────────────────────────────────────
function LeaveWidget({
  balances, requests, onApply, onViewLeaves,
}: {
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  onApply: () => void;
  onViewLeaves: () => void;
}) {
  return (
    <Widget
      title="Leave Management"
      icon={<WalletOutlined />}
      iconColor="#7c3aed"
      bgColor="#f5f3ff"
      borderColor="#ddd6fe"
      extra={
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="small" icon={<InfoCircleOutlined />} onClick={onViewLeaves}
            style={{ borderRadius: 20, fontSize: 12, color: "#7c3aed", borderColor: "#ddd6fe", background: "var(--bms-surface-2)" }}
          >
            View Leaves
          </Button>
          <Button
            size="small" type="primary" icon={<PlusOutlined />} onClick={onApply}
            style={{ borderRadius: 20, fontSize: 12, background: "#7c3aed", borderColor: "#7c3aed" }}
          >
            Apply Leave
          </Button>
        </div>
      }
    >
      {balances.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 11, color: "var(--bms-text-3)", display: "block", marginBottom: 8 }}>
            Leave Balance — {new Date().getFullYear()}
          </Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {balances.map((b) => (
              <div key={b.leave_type_code} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.leave_type_color, flexShrink: 0 }} />
                <Text style={{ fontSize: 12, flex: 1 }}>{b.leave_type_name}</Text>
                <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>{b.used_days}/{b.total_days} used</Text>
                <div style={{ width: 60 }}>
                  <Progress
                    percent={b.total_days > 0 ? Math.round((b.used_days / b.total_days) * 100) : 0}
                    strokeColor={b.leave_type_color}
                    showInfo={false}
                    size="small"
                  />
                </div>
                <Text style={{ fontSize: 12, fontWeight: 600, color: b.leave_type_color, minWidth: 32, textAlign: "right" }}>
                  {b.remaining_days}d
                </Text>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Text style={{ fontSize: 12, color: "var(--bms-text-3)", display: "block", marginBottom: 14 }}>
          No leave balance configured. Contact HR.
        </Text>
      )}

      <Divider style={{ margin: "10px 0" }} />
      <Text style={{ fontSize: 11, color: "var(--bms-text-3)", display: "block", marginBottom: 8 }}>Recent Requests</Text>
      {requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <Text style={{ color: "#9ca3af", fontSize: 12 }}>No leave requests</Text>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {requests.map((r) => (
            <div key={r.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 10px", borderRadius: 8,
              background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.leave_type_color ?? "#1677ff", flexShrink: 0 }} />
                <div>
                  <Text style={{ fontSize: 12, fontWeight: 500 }}>{r.leave_type_name ?? r.leave_type}</Text>
                  <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
                    {r.start_date} → {r.end_date}
                    <span style={{ marginLeft: 6 }}>({r.days_count}d)</span>
                  </div>
                </div>
              </div>
              <LeaveStatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}
// ── Payslip widget ────────────────────────────────────────────────────────────
function PayslipWidget({ records, fy }: { records: EmpDashboard["payslips"]; fy: string }) {
  const [amountVisible, setAmountVisible] = useState(false);
  const [downloading,   setDownloading]   = useState<string | null>(null);
  const downloadPayslip = async (id: string, monthName: string, year: number) => {
    setDownloading(id);
    try {
      const res = await fetch(`/bms/api/v1/payroll/my/${id}/payslip-pdf/`, { headers: { Authorization: `Bearer ${localStorage.getItem("kc_access_token") ?? ""}` } });
      if (!res.ok) { message.error("Failed to generate payslip"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `Payslip-${monthName}-${year}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { message.error("Download failed"); }
    finally { setDownloading(null); }
  };
  return (
    <Widget title="My Payslips" icon={<WalletOutlined />} iconColor="#db2777"
      extra={<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 12, color: "var(--bms-text-2)" }}>{fy}</Text>
        <Tooltip title={amountVisible ? "Hide amounts" : "Show amounts"}>
          <Button type="text" size="small" icon={amountVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={() => setAmountVisible((v) => !v)} style={{ color: "#9ca3af", padding: "0 4px" }} />
        </Tooltip>
      </div>}>
      {records.length === 0 ? <Empty description="No payslips available" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {records.map((r) => {
            const ss = PAYSLIP_STYLE[r.status] ?? PAYSLIP_STYLE.DRAFT;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--bms-border)", background: "var(--bms-surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: ss.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FilePdfOutlined style={{ fontSize: 18, color: ss.color }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{r.month_name} {r.year}</div>
                    <div style={{ fontSize: 12, color: "var(--bms-text-2)" }}>Net:{" "}
                      {amountVisible
                        ? <span style={{ fontWeight: 700, color: "#1677ff" }}>₹{r.net_salary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        : <span style={{ fontWeight: 700, color: "var(--bms-text-3)", letterSpacing: 2 }}>••••••</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, color: ss.color, background: ss.bg, border: `1px solid ${ss.color}33` }}>{r.status}</span>
                  <Button size="small" icon={<DownloadOutlined />} loading={downloading === r.id}
                    onClick={() => downloadPayslip(r.id, r.month_name, r.year)} style={{ color: "#7c3aed", borderColor: "#7c3aed" }}>PDF</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// ── Reporting chain ───────────────────────────────────────────────────────────
const RP_COLORS = ["#E53935","#8E24AA","#1E88E5","#00897B","#F4511E","#43A047","#FB8C00","#D81B60"];
function rpColor(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return RP_COLORS[Math.abs(h) % RP_COLORS.length]; }
function rpInit(name: string)  { const p = name.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase(); }

function ReportingChain({ managerName, managerCode, managerDesig, managerAvatar, managerId, selfName, selfCode, selfDesig, selfAvatar, selfId, onNavigate }: {
  managerName: string; managerCode: string; managerDesig: string; managerAvatar: string | null; managerId: string;
  selfName: string; selfCode: string; selfDesig: string; selfAvatar: string | null; selfId: string;
  onNavigate: (id: string) => void;
}) {
  function ChainRow({ name, code, desig, avatar, id, accent, label, isLast }: { name: string; code: string; desig: string; avatar: string | null; id: string; accent: string; label: string; isLast?: boolean }) {
    const col = rpColor(name);
    return (
      <div style={{ display: "flex", gap: 0 }}>
        <div style={{ width: 36, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: accent, border: "2px solid #fff", boxShadow: `0 0 0 2px ${accent}40`, marginTop: 18, flexShrink: 0, zIndex: 1 }} />
          {!isLast && <div style={{ flex: 1, width: 2, background: `linear-gradient(to bottom, ${accent}60, var(--bms-border))`, minHeight: 24 }} />}
        </div>
        <div onClick={() => onNavigate(id)} style={{ flex: 1, marginLeft: 8, marginBottom: isLast ? 0 : 8, borderRadius: 10, overflow: "hidden", border: "1px solid var(--bms-border)", background: "var(--bms-surface)", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "box-shadow 0.15s, transform 0.15s" }}
          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.12)"; el.style.transform = "translateX(2px)"; }}
          onMouseLeave={(e)  => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; el.style.transform = ""; }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}44)` }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
            {avatar ? <img src={avatar} alt={name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${accent}30` }} />
              : <div style={{ width: 34, height: 34, borderRadius: "50%", background: col, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, boxShadow: `0 2px 6px ${col}55` }}>{rpInit(name)}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: accent, textTransform: "uppercase" }}>{label}</span>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--bms-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
              {desig && <div style={{ fontSize: 10, color: "var(--bms-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desig}</div>}
            </div>
            {code && <div style={{ fontSize: 9, color: "var(--bms-text-3)", fontFamily: "monospace", background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)", borderRadius: 5, padding: "2px 6px", flexShrink: 0 }}>{code}</div>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "var(--bms-surface)", backgroundImage: "radial-gradient(circle, var(--bms-border) 1px, transparent 1px)", backgroundSize: "18px 18px", borderRadius: 10, border: "1px solid var(--bms-border)", padding: "12px 12px 12px 6px" }}>
      <ChainRow name={managerName} code={managerCode} desig={managerDesig} avatar={managerAvatar} id={managerId} accent="#7c3aed" label="Reports To" />
      <ChainRow name={selfName}    code={selfCode}    desig={selfDesig}    avatar={selfAvatar}    id={selfId}    accent="#2563eb" label="You" isLast />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EmployeeDashboardPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [leaveModalOpen,        setLeaveModalOpen]        = useState(false);
  const [viewLeavesModalOpen,   setViewLeavesModalOpen]   = useState(false);
  const [wfhModalOpen,          setWfhModalOpen]          = useState(false);
  const [shiftChangeModalOpen,  setShiftChangeModalOpen]  = useState(false);
  const [calendarOpen,          setCalendarOpen]          = useState(false);
  const [followUpDay,           setFollowUpDay]           = useState(() => dayjs());
  // Tracks which leave type to pre-select when opening apply modal from "View Leaves"
  const [prefillLeaveTypeId,    setPrefillLeaveTypeId]    = useState<string | null>(null);
  const [ticketWorkflowModal, setTicketWorkflowModal] = useState<TicketWorkflowState | null>(null);

  const now = useGreetingClock();

  const { data, isLoading, isError } = useQuery<EmpDashboard>({
    queryKey: ["employee-dashboard"],
    queryFn:  () => get<EmpDashboard>("/dashboard/employee/"),
    staleTime: 0,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["employee-dashboard"] });

  const checkInMutation = useMutation({
    mutationFn: async (attendanceStatus: string) => { const geo = await captureGeo(); return post("/attendance/check-in/", { status: attendanceStatus, ...(geo ?? {}) }); },
    onSuccess: () => { message.success("Checked in successfully"); refresh(); },
    onError: (e: any) => message.error(e?.response?.data?.detail || "Check-in failed"),
  });
  const checkOutMutation = useMutation({
    mutationFn: async () => { const geo = await captureGeo(); return post("/attendance/check-out/", geo ?? {}); },
    onSuccess: () => { message.success("Day ended — see you tomorrow!"); refresh(); },
    onError: (e: any) => message.error(e?.response?.data?.detail || "Check-out failed"),
  });
  const startBreakMutation = useMutation({
    mutationFn: (bt: string) => post("/attendance/break/start/", { break_type: bt }),
    onSuccess: () => { message.success("Break started"); refresh(); },
    onError: (e: any) => message.error(e?.response?.data?.detail || "Could not start break"),
  });
  const endBreakMutation = useMutation({
    mutationFn: () => post("/attendance/break/end/", {}),
    onSuccess: () => { message.success("Break ended — welcome back!"); refresh(); },
    onError: (e: any) => message.error(e?.response?.data?.detail || "Could not end break"),
  });
  const permissions = useAuthStore((s) => s.permissions);
  const canFollowUp = permissions.includes(PERMS.CRM_FOLLOWUP_VIEW as never);
  const followUpDoneMutation = useMutation({
    mutationFn: (id: string) => followUpApi.transition(id, "completed"),
    onSuccess: () => {
      message.success("Follow-up marked as done");
      refresh();
      queryClient.invalidateQueries({ queryKey: ["emp-followups-day"] });
    },
    onError: (e: any) => message.error(e?.response?.data?.error || "Could not update follow-up"),
  });

  // Open apply leave modal, optionally pre-selecting a leave type
  const openApplyLeave = (leaveTypeId?: string) => {
    setPrefillLeaveTypeId(leaveTypeId ?? null);
    setLeaveModalOpen(true);
  };

  if (isLoading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}><Spin size="large" /></div>;
  if (isError || !data) return <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}><Empty description="Failed to load your dashboard. Contact admin if this persists." /></div>;

  const { profile, work_items, ticket_workflow, my_projects, timesheet, recent_logs, attendance_today, attendance_month, checkin_stats, leave_balances, leave_requests, payslips, payslips_fy } = data;
  const wfhStatus: WFHStatus = data.wfh_status ?? { wfh_enabled: false, pending_wfh_request: false, approved_wfh_today: false };
  const weekPct = Math.min(100, Math.round((timesheet.weekly_hours / timesheet.expected_hours) * 100));
  const LOG_ROW_HEIGHT = 44;
  const LOG_HEADER_HEIGHT = 40;
  const LOG_VISIBLE_ROWS = 5;
  const logScrollY = LOG_HEADER_HEIGHT + LOG_ROW_HEIGHT * LOG_VISIBLE_ROWS;

  const workflowStates: TicketWorkflowState[] = ticket_workflow?.length
    ? ticket_workflow
    : [
        { slug: "open", name: "Open", color: "#6366f1", count: work_items.open, is_initial: true, is_final: false, tickets: [] },
        { slug: "in_progress", name: "In Progress", color: "#2563eb", count: work_items.in_progress, is_initial: false, is_final: false, tickets: [] },
        { slug: "done", name: "Done", color: "#059669", count: work_items.done, is_initial: false, is_final: true, tickets: [] },
      ];

  const logCols = [
    { title: "Date",      dataIndex: "log_date",    width: 95,  render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: "Work Item", dataIndex: "work_item",   ellipsis: true, render: (v: string, r: any) => <div><Text style={{ fontSize: 13 }}>{v || "—"}</Text>{r.ticket && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>{r.ticket}</span>}{r.project && <div style={{ fontSize: 11, color: "#9ca3af" }}>{r.project}</div>}</div> },
    { title: "Hours",     dataIndex: "hours",        width: 70,  render: (v: number) => <Text strong style={{ fontSize: 13 }}>{v}h</Text> },
    { title: "Billable",  dataIndex: "is_billable",  width: 80,  render: (v: boolean) => <Badge status={v ? "success" : "default"} text={<Text style={{ fontSize: 12 }}>{v ? "Yes" : "No"}</Text>} /> },
  ];

  return (
    <div className="emp-dashboard">
      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Apply Leave — enhanced with emergency + medical cert */}
      <ApplyLeaveModal
        open={leaveModalOpen}
        onClose={() => { setLeaveModalOpen(false); setPrefillLeaveTypeId(null); }}
        onSuccess={() => { setLeaveModalOpen(false); setPrefillLeaveTypeId(null); refresh(); }}
        balances={leave_balances}
        prefillLeaveTypeId={prefillLeaveTypeId}
      />

      {/* View assigned leave balances */}
      <ViewLeavesModal
        open={viewLeavesModalOpen}
        onClose={() => setViewLeavesModalOpen(false)}
        balances={leave_balances}
        requests={leave_requests}
        onApplyLeave={(leaveTypeId) => openApplyLeave(leaveTypeId)}
      />

      <WFHRequestModal  open={wfhModalOpen}         onClose={() => setWfhModalOpen(false)}         onSuccess={() => { setWfhModalOpen(false);         refresh(); }} />
      <ShiftChangeModal open={shiftChangeModalOpen} onClose={() => setShiftChangeModalOpen(false)} onSuccess={() => { setShiftChangeModalOpen(false); refresh(); }} employeeId={profile.id} />
      <TicketWorkflowModal
        state={ticketWorkflowModal}
        open={!!ticketWorkflowModal}
        onClose={() => setTicketWorkflowModal(null)}
        onOpenTicket={(id) => navigate(`/tickets/${id}`)}
      />
      <Modal open={calendarOpen} onCancel={() => setCalendarOpen(false)} footer={null} width={860}
        title={<div style={{ display: "flex", alignItems: "center", gap: 8 }}><ScheduleOutlined style={{ color: "#059669" }} /><span>My Attendance Calendar</span></div>}
        styles={{ body: { padding: "20px 24px 24px" } }} destroyOnHidden>
        <AttendanceCalendar employeeId={profile.id} 
         onApplyLeave={() => { setCalendarOpen(false); openApplyLeave(); }}/>
      </Modal>

      <div className="emp-dashboard__greeting">
        <Title level={4} style={{ margin: 0, color: "var(--bms-text)", fontWeight: 700 }}>
          {getGreeting(now.getHours())} <span style={{ color: "#f97316" }}>{profile.full_name.trim().split(/\s+/)[0]},</span>
        </Title>
        <Text style={{ color: "var(--bms-text-2)", fontSize: 13 }}>{dayjs(now).format("ddd DD MMM, hh:mm A")}</Text>
      </div>

      <Row gutter={[16, 16]} align="top" className="emp-dashboard__layout">
        <Col xs={24} lg={6} className="emp-dashboard__sidebar">
          <Widget title="My Profile" icon={<UserOutlined />} iconColor="#3b82f6" bgColor="#eff6ff" borderColor="#bfdbfe" className="emp-profile-widget">
            <div className="emp-profile">
              {profile.profile_picture_url
                ? <Avatar size={72} src={profile.profile_picture_url} />
                : <Avatar size={72} style={{ background: "#1677ff", fontSize: 24, fontWeight: 700 }}>{avatarInitials(profile.full_name)}</Avatar>}
              <Title level={5} style={{ margin: "4px 0 0", textAlign: "center", color: "var(--bms-text)" }}>{profile.full_name}</Title>
              <Text className="emp-profile__code">{profile.employee_code}</Text>
              {profile.keycloak_group && <Tag color="geekblue" style={{ marginTop: 4, borderRadius: 20, fontSize: 11 }}>{profile.keycloak_group}</Tag>}
            </div>
            <Divider style={{ margin: "10px 0" }} />
            <div className="emp-profile__fields">
              {[
                { label: "Designation", value: profile.designation },
                { label: "Department",  value: profile.department  },
                { label: "Joined",      value: profile.joining_date ?? "—" },
                { label: "Email",       value: profile.email       },
              ].map(({ label, value }) => (
                <div key={label} className="emp-profile__field">
                  <span className="emp-profile__field-label">{label}</span>
                  <span className="emp-profile__field-value">{value || "—"}</span>
                </div>
              ))}
            </div>
            {data?.reporting_hierarchy?.manager && (
              <>
                <div className="emp-profile__section-head">
                  <span>Reporting Line</span>
                </div>
                <ReportingChain
                  managerId={data.reporting_hierarchy.manager.id}
                  managerName={data.reporting_hierarchy.manager.name}
                  managerCode={data.reporting_hierarchy.manager.employee_code}
                  managerDesig={data.reporting_hierarchy.manager.designation}
                  managerAvatar={data.reporting_hierarchy.manager.avatar}
                  selfId={profile.id} selfName={profile.full_name} selfCode={profile.employee_code}
                  selfDesig={profile.designation} selfAvatar={profile.profile_picture_url}
                  onNavigate={(id) => navigate(`/employees/${id}`)}
                />
              </>
            )}
            {canFollowUp && (
              <>
                <Divider style={{ margin: "14px 0 10px" }} />
                <FollowUpDaySchedule
                  selectedDay={followUpDay}
                  onDayChange={setFollowUpDay}
                  onDone={(id) => followUpDoneMutation.mutate(id)}
                  onOpenCalendar={() => navigate("/workspace/calendar")}
                />
              </>
            )}
          </Widget>
          <SocialFeedWidget />
        </Col>

        <Col xs={24} lg={18} className="emp-dashboard__main-col">
          <Row gutter={[16, 16]} align="stretch" className="emp-dashboard__grid">
            <Col xs={24} lg={12} className="emp-dash-col emp-dash-col--equal">
              <AttendanceWidget
                today={attendance_today} month={attendance_month}
                shiftApplicable={profile.shift_applicable} wfhStatus={wfhStatus}
                onCheckIn={(s) => checkInMutation.mutate(s)}
                onCheckOut={() => checkOutMutation.mutate()}
                onBreakStart={(bt) => startBreakMutation.mutate(bt)}
                onBreakEnd={() => endBreakMutation.mutate()}
                checkingIn={checkInMutation.isPending} checkingOut={checkOutMutation.isPending}
                breakStarting={startBreakMutation.isPending} breakEnding={endBreakMutation.isPending}
                onViewCalendar={() => setCalendarOpen(true)}
                onRequestWFH={() => setWfhModalOpen(true)}
                onRequestShiftChange={() => setShiftChangeModalOpen(true)}
              />
            </Col>
            <Col xs={24} lg={12} className="emp-dash-col emp-dash-col--equal emp-dash-col--stack">
              <div className="emp-dash-stack emp-dash-stack--equal">
                <WorkHoursStats stats={checkin_stats ?? { avg_working_hours: 0, avg_break_minutes: 0, total_working_hours: 0, total_break_minutes: 0, working_days_count: 0, on_time: 0, late: 0, early: 0 }} />
                <Widget title="This Week's Hours" icon={<ClockCircleOutlined />} iconColor="#f97316" bgColor="#fff7ed" borderColor="#fed7aa" fill>
                  <div className="emp-hours-widget">
                    <div className="emp-hours-widget__summary">
                      <span className="emp-hours-widget__value" style={{ color: weekPct >= 100 ? "#10b981" : weekPct >= 60 ? "#1677ff" : "#f59e0b" }}>{timesheet.weekly_hours.toFixed(1)}</span>
                      <span className="emp-hours-widget__target">/ {timesheet.expected_hours}h</span>
                    </div>
                    <Progress percent={weekPct} strokeColor={weekPct >= 100 ? "#10b981" : weekPct >= 60 ? "#1677ff" : "#f59e0b"} showInfo={false} size="small" />
                    <Text className="emp-hours-widget__label">Hours by day this month</Text>
                    <MiniHoursPieChart logs={timesheet.daily_logs} />
                  </div>
                </Widget>
              </div>
            </Col>
            <Col span={24}>
              <LeaveWidget
                balances={leave_balances}
                requests={leave_requests}
                onApply={() => openApplyLeave()}
                onViewLeaves={() => setViewLeavesModalOpen(true)}
              />
            </Col>
            <Col xs={24} lg={12} className="emp-dash-col">
              <Widget
                title="My Tickets"
                icon={<AppstoreOutlined />}
                iconColor="#059669"
                bgColor="#f0fdf4"
                borderColor="#bbf7d0"
                fill
                extra={(
                  <Space size={8}>
                    {work_items.overdue > 0 && (
                      <Tag color="error" style={{ borderRadius: 20, margin: 0 }}>{work_items.overdue} overdue</Tag>
                    )}
                    <Button type="link" size="small" onClick={() => navigate("/tickets")} style={{ padding: 0, fontSize: 12 }}>
                      All tickets
                    </Button>
                  </Space>
                )}
              >
                <div className="emp-ticket-stats__meta">
                  <Text type="secondary" className="emp-ticket-stats__hint">
                    Tap a status to view tickets
                  </Text>
                  <Text className="emp-ticket-stats__total">
                    {workflowStates.reduce((sum, s) => sum + s.count, 0)} total
                  </Text>
                </div>
                <div className="emp-ticket-stats">
                  {workflowStates.map((state) => (
                    <WorkflowStatCard
                      key={state.slug}
                      state={state}
                      onClick={() => setTicketWorkflowModal(state)}
                    />
                  ))}
                </div>
              </Widget>
            </Col>
            <Col xs={24} lg={12} className="emp-dash-col">
              <ActiveProjectsWidget projects={my_projects} onOpenProject={() => navigate("/projects")} />
            </Col>
          </Row>
        </Col>

        <Col xs={24} className="emp-dashboard__full-row">
          <Widget
            title="This Week · Time Logs"
            icon={<ClockCircleOutlined />}
            bgColor="#f8fafc"
            borderColor="#e2e8f0"
            iconColor="#64748b"
            extra={
              recent_logs.length > LOG_VISIBLE_ROWS ? (
                <Text type="secondary" style={{ fontSize: 11 }}>{recent_logs.length} entries</Text>
              ) : undefined
            }
          >
            <Table
              dataSource={recent_logs}
              columns={logCols}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: <Empty description="No time logs this week" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              scroll={{ x: 500, y: recent_logs.length > LOG_VISIBLE_ROWS ? logScrollY : undefined }}
            />
          </Widget>
        </Col>
        <Col xs={24} className="emp-dashboard__full-row">
          <PayslipWidget records={payslips ?? []} fy={payslips_fy ?? ""} />
        </Col>
      </Row>
    </div>
  );
}