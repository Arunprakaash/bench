"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, type Agent, type AgentCreate } from "@/lib/api";
import { AGENT_MODEL_OPTIONS } from "@/lib/agent-models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft } from "@/lib/icons";

const REST_CONNECTOR_MODULE = "remote.http";
const REST_CONNECTOR_CLASS = "HttpJsonAgent";

function defaultArgsToText(
  args: Record<string, unknown> | null | undefined,
): string {
  if (args == null || Object.keys(args).length === 0) return "{}";
  return JSON.stringify(args, null, 2);
}

function objectToText(obj: Record<string, unknown> | null | undefined): string {
  if (obj == null || Object.keys(obj).length === 0) return "{}";
  return JSON.stringify(obj, null, 2);
}

function parseJsonObject(name: string, text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error(`${name} must be a JSON object`);
}

export default function EditAgentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("");
  const [agentClass, setAgentClass] = useState("");
  const [defaultLlmModel, setDefaultLlmModel] = useState<string>("gpt-4o-mini");
  const [defaultJudgeModel, setDefaultJudgeModel] =
    useState<string>("gpt-4o-mini");
  const [defaultArgsText, setDefaultArgsText] = useState("{}");
  const [providerType, setProviderType] = useState("local_python");
  const [connectionConfigText, setConnectionConfigText] = useState("{}");
  const [capabilitiesText, setCapabilitiesText] = useState("{}");
  const [authConfigText, setAuthConfigText] = useState("{}");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const isRestConnector = providerType === "http_json";

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.agents
      .get(id)
      .then((a) => {
        setAgent(a);
        setName(a.name);
        setDescription(a.description ?? "");
        setModule(a.module);
        setAgentClass(a.agent_class);
        setProviderType(a.provider_type || "local_python");
        setDefaultLlmModel(a.default_llm_model);
        setDefaultJudgeModel(a.default_judge_model);
        setDefaultArgsText(defaultArgsToText(a.default_agent_args));
        setConnectionConfigText(objectToText(a.connection_config));
        setCapabilitiesText(objectToText(a.capabilities));
        setAuthConfigText(objectToText(a.auth_config));
      })
      .catch((e) => {
        setError((e as Error).message);
        setAgent(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !agent) return;
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!isRestConnector && (!module.trim() || !agentClass.trim())) {
      setError("Module and class are required for local_python connectors.");
      return;
    }
    let default_agent_args: Record<string, unknown> = {};
    let connection_config: Record<string, unknown> = {};
    let capabilities: Record<string, unknown> = {};
    let auth_config: Record<string, unknown> = {};
    try {
      default_agent_args = parseJsonObject(
        "Default agent args",
        defaultArgsText,
      );
      connection_config = parseJsonObject(
        "Connection config",
        connectionConfigText,
      );
      capabilities = parseJsonObject("Capabilities", capabilitiesText);
      auth_config = parseJsonObject("Auth config", authConfigText);
    } catch (err) {
      setError(`Invalid JSON — ${(err as Error).message}`);
      return;
    }

    const payload: Partial<AgentCreate> = {
      name: name.trim(),
      description: description.trim() || undefined,
      module: isRestConnector ? REST_CONNECTOR_MODULE : module.trim(),
      agent_class: isRestConnector ? REST_CONNECTOR_CLASS : agentClass.trim(),
      provider_type: providerType,
      connection_config: Object.keys(connection_config).length
        ? connection_config
        : {},
      capabilities: Object.keys(capabilities).length ? capabilities : {},
      auth_config: Object.keys(auth_config).length ? auth_config : {},
      default_llm_model: defaultLlmModel,
      default_judge_model: defaultJudgeModel,
      default_agent_args: Object.keys(default_agent_args).length
        ? default_agent_args
        : {},
    };

    setSubmitting(true);
    try {
      await api.agents.update(id, payload);
      router.push(`/agents/${id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!id) return;
    setTestingConnection(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await api.agents.testConnection(id);
      const detail = result.detail ? ` - ${result.detail}` : "";
      setTestResult(
        `Connection test ${result.ok ? "passed" : "failed"}${detail}`,
      );
    } catch (err) {
      setTestResult(`Connection test failed - ${(err as Error).message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
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
        <Link href="/agents" className="text-sm text-primary hover:underline">
          ← Back to Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 w-full space-y-6">
      <div>
        <Link
          href={`/agents/${id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          {agent.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2">Edit Agent</h1>
        <p className="text-muted-foreground mt-1">
          Update agent entrypoint and defaults.
        </p>
      </div>

      {error && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}
      {testResult && (
        <div className="border border-primary/20 bg-primary/5 text-primary rounded-lg p-4 text-sm">
          {testResult}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="agent-name">Name</Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Interview Agent"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-desc">Description</Label>
          <Textarea
            id="agent-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent-provider">Connector</Label>
            <Select
              value={providerType}
              onValueChange={(v) => {
                if (!v) return;
                setProviderType(v);
                if (v === "http_json" && connectionConfigText.trim() === "{}") {
                  setConnectionConfigText(
                    JSON.stringify(
                      {
                        endpoint: "http://localhost:8000/agent/respond",
                        timeout_ms: 20000,
                      },
                      null,
                      2,
                    ),
                  );
                }
              }}
            >
              <SelectTrigger id="agent-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local_python">local_python</SelectItem>
                <SelectItem value="http_json">REST (HTTP JSON)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {isRestConnector ? (
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            REST connector auto-uses internal adapter identifiers (`module:{" "}
            {REST_CONNECTOR_MODULE}`, `class: {REST_CONNECTOR_CLASS}`).
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent-module">Module</Label>
              <Input
                id="agent-module"
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="e.g. test_agents.interview_agent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-class">Class</Label>
              <Input
                id="agent-class"
                value={agentClass}
                onChange={(e) => setAgentClass(e.target.value)}
                placeholder="e.g. TestableInterviewAgent"
              />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="agent-connection-config">
            Connection config (JSON)
          </Label>
          <Textarea
            id="agent-connection-config"
            value={connectionConfigText}
            onChange={(e) => setConnectionConfigText(e.target.value)}
            rows={8}
            className="font-mono text-sm"
            placeholder="{}"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent-capabilities">Capabilities (JSON)</Label>
            <Textarea
              id="agent-capabilities"
              value={capabilitiesText}
              onChange={(e) => setCapabilitiesText(e.target.value)}
              rows={4}
              className="font-mono text-sm"
              placeholder="{}"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-auth-config">Auth config (JSON)</Label>
            <Textarea
              id="agent-auth-config"
              value={authConfigText}
              onChange={(e) => setAuthConfigText(e.target.value)}
              rows={4}
              className="font-mono text-sm"
              placeholder="{}"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent-llm">Default LLM model</Label>
            <Select
              value={defaultLlmModel}
              onValueChange={(v) => v && setDefaultLlmModel(v)}
            >
              <SelectTrigger id="agent-llm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-judge">Default judge model</Label>
            <Select
              value={defaultJudgeModel}
              onValueChange={(v) => v && setDefaultJudgeModel(v)}
            >
              <SelectTrigger id="agent-judge" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-args">Default agent args (JSON)</Label>
          <Textarea
            id="agent-args"
            value={defaultArgsText}
            onChange={(e) => setDefaultArgsText(e.target.value)}
            rows={6}
            className="font-mono text-sm"
            placeholder="{}"
          />
          <p className="text-xs text-muted-foreground">
            Optional JSON object passed to the agent constructor. Use{" "}
            <code className="rounded bg-muted px-1">{"{}"}</code> for no
            defaults.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testingConnection}
          >
            {testingConnection ? "Testing…" : "Test Connection"}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
          <Link
            href={`/agents/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
