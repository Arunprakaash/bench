"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { getStatus, formatDuration, formatDate, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { getIntParam, getParam, setOrDelete, withFrom } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
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
import { Play, Search, Trash2 } from "@/lib/icons";
import { api } from "@/lib/api";

export default function RunsPage() {
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
      <RunsPageInner />
    </Suspense>
  );
}

function RunsPageInner() {
  const { runs, fetchRuns, loading } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusFromUrl = getParam(searchParams, "status") ?? "all";
  const qFromUrl = getParam(searchParams, "q") ?? "";
  const pageFromUrl = getIntParam(searchParams, "page", 1);
  const pageSizeFromUrl = getIntParam(searchParams, "pageSize", DEFAULT_PAGE_SIZE);

  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [search, setSearch] = useState(qFromUrl);
  const [page, setPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
    const params: { status?: string; limit: number } = { limit: 200 };
    if (statusFilter !== "all") params.status = statusFilter;
    fetchRuns(params);
  }, [fetchRuns, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search) return runs;
    const q = search.toLowerCase();
    return runs.filter((r) => (r.scenario_name || "").toLowerCase().includes(q));
  }, [runs, search]);

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
          <Input
            placeholder="Search by scenario..."
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
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="passed">Passed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
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
          <Play className="h-12 w-12 text-primary/30 mb-4" />
          <h3 className="text-lg font-medium">No test runs found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {runs.length > 0 ? "Try adjusting your filters." : "Run a scenario to see results here."}
          </p>
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
                <TableHead className="w-[140px] text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((run) => {
                const s = getStatus(run.status);
                const href = withFrom(`/runs/${run.id}`, "/runs");
                return (
                  <TableRow
                    key={run.id}
                    className="group"
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
                        <Badge variant="secondary" className={s.badgeClass}>
                          {run.status}
                        </Badge>
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
                        {formatDate(run.created_at)}
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
