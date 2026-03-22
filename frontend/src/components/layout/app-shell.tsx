"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  BreadcrumbsProvider,
  useBreadcrumbs,
} from "@/components/layout/breadcrumb-context";
import { api } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { syncDocumentThemeFromStorage } from "@/lib/theme";
import { usePathname, useRouter } from "next/navigation";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

function TopBarBreadcrumbs() {
  const { items } = useBreadcrumbs();
  if (items.length === 0) return null;

  return (
    <div className="min-w-0 flex-1 px-3">
      <Breadcrumbs items={items} className="truncate" />
    </div>
  );
}

function isPublicAuthPath(pathname: string) {
  return pathname === "/auth" || pathname.startsWith("/auth/") || pathname === "/onboarding" || pathname.startsWith("/invite/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [authChecking, setAuthChecking] = useState(true);
  const prevPathname = useRef<string | null>(null);

  // Auth pages skip the shell (no Sidebar); still apply saved/system dark mode to <html>.
  useEffect(() => {
    syncDocumentThemeFromStorage();
  }, []);

  useEffect(() => {
    if (isPublicAuthPath(pathname)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthChecking(false);
      prevPathname.current = pathname;
      return;
    }

    const enteredFromPublic =
      prevPathname.current !== null && isPublicAuthPath(prevPathname.current);
    if (enteredFromPublic) {
      setAuthChecking(true);
    }
    prevPathname.current = pathname;

    const token = getAuthToken();
    if (!token) {
      router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      return;
    }

    api.auth
      .me()
      .catch(() => {
        clearAuthToken();
        router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      })
      .finally(() => setAuthChecking(false));
  }, [pathname, router]);

  // Signed-out (and sign-in/up) experiences: no sidebar or app chrome.
  if (isPublicAuthPath(pathname)) {
    return <>{children}</>;
  }

  if (authChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <WorkspaceProvider>
      <BreadcrumbsProvider>
        <WorkspaceGate>
        <div className="flex h-screen flex-col overflow-hidden">
          <div className="h-11 border-b bg-background/95 backdrop-blur">
            <div className="flex h-full">
              <div
                className={cn(
                  "flex h-full items-center border-r",
                  collapsed ? "w-16 px-2 justify-center" : "w-64 px-2",
                )}
              >
                <Link
                  href="/"
                  aria-label="Bench Home"
                  className={cn(
                    "flex items-center gap-2 rounded-md text-primary",
                    collapsed ? "justify-center" : "px-2",
                  )}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4.5 w-4.5"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <circle cx="6.5" cy="6.5" r="2.7" fill="currentColor" />
                      <circle cx="17.5" cy="6.5" r="2.7" fill="currentColor" />
                      <circle cx="12" cy="17.5" r="2.7" fill="currentColor" />
                      <path
                        d="M8.5 8.2L10.5 12.2M15.5 8.2L13.5 12.2M9.8 15.4H14.2"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  {!collapsed && (
                    <span className="flex items-center gap-1">
                      <span className="text-sm font-semibold tracking-tight leading-none">
                        Bench
                      </span>
                    </span>
                  )}
                </Link>
              </div>
              <div className="flex flex-1 items-center pl-2 pr-3 gap-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCollapsed((v) => !v)}
                        className="h-7 w-7 p-0 shrink-0"
                        aria-label={
                          collapsed ? "Expand sidebar" : "Collapse sidebar"
                        }
                      >
                        {collapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">
                    {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  </TooltipContent>
                </Tooltip>
                <TopBarBreadcrumbs />
                <div className="ml-auto shrink-0">
                  <WorkspaceSwitcher />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-1 min-h-0">
            <Sidebar collapsed={collapsed} />
            <main className="flex-1 overflow-y-auto bg-muted/10">
              {children}
            </main>
          </div>
        </div>
        </WorkspaceGate>
      </BreadcrumbsProvider>
      </WorkspaceProvider>
    </TooltipProvider>
  );
}

function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { loading } = useWorkspace();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  return <>{children}</>;
}
