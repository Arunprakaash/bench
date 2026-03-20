"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, type SuiteListItem } from "@/lib/api";
import { formatDate, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { getIntParam, getParam, setOrDelete } from "@/lib/nav";
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
import { FolderOpen, Play, Plus, Search, Trash2 } from "@/lib/icons";

const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

export default function SuitesPage() {
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
      <SuitesPageInner />
    </Suspense>
  );
}

function SuitesPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const qFromUrl = getParam(searchParams, "q") ?? "";
  const pageFromUrl = getIntParam(searchParams, "page", 1);
  const pageSizeFromUrl = getIntParam(searchParams, "pageSize", DEFAULT_PAGE_SIZE);

  const [suites, setSuites] = useState<SuiteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState(qFromUrl);
  const [page, setPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSearch(qFromUrl);
    setPage(pageFromUrl);
    setPageSize(pageSizeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl, pageFromUrl, pageSizeFromUrl]);

  useEffect(() => {
    loadSuites();
  }, []);

  const loadSuites = async () => {
    setLoadError(null);
    try {
      const data = await api.suites.list();
      setSuites(data);
    } catch (e) {
      setLoadError((e as Error).message || "Failed to load suites.");
      setSuites([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return suites;
    const q = search.toLowerCase();
    return suites.filter((s) => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q));
  }, [suites, search]);

  const paged = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);
  const pagedIds = useMemo(() => paged.map((suite) => suite.id), [paged]);
  const allPagedSelected = pagedIds.length > 0 && pagedIds.every((id) => selectedIds.includes(id));

  const syncUrl = useCallback(
    (next: { q?: string; page?: number; pageSize?: number }) => {
      const sp = new URLSearchParams(searchParams.toString());
      setOrDelete(sp, "q", next.q);
      setOrDelete(sp, "page", next.page && next.page !== 1 ? next.page : null);
      setOrDelete(sp, "pageSize", next.pageSize && next.pageSize !== DEFAULT_PAGE_SIZE ? next.pageSize : null);
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams],
  );

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    syncUrl({ q: v, page: 1, pageSize });
  };

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => suites.some((suite) => suite.id === id)));
  }, [suites]);

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
      `Delete ${selectedIds.length} selected suite${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!ok) return;

    setDeleting(true);
    setLoadError(null);
    try {
      await Promise.all(selectedIds.map((id) => api.suites.delete(id)));
      setSuites((prev) => prev.filter((suite) => !selectedIds.includes(suite.id)));
      setSelectedIds([]);
    } catch (e) {
      setLoadError((e as Error).message || "Failed to delete selected suites.");
    } finally {
      setDeleting(false);
    }
  };

  const handleRunSelected = async () => {
    if (selectedIds.length === 0 || running) return;
    setRunning(true);
    setLoadError(null);
    try {
      await Promise.all(selectedIds.map((id) => api.runs.createSuiteRun(id)));
      setSelectedIds([]);
      router.push("/runs");
    } catch (e) {
      setLoadError((e as Error).message || "Failed to run selected suites.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suites</h1>
          <p className="text-muted-foreground mt-1">
            Group scenarios into test suites
          </p>
        </div>
        <Button type="button" onClick={() => router.push("/suites/create")}>
          <Plus className="mr-2 h-4 w-4" />
          New Suite
        </Button>
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
            placeholder="Search suites..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-lg">
          <FolderOpen className="h-12 w-12 text-primary/30 mb-4" />
          <h3 className="text-lg font-medium">
            {suites.length > 0 ? "No suites match your search" : "No suites yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {suites.length > 0
              ? "Try adjusting your search."
              : "Create a suite to group related test scenarios."}
          </p>
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
              syncUrl({ q: search, page: p, pageSize });
            }}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
              syncUrl({ q: search, page: 1, pageSize: s });
            }}
          />
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44px]">
                  <Checkbox
                    checked={allPagedSelected}
                    onCheckedChange={toggleSelectAllPaged}
                    aria-label="Select all visible suites"
                  />
                </TableHead>
                <TableHead className="w-[50%]">Name</TableHead>
                <TableHead className="w-[100px] text-center">Scenarios</TableHead>
                <TableHead className="w-[140px] text-right">Created</TableHead>
                <TableHead className="w-[140px] text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((suite) => (
                <TableRow
                  key={suite.id}
                  className="group"
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(suite.id)}
                      onCheckedChange={(checked) => {
                        setSelectedIds((prev) =>
                          checked ? Array.from(new Set([...prev, suite.id])) : prev.filter((id) => id !== suite.id),
                        );
                      }}
                      aria-label={`Select suite ${suite.name}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-full">
                    <Link
                      href={`/suites/${suite.id}`}
                      className={`block truncate font-medium text-primary group-hover:underline ${FOCUS_LINK}`}
                    >
                      {suite.name}
                    </Link>
                    {suite.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {suite.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-muted-foreground">
                    <Link href={`/suites/${suite.id}`} className={`block ${FOCUS_LINK}`}>
                      {suite.scenario_count}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Link href={`/suites/${suite.id}`} className={`block ${FOCUS_LINK}`}>
                      {formatDate(suite.created_at)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Link href={`/suites/${suite.id}`} className={`block ${FOCUS_LINK}`}>
                      {formatDate(suite.updated_at)}
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
