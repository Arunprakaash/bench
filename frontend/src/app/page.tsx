"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useWorkspace } from "@/lib/workspace-context";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentRuns } from "@/components/dashboard/recent-runs";

export default function DashboardPage() {
  const { scenarios, runs, fetchScenarios, fetchRuns } = useStore();
  const { activeWorkspaceId } = useWorkspace();

  useEffect(() => {
    fetchScenarios({ workspace_id: activeWorkspaceId });
    fetchRuns({ limit: 300, workspace_id: activeWorkspaceId });
  }, [fetchScenarios, fetchRuns, activeWorkspaceId]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your voice agent test results
        </p>
      </div>
      <StatsCards scenarios={scenarios} runs={runs} />
      <RecentRuns runs={runs} />
    </div>
  );
}
