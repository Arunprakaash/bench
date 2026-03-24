"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, type ScenarioListItem, type Suite } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace-context";
import { formatRelativeTime, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "@/lib/icons";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";
import { TablePagination } from "@/components/table-pagination";

export default function EditSuitePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setItems } = useBreadcrumbs();
  const { activeWorkspaceId } = useWorkspace();

  const [suite, setSuite] = useState<Suite | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenariosError, setScenariosError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setScenariosError(null);
    setItems([]);

    Promise.all([api.suites.get(id), api.scenarios.list(undefined, activeWorkspaceId)])
      .then(([suiteData, scenarioData]) => {
        setSuite(suiteData);
        setName(suiteData.name);
        setDescription(suiteData.description ?? "");
        setScenarios(scenarioData);
        setSelectedScenarioIds(new Set(suiteData.scenarios.map((s) => s.id)));
        setItems([{ label: "Suites", href: "/suites" }, { label: suiteData.name, href: `/suites/${id}` }, { label: "Edit" }]);
      })
      .catch((e) => {
        const msg = (e as Error).message || "Failed to load suite.";
        setError(msg);
        setScenarios([]);
        setSuite(null);
      })
      .finally(() => setLoading(false));
  }, [id, setItems, activeWorkspaceId]);

  const filteredScenarios = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return scenarios;
    return scenarios.filter((s) => s.name.toLowerCase().includes(query) || (s.description || "").toLowerCase().includes(query));
  }, [scenarios, q]);

  const pagedScenarios = useMemo(() => paginate(filteredScenarios, page, pageSize), [filteredScenarios, page, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredScenarios.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [filteredScenarios.length, page, pageSize]);

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarioIds((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) next.delete(scenarioId);
      else next.add(scenarioId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!id || !suite) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.suites.update(id, {
        name: name.trim(),
        description: description.trim() ? description.trim() : "",
        scenario_ids: Array.from(selectedScenarioIds),
      });
      router.push(`/suites/${id}`);
    } catch (e) {
      setError((e as Error).message || "Failed to update suite.");
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

  if (!suite) {
    return (
      <div className="p-8 space-y-4">
        {error && (
          <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
            {error}
          </div>
        )}
        <p>Suite not found.</p>
        <Link href="/suites" className="text-sm text-primary hover:underline">
          Back to Suites
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Suite</h1>
          <p className="text-muted-foreground mt-1">Update suite details and included scenarios.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(`/suites/${id}`)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {(error || scenariosError) && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {error || scenariosError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6 items-start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="suite-edit-name">Name</Label>
            <Input
              id="suite-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Regression Suite"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="suite-edit-desc">Description</Label>
            <Textarea
              id="suite-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this suite covers..."
              rows={4}
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <Input
                  placeholder="Search scenarios..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            <TablePagination
              totalItems={filteredScenarios.length}
              page={page}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => {
                setPage(1);
                setPageSize(s);
              }}
              pageSizeOptions={[5, 10, 20, 50]}
            />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]">Use</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[160px] text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedScenarios.map((s) => {
                  const checked = selectedScenarioIds.has(s.id);
                  return (
                    <TableRow key={s.id} className="align-top">
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleScenario(s.id)}
                          aria-label={`Include scenario ${s.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        {s.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatRelativeTime(s.updated_at)}</TableCell>
                    </TableRow>
                  );
                })}

                {filteredScenarios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <div className="p-6 text-sm text-muted-foreground">No scenarios match your search.</div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium">Suite summary</div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedScenarioIds.size}</span> scenario
              {selectedScenarioIds.size !== 1 ? "s" : ""} selected
            </div>
            <div className="text-xs text-muted-foreground">
              You can add or remove scenarios and save to update this suite.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

