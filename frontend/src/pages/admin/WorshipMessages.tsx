import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Play, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import fallbackThumbnail from "../../assets/homepage-banner.jpg";
import Button from "../../components/ui/Button";
import { useAuth } from "../../features/auth/auth";
import {
  archiveWorshipMessage,
  getWorshipMessages,
  setWorshipMessageStatus,
} from "../../features/worshipMessages/worshipMessageService";
import type { WorshipMessage } from "../../features/worshipMessages/worshipMessage";
import "./WorshipMessages.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "long", day: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

export default function WorshipMessages() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("website_content.manage");
  const [messages, setMessages] = useState<WorshipMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setMessages(await getWorshipMessages()); }
    catch (reason) { console.error("[Worship Messages] list failed", reason); setError("Worship Messages could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function toggle(message: WorshipMessage) {
    try {
      const status = message.status === "published" ? "hidden" : "published";
      await setWorshipMessageStatus(message.id, status);
      setNotice(status === "published" ? "Message published." : "Message hidden from the website.");
      await load();
    } catch (reason) { console.error("[Worship Messages] status failed", reason); setError("The message status could not be changed."); }
  }

  async function archive(message: WorshipMessage) {
    if (!window.confirm(`Archive ${message.title}? It will be removed from the public website.`)) return;
    try { await archiveWorshipMessage(message.id); setNotice("Message archived."); await load(); }
    catch (reason) { console.error("[Worship Messages] archive failed", reason); setError("The message could not be archived."); }
  }

  return <div className="worship-admin-page">
    <header className="worship-admin-header"><div><h1>Worship Messages</h1><p>Manage the Previous Worship Messages shown on the public website.</p></div>{canManage && <Button to="/admin/worship-messages/new"><Plus size={17}/> Add Worship Message</Button>}</header>
    {notice && <div className="worship-admin-notice">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}
    {error && <div className="worship-admin-error">{error} <button onClick={() => void load()}>Try again</button></div>}
    {loading ? <p className="worship-admin-state">Loading Worship Messages...</p> : messages.length === 0 ? <div className="worship-admin-state"><Play size={38}/><strong>No worship messages have been added yet.</strong>{canManage && <Button to="/admin/worship-messages/new">Add First Message</Button>}</div> : <section className="worship-admin-list">{messages.map((message) => <article key={message.id}>
      <img src={message.thumbnailUrl || fallbackThumbnail} alt=""/>
      <div className="worship-admin-copy"><span className={`worship-admin-status status-${message.status}`}>{message.status}</span><h2>{message.title}</h2><p>{formatDate(message.worshipDate)}</p></div>
      <div className="worship-admin-actions"><Button variant="secondary" onClick={() => navigate(`/admin/worship-messages/${message.id}/edit`)}>Edit</Button>{canManage && <Button variant="secondary" onClick={() => void toggle(message)}>{message.status === "published" ? <><EyeOff size={15}/> Hide</> : <><Eye size={15}/> Publish</>}</Button>}{canManage && <Button variant="danger" onClick={() => void archive(message)}>Archive</Button>}</div>
    </article>)}</section>}
  </div>;
}
