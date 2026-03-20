"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { api, type Suite, type TestRunListItem } from "@/lib/api";
import { getStatus, formatDuration, formatDateTime, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { getIntParam, getParam, setOrDelete, withFrom } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  Play,
  Pencil,
  FlaskConical,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Trash2,
  Calendar,
} from "@/lib/icons";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

interface LiveStatus {
  run_id: string;
  scenario_id: string;
  status: "pending" | "running" | "passed" | "failed" | "error";
  duration_ms: number | null;
  passed_turns: number;
  total_turns: number;
}

export default function SuiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = getParam(searchParams, "tab") ?? "scenarios";
  const [suite, setSuite] = useState<Suite | null>(null);
  const [runs, setRuns] = useState<TestRunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [liveMap, setLiveMap] = useState<Map<string, LiveStatus>>(new Map());
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { setItems } = useBreadcrumbs();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setItems([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadError(null);
    Promise.all([api.suites.get(id), api.runs.list({ suite_id: id, limit: 50 })])
      .then(([s, r]) => {
        if (cancelled) return;
        setSuite(s);
        setRuns(r);
        setItems([{ label: "Suites", href: "/suites" }, { label: s.name }]);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError((e as Error).message || "Failed to load suite.");
        setSuite(null);
        setRuns([]);
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, setItems]);

  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("suite:start", (data: { suite_id: string; total: number }) => {
      if (data.suite_id !== id) return;
      setTotalCount(data.total);
      setCompletedCount(0);
    });

    socket.on("suite:scenario:start", (data: { suite_id: string; run_id: string }) => {
      if (data.suite_id !== id) return;
      setLiveMap((prev) => {
        const next = new Map(prev);
        for (const [key, val] of next) {
          if (val.run_id === data.run_id) {
            next.set(key, { ...val, status: "running" });
          }
        }
        return next;
      });
    });

    socket.on("suite:scenario:done", (data: {
      suite_id: string;
      run_id: string;
      status: string;
      duration_ms: number | null;
      passed_turns: number;
      total_turns: number;
    }) => {
      if (data.suite_id !== id) return;
      setLiveMap((prev) => {
        const next = new Map(prev);
        for (const [key, val] of next) {
          if (val.run_id === data.run_id) {
            next.set(key, {
              ...val,
              status: data.status as LiveStatus["status"],
              duration_ms: data.duration_ms,
              passed_turns: data.passed_turns,
              total_turns: data.total_turns,
            });
          }
        }
        return next;
      });
      setCompletedCount((c) => c + 1);
    });

    socket.on("suite:done", (data: { suite_id: string }) => {
      if (data.suite_id !== id) return;
      setRunning(false);
      setLiveMap(new Map());
      api.runs
        .list({ suite_id: id, limit: 50 })
        .then(setRuns)
        .catch(() => {});
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  const handleRunAll = useCallback(async () => {
    if (!suite) return;
    setRunning(true);
    setCompletedCount(0);

    try {
      const pendingRuns = await api.runs.createSuiteRun(suite.id);
      setTotalCount(pendingRuns.length);

      const map = new Map<string, LiveStatus>();
      for (const r of pendingRuns) {
        map.set(r.scenario_id, {
          run_id: r.id,
          scenario_id: r.scenario_id,
          status: "pending",
          duration_ms: null,
          passed_turns: 0,
          total_turns: 0,
        });
      }
      setLiveMap(map);
    } catch (e) {
      alert((e as Error).message);
      setRunning(false);
    }
  }, [suite]);

  const handleDeleteSuite = async () => {
    if (!suite) return;
    const ok = window.confirm(`Delete suite "${suite.name}"? This cannot be undone.`);
    if (!ok) return;

    setDeleteError(null);
    setDeleting(true);
    try {
      await api.suites.delete(suite.id);
      router.push("/suites");
    } catch (e) {
      setDeleteError((e as Error).message || "Failed to delete suite.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!suite) {
    return (
      <div className="p-8 space-y-4">
        {loadError && (
          <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
            {loadError}{" "}
            <span className="text-muted-foreground">
              (Check `NEXT_PUBLIC_API_URL` and that the backend is running.)
            </span>
          </div>
        )}
        <p>Suite not found.</p>
        <Link href="/suites" className={`text-sm text-primary hover:underline ${FOCUS_LINK}`}>
          Back to Suites
        </Link>
      </div>
    );
  }

  const latestBatch = groupRunsByBatch(runs);

  const getLiveOrHistoric = (scenarioId: string): LiveStatus | TestRunListItem | null => {
    return liveMap.get(scenarioId) ?? latestBatch.find((r) => r.scenario_id === scenarioId) ?? null;
  };

  const getScenarioStatus = (s: LiveStatus | TestRunListItem | null): string | null => {
    if (!s) return null;
    return s.status;
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{suite.name}</h1>
          {suite.description && (
            <p className="text-muted-foreground mt-1">{suite.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {running && (
            <span className="text-sm text-muted-foreground">
              {completedCount}/{totalCount}
            </span>
          )}
          <Link href={`/suites/${suite.id}/edit`}>
            <Button variant="outline" size="lg">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button onClick={handleRunAll} disabled={running} size="lg">
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {running ? "Running..." : "Run All"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void handleDeleteSuite()}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
            aria-label="Delete suite"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {deleteError && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {deleteError}
        </div>
      )}

      <div className="flex gap-2">
        <Badge variant="outline" className="text-xs">
          <FlaskConical className="h-3 w-3 mr-1" />
          {suite.scenarios.length} scenario{suite.scenarios.length !== 1 ? "s" : ""}
        </Badge>
        {runs.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {runs.length} run{runs.length !== 1 ? "s" : ""} total
          </Badge>
        )}
      </div>

      {running && totalCount > 0 && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(next) => {
          const sp = new URLSearchParams(searchParams.toString());
          setOrDelete(sp, "tab", next !== "scenarios" ? next : null);
          const qs = sp.toString();
          router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
        }}
      >
        <TabsList>
          <TabsTrigger value="scenarios">
            Scenarios ({suite.scenarios.length})
          </TabsTrigger>
          <TabsTrigger value="results">
            Results ({latestBatch.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            History ({runs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="mt-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Status</TableHead>
                  <TableHead className="w-[40%]">Name</TableHead>
                  <TableHead className="w-[80px] text-center">Turns</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-[120px] text-right">Last Run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suite.scenarios.map((scenario) => {
                  const info = getLiveOrHistoric(scenario.id);
                  const status = getScenarioStatus(info);
                  const style = getStatus(status || "pending");
                  const href = `/scenarios/${scenario.id}`;
                  return (
                    <TableRow key={scenario.id} className="group">
                      <TableCell>
                        <Link
                          href={href}
                          className={`inline-flex items-center ${FOCUS_LINK}`}
                        >
                          <Badge variant="secondary" className={style.badgeClass}>
                            {status || "pending"}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={href} className={`font-medium text-primary group-hover:underline ${FOCUS_LINK}`}>
                          {scenario.name}
                        </Link>
                        {scenario.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {scenario.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground">
                        <Link href={href} className={`block ${FOCUS_LINK}`}>
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
                      <TableCell className="text-right text-xs text-muted-foreground">
                        <Link href={href} className={`block ${FOCUS_LINK}`}>
                          {info && "passed_turns" in info ? (
                            status === "running" ? (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">Running...</span>
                            ) : status === "pending" ? (
                              <span className="text-muted-foreground">Pending</span>
                            ) : (
                              <span>
                                {info.passed_turns}/{info.total_turns} passed
                                {info.duration_ms ? ` · ${(info.duration_ms / 1000).toFixed(1)}s` : ""}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          {latestBatch.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border rounded-lg">
              <Play className="h-12 w-12 text-primary/30 mb-4" />
              <p className="text-sm text-muted-foreground">
                No results yet. Click &quot;Run All&quot; to execute every scenario.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <SuiteResultsSummary runs={latestBatch} />
              <RunsTable runs={latestBatch} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border rounded-lg">
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            </div>
          ) : (
            <RunsTable runs={runs} showFilters showPagination />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SuiteResultsSummary({ runs }: { runs: TestRunListItem[] }) {
  const passed = runs.filter((r) => r.status === "passed").length;
  const failed = runs.filter((r) => r.status === "failed" || r.status === "error").length;
  const total = runs.length;
  const totalDuration = runs.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0);
  const allPassed = passed === total;

  return (
    <div
      className={`rounded-lg border p-4 ${
        allPassed
          ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
          : "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {allPassed ? (
            <CheckCircle className="h-6 w-6 text-green-500" />
          ) : (
            <XCircle className="h-6 w-6 text-red-500" />
          )}
          <div>
            <p className="font-semibold text-sm">
              {allPassed ? "All scenarios passed" : `${failed} scenario${failed !== 1 ? "s" : ""} failed`}
            </p>
            <p className="text-xs text-muted-foreground">
              {passed}/{total} passed · {(totalDuration / 1000).toFixed(1)}s total
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {runs.map((r) => (
            <Tooltip key={r.id}>
              <TooltipTrigger
                render={
                  <div
                    className={`h-3 w-3 rounded-full ${
                      r.status === "passed"
                        ? "bg-green-400"
                        : r.status === "failed" || r.status === "error"
                          ? "bg-red-400"
                          : "bg-gray-300"
                    }`}
                  />
                }
              />
              <TooltipContent>{r.scenario_name ?? "Scenario"}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}

function RunsTable({
  runs,
  showFilters = false,
  showPagination = false,
}: {
  runs: TestRunListItem[];
  showFilters?: boolean;
  showPagination?: boolean;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const qFromUrl = getParam(searchParams, "history_q") ?? "";
  const statusFromUrl = getParam(searchParams, "history_status") ?? "all";
  const dateFromUrl = getParam(searchParams, "history_date") ?? "";
  const creatorFromUrl = getParam(searchParams, "history_creator") ?? "all";
  const pageFromUrl = getIntParam(searchParams, "history_page", 1);
  const pageSizeFromUrl = getIntParam(searchParams, "history_pageSize", DEFAULT_PAGE_SIZE);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showFilters && !showPagination) return;
    setSearch(qFromUrl);
    setStatusFilter(statusFromUrl);
    setDateFilter(dateFromUrl);
    setCreatorFilter(creatorFromUrl);
    setPage(pageFromUrl);
    setPageSize(pageSizeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl, statusFromUrl, dateFromUrl, creatorFromUrl, pageFromUrl, pageSizeFromUrl, showFilters, showPagination]);

  const syncUrl = useCallback(
    (next: { q?: string; status?: string; date?: string; creator?: string; page?: number; pageSize?: number }) => {
      const sp = new URLSearchParams(searchParams.toString());
      setOrDelete(sp, "history_q", next.q);
      setOrDelete(sp, "history_status", next.status && next.status !== "all" ? next.status : null);
      setOrDelete(sp, "history_date", next.date || null);
      setOrDelete(sp, "history_creator", next.creator && next.creator !== "all" ? next.creator : null);
      setOrDelete(sp, "history_page", next.page && next.page !== 1 ? next.page : null);
      setOrDelete(
        sp,
        "history_pageSize",
        next.pageSize && next.pageSize !== DEFAULT_PAGE_SIZE ? next.pageSize : null,
      );
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams],
  );

  const filtered = useMemo(() => {
    let result = runs;
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
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
  }, [runs, search, statusFilter, dateFilter, creatorFilter]);
  const creatorOptions = useMemo(
    () => Array.from(new Set(runs.map((r) => r.owner_display_name || "Unknown"))).sort(),
    [runs],
  );

  const paged = useMemo(
    () => (showPagination ? paginate(filtered, page, pageSize) : filtered),
    [filtered, page, pageSize, showPagination],
  );

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    syncUrl({ q: v, status: statusFilter, date: dateFilter, creator: creatorFilter, page: 1, pageSize });
  };
  const handleStatus = (v: string | null) => {
    const next = v ?? "all";
    setStatusFilter(next);
    setPage(1);
    syncUrl({ q: search, status: next, date: dateFilter, creator: creatorFilter, page: 1, pageSize });
  };

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
            <Input
              placeholder="Search by scenario..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue className="sr-only" placeholder="Status" />
              <span className="line-clamp-1">
                {statusFilter === "all" ? "Status: All" : `Status: ${statusFilter}`}
              </span>
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
                const next = e.target.value;
                setDateFilter(next);
                setPage(1);
                syncUrl({ q: search, status: statusFilter, date: next, creator: creatorFilter, page: 1, pageSize });
              }}
              className="w-full pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none"
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
              const next = v ?? "all";
              setCreatorFilter(next);
              setPage(1);
              syncUrl({ q: search, status: statusFilter, date: dateFilter, creator: next, page: 1, pageSize });
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue className="sr-only" placeholder="Created by" />
              <span className="line-clamp-1">
                {creatorFilter === "all" ? "Created by: All" : `Created by: ${creatorFilter}`}
              </span>
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
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setDateFilter("");
              setCreatorFilter("all");
              setPage(1);
              syncUrl({ q: "", status: "all", date: "", creator: "all", page: 1, pageSize });
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
          <p className="text-sm text-muted-foreground">No runs match your filters.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          {showPagination && (
            <TablePagination
              totalItems={filtered.length}
              page={page}
              pageSize={pageSize}
              onPageChange={(p) => {
                setPage(p);
                syncUrl({ q: search, status: statusFilter, date: dateFilter, creator: creatorFilter, page: p, pageSize });
              }}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
                syncUrl({ q: search, status: statusFilter, date: dateFilter, creator: creatorFilter, page: 1, pageSize: s });
              }}
            />
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead>Scenario</TableHead>
                <TableHead className="w-[100px] text-center">Turns</TableHead>
                <TableHead className="w-[100px] text-right">Duration</TableHead>
                <TableHead className="w-[170px] text-right">Created By</TableHead>
                <TableHead className="w-[190px] text-right">Date & Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((run) => {
                const s = getStatus(run.status);
                const href = withFrom(`/runs/${run.id}`, `/suites/${params.id}`);
                return (
                  <TableRow
                    key={run.id}
                    className="group"
                  >
                    <TableCell>
                      <Link href={href} className={`flex items-center ${FOCUS_LINK}`}>
                        <Badge variant="secondary" className={s.badgeClass}>
                          {run.status}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className={`font-medium text-primary group-hover:underline ${FOCUS_LINK}`}>
                        {run.scenario_name || "Unknown Scenario"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      <Link href={href} className={`block ${FOCUS_LINK}`}>
                        {run.passed_turns}/{run.total_turns}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      <Link href={href} className={`block ${FOCUS_LINK}`}>
                        {formatDuration(run.duration_ms)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <Link href={href} className={`block ${FOCUS_LINK}`}>
                        {run.owner_display_name || "Unknown"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <Link href={href} className={`block ${FOCUS_LINK}`}>
                        {formatDateTime(run.created_at)}
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

function groupRunsByBatch(runs: TestRunListItem[]): TestRunListItem[] {
  if (runs.length === 0) return [];
  const sorted = [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const latestTime = new Date(sorted[0].created_at).getTime();
  return sorted.filter(
    (r) => Math.abs(new Date(r.created_at).getTime() - latestTime) < 5000
  );
}
