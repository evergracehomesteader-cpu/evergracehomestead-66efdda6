import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/demo/mode";

export function useIsAppAdmin() {
  const { user } = useAuth();
  const demo = isDemoMode();
  const q = useQuery({
    queryKey: ["is-app-admin", user?.id, demo],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      if (demo) return true;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) return false;
      return !!data;
    },
  });
  return { isAppAdmin: !!q.data, loading: q.isLoading };
}
