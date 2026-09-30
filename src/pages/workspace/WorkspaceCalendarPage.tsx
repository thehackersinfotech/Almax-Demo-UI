import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Spin, Typography, Modal, Tag, Tooltip, message, Popover,
} from "antd";
import {
  LeftOutlined, RightOutlined, PlusOutlined,
  CalendarOutlined, SearchOutlined, FilterOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { workspaceApi, type WorkspaceCalendarEvent } from "@/services/workspace";
import { todoApi } from "@/services/todos";
import { followUpApi } from "@/services/followups";
import { meetingApi } from "@/services/meetings";
import { apiErrorMsg } from "@/utils/apiError";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";
import "./workspaceCalendar.css";
import {
  type CalendarViewMode, VIEW_OPTIONS,
  dateRangeForView, titleForView, navigateCursor, formatEventTime,
} from "./workspaceCalendarUtils";
import {
  CALENDAR_FILTER_KEYS,
  OPERATIONS,
  eventMatchesFilters,
  operationStyle,
  extractCustomColor,
} from "./workspaceCalendarTheme";
import {
  CalendarDayView, CalendarWeekView, CalendarMonthView,
  CalendarYearView, CalendarScheduleView,
} from "./WorkspaceCalendarViews";
import { canScheduleOnDate, isPastDate } from "./workspaceDateRules";
import EventCreateModal from "./EventCreateModal";

const { Text } = Typography;

const G = {
  border: "var(--bms-border)",
  text: "var(--bms-text)",
  textMuted: "var(--bms-text-2)",
  textLight: "var(--bms-text-3)",
  blue: "var(--bms-primary)",
  bg: "var(--bms-bg)",
  rowMinH: 100,
};

function renderWithLinks(text: string) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    return part;
  });
}



export default function WorkspaceCalendarPage({
  embedded = false,
  onEmbeddedClose,
}: {
  embedded?: boolean;
  onEmbeddedClose?: () => void;
} = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const permissions = useAuthStore((s) => s.permissions);
  const canCreateTodo = permissions.length === 0 || permissions.includes(PERMS.CRM_FOLLOWUP_CREATE as never);
  const canCreateFollowup = permissions.length === 0 || permissions.includes(PERMS.CRM_FOLLOWUP_CREATE as never);
  const canCreateMeeting = permissions.length === 0 || permissions.includes(PERMS.CRM_MEETING_CREATE as never);
  const canUpdate = permissions.length === 0 || permissions.includes(PERMS.CRM_FOLLOWUP_UPDATE as never) || permissions.includes(PERMS.CRM_MEETING_UPDATE as never);
  const canAddEvent = canCreateTodo || canCreateFollowup || canCreateMeeting || true;

  const [cursor, setCursor] = useState(() => dayjs());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selected, setSelected] = useState<WorkspaceCalendarEvent | null>(null);
  const [eventCreateOpen, setEventCreateOpen] = useState(false);
  const [eventCreateDate, setEventCreateDate] = useState<string | null>(null);
  const [visibleOps, setVisibleOps] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CALENDAR_FILTER_KEYS.map((k) => [k, true])),
  );
  const [onlyAssigned, setOnlyAssigned] = useState(true);
  const [draggingEvent, setDraggingEvent] = useState<WorkspaceCalendarEvent | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const range = useMemo(() => dateRangeForView(cursor, viewMode), [cursor, viewMode]);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-calendar", viewMode, range.from, range.to],
    queryFn: () => workspaceApi.calendar(range.from, range.to),
    staleTime: 30_000,
  });

  const { user } = useAuthStore();

  const filteredEvents = useMemo(() => {
    let list = data?.events ?? [];
    const now = dayjs();
    
    // Filter out completed items older than 2 hours
    list = list.filter((ev) => {
      const slug = (ev.workflow_state_slug || "").toLowerCase();
      if (slug === "completed" || slug === "done") {
        if (ev.updated_at) {
          const hoursAgo = now.diff(dayjs(ev.updated_at), "hour", true);
          if (hoursAgo > 2) return false;
        }
      }
      return true;
    });
    
    // Transform events based on rules
    list = list.flatMap((ev) => {
      const start = ev.start_date;
      const end = ev.source === "todo" ? (ev.due_date || ev.end_date) : ev.end_date;
      const hasBothTimes = ev.start_time && ev.end_time;
      
      if (ev.source === "todo" && start && end && start !== end) {
        // Create the Start task (normal event)
        const startEvent = {
          ...ev,
          end_date: start, // Ensure it doesn't span multiple days
          due_date: undefined, 
        };
        
        // Create the Due reminder
        const dueEvent = {
          ...ev,
          id: `${ev.id}-due`,
          title: `Due: ${ev.title}`,
          start_date: end,
          end_date: end,
          start_time: null, // Due reminders are usually all-day
          end_time: null,
          is_due_reminder: true,
        };
        
        return [startEvent, dueEvent];
      } else if (ev.source === "todo" && start && end && start === end) {
        // If they are the same, just show once, ensure end_date is not extending
        return [{ ...ev, end_date: start }];
      }
      
      return [ev];
    });

    if (onlyAssigned && user) {
      list = list.filter((ev) => {
        if (!ev.assignee_name) return false;
        const assigneeNames = ev.assignee_name.toLowerCase().split(",").map((name) => name.trim());
        return assigneeNames.includes(user.full_name.toLowerCase());
      });
    }
    return list.filter((ev) => eventMatchesFilters(ev, visibleOps));
  }, [data?.events, visibleOps, onlyAssigned, user]);

  const today = dayjs();
  const viewLabel = VIEW_OPTIONS.find((v) => v.key === viewMode)?.label ?? "Month";

  const activeFilterCount = CALENDAR_FILTER_KEYS.filter((k) => visibleOps[k] === false).length;

  const openEventCreate = useCallback((date?: string | null) => {
    setEventCreateDate(date ?? null);
    setEventCreateOpen(true);
  }, []);

  const defaultCreateDate = useMemo(() => {
    const candidates = [
      viewMode === "day" ? cursor.format("YYYY-MM-DD") : null,
      today.format("YYYY-MM-DD"),
    ].filter(Boolean) as string[];
    return candidates.find((d) => !isPastDate(d)) ?? today.format("YYYY-MM-DD");
  }, [cursor, viewMode, today]);

  const handleDayClick = useCallback((date: string) => {
    if (isPastDate(date)) return;
    if (!canAddEvent) return;
    openEventCreate(date);
  }, [canAddEvent, openEventCreate]);

  const rescheduleMutation = useMutation({
    mutationFn: async ({ ev, newDate }: { ev: WorkspaceCalendarEvent; newDate: string }) => {
      if (ev.source === "todo") {
        await todoApi.update(ev.id, { due_date: newDate });
      } else {
        await followUpApi.update(ev.id, { start_date: newDate, end_date: newDate });
      }
    },
    onSuccess: () => {
      message.success("Moved to new date");
      qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
      qc.invalidateQueries({ queryKey: ["todos-board"] });
      qc.invalidateQueries({ queryKey: ["todos-list"] });
      qc.invalidateQueries({ queryKey: ["followups-board"] });
      qc.invalidateQueries({ queryKey: ["followups-list"] });
      setDraggingEvent(null);
      setDropTargetDate(null);
    },
    onError: () => message.error("Could not reschedule — check permissions or date"),
    onSettled: () => {
      setDraggingEvent(null);
      setDropTargetDate(null);
    },
  });

  const toggleDoneMutation = useMutation({
    mutationFn: async (ev: WorkspaceCalendarEvent) => {
      const slug = ev.workflow_state_slug?.toLowerCase() ?? "";
      const isDoneNow = slug === "done" || slug === "completed" || slug === "closed" || slug === "cancelled";

      if (ev.source === "todo") {
        const destination = isDoneNow ? "open" : "done";
        await todoApi.transition(ev.id, destination);
      } else if (ev.source === "meeting") {
        const destination = isDoneNow ? "planning" : "completed";
        await meetingApi.transition(ev.id, destination);
      } else {
        const destination = isDoneNow ? "planning" : "completed";
        await followUpApi.transition(ev.id, destination);
      }
    },
    onSuccess: () => {
      message.success("Status updated");
      qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
      qc.invalidateQueries({ queryKey: ["todos-board"] });
      qc.invalidateQueries({ queryKey: ["todos-list"] });
      qc.invalidateQueries({ queryKey: ["followups-board"] });
      qc.invalidateQueries({ queryKey: ["followups-list"] });
      qc.invalidateQueries({ queryKey: ["meetings-board"] });
      qc.invalidateQueries({ queryKey: ["meetings-list"] });
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Could not update status")),
  });

  const handleToggleDone = useCallback((ev: WorkspaceCalendarEvent) => {
    if (!canUpdate) return;
    toggleDoneMutation.mutate(ev);
  }, [canUpdate, toggleDoneMutation]);

  const handleDayDrop = useCallback((date: string) => {
    if (!draggingEvent || !canUpdate || !canScheduleOnDate(date)) return;
    if (draggingEvent.due_date === date) {
      setDraggingEvent(null);
      setDropTargetDate(null);
      return;
    }
    rescheduleMutation.mutate({ ev: draggingEvent, newDate: date });
  }, [draggingEvent, canUpdate, rescheduleMutation]);

  const goToDay = useCallback((day: Dayjs) => {
    setCursor(day);
    setViewMode("day");
  }, []);

  const handleDaySelect = useCallback((day: Dayjs) => {
    setCursor(day);
    if (viewMode === "year") setViewMode("month");
  }, [viewMode]);

  const handleMonthDaySelect = useCallback((date: string) => {
    setCursor(dayjs(date));
  }, []);

  const handleMonthDayOpen = useCallback((date: string) => {
    goToDay(dayjs(date));
  }, [goToDay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      const map: Record<string, CalendarViewMode> = { d: "day", w: "week", m: "month", y: "year", a: "schedule" };
      if (map[key]) setViewMode(map[key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const renderView = () => {
    if (isLoading) return <div className="gcal-loading"><Spin size="large" /></div>;

    const calendarProps = {
      cursor,
      events: filteredEvents,
      today,
      onSelect: setSelected,
      onAdd: handleDayClick,
      onDaySelect: handleMonthDaySelect,
      onDayOpen: handleMonthDayOpen,
      canScheduleOnDate,
      draggingEvent,
      canDragEvents: canUpdate,
      onEventDragStart: setDraggingEvent,
      onEventDragEnd: () => { setDraggingEvent(null); setDropTargetDate(null); },
      onDayDrop: handleDayDrop,
      dropTargetDate,
      onDayDragEnter: setDropTargetDate,
      onDayDragLeave: () => setDropTargetDate(null),
      onToggleDone: canUpdate ? handleToggleDone : undefined,
    };

    switch (viewMode) {
      case "day":
        return <CalendarDayView {...calendarProps} />;
      case "week":
        return <CalendarWeekView {...calendarProps} />;
      case "year":
        return (
          <CalendarYearView
            cursor={cursor}
            events={filteredEvents}
            today={today}
            onSelectDay={goToDay}
          />
        );
      case "schedule":
        return <CalendarScheduleView
          events={filteredEvents}
          onSelect={setSelected}
          onToggleDone={canUpdate ? handleToggleDone : undefined}
        />;
      default:
        return <CalendarMonthView {...calendarProps} />;
    }
  };

  return (
    <div className={`gcal-page${embedded ? " gcal-page--embedded" : ""}`}>
      <style>{`
        .gcal-page {
          --gcal-border: #dadce0;
          --gcal-blue: ${G.blue};
          display: flex;
          flex: 1;
          height: 100%;
          min-height: calc(100vh - 112px);
          background: ${G.bg};
          margin: ${embedded ? "0" : "-4px -8px 0"};
          border: 1px solid var(--gcal-border);
          border-radius: 10px;
          overflow: hidden;
          font-family: var(--calendar-font, system-ui, -apple-system, sans-serif);
        }
        .gcal-page--embedded { flex: 1; min-height: 0; }
        .gcal-page--embedded .gcal-grid-wrap { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
        .gcal-page--embedded .gcal-month-view { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
        .gcal-page--embedded .gcal-week { flex: 1; min-height: 72px; }
        .gcal-page--embedded .gcal-day-events { overflow: hidden; }
        .gcal-page--embedded .gcal-grid-wrap--scroll { overflow: auto; display: block; }



        /* ── Main Area ── */
        .gcal-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

        /* ── Toolbar ── */
        .gcal-toolbar {
          display: flex; align-items: center; gap: 8px;
          height: 64px; padding: 8px; border-bottom: none;
          background: var(--bms-surface); flex-wrap: nowrap;
        }
        .gcal-toolbar-group {
          display: flex; align-items: center; gap: 8px; margin-left: 16px;
        }
        .gcal-toolbar-group-btn {
          width: 36px; height: 36px; border: none; border-radius: 50%;
          background: transparent; color: #3c4043; font-size: 16px; font-weight: 500;
          cursor: pointer; transition: background 0.15s;
          display: flex; align-items: center; justify-content: center;
        }
        .gcal-toolbar-group-btn:hover { background: var(--bms-surface-2); }
        .gcal-today-btn {
          height: 36px; padding: 0 16px; border-radius: 4px;
          border: 1px solid var(--gcal-border); background: var(--bms-surface); color: #3c4043;
          font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s;
        }
        .gcal-today-btn:hover { background: var(--bms-surface-2); }
        .gcal-title {
          font-size: 22px; font-weight: 400; color: #3c4043; margin: 0 0 0 12px;
          flex: 1; letter-spacing: 0; padding-left: 0;
          display: flex; align-items: center; gap: 8px; font-family: 'Google Sans', 'Inter', system-ui;
        }
        .gcal-title-icon { color: var(--bms-primary); font-size: 18px; opacity: 0.8; }
        .gcal-icon-action {
          width: 40px; height: 40px; border-radius: 50%;
          border: none; background: transparent;
          cursor: pointer; color: #3c4043; font-size: 18px;
          display: flex; align-items: center; justify-content: center; transition: all 0.15s;
          position: relative;
        }
        .gcal-icon-action:hover { background: var(--bms-surface-2); }
        .gcal-view-pill {
          height: 36px; padding: 0 16px; border-radius: 4px;
          border: 1px solid var(--gcal-border); background: var(--bms-surface); color: #3c4043;
          font-size: 14px; font-weight: 500;
          display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.15s;
        }
        .gcal-view-pill:hover { background: var(--bms-surface-2); }

        /* ── Grid Container ── */
        .gcal-grid-wrap { flex: 1; min-height: 0; overflow: ${embedded ? "hidden" : "auto"}; display: flex; flex-direction: column; }
        .gcal-view-panel { background: var(--bms-surface); flex: 1; display: flex; flex-direction: column; min-height: 0; }

        /* ── Weekday Header ── */
        .gcal-weekdays {
          display: grid; grid-template-columns: repeat(7, 1fr);
          background: var(--bms-surface);
        }
        .gcal-weekday {
          text-align: center; padding: 10px 0 4px;
          font-size: 11px; font-weight: 500; color: #70757a;
          text-transform: uppercase;
        }

        /* ── Month Grid ── */
        .gcal-month-view {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }
        .gcal-week {
          display: grid; grid-template-columns: repeat(7, 1fr);
          flex: 1;
          min-height: 120px;
          border-top: 1px solid var(--gcal-border);
          border-left: 1px solid var(--gcal-border);
        }
        .gcal-week:last-child { border-bottom: 1px solid var(--gcal-border); }
        .gcal-day {
          border-right: 1px solid var(--gcal-border); padding: 0 8px;
          cursor: pointer; background: var(--bms-surface); min-width: 0;
          position: relative; display: flex; flex-direction: column;
        }
        .gcal-day:last-child { border-right: none; }
        .gcal-day:hover { background: var(--bms-surface-2); }
        .gcal-day--past { cursor: pointer; }
        .gcal-day--past.gcal-day--drop,
        .gcal-day--drop { background: rgba(var(--bms-primary-rgb, 26, 115, 232), 0.08); outline: 2px dashed var(--bms-primary); outline-offset: -2px; }
        .gcal-day--out .gcal-day-num { color: #70757a; font-weight: 400; }

        .gcal-day-add-btn {
          opacity: 0;
          transition: opacity 0.15s;
        }
        .gcal-day:hover .gcal-day-add-btn {
          opacity: 1;
        }
        .gcal-day-add-btn:hover {
          background: var(--bms-surface-2) !important;
        }

        /* ── Date Number ── */
        .gcal-day-num-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 34px;
          margin-bottom: 0;
          margin-top: 0;
          box-sizing: border-box;
        }
        .gcal-day-num {
          min-width: 24px;
          height: 24px;
          padding: 0 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 500;
          border-radius: 12px;
          color: #3c4043;
          line-height: 1;
          font-family: 'Google Sans', 'Roboto', 'Inter', system-ui;
        }
        .gcal-day-num--today { background: var(--gcal-blue); color: #fff; font-weight: 500; }



        /* ── Event Chips ── */
        .gcal-event-chip {
          display: flex; align-items: center; gap: 3px; width: 100%;
          border-radius: 4px; padding: 2px 8px 2px 4px; min-height: 22px;
          cursor: pointer; text-align: left; overflow: hidden; border: none;
          transition: opacity 0.15s, transform 0.15s; opacity: 1;
        }
        .gcal-event-chip:hover { transform: translateY(-1px); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .gcal-event-chip--c { min-height: 18px; padding: 1px 6px 1px 4px; }
        .gcal-event-chip--done { opacity: 0.75 !important; border: 1.5px dashed var(--bms-text-3, #9ca3af) !important; background: rgba(156,163,175,0.08) !important; }
        .gcal-ec-time { flex-shrink: 0; font-size: 12px; white-space: nowrap; font-family: 'Google Sans', 'Inter', system-ui; }
        .gcal-ec-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; min-width: 0; flex: 1; font-family: 'Google Sans', 'Inter', system-ui; }
        .gcal-event-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

        /* ── Todo Tick Button (Google Calendar style) ── */
        .gcal-todo-tick {
          display: inline-flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
          border: 1.5px solid currentColor;
          cursor: pointer; background: var(--tick-bg, #fff);
          line-height: 1; user-select: none;
          transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .gcal-todo-tick:hover,
        .gcal-event-chip:hover .gcal-todo-tick,
        .gcal-timed-block:hover .gcal-todo-tick,
        .gcal-month-bar:hover .gcal-todo-tick,
        .gcal-schedule-row:hover .gcal-todo-tick {
          transform: scale(1.15);
          background: var(--tick-hover-bg, currentColor);
        }
        .gcal-todo-tick:active {
          transform: scale(0.92);
        }
        .gcal-todo-tick--done,
        .gcal-event-chip--done .gcal-todo-tick,
        .gcal-timed-block--done .gcal-todo-tick,
        .gcal-month-bar--done .gcal-todo-tick,
        .gcal-schedule-row--done .gcal-todo-tick {
          background: var(--tick-bg, currentColor);
          opacity: 0.9;
        }
        .gcal-todo-tick--done:hover,
        .gcal-event-chip:hover .gcal-todo-tick--done,
        .gcal-timed-block:hover .gcal-todo-tick--done,
        .gcal-month-bar:hover .gcal-todo-tick--done,
        .gcal-schedule-row:hover .gcal-todo-tick--done {
          opacity: 1;
          background: var(--tick-hover-bg, currentColor);
        }
        .gcal-todo-tick-checkmark {
          position: relative;
          z-index: 1;
          width: 70%;
          height: 70%;
          color: var(--tick-check, #fff);
          opacity: 0;
          transform: scale(0) rotate(-45deg);
          transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .gcal-todo-tick--done .gcal-todo-tick-checkmark,
        .gcal-event-chip--done .gcal-todo-tick-checkmark,
        .gcal-timed-block--done .gcal-todo-tick-checkmark,
        .gcal-month-bar--done .gcal-todo-tick-checkmark,
        .gcal-schedule-row--done .gcal-todo-tick-checkmark {
          opacity: 1 !important;
          transform: scale(1) rotate(0deg) !important;
          color: var(--tick-check, #fff) !important;
        }
        .gcal-todo-tick:hover .gcal-todo-tick-checkmark,
        .gcal-event-chip:hover .gcal-todo-tick-checkmark,
        .gcal-timed-block:hover .gcal-todo-tick-checkmark,
        .gcal-month-bar:hover .gcal-todo-tick-checkmark,
        .gcal-schedule-row:hover .gcal-todo-tick-checkmark {
          opacity: 1;
          transform: scale(1) rotate(0deg);
          color: var(--tick-hover-check, #fff);
        }
        .gcal-todo-tick--timed {
          position: absolute; top: 3px; left: 4px;
          width: 16px; height: 16px;
        }
        .gcal-todo-tick--bar {
          width: 16px; height: 16px;
        }
        .gcal-todo-tick--schedule {
          width: 18px; height: 18px;
        }

        /* ── Todo pill card styling ── */
        .gcal-todo-pill {
          position: relative;
          transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .gcal-todo-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06);
        }
        .gcal-todo-pill:active {
          transform: translateY(0px);
        }
        .gcal-todo-pill--done {
          opacity: 0.6;
        }
        .gcal-todo-pill--done:hover {
          opacity: 0.75;
        }

        /* ── Strikethrough animation ── */
        .gcal-todo-strikethrough {
          position: relative;
          display: inline-block;
        }
        .gcal-todo-strikethrough::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 1.5px;
          background: currentColor;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 0.7;
        }
        .gcal-todo-strikethrough--active::after {
          transform: scaleX(1);
        }

        /* ── Assignee Dot ── */
        .gcal-assignee-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
          display: inline-block; background: currentColor;
          opacity: 0.7; margin-left: 2px;
        }
        .gcal-assignee-dot--bar {
          width: 6px; height: 6px;
          background: rgba(255,255,255,0.7);
        }

        /* ── Timed block done state ── */
        .gcal-timed-block--done {
          opacity: 0.75;
          border: 1.5px dashed rgba(156,163,175,0.8) !important;
          background: linear-gradient(rgba(156,163,175,0.10), rgba(156,163,175,0.10)), var(--bms-surface) !important;
        }

        /* ── Day / Week View ── */
        .gcal-day-column {
          position: relative; min-width: 0;
          border-left: 1px solid var(--gcal-border);
        }
        .gcal-timed-block {
          position: absolute; border-radius: 0; padding: 2px 5px;
          text-align: left; cursor: pointer; overflow: hidden; border: none;
          font-size: 13px; font-weight: 500; line-height: 1.25;
          transition: box-shadow 0.15s; box-sizing: border-box;
        }
        .gcal-timed-block:hover, .gcal-month-bar:hover, .gcal-event-chip:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; }
        .gcal-timed-block__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gcal-timed-block__time { font-size: 12px; font-weight: 400; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* ── More Popover ── */
        .gcal-more {
          border: none;
          background: rgba(0, 0, 0, 0.04);
          color: var(--bms-text-2);
          font-size: 10px;
          font-weight: 600;
          padding: 2px 0;
          cursor: pointer;
          text-align: center;
          border-radius: 4px;
          transition: all 0.15s;
          display: block;
        }
        .gcal-more:hover {
          background: color-mix(in srgb, var(--bms-primary) 8%, transparent);
          color: var(--bms-primary);
        }
        .gcal-more-popover-item {
          display: flex; align-items: center; gap: 6px; width: 100%;
          padding: 5px 6px; border-radius: 5px; cursor: pointer; border: none;
          background: transparent; text-align: left; transition: background 0.15s;
          font-size: 11px;
        }
        .gcal-more-popover-item:hover { background: var(--bms-surface-2); }

        .gcal-loading { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 320px; }

        /* ── Year View ── */
        .gcal-year-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 20px 24px; padding: 20px 24px 32px;
        }
        .gcal-year-month-title { font-size: 14px; font-weight: 500; color: ${G.text}; margin-bottom: 8px; }
        .gcal-year-weekdays {
          display: grid; grid-template-columns: repeat(7, 1fr);
          font-size: 10px; color: ${G.textMuted}; text-align: center; margin-bottom: 4px;
        }
        .gcal-year-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; }
        .gcal-year-day {
          width: 24px; height: 24px; margin: 1px auto; border: none; border-radius: 50%;
          background: transparent; font-size: 10px; color: ${G.text}; cursor: pointer;
          position: relative; transition: background 0.15s;
        }
        .gcal-year-day:hover { background: var(--bms-surface-2); }
        .gcal-year-day--out { color: ${G.textLight}; }
        .gcal-year-day--today { background: var(--gcal-blue); color: #fff; font-weight: 500; }
        .gcal-year-day--dot::after {
          content: ""; position: absolute; bottom: 1px; left: 50%; transform: translateX(-50%);
          width: 4px; height: 4px; border-radius: 50%; background: var(--gcal-blue);
        }
        .gcal-year-day--today.gcal-year-day--dot::after { background: #fff; }

        /* ── Schedule View ── */
        .gcal-schedule { padding: 8px 0 24px; }
        .gcal-schedule-day {
          display: flex; gap: 16px; padding: 12px 24px;
          border-bottom: 1px solid var(--gcal-border);
        }
        .gcal-schedule-date { width: 48px; flex-shrink: 0; text-align: center; }
        .gcal-schedule-dow { font-size: 11px; color: ${G.textMuted}; font-weight: 500; }
        .gcal-schedule-num { font-size: 28px; font-weight: 400; color: ${G.text}; line-height: 1.1; }
        .gcal-schedule-events { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .gcal-schedule-row { display: flex; gap: 12px; align-items: flex-start; border: none; background: transparent; cursor: pointer; text-align: left; padding: 0; }
        .gcal-schedule-time { width: 64px; flex-shrink: 0; font-size: 12px; color: ${G.textMuted}; padding-top: 8px; }
        .gcal-schedule-card { flex: 1; display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 0; }

        /* ── Responsive ── */
        @media (max-width: 1100px) { .gcal-year-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 960px) {
          .gcal-page { flex-direction: column; min-height: auto; }
          .gcal-year-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) { .gcal-year-grid { grid-template-columns: 1fr; } }
      `}</style>



      <div className="gcal-main">
        <div className="gcal-toolbar">
          <div className="gcal-toolbar-group">
            <Tooltip title="Previous">
              <button type="button" className="gcal-toolbar-group-btn" onClick={() => setCursor((c) => navigateCursor(c, viewMode, -1))}>
                <LeftOutlined />
              </button>
            </Tooltip>
            <Tooltip title="Next">
              <button type="button" className="gcal-toolbar-group-btn" onClick={() => setCursor((c) => navigateCursor(c, viewMode, 1))}>
                <RightOutlined />
              </button>
            </Tooltip>
          </div>

          <h1 className="gcal-title">
            {titleForView(cursor, viewMode)}
          </h1>

          <Tooltip title="Create event">
            <button
              type="button"
              className="gcal-icon-action"
              style={{ color: "var(--bms-primary)" }}
              disabled={!canAddEvent}
              onClick={() => openEventCreate(defaultCreateDate)}
            >
              <PlusOutlined />
            </button>
          </Tooltip>

          <div className="gcal-view-pills-group" style={{ display: "flex", gap: 4, background: "var(--bms-surface-2)", padding: 4, borderRadius: 20, marginLeft: 8 }}>
            {VIEW_OPTIONS.map((v) => {
              const isActive = viewMode === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setViewMode(v.key)}
                  style={{
                    height: 28,
                    padding: "0 14px",
                    borderRadius: 16,
                    border: "none",
                    background: isActive ? "var(--bms-sidebar-bg)" : "transparent",
                    color: isActive ? "#ffffff" : "var(--bms-text-2)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease-in-out",
                  }}
                  className="gcal-view-pill-btn"
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`gcal-grid-wrap${embedded && viewMode !== "month" ? " gcal-grid-wrap--scroll" : ""}`}>
          {renderView()}
        </div>
      </div>

      <EventCreateModal
        open={eventCreateOpen}
        dueDate={eventCreateDate}
        onClose={() => { setEventCreateOpen(false); setEventCreateDate(null); }}
      />

      <Modal
        open={!!selected}
        title={selected?.title}
        onCancel={() => setSelected(null)}
        footer={selected?.is_due_reminder ? null : [
          <Button key="close" onClick={() => setSelected(null)}>Close</Button>,
          selected && (
            <Button key="open" type="primary" onClick={() => {
              onEmbeddedClose?.();
              navigate(
                selected.source === "todo" 
                  ? `/workspace/todos?id=${selected.id}` 
                  : selected.source === "meeting"
                    ? `/workspace/meetings?id=${selected.id}`
                    : `/workspace/followups?id=${selected.id}`
              );
              setSelected(null);
            }}>Open</Button>
          ),
        ]}
        width={420}
      >
        {selected && (() => {
          const op = operationStyle(selected);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Tag style={{ alignSelf: "flex-start", borderRadius: 6, fontWeight: 600, border: `1px solid ${op.border}`, background: op.bg, color: op.dot }}>
                {op.label}
              </Tag>
              {selected.due_date && (
                <Text><CalendarOutlined style={{ marginRight: 8, color: G.textMuted }} />
                  {dayjs(selected.due_date).format("dddd, DD MMM YYYY")}
                  {selected.start_time && ` · ${formatEventTime(selected.start_time)}`}
                </Text>
              )}
              {selected.assignee_name && <Text type="secondary">Assignee: {selected.assignee_name}</Text>}
              {selected.workflow_state_name && <Text type="secondary">Status: {selected.workflow_state_name}</Text>}
              {extractCustomColor(selected.description).cleanText && (
                <div style={{ marginTop: 4 }}>
                  <Text strong>Description:</Text>
                  <div style={{ fontSize: 13, color: G.textMuted, whiteSpace: "pre-wrap", marginTop: 2 }}>
                    {renderWithLinks(extractCustomColor(selected.description).cleanText)}
                  </div>
                </div>
              )}
              {extractCustomColor(selected.note || selected.comments).cleanText && (
                <div style={{ marginTop: 4 }}>
                  <Text strong>Notes:</Text>
                  <div style={{ fontSize: 13, color: G.textMuted, whiteSpace: "pre-wrap", marginTop: 2 }}>
                    {renderWithLinks(extractCustomColor(selected.note || selected.comments).cleanText)}
                  </div>
                </div>
              )}
              {canUpdate && viewMode === "month" && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tip: drag this event to today or a future date to reschedule.
                </Text>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
