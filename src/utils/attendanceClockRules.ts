import dayjs, { Dayjs } from "dayjs";

function withinWindow(now: Dayjs, timeStr: string, beforeMin: number, afterMin: number): boolean {
  const [h, m] = timeStr.split(":").map(Number);
  const anchor = now.startOf("day").hour(h).minute(m).second(0);
  const start = anchor.subtract(beforeMin, "minute");
  const end = anchor.add(afterMin, "minute");
  return !now.isBefore(start) && !now.isAfter(end);
}

export function canClockInNow(opts: {
  shiftApplicable: boolean;
  shiftStart?: string | null;
  hrEnabled?: boolean;
  now?: Dayjs;
}): boolean {
  const { shiftApplicable, shiftStart, hrEnabled, now = dayjs() } = opts;
  if (!shiftApplicable) return true;
  if (hrEnabled) return true;
  if (!shiftStart) return false;
  return withinWindow(now, shiftStart, 5, 5);
}

export function canClockOutNow(opts: {
  shiftApplicable: boolean;
  shiftEnd?: string | null;
  hrEnabled?: boolean;
  now?: Dayjs;
}): boolean {
  const { shiftApplicable, shiftEnd, hrEnabled, now = dayjs() } = opts;
  if (!shiftApplicable) return true;
  if (hrEnabled) return true;
  if (!shiftEnd) return false;
  return withinWindow(now, shiftEnd, 5, 10);
}

export function clockInUnavailableReason(opts: {
  shiftApplicable: boolean;
  shiftStart?: string | null;
  hrEnabled?: boolean;
  clockInWindow?: string | null;
}): string {
  if (!opts.shiftApplicable) return "";
  if (opts.hrEnabled) return "";
  if (!opts.shiftStart) return "Shift timing is not configured on your profile.";
  const window = opts.clockInWindow ? ` Allowed window: ${opts.clockInWindow}.` : "";
  return `Check-in opens 5 minutes before your shift start (${opts.shiftStart}).${window}`;
}

export function clockOutUnavailableReason(opts: {
  shiftApplicable: boolean;
  shiftEnd?: string | null;
  hrEnabled?: boolean;
  clockOutWindow?: string | null;
}): string {
  if (!opts.shiftApplicable) return "";
  if (opts.hrEnabled) return "";
  if (!opts.shiftEnd) return "Shift timing is not configured on your profile.";
  const window = opts.clockOutWindow ? ` Allowed window: ${opts.clockOutWindow}.` : "";
  return `Check-out opens 5 minutes before your shift end (${opts.shiftEnd}).${window}`;
}
