import { supabase } from "../../lib/supabase";
import type { WorshipMessage, WorshipMessageInput } from "./worshipMessage";

const selectFields = "id,title,worship_date,video_url,thumbnail_path,description,status,archived_at,created_at";

function thumbnailUrl(path: string | null) {
  if (!path) return "";
  return supabase.storage.from("worship-message-images").getPublicUrl(path).data.publicUrl;
}

function mapMessage(row: any): WorshipMessage {
  const path = row.thumbnail_path ?? "";
  return {
    id: row.id,
    title: row.title,
    worshipDate: row.worship_date,
    videoUrl: row.video_url,
    thumbnailPath: path,
    thumbnailUrl: thumbnailUrl(path),
    description: row.description ?? "",
    status: row.status,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function isUsableFacebookUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return ["http:", "https:"].includes(url.protocol) &&
      (hostname === "facebook.com" || hostname.endsWith(".facebook.com") || hostname === "fb.watch");
  } catch {
    return false;
  }
}

export async function getPublishedWorshipMessages() {
  const { data, error } = await supabase
    .from("worship_messages")
    .select(selectFields)
    .eq("status", "published")
    .is("archived_at", null)
    .order("worship_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapMessage);
}

export async function getWorshipMessages() {
  const { data, error } = await supabase
    .from("worship_messages")
    .select(selectFields)
    .is("archived_at", null)
    .order("worship_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapMessage);
}

export async function getWorshipMessage(id: string) {
  const { data, error } = await supabase
    .from("worship_messages")
    .select(selectFields)
    .eq("id", id)
    .single();
  if (error) throw error;
  return mapMessage(data);
}

export async function saveWorshipMessage(input: WorshipMessageInput, id?: string) {
  const payload = {
    title: input.title.trim() || "Sunday Worship Message",
    worship_date: input.worshipDate,
    video_url: input.videoUrl.trim(),
    description: input.description.trim() || null,
    status: input.status,
  };
  const query = id
    ? supabase.from("worship_messages").update(payload).eq("id", id)
    : supabase.from("worship_messages").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function setWorshipMessageStatus(id: string, status: "published" | "hidden") {
  const { error } = await supabase.from("worship_messages").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function archiveWorshipMessage(id: string) {
  const { error } = await supabase
    .from("worship_messages")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function uploadWorshipMessageThumbnail(messageId: string, file: File, previousPath = "") {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${messageId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("worship-message-images")
    .upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;
  const { error: updateError } = await supabase
    .from("worship_messages")
    .update({ thumbnail_path: path })
    .eq("id", messageId);
  if (updateError) {
    await supabase.storage.from("worship-message-images").remove([path]);
    throw updateError;
  }
  if (previousPath) await supabase.storage.from("worship-message-images").remove([previousPath]);
}
