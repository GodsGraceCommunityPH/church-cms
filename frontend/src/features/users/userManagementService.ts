import { supabase } from "../../lib/supabase";

export async function manageCmsUsers<T = Record<string, unknown>>(input: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("manage-cms-users", { body: input });
  if (error) {
    const details = typeof error.context?.json === "function" ? await error.context.json().catch(() => null) : null;
    throw new Error(details?.error || error.message);
  }
  if (input.action !== "list" && !data?.ok) throw new Error(data?.error || "User management request failed.");
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function signInWithUsername(username: string, password: string) {
  const normalized = username.trim();
  const validIdentifier = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$/.test(normalized) || (normalized.length <= 254 && /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(normalized));
  if (!validIdentifier) throw new Error("Enter a valid username or email address.");
  const { data, error } = await supabase.functions.invoke("username-login", { body: { username: normalized, password } });
  if (error || !data?.access_token || !data?.refresh_token) throw new Error("Invalid username or password.");
  const { error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  if (sessionError) throw new Error("Invalid username or password.");
}
