import { supabase } from "../../lib/supabase";
import type {
  Ministry,
  MinistryInput,
  MinistryMember,
  MinistryRole,
  MinistryStatus,
} from "./ministry";

const ministrySelect = `
  id,
  name,
  description,
  picture_path,
  status,
  ministry_members (
    id,
    member_id,
    role,
    date_joined,
    status,
    members (
      first_name,
      last_name
    )
  )
`;

function pictureUrl(path: string | null) {
  if (!path) return "";
  return supabase.storage.from("ministry-pictures").getPublicUrl(path).data
    .publicUrl;
}

function throwMinistryError(operation: string, error: unknown): never {
  console.error(`[Ministries] ${operation} failed`, error);
  throw error;
}

function mapMember(data: any): MinistryMember {
  return {
    id: data.id,
    memberId: data.member_id,
    firstName: data.members?.first_name ?? "",
    lastName: data.members?.last_name ?? "",
    role: data.role,
    dateJoined: data.date_joined,
    status: data.status,
  };
}

function mapMinistry(data: any): Ministry {
  const path = data.picture_path ?? "";
  return {
    id: data.id,
    name: data.name,
    description: data.description ?? "",
    picturePath: path,
    pictureUrl: pictureUrl(path),
    status: data.status,
    members: (data.ministry_members ?? []).map(mapMember),
  };
}

export async function getMinistries(): Promise<Ministry[]> {
  const { data, error } = await supabase
    .from("ministries")
    .select(ministrySelect)
    .order("name");
  if (error) throwMinistryError("list", error);
  return (data ?? []).map(mapMinistry);
}

export async function getMinistry(id: string): Promise<Ministry> {
  const { data, error } = await supabase
    .from("ministries")
    .select(ministrySelect)
    .eq("id", id)
    .single();
  if (error) throwMinistryError("load", error);
  return mapMinistry(data);
}

export async function saveMinistry(
  input: MinistryInput,
  id?: string,
): Promise<string> {
  const payload = {
    name: input.name.trim(),
    description: input.description.trim() || null,
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from("ministries").update(payload).eq("id", id)
    : supabase.from("ministries").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error) throwMinistryError(id ? "update" : "create", error);
  return data.id;
}

export async function deleteMinistry(ministry: Ministry): Promise<void> {
  const { error } = await supabase
    .from("ministries")
    .delete()
    .eq("id", ministry.id);
  if (error) throw error;
  if (ministry.picturePath) {
    await supabase.storage
      .from("ministry-pictures")
      .remove([ministry.picturePath]);
  }
}

export async function uploadMinistryPicture(
  ministryId: string,
  file: File,
  previousPath = "",
): Promise<void> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${ministryId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("ministry-pictures")
    .upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;
  const { error: updateError } = await supabase
    .from("ministries")
    .update({ picture_path: path, updated_at: new Date().toISOString() })
    .eq("id", ministryId);
  if (updateError) {
    await supabase.storage.from("ministry-pictures").remove([path]);
    throw updateError;
  }
  if (previousPath) {
    await supabase.storage.from("ministry-pictures").remove([previousPath]);
  }
}

export async function removeMinistryPicture(
  ministryId: string,
  path: string,
): Promise<void> {
  const { error } = await supabase
    .from("ministries")
    .update({ picture_path: null, updated_at: new Date().toISOString() })
    .eq("id", ministryId);
  if (error) throw error;
  if (path) {
    const { error: storageError } = await supabase.storage
      .from("ministry-pictures")
      .remove([path]);
    if (storageError) throw storageError;
  }
}

export async function getAssignableMembers() {
  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, membership_status")
    .order("last_name");
  if (error) throw error;
  return data ?? [];
}

export async function addMinistryMember(input: {
  ministryId: string;
  memberId: string;
  role: MinistryRole;
  dateJoined: string;
  status: MinistryStatus;
}): Promise<void> {
  const { error } = await supabase.from("ministry_members").insert({
    ministry_id: input.ministryId,
    member_id: input.memberId,
    role: input.role,
    date_joined: input.dateJoined,
    status: input.status,
  });
  if (error) throw error;
}

export async function removeMinistryMember(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("ministry_members")
    .delete()
    .eq("id", assignmentId);
  if (error) throw error;
}
