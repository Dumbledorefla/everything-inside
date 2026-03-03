import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn("[AUTH] Refresh failed, signing out:", error.message);
        await supabase.auth.signOut();
        toast.error("Sessão expirada. Faça login novamente.");
      } else if (data.session) {
        setSession(data.session);
      }
    } catch (e) {
      console.error("[AUTH] Refresh error:", e);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
        if (event === "TOKEN_REFRESHED") {
          console.log("[AUTH] Token refreshed successfully");
        }
        if (event === "SIGNED_OUT") {
          setSession(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      // If session exists but token might be stale, force a refresh
      if (session) {
        const expiresAt = session.expires_at;
        if (expiresAt && expiresAt * 1000 < Date.now() + 60000) {
          refreshSession();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshSession]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
