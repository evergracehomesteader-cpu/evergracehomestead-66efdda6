import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/demo/mode";

export interface Membership {
  homestead_id: string;
  role: string;
  homesteads: { id: string; name: string; owner_id: string } | null;
}

interface HomesteadCtx {
  currentId: string | null;
  memberships: Membership[];
  currentName: string;
  isOwner: boolean;
  role: string | null;
  loading: boolean;
  setCurrent: (id: string) => Promise<void>;
  refresh: () => void;
}

const Ctx = createContext<HomesteadCtx>({
  currentId: null,
  memberships: [],
  currentName: "",
  isOwner: false,
  role: null,
  loading: true,
  setCurrent: async () => {},
  refresh: () => {},
});

const LS_KEY = "current_homestead_id";

export function HomesteadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = isDemoMode();
  const [currentId, setCurrentIdState] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null,
  );

  const membershipsQuery = useQuery({
    queryKey: ["homestead-memberships", user?.id, demo],
    enabled: !!user?.id && !demo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homestead_members")
        .select("homestead_id, role, homesteads:homestead_id(id, name, owner_id)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const memberships = useMemo(() => membershipsQuery.data ?? [], [membershipsQuery.data]);

  // Pick a default when we don't have one, or when saved id is no longer valid.
  useEffect(() => {
    if (demo) return;
    if (!memberships.length) return;
    const valid = currentId && memberships.some((m) => m.homestead_id === currentId);
    if (!valid) {
      const first = memberships[0].homestead_id;
      setCurrentIdState(first);
      localStorage.setItem(LS_KEY, first);
      void supabase
        .from("user_current_homestead")
        .upsert({ user_id: user!.id, homestead_id: first }, { onConflict: "user_id" });
    }
  }, [memberships, currentId, demo, user]);

  // Persist current to DB whenever it changes (used as default for inserts).
  useEffect(() => {
    if (demo || !user?.id || !currentId) return;
    void supabase
      .from("user_current_homestead")
      .upsert({ user_id: user.id, homestead_id: currentId }, { onConflict: "user_id" });
  }, [currentId, user, demo]);

  const setCurrent = async (id: string) => {
    setCurrentIdState(id);
    localStorage.setItem(LS_KEY, id);
    if (user?.id && !demo) {
      await supabase
        .from("user_current_homestead")
        .upsert({ user_id: user.id, homestead_id: id }, { onConflict: "user_id" });
    }
    // Force every list to refetch under the new homestead.
    await qc.invalidateQueries();
  };

  const current = memberships.find((m) => m.homestead_id === currentId) ?? null;

  return (
    <Ctx.Provider
      value={{
        currentId: demo ? "demo" : currentId,
        memberships,
        currentName: current?.homesteads?.name ?? (demo ? "Demo Homestead" : ""),
        isOwner: !!(current && current.homesteads && current.homesteads.owner_id === user?.id),
        role: current?.role ?? null,
        loading: membershipsQuery.isLoading,
        setCurrent,
        refresh: () => qc.invalidateQueries({ queryKey: ["homestead-memberships"] }),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useHomestead = () => useContext(Ctx);
