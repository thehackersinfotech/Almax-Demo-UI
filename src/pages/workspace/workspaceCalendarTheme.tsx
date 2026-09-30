import dayjs from "dayjs";
import type { WorkspaceCalendarEvent } from "@/services/workspace";
import { formatEventTime, eventStart, eventEnd } from "./workspaceCalendarUtils";

export function extractCustomColor(text?: string): { color: string | null; cleanText: string } {
  if (!text) return { color: null, cleanText: "" };
  const match = text.match(/<!--color:(#[0-9A-Fa-f]{6})-->\s*$/);
  if (match) {
    return { color: match[1], cleanText: text.replace(match[0], "").trim() };
  }
  return { color: null, cleanText: text };
}

export const OPERATIONS: Record<string, { label: string; bg: string; border: string; dot: string; pastelBg: string; pastelBorder: string }> = {
  todo:       { label: "To-Do",      bg: "#3c4043", border: "#3c4043", dot: "#3c4043",       pastelBg: "rgba(60, 64, 67, 0.10)", pastelBorder: "rgba(60, 64, 67, 0.25)" },
  call:       { label: "Call",       bg: "#f59e0b", border: "#f59e0b", dot: "#f59e0b",       pastelBg: "rgba(245, 158, 11, 0.10)", pastelBorder: "rgba(245, 158, 11, 0.25)" },
  meeting:    { label: "Meeting",    bg: "#1677ff", border: "#1677ff", dot: "#1677ff",       pastelBg: "rgba(22, 119, 255, 0.10)", pastelBorder: "rgba(22, 119, 255, 0.25)" },
  email:      { label: "Email",      bg: "#6366f1", border: "#6366f1", dot: "#6366f1",       pastelBg: "rgba(99, 102, 241, 0.10)", pastelBorder: "rgba(99, 102, 241, 0.25)" },
  whatsapp:   { label: "WhatsApp",   bg: "#10b981", border: "#10b981", dot: "#10b981",       pastelBg: "rgba(34, 197, 94, 0.10)", pastelBorder: "rgba(34, 197, 94, 0.25)" },
  site_visit: { label: "Site Visit", bg: "#8b5cf6", border: "#8b5cf6", dot: "#8b5cf6",       pastelBg: "rgba(139, 92, 246, 0.10)", pastelBorder: "rgba(139, 92, 246, 0.25)" },
  followup:   { label: "Follow-up",  bg: "#1677ff", border: "#1677ff", dot: "#1677ff",       pastelBg: "rgba(22, 119, 255, 0.10)", pastelBorder: "rgba(22, 119, 255, 0.25)" },
};

export const TODO_FILTER_KEYS = ["todo"] as const;
export const FOLLOWUP_FILTER_KEYS = ["call", "meeting", "email", "whatsapp", "site_visit"] as const;
export const CALENDAR_FILTER_KEYS = [...TODO_FILTER_KEYS, ...FOLLOWUP_FILTER_KEYS] as const;

export const CALENDAR_FILTER_GROUPS = [
  { id: "todo", label: "To-Do", keys: [...TODO_FILTER_KEYS] },
  { id: "followup", label: "Follow-up", keys: [...FOLLOWUP_FILTER_KEYS] },
] as const;

export function operationKey(ev: WorkspaceCalendarEvent): string {
  if (ev.source === "todo") return "todo";
  const kind = ev.event_kind?.toLowerCase() ?? "";
  if ((FOLLOWUP_FILTER_KEYS as readonly string[]).includes(kind)) return kind;
  return "followup";
}

export function eventMatchesFilters(
  ev: WorkspaceCalendarEvent,
  visibleOps: Record<string, boolean>,
): boolean {
  const key = operationKey(ev);
  if (key === "todo") return visibleOps.todo !== false;
  if (key === "followup") {
    return FOLLOWUP_FILTER_KEYS.some((k) => visibleOps[k] !== false);
  }
  return visibleOps[key] !== false;
}

export function operationStyle(ev: WorkspaceCalendarEvent) {
  const key = operationKey(ev);
  const base = OPERATIONS[key] ?? OPERATIONS.followup;
  const customStr = ev.source === "todo" ? ev.description : ev.comments;
  let { color: customColor } = extractCustomColor(customStr);
  let evColor = ev.color;
  
  if (ev.source === "todo") {
    if (customColor?.toUpperCase() === "#64748B") customColor = null;
    if (evColor?.toUpperCase() === "#64748B") evColor = null;
  }

  const color = customColor ?? evColor ?? base.dot;
  return {
    label: base.label,
    bg: base.pastelBg,
    border: base.pastelBorder,
    dot: color,
  };
}

export function eventTitle(ev: WorkspaceCalendarEvent): string {
  const title = ev.title?.trim() || "Untitled";
  if (ev.source === "followup" && ev.event_kind === "call") return `Call: ${title}`;
  return title;
}

export function isDone(ev: WorkspaceCalendarEvent): boolean {
  const slug = ev.workflow_state_slug?.toLowerCase() ?? "";
  return slug === "done" || slug === "completed" || slug === "closed" || slug === "cancelled";
}

export function PastelEventChip({
  ev, onClick, compact, draggable, onDragStart, onDragEnd, cellDate, onToggleDone,
}: {
  ev: WorkspaceCalendarEvent;
  onClick: () => void;
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  cellDate?: string;
  onToggleDone?: (ev: WorkspaceCalendarEvent) => void;
}) {
  const op = operationStyle(ev);
  const time = formatEventTime(ev.start_time);
  const title = eventTitle(ev);
  const start = eventStart(ev);
  const end = eventEnd(ev);
  const now = dayjs();
  const isActive = start && end && now.isSameOrAfter(start) && now.isSameOrBefore(end);
  const done = isDone(ev);
  const isTodo = ev.source === "todo";
  const hasAssignee = Boolean(ev.assignee_name);

  // If it spans multiple days OR has no time (all day), it's a solid block. 
  // Otherwise, it's just text with a colored dot.
  const isMultiDay = Boolean(ev.start_date && ev.end_date && ev.start_date !== ev.end_date);
  const isAllDay = !ev.start_time && !ev.end_time;
  // Always render To-Dos as solid blocks so they appear with blue/custom background and white text.
  const isSolidBlock = isMultiDay || isAllDay || isTodo;
  const isDueReminder = ev.is_due_reminder;

  let bg = done ? (isSolidBlock ? "linear-gradient(rgba(0,0,0,0.04), rgba(0,0,0,0.04)), var(--bms-surface)" : "transparent") : (isSolidBlock ? `linear-gradient(${op.dot}20, ${op.dot}20), var(--bms-surface)` : "transparent");
  let textColor = done ? "var(--bms-text-3)" : "var(--bms-text)";

  if (isDueReminder) {
    bg = done ? "rgba(156,163,175,0.10)" : "#ffe4e6"; // light rose/red background
    textColor = done ? "var(--bms-text-3)" : "#be123c"; // dark rose/red text
  }

  let borderRadius = "4px";
  let isStartSegment = true;
  if (isSolidBlock && cellDate && ev.start_date && ev.end_date && ev.start_date !== ev.end_date) {
    const isStart = cellDate === ev.start_date;
    const isEnd = cellDate === ev.end_date;
    if (isStart) borderRadius = "4px 0 0 4px";
    else if (isEnd) borderRadius = "0 4px 4px 0";
    else borderRadius = "0";
    isStartSegment = isStart;
  } else if (!isSolidBlock) {
    borderRadius = "4px";
  }

  if (isDueReminder) {
    borderRadius = "4px";
  }

  return (
    <button
      type="button"
      className={`gcal-event-chip${compact ? " gcal-event-chip--c" : ""}${done ? " gcal-event-chip--done" : ""}${isTodo && !done ? " gcal-todo-pill" : ""}${isTodo && done ? " gcal-todo-pill gcal-todo-pill--done" : ""}`}
      style={{
        background: bg,
        borderRadius: borderRadius,
        color: textColor,
        position: "relative",
        border: undefined,
        paddingTop: compact ? 1 : 2,
        paddingBottom: compact ? 1 : 2,
        paddingLeft: isTodo ? 6 : undefined,
        paddingRight: isTodo ? 10 : undefined,
        opacity: done ? 0.7 : 1,
      } as React.CSSProperties}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.stopPropagation();
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={time 
        ? `${time} ${title} | ${op.label}${isActive ? " (Active Now)" : ""}${extractCustomColor(ev.source === "todo" ? ev.description : ev.comments).cleanText ? `\n${extractCustomColor(ev.source === "todo" ? ev.description : ev.comments).cleanText}` : ""}` 
        : `${title} | ${op.label}${isActive ? " (Active Now)" : ""}${extractCustomColor(ev.source === "todo" ? ev.description : ev.comments).cleanText ? `\n${extractCustomColor(ev.source === "todo" ? ev.description : ev.comments).cleanText}` : ""}`}
    >
      {/* Dot for non-solid events */}
      {!isSolidBlock && !isTodo && (
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: done ? "var(--bms-border)" : op.dot,
          marginRight: 4, flexShrink: 0,
        }} />
      )}

      {/* Todo tick button */}
      {isTodo && onToggleDone && !(ev as any).is_due_reminder && (
        <span
          className={`gcal-todo-tick${done ? " gcal-todo-tick--done" : ""}`}
          style={{ 
            color: op.dot, 
            marginRight: 4,
            "--tick-bg": done ? op.dot : "#fff",
            "--tick-check": "#fff",
            "--tick-hover-bg": op.dot,
            "--tick-hover-check": "#fff"
          } as React.CSSProperties}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(ev);
          }}
          title={done ? "Mark as open" : "Mark as done"}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onToggleDone(ev);
            }
          }}
        >
          <svg className="gcal-todo-tick-checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </span>
      )}

      {time && <span className="gcal-ec-time" style={{ fontWeight: 500, marginRight: 4, color: "#3c4043" }}>{time}</span>}
      <span
        className={`gcal-ec-title ${done ? "gcal-todo-strikethrough gcal-todo-strikethrough--active" : ""}`}
        style={{ color: textColor, fontWeight: 500 }}
      >
        {title}
      </span>

    </button>
  );
}

