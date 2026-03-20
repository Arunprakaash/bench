"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, type RegressionAlert, type ScenarioListItem, type ScheduledRun, type SuiteListItem } from "@/lib/api";
import { formatDateTime, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";
import { Calendar, Pencil, Plus, Search, Trash2 } from "@/lib/icons";
import { TablePagination } from "@/components/table-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AutomationPage() {
  const { setItems } = useBreadcrumbs();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduledRun[]>([]);
  const [alerts, setAlerts] = useState<RegressionAlert[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [suites, setSuites] = useState<SuiteListItem[]>([]);

  const [search, setSearch] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [schedPage, setSchedPage] = useState(1);
  const [alertsPage, setAlertsPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const scenarioNameById = useMemo(
    () => new Map(scenarios.map((s) => [s.id, s.name])),
    [scenarios],
  );
  const suiteNameById = useMemo(
    () => new Map(suites.map((s) => [s.id, s.name])),
    [suites],
  );
  const filteredSchedules = useMemo(() => {
    let result = schedules;
    if (targetTypeFilter !== "all") {
      result = result.filter((s) => s.target_type === targetTypeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const target = s.target_type === "scenario" ? scenarioNameById.get(s.scenario_id ?? "") : suiteNameById.get(s.suite_id ?? "");
        return `${target ?? ""} ${s.target_type}`.toLowerCase().includes(q);
      });
    }
    if (dateFilter) {
      result = result.filter((s) => {
        const d = new Date(s.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key === dateFilter;
      });
    }
    return result;
  }, [schedules, search, scenarioNameById, suiteNameById, targetTypeFilter, dateFilter]);
  const filteredAlerts = useMemo(() => {
    let result = alerts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => `${a.title} ${a.detail ?? ""}`.toLowerCase().includes(q));
    }
    if (dateFilter) {
      result = result.filter((a) => {
        const d = new Date(a.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key === dateFilter;
      });
    }
    return result;
  }, [alerts, search, dateFilter]);
  const pagedSchedules = useMemo(() => paginate(filteredSchedules, schedPage, pageSize), [filteredSchedules, schedPage, pageSize]);
  const pagedAlerts = useMemo(() => paginate(filteredAlerts, alertsPage, pageSize), [filteredAlerts, alertsPage, pageSize]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSchedules, nextAlerts, nextScenarios, nextSuites] = await Promise.all([
        api.automation.listSchedules(),
        api.automation.listAlerts(false),
        api.scenarios.list(),
        api.suites.list(),
      ]);
      setSchedules(nextSchedules);
      setAlerts(nextAlerts);
      setScenarios(nextScenarios);
      setSuites(nextSuites);
    } catch (e) {
      setError((e as Error).message || "Failed to load automation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setItems([{ label: "Automation" }]);
    void load();
  }, [setItems]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automation</h1>
          <p className="text-muted-foreground mt-1">Scheduled runs and regression alerts.</p>
        </div>
        <Link href="/automation/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Schedule
          </Button>
        </Link>
      </div>

      {error && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
          <Input
            placeholder="Search schedules and alerts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSchedPage(1);
              setAlertsPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={targetTypeFilter}
          onValueChange={(v) => {
            setTargetTypeFilter(v ?? "all");
            setSchedPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue className="sr-only" placeholder="Target type" />
            <span className="line-clamp-1">
              {targetTypeFilter === "all" ? "Target type: All" : `Target type: ${targetTypeFilter}`}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All target types</SelectItem>
            <SelectItem value="scenario">Scenario</SelectItem>
            <SelectItem value="suite">Suite</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative w-[180px]">
          <Input
            ref={dateInputRef}
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setSchedPage(1);
              setAlertsPage(1);
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
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setTargetTypeFilter("all");
            setDateFilter("");
            setSchedPage(1);
            setAlertsPage(1);
          }}
        >
          Clear filters
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border rounded-lg overflow-hidden">
          <div className="p-4 border-b font-medium">Schedules</div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : filteredSchedules.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No schedules yet.</div>
          ) : (
            <>
            <TablePagination
              totalItems={filteredSchedules.length}
              page={schedPage}
              pageSize={pageSize}
              onPageChange={setSchedPage}
              onPageSizeChange={setPageSize}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Every</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSchedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.target_type === "scenario"
                        ? scenarioNameById.get(s.scenario_id ?? "") ?? "Scenario"
                        : suiteNameById.get(s.suite_id ?? "") ?? "Suite"}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {s.target_type}
                    </TableCell>
                    <TableCell>{s.interval_minutes}m</TableCell>
                    <TableCell>{formatDateTime(s.created_at)}</TableCell>
                    <TableCell>{formatDateTime(s.next_run_at)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/automation/${s.id}/edit`}>
                        <Button variant="outline" size="sm" className="mr-2">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          await api.automation.deleteSchedule(s.id);
                          await load();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="p-4 border-b font-medium">Regression alerts</div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No open alerts.</div>
          ) : (
            <>
            <TablePagination
              totalItems={filteredAlerts.length}
              page={alertsPage}
              pageSize={pageSize}
              onPageChange={setAlertsPage}
              onPageSizeChange={setPageSize}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedAlerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.title}</div>
                      {a.detail && <div className="text-xs text-muted-foreground">{a.detail}</div>}
                      <Link href={`/runs/${a.run_id}`} className="text-xs text-primary hover:underline">
                        View run
                      </Link>
                    </TableCell>
                    <TableCell>{formatDateTime(a.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await api.automation.acknowledgeAlert(a.id);
                          await load();
                        }}
                      >
                        Acknowledge
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

