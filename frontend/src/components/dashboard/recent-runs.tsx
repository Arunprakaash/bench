"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  getStatus,
  formatDuration,
  formatDateTime,
  paginate,
} from "@/lib/table-helpers";
import { withFrom } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/table-pagination";
import { Calendar, Search } from "@/lib/icons";
import type { TestRunListItem } from "@/lib/api";

const PAGE_SIZE = 10;
const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

interface RecentRunsProps {
  runs: TestRunListItem[];
}

export function RecentRuns({ runs }: RecentRunsProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [page, setPage] = useState(1);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    let result = runs;
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        (r.scenario_name || "").toLowerCase().includes(q),
      );
    }
    if (dateFilter) {
      result = result.filter((r) => {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key === dateFilter;
      });
    }
    if (creatorFilter !== "all") {
      result = result.filter(
        (r) => (r.owner_display_name || "Unknown") === creatorFilter,
      );
    }
    return result;
  }, [runs, search, statusFilter, dateFilter, creatorFilter]);
  const creatorOptions = useMemo(
    () =>
      Array.from(
        new Set(runs.map((r) => r.owner_display_name || "Unknown")),
      ).sort(),
    [runs],
  );
  const statusFilterLabel =
    statusFilter === "all" ? "Status: All" : `Status: ${statusFilter}`;
  const creatorFilterLabel =
    creatorFilter === "all" ? "Created by: All" : `Created by: ${creatorFilter}`;

  const paged = useMemo(
    () => paginate(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleStatus = (v: string | null) => {
    setStatusFilter(v ?? "all");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Recent Runs</h2>

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
            <span className="line-clamp-1">{statusFilterLabel}</span>
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
              setDateFilter(e.target.value);
              setPage(1);
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
            setCreatorFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue className="sr-only" placeholder="Created by" />
            <span className="line-clamp-1">{creatorFilterLabel}</span>
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
          }}
        >
          Clear filters
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-lg">
          <p className="text-sm text-muted-foreground">
            {runs.length > 0
              ? "No runs match your filters."
              : "No test runs yet. Create a scenario and run it."}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <TablePagination
            totalItems={filtered.length}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
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
                const href = withFrom(`/runs/${run.id}`, "/");
                return (
                  <TableRow key={run.id} className="group">
                    <TableCell>
                      <Link
                        href={href}
                        className={`flex items-center ${FOCUS_LINK}`}
                      >
                        <Badge variant="secondary" className={s.badgeClass}>
                          {run.status}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={href}
                        className={`font-medium text-primary group-hover:underline ${FOCUS_LINK}`}
                      >
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
