import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import fallbackThumbnail from "../../assets/homepage-banner.jpg";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Textarea from "../../components/ui/Textarea";
import {
  getWorshipMessage,
  isUsableFacebookUrl,
  saveWorshipMessage,
  uploadWorshipMessageThumbnail,
} from "../../features/worshipMessages/worshipMessageService";
import type { WorshipMessageInput } from "../../features/worshipMessages/worshipMessage";
import "./WorshipMessages.css";

function mostRecentSunday() {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const initial: WorshipMessageInput = { title: "Sunday Worship Message", worshipDate: mostRecentSunday(), videoUrl: "", description: "", status: "published" };

export default function WorshipMessageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [picture, setPicture] = useState<File | null>(null);
  const [existingPath, setExistingPath] = useState("");
  const [existingUrl, setExistingUrl] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    void getWorshipMessage(id).then((message) => {
      setForm({ title: message.title, worshipDate: message.worshipDate, videoUrl: message.videoUrl, description: message.description, status: message.status });
      setExistingPath(message.thumbnailPath); setExistingUrl(message.thumbnailUrl);
    }).catch((reason) => { console.error("[Worship Messages] form load failed", reason); setError("This Worship Message could not be loaded."); }).finally(() => setLoading(false));
  }, [id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!isUsableFacebookUrl(form.videoUrl)) { setError("Enter a valid Facebook video URL beginning with http:// or https://."); return; }
    if (!form.worshipDate) { setError("Worship Date is required."); return; }
    if (picture && !picture.type.startsWith("image/")) { setError("Thumbnail must be an image file."); return; }
    if (picture && picture.size > 5 * 1024 * 1024) { setError("Thumbnail must be 5 MB or smaller."); return; }
    setSaving(true);
    try {
      const messageId = await saveWorshipMessage(form, id);
      if (picture) await uploadWorshipMessageThumbnail(messageId, picture, existingPath);
      navigate("/admin/worship-messages", { replace: true });
    } catch (reason: any) {
      console.error("[Worship Messages] save failed", reason);
      setError(reason?.code === "23505" ? "This worship message has already been added." : "This Worship Message could not be saved.");
    } finally { setSaving(false); }
  }

  if (loading) return <p className="worship-admin-state">Loading Worship Message...</p>;
  const preview = picture ? URL.createObjectURL(picture) : existingUrl || fallbackThumbnail;
  return <div className="worship-form-page"><header><Link to="/admin/worship-messages">← Back to Worship Messages</Link><h1>{id ? "Edit Worship Message" : "Add Worship Message"}</h1><p>Paste the Facebook link, confirm the date, and save.</p></header>
    <form onSubmit={submit} className="worship-form" noValidate>
      {error && <div className="worship-admin-error" role="alert">{error}</div>}
      <label>Facebook Video URL *<Input type="url" inputMode="url" autoComplete="url" autoFocus={!id} value={form.videoUrl} onChange={(event) => setForm((current) => ({ ...current, videoUrl: event.target.value }))} placeholder="https://www.facebook.com/..."/><small>Facebook video, live, watch, post, and fb.watch links are accepted.</small></label>
      <div className="worship-form-grid"><label>Worship Date *<Input type="date" value={form.worshipDate} onChange={(event) => setForm((current) => ({ ...current, worshipDate: event.target.value }))}/></label><label>Status<Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as WorshipMessageInput["status"] }))}><option value="published">Published</option><option value="hidden">Hidden</option></Select></label></div>
      <label>Title<Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Sunday Worship Message"/></label>
      <label>Description <span className="worship-optional">Optional</span><Textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}/></label>
      <div className="worship-thumbnail-field"><div><span>Thumbnail</span><small>Facebook does not provide reliable public preview metadata without Meta API access. Upload an image if desired; otherwise the church banner is used.</small><Input type="file" accept="image/*" onChange={(event) => setPicture(event.target.files?.[0] ?? null)}/></div><img src={preview} alt="Thumbnail preview"/></div>
      <div className="worship-form-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => navigate("/admin/worship-messages")}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Worship Message"}</Button></div>
    </form>
  </div>;
}
