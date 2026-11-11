import { supabase } from "../../lib/supabase";

export interface Notification {
  id: string;
  event_type: string;
  title: string;
  message: string;
  related_member_id: string | null;
  related_order_id: string | null;
  created_at: string;
  read_at: string | null;
}

export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase.from("notifications").select("id,event_type,title,message,related_member_id,related_order_id,created_at,read_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw error;
}

export async function getUnviewedMemberIds(): Promise<string[]> {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userResult.user) return [];
  const { data, error } = await supabase.from("member_admin_views").select("member_id").eq("admin_id", userResult.user.id).is("viewed_at", null);
  if (error) throw error;
  return (data ?? []).map((row) => row.member_id);
}

export async function markMemberViewed(memberId: string) {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userResult.user?.id;
  if (!userId) return;
  const { error } = await supabase.from("member_admin_views").update({ viewed_at: new Date().toISOString() }).eq("member_id", memberId).eq("admin_id", userId).is("viewed_at", null);
  if (error) throw error;
}
