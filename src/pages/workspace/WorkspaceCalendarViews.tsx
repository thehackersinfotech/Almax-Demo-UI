import { useState, useMemo, useEffect, useRef } from "react";
import { Empty, Popover, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import type { WorkspaceCalendarEvent } from "@/services/workspace";
import { operationStyle, eventTitle, isDone, extractCustomColor } from "./workspaceCalendarTheme";
import { isPastDate } from "./workspaceDateRules";
import {
  WEEKDAYS, WEEKDAYS_SHORT, HOUR_START, HOUR_HEIGHT,
  timedEvents, eventStart, eventEnd, groupEventsByDate,
  hourSlots, monthGrid, weekRows, formatEventTime, layoutTimedEventsForDay,
  earliestEventMinutes,
} from "./workspaceCalendarUtils";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const BORDER = "1px solid var(--gcal-border, var(--bms-border))";

// Time Constants
const HOUR_END = 23;

function useCalendarHover() {
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  useEffect(() => {
    let ticking = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const elements = document.elementsFromPoint(e.clientX, e.clientY);
          let topEventId = null;
          let maxZ = -1;
          for (const el of elements) {
            if (el.classList.contains('gcal-event-block')) {
              const z = parseInt(el.getAttribute('data-original-z') || '0', 10);
              if (z > maxZ) {
                maxZ = z;
                topEventId = el.getAttribute('data-event-id');
              }
            }
          }
          setHoveredEventId((prev) => (prev !== topEventId ? topEventId : prev));
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleMouseLeave = () => setHoveredEventId(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return hoveredEventId;
}

/**
 * Day/Week grids render the full 24h span but start scrolled to 12 AM by default,
 * so events later in the day are invisible until the user manually scrolls down.
 * Scroll to just before the earliest timed event (or the current time / a sensible
 * default when there's nothing to anchor to) whenever the visible date range changes.
 */
function useAutoScrollToRelevantTime(events: WorkspaceCalendarEvent[], isTodayVisible: boolean, dateKey: string) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const earliest = earliestEventMinutes(events);
    let targetMinutes: number;
    if (earliest !== null) {
      targetMinutes = Math.max(0, earliest - 60);
    } else if (isTodayVisible) {
      const now = dayjs();
      targetMinutes = Math.max(0, now.hour() * 60 + now.minute() - 120);
    } else {
      targetMinutes = 7 * 60;
    }
    el.scrollTop = (targetMinutes / 60) * HOUR_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, events.length]);

  return ref;
}

function CurrentTimeIndicator({ topOffset = 0 }: { topOffset?: number } = {}) {
  const [time, setTime] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(dayjs());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const hour = time.hour();
  if (hour < HOUR_START || hour >= HOUR_END) return null;
  const minutes = (hour - HOUR_START) * 60 + time.minute();
  const top = (minutes / 60) * HOUR_HEIGHT + topOffset;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        height: "2px",
        background: "#ea4335",
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -4,
          top: -4,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#ea4335",
        }}
      />
    </div>
  );
}

export interface CalendarInteractionProps {
  today: Dayjs;
  onSelect: (ev: WorkspaceCalendarEvent) => void;
  onAdd: (date: string) => void;
  /** Month view: single-click selects day without leaving month view. */
  onDaySelect?: (date: string) => void;
  /** Month view: double-click opens day view for that date. */
  onDayOpen?: (date: string) => void;
  canScheduleOnDate?: (date: string) => boolean;
  draggingEvent?: WorkspaceCalendarEvent | null;
  canDragEvents?: boolean;
  onEventDragStart?: (ev: WorkspaceCalendarEvent) => void;
  onEventDragEnd?: () => void;
  onDayDrop?: (date: string) => void;
  dropTargetDate?: string | null;
  onDayDragEnter?: (date: string) => void;
  onDayDragLeave?: () => void;
  onToggleDone?: (ev: WorkspaceCalendarEvent) => void;
}

function TimedBlocks({
  events,
  date,
  onSelect,
  onToggleDone,
  topOffset = 0,
}: {
  events: WorkspaceCalendarEvent[];
  date: Dayjs;
  onSelect: (ev: WorkspaceCalendarEvent) => void;
  onToggleDone?: (ev: WorkspaceCalendarEvent) => void;
  topOffset?: number;
}) {
  const layouts = useMemo(() => layoutTimedEventsForDay(events, date), [events, date]);
  const hoveredEventId = useCalendarHover();

  return (
    <>
      {layouts.map(({ id, ev, top, height, col, totalCols, isStart, isEnd }) => {
        const start = eventStart(ev);
        const end = eventEnd(ev);
        if (!start || !end) return null;
        const done = isDone(ev);
        const isTodo = ev.source === "todo";
        const op = operationStyle(ev);
        const leftPct = (col / totalCols) * 100;
        const widthPct = 100 / totalCols;

        const startStr = start.minute() === 0 ? start.format("h") : start.format("h:mm");
        const endStr = end.minute() === 0 ? end.format("ha") : end.format("h:mma");

        const customStr = ev.source === "todo" ? ev.description : ev.comments;
        const cleanDesc = customStr ? extractCustomColor(customStr).cleanText : "";

        return (
          <button
            key={id}
            type="button"
            className={`gcal-timed-block${done ? " gcal-timed-block--done" : ""}${isTodo ? " gcal-todo-pill" : ""}`}
            onClick={() => onSelect(ev)}
            style={{
              top: top + 1 + topOffset,
              height,
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
              border: `1px solid ${op.border}`,
              borderRadius: 8,
              background: done ? "rgba(0,0,0,0.04)" : op.dot,
              color: done ? "var(--bms-text-3)" : "#fff",
              paddingLeft: isTodo ? 22 : 5,
              zIndex: col + 1,
            } as React.CSSProperties}
            title={`${eventTitle(ev)} · ${start.format("h:mm")} – ${end.format("h:mm A")}${cleanDesc ? `\n\nDescription: ${cleanDesc}` : ""}`}
          >
            {/* Tick button for timed blocks - To-Dos only */}
            {isTodo && onToggleDone && isStart && !ev.is_due_reminder && (
              <span
                className={`gcal-todo-tick gcal-todo-tick--timed${done ? " gcal-todo-tick--done" : ""}`}
                style={{ 
                  color: done ? "var(--bms-text-3)" : op.dot,
                  "--tick-bg": "#fff",
                  "--tick-check": op.dot,
                  "--tick-hover-bg": "#fff",
                  "--tick-hover-check": op.dot
                } as React.CSSProperties}
                onClick={(e) => { e.stopPropagation(); onToggleDone(ev); }}
                title={done ? "Mark as open (undo)" : "Mark as done"}
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
            {isStart && (
              <>
                <div className={`gcal-timed-block__title ${done ? "gcal-todo-strikethrough gcal-todo-strikethrough--active" : ""}`}>
                  {height <= 32 && <span style={{ fontWeight: 400, opacity: 0.85, marginRight: 4 }}>{startStr}</span>}
                  {eventTitle(ev)}
                </div>
                {height > 32 && (
                  <div className="gcal-timed-block__time" style={{ opacity: 0.85 }}>{startStr} – {endStr}</div>
                )}
              </>
            )}
          </button>
        );
      })}
    </>
  );
}

function HourLabels({ hours }: { hours: number[] }) {
  return (
    <div style={{ paddingTop: 16 }}>
      {hours.map((h) => (
        <div key={h} style={{
          height: HOUR_HEIGHT, fontSize: 11, color: "#70757a", textAlign: "right",
          paddingRight: 8, position: "relative"
        }}>
          <span style={{ position: "absolute", right: 8, top: -8, fontWeight: 500 }}>
            {dayjs().hour(h).minute(0).format("h A")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CalendarDayView({
  cursor, events, today, onSelect, onAdd, canScheduleOnDate,
  canDragEvents, onEventDragStart, onEventDragEnd, onToggleDone,
}: {
  cursor: Dayjs;
  events: WorkspaceCalendarEvent[];
} & CalendarInteractionProps) {
  const isToday = cursor.isSame(today, "day");
  const hours = hourSlots();
  const timed = timedEvents(events, cursor);
  const scrollRef = useAutoScrollToRelevantTime(timed, isToday, cursor.format("YYYY-MM-DD"));

  return (
    <div ref={scrollRef} className="gcal-view-panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bms-surface)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", borderBottom: BORDER }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: "0 4px 16px", fontSize: 10, color: "#70757a", fontWeight: 500, whiteSpace: "nowrap" }}>
            GMT{dayjs().format('Z')}
          </div>
        <div style={{ padding: "8px 4px", textAlign: "center", borderLeft: BORDER }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#70757a", textTransform: "uppercase" }}>
            {WEEKDAYS[cursor.day()]}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 46, height: 46, borderRadius: "50%", marginTop: 4,
            fontSize: 26, fontWeight: isToday ? 500 : 400,
            background: isToday ? "var(--gcal-blue)" : "transparent", color: isToday ? "#fff" : "#3c4043",
            fontFamily: "'Google Sans', 'Inter', system-ui"
          }}>
            {cursor.date()}
          </div>
        </div>
      </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", paddingTop: 0, flex: 1 }}>
        <HourLabels hours={hours} />
        <div className="gcal-day-column" style={{ paddingTop: 16 }}>
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT, borderTop: h > HOUR_START ? BORDER : undefined }} />
          ))}
          <TimedBlocks events={timed} date={cursor} onSelect={onSelect} onToggleDone={onToggleDone} topOffset={16} />
          {isToday && <CurrentTimeIndicator topOffset={16} />}
        </div>
      </div>
    </div>
  );
}

export function CalendarWeekView({
  cursor, events, today, onSelect, onAdd, canScheduleOnDate,
  canDragEvents, draggingEvent, onEventDragStart, onEventDragEnd, onToggleDone,
}: {
  cursor: Dayjs;
  events: WorkspaceCalendarEvent[];
} & CalendarInteractionProps) {
  const weekStart = cursor.startOf("week");
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")), [weekStart]);
  const hours = hourSlots();
  const isTodayInWeek = days.some((day) => day.isSame(today, "day"));
  const scrollRef = useAutoScrollToRelevantTime(events, isTodayInWeek, weekStart.format("YYYY-MM-DD"));

  return (
    <div ref={scrollRef} className="gcal-view-panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bms-surface)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)", borderBottom: BORDER }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: "0 4px 16px", fontSize: 10, color: "#70757a", fontWeight: 500, whiteSpace: "nowrap" }}>
            GMT{dayjs().format('Z')}
          </div>
        {days.map((day) => {
          const isToday = day.isSame(today, "day");
          return (
            <div key={day.format()} style={{ padding: "8px 4px", textAlign: "center", borderLeft: BORDER }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#70757a", textTransform: "uppercase" }}>{WEEKDAYS[day.day()]}</div>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 46, height: 46, borderRadius: "50%", marginTop: 4,
                fontSize: 26, fontWeight: isToday ? 500 : 400,
                background: isToday ? "var(--gcal-blue)" : "transparent",
                color: isToday ? "#fff" : "#3c4043",
                fontFamily: "'Google Sans', 'Inter', system-ui"
              }}>
                {day.date()}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)", paddingTop: 0, flex: 1 }}>
        <HourLabels hours={hours} />
        {days.map((day) => {
          const isDayToday = day.isSame(today, "day");
          return (
            <div key={`grid-${day.format()}`} className="gcal-day-column" style={{ paddingTop: 16 }}>
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_HEIGHT, borderTop: h > HOUR_START ? BORDER : undefined }} />
              ))}
              <TimedBlocks
                events={timedEvents(events, day)}
                date={day}
                onSelect={onSelect}
                onToggleDone={onToggleDone}
                topOffset={16}
              />
              {isDayToday && <CurrentTimeIndicator topOffset={16} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MonthView spanning bar helpers ──────────────────────────────────────────

const ROW_H = 160;
const DATE_H = 34;
const BAR_H = 22;
const BAR_GAP = 2;
const MAX_BARS = 4;

interface MonthBar {
  ev: WorkspaceCalendarEvent;
  colStart: number;
  colEnd: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
}

function buildWeekBars(week: Dayjs[], events: WorkspaceCalendarEvent[]): MonthBar[] {
  const weekStart = week[0];
  const weekEnd = week[6];

  const relevant = events.filter((ev) => {
    const s = ev.start_date ? dayjs(ev.start_date) : null;
    const e = ev.end_date ? dayjs(ev.end_date) : (s ?? null);
    if (!s && !e) return false;
    const effStart = s ?? e!;
    const effEnd = e ?? s!;
    return effStart.isSameOrBefore(weekEnd, "day") && effEnd.isSameOrAfter(weekStart, "day");
  });

  // Sort: multi-day first (longest first), then by start
  relevant.sort((a, b) => {
    const aS = a.start_date ? dayjs(a.start_date) : dayjs(a.end_date!);
    const aE = a.end_date ? dayjs(a.end_date) : aS;
    const bS = b.start_date ? dayjs(b.start_date) : dayjs(b.end_date!);
    const bE = b.end_date ? dayjs(b.end_date) : bS;
    const aDur = aE.diff(aS, "day");
    const bDur = bE.diff(bS, "day");
    if (bDur !== aDur) return bDur - aDur;
    return aS.isBefore(bS) ? -1 : 1;
  });

  const lanes: boolean[][] = Array.from({ length: MAX_BARS + 4 }, () => Array(7).fill(false));
  const bars: MonthBar[] = [];

  for (const ev of relevant) {
    const iS = ev.start_date ? dayjs(ev.start_date) : null;
    const iE = ev.end_date ? dayjs(ev.end_date) : (iS ?? null);
    if (!iS && !iE) continue;
    const effStart = iS ?? iE!;
    const effEnd = iE ?? iS!;

    const clampedStart = effStart.isBefore(weekStart, "day") ? weekStart : effStart;
    const clampedEnd = effEnd.isAfter(weekEnd, "day") ? weekEnd : effEnd;

    const colStart = clampedStart.day();
    const colEnd = clampedEnd.day();

    let lane = -1;
    for (let l = 0; l < lanes.length; l++) {
      let free = true;
      for (let c = colStart; c <= colEnd; c++) {
        if (lanes[l][c]) { free = false; break; }
      }
      if (free) { lane = l; break; }
    }
    if (lane === -1) continue;

    for (let c = colStart; c <= colEnd; c++) lanes[lane][c] = true;

    bars.push({
      ev,
      colStart,
      colEnd,
      lane,
      isStart: effStart.isSameOrAfter(weekStart, "day"),
      isEnd: effEnd.isSameOrBefore(weekEnd, "day"),
    });
  }

  return bars;
}

function overflowCounts(bars: MonthBar[]): number[] {
  const counts = Array(7).fill(0);
  for (const bar of bars) {
    if (bar.lane >= MAX_BARS) {
      for (let c = bar.colStart; c <= bar.colEnd; c++) counts[c]++;
    }
  }
  return counts;
}

export function CalendarMonthView({
  cursor, events, today, onSelect, onAdd,
  onDaySelect, onDayOpen,
  canScheduleOnDate,
  draggingEvent, canDragEvents, onEventDragStart, onEventDragEnd,
  onDayDrop, dropTargetDate, onDayDragEnter, onDayDragLeave,
  onToggleDone,
}: {
  cursor: Dayjs;
  events: WorkspaceCalendarEvent[];
} & CalendarInteractionProps) {
  const weeks = weekRows(cursor);
  const hoveredEventId = useCalendarHover();

  return (
    <div className="gcal-month-view">
      <div className="gcal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="gcal-weekday">{w}</div>
        ))}
      </div>
      {weeks.map((week) => {
        const bars = buildWeekBars(week, events);
        const overflow = overflowCounts(bars);
        const visibleBars = bars.filter((b) => b.lane < MAX_BARS);

        return (
          <div
            key={week[0].format("YYYY-MM-DD")}
            className="gcal-week"
            style={{ position: "relative", flex: 1, minHeight: 120 }}
          >            {/* Cell backgrounds + date numbers */}
            {week.map((day) => {
              const key = day.format("YYYY-MM-DD");
              const inMonth = day.month() === cursor.month();
              const isToday = day.isSame(today, "day");
              const isSelected = day.isSame(cursor, "day");
              const isPast = isPastDate(day);
              const isWeekend = day.day() === 0 || day.day() === 6;
              const canAdd = !isPast && (canScheduleOnDate?.(key) ?? true);
              const canDrop = Boolean(draggingEvent && canAdd);
              const isDropTarget = dropTargetDate === key && canDrop;

              const dayEvents = events.filter(
                (ev) => ev.start_date === key || ev.end_date === key || (!ev.end_date && ev.due_date === key)
              );
              const hiddenEvents = dayEvents.filter(
                (ev) => bars.findIndex(
                  (b) => b.ev.source === ev.source && b.ev.id === ev.id && b.lane >= MAX_BARS
                ) >= 0
              );

              return (
                <div
                  key={key}
                  className={[
                    "gcal-day",
                    !inMonth && "gcal-day--out",
                    isPast && "gcal-day--past",
                    isDropTarget && "gcal-day--drop",
                    isSelected && "gcal-day--selected",
                    isWeekend && inMonth && "gcal-day--weekend",
                    isToday && inMonth && "gcal-day--today-highlight",
                  ].filter(Boolean).join(" ")}
                  style={{ flex: 1, minHeight: 120 }}
                  onClick={() => onDaySelect?.(key)}
                  onDoubleClick={() => onDayOpen?.(key)}
                  onDragOver={(e) => { if (canDrop) { e.preventDefault(); onDayDragEnter?.(key); } }}
                  onDragLeave={() => onDayDragLeave?.()}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (canDrop) onDayDrop?.(key); }}
                  role="presentation"
                >
                  <div className="gcal-day-num-wrap" style={{ height: DATE_H, position: "relative" }}>
                    <span className={[
                      "gcal-day-num",
                      isToday && "gcal-day-num--today",
                      isSelected && !isToday && "gcal-day-num--sel",
                      !inMonth && "gcal-day-num--out",
                    ].filter(Boolean).join(" ")}>
                      {day.date() === 1 ? day.format("D MMM") : day.date()}
                    </span>
                    {canAdd && (
                      <button
                        type="button"
                        className="gcal-day-add-btn"
                        onClick={(e) => { e.stopPropagation(); onAdd?.(key); }}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 2,
                          width: 24,
                          height: 24,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "var(--bms-text-3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                        }}
                      >
                        <PlusOutlined style={{ fontSize: 12 }} />
                      </button>
                    )}
                  </div>

                  {/* +N exceeded count badge -> click opens Day View */}
                  {overflow[day.day()] > 0 && (
                    <button
                      type="button"
                      className="gcal-more"
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: 6,
                        right: 6,
                        width: "calc(100% - 12px)",
                        textAlign: "center",
                        cursor: "pointer",
                        zIndex: 10,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDayOpen?.(key);
                      }}
                      title={`View ${day.format("MMMM D")} in Day View`}
                    >
                      +{overflow[day.day()]}
                    </button>
                  )}
                </div>
              );
            })}

            {/* Spanning bars — absolutely positioned over the row — Google Calendar style */}
            {visibleBars.map((bar) => {
              const op = operationStyle(bar.ev);
              const colCount = bar.colEnd - bar.colStart + 1;
              const top = DATE_H + bar.lane * (BAR_H + BAR_GAP);
              const leftPct = (bar.colStart / 7) * 100;
              const widthPct = (colCount / 7) * 100;
              const leftInset = bar.isStart ? 3 : 0;
              const rightInset = bar.isEnd ? 3 : 0;
              const isMultiDay = bar.colEnd > bar.colStart || !bar.isStart || !bar.isEnd;

              // Rounded corners:
              // - Start + end same cell (single): 6px all
              // - Start of multi-day: left-rounded
              // - Middle: no rounding
              // - End of multi-day: right-rounded
              const borderRadius = isMultiDay
                ? `${bar.isStart ? "6px" : "0"} ${bar.isEnd ? "6px" : "0"} ${bar.isEnd ? "6px" : "0"} ${bar.isStart ? "6px" : "0"}`
                : "6px";

              const start = eventStart(bar.ev);
              const end = eventEnd(bar.ev);
              const done = isDone(bar.ev);
              const isTodo = bar.ev.source === "todo";
              const hasAssignee = Boolean(bar.ev.assignee_name);
              const time = formatEventTime(bar.ev.start_time);
              const title = eventTitle(bar.ev);

              // Solid colors with white text
              const barBg = bar.ev.is_due_reminder
                ? (done ? "rgba(156,163,175,0.15)" : "#ffe4e6")
                : (done ? "rgba(0,0,0,0.08)" : op.dot);
              const barColor = bar.ev.is_due_reminder
                ? (done ? "var(--bms-text-3)" : "#be123c")
                : (done ? "var(--bms-text-3)" : "#fff");

              return (
                <button
                  key={`${bar.ev.source}-${bar.ev.id}-${bar.colStart}`}
                  type="button"
                  draggable={Boolean(canDragEvents) && !done}
                  onDragStart={(e) => {
                    if (!canDragEvents || done) return;
                    e.stopPropagation();
                    onEventDragStart?.(bar.ev);
                  }}
                  onDragEnd={() => onEventDragEnd?.()}
                  onClick={(e) => { e.stopPropagation(); onSelect(bar.ev); }}
                  title={title}
                  className={`${isTodo && !isMultiDay ? (done ? "gcal-todo-pill gcal-todo-pill--done" : "gcal-todo-pill") : ""}`}
                  style={{
                    position: "absolute",
                    top,
                    left: `calc(${leftPct}% + ${leftInset}px)`,
                    width: `calc(${widthPct}% - ${leftInset + rightInset}px)`,
                    height: BAR_H,
                    background: barBg,
                    color: barColor,
                    border: isMultiDay ? "none" : `1px solid ${done ? "var(--bms-border)" : op.dot}30`,
                    borderRadius,
                    padding: "0 10px 0 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    zIndex: hoveredEventId === bar.ev.id ? 100 : 10 + bar.lane,
                    lineHeight: `${BAR_H}px`,
                    boxShadow: isMultiDay ? "0 1px 3px rgba(0,0,0,0.18)" : (isTodo ? "0 1px 3px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.06)"),
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    opacity: done ? 0.65 : 1,
                  } as React.CSSProperties}
                >

                  {/* Tick button for month bars - To-Dos only */}
                  {isTodo && onToggleDone && !bar.ev.is_due_reminder && (
                    <span 
                      className={`gcal-todo-tick${done ? " gcal-todo-tick--done" : ""} ${bar.ev.is_due_reminder ? "gcal-todo-tick--schedule" : "gcal-todo-tick--bar"}`}
                      style={{
                        marginRight: 6,
                        color: bar.ev.is_due_reminder ? "#be123c" : (done ? "var(--bms-text-3)" : "#fff"),
                        "--tick-bg": "#fff",
                        "--tick-check": op.dot,
                        "--tick-hover-bg": "#fff",
                        "--tick-hover-check": op.dot,
                      } as React.CSSProperties}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleDone) {
                          onToggleDone(bar.ev);
                        }
                      }}
                      title={done ? "Mark as open (undo)" : "Mark as done"}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          onToggleDone(bar.ev);
                        }
                      }}
                    >
                      <svg className="gcal-todo-tick-checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </span>
                  )}

                  {bar.isStart
                    ? (
                      <>
                        {time && <span style={{ opacity: 0.9, marginRight: 4, fontSize: 11, fontWeight: 600 }}>{time}</span>}
                        <span className={done ? "gcal-todo-strikethrough gcal-todo-strikethrough--active" : ""} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontWeight: 600, color: bar.ev.is_due_reminder ? "#be123c" : (done ? "var(--bms-text-3)" : "#fff") }}>
                          {title}
                        </span>

                      </>
                    )
                    : (bar.colStart === 0 ? `↪ ${title}` : "")}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function CalendarYearView({
  cursor, events, today, onSelectDay,
}: {
  cursor: Dayjs;
  events: WorkspaceCalendarEvent[];
  today: Dayjs;
  onSelectDay: (day: Dayjs) => void;
}) {
  const year = cursor.year();
  const eventDates = useMemo(() => new Set(events.map((e) => e.due_date).filter(Boolean)), [events]);

  return (
    <div className="gcal-year-grid">
      {Array.from({ length: 12 }, (_, m) => {
        const monthStart = dayjs().year(year).month(m).startOf("month");
        const days = monthGrid(monthStart);
        return (
          <div key={m} className="gcal-year-month">
            <div className="gcal-year-month-title">{monthStart.format("MMMM")}</div>
            <div className="gcal-year-weekdays">
              {WEEKDAYS_SHORT.map((w, i) => <span key={`${m}-${i}`}>{w}</span>)}
            </div>
            <div className="gcal-year-days">
              {days.map((d) => {
                const inMonth = d.month() === m;
                const isToday = d.isSame(today, "day");
                const hasEvents = eventDates.has(d.format("YYYY-MM-DD"));
                return (
                  <button
                    key={d.format("YYYY-MM-DD")}
                    type="button"
                    className={[
                      "gcal-year-day",
                      !inMonth && "gcal-year-day--out",
                      isToday && "gcal-year-day--today",
                      hasEvents && inMonth && "gcal-year-day--dot",
                    ].filter(Boolean).join(" ")}
                    onClick={() => onSelectDay(d)}
                  >
                    {d.date()}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CalendarScheduleView({
  events, onSelect, onToggleDone,
}: {
  events: WorkspaceCalendarEvent[];
  onSelect: (ev: WorkspaceCalendarEvent) => void;
  onToggleDone?: (ev: WorkspaceCalendarEvent) => void;
}) {
  const groups = groupEventsByDate(events);
  if (groups.length === 0) {
    return <Empty description="No upcoming events" style={{ padding: 48 }} />;
  }

  return (
    <div className="gcal-schedule">
      {groups.map(({ date, items }) => (
        <div key={date} className="gcal-schedule-day">
          <div className="gcal-schedule-date">
            <div className="gcal-schedule-dow">{dayjs(date).format("ddd").toUpperCase()}</div>
            <div className="gcal-schedule-num">{dayjs(date).date()}</div>
          </div>
          <div className="gcal-schedule-events">
            {items.map((ev) => {
              const op = operationStyle(ev);
              const time = formatEventTime(ev.start_time);
              const done = isDone(ev);
              const isTodo = ev.source === "todo";
              const isDueReminder = ev.is_due_reminder;
              return (
                <button
                  key={`${ev.source}-${ev.id}`}
                  type="button"
                  className="gcal-schedule-row"
                  onClick={() => onSelect(ev)}
                >
                  <div className="gcal-schedule-time">{time ?? "All day"}</div>
                  <div
                    className={`gcal-schedule-card${isTodo && done ? " gcal-todo-pill--done" : ""}${isTodo && !done && !isDueReminder ? " gcal-todo-pill" : ""}`}
                    style={{
                      background: isDueReminder ? "#ffe4e6" : (done ? "rgba(0,0,0,0.03)" : op.dot),
                      border: `1px solid ${isDueReminder ? "#fecdd3" : (done ? "var(--bms-border)" : op.dot)}`,
                      borderRadius: 4,
                      padding: isTodo && !isDueReminder ? "8px 14px 8px 10px" : "10px 12px",
                      color: isDueReminder ? "#be123c" : (done ? "var(--bms-text-3)" : "#fff"),
                      opacity: done ? 0.75 : 1,
                    }}
                  >
                    {/* Tick button in schedule view - To-Dos only */}
                    {isTodo && onToggleDone && !isDueReminder && (
                      <span
                        className={`gcal-todo-tick gcal-todo-tick--schedule${done ? " gcal-todo-tick--done" : ""}`}
                        style={{ 
                          color: done ? "var(--bms-text-3)" : op.dot, 
                          flexShrink: 0,
                          "--tick-bg": "#fff",
                          "--tick-check": op.dot,
                          "--tick-hover-bg": "#fff",
                          "--tick-hover-check": op.dot
                        } as React.CSSProperties}
                        onClick={(e) => { e.stopPropagation(); onToggleDone(ev); }}
                        title={done ? "Mark as open (undo)" : "Mark as done"}
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
                    {!isDueReminder && (
                      <span
                        className="gcal-event-dot"
                        style={{ background: done ? "var(--bms-border)" : op.dot }}
                      />
                    )}
                    <div>
                      <div className={done ? "gcal-todo-strikethrough gcal-todo-strikethrough--active" : ""} style={{
                        fontWeight: 600,
                        color: isDueReminder ? "#be123c" : (done ? "var(--bms-text-3)" : "#fff"),
                        fontSize: 13,
                        fontFamily: "'Google Sans', 'Inter', system-ui",
                      }}>
                        {eventTitle(ev)}
                      </div>
                      <div style={{ fontSize: 11, color: isDueReminder ? "#be123c" : (done ? "var(--bms-text-3)" : "rgba(255,255,255,0.75)") }}>
                        {op.label}{ev.assignee_name ? ` · ${ev.assignee_name}` : ""}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
