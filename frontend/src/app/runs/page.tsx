"use client";

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useWorkspace } from "@/lib/workspace-context";
import { formatDuration, formatRelativeTime, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { getIntParam, getParam, setOrDelete, withFrom } from "@/lib/nav";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/table-pagination";
import { Calendar, ChevronRight, Play, Search, Trash2 } from "@/lib/icons";
import { api } from "@/lib/api";
import { PageSkeleton } from "@/components/skeletons/page-skeleton";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";

export default function RunsPage() {
  return (
    <Suspense fallback={<PageSkeleton columnWidths={["w-20", "w-16", "w-20", "w-28", "w-28", "w-28"]} />}>
      <RunsPageInner />
    </Suspense>
  );
}

function RunsPageInner() {
  const { runs, fetchRuns, loading } = useStore();
  const { activeWorkspaceId } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusFromUrl = getParam(searchParams, "status") ?? "all";
  const qFromUrl = getParam(searchParams, "q") ?? "";
  const pageFromUrl = getIntParam(searchParams, "page", 1);
  const pageSizeFromUrl = getIntParam(searchParams, "pageSize", DEFAULT_PAGE_SIZE);

  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [search, setSearch] = useState(qFromUrl);
  const [dateFilter, setDateFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [page, setPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setStatusFilter(statusFromUrl);
    setSearch(qFromUrl);
    setPage(pageFromUrl);
    setPageSize(pageSizeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFromUrl, qFromUrl, pageFromUrl, pageSizeFromUrl]);

  const syncUrl = useCallback(
    (next: { status?: string; q?: string; page?: number; pageSize?: number }) => {
      const sp = new URLSearchParams(searchParams.toString());
      setOrDelete(sp, "status", next.status && next.status !== "all" ? next.status : null);
      setOrDelete(sp, "q", next.q);
      setOrDelete(sp, "page", next.page && next.page !== 1 ? next.page : null);
      setOrDelete(sp, "pageSize", next.pageSize && next.pageSize !== DEFAULT_PAGE_SIZE ? next.pageSize : null);
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams],
  );

  const load = useCallback(() => {
    const params: { status?: string; limit: number; workspace_id?: string | null } = { limit: 200 };
    if (statusFilter !== "all") params.status = statusFilter;
    if (activeWorkspaceId) params.workspace_id = activeWorkspaceId;
    fetchRuns(params);
  }, [fetchRuns, statusFilter, activeWorkspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let result = runs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => (r.scenario_name || "").toLowerCase().includes(q));
    }
    if (dateFilter) {
      result = result.filter((r) => {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key === dateFilter;
      });
    }
    if (creatorFilter !== "all") {
      result = result.filter((r) => (r.owner_display_name || "Unknown") === creatorFilter);
    }
    return result;
  }, [runs, search, dateFilter, creatorFilter]);
  const creatorOptions = useMemo(
    () => Array.from(new Set(runs.map((r) => r.owner_display_name || "Unknown"))).sort(),
    [runs],
  );
  const statusFilterLabel = statusFilter === "all" ? "Status: All" : `Status: ${statusFilter}`;
  const creatorFilterLabel = creatorFilter === "all" ? "Created by: All" : `Created by: ${creatorFilter}`;

  const paged = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);
  const pagedIds = useMemo(() => paged.map((run) => run.id), [paged]);
  const allPagedSelected = pagedIds.length > 0 && pagedIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => runs.some((run) => run.id === id)));
  }, [runs]);

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
      `Delete ${selectedIds.length} selected run${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!ok) return;

    setDeleting(true);
    setActionError(null);
    try {
      await Promise.all(selectedIds.map((id) => api.runs.delete(id)));
      setSelectedIds([]);
      load();
    } catch (e) {
      setActionError((e as Error).message || "Failed to delete selected runs.");
    } finally {
      setDeleting(false);
    }
  };

  const filtersActive =
    search.trim() !== "" || statusFilter !== "all" || dateFilter !== "" || creatorFilter !== "all";

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Runs</h1>
        <p className="text-muted-foreground mt-1">
          View results from all test executions
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Search by scenario…"
            value={search}
            onChange={(e) => {
              const v = e.target.value;
              setSearch(v);
              setPage(1);
              syncUrl({ status: statusFilter, q: v, page: 1, pageSize });
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            const next = v ?? "all";
            setStatusFilter(next);
            setPage(1);
            syncUrl({ status: next, q: search, page: 1, pageSize });
          }}
        >
          <SelectTrigger className="w-[160px] bg-muted/50 border-border/60">
            <SelectValue className="sr-only" placeholder="Status" />
            <span className="line-clamp-1">{statusFilterLabel}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="passed">Passed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative w-[180px]">
          <Input
            ref={dateInputRef}
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="w-full pr-8 bg-muted/50 border-border/60 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none"
          />
          <button
            type="button"
            aria-label="Open date picker"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              const input = dateInputRef.current;
              if (!input) return;
              if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
                (input as HTMLInputElement & { showPicker: () => void }).showPicker();
              } else {
                input.focus();
              }
            }}
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
        <Select
          value={creatorFilter}
          onValueChange={(v) => {
            setCreatorFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px] bg-muted/50 border-border/60">
            <SelectValue className="sr-only" placeholder="Created by" />
            <span className="line-clamp-1">{creatorFilterLabel}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All creators</SelectItem>
            {creatorOptions.map((creator) => (
              <SelectItem key={creator} value={creator}>
                {creator}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          disabled={!filtersActive}
          className={`gap-1.5 ${filtersActive ? "text-primary hover:text-primary/80" : ""}`}
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
            setDateFilter("");
            setCreatorFilter("all");
            setPage(1);
          }}
        >
          {filtersActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
          )}
          Clear filters
        </Button>
      </div>
      {actionError && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {actionError}
        </div>
      )}

      {loading ? (
        <TableSkeleton columnWidths={["w-20", "w-16", "w-20", "w-28", "w-28", "w-28"]} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg text-center px-4">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
            <Play className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold">
            {runs.length > 0 ? "No runs match your filters" : "No test runs yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
            {runs.length > 0
              ? "Try adjusting your search, status, or date filters."
              : "Run a scenario to see results here."}
          </p>
          {runs.length === 0 && (
            <Link href="/scenarios" className="mt-4">
              <Button variant="outline">View Scenarios</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <div className="flex justify-end gap-2 p-3 border-b">
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0 || deleting}
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
              syncUrl({ status: statusFilter, q: search, page: p, pageSize });
            }}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
              syncUrl({ status: statusFilter, q: search, page: 1, pageSize: s });
            }}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44px]">
                  <Checkbox
                    checked={allPagedSelected}
                    onCheckedChange={toggleSelectAllPaged}
                    aria-label="Select all visible test runs"
                  />
                </TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead>Scenario</TableHead>
                <TableHead className="w-[100px] text-center">Turns</TableHead>
                <TableHead className="w-[100px] text-right">Duration</TableHead>
                <TableHead className="w-[170px] text-right">Created By</TableHead>
                <TableHead className="w-[100px] text-right">Date & Time</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((run) => {
                const href = withFrom(`/runs/${run.id}`, "/runs");
                return (
                  <TableRow
                    key={run.id}
                    className="group transition-colors hover:bg-muted/40"
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(run.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) =>
                            checked ? Array.from(new Set([...prev, run.id])) : prev.filter((id) => id !== run.id),
                          );
                        }}
                        aria-label={`Select run ${run.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={href}
                        className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                      >
                        <StatusBadge status={run.status} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={href}
                        className="font-medium text-primary group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                      >
                        {run.scenario_name || "Unknown Scenario"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      <Link href={href} className="block">
                        {run.passed_turns}/{run.total_turns}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      <Link href={href} className="block">
                        {formatDuration(run.duration_ms)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <Link href={href} className="block">
                        {run.owner_display_name || "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <Link href={href} className="block">
                        {formatRelativeTime(run.created_at)}
                      </Link>
                    </TableCell>
                    <TableCell className="w-8 pr-3">
                      <Link href={href} tabIndex={-1} aria-hidden="true" className="flex items-center justify-center">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
