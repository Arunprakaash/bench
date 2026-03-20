"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type AuthMe } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bot,
  FlaskConical,
  LayoutDashboard,
  Play,
  FolderOpen,
  FailureInbox,
  RadiusSetting,
  Settings,
  User,
  Bell,
} from "@/lib/icons";
import { formatRelativeTime } from "@/lib/table-helpers";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { getInitialDarkFromStorage } from "@/lib/theme";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/scenarios", label: "Scenarios", icon: FlaskConical },
  { href: "/suites", label: "Suites", icon: FolderOpen },
  { href: "/failures", label: "Failures", icon: FailureInbox },
  { href: "/runs", label: "Test Runs", icon: Play },
  { href: "/automation", label: "Automation", icon: RadiusSetting },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  // Keep initial render deterministic to avoid hydration mismatch.
  const [dark, setDark] = useState(false);
  const [authUser, setAuthUser] = useState<AuthMe | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Array<{ id: string; title: string; detail: string | null; run_id: string; created_at: string }>>([]);

  useEffect(() => {
    // Theme class is synced from AppShell on load; keep toggle UI in sync.
    setDark(getInitialDarkFromStorage());
  }, []);

  const loadAlerts = async () => {
    try {
      const openAlerts = await api.automation.listAlerts(false);
      setAlerts(openAlerts.slice(0, 5));
    } catch {
      setAlerts([]);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, []);
  const topNotifications = alerts.slice(0, 5);
  const unreadCountLabel = alerts.length > 9 ? "9+" : String(alerts.length);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthUser(null);
      return;
    }
    api.auth
      .me()
      .then((u) => setAuthUser(u))
      .catch(() => setAuthUser(null));
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore; we clear locally anyway
    } finally {
      clearAuthToken();
      setAuthUser(null);
      setSettingsOpen(false);
      // AppShell only re-validates auth when pathname changes; navigate explicitly.
      router.replace(`/auth?next=${encodeURIComponent(pathname || "/")}`);
    }
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const profileVisual = authUser?.avatar_url ? (
    <span
      aria-label={authUser.display_name || authUser.email || "Profile"}
      className="h-4 w-4 rounded-full bg-cover bg-center"
      style={{ backgroundImage: `url("${authUser.avatar_url}")` }}
    />
  ) : (
    <User className="h-4 w-4" />
  );

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r bg-sidebar/55 backdrop-blur transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <nav className="flex-1 space-y-1 px-3 py-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const linkClass = cn(
            "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
            collapsed ? "justify-center gap-0" : "gap-3",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      className={linkClass}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                    </Link>
                  }
                />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={linkClass}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "flex border-t p-3",
          collapsed ? "flex-col items-center gap-2" : "flex-col gap-1",
        )}
      >
        <Dialog open={alertsOpen} onOpenChange={setAlertsOpen} modal={false}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 relative"
                    aria-label="Notifications"
                    aria-expanded={alertsOpen}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setAlertsOpen(true);
                      void loadAlerts();
                    }}
                  >
                    <Bell className="h-5 w-5" />
                    {alerts.length > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
                        {unreadCountLabel}
                      </span>
                    )}
                  </Button>
                }
              />
              <TooltipContent side="right">Notifications</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 relative"
              aria-expanded={alertsOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setAlertsOpen(true);
                void loadAlerts();
              }}
            >
              <Bell className="h-5 w-5" />
              Notifications
              {alerts.length > 0 && (
                <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] leading-5 text-white text-center">
                  {unreadCountLabel}
                </span>
              )}
            </Button>
          )}

          <DialogContent
            hideOverlay
            className={cn(
              "!top-auto !left-[calc(4rem+0.5rem)] !translate-x-0 !translate-y-0 bottom-4",
              !collapsed && "!left-[calc(16rem+0.5rem)]",
              "z-50 w-[min(360px,calc(100vw-5rem))] max-w-[360px] gap-3 p-3 sm:max-w-[360px] rounded-lg",
            )}
          >
            <DialogHeader>
              <DialogTitle>Notifications</DialogTitle>
              <DialogDescription>Latest activity and alerts.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between">
              <Link href="/notifications" className="text-xs text-primary hover:underline">
                View all
              </Link>
              <Button
                size="xs"
                variant="outline"
                disabled={alerts.length === 0}
                onClick={async () => {
                  await Promise.all(alerts.map((alert) => api.automation.acknowledgeAlert(alert.id)));
                  await loadAlerts();
                }}
              >
                Mark all as read
              </Button>
            </div>
            {alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No new notifications.</div>
            ) : (
              <div className="space-y-2">
                {topNotifications.map((alert) => (
                  <div key={alert.id} className="rounded-md border p-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{alert.title}</div>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Alert</span>
                    </div>
                    {alert.detail && <div className="text-xs text-muted-foreground truncate">{alert.detail}</div>}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(alert.created_at)}</span>
                      <div className="flex items-center gap-1">
                        <Link href={`/runs/${alert.run_id}`}>
                          <Button size="xs" variant="outline">View</Button>
                        </Link>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={async () => {
                            await api.automation.acknowledgeAlert(alert.id);
                            await loadAlerts();
                          }}
                        >
                          Read
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Controlled open + direct button clicks: DialogTrigger inside Tooltip breaks ref wiring for Base UI when collapsed. */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen} modal={false}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="Settings"
                    aria-expanded={settingsOpen}
                    aria-haspopup="dialog"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          )}

          <DialogContent
            hideOverlay
            className={cn(
              // Override dialog defaults (centered modal): anchor flush to the right of the sidebar.
              "!top-auto !left-[calc(4rem+0.5rem)] !translate-x-0 !translate-y-0 bottom-4",
              !collapsed && "!left-[calc(16rem+0.5rem)]",
              "z-50 w-[min(320px,calc(100vw-5rem))] max-w-[320px] gap-3 p-3 sm:max-w-[320px] rounded-lg",
            )}
          >
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>Account & appearance.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Dark mode</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleTheme}
                  aria-label={dark ? "Disable dark mode" : "Enable dark mode"}
                >
                  {dark ? "On" : "Off"}
                </Button>
              </div>

              {authUser ? (
                <Button variant="destructive" className="w-full" onClick={handleLogout}>
                  Logout
                </Button>
              ) : (
                <Link href="/auth" className="w-full">
                  <Button variant="outline" className="w-full">
                    Sign in
                  </Button>
                </Link>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Link href="/profile">
                  <Button
                    type="button"
                    variant={pathname.startsWith("/profile") ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="Profile"
                  >
                    {profileVisual}
                  </Button>
                </Link>
              }
            />
            <TooltipContent side="right">Profile</TooltipContent>
          </Tooltip>
        ) : (
          <Link href="/profile" className="w-full">
            <Button
              type="button"
              variant={pathname.startsWith("/profile") ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start gap-2"
            >
              {profileVisual}
              Profile
            </Button>
          </Link>
        )}
      </div>
    </aside>
  );
}
