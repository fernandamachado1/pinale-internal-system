import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let didInit = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);
      if (!didInit) {
        didInit = true;
        setIsLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!isMounted) return;
      setSession(data.session);
      if (!didInit) {
        didInit = true;
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (location === "/login" && session) {
      navigate("/");
      return;
    }
    if (location === "/login") return;
    if (!session) navigate("/login");
  }, [isLoading, location, navigate, session]);

  if (isLoading) return null;
  if (!hasSupabaseEnv) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-2">Configuração pendente</p>
          <p>
            Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no seu <code>.env</code> (na raiz do projeto)
            e reinicie <code>yarn dev</code>.
          </p>
        </div>
      </div>
    );
  }
  if (!session && location !== "/login") return null;
  return <>{children}</>;
}
