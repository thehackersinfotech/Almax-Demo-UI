import dayjs, { Dayjs } from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { FollowUpItem, FOLLOWUP_PRIORITIES } from "@/services/followups";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export function parseTime(value: string | null | undefined): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, ["HH:mm:ss", "HH:mm"], true);
  return parsed.isValid() ? parsed : null;
}

export function formatTimeShort(value: string | null | undefined): string {
  const t = parseTime(value);
  return t ? t.format("h:mm A") : "";
}

export function formatTimeRange(start: string | null, end: string | null): string | null {
  const s = formatTimeShort(start);
  const e = formatTimeShort(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return s;
  if (e) return `Until ${e}`;
  return null;
}

export function priorityColor(priority: string): string {
  return FOLLOWUP_PRIORITIES.find((p) => p.value === priority)?.accent ?? "#80868b";
}

export function statusColor(slug: string): string {
  const map: Record<string, string> = {
    planning: "#8B5CF6",
    inprogress: "#3B82F6",
    completed: "#10B981",
    cancelled: "#EF4444",
  };
  return map[slug] ?? "#6b7280";
}

/** Type-based colors — matching the workspace calendar legend */
const TYPE_COLORS: Record<string, string> = {
  EMAIL:      "#6366f1",
  CALL:       "#0284c7",
  MEETING:    "#2563eb",
  WHATSAPP:   "#10b981",
  SITE_VISIT: "#8b5cf6",
};

export function getTypeTagColor(type?: string): string {
  if (!type) return "#0284c7";
  return TYPE_COLORS[type.toUpperCase()] ?? "#0284c7";
}

/** Event fill: use type color so it matches the workspace calendar */
export function eventColor(item: FollowUpItem): string {
  return TYPE_COLORS[item.type?.toUpperCase()] ?? "#1677ff";
}

export function hasTimedSlot(item: FollowUpItem): boolean {
  return Boolean((item.start_date || item.end_date) && item.start_time);
}

/** Primary display date of an item — uses start_date, falls back to end_date */
export function eventDate(item: FollowUpItem): Dayjs | null {
  const d = item.start_date || item.end_date;
  if (!d) return null;
  return dayjs(d);
}

export function eventStartDate(item: FollowUpItem): Dayjs | null {
  if (!item.start_date) return null;
  return dayjs(item.start_date);
}

export function eventEndDate(item: FollowUpItem): Dayjs | null {
  const d = item.end_date || item.start_date;
  if (!d) return null;
  return dayjs(d);
}

export function eventStart(item: FollowUpItem): Dayjs | null {
  const d = eventDate(item);
  if (!d) return null;
  const t = parseTime(item.start_time);
  if (!t) return null;
  return d.hour(t.hour()).minute(t.minute()).second(0);
}

export function eventEnd(item: FollowUpItem): Dayjs | null {
  const start = eventStart(item);
  if (!start) return null;
  const t = parseTime(item.end_time);
  if (t) return start.hour(t.hour()).minute(t.minute());
  return start.add(30, "minute");
}

/** Returns true if `item` spans across `date` (including start and end) */
export function itemsOnDate(items: FollowUpItem[], date: Dayjs): FollowUpItem[] {
  return items.filter((i) => {
    const start = i.start_date ? dayjs(i.start_date) : null;
    const end = i.end_date ? dayjs(i.end_date) : null;
    if (start && end) {
      return date.isSameOrAfter(start, "day") && date.isSameOrBefore(end, "day");
    }
    const d = start || end;
    return d ? d.isSame(date, "day") : false;
  });
}

export function allDayItems(items: FollowUpItem[], date: Dayjs): FollowUpItem[] {
  return itemsOnDate(items, date).filter((i) => !i.start_time);
}

export function timedItems(items: FollowUpItem[], date: Dayjs): FollowUpItem[] {
  return itemsOnDate(items, date).filter((i) => Boolean(i.start_time));
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const HOUR_START = 6;
export const HOUR_END = 22;
export const HOUR_HEIGHT = 52;
