import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export function useAdminAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const check = async (next: Session | null) => {
      if (!active) return;
      setSession(next);
      if (!next) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase.rpc("has_role", {
        _user_id: next.user.id,
        _role: "admin",
      } as never);
      if (!active) return;
      setIsAdmin(Boolean(data));
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setLoading(true);
      void check(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, isAdmin, loading };
}
