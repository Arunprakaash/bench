"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, type WorkspaceListItem } from "@/lib/api";

interface WorkspaceContextValue {
  workspaces: WorkspaceListItem[];
  /** null = "All" (no filter) */
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceListItem | null;
  setActiveWorkspaceId: (id: string | null) => void;
  loading: boolean;
  reload: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspaceId: null,
  activeWorkspace: null,
  setActiveWorkspaceId: () => {},
  loading: false,
  reload: () => {},
});

const STORAGE_KEY = "bench_active_workspace";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [activeWorkspaceId, _setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const setActiveWorkspaceId = useCallback((id: string | null) => {
    _setActiveWorkspaceId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    router.refresh();
  }, [router]);

  const load = useCallback(() => {
    if (pathname === "/onboarding") {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.workspaces
      .list()
      .then((data) => {
        setWorkspaces(data);
        if (data.length === 0) {
          router.replace("/onboarding");
          return;
        }
        // Restore persisted selection, but only if still valid
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && data.some((w) => w.id === stored)) {
          _setActiveWorkspaceId(stored);
        } else if (data.length > 0) {
          _setActiveWorkspaceId(data[0].id);
          localStorage.setItem(STORAGE_KEY, data[0].id);
        } else {
          _setActiveWorkspaceId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, [pathname, router]);

  useEffect(() => {
    load();
  }, [load]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspaceId, loading, reload: load }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
