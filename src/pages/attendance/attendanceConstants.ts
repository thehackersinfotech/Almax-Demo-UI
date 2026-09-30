import dayjs, { Dayjs } from "dayjs";

export interface AttendanceRow {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  division: string;
  date: string;
  status: string;
  leave_duration?: string | null;
  half_day_period?: string | null;
  leave_type_name?: string | null;
  check_in: string | null;
  check_out: string | null;
  working_hours: number;
  shift_name: string | null;
}

export const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  PRESENT:    { color: "var(--bms-success)", bg: "rgba(22, 163, 74, 0.15)", label: "Present"    },
  WFH:        { color: "var(--bms-primary)", bg: "rgba(37, 99, 235, 0.15)", label: "WFH"        },
  ABSENT:     { color: "var(--bms-danger)", bg: "var(--bms-danger-bg)", label: "Absent"     },
  HALF_DAY:   { color: "var(--bms-warning)", bg: "rgba(217, 119, 6, 0.15)", label: "Half Day"   },
  ON_LEAVE:   { color: "#7c3aed", bg: "rgba(124, 58, 237, 0.15)", label: "On Leave"   },
  HOLIDAY:    { color: "#0d9488", bg: "rgba(13, 148, 136, 0.15)", label: "Holiday"    },
  WEEKEND:    { color: "var(--bms-text-3)", bg: "var(--bms-surface-2)", label: "Weekend"    },
  NOT_MARKED: { color: "var(--bms-text-3)", bg: "var(--bms-surface)", label: "Not Marked" },
};

/** Single-letter codes shown in the monthly matrix cells */
export const STATUS_CELL: Record<string, { code: string; textColor: string; bg: string; showInfo?: boolean }> = {
  PRESENT:    { code: "P", textColor: "var(--bms-success)", bg: "var(--bms-surface)" },
  WFH:        { code: "P", textColor: "var(--bms-primary)", bg: "rgba(37, 99, 235, 0.15)" },
  ABSENT:     { code: "A", textColor: "var(--bms-danger)", bg: "var(--bms-danger-bg)" },
  HALF_DAY:   { code: "H", textColor: "var(--bms-warning)", bg: "rgba(217, 119, 6, 0.15)" },
  ON_LEAVE:   { code: "L", textColor: "#7c3aed", bg: "var(--bms-surface)", showInfo: true },
  HOLIDAY:    { code: "H", textColor: "#0d9488", bg: "rgba(13, 148, 136, 0.15)" },
  WEEKEND:    { code: "",  textColor: "var(--bms-text-3)", bg: "var(--bms-surface-2)" },
  NOT_MARKED: { code: "",  textColor: "var(--bms-text-3)", bg: "var(--bms-surface)" },
};

export const MATRIX_LEGEND = [
  { code: "P", label: "Present", color: "#374151" },
  { code: "P", label: "Work From Home", color: "#2563eb" },
  { code: "H", label: "Half Day Leave", color: "#f59e0b" },
  { code: "L", label: "On Leave", color: "#7c3aed" },
  { code: "A", label: "Absent", color: "#dc2626" },
];

import { API_BASE } from "@/constants/api";

export function downloadAttendanceExport(year: number, month: number) {
  const token = localStorage.getItem("kc_access_token");
  const url = `${API_BASE}/attendance/export/?year=${year}&month=${month}`;
  fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then((r) => r.blob())
    .then((blob) => {
      const link = document.createElement("a");
      const pad = (n: number) => String(n).padStart(2, "0");
      const ts = `${year}_${pad(month)}_${new Date().toISOString().slice(0, 10).replace(/-/g, "_")}`;
      link.href = URL.createObjectURL(blob);
      link.download = `attendance_report_${ts}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
}

export function monthRange(month: Dayjs): [Dayjs, Dayjs] {
  return [month.startOf("month"), month.endOf("month")];
}

export function formatMonthLabel(month: Dayjs) {
  return month.format("MMMM YYYY");
}

export const todayEnd = () => dayjs().endOf("day");
