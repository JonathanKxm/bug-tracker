import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { User } from "@/types";
import { apiGet } from "@/lib/api";

interface AuthState {
  user: User | null;
  projects: { id: number; name: string; key: string; project_role: string }[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ user: null, projects: [], loading: true, refresh: async () => undefined });

export function useAuth(): AuthState {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<AuthState["projects"]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<{ user: User | null; projects: AuthState["projects"] }>("/api/me");
      setUser(data.user);
      setProjects(data.projects ?? []);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ user, projects, loading, refresh }}>{children}</Ctx.Provider>;
}
