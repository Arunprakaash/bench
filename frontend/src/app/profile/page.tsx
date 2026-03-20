"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";

export default function ProfilePage() {
  const { setItems } = useBreadcrumbs();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    setItems([{ label: "Profile" }]);
    api.auth
      .me()
      .then((me) => {
        setEmail(me.email);
        setDisplayName(me.display_name ?? "");
        setAvatarUrl(me.avatar_url ?? "");
      })
      .catch((e) => setError((e as Error).message || "Failed to load profile."))
      .finally(() => setLoading(false));
  }, [setItems]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.auth.updateMe({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      setDisplayName(updated.display_name ?? "");
      setAvatarUrl(updated.avatar_url ?? "");
      setSuccess("Profile updated.");
    } catch (e) {
      setError((e as Error).message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account details.</p>
      </div>

      {error && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="border border-primary/20 bg-primary/5 text-primary rounded-lg p-4 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-display-name">Display Name</Label>
          <Input
            id="profile-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="profile-avatar-url">Avatar URL</Label>
          <Input
            id="profile-avatar-url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

