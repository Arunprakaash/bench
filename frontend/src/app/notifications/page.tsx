"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type RegressionAlert } from "@/lib/api";
import { DEFAULT_PAGE_SIZE, formatDate, formatRelativeTime, paginate } from "@/lib/table-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";
import { TablePagination } from "@/components/table-pagination";
import { Search } from "@/lib/icons";

export default function NotificationsPage() {
  const { setItems } = useBreadcrumbs();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<RegressionAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const openAlerts = await api.automation.listAlerts(false);
      setAlerts(openAlerts);
    } catch (e) {
      setError((e as Error).message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setItems([{ label: "Notifications" }]);
    void load();
  }, [setItems]);

  const filtered = useMemo(() => {
    if (!search) return alerts;
    const q = search.toLowerCase();
    return alerts.filter((a) => `${a.title} ${a.detail ?? ""}`.toLowerCase().includes(q));
  }, [alerts, search]);

  const paged = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">Latest activity and alerts.</p>
        </div>
        <Button
          variant="outline"
          disabled={alerts.length === 0}
          onClick={async () => {
            await Promise.all(alerts.map((a) => api.automation.acknowledgeAlert(a.id)));
            await load();
          }}
        >
          Mark all as read
        </Button>
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
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg p-10 text-sm text-muted-foreground text-center">
          No new notifications.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <TablePagination
            totalItems={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Notification</TableHead>
                <TableHead className="w-[140px] text-right">Time</TableHead>
                <TableHead className="w-[220px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{a.title}</div>
                    {a.detail && <div className="text-xs text-muted-foreground mt-0.5">{a.detail}</div>}
                    <div className="text-xs text-muted-foreground mt-1">{formatDate(a.created_at)}</div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatRelativeTime(a.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link href={`/runs/${a.run_id}`}>
                        <Button size="sm" variant="outline">View run</Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await api.automation.acknowledgeAlert(a.id);
                          setAlerts((prev) => prev.filter((x) => x.id !== a.id));
                        }}
                      >
                        Mark read
                      </Button>
                    </div>
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

