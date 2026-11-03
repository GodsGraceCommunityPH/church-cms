import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead, type Notification } from "../../features/notifications/notificationService";
import { supabase } from "../../lib/supabase";

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    void Promise.all([supabase.auth.getUser(), getNotifications(), getUnreadNotificationCount()]).then(([{ data }, rows, unreadCount]) => {
      if (!live) return;
      setItems(rows);
      setUnread(unreadCount);
      const userId = data.user?.id;
      if (!userId) return;
      channel = supabase.channel(`notifications:${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, (payload) => {
        setItems((current) => {
          const changed = (payload.new ?? payload.old) as Notification;
          if (payload.eventType === "DELETE") return current.filter((item) => item.id !== changed.id);
          return [changed, ...current.filter((item) => item.id !== changed.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100);
        });
        void getUnreadNotificationCount().then(setUnread).catch(() => undefined);
      }).subscribe();
    }).catch(() => undefined);
    const outside = (event: MouseEvent) => { if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { live = false; if (channel) void supabase.removeChannel(channel); document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  async function markAll() {
    const readAt = new Date().toISOString();
    setUnread(0);
    setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    try { await markAllNotificationsRead(); } catch { void getNotifications().then(setItems).catch(() => undefined); }
  }

  async function openItem(item: Notification) {
    if (!item.read_at) {
      setUnread((current) => Math.max(0, current - 1));
      const readAt = new Date().toISOString();
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
      try { await markNotificationRead(item.id); } catch { /* realtime or next refresh reconciles */ }
    }
    setOpen(false);
    navigate(item.related_member_id ? `/admin/members/${item.related_member_id}` : "/admin/notifications");
  }

  return <div ref={rootRef} className="notification-bell-root" style={{ position: "relative" }}>
    <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} style={{ position: "relative", border: 0, background: "transparent", color: "#334155", padding: 10, borderRadius: 9, cursor: "pointer" }}>
      <Bell size={21}/>{unread > 0 && <span style={{ position: "absolute", top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 99, background: "#dc2626", color: "white", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 4px" }}>{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <section role="dialog" aria-label="Notifications" className="notification-dropdown" style={{ position: "absolute", zIndex: 60, right: 0, top: 48, width: "min(380px, calc(100vw - 24px))", background: "white", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 16px 40px rgba(15,23,42,.18)", overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "14px 16px", borderBottom: "1px solid #e2e8f0" }}><strong style={{ minWidth: 0 }}>Notifications</strong><button type="button" onClick={() => void markAll()} disabled={!unread} style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 5, border: 0, background: "transparent", color: unread ? "#526d2f" : "#94a3b8", cursor: unread ? "pointer" : "default", fontSize: 12, textAlign: "right", whiteSpace: "normal" }}><CheckCheck size={15} style={{ flex: "0 0 auto" }}/>Mark all as read</button></header>
      <div style={{ maxHeight: "min(65vh, 440px)", overflowY: "auto" }}>{items.length === 0 ? <p style={{ padding: 24, margin: 0, textAlign: "center", color: "#64748b", fontSize: 14 }}>You’re all caught up.</p> : items.slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => void openItem(item)} style={{ display: "flex", width: "100%", gap: 10, textAlign: "left", padding: "13px 16px", border: 0, borderBottom: "1px solid #f1f5f9", background: item.read_at ? "white" : "#f7faef", cursor: "pointer" }}><span aria-hidden="true" style={{ flex: "0 0 auto", width: 8, height: 8, borderRadius: 99, marginTop: 6, background: item.read_at ? "transparent" : "#65823c" }}/><span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block", fontSize: 13, color: "#172033" }}>{item.title}</strong><span style={{ display: "block", marginTop: 3, color: "#475569", fontSize: 13, lineHeight: 1.4 }}>{item.message}</span><small style={{ display: "block", marginTop: 5, color: "#94a3b8" }}>{relativeTime(item.created_at)}</small></span></button>)}</div>
      <button type="button" onClick={() => { setOpen(false); navigate("/admin/notifications"); }} style={{ width: "100%", padding: 13, border: 0, borderTop: "1px solid #e2e8f0", background: "white", color: "#526d2f", fontWeight: 600, cursor: "pointer" }}>View all notifications</button>
    </section>}
  </div>;
}
