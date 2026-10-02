import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  format, parse, startOfWeek, endOfWeek, getDay,
  startOfMonth, endOfMonth, addMonths, subMonths,
  addWeeks, subWeeks, addDays, subDays
} from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  CheckCircle2, AlertTriangle, FileText, Clock,
} from "lucide-react";
import { getCalendarEvents } from "../services/electronService";
import SubpageHeader from "./layout/SubpageHeader";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/CalendarPage.css";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// ── Event type config ──────────────────────────────────────────────────────

const EVENT_TYPE_META = {
  "note-created":    { label: "Note Created",   className: "cal-event-note-created", Icon: FileText },
  "note-updated":    { label: "Note Updated",   className: "cal-event-note-updated", Icon: FileText },
  "task-due":        { label: "Task Due",        className: "cal-event-task-due",     Icon: Clock },
  "task-scheduled":  { label: "Task Scheduled", className: "cal-event-task-sched",   Icon: Clock },
  "task-completed":  { label: "Task Completed", className: "cal-event-task-done",    Icon: CheckCircle2 },
  "task-overdue":    { label: "Task Overdue",   className: "cal-event-task-overdue", Icon: AlertTriangle },
};

function parseEventDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Pure date YYYY-MM-DD -> local midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-").map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function buildRbcEvents(rawResult) {
  const events = [];

  let taskList = [];
  let noteList = [];

  if (Array.isArray(rawResult)) {
    for (const item of rawResult) {
      if (item.type?.startsWith("note") || item._eventType?.startsWith("note")) {
        noteList.push(item);
      } else {
        taskList.push(item);
      }
    }
  } else if (rawResult && typeof rawResult === "object") {
    taskList = Array.isArray(rawResult.taskEvents) ? rawResult.taskEvents : (Array.isArray(rawResult.tasks) ? rawResult.tasks : []);
    noteList = Array.isArray(rawResult.noteEvents) ? rawResult.noteEvents : (Array.isArray(rawResult.notes) ? rawResult.notes : []);
    if (!taskList.length && !noteList.length && Array.isArray(rawResult.events)) {
      for (const item of rawResult.events) {
        if (item.type?.startsWith("note") || item._eventType?.startsWith("note")) noteList.push(item);
        else taskList.push(item);
      }
    }
  }

  for (const task of taskList) {
    const type = task.type || task._eventType || (task.due_date ? "task-due" : "task-scheduled");
    const meta = EVENT_TYPE_META[type] ?? EVENT_TYPE_META["task-due"];

    const rawStart = task.start || task.scheduled_start || task.due_date || task.completed_at || task.created_at;
    const start = parseEventDate(rawStart);
    if (!start) continue;

    const rawEnd = task.end || task.scheduled_end;
    let end = parseEventDate(rawEnd);
    if (!end || end < start) {
      end = task.allDay ? start : new Date(start.getTime() + 30 * 60000);
    }

    const isAllDay = task.allDay !== undefined
      ? Boolean(task.allDay)
      : typeof rawStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawStart.trim());

    events.push({
      id: task.id || `task-${Math.random()}`,
      title: task.title || "Task",
      start,
      end,
      allDay: isAllDay,
      resource: { ...task, _eventType: type },
      className: meta.className,
    });
  }

  for (const note of noteList) {
    const type = note.type || note._eventType || "note-updated";
    const rawStart = note.start || note.updatedAt || note.created_at || note.createdAt || note.mtime;
    const start = parseEventDate(rawStart);
    if (!start) continue;

    const rawEnd = note.end;
    const end = parseEventDate(rawEnd) || (note.allDay ? start : new Date(start.getTime() + 30 * 60000));
    const meta = EVENT_TYPE_META[type] ?? EVENT_TYPE_META["note-updated"];

    const isAllDay = note.allDay !== undefined
      ? Boolean(note.allDay)
      : typeof rawStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawStart.trim());

    events.push({
      id: note.id || `note-${Math.random()}`,
      title: note.title || "Note",
      start,
      end,
      allDay: isAllDay,
      resource: { ...note, _eventType: type },
      className: meta.className,
    });
  }

  return events;
}

function EventTypeToggle({ type, active, onToggle }) {
  const meta = EVENT_TYPE_META[type];
  if (!meta) return null;
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      className={`cal-filter-btn${active ? " active" : ""} ${meta.className}`}
      onClick={() => onToggle(type)}
      title={meta.label}
    >
      <Icon size={12} />
      {meta.label}
    </button>
  );
}

function EventCard({ event, onOpenNote, onOpenTask, onClose }) {
  const type = event.resource?._eventType ?? "";
  const meta = EVENT_TYPE_META[type] ?? {};
  const Icon = meta.Icon ?? CalendarIcon;
  const task = type?.startsWith("task") ? event.resource : null;
  const note = type?.startsWith("note") ? event.resource : null;
  const notePath = note?.filePath || note?.sourcePath;
  const taskPath = task?.source_path || task?.sourcePath;

  return (
    <div className="cal-event-popup" role="dialog" aria-label="Event details">
      <div className="cal-event-popup-header">
        <span className={`cal-event-popup-type ${meta.className || ""}`}><Icon size={12} /> {meta.label || type}</span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="cal-event-popup-title">{event.title}</div>
      {event.start && (
        <div className="cal-event-popup-time">
          {event.allDay ? format(event.start, "MMM d, yyyy") : format(event.start, "MMM d, yyyy 'at' h:mm a")}
          {event.end && !event.allDay && event.end.getTime() !== event.start.getTime() && ` – ${format(event.end, "h:mm a")}`}
        </div>
      )}
      {task?.status && (
        <div className="cal-event-popup-meta" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
          <span>Status: <strong>{task.status}</strong></span>
          {task.priority ? <span style={{ marginLeft: "8px" }}>Priority: P{task.priority}</span> : null}
        </div>
      )}
      <div className="cal-event-popup-actions">
        {task && onOpenTask && (
          <button type="button" className="app-button secondary" onClick={() => { onOpenTask(task); onClose(); }}>
            <CheckCircle2 size={12} /> View Task
          </button>
        )}
        {notePath && onOpenNote && (
          <button type="button" className="app-button secondary" onClick={() => { onOpenNote(notePath); onClose(); }}>
            <FileText size={12} /> Open Note
          </button>
        )}
        {taskPath && !notePath && onOpenNote && (
          <button type="button" className="app-button secondary" onClick={() => { onOpenNote(taskPath); onClose(); }}>
            <FileText size={12} /> Source Note
          </button>
        )}
      </div>
    </div>
  );
}

export function CalendarPage({ onBack, onOpenNote, onOpenTask }) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const [activeFilters, setActiveFilters] = useState(new Set(Object.keys(EVENT_TYPE_META)));
  const [error, setError] = useState(null);

  const loadEvents = useCallback(async (currentDate) => {
    setLoading(true);
    setError(null);
    try {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      // Pad a week on each side so the calendar grid edges are covered
      const padStart = new Date(start.getTime() - 7 * 24 * 60 * 60000);
      const padEnd   = new Date(end.getTime()   + 7 * 24 * 60 * 60000);
      const result = await getCalendarEvents(
        format(padStart, "yyyy-MM-dd"),
        format(padEnd,   "yyyy-MM-dd")
      );
      const built = buildRbcEvents(result);
      setEvents(built);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEvents(date); }, [date, loadEvents]);

  const toggleFilter = useCallback(type => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }, []);

  const visibleEvents = events.filter(e => activeFilters.has(e.resource?._eventType));

  const handleSelectEvent = useCallback((event, syntheticEvent) => {
    const rect = syntheticEvent?.target?.getBoundingClientRect?.();
    if (rect) {
      setPopupPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 320) });
    } else {
      setPopupPos({ top: 120, left: 80 });
    }
    setSelectedEvent(event);
  }, []);

  const eventPropGetter = useCallback(event => ({
    className: `cal-rbc-event ${event.className ?? ""}`,
  }), []);

  const handleSelectSlot = useCallback((slotInfo) => {
    if (slotInfo?.start && onOpenTask) {
      const dateStr = format(slotInfo.start, "yyyy-MM-dd");
      onOpenTask({ due_date: dateStr, scheduled_start: slotInfo.start.toISOString() });
    }
  }, [onOpenTask]);

  const handlePrev = useCallback(() => {
    setDate(d => {
      if (view === "day") return subDays(d, 1);
      if (view === "week") return subWeeks(d, 1);
      return subMonths(d, 1);
    });
  }, [view]);

  const handleNext = useCallback(() => {
    setDate(d => {
      if (view === "day") return addDays(d, 1);
      if (view === "week") return addWeeks(d, 1);
      return addMonths(d, 1);
    });
  }, [view]);

  const dateTitle = useMemo(() => {
    if (view === "day") return format(date, "MMMM d, yyyy");
    if (view === "week") {
      const sw = startOfWeek(date);
      const ew = endOfWeek(date);
      return `${format(sw, "MMM d")} – ${format(ew, "MMM d, yyyy")}`;
    }
    return format(date, "MMMM yyyy");
  }, [date, view]);

  return (
    <div className="calendar-page">
      <SubpageHeader
        currentTitle="Calendar"
        breadcrumbParent="Workspace"
        onBack={onBack}
        actions={
          <>
            {/* Date Navigator */}
            <div className="cal-header-month-nav">
              <button className="cal-nav-btn icon-button" type="button" onClick={handlePrev} data-tooltip="Previous" aria-label="Previous">
                <ChevronLeft size={14} />
              </button>
              <span className="cal-month-title">{dateTitle}</span>
              <button className="cal-nav-btn icon-button" type="button" onClick={handleNext} data-tooltip="Next" aria-label="Next">
                <ChevronRight size={14} />
              </button>
              <button className="cal-nav-today" type="button" onClick={() => setDate(new Date())}>Today</button>
            </div>

            <div className="topbar-stat-pill">
              <CalendarIcon size={12} />
              <span>{visibleEvents.length} events</span>
            </div>

            {/* View mode toggle: Month vs Week vs Day */}
            <div className="tab-bar cal-view-toggle-tabbar" role="tablist">
              {["month", "week", "day"].map(v => (
                <button
                  key={v}
                  type="button"
                  className={`tab-item${view === v ? " active" : ""}`}
                  onClick={() => setView(v)}
                  role="tab"
                  aria-selected={view === v}
                >
                  <span>{v.charAt(0).toUpperCase() + v.slice(1)}</span>
                </button>
              ))}
            </div>
          </>
        }
      />

      {/* Filter bar */}
      <div className="calendar-filters">
        {Object.keys(EVENT_TYPE_META).map(type => (
          <EventTypeToggle key={type} type={type} active={activeFilters.has(type)} onToggle={toggleFilter} />
        ))}
        {loading && <span className="cal-loading-hint">Loading…</span>}
      </div>

      {/* Calendar */}
      <div className="calendar-body">
        {error && <div className="cal-error">{error}</div>}
        <Calendar
          localizer={localizer}
          events={visibleEvents}
          date={date}
          view={view}
          selectable={true}
          onNavigate={setDate}
          onView={setView}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          eventPropGetter={eventPropGetter}
          toolbar={false}
          popup
          popupOffset={10}
          style={{ height: "100%" }}
        />
      </div>

      {/* Event popup */}
      {selectedEvent && (
        <>
          <div className="cal-popup-backdrop" onClick={() => setSelectedEvent(null)} />
          <div className="cal-popup-positioner" style={{ top: popupPos.top, left: popupPos.left }}>
            <EventCard
              event={selectedEvent}
              onOpenNote={onOpenNote}
              onOpenTask={onOpenTask}
              onClose={() => setSelectedEvent(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}
