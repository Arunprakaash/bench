"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type WorkspaceResponse, type WorkspaceMemberResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserGroupAdd, Trash2 } from "@/lib/icons";
import { formatRelativeTime } from "@/lib/table-helpers";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setItems } = useBreadcrumbs();

  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ invite_url: string; email_sent: boolean } | null>(null);

  // Delete workspace
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const ws = await api.workspaces.get(id);
      setWorkspace(ws);
      setItems([
        { label: "Workspaces", href: "/workspaces" },
        { label: ws.name },
      ]);
    } catch (e) {
      setLoadError((e as Error).message || "Failed to load workspace.");
    } finally {
      setLoading(false);
    }
  }, [id, setItems]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = () => {
    if (!workspace) return;
    setEditName(workspace.name);
    setEditDesc(workspace.description ?? "");
    setSaveError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setSaveError("Name is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api.workspaces.update(id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
      });
      setEditing(false);
      await load();
    } catch (e) {
      setSaveError((e as Error).message || "Failed to update workspace.");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setInviteError("Email is required.");
      return;
    }
    setInviting(true);
    setInviteError(null);
    setInviteResult(null);
    try {
      const result = await api.workspaces.createInvite(id, { email: inviteEmail.trim(), role: inviteRole });
      setInviteResult({ invite_url: result.invite_url, email_sent: result.email_sent });
      if (!result.email_sent) {
        await navigator.clipboard.writeText(result.invite_url).catch(() => {});
      }
    } catch (e) {
      setInviteError((e as Error).message || "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (member: WorkspaceMemberResponse) => {
    const ok = window.confirm(`Remove ${member.display_name || member.email} from this workspace?`);
    if (!ok) return;
    try {
      await api.workspaces.removeMember(id, member.user_id);
      await load();
    } catch (e) {
      setLoadError((e as Error).message || "Failed to remove member.");
    }
  };

  const handleDeleteWorkspace = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.workspaces.delete(id);
      router.push("/workspaces");
    } catch (e) {
      setDeleteError((e as Error).message || "Failed to delete workspace.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loadError || !workspace) {
    return (
      <div className="p-8">
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {loadError || "Workspace not found."}
        </div>
      </div>
    );
  }

  const isOwner = workspace.my_role === "owner";

  return (
    <div className="p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight truncate">{workspace.name}</h1>
            <Badge variant={isOwner ? "default" : "secondary"}>{workspace.my_role}</Badge>
          </div>
          {workspace.description && (
            <p className="text-muted-foreground mt-1">{workspace.description}</p>
          )}
        </div>
        {isOwner && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={startEdit}>
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Members section */}
      <div className="border rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-base font-semibold">
            Members{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({workspace.members.length})
            </span>
          </h2>
          {isOwner && (
            <Button size="sm" onClick={() => { setInviteOpen(true); setInviteError(null); setInviteResult(null); setInviteEmail(""); }}>
              <UserGroupAdd className="mr-2 h-4 w-4" />
              Invite member
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Joined</TableHead>
              {isOwner && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspace.members.map((m) => (
              <TableRow key={m.user_id}>
                <TableCell>
                  <div className="font-medium">{m.display_name || m.email}</div>
                  {m.display_name && (
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                    {m.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatRelativeTime(m.joined_at)}
                </TableCell>
                {isOwner && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      aria-label={`Remove ${m.display_name || m.email}`}
                      onClick={() => void handleRemoveMember(m)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>Update workspace details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {saveError && (
              <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-3 text-sm">
                {saveError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-ws-name">Name</Label>
              <Input
                id="edit-ws-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ws-desc">Description</Label>
              <Textarea
                id="edit-ws-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Invite a user to this workspace by email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {inviteResult ? (
              <div className="space-y-4">
                {inviteResult.email_sent ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 text-sm text-green-800 dark:text-green-300">
                    ✓ Invite email sent to <strong>{inviteEmail}</strong>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Email could not be sent (SMTP not configured). Share this link manually:</p>
                    <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs">
                      <span className="flex-1 truncate font-mono text-muted-foreground">{inviteResult.invite_url}</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => navigator.clipboard.writeText(inviteResult!.invite_url)}>
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Link already copied to clipboard.</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setInviteResult(null); setInviteEmail(""); setInviteRole("member"); }}>
                    Invite another
                  </Button>
                  <Button onClick={() => { setInviteOpen(false); setInviteResult(null); setInviteEmail(""); setInviteRole("member"); }}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {inviteError && (
                  <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-3 text-sm">
                    {inviteError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    autoFocus
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@example.com…"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setInviteOpen(false); setInviteEmail(""); setInviteRole("member"); setInviteError(null); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? "Sending…" : "Send invite"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{workspace.name}</strong> and all its
              membership records. Resources (agents, scenarios, suites) that belonged to this
              workspace will remain but lose their workspace association. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-3 text-sm">
              {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteWorkspace} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Workspace"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
