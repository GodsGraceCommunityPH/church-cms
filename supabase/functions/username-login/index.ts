import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configured = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const cors = (origin: string | null) => ({ "Access-Control-Allow-Origin": origin && configured.includes(origin) ? origin : "null", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Vary": "Origin" });
const respond = (origin: string | null, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors(origin) });

export async function handler(req: Request) {
  const origin = req.headers.get("Origin");
  if (origin && !configured.includes(origin)) return respond(null, { error: "Request denied." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return respond(origin, { error: "Invalid credentials." }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond(origin, { error: "Invalid credentials." }, 400); }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const validIdentifier = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$/.test(username) || (username.length <= 254 && /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(username));
  if (!validIdentifier || password.length < 1 || password.length > 128) return respond(origin, { error: "Invalid username or password." }, 401);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret) return respond(origin, { error: "Sign-in is temporarily unavailable." }, 500);
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.rpc("resolve_username_login", { p_username: username });
  const email = !error && data?.length === 1 ? data[0].email : null;
  if (!email) return respond(origin, { error: "Invalid username or password." }, 401);
  const auth = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: result, error: signInError } = await auth.auth.signInWithPassword({ email, password });
  if (signInError || !result.session) return respond(origin, { error: "Invalid username or password." }, 401);
  return respond(origin, { access_token: result.session.access_token, refresh_token: result.session.refresh_token, expires_in: result.session.expires_in, token_type: result.session.token_type });
}

serve(handler);
