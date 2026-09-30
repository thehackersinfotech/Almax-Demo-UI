import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Card, Button, Space, Typography, Tag,
  Popconfirm, message, Tooltip, Alert, Badge, Select,
} from "antd";
import {
  PlusOutlined, LeftOutlined, RightOutlined, SendOutlined,
  CopyOutlined, EditOutlined, DeleteOutlined,
  LoginOutlined, LogoutOutlined, ClockCircleOutlined,
  MedicineBoxOutlined, DownloadOutlined, QuestionCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import PermGuard from "@/components/common/PermGuard";
import WorkLogModal from "@/components/timesheets/WorkLogModal";
import { PERMS } from "@/constants/permissions";
import {
  timesheetApi, STATUS_COLOR,
  type WorkLog, type WorkLogCreate,
} from "@/services/timesheets";
import { employeeApi } from "@/services/employees";
import { apiErrorMsg } from "@/utils/apiError";
import { ENDPOINTS, API_BASE } from "@/constants/api";
import client from "@/services/api";
import { sundayOf } from "@/utils/weekDates";
import { useAuthStore } from "@/store/auth";
import "./MyTimesheetPage.css";

// Local label map for weekly timesheet statuses
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  REJECTED: "Rejected",
  APPROVED: "Approved",
};

const { Title, Text } = Typography;

// ── Types ─────────────────────────────────────────────────────────────────────
interface DiscrepancyFlag {
  date: string;
  message: string;
}

interface DayInfo {
  date: string;
  day_name: string;
  total_hours: number;
  capacity: number;
  over_capacity: boolean;
  log_count: number;
  can_log: boolean;
  attendance_hint: string | null;
  is_weekend: boolean;
  check_in: string | null;
  check_out: string | null;
  working_hours: number;
  attendance_status: string | null;
  is_holiday: boolean;
  holiday_name: string | null;
  holiday_type: string | null;
  is_on_leave: boolean;
  leave_duration?: string | null;
  half_day_period?: string | null;
  leave_fraction?: number;
  is_half_day_leave?: boolean;
  leave_type_name: string | null;
  leave_type_code: string | null;
  leave_is_paid: boolean | null;
  leave_reason: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMismatch(day: DayInfo): string | null {
  if (day.is_holiday || (day.is_on_leave && !day.is_half_day_leave) || day.is_weekend) return null;
  if (!day.check_in || !day.check_out) return null;
  if (day.working_hours > 0 && day.total_hours === 0 && day.log_count === 0) {
    return `Attended ${day.working_hours}h but no time logged`;
  }
  if (day.working_hours > 0 && day.total_hours > day.working_hours + 0.5) {
    return `Logged ${day.total_hours}h exceeds attendance ${day.working_hours}h`;
  }
  return null;
}

function hoursStyle(day: DayInfo): React.CSSProperties {
  if (day.is_holiday || (day.is_on_leave && !day.is_half_day_leave) || day.is_weekend) return {};
  const cap = (day.is_half_day_leave || day.attendance_status === "HALF_DAY") ? (day.capacity > 0 ? day.capacity : 4) : day.capacity;
  if (cap === 0) return {};
  if (day.total_hours > cap) return { color: "#f97316" }; // overtime — orange
  if (day.total_hours > 0 && day.total_hours < cap) return { color: "#eab308" }; // undertime — amber
  if (day.total_hours >= cap) return { color: "#10b981" }; // exactly met — green
  return {};
}

function overtimeLabel(day: DayInfo): string | null {
  if (day.is_holiday || (day.is_on_leave && !day.is_half_day_leave) || day.is_weekend) return null;
  const cap = (day.is_half_day_leave || day.attendance_status === "HALF_DAY") ? (day.capacity > 0 ? day.capacity : 4) : day.capacity;
  if (cap === 0) return null;
  if (day.total_hours > cap) return `+${(day.total_hours - cap).toFixed(2)}h OT`;
  if (day.total_hours > 0 && day.total_hours < cap)
    return `-${(cap - day.total_hours).toFixed(2)}h`;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MyTimesheetPage({ embedded = false }: { embedded?: boolean }) {
  const currentUser = useAuthStore((s) => s.user);
//   const isAdmin = useAuthStore((s) =>
//   s.user?.is_staff === true ||
//   s.user?.is_pmo === true ||
//   (s.permissions ?? []).includes("bms.project.report.utilization"),
// );
const isAdmin = useAuthStore((s) =>
  s.user?.is_staff === true ||
  s.user?.is_pmo === true ||
  s.user?.is_superuser === true
);

  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => sundayOf().format("YYYY-MM-DD"));
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<WorkLog | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  // Admin employee selector
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>();
  const viewingOther = isAdmin && !!selectedEmployee && selectedEmployee !== currentUser?.id;

  // Employees dropdown (only fetched for admins)
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-simple-dropdown-ts"],
    queryFn: () => employeeApi.simpleDropdown(),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  // Main week data — uses admin endpoint when viewing someone else
  const { data: weekData, isLoading } = useQuery({
    queryKey: ["timesheet-week", weekStart, selectedEmployee ?? currentUser?.id],
    queryFn: () =>
      viewingOther && selectedEmployee
        ? (timesheetApi as any).adminWeek
          ? (timesheetApi as any).adminWeek(selectedEmployee, weekStart)
          : timesheetApi.week(weekStart, selectedEmployee)
        : timesheetApi.week(weekStart),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["timesheet-week"] });
  };

  const saveMut = useMutation({
    mutationFn: async (values: WorkLogCreate) => {
      if (editing) return timesheetApi.updateLog(editing.id, values);
      return timesheetApi.createLog(values);
    },
    onSuccess: (res) => {
      if (res.warnings && Object.keys(res.warnings).length) {
        message.warning(Object.values(res.warnings).join(" "));
      } else {
        message.success(editing ? "Work log updated" : "Time logged");
      }
      setModalOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(apiErrorMsg(e, "Failed to save work log")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => timesheetApi.deleteLog(id),
    onSuccess: () => { message.success("Deleted"); invalidate(); },
    onError: (e) => message.error(apiErrorMsg(e, "Delete failed")),
  });

  const submitMut = useMutation({
    mutationFn: (payload: { id: string; weekStart: string }) =>
      timesheetApi.submit(payload.id, payload.weekStart),
    onSuccess: () => { message.success("Timesheet submitted"); invalidate(); },
    onError: (e) => message.error(apiErrorMsg(e, "Submit failed")),
  });

  const copyDayMut = useMutation({
    mutationFn: ({ src, tgt }: { src: string; tgt: string }) =>
      timesheetApi.copyDay(src, tgt),
    onSuccess: (r) => { message.success(`Copied ${r.copied} entries`); invalidate(); },
    onError: (e) => message.error(apiErrorMsg(e, "Copy failed")),
  });

  const copyWeekMut = useMutation({
    mutationFn: () =>
      timesheetApi.copyWeek(
        sundayOf(dayjs(weekStart).subtract(1, "week")).format("YYYY-MM-DD"),
        weekStart,
      ),
    onSuccess: (r) => { message.success(`Copied ${r.copied} entries from last week`); invalidate(); },
    onError: (e) => message.error(apiErrorMsg(e, "Copy failed")),
  });

  // ── Derived state ──────────────────────────────────────────────────────────
  const weekly = weekData?.weekly_timesheet
    ? { ...weekData.weekly_timesheet, hours_behind: weekData.weekly_timesheet.hours_behind ?? 0 }
    : undefined;
  const weeklyStatus = weekly?.status as keyof typeof STATUS_COLOR;
  const logs   = weekData?.logs ?? [];
  const days   = (weekData?.days ?? []) as DayInfo[];
  const discrepancies: DiscrepancyFlag[] = weekData?.discrepancies ?? [];

  const isCurrentWeek = weekData?.is_current_week ?? weekStart === sundayOf().format("YYYY-MM-DD");
  const isEditable =
    !viewingOther &&
    isCurrentWeek &&
    (weekly?.status === "DRAFT" || weekly?.status === "REJECTED");
  const isViewOnly =
    viewingOther ||
    !isCurrentWeek ||
    weekly?.status === "SUBMITTED" ||
    weekly?.status === "APPROVED";

  const openAdd = (date?: string) => {
    setEditing(null);
    setDefaultDate(date);
    setModalOpen(true);
  };

  const mismatchDays = days.filter((d) => getMismatch(d));

  const weekLabel = weekly
    ? `${dayjs(weekly.week_start).format("DD MMM")} – ${dayjs(weekly.week_end).format("DD MMM YYYY")}`
    : "";

  // ── Export handler ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      let url = "";
      if (typeof (timesheetApi as any).exportUrl === "function") {
        url = (timesheetApi as any).exportUrl(weekStart, viewingOther ? selectedEmployee : undefined);
      } else {
        const params = new URLSearchParams();
        params.set("week_start", weekStart);
        if (viewingOther && selectedEmployee) params.set("employee_id", selectedEmployee);
        url = `${ENDPOINTS.TIMESHEET_EXPORT}?${params.toString()}`;
      }

      const response = await client.get(url, { responseType: "blob" });
      const downloadUrl = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `timesheet_export_${weekStart}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Export failed:", error);
      message.error("Failed to export timesheet.");
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: "Date", dataIndex: "log_date", width: 110,
      render: (v: string) => dayjs(v).format("DD MMM YYYY"),
    },
    { title: "Project",  dataIndex: "project_name", ellipsis: true },
    { title: "Epic",     dataIndex: "epic_title",   ellipsis: true, render: (v: string) => v || "—" },
    { title: "Story",    dataIndex: "story_title",  ellipsis: true, render: (v: string) => v || "—" },
    {
      title: "Ticket", dataIndex: "ticket_id", width: 120,
      render: (v: string, r: WorkLog) => (
        <Tooltip title={r.ticket_title}><span style={{ color: "#4f46e5" }}>{v}</span></Tooltip>
      ),
    },
    { title: "Type",  dataIndex: "ticket_type", width: 90 },
    { title: "Hours", dataIndex: "hours",       width: 70, render: (v: number) => `${v}h` },
    {
      title: "Category", dataIndex: "category", width: 110,
      render: (v: string) => <Tag>{v.replace("_", " ")}</Tag>,
    },
    { title: "Description", dataIndex: "description", ellipsis: true },
    {
      title: "", width: 90,
      render: (_: unknown, r: WorkLog) => isEditable ? (
        <Space size={4}>
          <PermGuard permission={PERMS.PROJECT_TIMESHEET_UPDATE}>
            <Button type="text" size="small" icon={<EditOutlined />}
              onClick={() => { setEditing(r); setModalOpen(true); }} />
          </PermGuard>
          <PermGuard permission={PERMS.PROJECT_TIMESHEET_DELETE}>
            <Popconfirm title="Delete this log?" onConfirm={() => deleteMut.mutate(r.id)}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </PermGuard>
        </Space>
      ) : null,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: embedded ? 12 : 16 }}>
        {!embedded && (
          <Title level={3} style={{ margin: 0 }}>
            {viewingOther ? "Timesheet Viewer" : "My Timesheet"}
          </Title>
        )}
        <Space wrap style={embedded ? { marginLeft: "auto" } : undefined}>
          {/* Admin: employee selector */}
         {(isAdmin || true) && (
  <Select
    allowClear
    showSearch
    placeholder="View another employee…"
              style={{ width: 220, maxWidth: "100%" }}
              value={selectedEmployee}
              onChange={setSelectedEmployee}
              filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
              options={employees.map((e) => ({ value: e.id, label: e.full_name }))}
            />
          )}
          {/* Export button */}
          <Tooltip title="Export week to CSV">
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Export CSV</Button>
          </Tooltip>
        </Space>
      </div>

      {/* Viewing-other banner */}
      {viewingOther && weekData?.viewed_employee && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <span>
              Viewing timesheet for <strong>{weekData.viewed_employee.name}</strong>.
              This is read-only — edits must be made by the employee.
            </span>
          }
        />
      )}

      {/* Week navigation */}
      <div className="ts-week-nav">
        <Button
          icon={<LeftOutlined />}
          onClick={() => setWeekStart(sundayOf(dayjs(weekStart).subtract(1, "week")).format("YYYY-MM-DD"))}
        />
        <span className="ts-week-label">{weekLabel}</span>
        <Button
          icon={<RightOutlined />}
          disabled={sundayOf(dayjs(weekStart).add(1, "week")).isAfter(dayjs())}
          onClick={() => setWeekStart(sundayOf(dayjs(weekStart).add(1, "week")).format("YYYY-MM-DD"))}
        />
        <Button onClick={() => setWeekStart(sundayOf().format("YYYY-MM-DD"))}>Today</Button>
      </div>

      {/* Status bar */}
      {weekly && (
        <div className="ts-status-bar">
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Space wrap>
              {/* Consistent status label */}
              <Tag color={STATUS_COLOR[weeklyStatus]} style={{ fontSize: 13, padding: "2px 10px" }}>
                {STATUS_LABEL[weeklyStatus]}
              </Tag>
              <Text>
                <strong>{weekly.total_hours}h</strong> / {weekly.expected_hours}h
                {weekly.hours_behind > 0 && isEditable && (
                  <Text type="warning" style={{ marginLeft: 8 }}>{weekly.hours_behind}h behind</Text>
                )}
              </Text>
              {weekly.status === "REJECTED" && weekly.review_comment && (
                <Alert type="error" message={weekly.review_comment} style={{ padding: "2px 8px" }} />
              )}
            </Space>
            {isViewOnly && (
              <Alert
                type="info" showIcon
                message={
                  viewingOther
                    ? "Admin view — read only."
                    : !isCurrentWeek
                      ? "Past weeks are view only. Click Today to return to the current week."
                      : weekly.status === "SUBMITTED"
                        ? "Submitted and awaiting review. Entries cannot be edited."
                        : "This timesheet has been approved."
                }
                style={{ marginBottom: 0 }}
              />
            )}
          </Space>
          <Space>
            {isEditable && (
              <>
                <PermGuard permission={PERMS.PROJECT_TIMESHEET_CREATE}>
                  <Tooltip title="Copy all entries from last week">
                    <Button icon={<CopyOutlined />} onClick={() => copyWeekMut.mutate()}
                      loading={copyWeekMut.isPending}>
                      Copy Last Week
                    </Button>
                  </Tooltip>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd()}>
                    Log Time
                  </Button>
                </PermGuard>
                <PermGuard permission={PERMS.PROJECT_TIMESHEET_SUBMIT}>
                  <Button
                    type="primary" icon={<SendOutlined />}
                    loading={submitMut.isPending}
                    disabled={logs.length === 0}
                    onClick={() => submitMut.mutate({ id: weekly.id, weekStart: weekly.week_start })}
                  >
                    Submit
                  </Button>
                </PermGuard>
              </>
            )}
          </Space>
        </div>
      )}

      {/* Discrepancy flags (admin view) */}
      {discrepancies.length > 0 && (
        <Alert
          type="warning" showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 14 }}
          message="Attendance vs timesheet discrepancies"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {discrepancies.map((d) => (
                <li key={d.date}>
                  <strong>{dayjs(d.date).format("ddd DD MMM")}</strong> — {d.message}
                </li>
              ))}
            </ul>
          }
        />
      )}

      {/* Mismatch alerts (own view) */}
      {!viewingOther && mismatchDays.length > 0 && (
        <Alert
          type="warning" showIcon
          style={{ marginBottom: 14 }}
          message="Attendance vs timesheet mismatch"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {mismatchDays.map((d) => (
                <li key={d.date}>
                  <strong>{dayjs(d.date).format("ddd DD MMM")}</strong> — {getMismatch(d)}
                </li>
              ))}
            </ul>
          }
        />
      )}

      {/* Day cards */}
      <div className="ts-day-cards">
        {days.map((d) => {
          const mismatch = getMismatch(d);
          const otLabel  = overtimeLabel(d);
          return (
            <Tooltip
              key={d.date}
              title={
                !d.can_log
                  ? (d.attendance_hint ?? (!isCurrentWeek ? "Past weeks are view only" : "Attendance not completed"))
                  : undefined
              }
            >
              <div
                className={[
                  "ts-day-card",
                  d.over_capacity  ? "ts-day-card--over"     : "",
                  !d.can_log       ? "ts-day-card--disabled"  : "",
                  isViewOnly       ? "ts-day-card--readonly"  : "",
                  d.is_weekend     ? "ts-day-card--weekend"   : "",
                  d.is_holiday     ? "ts-day-card--holiday"   : "",
                  d.is_on_leave    ? "ts-day-card--leave"     : "",
                  d.is_half_day_leave ? "ts-day-card--half-leave" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => isEditable && d.can_log && openAdd(d.date)}
                style={{ cursor: isEditable && d.can_log ? "pointer" : "default" }}
              >
                <div className="ts-day-name">{d.day_name.slice(0, 3)}</div>
                <div className="ts-day-date">{dayjs(d.date).format("DD MMM")}</div>

                {/* Holiday badge */}
                {d.is_holiday && (
                  <div className="ts-badge ts-badge--holiday">
                    🎉 {d.holiday_name ?? "Holiday"}
                  </div>
                )}

                {/* Leave badge */}
                {d.is_on_leave && !d.is_holiday && (
                  <Tooltip title={d.leave_reason ? `Reason: ${d.leave_reason}` : undefined}>
                    <div className={`ts-badge ${d.leave_is_paid === false ? "ts-badge--lop" : "ts-badge--leave"}`}>
                      <MedicineBoxOutlined style={{ marginRight: 2 }} />
                      {d.leave_type_name ?? "LEAVE"}
                      {d.is_half_day_leave ? ` (${d.half_day_period === "FIRST_HALF" ? "FH" : d.half_day_period === "SECOND_HALF" ? "SH" : "HD"})` : ""}
                      {d.leave_is_paid === false && " (LOP)"}
                    </div>
                  </Tooltip>
                )}

                {/* Hours */}
                <div className={`ts-day-hours${d.over_capacity ? " ts-day-hours--over" : ""}`}
                  style={hoursStyle(d)}>
                  {d.is_holiday
                    ? <span style={{ color: "#9ca3af", fontSize: 12 }}>0h — Holiday</span>
                    : d.is_half_day_leave
                      ? <span style={{ color: "#7c3aed", fontSize: 12 }}>{d.total_hours}h / 4h</span>
                    : d.is_on_leave && d.total_hours === 0
                      ? <span style={{ color: "#9ca3af", fontSize: 12 }}>0h — On Leave</span>
                      : `${d.total_hours}h${d.capacity > 0 ? ` / ${d.capacity}h` : d.total_hours > 0 ? " logged" : ""}`
                  }
                </div>

                {/* Overtime / undertime badge */}
                {otLabel && (
                  <div className={`ts-ot-badge ${d.total_hours > d.capacity ? "ts-ot-badge--over" : "ts-ot-badge--under"}`}>
                    {otLabel}
                  </div>
                )}

                {/* Attendance check-in/out */}
                {d.check_in && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "#059669" }}>
                      <LoginOutlined /> {d.check_in}
                    </span>
                    {d.check_out && (
                      <span style={{ fontSize: 10, color: "#dc2626" }}>
                        <LogoutOutlined /> {d.check_out}
                      </span>
                    )}
                  </div>
                )}

                {/* Mismatch warning */}
                {mismatch && (
                  <div style={{ fontSize: 10, color: "#d97706", marginTop: 3 }}>⚠ {mismatch}</div>
                )}

                {!d.can_log && !d.is_holiday && !d.is_on_leave && (
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                    {!isCurrentWeek ? "View only" : d.attendance_hint ? "No attendance" : "—"}
                  </div>
                )}
                {!d.can_log && d.is_on_leave && !d.is_half_day_leave && (
                  <div style={{ fontSize: 10, color: "#7c3aed", marginTop: 4 }}>
                    Leave — auto-recorded
                  </div>
                )}
                {d.is_half_day_leave && (
                  <div style={{ fontSize: 10, color: "#7c3aed", marginTop: 4 }}>
                    Half-day leave ({d.half_day_period === "FIRST_HALF" ? "FH" : d.half_day_period === "SECOND_HALF" ? "SH" : "HD"})
                  </div>
                )}

                {isEditable && d.can_log && d.log_count > 0 && (
                  <Button type="link" size="small" style={{ padding: 0, marginTop: 4, fontSize: 11 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const prev = dayjs(d.date).subtract(1, "day").format("YYYY-MM-DD");
                      copyDayMut.mutate({ src: prev, tgt: d.date });
                    }}>
                    <CopyOutlined /> Copy prev day
                  </Button>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>

      {/* Attendance & Leave summary */}
      {days.some((d) => d.check_in || d.is_holiday || d.is_on_leave) && (
        <Card
          size="small"
          title={
            <span style={{ fontSize: 13 }}>
              <ClockCircleOutlined style={{ marginRight: 6, color: "#6366f1" }} />
              Attendance & Leave Summary — {weekLabel}
              {/* Tooltip clarifying Working Hrs vs Logged Hrs */}
              <Tooltip
                title={
                  <span>
                    <strong>Working Hrs</strong> = actual clock-in to clock-out duration from attendance.<br />
                    <strong>Logged Hrs</strong> = hours you have manually logged against tickets in the timesheet.
                    These may differ — discrepancies are flagged with ⚠.
                  </span>
                }
              >
                <QuestionCircleOutlined style={{ marginLeft: 8, color: "#9ca3af", cursor: "help" }} />
              </Tooltip>
            </span>
          }
          style={{ marginBottom: 16 }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bms-surface-2)" }}>
                  {["Day", "Date", "Check In", "Check Out", "Working Hrs", "Logged Hrs", "Status"].map((h) => (
                    <th key={h} style={{
                      padding: "8px 10px", textAlign: "left",
                      borderBottom: "1px solid var(--bms-border)",
                      fontWeight: 600, color: "var(--bms-text)",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const mismatch = getMismatch(d);
                  const isSecondHalf = d.half_day_period === "SECOND_HALF" || (d.check_in && parseInt(d.check_in.split(":")[0]) >= 12);
                  const periodTag = isSecondHalf ? " (SH)" : " (FH)";
                  const statusCell = d.is_holiday
                    ? <Tag color="gold">🎉 {d.holiday_name}</Tag>
                    : d.is_on_leave
                      ? (
                        <Tooltip title={d.leave_reason || undefined}>
                          <Tag color={d.is_half_day_leave ? "orange" : (d.leave_is_paid === false ? "error" : "purple")}>
                            <MedicineBoxOutlined style={{ marginRight: 3 }} />
                            {d.leave_type_name ?? "On Leave"}
                            {d.is_half_day_leave ? periodTag : ""}
                            {d.leave_is_paid === false && " (LOP)"}
                          </Tag>
                        </Tooltip>
                      )
                      : d.is_weekend
                        ? <Tag color="default">Weekend</Tag>
                        : d.attendance_status
                          ? (
                            <Tag color={
                              d.attendance_status === "PRESENT"  ? "green"
                              : d.attendance_status === "WFH"    ? "blue"
                              : d.attendance_status === "HALF_DAY" ? "orange"
                              : "default"
                            }>
                              {d.attendance_status === "HALF_DAY" ? `Half Day${periodTag}` : d.attendance_status.replace("_", " ")}
                            </Tag>
                          )
                          : <span style={{ color: "#9ca3af" }}>No attendance</span>;

                  return (
                    <tr
                      key={d.date}
                      style={{
                        background: d.is_holiday
                          ? "color-mix(in srgb, var(--bms-warning) 15%, var(--bms-surface))"
                          : d.is_on_leave
                            ? d.leave_is_paid === false ? "color-mix(in srgb, var(--bms-danger) 15%, var(--bms-surface))" : "color-mix(in srgb, #a78bfa 15%, var(--bms-surface))"
                            : "transparent",
                        borderBottom: "1px solid var(--bms-border)",
                      }}
                    >
                      <td style={{ padding: "7px 10px", fontWeight: 500, color: "var(--bms-text)" }}>{d.day_name.slice(0, 3)}</td>
                      <td style={{ padding: "7px 10px", color: "var(--bms-text)" }}>{dayjs(d.date).format("DD MMM")}</td>
                      <td style={{ padding: "7px 10px", color: "var(--bms-success)" }}>
                        {d.check_in ?? <span style={{ color: "var(--bms-text-3)" }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 10px", color: "var(--bms-danger)" }}>
                        {d.check_out ?? <span style={{ color: "var(--bms-text-3)" }}>—</span>}
                      </td>
                      <td style={{ padding: "7px 10px", color: "var(--bms-text)" }}>
                        {d.working_hours > 0
                          ? <span style={{ fontWeight: 600 }}>{d.working_hours}h</span>
                          : <span style={{ color: "var(--bms-text-3)" }}>—</span>
                        }
                      </td>
                      <td style={{ padding: "7px 10px", color: "var(--bms-text)" }}>
                        <span style={{ fontWeight: 600, color: mismatch ? "var(--bms-warning)" : "inherit" }}>
                          {d.is_holiday ? "0h" : `${d.total_hours}h`}
                        </span>
                        {mismatch && <span style={{ color: "var(--bms-warning)", marginLeft: 4 }}>⚠</span>}
                      </td>
                      <td style={{ padding: "7px 10px" }}>{statusCell}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Work logs table */}
      <Card title={`Work Logs — ${weekLabel}`}>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <WorkLogModal
        open={modalOpen && isEditable}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={async (v) => { await saveMut.mutateAsync(v); }}
        initial={editing}
        defaultDate={defaultDate}
        loading={saveMut.isPending}
      />
    </div>
  );
}