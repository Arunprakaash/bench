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
  Settings,
  User,
} from "@/lib/icons";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { getInitialDarkFromStorage } from "@/lib/theme";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/scenarios", label: "Scenarios", icon: FlaskConical },
  { href: "/suites", label: "Suites", icon: FolderOpen },
  { href: "/failures", label: "Failures", icon: FailureInbox },
  { href: "/runs", label: "Test Runs", icon: Play },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  // Keep initial render deterministic to avoid hydration mismatch.
  const [dark, setDark] = useState(false);
  const [authUser, setAuthUser] = useState<AuthMe | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // Theme class is synced from AppShell on load; keep toggle UI in sync.
    setDark(getInitialDarkFromStorage());
  }, []);

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
