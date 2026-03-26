"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useWorkspace } from "@/lib/workspace-context";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentRuns } from "@/components/dashboard/recent-runs";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";

export default function DashboardPage() {
  const { scenarios, runs, fetchScenarios, fetchRuns, loading } = useStore();
  const { activeWorkspaceId } = useWorkspace();

  useEffect(() => {
    fetchScenarios({ workspace_id: activeWorkspaceId });
    fetchRuns({ workspace_id: activeWorkspaceId, limit: 1000 });
  }, [fetchScenarios, fetchRuns, activeWorkspaceId]);

  if (loading) return <DashboardSkeleton />;

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
