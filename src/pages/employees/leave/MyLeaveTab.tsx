import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Typography, Button, Empty, Skeleton, Popconfirm, message, Tag, Card,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { get, del } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { ApplyLeaveModal } from "@/components/employee/LeaveAndPayslip";
import { formatDaysDisplay } from "./leaveStatus";
import "./leaveManagement.css";

const { Text } = Typography;

interface LeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  leave_type_color: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

interface MyLeaveRow {
  id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  leave_duration?: string;
  half_day_period?: string;
  days_count: number;
  reason: string;
  status: string;
  created_at: string;
}

/* Semi-Circular Speedometer Gauge Component */
function SpeedometerGauge({
  used,
  total,
  remaining,
  strokeColor = "#3b82f6",
  gradientId,
  gradientColors,
}: {
  used: number;
  total: number;
  remaining: number;
  strokeColor?: string;
  gradientId?: string;
  gradientColors?: [string, string];
}) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
  const arcLength = 125.66;
  const strokeDashoffset = arcLength - (arcLength * percent) / 100;

  return (
    <div style={{ position: "relative", width: 135, height: 75, display: "flex", justifyContent: "center", flexShrink: 0 }}>
      <svg width="135" height="80" viewBox="0 0 100 55">
        {gradientColors && gradientId && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientColors[0]} />
              <stop offset="100%" stopColor={gradientColors[1]} />
            </linearGradient>
          </defs>
        )}

        {/* Track Arc */}
        <path
          d="M 10,50 A 40,40 0 0,1 90,50"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Progress Arc */}
        {percent > 0 && (
          <path
            d="M 10,50 A 40,40 0 0,1 90,50"
            fill="none"
            stroke={gradientId ? `url(#${gradientId})` : strokeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        )}
      </svg>

      {/* Centered Number Value */}
      <div style={{
        position: "absolute",
        bottom: 6,
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: 22,
        fontWeight: 800,
        color: "var(--bms-text)",
        lineHeight: 1,
      }}>
        {remaining}
      </div>
    </div>
  );
}

function getSpeedoCardTheme(name: string, code?: string) {
  const norm = (name || "").toLowerCase();
  if (norm.includes("casual") || code === "CL") {
    return {
      gradientId: "casualGradient",
      gradientColors: ["#4f46e5", "#f43f5e"] as [string, string],
      strokeColor: "#4f46e5",
    };
  }
  if (norm.includes("emergency") || code === "EL") {
    return {
      gradientId: undefined,
      gradientColors: undefined,
      strokeColor: "#cbd5e1",
    };
  }
  if (norm.includes("sick") || code === "SL") {
    return {
      gradientId: undefined,
      gradientColors: undefined,
      strokeColor: "#41a768",
    };
  }
  return {
    gradientId: undefined,
    gradientColors: undefined,
    strokeColor: "#3b82f6",
  };
}

/* Monthly Calendar Component for Right Column */
function MonthlyCalendarView({ requests }: { requests: MyLeaveRow[] }) {
  const leaveDateMap: Record<string, string> = {};
  requests.forEach((r) => {
    if (r.start_date) {
      const dStr = dayjs(r.start_date).format("YYYY-MM-DD");
      leaveDateMap[dStr] = r.status;
    }
  });

  const now = dayjs();
  const daysInMonth = now.daysInMonth();
  const startDayOfWeek = now.startOf("month").day();
  const firstDayOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const prevMonthDays = now.subtract(1, "month").daysInMonth();

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const calendarCells = [];

  for (let i = firstDayOffset - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, isOther: true, status: undefined });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = now.date(d).format("YYYY-MM-DD");
    const status = leaveDateMap[dateStr];
    const normStatus = (status || "").toUpperCase();
    const isApproved = normStatus === "APPROVED";
    const isPending = ["PENDING", "PENDING_MANAGER", "PENDING_PROJECT_ACK"].includes(normStatus);
    const isRejected = normStatus === "REJECTED";
    calendarCells.push({
      day: d,
      isOther: false,
      status: isApproved ? "APPROVED" : isPending ? "PENDING" : isRejected ? "REJECTED" : undefined,
    });
  }

  const remaining = 35 - calendarCells.length;
  for (let d = 1; d <= (remaining > 0 ? remaining : 0); d++) {
    calendarCells.push({ day: d, isOther: true, status: undefined });
  }

  return (
    <div className="monthly-calendar-card">
      <div className="monthly-calendar-grid">
        {daysOfWeek.map((d) => (
          <div key={d} className="monthly-calendar-day-header">{d}</div>
        ))}
        {calendarCells.map((cell, idx) => (
          <div key={idx} className={`monthly-calendar-cell ${cell.isOther ? "monthly-calendar-cell--other" : ""}`}>
            <span>{cell.day}</span>
            {cell.status === "APPROVED" && <span className="monthly-calendar-dot monthly-calendar-dot--approved" />}
            {cell.status === "PENDING" && <span className="monthly-calendar-dot monthly-calendar-dot--pending" />}
            {cell.status === "REJECTED" && <span className="monthly-calendar-cross--rejected">✕</span>}
          </div>
        ))}
      </div>

      <div className="monthly-calendar-legend">
        <span className="legend-item">
          <span className="monthly-calendar-dot monthly-calendar-dot--approved" /> Approved
        </span>
        <span className="legend-item">
          <span className="monthly-calendar-dot monthly-calendar-dot--pending" /> Pending
        </span>
        <span className="legend-item">
          <span className="monthly-calendar-cross--rejected">✕</span> Rejected
        </span>
      </div>

      <Button className="btn-leave-calendar">
        <span>🍃</span> Leave Calendar
      </Button>
    </div>
  );
}

export default function MyLeaveTab() {
  const qc = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const token = useAuthStore((s) => s.token);

  const {
    data: balances = [],
    isLoading: balLoading,
    isError: balancesError,
  } = useQuery<LeaveBalance[]>({
    queryKey: ["my-leave-balances"],
    queryFn: () => get("/leave/balances/"),
    enabled: !!token,
  });

  const {
    data: requests = [],
    isLoading: reqLoading,
    isError: requestsError,
  } = useQuery<MyLeaveRow[]>({
    queryKey: ["my-leave-requests-list"],
    queryFn: () => get("/leave/requests/"),
    enabled: !!token,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => del(`/leave/requests/${id}/`),
    onSuccess: () => {
      message.success("Leave request cancelled");
      qc.invalidateQueries({ queryKey: ["my-leave-requests-list"] });
      qc.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: () => message.error("Could not cancel request"),
  });

  return (
    <div className="leave-page-container">
      {/* 3 Speedometer Metric Cards Grid */}
      {balLoading ? (
        <div className="speedo-cards-grid">
          {[1, 2, 3].map((item) => (
            <Card key={item} style={{ borderRadius: 16 }}><Skeleton active paragraph={{ rows: 2 }} title={false} /></Card>
          ))}
        </div>
      ) : balancesError ? (
        <Alert
          type="error"
          showIcon
          message="Leave balances could not be loaded"
          action={<Button size="small" onClick={() => qc.invalidateQueries({ queryKey: ["my-leave-balances"] })}>Retry</Button>}
        />
      ) : balances.length === 0 ? (
        <Alert type="info" showIcon message="No leave balances assigned yet. Contact HR." />
      ) : (
        <div className="speedo-cards-grid">
          {balances.map((b) => {
            const theme = getSpeedoCardTheme(b.leave_type_name, b.leave_type_code);
            return (
              <div key={b.leave_type_id} className="speedo-card">
                <h4 className="speedo-card__title">{b.leave_type_name}</h4>
                <div className="speedo-card__content">
                  <div className="speedo-card__gauge-box">
                    <SpeedometerGauge
                      used={b.used_days}
                      total={b.total_days}
                      remaining={b.remaining_days}
                      strokeColor={theme.strokeColor}
                      gradientId={theme.gradientId}
                      gradientColors={theme.gradientColors}
                    />
                  </div>
                  <div className="speedo-card__info-box">
                    <div className="speedo-card__used-text">
                      {b.used_days} Used / {b.total_days} Total
                    </div>
                    <div className="speedo-card__avail-text">
                      {b.remaining_days} Days Available
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2-Column Dashboard Grid */}
      <div className="leave-dashboard-2col">
        {/* Left Column: Recent Leave Requests */}
        <div>
          <h3 className="leave-col-title">Recent Leave Requests</h3>
          {reqLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : requestsError ? (
            <Alert type="error" message="Could not load recent leave requests" />
          ) : requests.length === 0 ? (
            <Empty description="No recent leave requests" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="recent-requests-list">
              {requests.map((r) => {
                const normStatus = (r.status || "").toUpperCase();
                const isApproved = normStatus === "APPROVED";
                const isRejected = normStatus === "REJECTED";
                const tone = isApproved ? "approved" : isRejected ? "rejected" : "pending";
                const statusLabel = isApproved ? "Approved" : isRejected ? "Rejected" : "Pending";

                return (
                  <div key={r.id} className="recent-request-card">
                    <div className="recent-request-card__left">
                      <div className={`recent-request-card__leaf-badge recent-request-card__leaf-badge--${tone}`}>
                        🍃
                      </div>
                      <div className="recent-request-card__details-grid">
                        <div className="recent-request-card__detail-item">
                          <span className="recent-request-card__label">Leave Type</span>
                          <span className="recent-request-card__val">{r.leave_type_name}</span>
                        </div>
                        <div className="recent-request-card__detail-item">
                          <span className="recent-request-card__label">Date</span>
                          <span className="recent-request-card__val">{dayjs(r.start_date).format("DD MMM YYYY")}</span>
                        </div>
                        <div className="recent-request-card__detail-item">
                          <span className="recent-request-card__label">Duration</span>
                          <span className="recent-request-card__val">{formatDaysDisplay(r.days_count, r)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="recent-request-card__right">
                      <span className={`recent-request-card__status-pill recent-request-card__status-pill--${tone}`}>
                        {statusLabel}
                      </span>
                      <span className="recent-request-card__applied-text">
                        Applied {dayjs(r.created_at).format("DD MMM YYYY")}
                      </span>
                      {["PENDING", "PENDING_MANAGER", "PENDING_PROJECT_ACK", "APPROVED"].includes(r.status) ? (
                        <Popconfirm title="Cancel this leave request?" onConfirm={() => cancelMutation.mutate(r.id)}>
                          <Button size="small" className="btn-recent-cancel">Cancel</Button>
                        </Popconfirm>
                      ) : (
                        <Button size="small" className="btn-recent-view">View details</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Monthly Overview Calendar */}
        <div>
          <h3 className="leave-col-title">Monthly Overview</h3>
          <MonthlyCalendarView requests={requests} />
        </div>
      </div>

      <ApplyLeaveModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onSuccess={() => {
          setApplyOpen(false);
          qc.invalidateQueries({ queryKey: ["my-leave-requests-list"] });
          qc.invalidateQueries({ queryKey: ["my-leave-balances"] });
        }}
        balances={balances}
      />
    </div>
  );
}
