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

async function loadPermissions() {
  const { data, error } = await supabase.rpc("get_my_permissions");
  if (error) throw error;
  return new Set<string>(
    ((data ?? []) as Array<{ code: string }>).map((item) => item.code),
  );
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
      const nextPermissions = await loadPermissions();
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
    } catch {
      setAccessError(
        "Your portal role could not be loaded. Confirm that the authentication migration is installed.",
      );
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
