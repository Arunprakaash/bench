"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type AgentCreate } from "@/lib/api";
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
import { Plus, Trash2 } from "@/lib/icons";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";

/** Suggested default args when module/class is the interview agent (pre-filled so "default args" are visible by default). */
const INTERVIEW_AGENT_DEFAULT_ARGS = {
  candidate_name: "Candidate",
  agent_name: "Sia",
};

const DEFAULT_ARGS_INITIAL = JSON.stringify(
  INTERVIEW_AGENT_DEFAULT_ARGS,
  null,
  2,
);
const REST_CONNECTOR_MODULE = "remote.http";
const REST_CONNECTOR_CLASS = "HttpJsonAgent";
const HTTP_JSON_CONNECTION_TEMPLATE = JSON.stringify(
  {
    endpoint: "https://example.com/agent/run",
    method: "POST",
    timeout_ms: 30000,
    headers: {
      Authorization: "Bearer REPLACE_ME",
    },
    events_path: "events",
    test_endpoint: "https://example.com/health",
    test_method: "GET",
  },
  null,
  2,
);

function KeyValueEditor({
  title,
  pairs,
  onChange,
}: {
  title: string;
  pairs: [string, string][];
  onChange: (pairs: [string, string][]) => void;
}) {
  const addPair = () => onChange([...pairs, ["", ""]]);
  const removePair = (index: number) => {
    const newPairs = [...pairs];
    newPairs.splice(index, 1);
    onChange(newPairs);
  };
  const updatePair = (index: number, key: string, value: string) => {
    const newPairs = [...pairs];
    newPairs[index] = [key, value];
    onChange(newPairs);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addPair}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {pairs.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-1">None</p>
        )}
        {pairs.map(([key, value], idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <Input
              value={key}
              onChange={(e) => updatePair(idx, e.target.value, value)}
              placeholder="Key"
              className="text-sm"
            />
            <Input
              value={value}
              onChange={(e) => updatePair(idx, key, e.target.value)}
              placeholder="Value"
              className="text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removePair(idx)}
              className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionConfigEditor({
  providerType,
  value,
  onChange,
}: {
  providerType: string;
  value: string;
  onChange: (newValue: string) => void;
}) {
  const [mode, setMode] = useState<"simple" | "advanced">(
    providerType === "rest_api" ? "simple" : "advanced",
  );

  useEffect(() => {
    if (providerType === "rest_api") {
      setMode("simple");
    } else {
      setMode("advanced");
    }
  }, [providerType]);

  let parsedConfig: Record<string, any> = {};
  try {
    parsedConfig = JSON.parse(value || "{}");
  } catch (e) {
    if (mode === "simple") setMode("advanced");
  }

  const updateField = (field: string, fieldValue: any) => {
    const newConfig = { ...parsedConfig, [field]: fieldValue };
    onChange(JSON.stringify(newConfig, null, 2));
  };

  const headers = Object.entries(parsedConfig.headers || {}).map(([k, v]) => [
    k,
    String(v),
  ]) as [string, string][];
  const payload = Object.entries(parsedConfig.payload || {}).map(([k, v]) => [
    k,
    typeof v === "object" ? JSON.stringify(v) : String(v),
  ]) as [string, string][];

  const updateHeaders = (pairs: [string, string][]) => {
    const obj: Record<string, string> = {};
    pairs.forEach(([k, v]) => {
      if (k.trim()) obj[k.trim()] = v;
    });
    updateField("headers", obj);
  };

  const updatePayload = (pairs: [string, string][]) => {
    const obj: Record<string, any> = {};
    pairs.forEach(([k, v]) => {
      if (k.trim()) {
        try {
          obj[k.trim()] = JSON.parse(v);
        } catch {
          obj[k.trim()] = v;
        }
      }
    });
    updateField("payload", obj);
  };

  if (providerType !== "rest_api" || mode === "advanced") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="agent-connection-config">
            Connection config (JSON)
          </Label>
          {providerType === "rest_api" && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setMode("simple")}
              className="h-auto p-0 text-xs"
            >
              Switch to Simple Mode
            </Button>
          )}
        </div>
        <Textarea
          id="agent-connection-config"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          className="font-mono text-sm"
          placeholder="{}"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 border rounded-lg p-6 bg-muted/30">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-sm font-semibold">REST API Connection</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Configure how the system talks to your remote agent.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMode("advanced")}
          className="h-8 text-xs"
        >
          Advanced (JSON)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="rest-endpoint">Endpoint URL</Label>
          <Input
            id="rest-endpoint"
            value={parsedConfig.endpoint || ""}
            onChange={(e) => updateField("endpoint", e.target.value)}
            placeholder="https://api.example.com/agent/run"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rest-method">HTTP Method</Label>
          <Select
            value={parsedConfig.method || "POST"}
            onValueChange={(v) => updateField("method", v)}
          >
            <SelectTrigger id="rest-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rest-timeout">Timeout (ms)</Label>
          <Input
            id="rest-timeout"
            type="number"
            value={parsedConfig.timeout_ms || 30000}
            onChange={(e) =>
              updateField("timeout_ms", parseInt(e.target.value) || 0)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rest-events-path">Events Path</Label>
          <Input
            id="rest-events-path"
            value={parsedConfig.events_path || "events"}
            onChange={(e) => updateField("events_path", e.target.value)}
            placeholder="e.g. data.items"
          />
          <p className="text-[10px] text-muted-foreground leading-tight">
            JSON path to the events array in the response (optional).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rest-test-endpoint">Test Endpoint</Label>
          <Input
            id="rest-test-endpoint"
            value={parsedConfig.test_endpoint || ""}
            onChange={(e) => updateField("test_endpoint", e.target.value)}
            placeholder="e.g. /health"
          />
          <p className="text-[10px] text-muted-foreground leading-tight">
            Optional URL for connection health check.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
        <KeyValueEditor
          title="Headers"
          pairs={headers}
          onChange={updateHeaders}
        />
        <KeyValueEditor
          title="Static Payload"
          pairs={payload}
          onChange={updatePayload}
        />
      </div>
    </div>
  );
}

function parseJsonObject(name: string, text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error(`${name} must be a JSON object`);
}

export default function NewAgentPage() {
  const router = useRouter();
  const { setItems } = useBreadcrumbs();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("test_agents.interview_agent");
  const [agentClass, setAgentClass] = useState("TestableInterviewAgent");
  const [providerType, setProviderType] = useState("local_python");
  const [defaultLlmModel, setDefaultLlmModel] = useState<string>("gpt-4o-mini");
  const [defaultJudgeModel, setDefaultJudgeModel] =
    useState<string>("gpt-4o-mini");
  const [defaultArgsText, setDefaultArgsText] = useState(DEFAULT_ARGS_INITIAL);
  const [connectionConfigText, setConnectionConfigText] = useState("{}");

  const isRestConnector = providerType === "rest_api";

  useEffect(() => {
    setItems([{ label: "Agents", href: "/agents" }, { label: "Create Agent" }]);
  }, [setItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    let default_agent_args: Record<string, unknown> = {};
    let connection_config: Record<string, unknown> = {};
    try {
      default_agent_args = parseJsonObject(
        "Default agent args",
        defaultArgsText,
      );
      connection_config = parseJsonObject(
        "Connection config",
        connectionConfigText,
      );
    } catch (err) {
      setError(`Invalid JSON — ${(err as Error).message}`);
      return;
    }

    if (!isRestConnector && (!module.trim() || !agentClass.trim())) {
      setError("Module and class are required.");
      return;
    }

    const payload: AgentCreate = {
      name: name.trim(),
      description: description.trim() || undefined,
      module: isRestConnector ? REST_CONNECTOR_MODULE : module.trim(),
      agent_class: isRestConnector ? REST_CONNECTOR_CLASS : agentClass.trim(),
      provider_type: providerType,
      connection_config: Object.keys(connection_config).length
        ? connection_config
        : {},
      default_llm_model: defaultLlmModel,
      default_judge_model: defaultJudgeModel,
      default_agent_args: Object.keys(default_agent_args).length
        ? default_agent_args
        : {},
    };

    setSubmitting(true);
    try {
      const created = await api.agents.create(payload);
      router.push(`/agents/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Agent</h1>
          <p className="text-muted-foreground mt-1">
            Add a new agent entrypoint and defaults for scenarios and Chat
            Builder.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/agents"
            className="text-sm text-muted-foreground hover:text-foreground mr-2"
          >
            Cancel
          </Link>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create Agent"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <section className="border rounded-lg p-6 space-y-4 bg-card">
          <h2 className="text-lg font-semibold border-b pb-2">Basic Info</h2>
          <div className="grid gap-4">
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
                rows={2}
                placeholder="What does this agent do?"
              />
            </div>
          </div>
        </section>

        <section className="border rounded-lg p-6 space-y-4 bg-card">
          <h2 className="text-lg font-semibold border-b pb-2">Connection</h2>
          <div className="space-y-6">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="agent-provider">Connector Type</Label>
              <Select
                value={providerType}
                onValueChange={(v) => {
                  setProviderType(v);
                  if (v === "rest_api" && connectionConfigText === "{}") {
                    setConnectionConfigText(HTTP_JSON_CONNECTION_TEMPLATE);
                  }
                }}
              >
                <SelectTrigger id="agent-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local_python">Local Python</SelectItem>
                  <SelectItem value="rest_api">REST API (External)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isRestConnector ? (
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                <div className="space-y-2">
                  <Label htmlFor="agent-module">Python Module</Label>
                  <Input
                    id="agent-module"
                    value={module}
                    onChange={(e) => setModule(e.target.value)}
                    placeholder="e.g. test_agents.interview_agent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-class">Class Name</Label>
                  <Input
                    id="agent-class"
                    value={agentClass}
                    onChange={(e) => setAgentClass(e.target.value)}
                    placeholder="e.g. TestableInterviewAgent"
                  />
                </div>
              </div>
            ) : (
              <ConnectionConfigEditor
                providerType={providerType}
                value={connectionConfigText}
                onChange={setConnectionConfigText}
              />
            )}
          </div>
        </section>

        <section className="border rounded-lg p-6 space-y-4 bg-card">
          <h2 className="text-lg font-semibold border-b pb-2">
            Model Defaults
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <Label>Default LLM Model</Label>
              <Select
                value={defaultLlmModel}
                onValueChange={setDefaultLlmModel}
              >
                <SelectTrigger>
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
              <Label>Default Judge Model</Label>
              <Select
                value={defaultJudgeModel}
                onValueChange={setDefaultJudgeModel}
              >
                <SelectTrigger>
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
        </section>

        <section className="border rounded-lg p-6 space-y-4 bg-card">
          <h2 className="text-lg font-semibold border-b pb-2">
            Advanced Parameters
          </h2>
          <div className="space-y-2">
            <Label htmlFor="agent-args">Default agent args (JSON)</Label>
            <Textarea
              id="agent-args"
              value={defaultArgsText}
              onChange={(e) => setDefaultArgsText(e.target.value)}
              rows={4}
              className="font-mono text-sm"
              placeholder="{}"
            />
            <p className="text-xs text-muted-foreground">
              Optional JSON object passed to the agent constructor.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
