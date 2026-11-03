import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ProvisionCellLeaderRequest = {
  name?: string;
  email?: string;
  password?: string;
  cellGroupId?: string;
};

type ProvisionCellLeaderResponse = {
  ok: boolean;
  created?: boolean;
  reason?: string;
  userId?: string;
  email?: string;
  error?: string;
  tempPassword?: string;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function cleanupCreatedUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<void> {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // Best-effort rollback; the original provisioning error is authoritative.
  }
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: ProvisionCellLeaderRequest;
  try {
    body = (await req.json()) as ProvisionCellLeaderRequest;
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const cellGroupId = body.cellGroupId?.trim();

  if (!name || !email || !cellGroupId) {
    return json(
      { ok: false, error: "name, email, and cellGroupId are required" },
      400,
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "Invalid email address" }, 400);
  }

  const admin = createAdminClient();

  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    return json({ ok: false, error: listError.message }, 500);
  }

  const existing = (listData?.users ?? []).find(
    (user) => user.email?.toLowerCase() === email,
  );
  if (existing) {
    return json({ ok: true, created: false, reason: "existing", userId: existing.id, email }, 200);
  }

  const { data: members, error: memberError } = await admin
    .from("members")
    .select("id, cell_group_id")
    .ilike("email", email);
  if (memberError) {
    return json({ ok: false, error: memberError.message }, 500);
  }

  const matches = (members ?? []) as Array<{
    id: string;
    cell_group_id: string | null;
  }>;

  if (matches.length === 0) {
    return json(
      { ok: false, error: "No member profile found for the provided email." },
      404,
    );
  }
  if (matches.length > 1) {
    return json(
      { ok: false, error: "Ambiguous member profile matches for the provided email." },
      409,
    );
  }

  const member = matches[0];
  if (member.cell_group_id && member.cell_group_id !== cellGroupId) {
    return json(
      { ok: false, error: "Member is already assigned to a different cell group." },
      409,
    );
  }

  const { data: group, error: groupError } = await admin
    .from("cell_groups")
    .select("id, leader_id")
    .eq("id", cellGroupId)
    .maybeSingle();
  if (groupError) {
    return json({ ok: false, error: groupError.message }, 500);
  }
  if (!group) {
    return json({ ok: false, error: "Cell group not found.", cellGroupId }, 404);
  }
  if (group.leader_id && group.leader_id !== member.id) {
    return json(
      { ok: false, error: "Cell group already has an assigned leader." },
      409,
    );
  }

  const tempPassword =
    body.password?.trim() || crypto.randomUUID().replace(/-/g, "") + "A1!aA1!aA1!";
  const { data: createdData, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
  if (createError || !createdData?.user) {
    return json(
      { ok: false, error: createError?.message ?? "Failed to create auth user" },
      500,
    );
  }

  const userId = createdData.user.id;

  const { error: userUpdateError } = await admin
    .from("users")
    .update({ member_id: member.id })
    .eq("id", userId);
  if (userUpdateError) {
    await cleanupCreatedUser(admin, userId);
    return json({ ok: false, error: userUpdateError.message, userId, email }, 500);
  }

  const { error: memberUpdateError } = await admin
    .from("members")
    .update({ cell_group_id: cellGroupId })
    .eq("id", member.id);
  if (memberUpdateError) {
    await cleanupCreatedUser(admin, userId);
    return json({ ok: false, error: memberUpdateError.message, userId, email }, 500);
  }

  const { error: groupUpdateError } = await admin
    .from("cell_groups")
    .update({ leader_id: member.id })
    .eq("id", cellGroupId);
  if (groupUpdateError) {
    await cleanupCreatedUser(admin, userId);
    return json({ ok: false, error: groupUpdateError.message, userId, email }, 500);
  }

  const { data: role, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("code", "cell_leader")
    .single();
  let roleAssigned = false;
  if (!roleError && role) {
    const { error: roleInsertError } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role_id: role.id });
    roleAssigned = !roleInsertError;
  }
  if (!roleAssigned) {
    await cleanupCreatedUser(admin, userId);
    return json(
      { ok: false, error: "Failed to assign cell leader role.", userId, email },
      500,
    );
  }

  const { data: assignments, error: verifyError } = await admin
    .from("user_roles")
    .select("id, roles (code)")
    .eq("user_id", userId);
  const hasCellLeader = (assignments ?? []).some((assignment) => {
    const roleCode = (assignment as { roles?: { code?: string } })?.roles?.code;
    return roleCode === "cell_leader";
  });
  if (verifyError || !hasCellLeader) {
    await cleanupCreatedUser(admin, userId);
    return json(
      { ok: false, error: verifyError?.message ?? "Verification failed.", userId, email },
      500,
    );
  }

  return json({
    ok: true,
    created: true,
    userId,
    email,
    cellGroupId,
    roleAssigned: true,
    memberLinked: true,
    verified: true,
    tempPassword,
  });
}

serve(async (req) => {
  return handler(req);
});
