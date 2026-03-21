"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, type Agent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";
import { MessageSquarePlus, Pencil, Trash2 } from "@/lib/icons";

const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

function connectorLabel(providerType?: string | null): string {
  if (!providerType || providerType === "local_python") return "local_python";
  if (providerType === "rest_api") return "REST API";
  return providerType;
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testConnectionMessage, setTestConnectionMessage] = useState<
    string | null
  >(null);
  const { setItems } = useBreadcrumbs();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setItems([]);
    api.agents
      .get(id)
      .then((a) => {
        setAgent(a);
        setItems([{ label: "Agents", href: "/agents" }, { label: a.name }]);
      })
      .catch((e) => {
        setError((e as Error).message);
        setAgent(null);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [id, setItems]);

  const handleDeleteClick = () => {
    setDeleteError(null);
    const ok = window.confirm(
      "Delete this agent? This action cannot be undone.",
    );
    if (!ok) return;
    void handleDeleteConfirm();
  };

  const handleDeleteConfirm = async () => {
    if (!agent) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.agents.delete(agent.id);
      router.push("/agents");
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!agent) return;
    setTestingConnection(true);
    setTestConnectionMessage(null);
    try {
      const out = await api.agents.testConnection(agent.id);
      const detail = out.detail ? ` - ${out.detail}` : "";
      setTestConnectionMessage(
        `Connection test ${out.ok ? "passed" : "failed"}${detail}`,
      );
    } catch (e) {
      setTestConnectionMessage(
        `Connection test failed - ${(e as Error).message}`,
      );
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-8 space-y-4">
        {error && (
          <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
            {error}
          </div>
        )}
        <p>Agent not found.</p>
        <Link
          href="/agents"
          className={`text-sm text-primary hover:underline ${FOCUS_LINK}`}
        >
          Back to Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
          {agent.description && (
            <p className="text-muted-foreground mt-1">{agent.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/agents/${agent.id}/edit`} className={FOCUS_LINK}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Link
            href={`/agents/chat?agentId=${agent.id}`}
            className={FOCUS_LINK}
          >
            <Button variant="outline">
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              Try in Chat Builder
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testingConnection}
          >
            {testingConnection ? "Testing..." : "Test Connection"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleDeleteClick}
            className="text-destructive hover:text-destructive"
            aria-label="Delete agent"
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {deleteError && (
        <p className="text-sm text-destructive border border-destructive/20 bg-destructive/5 rounded-lg p-3">
          {deleteError}
        </p>
      )}
      {testConnectionMessage && (
        <p className="text-sm border border-primary/20 bg-primary/5 text-primary rounded-lg p-3">
          {testConnectionMessage}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline">
          Connector: {connectorLabel(agent.provider_type)}
        </Badge>
        <Badge variant="outline">
          {agent.module}.{agent.agent_class}
        </Badge>
        <Badge variant="outline">LLM: {agent.default_llm_model}</Badge>
        <Badge variant="outline">Judge: {agent.default_judge_model}</Badge>
        {agent.tags?.map((t) => (
          <Badge
            key={t}
            variant="secondary"
            className="bg-primary/10 text-primary/80"
          >
            {t}
          </Badge>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Default agent args</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs rounded-lg border bg-muted/30 p-3 overflow-auto">
            {JSON.stringify(agent.default_agent_args || {}, null, 2)}
          </pre>
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Connection config</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs rounded-lg border bg-muted/30 p-3 overflow-auto">
            {JSON.stringify(agent.connection_config || {}, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
