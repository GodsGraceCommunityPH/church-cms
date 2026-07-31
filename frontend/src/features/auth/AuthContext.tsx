import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { AuthContext, type AuthContextValue } from "./auth";

class PortalAccessError extends Error {
  readonly code: string;

  constructor(
    message: string,
    code: string,
  ) {
    super(message);
    this.code = code;
  }
}

async function loadPermissions(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, is_active")
    .eq("id", userId)
    .single();
  if (profileError) {
    throw new PortalAccessError(profileError.message, profileError.code);
  }
  if (!profile?.is_active) {
    throw new PortalAccessError("This portal account is inactive.", "INACTIVE");
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select(`
      role_id,
      roles (
        code,
        name,
        role_permissions (
          permissions (
            code
          )
        )
      )
    `)
    .eq("user_id", userId);
  if (error) throw new PortalAccessError(error.message, error.code);

  const permissionCodes = new Set<string>();
  for (const assignment of (data ?? []) as any[]) {
    for (const rolePermission of assignment.roles?.role_permissions ?? []) {
      const code = rolePermission.permissions?.code;
      if (code) permissionCodes.add(code);
    }
  }
  return permissionCodes;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");

  const resolveSession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setPermissions(new Set());
    setAccessError("");
    if (!nextSession) return;
    try {
      const nextPermissions = await loadPermissions(nextSession.user.id);
      setPermissions(nextPermissions);
      if (nextPermissions.size === 0) {
        setAccessError(
          "Your account is signed in but does not have a portal role. Contact an administrator.",
        );
      }
      await supabase
        .from("users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", nextSession.user.id);
    } catch (error) {
      const detail =
        error instanceof PortalAccessError
          ? ` (${error.code}: ${error.message})`
          : "";
      setAccessError(`Your portal role could not be loaded${detail}.`);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await resolveSession(data.session);
      if (active) setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setLoading(true);
      window.setTimeout(() => {
        void resolveSession(nextSession).finally(() => {
          if (active) setLoading(false);
        });
      }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [resolveSession]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      permissions,
      loading,
      accessError,
      signIn,
      signOut,
      hasPermission: (permission) => permissions.has(permission),
    }),
    [accessError, loading, permissions, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
