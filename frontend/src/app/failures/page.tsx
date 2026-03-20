"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getStatus, formatDate, formatDuration, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
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
import { TablePagination } from "@/components/table-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FailureInbox, Search, Trash2 } from "@/lib/icons";
import { api, type FailureInboxItem } from "@/lib/api";

const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

export default function FailuresPage() {
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
      <FailuresPageInner />
    </Suspense>
  );
}

function FailuresPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const qFromUrl = getParam(searchParams, "q") ?? "";
  const statusFromUrl = getParam(searchParams, "status") ?? "all";
  const pageFromUrl = getIntParam(searchParams, "page", 1);
  const pageSizeFromUrl = getIntParam(searchParams, "pageSize", DEFAULT_PAGE_SIZE);

  const [items, setItems] = useState<FailureInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState(qFromUrl);
  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [page, setPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setSearch(qFromUrl);
    setStatusFilter(statusFromUrl);
    setPage(pageFromUrl);
    setPageSize(pageSizeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl, statusFromUrl, pageFromUrl, pageSizeFromUrl]);

  const syncUrl = useCallback(
    (next: { q?: string; status?: string; page?: number; pageSize?: number }) => {
      const sp = new URLSearchParams(searchParams.toString());
      setOrDelete(sp, "q", next.q);
      setOrDelete(sp, "status", next.status && next.status !== "all" ? next.status : null);
      setOrDelete(sp, "page", next.page && next.page !== 1 ? next.page : null);
      setOrDelete(sp, "pageSize", next.pageSize && next.pageSize !== DEFAULT_PAGE_SIZE ? next.pageSize : null);
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    api.failures
      .list({ limit: 200 })
      .then(setItems)
      .catch((e) => {
        setLoadError((e as Error)?.message || "Failed to load failures.");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = items;
    if (statusFilter !== "all") result = result.filter((i) => i.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => (i.scenario_name || "").toLowerCase().includes(q));
    }
    return result;
  }, [items, search, statusFilter]);

  const paged = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);
  const pagedIds = useMemo(() => paged.map((item) => item.run_id), [paged]);
  const allPagedSelected = pagedIds.length > 0 && pagedIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.run_id === id)));
  }, [items]);

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
      `Delete ${selectedIds.length} selected run${selectedIds.length === 1 ? "" : "s"} from failures? This cannot be undone.`,
    );
    if (!ok) return;

    setDeleting(true);
    setLoadError(null);
    try {
      await Promise.all(selectedIds.map((id) => api.runs.delete(id)));
      setItems((prev) => prev.filter((item) => !selectedIds.includes(item.run_id)));
      setSelectedIds([]);
    } catch (e) {
      setLoadError((e as Error)?.message || "Failed to delete selected runs.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Failure Inbox</h1>
        <p className="text-muted-foreground mt-1">
          Recent failed and errored runs, with the first failing turn summary
        </p>
      </div>

      {loadError && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {loadError}{" "}
          <span className="text-muted-foreground">
            (Check `NEXT_PUBLIC_API_URL` and that the backend is running.)
          </span>
        </div>
      )}

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
              syncUrl({ q: v, status: statusFilter, page: 1, pageSize });
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
            syncUrl({ q: search, status: next, page: 1, pageSize });
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-lg">
          <FailureInbox className="h-12 w-12 text-primary/30 mb-4" />
          <h3 className="text-lg font-medium">
            {items.length > 0 ? "No failures match your filters" : "No failures yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length > 0 ? "Try adjusting your search or status filter." : "Run a suite or scenario to see failures here."}
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
              syncUrl({ q: search, status: statusFilter, page: p, pageSize });
            }}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
              syncUrl({ q: search, status: statusFilter, page: 1, pageSize: s });
            }}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44px]">
                  <Checkbox
                    checked={allPagedSelected}
                    onCheckedChange={toggleSelectAllPaged}
                    aria-label="Select all visible failures"
                  />
                </TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead>Scenario</TableHead>
                <TableHead className="w-[90px] text-center">Turn</TableHead>
                <TableHead>First failure</TableHead>
                <TableHead className="w-[110px] text-right">Duration</TableHead>
                <TableHead className="w-[140px] text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((it) => {
                const style = getStatus(it.status);
                const href = withFrom(
                  `/runs/${it.run_id}${it.first_failed_turn_index != null ? `?turn=${it.first_failed_turn_index}` : ""}`,
                  "/failures",
                );
                const turnLabel =
                  it.first_failed_turn_index != null ? `T${it.first_failed_turn_index + 1}` : "-";
                const snippet =
                  it.first_failed_error ||
                  it.first_failed_reasoning ||
                  it.first_failed_user_input ||
                  "";
                return (
                  <TableRow key={it.run_id} className="group">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(it.run_id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) =>
                            checked ? Array.from(new Set([...prev, it.run_id])) : prev.filter((id) => id !== it.run_id),
                          );
                        }}
                        aria-label={`Select failed run ${it.run_id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={href} className={`flex items-center ${FOCUS_LINK}`}>
                        <Badge variant="secondary" className={style.badgeClass}>
                          {it.status}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className={`font-medium text-primary group-hover:underline ${FOCUS_LINK}`}>
                        {it.scenario_name || "Unknown Scenario"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      <Link href={href} className={`block ${FOCUS_LINK}`}>
                        {turnLabel}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link href={href} className={`block max-w-[520px] truncate ${FOCUS_LINK}`}>
                        {snippet || "-"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      <Link href={href} className={`block ${FOCUS_LINK}`}>
                        {formatDuration(it.duration_ms)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <Link href={href} className={`block ${FOCUS_LINK}`}>
                        {formatDate(it.created_at)}
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

