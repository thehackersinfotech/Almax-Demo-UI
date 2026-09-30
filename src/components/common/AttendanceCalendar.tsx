import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tooltip, Spin, Typography, Space, Modal, Button, Form,
  Input, Select, message,
} from "antd";
import {
  LeftOutlined, RightOutlined, HomeOutlined, ScheduleOutlined, UnlockOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { get, post } from "@/services/api";
import "./AttendanceCalendar.css";

const { Text } = Typography;

// ── Types ──────────────────────────────────────────────────────────────────────
interface LeaveInfo {
  id: string; type: string; color: string; status: string;
  days_count: number; reason: string;
}
interface CalendarDay {
  date: string; day: number; weekday: number;
  is_weekend: boolean; is_today: boolean; is_future: boolean;
  display_status: string; att_status: string | null;
  check_in: string | null; check_out: string | null;
  working_hours: number; notes: string;
  leave: LeaveInfo | null;
  // FIX 2: new field from backend
  clockin_enabled?: boolean;
  holiday_type?: "GOVERNMENT" | "COMPANY" | null; 
}
interface CalendarData {
  year: number; month: number;
  employee_id: string; employee_name: string;
  effective_days: number;
  summary: Record<string, number>;
  days: CalendarDay[];
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, {
  icon: React.ReactNode;
  bg: string; border: string;
  tooltip: string; dotColor: string;
}> = {
  PRESENT:         { icon: <PersonCheckIcon color="var(--bms-success)" />, bg: "rgba(22, 163, 74, 0.12)", border: "rgba(22, 163, 74, 0.25)", tooltip: "Present",               dotColor: "var(--bms-success)" },
  WFH:             { icon: <PersonHomeIcon  color="var(--bms-primary)" />, bg: "rgba(37, 99, 235, 0.12)", border: "rgba(37, 99, 235, 0.25)", tooltip: "Work From Home",        dotColor: "var(--bms-primary)" },
  HALF_DAY:        { icon: <PersonHalfIcon  color="var(--bms-warning)" />, bg: "rgba(217, 119, 6, 0.12)", border: "rgba(217, 119, 6, 0.25)", tooltip: "Half Day",              dotColor: "var(--bms-warning)" },
  ON_LEAVE:        { icon: <PersonXIcon     color="#7c3aed" />, bg: "rgba(124, 58, 237, 0.12)", border: "rgba(124, 58, 237, 0.25)", tooltip: "On Leave",              dotColor: "#7c3aed" },
  PENDING_LEAVE:   { icon: <PersonXIcon     color="#ea580c" />, bg: "rgba(234, 88, 12, 0.12)", border: "rgba(234, 88, 12, 0.25)", tooltip: "Leave Pending Approval", dotColor: "#ea580c" },
  ABSENT:          { icon: <PersonXIcon     color="var(--bms-danger)" />, bg: "var(--bms-danger-bg)", border: "rgba(197, 34, 31, 0.25)", tooltip: "Absent",                dotColor: "var(--bms-danger)" },
  HOLIDAY:         { icon: <HolidayIcon     color="#0d9488" />, bg: "rgba(13, 148, 136, 0.12)", border: "rgba(13, 148, 136, 0.25)", tooltip: "Holiday",               dotColor: "#0d9488" },
  GOVT_HOLIDAY:    { icon: <HolidayIcon     color="#0d9488" />, bg: "rgba(13, 148, 136, 0.12)", border: "rgba(13, 148, 136, 0.25)", tooltip: "Govt Holiday",     dotColor: "#0d9488" },
  COMPANY_HOLIDAY: { icon: <HolidayIcon     color="#c026d3" />, bg: "rgba(192, 38, 211, 0.12)", border: "rgba(192, 38, 211, 0.25)", tooltip: "Company Holiday",  dotColor: "#c026d3" },
  CLOCKIN_ENABLED: { icon: <UnlockOutlined style={{ color: "#7c3aed", fontSize: 16 }} />, bg: "rgba(124, 58, 237, 0.10)", border: "rgba(124, 58, 237, 0.25)", tooltip: "Clock-in Enabled by HR", dotColor: "#7c3aed" },
  WEEKEND:         { icon: <WeekendIcon />,                     bg: "var(--bms-surface-2)", border: "var(--bms-border)", tooltip: "Weekend",               dotColor: "var(--bms-text-3)" },
  NOT_MARKED:      { icon: null,                                bg: "var(--bms-surface)",    border: "var(--bms-border)", tooltip: "Not Marked",            dotColor: "var(--bms-text-3)" },
  FUTURE:          { icon: null,                                bg: "var(--bms-surface)",    border: "var(--bms-border)", tooltip: "",                      dotColor: "var(--bms-border)" },
};

// ── SVG Icons ──────────────────────────────────────────────────────────────────
function PersonCheckIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="10" cy="7" r="4" fill={color} opacity="0.9" />
      <path d="M2 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M17 13l2 2 4-4" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PersonXIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="10" cy="7" r="4" fill={color} opacity="0.9" />
      <path d="M2 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M17 13l4 4m0-4l-4 4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function PersonHomeIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="10" cy="7" r="4" fill={color} opacity="0.9" />
      <path d="M2 21c0-4.4 3.6-8 8-8" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M17 13l-3.5 3.5V21h7v-4.5L17 13z" fill={color} opacity="0.85" />
      <path d="M14 13l3-3 3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PersonHalfIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M10 3a4 4 0 010 8V3z" fill={color} />
      <path d="M10 3a4 4 0 000 8" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M10 13c-4.4 0-8 3.6-8 8h8V13z" fill={color} />
      <path d="M10 13c4.4 0 8 3.6 8 8" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function HolidayIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L8 8H3l4 3.5-1.5 5.5L12 14l6.5 3-1.5-5.5L21 8h-5L12 2z" fill={color} opacity="0.9" />
      <rect x="10.5" y="19" width="3" height="3" rx="0.5" fill={color} opacity="0.7" />
    </svg>
  );
}
function WeekendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="#9ca3af" strokeWidth="1.8" fill="#f3f4f6" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="#9ca3af" strokeWidth="1.5" />
      <line x1="8" y1="2" x2="8" y2="6" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Legend labels excluded from the filter bar (statuses may still appear on calendar cells)
const SUMMARY_HIDDEN = new Set(["half_day", "absent", "clockin_enabled"]);

// ── Legend ─────────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { label: "Present",          bg: "rgba(22, 163, 74, 0.12)", border: "rgba(22, 163, 74, 0.25)", dot: "var(--bms-success)" },
    { label: "WFH",              bg: "rgba(37, 99, 235, 0.12)", border: "rgba(37, 99, 235, 0.25)", dot: "var(--bms-primary)" },
    { label: "On Leave",         bg: "rgba(124, 58, 237, 0.12)", border: "rgba(124, 58, 237, 0.25)", dot: "#7c3aed" },
    { label: "Half Day Leave",   bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.25)", dot: "#f59e0b" },
    { label: "Leave Pending",    bg: "rgba(234, 88, 12, 0.12)", border: "rgba(234, 88, 12, 0.25)", dot: "#ea580c" },
    { label: "Govt Holiday",     bg: "rgba(13, 148, 136, 0.12)", border: "rgba(13, 148, 136, 0.25)", dot: "#0d9488" },
    { label: "Company Holiday",  bg: "rgba(192, 38, 211, 0.12)", border: "rgba(192, 38, 211, 0.25)", dot: "#c026d3" },
    { label: "Weekend",          bg: "var(--bms-surface-2)", border: "var(--bms-border)", dot: "var(--bms-text-3)" },
  ];
  return (
    <div className="att-cal-legend">
      {items.map((item) => (
        <div key={item.label} className="att-cal-legend__item" style={{
          background: item.bg, border: `1px solid ${item.border}`,
        }}>
          <span className="att-cal-legend__swatch" style={{
            background: item.bg, border: `1.5px solid ${item.dot}`,
          }} />
          <span className="att-cal-legend__dot" style={{ background: item.dot }} />
          <span className="att-cal-legend__label" style={{ color: item.dot }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Future Date Action Modal ───────────────────────────────────────────────────
function FutureDateModal({
  open, date, onClose, employeeId, onSuccess,onApplyLeave,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  employeeId: string;
  onSuccess: () => void;
   onApplyLeave?: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "wfh" | "shift">("menu");
  const [wfhForm]   = Form.useForm();
  const [shiftForm] = Form.useForm();

  const { data: shifts } = useQuery<Array<{ id: string; name: string; start_time: string; end_time: string }>>({
    queryKey: ["shifts-list"],
     queryFn:  () => get("/master/dropdown/shift-categories/")
                      .then((d: any) => d.results ?? d),
    // FIX 1: load shifts whenever modal is open in shift mode (not gated)
    enabled: open && mode === "shift",
    staleTime: 120_000,
  });

  const wfhMutation = useMutation({
    mutationFn: (payload: any) => post("/attendance/wfh-requests/", payload),
    onSuccess: () => {
      message.success("WFH request submitted — your Reporting Manager will review it");
      wfhForm.resetFields();
      onClose();
      onSuccess();
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail
        || Object.entries(e?.response?.data ?? {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(", ")
        || "Failed to submit WFH request";
      message.error(detail);
    },
  });

  const shiftMutation = useMutation({
    mutationFn: (payload: any) => post("/attendance/shift-change-requests/", payload),
    onSuccess: () => {
      message.success("Shift change request submitted — your Reporting Manager will review it");
      shiftForm.resetFields();
      onClose();
      onSuccess();
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail
        || Object.entries(e?.response?.data ?? {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(", ")
        || "Failed to submit shift change request";
      message.error(detail);
    },
  });

  const handleClose = () => {
    setMode("menu");
    wfhForm.resetFields();
    shiftForm.resetFields();
    onClose();
  };

  const formattedDate = dayjs(date).format("DD MMM YYYY (ddd)");

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={420}
      destroyOnHidden
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {mode !== "menu" && (
            <Button
              type="text" size="small"
              onClick={() => { setMode("menu"); wfhForm.resetFields(); shiftForm.resetFields(); }}
              style={{ color: "var(--bms-text-3)", padding: "0 4px", marginRight: 4 }}
            >
              ←
            </Button>
          )}
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--bms-text)" }}>
            {mode === "menu"  && `Requests for ${formattedDate}`}
            {mode === "wfh"   && `WFH Request — ${formattedDate}`}
            {mode === "shift" && `Shift Change — ${formattedDate}`}
          </span>
        </div>
      }
    >
      {/* ── Menu ── */}
      {mode === "menu" && (
        <div style={{ padding: "8px 0" }}>
          <Text style={{ fontSize: 13, color: "var(--bms-text-2)", display: "block", marginBottom: 16 }}>
            What would you like to request for this date?
          </Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* WFH option */}
            <div
              onClick={() => setMode("wfh")}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                border: "1px solid var(--bms-border)", background: "var(--bms-surface-2)",
                transition: "box-shadow 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(37,99,235,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = ""; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(37, 99, 235, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <HomeOutlined style={{ fontSize: 20, color: "var(--bms-primary)" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--bms-text)" }}>Request WFH</div>
                <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>Work from home — Reporting Manager approval required</div>
              </div>
            </div>

            {/* Shift change option */}
            <div
              onClick={() => setMode("shift")}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                border: "1px solid var(--bms-border)", background: "var(--bms-surface-2)",
                transition: "box-shadow 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(124,58,237,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = ""; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(124, 58, 237, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ScheduleOutlined style={{ fontSize: 20, color: "#7c3aed" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--bms-text)" }}>Request Shift Change</div>
                <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>Temporary or permanent shift change</div>
              </div>
            </div>
            {/* Leave option */}
            <div
              onClick={() => { handleClose(); onApplyLeave?.(); }}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                border: "1px solid var(--bms-border)", background: "var(--bms-surface-2)",
                transition: "box-shadow 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(5,150,105,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = ""; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(5, 150, 105, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <WalletOutlined style={{ fontSize: 20, color: "var(--bms-success)" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--bms-text)" }}>Apply for Leave</div>
                <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>Submit a leave request — Reporting Manager approval required</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WFH Form ── */}
      {mode === "wfh" && (
        <Form
          form={wfhForm}
          layout="vertical"
          style={{ marginTop: 8 }}
          onFinish={(v) => wfhMutation.mutate({
            requested_date: date,
            date:           date,
            reason:         v.reason || "",
          })}
        >
          <div style={{
            background: "rgba(37, 99, 235, 0.12)", border: "1px solid rgba(37, 99, 235, 0.25)",
            borderRadius: 8, padding: "8px 12px", marginBottom: 14,
            fontSize: 12, color: "var(--bms-text)",
          }}>
            <HomeOutlined style={{ marginRight: 6 }} />
            Requesting WFH for <strong>{formattedDate}</strong>
          </div>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: "Please provide a reason" }]}>
            <Input.TextArea rows={3} placeholder="Why do you need to work from home?" />
          </Form.Item>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={wfhMutation.isPending}
              style={{ background: "var(--bms-primary)", borderColor: "var(--bms-primary)" }}>
              Submit WFH Request
            </Button>
          </div>
        </Form>
      )}

      {/* ── Shift Change Form ── */}
      {mode === "shift" && (
        <Form
          form={shiftForm}
          layout="vertical"
          style={{ marginTop: 8 }}
          initialValues={{ request_type: "TEMPORARY" }}
          onFinish={(v) => shiftMutation.mutate({
            request_type:    v.request_type,
            requested_date:  v.request_type === "TEMPORARY" ? date : null,
            requested_shift: v.requested_shift,
            reason:          v.reason || "",
          })}
        >
          <div style={{
            background: "rgba(124, 58, 237, 0.12)", border: "1px solid rgba(124, 58, 237, 0.25)",
            borderRadius: 8, padding: "8px 12px", marginBottom: 14,
            fontSize: 12, color: "var(--bms-text)",
          }}>
            <ScheduleOutlined style={{ marginRight: 6 }} />
            Requesting shift change for <strong>{formattedDate}</strong>
          </div>

          <Form.Item name="request_type" label="Change Type" rules={[{ required: true }]}>
            <Select options={[
              { value: "TEMPORARY", label: "Temporary — for this date only" },
              { value: "PERMANENT", label: "Permanent — update my default shift" },
            ]} />
          </Form.Item>

          <Form.Item name="requested_shift" label="Requested Shift" rules={[{ required: true, message: "Please select a shift" }]}>
            <Select
              showSearch
              placeholder="Select shift"
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              options={(shifts ?? []).map((s) => ({
                value: s.id,
                label: `${s.name} (${s.start_time?.slice(0, 5)} – ${s.end_time?.slice(0, 5)})`,
              }))}
              notFoundContent={<span style={{ fontSize: 12, color: "var(--bms-text-3)" }}>Loading shifts…</span>}
            />
          </Form.Item>

          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: "Please provide a reason" }]}>
            <Input.TextArea rows={3} placeholder="Why do you need this shift change?" />
          </Form.Item>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={shiftMutation.isPending}
              style={{ background: "#7c3aed", borderColor: "#7c3aed" }}>
              Submit Shift Change
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}

// ── Day Cell ──────────────────────────────────────────────────────────────────
function DayCell({
  day, onFutureClick, allowFutureRequests = true,
}: {
  day: CalendarDay;
  onFutureClick: (date: string) => void;
  allowFutureRequests?: boolean;
}) {
  // FIX 2: If this is a future date with HR clock-in enabled, use CLOCKIN_ENABLED status
  const effectiveStatus =
  (day.is_future && day.clockin_enabled)
    ? "CLOCKIN_ENABLED"
    : day.display_status === "HOLIDAY" && day.holiday_type === "GOVERNMENT"
    ? "GOVT_HOLIDAY"
    : day.display_status === "HOLIDAY" && day.holiday_type === "COMPANY"
    ? "COMPANY_HOLIDAY"
    : day.display_status;

  const cfg      = STATUS_CFG[effectiveStatus] ?? STATUS_CFG.NOT_MARKED;
  const isToday  = day.is_today;
  const isFuture = day.is_future;
  const isClickable = allowFutureRequests && isFuture && !day.is_weekend;

  const tooltipContent = day.display_status === "FUTURE" && !day.clockin_enabled ? undefined : (
    <div style={{ fontSize: 12, lineHeight: 1.6, minWidth: 140 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{dayjs(day.date).format("DD MMM YYYY (ddd)")}</div>
      {/* FIX 2: Show HR enabled badge in tooltip */}
      {day.clockin_enabled && isFuture && (
        <div style={{ color: "#7c3aed", fontWeight: 600, marginBottom: 2 }}>
          🔓 Clock-in enabled by HR
        </div>
      )}
      <div style={{ color: cfg.dotColor, fontWeight: 500 }}>{cfg.tooltip}</div>
      {day.check_in && (
        <div>In: <b>{day.check_in}</b>{day.check_out ? ` · Out: ${day.check_out}` : ""}</div>
      )}
      {day.working_hours > 0 && <div>Hours: <b>{day.working_hours}h</b></div>}
      {day.leave && (
        <div style={{ marginTop: 2 }}>
          Leave: <b>{day.leave.type}</b>
          {day.leave.reason && <div style={{ color: "#9ca3af" }}>{day.leave.reason}</div>}
        </div>
      )}
      {day.notes && <div style={{ color: "#9ca3af" }}>{day.notes}</div>}
    </div>
  );

  const cell = (
    <div
      onClick={() => isClickable && onFutureClick(day.date)}
      style={{
        minHeight: 64,
        border: `1px solid ${
          isToday ? "var(--bms-primary)"
          : (day.clockin_enabled && isFuture) ? "rgba(124, 58, 237, 0.4)"
          : isClickable ? "rgba(99, 102, 241, 0.4)"
          : cfg.border
        }`,
        borderRadius: 6,
        background: isToday ? "rgba(26, 115, 232, 0.15)"
          : (day.clockin_enabled && isFuture) ? "rgba(124, 58, 237, 0.12)"
          : isClickable ? "rgba(99, 102, 241, 0.08)"
          : cfg.bg,
        position: "relative",
        padding: "4px 5px",
        cursor: isClickable ? "pointer" : "default",
        transition: "box-shadow 0.15s, transform 0.12s",
        boxShadow: isToday ? "0 0 0 2px rgba(26, 115, 232, 0.25)"
          : (day.clockin_enabled && isFuture) ? "0 0 0 2px rgba(124, 58, 237, 0.25)"
          : "none",
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          (e.currentTarget as HTMLElement).style.boxShadow = (day.clockin_enabled && isFuture)
            ? "0 2px 8px rgba(124,58,237,0.2)"
            : "0 2px 8px rgba(99,102,241,0.18)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = isToday ? "0 0 0 2px rgba(26, 115, 232, 0.25)"
          : (day.clockin_enabled && isFuture) ? "0 0 0 2px rgba(124, 58, 237, 0.25)"
          : "none";
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
    >
      {/* Working-day corner triangle */}
      {!day.is_weekend && !isFuture && (
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: 0, height: 0, borderStyle: "solid",
          borderWidth: "8px 8px 0 0",
          borderColor: `${cfg.dotColor} transparent transparent transparent`,
          borderTopLeftRadius: 5,
        }} />
      )}

      {/* FIX 2: HR-enabled lock icon for future dates */}
      {isFuture && day.clockin_enabled && (
        <div style={{
          position: "absolute", top: 2, right: 3,
          fontSize: 9, color: "#7c3aed", fontWeight: 700,
        }}>
          🔓
        </div>
      )}

      {/* Future date "+" hint (only if not clockin_enabled) */}
      {isFuture && !day.is_weekend && !day.clockin_enabled && (
        <div style={{
          position: "absolute", top: 2, right: 3,
          fontSize: 9, color: "#6366f1", fontWeight: 700, opacity: 0.6,
        }}>
          +
        </div>
      )}

      {/* Day number */}
      <div style={{
        fontSize: 11, fontWeight: isToday ? 700 : 500,
        color: isToday ? "var(--bms-primary)"
          : (day.clockin_enabled && isFuture) ? "#a78bfa"
          : isFuture ? "#818cf8"
          : "var(--bms-text)",
        textAlign: "right", lineHeight: 1, marginBottom: 4,
      }}>
        {day.day}
      </div>

      {/* Status icon */}
      {cfg.icon && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 2 }}>
          {cfg.icon}
        </div>
      )}

      {/* Check-in time */}
      {day.check_in && !day.is_weekend && (
        <div style={{ fontSize: 9, color: "var(--bms-text-3)", textAlign: "center", marginTop: 2, lineHeight: 1.2 }}>
          {day.check_in}
        </div>
      )}
    </div>
  );

  return tooltipContent ? (
    <Tooltip title={tooltipContent} placement="top" mouseEnterDelay={0.2}>{cell}</Tooltip>
  ) : cell;
}

// ── Summary Bar ───────────────────────────────────────────────────────────────
function SummaryBar({ summary }: { summary: Record<string, number> }) {
  const items = [
    { key: "present",       label: "Present",          color: "#059669" },
    { key: "wfh",           label: "WFH",              color: "#2563eb" },
    { key: "on_leave",      label: "On Leave",         color: "#7c3aed" },
    { key: "pending_leave", label: "Pending",          color: "#ea580c" },
    { key: "holiday",       label: "Holiday",          color: "#0d9488" },
  ].filter((i) => summary[i.key] > 0 && !SUMMARY_HIDDEN.has(i.key));

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {items.map((item) => (
        <div key={item.key} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 20,
          background: item.color, border: `1px solid ${item.color}`,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffffff" }} />
          <Text style={{ fontSize: 12, fontWeight: 600, color: "#ffffff" }}>{summary[item.key]}</Text>
          <Text style={{ fontSize: 12, color: "#ffffff" }}>{item.label}</Text>
        </div>
      ))}
    </div>
  );
}

// ── Main Calendar Component ────────────────────────────────────────────────────
export default function AttendanceCalendar({
  employeeId,
  onApplyLeave,
  initialMonth,
  allowFutureRequests = true,
}: {
  employeeId: string;
  onApplyLeave?: () => void;
  initialMonth?: dayjs.Dayjs;
  /** When false (e.g. team view), future-date WFH/shift requests are disabled. */
  allowFutureRequests?: boolean;
}) {
  const today   = dayjs();
  const qc      = useQueryClient();
  const [current, setCurrent]             = useState(initialMonth ?? today);
  const [futureDateModal, setFutureDateModal] = useState<string | null>(null);

  useEffect(() => {
    if (initialMonth) setCurrent(initialMonth);
  }, [initialMonth?.format("YYYY-MM"), employeeId]);

  const year  = current.year();
  const month = current.month() + 1;

  const { data, isLoading } = useQuery<CalendarData>({
    queryKey: ["emp-calendar", employeeId, year, month],
    queryFn:  () => get(`/attendance/employee-calendar/?employee=${employeeId}&year=${year}&month=${month}`),
    staleTime: 0,
  });

  const firstDay    = dayjs(new Date(year, month - 1, 1));
  const startOffset = (firstDay.day() + 7) % 7;
  const gridCells: (CalendarDay | null)[] = [
    ...Array(startOffset).fill(null),
    ...(data?.days ?? []),
  ];
  while (gridCells.length % 7 !== 0) gridCells.push(null);

  const WEEK_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const hasFutureDates = (data?.days ?? []).some((d) => d.is_future && !d.is_weekend);
  // FIX 2: count HR-enabled dates for the hint
  const hasClockInEnabled = (data?.days ?? []).some((d) => d.is_future && d.clockin_enabled);

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 14, color: "var(--bms-text)" }}>
            Effective days worked:{" "}
            <Text strong style={{ fontSize: 15, color: "var(--bms-primary)" }}>
              {data?.effective_days ?? "—"}
            </Text>
          </Text>
        </div>
        <Space>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "var(--bms-surface-2)", borderRadius: 8, padding: "4px 12px",
            border: "1px solid var(--bms-border)",
          }}>
            <LeftOutlined
              style={{ fontSize: 12, cursor: "pointer", color: "var(--bms-text)" }}
              onClick={() => setCurrent((c) => c.subtract(1, "month"))}
            />
            <Text strong style={{ fontSize: 14, color: "var(--bms-text)", minWidth: 100, textAlign: "center" }}>
              {current.format("MMMM YYYY")}
            </Text>
            <RightOutlined
              style={{ fontSize: 12, cursor: "pointer", color: "var(--bms-text)" }}
              onClick={() => setCurrent((c) => c.add(1, "month"))}
            />
          </div>
          <div
            style={{ fontSize: 12, color: "var(--bms-primary)", cursor: "pointer", padding: "4px 8px", borderRadius: 6, border: "1px solid var(--bms-border)", background: "var(--bms-surface-2)" }}
            onClick={() => setCurrent(today)}
          >
            Today
          </div>
        </Space>
      </div>

      {/* FIX 2: HR clock-in enabled hint */}
      {allowFutureRequests && hasClockInEnabled && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginBottom: 8, padding: "6px 12px", borderRadius: 8,
          background: "rgba(124, 58, 237, 0.10)", border: "1px solid rgba(124, 58, 237, 0.25)", fontSize: 12, color: "var(--bms-text)",
        }}>
          🔓 <strong style={{ marginLeft: 2 }}>HR has enabled clock-in</strong> for one or more dates this month. Those dates are highlighted in purple — click them to request WFH or a shift change too.
        </div>
      )}

      {/* Future dates hint */}
      {allowFutureRequests && hasFutureDates && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginBottom: 10, padding: "6px 12px", borderRadius: 8,
          background: "rgba(99, 102, 241, 0.10)", border: "1px solid rgba(99, 102, 241, 0.25)", fontSize: 12, color: "var(--bms-text)",
        }}>
          <span style={{ fontWeight: 700 }}>Tip:</span>
          Click on any future date (marked with <span style={{ fontWeight: 700, marginLeft: 2, marginRight: 2 }}>+</span>) to request WFH or a shift change for that day.
        </div>
      )}

      {/* Summary pills */}
      {data && <SummaryBar summary={data.summary} />}

      {/* Legend */}
      <Legend />

      {/* Calendar grid */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
      ) : (
        <div style={{ border: "1px solid var(--bms-border)", borderRadius: 10, overflow: "hidden", background: "var(--bms-surface)" }}>
          {/* Week header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--bms-surface-2)", borderBottom: "1px solid var(--bms-border)" }}>
            {WEEK_HEADERS.map((h) => (
              <div key={h} style={{
                textAlign: "center", padding: "8px 4px",
                fontSize: 12, fontWeight: 600,
                color: (h === "Sun" || h === "Sat") ? "var(--bms-text-3)" : "var(--bms-text-2)",
                borderRight: "1px solid var(--bms-border)",
              }}>
                {h}
              </div>
            ))}
          </div>

          {/* Calendar rows */}
          {Array.from({ length: gridCells.length / 7 }, (_, rowIdx) => (
            <div key={rowIdx} style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: rowIdx < gridCells.length / 7 - 1 ? "1px solid var(--bms-border)" : "none",
            }}>
              {gridCells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => (
                <div key={colIdx} style={{ padding: 4, borderRight: colIdx < 6 ? "1px solid var(--bms-border)" : "none", minHeight: 72 }}>
                  {day ? (
                    <DayCell
                      day={day}
                      onFutureClick={allowFutureRequests ? (date) => setFutureDateModal(date) : () => {}}
                      allowFutureRequests={allowFutureRequests}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Future Date Request Modal */}
      {futureDateModal && allowFutureRequests && (
        <FutureDateModal
          open={!!futureDateModal}
          date={futureDateModal}
          employeeId={employeeId}
          onClose={() => setFutureDateModal(null)}
          onApplyLeave={onApplyLeave}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["emp-calendar", employeeId, year, month] });
          }}
        />
      )}
    </div>
  );
}