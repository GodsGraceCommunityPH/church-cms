import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccountActivationError, synchronizeAccountActivation } from "./accountActivation.ts";
import { buildSetActiveRpcParams } from "./activationRpc.ts";
import { reconcileAccountActivation } from "./reconcileActivation.ts";
import { loadUserAdministration } from "./listUsers.ts";

type Body = Record<string, unknown>;
const origins = () => (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const headers = (origin: string | null) => ({ "Access-Control-Allow-Origin": origin && origins().includes(origin) ? origin : "null", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json" });
const json = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headers(origin) });
const fail = (origin: string | null, message: string, status = 400) => json(origin, { ok: false, error: message }, status);
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validUsername = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$/.test(value);

async function transitionActive(admin: any, origin: string | null, callerId: string, userId: string, isActive: boolean): Promise<Response | null> {
  try {
    await synchronizeAccountActivation(userId, isActive, {
      readDatabaseActive: async (targetId) => {
        const { data, error } = await admin.from("users").select("is_active").eq("id", targetId).maybeSingle();
        if (error || !data) throw new Error("Unable to read the current account status.");
        return data.is_active === true;
      },
      setAuthBanned: async (targetId, banned) => {
        const { error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: banned ? "876000h" : "none" });
        if (error) throw error;
      },
      setDatabaseActive: async (targetId, nextActive, operationId) => {
        const params = buildSetActiveRpcParams({
          authUserId: targetId,
          callerUserId: callerId,
          isActive: nextActive,
          operationId,
        });
        const { data, error } = await admin.rpc("admin_user_set_active", params);
        if (error || data?.verified !== true) throw Object.assign(new Error(error?.message ?? "Unable to update account status."), { code: error?.code });
      },
      acquireLease: async (targetId, operationId, ttlSeconds) => {
        const { data, error } = await admin.rpc("acquire_account_activation_lease", {
          p_user_id: targetId,
          p_operation_id: operationId,
          p_requested_active: isActive,
          p_ttl_seconds: ttlSeconds,
        });
        if (error) throw error;
        return data === true;
      },
      renewLease: async (targetId, operationId, ttlSeconds) => {
        const { data, error } = await admin.rpc("renew_account_activation_lease", {
          p_user_id: targetId,
          p_operation_id: operationId,
          p_ttl_seconds: ttlSeconds,
        });
        if (error) return false;
        return data === true;
      },
      releaseLease: async (targetId, operationId, status, leaseError) => {
        const { data, error } = await admin.rpc("release_account_activation_lease", {
          p_user_id: targetId,
          p_operation_id: operationId,
          p_status: status,
          p_error: leaseError ?? null,
        });
        if (error) throw error;
        return data === true;
      },
      readAuthBanned: async (targetId) => {
        const { data, error } = await admin.auth.admin.getUserById(targetId);
        if (error || !data?.user) throw new Error("Unable to read the Auth ban state.");
        const bannedUntil = (data.user as { banned_until?: string | null }).banned_until;
        return Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
      },
    });
    return null;
  } catch (reason) {
    if (reason instanceof AccountActivationError) return fail(origin, reason.message, reason.uncertain ? 503 : 400);
    return fail(origin, "Account status could not be updated.", 500);
  }
}

export async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("Origin");
  if (origin && !origins().includes(origin)) return fail(null, "Origin not allowed.", 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return fail(origin, "Method not allowed.", 405);
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return fail(origin, "Authentication required.", 401);
  let body: Body;
  try { body = await req.json() as Body; } catch { return fail(origin, "Invalid JSON body."); }

  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret) return fail(origin, "Server configuration unavailable.", 500);
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user) return fail(origin, "Invalid or expired session.", 401);
  const { data: allowed, error: permissionError } = await caller.rpc("has_permission", { required_permission: "admin.users" });
  if (permissionError || allowed !== true) return fail(origin, "Administrator user-management permission required.", 403);
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

  if (body.action === "list") {
    const result = await loadUserAdministration(admin);
    if (!result.ok) return fail(origin, result.error, 500);
    return json(origin, { ok: true, users: result.users, roles: result.roles, members: result.members });
  }

  if (body.action === "create" || body.action === "update") {
    const creating = body.action === "create";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const memberId = body.memberId === "" || body.memberId == null ? null : body.memberId;
    const roleCodes = body.roleCodes;
    if (!validUsername(username)) return fail(origin, "Username must be 3–40 characters using letters, numbers, dot, underscore, or hyphen.");
    if (!name || name.length > 120) return fail(origin, "Name is required and must be at most 120 characters.");
    if (memberId !== null && !uuid(memberId)) return fail(origin, "Invalid Member profile.");
    if (!Array.isArray(roleCodes) || roleCodes.length < 1 || roleCodes.length > 20 || roleCodes.some((r) => typeof r !== "string") || new Set(roleCodes).size !== roleCodes.length) return fail(origin, "Select at least one valid role.");
    if (!creating && !uuid(body.userId)) return fail(origin, "Invalid user.");
    const providedPassword = typeof body.password === "string" ? body.password : "";
    if ((creating && providedPassword.length > 0 && (providedPassword.length < 12 || providedPassword.length > 128)) || (!creating && providedPassword && (providedPassword.length < 12 || providedPassword.length > 128))) return fail(origin, "Password must be 12–128 characters.");
    let userId = creating ? "" : body.userId as string;
    let existingActive = true;
    if (!creating) {
      const existing = await admin.from("users").select("is_active").eq("id", userId).maybeSingle();
      if (existing.error || !existing.data) return fail(origin, "User account was not found.", 404);
      existingActive = existing.data.is_active === true;
    }
    let temporaryPassword = "";
    if (creating) {
      temporaryPassword = providedPassword || `${crypto.randomUUID()}aA1!`;
      const internalEmail = `${crypto.randomUUID()}@accounts.ggccc.invalid`;
      const { data: created, error } = await admin.auth.admin.createUser({ email: internalEmail, password: temporaryPassword, email_confirm: true, user_metadata: { display_name: name } });
      if (error || !created.user) return fail(origin, /already|registered|exists/i.test(error?.message ?? "") ? "Username or account already exists." : "Unable to create account.", 409);
      userId = created.user.id;
    }
    const { data: result, error } = await admin.rpc("admin_user_upsert", {
      p_auth_user_id: userId, p_caller_user_id: authData.user.id, p_username: username,
      p_display_name: name, p_member_id: memberId, p_is_active: creating ? true : existingActive,
      p_role_codes: roleCodes,
    });
    if (error || result?.verified !== true) {
      if (creating) {
        const transactionRolledBack = Boolean(error?.code && /^[0-9A-Z]{5}$/.test(error.code));
        if (!transactionRolledBack) {
          return fail(origin, "Account setup result is uncertain. Do not retry; an administrator must reconcile this account.", 503);
        }
        const { error: cleanupError } = await admin.auth.admin.deleteUser(userId);
        if (cleanupError) console.error("User creation cleanup pending", { userId, message: cleanupError.message });
      }
      const status = error?.code === "23505" ? 409 : error?.code === "42501" ? 403 : 400;
      return fail(origin, error?.message ?? "Unable to save user account.", status);
    }
    if (providedPassword && !creating) {
      const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password: providedPassword });
      if (passwordError) return fail(origin, "Account details were saved, but the password could not be changed.", 500);
    }
    return json(origin, { ok: true, userId, tempPassword: creating && !providedPassword ? temporaryPassword : undefined });
  }

  if (body.action === "set-active") {
    if (!uuid(body.userId) || typeof body.isActive !== "boolean") return fail(origin, "Invalid account status request.");
    const targetId = body.userId as string;
    const statusError = await transitionActive(admin, origin, authData.user.id, targetId, body.isActive);
    if (statusError) return statusError;
    return json(origin, { ok: true });
  }
  if (body.action === "reconcile-activation") {
    if (!uuid(body.userId)) return fail(origin, "Invalid account reconciliation request.");
    const targetId = body.userId as string;
    const requestedActive = typeof body.isActive === "boolean" ? body.isActive : false;

    const result = await reconcileAccountActivation(targetId, {
      claim: async (userId, reconciliationId) => {
        const { data, error } = await admin.rpc("claim_account_activation_reconciliation", {
          p_user_id: userId,
          p_reconciliation_id: reconciliationId,
          p_requested_active: requestedActive,
          p_claim_ttl_seconds: 300,
        });
        if (error) throw new Error(error.message);
        return {
          claimed: data?.claimed === true,
          reason: typeof data?.reason === "string" ? data.reason : null,
          leaseState: typeof data?.lease_state === "string" ? data.lease_state : null,
          synthetic: data?.synthetic === true,
          lease: data?.lease ?? null,
        };
      },
      readAuthBanned: async (userId) => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error || !data?.user) throw new Error(error?.message ?? "Unable to read Auth state.");
        const bannedUntil = (data.user as { banned_until?: string | null }).banned_until;
        return Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
      },
      readDatabaseActive: async (userId) => {
        const { data, error } = await admin.from("users").select("is_active").eq("id", userId).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error("User account was not found.");
        return data.is_active === true;
      },
      setAuthBanned: async (userId, banned) => {
        const { error } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: banned ? "876000h" : "none",
        });
        if (error) throw error;
      },
      finalize: async ({ userId, reconciliationId, verified, expectedActive, message }) => {
        const { data, error } = await admin.rpc("finalize_account_activation_reconciliation", {
          p_user_id: userId,
          p_reconciliation_id: reconciliationId,
          p_verified: verified,
          p_expected_active: expectedActive,
          p_message: message ?? null,
        });
        if (error) throw new Error(error.message);
        return {
          verified: data?.verified === true,
          released: data?.released === true,
          alreadyFinalized: data?.already_finalized === true,
          reason: typeof data?.reason === "string" ? data.reason : null,
        };
      },
    });

    const status = result.ok ? 200 : result.state === "unreadable" ? 503 : 409;
    return json(origin, { ...result, ok: result.ok }, status);
  }

  return fail(origin, "Unsupported user-management action.");
}

serve(handler);
