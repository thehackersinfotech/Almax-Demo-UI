import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import type { WorkspaceCalendarEvent } from "@/services/workspace";

dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export type CalendarViewMode = "day" | "week" | "month" | "year" | "schedule";

export const VIEW_OPTIONS: { key: CalendarViewMode; label: string; shortcut: string }[] = [
  { key: "day", label: "Day", shortcut: "D" },
  { key: "week", label: "Week", shortcut: "W" },
  { key: "month", label: "Month", shortcut: "M" },
  { key: "year", label: "Year", shortcut: "Y" },
  { key: "schedule", label: "Schedule", shortcut: "A" },
];

export const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const HOUR_START = 0;
export const HOUR_END = 23;
export const HOUR_HEIGHT = 48;

export function parseTime(value: string | null | undefined): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, ["HH:mm:ss", "HH:mm"], true);
  return parsed.isValid() ? parsed : null;
}

export function formatEventTime(t: string | null | undefined): string | null {
  const p = parseTime(t);
  return p ? p.format("h:mma").toLowerCase() : null;
}

export function monthGrid(cursor: Dayjs): Dayjs[] {
  const start = cursor.startOf("month").startOf("week");
  const end = cursor.endOf("month").endOf("week");
  const days: Dayjs[] = [];
  let d = start;
  while (d.isBefore(end) || d.isSame(end, "day")) {
    days.push(d);
    d = d.add(1, "day");
  }
  return days;
}

export function weekRows(cursor: Dayjs): Dayjs[][] {
  const days = monthGrid(cursor);
  const rows: Dayjs[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

export function dateRangeForView(cursor: Dayjs, mode: CalendarViewMode): { from: string; to: string } {
  switch (mode) {
    case "day":
      return {
        from: cursor.format("YYYY-MM-DD"),
        to: cursor.format("YYYY-MM-DD"),
      };
    case "week":
      return {
        from: cursor.startOf("week").format("YYYY-MM-DD"),
        to: cursor.endOf("week").format("YYYY-MM-DD"),
      };
    case "year":
      return {
        from: cursor.startOf("year").format("YYYY-MM-DD"),
        to: cursor.endOf("year").format("YYYY-MM-DD"),
      };
    case "schedule":
      return {
        from: cursor.startOf("month").format("YYYY-MM-DD"),
        to: cursor.add(2, "month").endOf("month").format("YYYY-MM-DD"),
      };
    default: {
      const days = monthGrid(cursor);
      return { from: days[0].format("YYYY-MM-DD"), to: days[days.length - 1].format("YYYY-MM-DD") };
    }
  }
}

export function titleForView(cursor: Dayjs, mode: CalendarViewMode): string {
  switch (mode) {
    case "day":
      return cursor.format("dddd, MMMM D, YYYY");
    case "week":
      return `${cursor.startOf("week").format("MMM D")} – ${cursor.endOf("week").format("MMM D, YYYY")}`;
    case "year":
      return cursor.format("YYYY");
    case "schedule":
      return "Schedule";
    default:
      return cursor.format("MMMM YYYY");
  }
}

export function navigateCursor(cursor: Dayjs, mode: CalendarViewMode, dir: -1 | 1): Dayjs {
  const step = dir === -1 ? -1 : 1;
  switch (mode) {
    case "day": return cursor.add(step, "day");
    case "week": return cursor.add(step, "week");
    case "year": return cursor.add(step, "year");
    case "schedule": return cursor.add(step, "month");
    default: return cursor.add(step, "month");
  }
}

export function eventsOnDate(events: WorkspaceCalendarEvent[], date: Dayjs): WorkspaceCalendarEvent[] {
  return events.filter((ev) => {
    if (ev.start_date && ev.end_date) {
      const start = dayjs(ev.start_date);
      const end = dayjs(ev.end_date);
      return date.isSameOrAfter(start, "day") && date.isSameOrBefore(end, "day");
    }
    const d = ev.start_date || ev.end_date;
    return d ? dayjs(d).isSame(date, "day") : false;
  });
}

export function isMultiDayEvent(ev: WorkspaceCalendarEvent): boolean {
  return Boolean(ev.start_date && ev.end_date && ev.start_date !== ev.end_date);
}

export function allDayEvents(events: WorkspaceCalendarEvent[], date: Dayjs): WorkspaceCalendarEvent[] {
  return eventsOnDate(events, date).filter((ev) => !ev.start_time || isMultiDayEvent(ev));
}

export function timedEvents(events: WorkspaceCalendarEvent[], date: Dayjs): WorkspaceCalendarEvent[] {
  return eventsOnDate(events, date).filter((ev) => Boolean(ev.start_time) && !isMultiDayEvent(ev));
}

export function eventStart(ev: WorkspaceCalendarEvent): Dayjs | null {
  const d_str = ev.start_date || ev.end_date;
  if (!d_str) return null;
  const d = dayjs(d_str);
  const t = parseTime(ev.start_time);
  if (!t) return null;
  return d.hour(t.hour()).minute(t.minute()).second(0);
}

export function eventEnd(ev: WorkspaceCalendarEvent): Dayjs | null {
  const start = eventStart(ev);
  if (!start) return null;
  const t = parseTime(ev.end_time);
  if (t) {
    const end_d_str = ev.end_date || ev.start_date;
    const end_d = dayjs(end_d_str);
    return end_d.hour(t.hour()).minute(t.minute());
  }
  return start.add(30, "minute");
}

export function groupEventsByDate(events: WorkspaceCalendarEvent[]): { date: string; items: WorkspaceCalendarEvent[] }[] {
  const map = new Map<string, WorkspaceCalendarEvent[]>();
  for (const ev of events) {
    const d_start = ev.start_date || ev.end_date;
    const d_end = ev.end_date || ev.start_date;
    if (!d_start) continue;

    let current = dayjs(d_start);
    const endDay = dayjs(d_end);
    let i = 0;
    while (current.isSameOrBefore(endDay, "day") && i < 365) {
      const d_str = current.format("YYYY-MM-DD");
      const list = map.get(d_str) ?? [];
      list.push(ev);
      map.set(d_str, list);
      current = current.add(1, "day");
      i++;
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: items.sort((x, y) => (x.start_time ?? "").localeCompare(y.start_time ?? "")),
    }));
}

/** Earliest start time (minutes since midnight) among timed events, or null if none. */
export function earliestEventMinutes(events: WorkspaceCalendarEvent[]): number | null {
  let earliest: number | null = null;
  for (const ev of events) {
    const start = eventStart(ev);
    if (!start) continue;
    const minutes = start.hour() * 60 + start.minute();
    if (earliest === null || minutes < earliest) earliest = minutes;
  }
  return earliest;
}

export function hourSlots(): number[] {
  const h: number[] = [];
  for (let i = HOUR_START; i <= HOUR_END; i++) h.push(i);
  return h;
}

export interface TimedEventLayout {
  id: string;
  ev: WorkspaceCalendarEvent;
  top: number;
  height: number;
  col: number;
  totalCols: number;
  isStart: boolean;
  isEnd: boolean;
}

/** Lay out timed events with dynamic widths that change at overlap boundaries (Google Calendar style). */
export function layoutTimedEventsForDay(dayEvents: WorkspaceCalendarEvent[], date: Dayjs): TimedEventLayout[] {
  interface Slot {
    ev: WorkspaceCalendarEvent;
    startMin: number;
    endMin: number;
    originalStartMin: number;
    originalEndMin: number;
  }

  const slots: Slot[] = [];
  const timePoints = new Set<number>();

  for (const ev of dayEvents) {
    const start = eventStart(ev);
    const end = eventEnd(ev);
    if (!start || !end) continue;

    let startMin = start.hour() * 60 + start.minute();
    if (start.isBefore(date, "day")) startMin = HOUR_START * 60;
    
    let endMin = end.hour() * 60 + end.minute();
    if (end.isAfter(date, "day")) endMin = (HOUR_END + 1) * 60;
    
    startMin = Math.max(startMin, HOUR_START * 60);
    endMin = Math.min(endMin, (HOUR_END + 1) * 60);

    // Enforce minimum visual duration of 30 mins
    if (endMin - startMin < 30) {
      endMin = Math.min(startMin + 30, (HOUR_END + 1) * 60);
    }
    if (endMin <= startMin) {
      startMin = Math.max(endMin - 30, HOUR_START * 60);
    }

    slots.push({
      ev,
      originalStartMin: startMin,
      originalEndMin: endMin,
      startMin,
      endMin,
    });
  }

  // Sort slots by start time, then by longest duration
  slots.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return b.endMin - a.endMin;
  });

  const layouts: TimedEventLayout[] = [];
  let currentCluster: Slot[] = [];
  let clusterEnd = -1;

  const processCluster = (cluster: Slot[]) => {
    if (cluster.length === 0) return;
    
    const columns: number[] = [];
    const slotColumns = new Map<Slot, number>();
    
    for (const slot of cluster) {
      let assignedCol = -1;
      for (let c = 0; c < columns.length; c++) {
        if (columns[c] <= slot.startMin) {
          assignedCol = c;
          break;
        }
      }
      
      if (assignedCol === -1) {
        assignedCol = columns.length;
        columns.push(slot.endMin);
      } else {
        columns[assignedCol] = slot.endMin;
      }
      slotColumns.set(slot, assignedCol);
    }
    
    const totalCols = columns.length;
    
    for (const slot of cluster) {
      const topMin = slot.startMin - HOUR_START * 60;
      const durMin = slot.endMin - slot.startMin;
      
      layouts.push({
        id: `${slot.ev.source}-${slot.ev.id}`,
        ev: slot.ev,
        top: (topMin / 60) * HOUR_HEIGHT,
        height: (durMin / 60) * HOUR_HEIGHT,
        col: slotColumns.get(slot)!,
        totalCols,
        isStart: true,
        isEnd: true,
      });
    }
  };

  for (const slot of slots) {
    if (currentCluster.length > 0 && slot.startMin >= clusterEnd) {
      processCluster(currentCluster);
      currentCluster = [];
      clusterEnd = -1;
    }
    currentCluster.push(slot);
    clusterEnd = Math.max(clusterEnd, slot.endMin);
  }
  processCluster(currentCluster);

  return layouts;
}

export function injectCEOBriefingEvents(events: WorkspaceCalendarEvent[] = []): WorkspaceCalendarEvent[] {
  const todayStr = dayjs().format("YYYY-MM-DD");
  
  const ceoEvents: WorkspaceCalendarEvent[] = [
    {
      id: "ceo-briefing-1",
      source: "followup",
      title: "Product Review",
      event_kind: "meeting",
      start_date: todayStr,
      end_date: todayStr,
      start_time: "09:00:00",
      end_time: "10:00:00",
      color: "#f59e0b",
      priority: "HIGH",
      description: "Review product roadmap and upcoming v5 features.",
    },
    {
      id: "ceo-briefing-2",
      source: "followup",
      title: "Client Meeting",
      event_kind: "meeting",
      start_date: todayStr,
      end_date: todayStr,
      start_time: "10:30:00",
      end_time: "12:00:00",
      color: "#1677ff",
      priority: "IMPORTANT",
      description: "Discuss requirements and feedback with a major client.",
    },
    {
      id: "ceo-briefing-3",
      source: "followup",
      title: "Lunch",
      event_kind: "meeting",
      start_date: todayStr,
      end_date: todayStr,
      start_time: "12:00:00",
      end_time: "13:00:00",
      color: "#6B7280",
      priority: "LOW",
      description: "Daily break.",
    },
    {
      id: "ceo-briefing-4",
      source: "followup",
      title: "Board Meeting",
      event_kind: "meeting",
      start_date: todayStr,
      end_date: todayStr,
      start_time: "14:00:00",
      end_time: "15:30:00",
      color: "#1677ff",
      priority: "IMPORTANT",
      description: "Q3 board meeting with stakeholders.",
    },
    {
      id: "ceo-briefing-5",
      source: "followup",
      title: "Investor Call",
      event_kind: "meeting",
      start_date: todayStr,
      end_date: todayStr,
      start_time: "17:00:00",
      end_time: "18:00:00",
      color: "#1677ff",
      priority: "IMPORTANT",
      description: "Progress update call with key investors.",
    },
  ];

  const merged = [...events];
  ceoEvents.forEach(ce => {
    if (!merged.some(e => e.title === ce.title && (e.start_date === ce.start_date || e.end_date === ce.start_date))) {
      merged.push(ce);
    }
  });

  return merged.sort((a, b) => {
    const aDate = a.start_date || a.end_date || "";
    const bDate = b.start_date || b.end_date || "";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    const aTime = a.start_time || "";
    const bTime = b.start_time || "";
    return aTime.localeCompare(bTime);
  });
}

