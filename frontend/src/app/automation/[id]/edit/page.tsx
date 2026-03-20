"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";

export default function EditAutomationSchedulePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { setItems } = useBreadcrumbs();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState("1440");
  const [isActive, setIsActive] = useState("true");

  useEffect(() => {
    setItems([{ label: "Automation", href: "/automation" }, { label: "Edit" }]);
    api.automation.getSchedule(id)
      .then((s) => {
        setIntervalMinutes(String(s.interval_minutes));
        setIsActive(String(s.is_active));
      })
      .catch((e) => setError((e as Error).message || "Failed to load schedule."))
      .finally(() => setLoading(false));
  }, [id, setItems]);

  const onSave = async () => {
    const interval = Number(intervalMinutes);
    if (!Number.isFinite(interval) || interval < 5) return setError("Interval must be at least 5 minutes.");
    setSaving(true);
    setError(null);
    try {
      await api.automation.updateSchedule(id, {
        interval_minutes: interval,
        is_active: isActive === "true",
      });
      router.push("/automation");
    } catch (e) {
      setError((e as Error).message || "Failed to update schedule.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Schedule</h1>
          <p className="text-muted-foreground mt-1">Update schedule settings.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/automation"><Button variant="outline">Cancel</Button></Link>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>
      {error && <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">{error}</div>}
      <div className="border rounded-lg p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Interval (minutes)</Label>
            <Input value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={isActive} onValueChange={setIsActive}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

