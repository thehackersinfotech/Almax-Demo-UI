import {
  Button, Divider, Progress, Select, Tag, Tooltip, Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  canClockInNow, canClockOutNow, clockInUnavailableReason, clockOutUnavailableReason,
} from "@/utils/attendanceClockRules";
import {
  CheckCircleOutlined, CoffeeOutlined, LoginOutlined,
  LogoutOutlined, PauseCircleOutlined, PlayCircleOutlined, ScheduleOutlined,
} from "@ant-design/icons";
import type { AttendanceToday, EmpDashboard } from "./types";
import { ATTENDANCE_STATUS_COLOR } from "./types";

const { Text } = Typography;

const BREAK_COLORS: Record<string, string> = {
  TEA: "#f59e0b",
  LUNCH: "#059669",
  OTHER: "#6b7280",
};

const BREAK_ICONS: Record<string, React.ReactNode> = {
  TEA: <CoffeeOutlined />,
  LUNCH: <CoffeeOutlined />,
  OTHER: <PauseCircleOutlined />,
};

interface AttendanceWidgetProps {
  today: AttendanceToday;
  month: EmpDashboard["attendance_month"];
  shiftApplicable: boolean;
  onCheckIn: (status: string) => void;
  onCheckOut: () => void;
  onBreakStart: (breakType: string) => void;
  onBreakEnd: () => void;
  checkingIn: boolean;
  checkingOut: boolean;
  breakStarting: boolean;
  breakEnding: boolean;
  onViewCalendar: () => void;
  compact?: boolean;
}

export default function AttendanceWidget({
  today,
  month,
  shiftApplicable,
  onCheckIn,
  onCheckOut,
  onBreakStart,
  onBreakEnd,
  checkingIn,
  checkingOut,
  breakStarting,
  breakEnding,
  onViewCalendar,
  compact = false,
}: AttendanceWidgetProps) {
  const st = today.status ? ATTENDANCE_STATUS_COLOR[today.status] : null;
  const breaks = today.breaks ?? [];
  const activeBreak = breaks.find((b) => !b.end_time);
  const onBreak = !!activeBreak;
  const workingHrs = today.working_hours ?? today.duration_hours;
  const breakMins = today.total_break_minutes ?? 0;
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

  return (
    <div className="emp-attendance">
      <div className="emp-attendance__head">
        <Text type="secondary" style={{ fontSize: 12 }}>Today</Text>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {onBreak && <Tag color="warning">On Break</Tag>}
          {st ? <Tag color="success">{st.label}</Tag> : <Text type="secondary" style={{ fontSize: 11 }}>Not marked</Text>}
          <Button size="small" type="link" icon={<ScheduleOutlined />} onClick={onViewCalendar} style={{ padding: 0, height: "auto" }}>
            Calendar
          </Button>
        </div>
      </div>

      <div className="emp-attendance__stats">
        {[
          { label: "In", value: today.check_in ?? "--:--" },
          { label: "Out", value: today.check_out ?? "--:--" },
          { label: "Working", value: workingHrs > 0 ? `${workingHrs}h` : "--" },
          { label: "Break", value: breakMins > 0 ? `${breakMins}m` : "--" },
        ].map(({ label, value }) => (
          <div key={label} className="emp-attendance__stat">
            <span className="emp-attendance__stat-label">{label}</span>
            <span className="emp-attendance__stat-value">{value}</span>
          </div>
        ))}
      </div>

      {!today.check_in ? (
        <Tooltip title={!canClockIn ? clockInUnavailableReason({
          shiftApplicable,
          shiftStart: today.shift_start,
          hrEnabled: today.clockin_enabled,
          clockInWindow: today.clock_in_window,
        }) : ""}>
          <Button
            type="primary"
            icon={<LoginOutlined />}
            loading={checkingIn}
            block
            disabled={!canClockIn}
            onClick={() => canClockIn && onCheckIn("PRESENT")}
            style={{ marginBottom: compact ? 0 : 10 }}
          >
            {canClockIn ? "Start Day" : "Start Day (unavailable)"}
          </Button>
        </Tooltip>
      ) : today.check_out ? (
        <div className="emp-attendance__done">
          <CheckCircleOutlined style={{ color: "var(--bms-success)", marginRight: 6 }} />
          <Text style={{ color: "var(--bms-success)", fontSize: 13 }}>Day completed</Text>
        </div>
      ) : (
        <div className="emp-attendance__actions">
          {!onBreak ? (
            <>
              <Select
                size="small"
                placeholder="Start Break"
                style={{ flex: 1 }}
                loading={breakStarting}
                onChange={(val: string) => onBreakStart(val)}
                value={undefined}
                suffixIcon={<PauseCircleOutlined />}
              >
                <Select.Option value="TEA">Tea Break</Select.Option>
                <Select.Option value="LUNCH">Lunch Break</Select.Option>
                <Select.Option value="OTHER">Other Break</Select.Option>
              </Select>
              <Tooltip title={!canClockOut ? clockOutUnavailableReason({
                shiftApplicable,
                shiftEnd: today.shift_end,
                hrEnabled: today.clockin_enabled,
                clockOutWindow: today.clock_out_window,
              }) : ""}>
                <Button danger icon={<LogoutOutlined />} loading={checkingOut} disabled={!canClockOut} onClick={() => canClockOut && onCheckOut()}>
                  End Day
                </Button>
              </Tooltip>
            </>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={breakEnding}
              block
              onClick={onBreakEnd}
            >
              Resume — {activeBreak?.break_type_label}
            </Button>
          )}
        </div>
      )}

      {!compact && breaks.length > 0 && (
        <>
          <Divider style={{ margin: "10px 0" }} />
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 6 }}>Today&apos;s breaks</Text>
          <div className="emp-attendance__breaks">
            {breaks.map((b) => (
              <div key={b.id} className="emp-attendance__break-row">
                <span style={{ color: BREAK_COLORS[b.break_type] ?? "#6b7280" }}>
                  {BREAK_ICONS[b.break_type]}
                </span>
                <Text style={{ fontSize: 12 }}>{b.break_type_label}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {b.start_time}{b.end_time ? ` – ${b.end_time}` : " (ongoing)"}
                </Text>
                {b.end_time && (
                  <Text strong style={{ fontSize: 12, marginLeft: "auto" }}>{b.duration_minutes}m</Text>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!compact && (
        <>
          <Divider style={{ margin: "10px 0" }} />
          <div className="emp-attendance__month">
            {[
              { label: "Present", value: month.present, color: "var(--bms-success)" },
              { label: "Leave", value: month.on_leave, color: "#7c3aed" },
              { label: "WFH", value: month.wfh, color: "var(--bms-primary)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="emp-attendance__month-stat">
                <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 10, color: "var(--bms-text-3)" }}>{label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function MiniBarChart({ logs }: { logs: Array<{ log_date: string; hours: number }> }) {
  if (!logs.length) {
    return <Text type="secondary" style={{ fontSize: 12 }}>No logs this month</Text>;
  }
  const max = Math.max(...logs.map((l) => l.hours), 1);
  return (
    <div className="emp-mini-bar">
      {logs.map((l) => (
        <div key={l.log_date} className="emp-mini-bar__col" title={`${l.log_date}: ${l.hours}h`}>
          <div
            className="emp-mini-bar__fill"
            style={{ height: `${(l.hours / max) * 40}px` }}
          />
        </div>
      ))}
    </div>
  );
}

export function WorkHoursStats({ stats }: { stats: import("./types").WorkStats }) {
  const totalDays = stats.working_days_count;
  const hasData = totalDays > 0;
  const allowedBreakMins = 45 + 20 * 2 + 5;
  const breakPct = hasData ? Math.min(100, Math.round((stats.avg_break_minutes / allowedBreakMins) * 100)) : 0;
  const workPct = hasData ? Math.min(100, Math.round((stats.avg_working_hours / 9) * 100)) : 0;

  if (!hasData) {
    return <Text type="secondary" style={{ fontSize: 13 }}>No attendance data this month</Text>;
  }

  return (
    <div className="emp-work-stats">
      <div>
        <div className="emp-work-stats__row">
          <Text style={{ fontSize: 12 }}>Avg working hours / day</Text>
          <Text strong style={{ fontSize: 12 }}>{stats.avg_working_hours.toFixed(1)}h</Text>
        </div>
        <Progress percent={workPct} showInfo={false} size="small" />
      </div>
      <div>
        <div className="emp-work-stats__row">
          <Text style={{ fontSize: 12 }}>Avg break / day</Text>
          <Text strong style={{ fontSize: 12 }}>{stats.avg_break_minutes.toFixed(0)} min</Text>
        </div>
        <Progress percent={breakPct} showInfo={false} size="small" strokeColor="#f59e0b" />
      </div>
      {(stats.on_time + stats.late + stats.early) > 0 && (
        <div className="emp-work-stats__punctuality">
          {[
            { label: "On Time", value: stats.on_time },
            { label: "Late", value: stats.late },
            { label: "Early", value: stats.early },
          ].map(({ label, value }) => (
            <div key={label} className="emp-work-stats__pill">
              <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
              <div style={{ fontSize: 10, color: "var(--bms-text-2)" }}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
