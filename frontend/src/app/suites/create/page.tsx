"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type ScenarioListItem, type Suite } from "@/lib/api";
import { formatDateTime, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Search } from "@/lib/icons";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";
import { TablePagination } from "@/components/table-pagination";

export default function CreateSuitePage() {
  const router = useRouter();
  const { setItems } = useBreadcrumbs();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [scenariosError, setScenariosError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setItems([{ label: "Suites", href: "/suites" }, { label: "Create" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoadingScenarios(true);
    setScenariosError(null);
    void api.scenarios
      .list()
      .then((data) => setScenarios(data))
      .catch((e) => setScenariosError((e as Error).message || "Failed to load scenarios."))
      .finally(() => setLoadingScenarios(false));
  }, []);

  const filteredScenarios = useMemo(() => {
    let result = scenarios;
    const query = q.trim().toLowerCase();
    if (query) {
      result = result.filter((s) => s.name.toLowerCase().includes(query) || (s.description || "").toLowerCase().includes(query));
    }
    if (dateFilter) {
      result = result.filter((s) => {
        const d = new Date(s.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key === dateFilter;
      });
    }
    if (creatorFilter !== "all") {
      result = result.filter((s) => (s.owner_display_name || "Unknown") === creatorFilter);
    }
    return result;
  }, [scenarios, q, dateFilter, creatorFilter]);
  const creatorOptions = useMemo(
    () => Array.from(new Set(scenarios.map((s) => s.owner_display_name || "Unknown"))).sort(),
    [scenarios],
  );
  const creatorFilterLabel = creatorFilter === "all" ? "Created by: All" : `Created by: ${creatorFilter}`;

  const pagedScenarios = useMemo(
    () => paginate(filteredScenarios, page, pageSize),
    [filteredScenarios, page, pageSize],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredScenarios.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [filteredScenarios.length, page, pageSize]);

  const toggleScenario = (id: string) => {
    setSelectedScenarioIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreateError(null);
    setCreating(true);
    try {
      const suite: Suite = await api.suites.create({
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        scenario_ids: Array.from(selectedScenarioIds),
      });
      router.push(`/suites/${suite.id}`);
    } catch (e) {
      setCreateError((e as Error).message || "Failed to create suite.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Suite</h1>
          <p className="text-muted-foreground mt-1">Group scenarios into a reusable test suite.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/suites")} disabled={creating}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>

      {createError && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {createError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6 items-start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="suite-create-name">Name</Label>
            <Input
              id="suite-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Regression Suite"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="suite-create-desc">Description</Label>
            <Textarea
              id="suite-create-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this suite covers..."
              rows={4}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            Optionally select scenarios to include in the suite. Leave it empty to create an empty suite.
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <Input
                  placeholder="Search scenarios..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
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
                  setQ("");
                  setDateFilter("");
                  setCreatorFilter("all");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            </div>

            {loadingScenarios ? (
              <div className="p-6 text-sm text-muted-foreground">Loading scenarios...</div>
            ) : scenariosError ? (
              <div className="p-6 text-sm text-destructive">{scenariosError}</div>
            ) : (
              <>
                <TablePagination
                  totalItems={filteredScenarios.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onPageSizeChange={(s) => {
                    setPage(1);
                    setPageSize(s);
                  }}
                  pageSizeOptions={[5, 10, 20, 50]}
                />

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[44px]">Use</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[170px] text-right">Created By</TableHead>
                      <TableHead className="w-[190px] text-right">Created At</TableHead>
                      <TableHead className="w-[190px] text-right">Updated At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedScenarios.map((s) => {
                      const checked = selectedScenarioIds.has(s.id);
                      return (
                        <TableRow key={s.id} className="align-top">
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleScenario(s.id)}
                              aria-label={`Include scenario ${s.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{s.name}</div>
                            {s.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {s.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {s.owner_display_name || "Unknown"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDateTime(s.created_at)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDateTime(s.updated_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {filteredScenarios.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <div className="p-6 text-sm text-muted-foreground">No scenarios match your search.</div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium">Suite summary</div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedScenarioIds.size}</span> scenario
              {selectedScenarioIds.size !== 1 ? "s" : ""} selected
            </div>
            <div className="text-xs text-muted-foreground">
              Select scenarios if you want them included in the suite right away. Leaving all unchecked creates the suite with no scenarios.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

