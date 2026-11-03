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
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

serve(async (req) => {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  let memberLinked = false;
  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (memberError) {
    return json({ ok: false, error: memberError.message }, 500);
  }
  if (member) {
    memberLinked = true;
    const { error: userUpdateError } = await admin
      .from("users")
      .update({ member_id: member.id })
      .eq("id", userId);
    if (!userUpdateError) {
      const { error: memberUpdateError } = await admin
        .from("members")
        .update({ cell_group_id: cellGroupId })
        .eq("id", member.id);
      if (!memberUpdateError) {
        const { error: groupUpdateError } = await admin
          .from("cell_groups")
          .update({ leader_id: member.id })
          .eq("id", cellGroupId);
        if (groupUpdateError) {
          return json({ ok: false, error: groupUpdateError.message, userId, email }, 500);
        }
      }
    }
  }

  const { data: assignments, error: verifyError } = await admin
    .from("user_roles")
    .select("id, roles (code)")
    .eq("user_id", userId);
  const hasCellLeader = (assignments ?? []).some((assignment) => {
    const roleCode = (assignment as { roles?: { code?: string } })?.roles?.code;
    return roleCode === "cell_leader";
  });
  if (verifyError) {
    return json({ ok: false, error: verifyError.message, userId, email }, 500);
  }

  const ok = !roleError && !memberError && !verifyError;
  return json({
    ok,
    created: true,
    userId,
    email,
    cellGroupId,
    roleAssigned,
    memberLinked,
    verified: hasCellLeader,
  });
});
