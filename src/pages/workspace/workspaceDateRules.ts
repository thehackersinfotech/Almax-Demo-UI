import dayjs, { Dayjs } from "dayjs";

/** True when the calendar day is strictly before today. */
export function isPastDate(value: Dayjs | string | null | undefined): boolean {
  if (!value) return false;
  return dayjs(value).isBefore(dayjs(), "day");
}

/** Check if a datetime (date + time) is in the past. */
export function isPastDateTime(date: Dayjs | string | null | undefined, time: Dayjs | string | null | undefined): boolean {
  if (!date) return false;
  const dateObj = dayjs(date);
  if (!time) return dateObj.isBefore(dayjs(), "day");
  
  const timeObj = dayjs(time, ["HH:mm:ss", "HH:mm"], true);
  if (!timeObj.isValid()) return dateObj.isBefore(dayjs(), "day");
  
  const datetime = dateObj
    .hour(timeObj.hour())
    .minute(timeObj.minute())
    .second(timeObj.second());
  
  return datetime.isBefore(dayjs());
}

/** Check if end datetime is before or equal to start datetime.
 *  Always builds full Date + Time objects for comparison so that
 *  an earlier clock time on a later date (e.g. 4 PM → 3 AM next day)
 *  is correctly accepted.
 *
 *  When dates are available, the TimePicker value is only used for its
 *  hour/minute/second — the date portion (always "today") is discarded. */
export function isTimeWindowInvalid(
  startTime: Dayjs | string | null | undefined,
  endTime: Dayjs | string | null | undefined,
  startDate?: Dayjs | string | null | undefined,
  endDate?: Dayjs | string | null | undefined,
): boolean {
  if (!startTime || !endTime) return false;

  const start = dayjs(startTime, ["HH:mm:ss", "HH:mm"], true);
  const end = dayjs(endTime, ["HH:mm:ss", "HH:mm"], true);

  if (!start.isValid() || !end.isValid()) return false;

  // If dates are provided, combine date + time for full comparison
  const sDate = startDate ? dayjs(startDate) : null;
  const eDate = endDate ? dayjs(endDate) : null;
  if (sDate?.isValid() && eDate?.isValid()) {
    // Extract only hour/minute from the time value; discard any embedded date.
    const startDt = sDate.hour(start.hour()).minute(start.minute()).second(0);
    const endDt = eDate.hour(end.hour()).minute(end.minute()).second(0);
    return endDt.isBefore(startDt);
  }

  // Fallback: compare times only (no dates available)
  return end.isBefore(start);
}

/** Disable picking past due dates. When editing, keep the existing date selectable. */
export function disablePastDueDate(currentDueDate?: Dayjs | string | null) {
  const current = currentDueDate ? dayjs(currentDueDate) : null;
  return (date: Dayjs) => {
    if (current?.isValid() && date.isSame(current, "day")) return false;
    return date.isBefore(dayjs(), "day");
  };
}

/** Only today and future dates accept new items or reschedule drops. */
export function canScheduleOnDate(value: Dayjs | string): boolean {
  return !isPastDate(value);
}
