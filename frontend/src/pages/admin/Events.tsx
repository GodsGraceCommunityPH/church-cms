import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, ClipboardCheck, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { useAuth } from "../../features/auth/auth";
import { EVENT_STATUS_LABELS, registrationAvailability, type ChurchEvent } from "../../features/events/event";
import { getEvents } from "../../features/events/eventService";

type Sort = "soonest" | "latest" | "az" | "recent";
export default function Events() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("events.manage");
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [registration, setRegistration] = useState("all");
  const [sort, setSort] = useState<Sort>("soonest");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setEvents(await getEvents()); } catch { setError("Events could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const today = new Date().toISOString().slice(0, 10);
  const active = events.filter((event) => !event.archivedAt);
  const visible = useMemo(() => events
    .filter((event) => status === "archived" ? Boolean(event.archivedAt) : status === "active" ? !event.archivedAt : event.status === status)
    .filter((event) => !search.trim() || `${event.name} ${event.location} ${event.description}`.toLowerCase().includes(search.toLowerCase()))
    .filter((event) => registration === "all" || registrationAvailability(event).code === registration)
    .sort((a, b) => sort === "latest" ? b.eventDate.localeCompare(a.eventDate) : sort === "az" ? a.name.localeCompare(b.name) : sort === "recent" ? b.createdAt.localeCompare(a.createdAt) : a.eventDate.localeCompare(b.eventDate)), [events, registration, search, sort, status]);
  const registered = active.reduce((count, event) => count + event.registrations.filter((item) => item.status === "registered").length, 0);
  return <div className="events-page">
    <header className="events-header"><div><h1>Events</h1><p>Create events, collect registrations, and manage event-day check-in.</p></div>{canManage && <Button to="/admin/events/new">Add Event</Button>}</header>
    <section className="events-summary"><div><CalendarClock /><span>Upcoming Events<strong>{active.filter((event) => event.eventDate >= today && ["draft", "published"].includes(event.status)).length}</strong></span></div><div><CalendarCheck /><span>Open Registration<strong>{active.filter((event) => registrationAvailability(event).open).length}</strong></span></div><div><ClipboardCheck /><span>Total Registrations<strong>{registered}</strong></span></div><div><History /><span>Completed Events<strong>{active.filter((event) => event.status === "completed").length}</strong></span></div></section>
    <section className="events-panel"><div className="events-toolbar"><Input aria-label="Search events" placeholder="Search events..." value={search} onChange={(event) => setSearch(event.target.value)} /><Select aria-label="Event status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">All Active</option>{Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select aria-label="Registration status" value={registration} onChange={(event) => setRegistration(event.target.value)}><option value="all">All Registration States</option><option value="open">Registration Open</option><option value="closed">Registration Closed</option><option value="full">Registration Full</option><option value="disabled">Registration Disabled</option></Select><Select aria-label="Sort events" value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="soonest">Event Date: Soonest</option><option value="latest">Event Date: Latest</option><option value="az">A–Z</option><option value="recent">Recently Created</option></Select></div>
      {error && <div className="events-error">{error}<button onClick={() => void load()}>Try again</button></div>}
      {loading ? <p className="events-state">Loading events...</p> : visible.length === 0 ? <div className="events-state"><CalendarCheck size={38} /><strong>{events.length ? "No events match these filters." : "No events yet."}</strong>{canManage && !events.length && <Button to="/admin/events/new">Create First Event</Button>}</div> : <div className="events-list">{visible.map((event) => {
        const availability = registrationAvailability(event);
        const count = availability.count;
        const openEvent = () => navigate(`/admin/events/${event.id}`);
        return <article key={event.id} tabIndex={0} role="link" onClick={openEvent} onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") { keyboardEvent.preventDefault(); openEvent(); } }}><div><span className={`event-badge event-badge-${event.status}`}>{EVENT_STATUS_LABELS[event.status]}</span><h2>{event.name}</h2><p>{new Date(`${event.eventDate}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "long" })} · {event.location}</p></div><div><span className={`event-registration-state event-registration-${availability.code}`}>{availability.label}</span><strong>{event.capacity ? `${count} / ${event.capacity}` : count} Registered</strong></div></article>;
      })}</div>}
    </section>
  </div>;
}
