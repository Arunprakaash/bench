"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  FlaskConical,
  Play,
  CheckCircle,
  XCircle,
  TrendingDown,
  TrendingUp,
} from "@/lib/icons";
import type { TestRunListItem, ScenarioListItem } from "@/lib/api";

interface StatsCardsProps {
  scenarios: ScenarioListItem[];
  runs: TestRunListItem[];
}

type Trend = { direction: "up" | "down" | "flat"; valuePct: number };

function pctChange(current: number, previous: number): Trend {
  if (previous <= 0 && current <= 0) return { direction: "flat", valuePct: 0 };
  if (previous <= 0) return { direction: "up", valuePct: 100 };
  const delta = ((current - previous) / previous) * 100;
  const valuePct = Math.round(Math.abs(delta));
  if (valuePct === 0) return { direction: "flat", valuePct: 0 };
  return { direction: delta >= 0 ? "up" : "down", valuePct };
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastNDaysKeys(n: number): string[] {
  const today = startOfDay(new Date());
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

function betweenDays(
  d: Date,
  daysAgoStart: number,
  daysAgoEndExclusive: number,
) {
  const t = startOfDay(new Date());
  const start = new Date(t);
  start.setDate(start.getDate() - daysAgoStart);
  const end = new Date(t);
  end.setDate(end.getDate() - daysAgoEndExclusive);
  return d >= start && d < end;
}

function trendFromRuns30(
  runs: TestRunListItem[],
  metric: (slice: TestRunListItem[]) => number,
): Trend {
  const dates = runs.map((r) => ({ r, d: new Date(r.created_at) }));
  const recent = dates
    .filter(({ d }) => betweenDays(d, 30, 0))
    .map(({ r }) => r);
  const prev = dates
    .filter(({ d }) => betweenDays(d, 60, 30))
    .map(({ r }) => r);
  return pctChange(metric(recent), metric(prev));
}

function trendFromScenarios30(scenarios: ScenarioListItem[]): Trend {
  const dates = scenarios.map((s) => new Date(s.created_at));
  const recent = dates.filter((d) => betweenDays(d, 30, 0)).length;
  const prev = dates.filter((d) => betweenDays(d, 60, 30)).length;
  return pctChange(recent, prev);
}

function seriesRunsPerDay(runs: TestRunListItem[], days = 14): number[] {
  const keys = lastNDaysKeys(days);
  const counts = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const r of runs) {
    const k = dayKey(new Date(r.created_at));
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return keys.map((k) => counts.get(k) || 0);
}

function seriesFailuresPerDay(runs: TestRunListItem[], days = 14): number[] {
  const keys = lastNDaysKeys(days);
  const counts = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const r of runs) {
    if (r.status !== "failed" && r.status !== "error") continue;
    const k = dayKey(new Date(r.created_at));
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return keys.map((k) => counts.get(k) || 0);
}

function seriesPassFailPerDay(
  runs: TestRunListItem[],
  days = 14,
): { passed: number[]; failed: number[] } {
  const keys = lastNDaysKeys(days);
  const passed = new Map<string, number>(keys.map((k) => [k, 0]));
  const failed = new Map<string, number>(keys.map((k) => [k, 0]));

  for (const r of runs) {
    const k = dayKey(new Date(r.created_at));
    if (!passed.has(k)) continue;
    if (r.status === "passed") passed.set(k, (passed.get(k) || 0) + 1);
    else if (r.status === "failed" || r.status === "error")
      failed.set(k, (failed.get(k) || 0) + 1);
  }

  return {
    passed: keys.map((k) => passed.get(k) || 0),
    failed: keys.map((k) => failed.get(k) || 0),
  };
}

function seriesScenariosCreatedPerDay(
  scenarios: ScenarioListItem[],
  days = 14,
): number[] {
  const keys = lastNDaysKeys(days);
  const counts = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const s of scenarios) {
    const k = dayKey(new Date(s.created_at));
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return keys.map((k) => counts.get(k) || 0);
}

function Bars({
  values,
  colorClass,
}: {
  values: number[];
  colorClass: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1.5 h-14">
      {values.map((v, i) => {
        const h = 8 + Math.round((v / max) * 44);
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full bg-muted/25 dark:bg-white/8",
              colorClass,
            )}
            style={{ height: `${h}px` }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function StackedBars({
  passed,
  failed,
}: {
  passed: number[];
  failed: number[];
}) {
  const max = Math.max(1, ...passed.map((p, i) => p + (failed[i] || 0)));

  return (
    <div className="flex items-end gap-1.5 h-14" aria-hidden="true">
      {passed.map((p, i) => {
        const f = failed[i] || 0;
        const total = p + f;
        const h = 8 + Math.round((total / max) * 44);
        const passedH =
          total === 0 ? 0 : Math.max(1, Math.round((p / total) * h));
        const failedH = Math.max(0, h - passedH);

        return (
          <div key={i} className="w-1.5 h-full flex items-end">
            <div className="w-1.5 flex flex-col justify-end gap-0 rounded-full overflow-hidden bg-muted/35 dark:bg-white/10">
              {failedH > 0 && (
                <div
                  style={{ height: `${failedH}px` }}
                  className="bg-red-500/35 dark:bg-red-500/55"
                />
              )}
              {passedH > 0 && (
                <div
                  style={{ height: `${passedH}px` }}
                  className="bg-green-500/40 dark:bg-green-500/55"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StatsCards({ scenarios, runs }: StatsCardsProps) {
  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.status === "passed").length;
  const failedRuns = runs.filter(
    (r) => r.status === "failed" || r.status === "error",
  ).length;
  const passRate =
    totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

  const scenariosTrend = trendFromScenarios30(scenarios);
  const totalRunsTrend = trendFromRuns30(runs, (slice) => slice.length);
  const passRateTrend = trendFromRuns30(runs, (slice) => {
    const total = slice.length;
    const passed = slice.filter((r) => r.status === "passed").length;
    return total > 0 ? Math.round((passed / total) * 100) : 0;
  });
  const failuresTrend = trendFromRuns30(
    runs,
    (slice) =>
      slice.filter((r) => r.status === "failed" || r.status === "error").length,
  );

  const scenariosSeries = seriesScenariosCreatedPerDay(scenarios, 7);
  const totalRunsSeries = seriesRunsPerDay(runs, 7);
  const passFailSeries = seriesPassFailPerDay(runs, 7);
  const failuresSeries = seriesFailuresPerDay(runs, 7);

  const stats: Array<{
    title: string;
    value: string;
    subtitle: string;
    icon: typeof FlaskConical;
    tone: "brand" | "success" | "danger";
    trend?: Trend;
    chart:
      | { type: "bars"; values: number[] }
      | { type: "stacked"; passed: number[]; failed: number[] };
  }> = [
    {
      title: "Scenarios",
      icon: FlaskConical,
      value: Intl.NumberFormat().format(scenarios.length),
      subtitle: "Test scenarios defined",
      tone: "brand",
      trend: scenariosTrend,
      chart: { type: "bars", values: scenariosSeries },
    },
    {
      title: "Total Runs",
      icon: Play,
      value: Intl.NumberFormat().format(totalRuns),
      subtitle: "Tests executed",
      tone: "brand",
      trend: totalRunsTrend,
      chart: { type: "bars", values: totalRunsSeries },
    },
    {
      title: "Pass Rate",
      icon: CheckCircle,
      value: `${passRate}%`,
      subtitle: `${Intl.NumberFormat().format(passedRuns)} passed`,
      tone: "success",
      trend: passRateTrend,
      chart: {
        type: "stacked",
        passed: passFailSeries.passed,
        failed: passFailSeries.failed,
      },
    },
    {
      title: "Failures",
      icon: XCircle,
      value: Intl.NumberFormat().format(failedRuns),
      subtitle: "Failed or errored",
      tone: "danger",
      trend: failuresTrend,
      chart: { type: "bars", values: failuresSeries },
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.title}
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/70 bg-card backdrop-blur-sm",
            "shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_40px_rgba(0,0,0,0.06)]",
          )}
        >
          {/* Single-tone light tint (no gradient) */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-0",
              stat.tone === "brand" && "bg-primary/5 dark:bg-primary/4",
              stat.tone === "success" && "bg-green-500/4 dark:bg-green-500/3",
              stat.tone === "danger" && "bg-red-500/4 dark:bg-red-500/3",
            )}
            aria-hidden="true"
          />
          <div className="relative z-10 p-5">
            <p className="text-sm font-semibold text-foreground/85 dark:text-foreground/90">
              {stat.title}
            </p>

            <div className="mt-3 flex items-end gap-2">
              <p className="text-4xl font-semibold tracking-tight tabular-nums">
                {stat.value}
              </p>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground dark:text-muted-foreground">
              {stat.trend && stat.trend.direction !== "flat" ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium",
                    stat.trend.direction === "up"
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300",
                  )}
                >
                  {stat.trend.direction === "up" ? (
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {stat.trend.valuePct}%
                </span>
              ) : (
                <span className="text-muted-foreground/70">—</span>
              )}
              <span>this month</span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {stat.subtitle}
            </p>
          </div>

          <div
            className={cn(
              "pointer-events-none absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset",
              stat.tone === "brand" &&
                "bg-primary/10 text-primary ring-primary/15",
              stat.tone === "success" &&
                "bg-green-500/10 text-green-600 dark:text-green-300 ring-green-500/15",
              stat.tone === "danger" &&
                "bg-red-500/10 text-red-600 dark:text-red-300 ring-red-500/15",
            )}
            aria-hidden="true"
          >
            <stat.icon className="h-4 w-4" />
          </div>

          <div
            className="pointer-events-none absolute right-5 bottom-4 z-10 opacity-60"
            aria-hidden="true"
          >
            {stat.chart.type === "stacked" ? (
              <StackedBars
                passed={stat.chart.passed}
                failed={stat.chart.failed}
              />
            ) : (
              <Bars
                values={stat.chart.values}
                colorClass={cn(
                  stat.tone === "brand" && "bg-primary/35 dark:bg-primary/60",
                  stat.tone === "success" &&
                    "bg-green-500/35 dark:bg-green-500/55",
                  stat.tone === "danger" && "bg-red-500/35 dark:bg-red-500/55",
                )}
              />
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
