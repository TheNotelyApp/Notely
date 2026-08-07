import React, { useState, useEffect, useCallback } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  CheckCircle2, AlertTriangle, FileText, Clock,
} from "lucide-react";
import { getCalendarEvents } from "../services/electronService";
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

function buildRbcEvents(taskEvents, noteEvents) {
  const events = [];

  for (const task of taskEvents) {
    const meta = EVENT_TYPE_META[task._eventType] ?? EVENT_TYPE_META["task-due"];
    const start = task.scheduled_start
      ? new Date(task.scheduled_start)
      : task.due_date
        ? new Date(task.due_date + "T00:00:00")
        : null;
    if (!start) continue;
    const end = task.scheduled_end ? new Date(task.scheduled_end) : new Date(start.getTime() + 60 * 60000);
    events.push({
      id: `task-${task.id}`,
      title: task.title || "Task",
      start,
      end,
      allDay: task.is_all_day || !task.scheduled_start,
      resource: { ...task, _eventType: task._eventType },
      className: meta.className,
    });
  }

  for (const note of noteEvents) {
    if (!note.createdAt) continue;
    const start = new Date(note.createdAt);
    const end = new Date(start.getTime() + 30 * 60000);
    const meta = EVENT_TYPE_META[note._eventType] ?? EVENT_TYPE_META["note-updated"];
    events.push({
      id: note.id,
      title: note.title || "Note",
      start,
      end,
      allDay: false,
      resource: { ...note, _eventType: note._eventType },
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

  return (
    <div className="cal-event-popup" role="dialog" aria-label="Event details">
      <div className="cal-event-popup-header">
        <span className={`cal-event-popup-type ${meta.className}`}><Icon size={12} /> {meta.label}</span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="cal-event-popup-title">{event.title}</div>
      {event.start && (
        <div className="cal-event-popup-time">
          {event.allDay ? format(event.start, "MMM d, yyyy") : format(event.start, "MMM d, yyyy 'at' h:mm a")}
          {event.end && !event.allDay && ` – ${format(event.end, "h:mm a")}`}
        </div>
      )}
      <div className="cal-event-popup-actions">
        {task && (
          <button type="button" className="app-button secondary" onClick={() => { onOpenTask?.(task); onClose(); }}>
            <CheckCircle2 size={12} /> View Task
          </button>
        )}
        {note && (
          <button type="button" className="app-button secondary" onClick={() => { onOpenNote?.(note.filePath); onClose(); }}>
            <FileText size={12} /> Open Note
          </button>
        )}
        {task?.source_path && (
          <button type="button" className="app-button secondary" onClick={() => { onOpenNote?.(task.source_path); onClose(); }}>
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
      const built = buildRbcEvents(result.taskEvents ?? [], result.noteEvents ?? []);
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

  return (
    <div className="calendar-page">
      {/* Header */}
      <div className="calendar-header">
        <button className="task-back-btn" type="button" onClick={onBack} aria-label="Back to notes">
          <ArrowLeft size={16} />
        </button>
        <div className="calendar-header-title">
          <CalendarIcon size={18} />
          <div>
            <span>Calendar</span>
            <span style={{ fontSize: "var(--font-size-meta)", color: "var(--text-muted)", display: "block", fontWeight: 500 }}>
              {format(date, "MMMM yyyy")}
            </span>
          </div>
        </div>
        <div className="calendar-header-nav">
          <button className="cal-nav-btn" type="button" onClick={() => setDate(d => subMonths(d, 1))} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button className="cal-nav-today" type="button" onClick={() => setDate(new Date())}>Today</button>
          <button className="cal-nav-btn" type="button" onClick={() => setDate(d => addMonths(d, 1))} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span className="task-truth-badge" style={{ fontSize: "var(--font-size-caption)" }}>
            {visibleEvents.length} event{visibleEvents.length !== 1 ? "s" : ""}
          </span>
          <div className="calendar-header-view-btns">
            {["month", "week", "day"].map(v => (
              <button
                key={v}
                type="button"
                className={`cal-view-btn${view === v ? " active" : ""}`}
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

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
          onNavigate={setDate}
          onView={setView}
          onSelectEvent={handleSelectEvent}
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
