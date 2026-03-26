"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type Scenario, type TestRunListItem } from "@/lib/api";
import { formatDuration, formatDate, formatRelativeTime, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { getIntParam, getParam, setOrDelete, withFrom } from "@/lib/nav";
import { ScenarioForm } from "@/components/scenarios/scenario-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Menu } from "@base-ui/react/menu";
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
import { ChevronRight, Play, Pencil, Trash2, Download, History } from "@/lib/icons";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";

const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

export default function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = getParam(searchParams, "tab") ?? "turns";
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [runs, setRuns] = useState<TestRunListItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<Array<{ version: number; created_at: string }>>([]);
  const [exporting, setExporting] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const { setItems } = useBreadcrumbs();

  const statusFromUrl = getParam(searchParams, "history_status") ?? "all";
  const pageFromUrl = getIntParam(searchParams, "history_page", 1);
  const pageSizeFromUrl = getIntParam(searchParams, "history_pageSize", DEFAULT_PAGE_SIZE);

  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [page, setPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);

  useEffect(() => {
    setStatusFilter(statusFromUrl);
    setPage(pageFromUrl);
    setPageSize(pageSizeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFromUrl, pageFromUrl, pageSizeFromUrl]);

  useEffect(() => {
    if (!id) return;
    setItems([]);
    Promise.all([
      api.scenarios.get(id),
      api.runs.list({ scenario_id: id, limit: 100 }),
    ]).then(([s, r]) => {
      setScenario(s);
      setRuns(r);
      setLoading(false);
      setItems([{ label: "Scenarios", href: "/scenarios" }, { label: s.name }]);
    });
  }, [id, setItems]);

  useEffect(() => {
    if (!id) return;
    api.scenarios.versions(id).then(setVersions).catch(() => setVersions([]));
  }, [id]);

  const handleRun = async () => {
    if (!scenario) return;
    setRunning(true);
    try {
      const run = await api.runs.create(scenario.id);
      router.push(withFrom(`/runs/${run.id}`, `/scenarios/${scenario.id}`));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = async () => {
    if (!scenario || !confirm("Delete this scenario?")) return;
    try {
      await api.scenarios.delete(scenario.id);
      router.push("/scenarios");
    } catch (e) {
      alert(`Failed to delete: ${(e as Error).message}`);
    }
  };

  const handleRestore = async (version: number) => {
    if (!scenario || !confirm(`Restore to v${version}? This will create a new version with the restored content.`)) return;
    setRestoringVersion(version);
    try {
      const restored = await api.scenarios.restoreVersion(scenario.id, version);
      setScenario(restored);
      api.scenarios.versions(scenario.id).then(setVersions).catch(() => {});
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRestoringVersion(null);
    }
  };

  const handleExport = async () => {
    if (!scenario) return;
    setExporting(true);
    try {
      const data = await api.scenarios.export(scenario.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${scenario.name.replaceAll(/[^a-z0-9-_]+/gi, "-").replaceAll(/-+/g, "-").replaceAll(/(^-|-$)/g, "") || "scenario"}-v${data.version}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === "all") return runs;
    return runs.filter((r) => r.status === statusFilter);
  }, [runs, statusFilter]);

  const paged = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);

  const syncUrl = useCallback(
    (next: { tab?: string; status?: string; page?: number; pageSize?: number }) => {
      const sp = new URLSearchParams(searchParams.toString());
      setOrDelete(sp, "tab", next.tab && next.tab !== "turns" ? next.tab : null);
      setOrDelete(sp, "history_status", next.status && next.status !== "all" ? next.status : null);
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

  const handleStatus = (v: string | null) => {
    const next = v ?? "all";
    setStatusFilter(next);
    setPage(1);
    syncUrl({ tab, status: next, page: 1, pageSize });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="p-8">
        <p>Scenario not found.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="p-8 space-y-6">
        <ScenarioForm initial={scenario} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {scenario.name}
          </h1>
          {scenario.description && (
            <p className="text-muted-foreground mt-1">
              {scenario.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting…" : "Export JSON"}
          </Button>

          <Menu.Root>
            <Menu.Trigger
              render={
                <Button variant="outline" className="min-w-52">
                  <History className="mr-2 h-4 w-4" />
                  Versions ({scenario.version})
                </Button>
              }
            />
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="end" sideOffset={4}>
                <Menu.Popup className="z-50 w-(--anchor-width) max-h-72 overflow-y-auto overflow-x-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Version history</div>
                  <Menu.Separator className="-mx-1 my-1 h-px bg-border" />
                  {versions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No versions yet.</div>
                  ) : (
                    versions.map((v) => {
                      const isCurrent = v.version === scenario.version;
                      const isRestoring = restoringVersion === v.version;
                      return (
                        <Menu.Item
                          key={v.version}
                          disabled={isCurrent || restoringVersion !== null}
                          onClick={() => !isCurrent && handleRestore(v.version)}
                          className="flex cursor-default items-center justify-between gap-4 rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                        >
                          <span className="tabular-nums font-medium">
                            v{v.version}
                            {isCurrent && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(current)</span>}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {isRestoring ? "Restoring…" : formatDate(v.created_at)}
                          </span>
                        </Menu.Item>
                      );
                    })
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>

          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button onClick={handleRun} disabled={running}>
            <Play className="mr-2 h-4 w-4" />
            {running ? "Running..." : "Run Test"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
            aria-label="Delete scenario"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline">
          {scenario.agent_name ?? `${scenario.agent_module}.${scenario.agent_class}`}
        </Badge>
        <Badge variant="outline">LLM: {scenario.llm_model}</Badge>
        <Badge variant="outline">Judge: {scenario.judge_model}</Badge>
        {scenario.tags?.map((t) => (
          <Badge key={t} variant="secondary" className="bg-primary/10 text-primary/80">{t}</Badge>
        ))}
      </div>

      <Tabs
        value={tab}
        onValueChange={(next) => {
          syncUrl({ tab: next, status: statusFilter, page, pageSize });
        }}
      >
        <TabsList>
          <TabsTrigger value="turns">Turns ({scenario.turns.length})</TabsTrigger>
          <TabsTrigger value="history">Run History ({runs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="turns" className="space-y-4 mt-4">
          {scenario.turns.map((turn) => (
            <Card key={turn.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Turn {turn.turn_index + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">
                    User says:
                  </span>
                  <p className="text-sm mt-1 bg-muted/50 rounded p-2">
                    &ldquo;{turn.user_input}&rdquo;
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Expectations:
                  </span>
                  <div className="space-y-1 mt-1">
                    {turn.expectations.map((exp, i) => (
                      <div
                        key={i}
                        className="text-sm flex items-center gap-2 bg-muted/30 rounded p-2"
                      >
                        <Badge variant="outline" className="text-xs shrink-0">
                          {exp.type}
                        </Badge>
                        {exp.role && (
                          <Badge variant="secondary" className="text-xs">
                            {exp.role}
                          </Badge>
                        )}
                        {exp.function_name && (
                          <code className="text-xs bg-muted px-1 rounded">
                            {exp.function_name}()
                          </code>
                        )}
                        {exp.intent && (
                          <span className="text-xs text-muted-foreground italic truncate">
                            &ldquo;{exp.intent}&rdquo;
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border rounded-lg text-center px-4">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                <Play className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold">No runs yet</h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                Click <span className="font-medium">Run Test</span> above to execute this scenario and see results here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={handleStatus}>
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
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
                  <p className="text-sm text-muted-foreground">No runs match your filters.</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <TablePagination
                    totalItems={filtered.length}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={(p) => {
                      setPage(p);
                      syncUrl({ tab, status: statusFilter, page: p, pageSize });
                    }}
                    onPageSizeChange={(s) => {
                      setPageSize(s);
                      setPage(1);
                      syncUrl({ tab, status: statusFilter, page: 1, pageSize: s });
                    }}
                  />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[130px]">Status</TableHead>
                        <TableHead className="w-[100px] text-center">Turns</TableHead>
                        <TableHead className="w-[100px] text-right">Duration</TableHead>
                        <TableHead className="w-[180px] text-right">Date</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((run) => {
                        const href = withFrom(`/runs/${run.id}`, `/scenarios/${scenario.id}`);
                        return (
                          <TableRow
                            key={run.id}
                            className="group transition-colors hover:bg-muted/40"
                          >
                            <TableCell>
                              <Link href={href} className={`flex items-center ${FOCUS_LINK}`}>
                                <StatusBadge status={run.status} />
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
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
