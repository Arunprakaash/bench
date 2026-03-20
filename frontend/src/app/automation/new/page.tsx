"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type ScenarioListItem, type SuiteListItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";

export default function NewAutomationSchedulePage() {
  const router = useRouter();
  const { setItems } = useBreadcrumbs();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [suites, setSuites] = useState<SuiteListItem[]>([]);

  const [targetType, setTargetType] = useState<"scenario" | "suite">("scenario");
  const [scenarioId, setScenarioId] = useState("");
  const [suiteId, setSuiteId] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("1440");

  useEffect(() => {
    setItems([{ label: "Automation", href: "/automation" }, { label: "Create" }]);
    void Promise.all([api.scenarios.list(), api.suites.list()]).then(([sc, su]) => {
      setScenarios(sc);
      setSuites(su);
    });
  }, [setItems]);

  const scenarioOptions = useMemo(() => scenarios.map((s) => ({ value: s.id, label: s.name })), [scenarios]);
  const suiteOptions = useMemo(() => suites.map((s) => ({ value: s.id, label: s.name })), [suites]);
  const selectedScenarioLabel = useMemo(
    () => scenarioOptions.find((opt) => opt.value === scenarioId)?.label,
    [scenarioOptions, scenarioId],
  );
  const selectedSuiteLabel = useMemo(
    () => suiteOptions.find((opt) => opt.value === suiteId)?.label,
    [suiteOptions, suiteId],
  );

  const onCreate = async () => {
    const interval = Number(intervalMinutes);
    if (!Number.isFinite(interval) || interval < 5) {
      setError("Interval must be at least 5 minutes.");
      return;
    }
    if (targetType === "scenario" && !scenarioId) return setError("Select a scenario.");
    if (targetType === "suite" && !suiteId) return setError("Select a suite.");
    setSaving(true);
    setError(null);
    try {
      await api.automation.createSchedule({
        target_type: targetType,
        scenario_id: targetType === "scenario" ? scenarioId : undefined,
        suite_id: targetType === "suite" ? suiteId : undefined,
        interval_minutes: interval,
      });
      router.push("/automation");
    } catch (e) {
      setError((e as Error).message || "Failed to create schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Schedule</h1>
          <p className="text-muted-foreground mt-1">Add an automated scenario or suite run.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/automation"><Button variant="outline">Cancel</Button></Link>
          <Button onClick={onCreate} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
        </div>
      </div>

      {error && <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">{error}</div>}

      <div className="border rounded-lg p-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="space-y-2 lg:col-span-2">
            <Label>Target type</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as "scenario" | "suite")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scenario">Scenario</SelectItem>
                <SelectItem value="suite">Suite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-7">
            <Label>{targetType === "scenario" ? "Scenario" : "Suite"}</Label>
            {targetType === "scenario" ? (
              <Select value={scenarioId} onValueChange={setScenarioId}>
                <SelectTrigger className="w-full">
                  <SelectValue className="sr-only" placeholder="Select scenario" />
                  <span className="line-clamp-1">{selectedScenarioLabel ?? "Select scenario"}</span>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {scenarioOptions.map((opt) => <SelectItem key={opt.value} value={opt.value} className="truncate">{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Select value={suiteId} onValueChange={setSuiteId}>
                <SelectTrigger className="w-full">
                  <SelectValue className="sr-only" placeholder="Select suite" />
                  <span className="line-clamp-1">{selectedSuiteLabel ?? "Select suite"}</span>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {suiteOptions.map((opt) => <SelectItem key={opt.value} value={opt.value} className="truncate">{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2 lg:col-span-3">
            <Label>Interval (minutes)</Label>
            <Input value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Minimum interval is 5 minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

