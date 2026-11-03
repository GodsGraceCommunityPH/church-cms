import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import { getNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from "../../features/notifications/notificationService";

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void getNotifications().then(setItems).catch(() => setError("Unable to load notifications.")); }, []);
  async function markAll() {
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
    try { await markAllNotificationsRead(); } catch { setError("Unable to mark notifications as read."); }
  }
  async function open(item: Notification) {
    if (!item.read_at) {
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
      try { await markNotificationRead(item.id); } catch { /* next visit can retry */ }
    }
    if (item.related_member_id) navigate(`/admin/members/${item.related_member_id}`);
  }
  return <div style={{ maxWidth: 900, margin: "0 auto" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}><div><h1 style={{ margin: 0, fontSize: 28 }}>Notifications</h1><p style={{ margin: "6px 0 0", color: "#64748b" }}>Updates about member records and registrations.</p></div><Button variant="secondary" onClick={() => void markAll()} disabled={!items.some((item) => !item.read_at)}>Mark all as read</Button></div>{error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}<section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>{items.length === 0 ? <p style={{ padding: 32, textAlign: "center", color: "#64748b" }}>You’re all caught up.</p> : items.map((item) => <button key={item.id} type="button" onClick={() => void open(item)} style={{ width: "100%", display: "flex", gap: 14, alignItems: "flex-start", textAlign: "left", padding: 18, border: 0, borderBottom: "1px solid #f1f5f9", background: item.read_at ? "white" : "#f7faef", cursor: "pointer" }}><span aria-hidden="true" style={{ flex: "0 0 auto", width: 9, height: 9, borderRadius: 99, marginTop: 5, background: item.read_at ? "transparent" : "#65823c" }}/><span><strong style={{ color: "#172033" }}>{item.title}</strong><span style={{ display: "block", marginTop: 5, color: "#475569" }}>{item.message}</span><small style={{ display: "block", marginTop: 7, color: "#94a3b8" }}>{new Date(item.created_at).toLocaleString()}</small></span></button>)}</section></div>;
}
