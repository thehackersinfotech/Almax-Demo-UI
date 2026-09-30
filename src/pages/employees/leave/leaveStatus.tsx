import dayjs from "dayjs";

export const LEAVE_STATUS_META: Record<string, { label: string; tone: string }> = {
  PENDING:             { label: "Pending", tone: "warning" },
  PENDING_PROJECT_ACK: { label: "Awaiting acknowledgement", tone: "info" },
  PENDING_MANAGER:     { label: "Awaiting approval", tone: "warning" },
  APPROVED:            { label: "Approved", tone: "success" },
  REJECTED:            { label: "Rejected", tone: "danger" },
  CANCELLED:           { label: "Cancelled", tone: "neutral" },
};

export function LeaveStatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toUpperCase();
  const meta = LEAVE_STATUS_META[normalized] ?? {
    label: status || "Unknown",
    tone: "neutral",
  };

  return (
    <span className={`leave-status-pill leave-status-pill--${meta.tone} leave-status leave-status--${meta.tone}`}>
      <span className="leave-status-pill__dot leave-status__dot" aria-hidden />
      {meta.label}
    </span>
  );
}

export function formatHalfDayPeriodCode(record?: { half_day_period?: string; start_day_part?: string; end_day_part?: string }): string {
  if (!record) return "FH or SH";
  const period = (record.half_day_period || record.start_day_part || record.end_day_part || "").toUpperCase();
  if (period.includes("SECOND") || period === "SH" || period.includes("AFTERNOON")) {
    return "SH";
  }
  if (period.includes("FIRST") || period === "FH" || period.includes("MORNING")) {
    return "FH";
  }
  return "FH or SH";
}

export function formatDaysDisplay(daysCount: number, record?: any): string {
  const isHalf = daysCount === 0.5 || record?.leave_duration === "HALF_DAY";
  if (isHalf) {
    const code = formatHalfDayPeriodCode(record);
    return `Half Day (${code})`;
  }
  return `${Math.round(daysCount)} day(s)`;
}

export function formatDatesDisplay(startDate: string, endDate: string, daysCount: number, record?: any): string {
  const isHalf = daysCount === 0.5 || record?.leave_duration === "HALF_DAY";
  const startStr = dayjs(startDate).format("DD MMM");
  const endStr = dayjs(endDate).format("DD MMM");
  const rangeStr = (startDate && endDate && startDate !== endDate) ? `${startStr} – ${endStr}` : startStr;

  if (isHalf) {
    const code = formatHalfDayPeriodCode(record);
    return `${rangeStr} (Half day (${code}))`;
  }
  return `${rangeStr} · ${Math.round(daysCount)}d`;
}
