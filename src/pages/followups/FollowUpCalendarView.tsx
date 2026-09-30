import { useMemo, useState } from "react";
import { Button, Segmented, Typography, Empty, Spin } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { FollowUpItem } from "@/services/followups";
import {
  WEEKDAYS, HOUR_START, HOUR_END, HOUR_HEIGHT,
  itemsOnDate, allDayItems, timedItems,
  eventStart, eventEnd, eventColor, eventStartDate, eventEndDate, formatTimeShort,
} from "./followupCalendarUtils";

dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { Text } = Typography;
const BORDER = "1px solid var(--bms-border)";
type CalendarMode = "day" | "week" | "month";

function useHourSlots() {
  return useMemo(() => {
    const h: number[] = [];
    for (let i = HOUR_START; i <= HOUR_END; i++) h.push(i);
    return h;
  }, []);
}

function TimedEventBlock({
  item, onSelect,
}: { item: FollowUpItem; onSelect: (item: FollowUpItem) => void }) {
  const start = eventStart(item);
  const end = eventEnd(item);
  if (!start || !end) return null;

  const topMin = start.hour() * 60 + start.minute() - HOUR_START * 60;
  const durMin = Math.max(end.diff(start, "minute"), 25);
  const top = (topMin / 60) * HOUR_HEIGHT;
  const height = Math.max((durMin / 60) * HOUR_HEIGHT - 2, 22);
  const color = eventColor(item);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      style={{
        position: "absolute",
        left: 4,
        right: 4,
        top: top + 1,
        height,
        border: "none",
        borderRadius: 6,
        padding: "6px 10px",
        textAlign: "left",
        cursor: "pointer",
        background: color,
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        zIndex: 1,
      }}
    >
      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
      <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.95 }}>
        {start.format("h:mm")} – {end.format("h:mm A")}
      </div>
    </button>
  );
}

function HourLabels({ hours }: { hours: number[] }) {
  return (
    <div>
      {hours.map((h) => (
        <div
          key={h}
          style={{
            height: HOUR_HEIGHT,
            fontSize: 10,
            color: "var(--bms-text-3)",
            textAlign: "right",
            paddingRight: 8,
            paddingTop: 2,
            borderTop: h > HOUR_START ? BORDER : undefined,
          }}
        >
          {dayjs().hour(h).minute(0).format("h A")}
        </div>
      ))}
    </div>
  );
}

function EventPill({
  item, compact, onClick, cellDate,
}: { item: FollowUpItem; compact?: boolean; onClick: () => void; cellDate?: string }) {
  const color = eventColor(item);
  const time = item.start_time ? formatTimeShort(item.start_time) : null;

  // Compute border-radius for multi-day spanning
  const startDate = eventStartDate(item);
  const endDate = eventEndDate(item);
  let borderRadius = "4px";
  let paddingLeft = compact ? "6px" : "8px";
  let paddingRight = compact ? "6px" : "8px";
  const isMultiDay = startDate && endDate && !startDate.isSame(endDate, "day");

  if (isMultiDay && cellDate) {
    const isStart = cellDate === item.start_date;
    const isEnd = cellDate === item.end_date;
    if (isStart && !isEnd) {
      borderRadius = "4px 0 0 4px";
      paddingRight = "0px";
    } else if (isEnd && !isStart) {
      borderRadius = "0 4px 4px 0";
      paddingLeft = "4px";
    } else if (!isStart && !isEnd) {
      borderRadius = "0";
      paddingLeft = "2px";
      paddingRight = "0px";
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={item.title}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        borderRadius,
        padding: compact ? `1px ${paddingRight} 1px ${paddingLeft}` : `2px ${paddingRight} 2px ${paddingLeft}`,
        marginBottom: 2,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        cursor: "pointer",
        background: color,
        color: "#fff",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: compact ? "18px" : "20px",
        boxShadow: isMultiDay ? "none" : undefined,
      }}
    >
      {time && <span style={{ opacity: 0.9, marginRight: 4 }}>{time}</span>}
      {item.title}
    </button>
  );
}

// ─── MonthView helpers ────────────────────────────────────────────────────────

const ROW_HEIGHT = 120;        // total cell height per week row
const DATE_LABEL_H = 30;       // px reserved for the date number at top
const BAR_H = 22;              // height of each event bar
const BAR_GAP = 2;             // vertical gap between bars
const MAX_VISIBLE_BARS = 3;    // max bars before "+N more"

/**
 * One "lane" entry used to lay out spanning bars inside a week row.
 * `colStart` / `colEnd` are 0-based column indices within the 7-day row.
 */
interface BarEntry {
  item: FollowUpItem;
  colStart: number;
  colEnd: number;
  lane: number;        // vertical slot index (0 = top-most)
  isStart: boolean;    // bar starts in this week row
  isEnd: boolean;      // bar ends in this week row
}

/**
 * Given a week row (7 days) and all items, compute BarEntry layout.
 * Multi-day items get a spanning bar; single-day items get a 1-column bar.
 */
function computeWeekBars(week: Dayjs[], items: FollowUpItem[]): BarEntry[] {
  const weekStart = week[0];
  const weekEnd = week[6];

  // Only items that overlap this week row
  const relevant = items.filter((item) => {
    const s = item.start_date ? dayjs(item.start_date) : null;
    const e = item.end_date ? dayjs(item.end_date) : (s ?? null);
    if (!s && !e) return false;
    const effectiveStart = s ?? e!;
    const effectiveEnd = e ?? s!;
    return effectiveStart.isSameOrBefore(weekEnd, "day") && effectiveEnd.isSameOrAfter(weekStart, "day");
  });

  // Sort: multi-day first (longest first), then single-day by start col
  relevant.sort((a, b) => {
    const aS = a.start_date ? dayjs(a.start_date) : dayjs(a.end_date!);
    const aE = a.end_date ? dayjs(a.end_date) : aS;
    const bS = b.start_date ? dayjs(b.start_date) : dayjs(b.end_date!);
    const bE = b.end_date ? dayjs(b.end_date) : bS;
    const aDur = aE.diff(aS, "day");
    const bDur = bE.diff(bS, "day");
    if (bDur !== aDur) return bDur - aDur; // longer first
    return aS.isBefore(bS) ? -1 : 1;
  });

  const lanes: boolean[][] = Array.from({ length: MAX_VISIBLE_BARS + 2 }, () => Array(7).fill(false));
  const entries: BarEntry[] = [];

  for (const item of relevant) {
    const iStart = item.start_date ? dayjs(item.start_date) : null;
    const iEnd = item.end_date ? dayjs(item.end_date) : (iStart ?? null);
    if (!iStart && !iEnd) continue;
    const effectiveStart = iStart ?? iEnd!;
    const effectiveEnd = iEnd ?? iStart!;

    // Clamp to this week row
    const clampedStart = effectiveStart.isBefore(weekStart, "day") ? weekStart : effectiveStart;
    const clampedEnd = effectiveEnd.isAfter(weekEnd, "day") ? weekEnd : effectiveEnd;

    const colStart = clampedStart.day(); // 0=Sun
    const colEnd = clampedEnd.day();

    // Find a free lane across all columns this bar occupies
    let lane = -1;
    for (let l = 0; l < lanes.length; l++) {
      let free = true;
      for (let c = colStart; c <= colEnd; c++) {
        if (lanes[l][c]) { free = false; break; }
      }
      if (free) { lane = l; break; }
    }
    if (lane === -1) continue; // shouldn't happen

    // Mark lanes as occupied
    for (let c = colStart; c <= colEnd; c++) lanes[lane][c] = true;

    entries.push({
      item,
      colStart,
      colEnd,
      lane,
      isStart: effectiveStart.isSameOrAfter(weekStart, "day"),
      isEnd: effectiveEnd.isSameOrBefore(weekEnd, "day"),
    });
  }

  return entries;
}

/**
 * For "+N more" — count how many bars land in each column beyond MAX_VISIBLE_BARS.
 */
function overflowPerColumn(bars: BarEntry[]): number[] {
  const counts = Array(7).fill(0);
  for (const bar of bars) {
    if (bar.lane >= MAX_VISIBLE_BARS) {
      for (let c = bar.colStart; c <= bar.colEnd; c++) counts[c]++;
    }
  }
  return counts;
}

function MonthView({
  cursor, items, onSelect,
}: { cursor: Dayjs; items: FollowUpItem[]; onSelect: (item: FollowUpItem) => void }) {
  const weeks = useMemo(() => {
    const start = cursor.startOf("month").startOf("week");
    const end = cursor.endOf("month").endOf("week");
    const days: Dayjs[] = [];
    let d = start;
    while (d.isBefore(end) || d.isSame(end, "day")) {
      days.push(d);
      d = d.add(1, "day");
    }
    const rows: Dayjs[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const today = dayjs();

  return (
    <div style={{ border: BORDER, borderRadius: 8, overflow: "hidden", background: "var(--bms-surface)" }}>
      {/* Weekday header */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        borderBottom: BORDER, background: "var(--bms-surface-2)",
      }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--bms-text-2)", letterSpacing: "0.05em" }}>
            {w.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        const bars = computeWeekBars(week, items);
        const overflow = overflowPerColumn(bars);
        const visibleBars = bars.filter((b) => b.lane < MAX_VISIBLE_BARS);

        return (
          <div
            key={wi}
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              minHeight: ROW_HEIGHT,
              borderBottom: wi < weeks.length - 1 ? BORDER : undefined,
            }}
          >
            {/* Cell backgrounds + date numbers */}
            {week.map((day) => {
              const cellDate = day.format("YYYY-MM-DD");
              const inMonth = day.month() === cursor.month();
              const isToday = day.isSame(today, "day");
              return (
                <div
                  key={cellDate}
                  style={{
                    borderRight: day.day() < 6 ? BORDER : undefined,
                    padding: "4px 0 0",
                    background: inMonth ? "var(--bms-surface)" : "var(--bms-surface-2)",
                    opacity: inMonth ? 1 : 0.55,
                    minWidth: 0,
                    minHeight: ROW_HEIGHT,
                  }}
                >
                  {/* Date number */}
                  <div style={{ textAlign: "right", paddingRight: 6, height: DATE_LABEL_H, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 26, height: 26, borderRadius: "50%",
                      fontSize: 12, fontWeight: isToday ? 700 : 400,
                      background: isToday ? "var(--bms-primary)" : "transparent",
                      color: isToday ? "#fff" : inMonth ? "var(--bms-text)" : "var(--bms-text-3)",
                    }}>
                      {day.date()}
                    </span>
                  </div>

                  {/* +N more label */}
                  {overflow[day.day()] > 0 && (
                    <div style={{
                      position: "absolute",
                      bottom: 4,
                      left: `calc(${day.day()} * (100% / 7) + 4px)`,
                      width: `calc(100% / 7 - 8px)`,
                      fontSize: 11,
                      color: "var(--bms-text-2)",
                      fontWeight: 500,
                      cursor: "default",
                    }}>
                      +{overflow[day.day()]} more
                    </div>
                  )}
                </div>
              );
            })}

            {/* Spanning bars — absolutely positioned over the grid */}
            {visibleBars.map((bar) => {
              const colCount = bar.colEnd - bar.colStart + 1;
              const top = DATE_LABEL_H + bar.lane * (BAR_H + BAR_GAP);
              const color = eventColor(bar.item);
              // left/width as percentages of the 7-column row
              const leftPct = (bar.colStart / 7) * 100;
              const widthPct = (colCount / 7) * 100;

              const borderRadius = bar.isStart && bar.isEnd
                ? 4
                : bar.isStart
                  ? "4px 0 0 4px"
                  : bar.isEnd
                    ? "0 4px 4px 0"
                    : 0;

              // Small inset so bars don't touch cell borders
              const leftInset = bar.isStart ? 3 : 0;
              const rightInset = bar.isEnd ? 3 : 0;

              return (
                <button
                  key={`${bar.item.id}-${bar.colStart}`}
                  type="button"
                  title={bar.item.title}
                  onClick={(e) => { e.stopPropagation(); onSelect(bar.item); }}
                  style={{
                    position: "absolute",
                    top,
                    left: `calc(${leftPct}% + ${leftInset}px)`,
                    width: `calc(${widthPct}% - ${leftInset + rightInset}px)`,
                    height: BAR_H,
                    background: color,
                    color: "#fff",
                    border: "none",
                    borderRadius,
                    padding: "0 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    zIndex: 2,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    lineHeight: `${BAR_H}px`,
                  }}
                >
                  {/* Show title only on the start cell (or first visible cell of a continued bar) */}
                  {bar.isStart ? bar.item.title : (bar.colStart === 0 ? `↪ ${bar.item.title}` : "")}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  cursor, items, onSelect,
}: { cursor: Dayjs; items: FollowUpItem[]; onSelect: (item: FollowUpItem) => void }) {
  const today = dayjs();
  const isToday = cursor.isSame(today, "day");
  const hours = useHourSlots();
  const allDay = allDayItems(items, cursor);
  const timed = timedItems(items, cursor);

  return (
    <div style={{ border: BORDER, borderRadius: 8, overflow: "hidden", background: "var(--bms-surface)" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "56px 1fr",
        borderBottom: BORDER, background: "var(--bms-surface-2)",
      }}>
        <div />
        <div style={{ padding: "12px 16px", borderLeft: BORDER }}>
          <div style={{ fontSize: 11, color: isToday ? "var(--bms-primary)" : "var(--bms-text-3)", fontWeight: 600, letterSpacing: 0.5 }}>
            {WEEKDAYS[cursor.day()].toUpperCase()}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 48, height: 48, borderRadius: "50%", marginTop: 6,
            fontSize: 28, fontWeight: isToday ? 500 : 400, lineHeight: 1,
            background: isToday ? "var(--bms-primary)" : "transparent",
            color: isToday ? "#fff" : "var(--bms-text)",
          }}>
            {cursor.date()}
          </div>
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "56px 1fr",
        borderBottom: BORDER, minHeight: allDay.length ? 36 : 28,
      }}>
        <div style={{ fontSize: 10, color: "var(--bms-text-3)", padding: "8px 4px", textAlign: "right" }}>all-day</div>
        <div style={{ borderLeft: BORDER, padding: "4px 8px" }}>
          {allDay.map((item) => (
            <EventPill key={item.id} item={item} onClick={() => onSelect(item)} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", maxHeight: 640, overflowY: "auto" }}>
        <HourLabels hours={hours} />
        <div style={{ position: "relative", borderLeft: BORDER }}>
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT, borderTop: h > HOUR_START ? BORDER : undefined }} />
          ))}
          {timed.map((item) => (
            <TimedEventBlock key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekView({
  cursor, items, onSelect,
}: { cursor: Dayjs; items: FollowUpItem[]; onSelect: (item: FollowUpItem) => void }) {
  const weekStart = cursor.startOf("week");
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")), [weekStart]);
  const today = dayjs();
  const hours = useHourSlots();

  return (
    <div style={{ border: BORDER, borderRadius: 8, overflow: "hidden", background: "var(--bms-surface)" }}>
      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", borderBottom: BORDER, background: "var(--bms-surface-2)" }}>
        <div />
        {days.map((day) => {
          const isToday = day.isSame(today, "day");
          const cellDate = day.format("YYYY-MM-DD");
          return (
            <div key={cellDate} style={{ padding: "8px 4px", textAlign: "center", borderLeft: BORDER }}>
              <div style={{ fontSize: 11, color: "var(--bms-text-3)", fontWeight: 500 }}>{WEEKDAYS[day.day()].toUpperCase()}</div>
              <div style={{
                fontSize: 22, fontWeight: isToday ? 500 : 400, lineHeight: 1.2,
                color: isToday ? "var(--bms-primary)" : "var(--bms-text)",
              }}>
                {day.date()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", borderBottom: BORDER, minHeight: 28 }}>
        <div style={{ fontSize: 10, color: "var(--bms-text-3)", padding: "6px 4px", textAlign: "right" }}>all-day</div>
        {days.map((day) => {
          const cellDate = day.format("YYYY-MM-DD");
          return (
            <div key={`allday-${cellDate}`} style={{ borderLeft: BORDER, padding: "2px 4px" }}>
              {allDayItems(items, day).map((item) => (
                <EventPill key={item.id} item={item} compact onClick={() => onSelect(item)} cellDate={cellDate} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", maxHeight: 520, overflowY: "auto" }}>
        <HourLabels hours={hours} />
        {days.map((day) => (
          <div key={`grid-${day.format()}`} style={{ position: "relative", borderLeft: BORDER }}>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT, borderTop: h > HOUR_START ? BORDER : undefined }} />
            ))}
            {timedItems(items, day).map((item) => (
              <TimedEventBlock key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FollowUpCalendarView({
  items, loading, onSelect,
}: {
  items: FollowUpItem[];
  loading?: boolean;
  onSelect: (item: FollowUpItem) => void;
}) {
  const [cursor, setCursor] = useState(() => dayjs());
  const [mode, setMode] = useState<CalendarMode>("month");

  // Items that have at least a start_date or end_date (for calendar display)
  const scheduled = useMemo(() => {
    const now = dayjs();
    return items.filter((i) => {
      if (!i.start_date && !i.end_date) return false;
      const slug = (i.workflow_state_slug || "").toLowerCase();
      if (slug === "completed" || slug === "done") {
        if (i.updated_at) {
          const hoursAgo = now.diff(dayjs(i.updated_at), "hour", true);
          if (hoursAgo > 2) return false;
        }
      }
      return true;
    });
  }, [items]);

  const title = mode === "month"
    ? cursor.format("MMMM YYYY")
    : mode === "week"
      ? `${cursor.startOf("week").format("MMM D")} – ${cursor.endOf("week").format("MMM D, YYYY")}`
      : cursor.format("dddd, MMMM D, YYYY");

  const goToday = () => setCursor(dayjs());
  const goPrev = () => setCursor((c) => {
    if (mode === "month") return c.subtract(1, "month");
    if (mode === "week") return c.subtract(1, "week");
    return c.subtract(1, "day");
  });
  const goNext = () => setCursor((c) => {
    if (mode === "month") return c.add(1, "month");
    if (mode === "week") return c.add(1, "week");
    return c.add(1, "day");
  });

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button onClick={goToday} style={{ borderRadius: 20, fontWeight: 500 }}>Today</Button>
          <Button type="text" icon={<LeftOutlined />} onClick={goPrev} />
          <Button type="text" icon={<RightOutlined />} onClick={goNext} />
          <span style={{ fontSize: 20, fontWeight: 400, color: "var(--bms-text)", marginLeft: 4 }}>{title}</span>
        </div>
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as CalendarMode)}
          options={[
            { label: "Day", value: "day" },
            { label: "Week", value: "week" },
            { label: "Month", value: "month" },
          ]}
        />
      </div>

      {scheduled.length === 0 ? (
        <Empty description="No scheduled follow-ups — add a date range to appear on the calendar" />
      ) : mode === "month" ? (
        <MonthView cursor={cursor} items={scheduled} onSelect={onSelect} />
      ) : mode === "week" ? (
        <WeekView cursor={cursor} items={scheduled} onSelect={onSelect} />
      ) : (
        <DayView cursor={cursor} items={scheduled} onSelect={onSelect} />
      )}

      <Text type="secondary" style={{ display: "block", marginTop: 12, fontSize: 12 }}>
        Click an event to view full details. Colors reflect priority. Multi-day events show as spanning bars.
      </Text>
    </div>
  );
}
