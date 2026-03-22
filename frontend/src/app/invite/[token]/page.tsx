"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";

interface InviteInfo {
  token: string;
  workspace_id: string;
  workspace_name: string;
  role: string;
  expires_at: string | null;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    api.invites
      .getInfo(token)
      .then(setInfo)
      .catch((e) => setLoadError((e as Error).message || "Invalid or expired invite link."));
  }, [token]);

  const handleAccept = async () => {
    if (!getAuthToken()) {
      router.push(`/auth?next=/invite/${token}`);
      return;
    }
    setAccepting(true);
    setAcceptError(null);
    try {
      const result = await api.invites.accept(token);
      router.replace(`/?workspace=${result.workspace_id}`);
    } catch (e) {
      setAcceptError((e as Error).message || "Failed to accept invite.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 mb-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="2.7" fill="currentColor" />
              <circle cx="17.5" cy="6.5" r="2.7" fill="currentColor" />
              <circle cx="12" cy="17.5" r="2.7" fill="currentColor" />
              <path d="M8.5 8.2L10.5 12.2M15.5 8.2L13.5 12.2M9.8 15.4H14.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">You've been invited</h1>
        </div>

        <div className="bg-background rounded-xl border p-6 shadow-sm space-y-5">
          {loadError ? (
            <p className="text-sm text-destructive text-center">{loadError}</p>
          ) : !info ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">You've been invited to join</p>
                <p className="text-xl font-semibold">{info.workspace_name}</p>
                <p className="text-sm text-muted-foreground">
                  as a <span className="font-medium text-foreground capitalize">{info.role}</span>
                </p>
              </div>

              {acceptError && <p className="text-sm text-destructive text-center">{acceptError}</p>}

              <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                {accepting ? "Joining…" : getAuthToken() ? "Accept invitation" : "Sign in to accept"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
