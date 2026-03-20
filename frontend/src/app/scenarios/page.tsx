"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { formatDate, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { getIntParam, getParam, setOrDelete } from "@/lib/nav";
import { api, type ScenarioCreate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TablePagination } from "@/components/table-pagination";
import { Plus, FlaskConical, Play, Search, Trash2, Upload } from "@/lib/icons";

const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

export default function ScenariosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </div>
      }
    >
      <ScenariosPageInner />
    </Suspense>
  );
}

function ScenariosPageInner() {
  const { scenarios, fetchScenarios, loading } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const qFromUrl = getParam(searchParams, "q") ?? "";
  const tagFromUrl = getParam(searchParams, "tag") ?? "all";
  const pageFromUrl = getIntParam(searchParams, "page", 1);
  const pageSizeFromUrl = getIntParam(searchParams, "pageSize", DEFAULT_PAGE_SIZE);

  const [search, setSearch] = useState(qFromUrl);
  const [tagFilter, setTagFilter] = useState(tagFromUrl);
  const [page, setPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSearch(qFromUrl);
    setTagFilter(tagFromUrl);
    setPage(pageFromUrl);
    setPageSize(pageSizeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl, tagFromUrl, pageFromUrl, pageSizeFromUrl]);

  const syncUrl = useCallback(
    (next: { q?: string; tag?: string; page?: number; pageSize?: number }) => {
      const sp = new URLSearchParams(searchParams.toString());
      setOrDelete(sp, "q", next.q);
      setOrDelete(sp, "tag", next.tag && next.tag !== "all" ? next.tag : null);
      setOrDelete(sp, "page", next.page && next.page !== 1 ? next.page : null);
      setOrDelete(sp, "pageSize", next.pageSize && next.pageSize !== DEFAULT_PAGE_SIZE ? next.pageSize : null);
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    scenarios.forEach((s) => s.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [scenarios]);

  const filtered = useMemo(() => {
    let result = scenarios;
    if (tagFilter !== "all") {
      result = result.filter((s) => s.tags?.includes(tagFilter));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q));
    }
    return result;
  }, [scenarios, search, tagFilter]);

  const paged = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);
  const pagedIds = useMemo(() => paged.map((scenario) => scenario.id), [paged]);
  const allPagedSelected = pagedIds.length > 0 && pagedIds.every((id) => selectedIds.includes(id));

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    syncUrl({ q: v, tag: tagFilter, page: 1, pageSize });
  };
  const handleTag = (v: string | null) => {
    const next = v ?? "all";
    setTagFilter(next);
    setPage(1);
    syncUrl({ q: search, tag: next, page: 1, pageSize });
  };

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => scenarios.some((scenario) => scenario.id === id)));
  }, [scenarios]);

  const toggleSelectAllPaged = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pagedIds])));
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !pagedIds.includes(id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0 || deleting) return;
    const ok = window.confirm(
      `Delete ${selectedIds.length} selected scenario${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!ok) return;

    setDeleting(true);
    setActionError(null);
    try {
      await Promise.all(selectedIds.map((id) => api.scenarios.delete(id)));
      setSelectedIds([]);
      await fetchScenarios();
    } catch (e) {
      setActionError((e as Error).message || "Failed to delete selected scenarios.");
    } finally {
      setDeleting(false);
    }
  };

  const handleRunSelected = async () => {
    if (selectedIds.length === 0 || running) return;
    setRunning(true);
    setActionError(null);
    try {
      await Promise.all(selectedIds.map((id) => api.runs.create(id)));
      setSelectedIds([]);
      router.push("/runs");
    } catch (e) {
      setActionError((e as Error).message || "Failed to run selected scenarios.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scenarios</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage test scenarios for your voice agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" />
              }
            >
              <Upload className="mr-2 h-4 w-4" />
              Import JSON…
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import scenario JSON</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="scenario-import">Scenario JSON</Label>
                  <Textarea
                    id="scenario-import"
                    value={importText}
                    onChange={(e) => {
                      setImportText(e.target.value);
                      setImportError(null);
                    }}
                    placeholder='Paste the exported JSON here…'
                    rows={10}
                  />
                  {importError && (
                    <p className="text-sm text-destructive">{importError}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportOpen(false);
                      setImportText("");
                      setImportError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={importing || !importText.trim()}
                    onClick={async () => {
                      setImporting(true);
                      setImportError(null);
                      try {
                        const parsed = JSON.parse(importText) as ScenarioCreate | { scenario: ScenarioCreate };
                        const payload =
                          typeof parsed === "object" && parsed != null && "scenario" in parsed
                            ? (parsed as { scenario: ScenarioCreate }).scenario
                            : (parsed as ScenarioCreate);
                        const created = await api.scenarios.import(payload);
                        setImportOpen(false);
                        setImportText("");
                        await fetchScenarios();
                        router.push(`/scenarios/${created.id}`);
                      } catch (e) {
                        setImportError((e as Error).message);
                      } finally {
                        setImporting(false);
                      }
                    }}
                  >
                    {importing ? "Importing…" : "Import"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Link href="/scenarios/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Scenario
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
          <Input
            placeholder="Search scenarios..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={handleTag}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {actionError && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-lg">
          <FlaskConical className="h-12 w-12 text-primary/30 mb-4" />
          <h3 className="text-lg font-medium">
            {scenarios.length > 0 ? "No scenarios match your filters" : "No scenarios yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {scenarios.length > 0
              ? "Try adjusting your search or tag filter."
              : "Create your first test scenario to start testing your voice agent."}
          </p>
          {scenarios.length === 0 && (
            <Link href="/scenarios/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Scenario
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <div className="flex justify-end gap-2 p-3 border-b">
            <Button
              onClick={handleRunSelected}
              disabled={selectedIds.length === 0 || running || deleting}
            >
              <Play className="mr-2 h-4 w-4" />
              {running ? "Running..." : `Run Selected (${selectedIds.length})`}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0 || deleting || running}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
            </Button>
          </div>
          <TablePagination
            totalItems={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={(p) => {
              setPage(p);
              syncUrl({ q: search, tag: tagFilter, page: p, pageSize });
            }}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
              syncUrl({ q: search, tag: tagFilter, page: 1, pageSize: s });
            }}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44px]">
                  <Checkbox
                    checked={allPagedSelected}
                    onCheckedChange={toggleSelectAllPaged}
                    aria-label="Select all visible scenarios"
                  />
                </TableHead>
                <TableHead className="w-[40%]">Name</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="w-[80px] text-center">Turns</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-[140px] text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((scenario) => (
                <TableRow
                  key={scenario.id}
                  className="group"
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(scenario.id)}
                      onCheckedChange={(checked) => {
                        setSelectedIds((prev) =>
                          checked
                            ? Array.from(new Set([...prev, scenario.id]))
                            : prev.filter((id) => id !== scenario.id),
                        );
                      }}
                      aria-label={`Select scenario ${scenario.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/scenarios/${scenario.id}`}
                      className={`font-medium text-primary group-hover:underline ${FOCUS_LINK}`}
                    >
                      {scenario.name}
                    </Link>
                    {scenario.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {scenario.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/scenarios/${scenario.id}`} className={`block ${FOCUS_LINK}`}>
                      {scenario.agent_name ?? scenario.agent_module.split(".").pop()}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-muted-foreground">
                    <Link href={`/scenarios/${scenario.id}`} className={`block ${FOCUS_LINK}`}>
                      {scenario.turn_count}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {scenario.tags && scenario.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {scenario.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4 font-normal bg-primary/10 text-primary/80"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Link href={`/scenarios/${scenario.id}`} className={`block ${FOCUS_LINK}`}>
                      {formatDate(scenario.updated_at)}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
