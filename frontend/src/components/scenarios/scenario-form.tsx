"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "@/lib/icons";
import { api, type Agent, type AgentListItem, type Expectation, type Turn, type Scenario } from "@/lib/api";

interface TurnEditorProps {
  turn: Turn;
  index: number;
  onChange: (index: number, turn: Turn) => void;
  onRemove: (index: number) => void;
}

function TurnEditor({ turn, index, onChange, onRemove }: TurnEditorProps) {
  const addExpectation = () => {
    onChange(index, {
      ...turn,
      expectations: [
        ...turn.expectations,
        { type: "message", role: "assistant", intent: "" },
      ],
    });
  };

  const updateExpectation = (expIdx: number, exp: Expectation) => {
    const updated = [...turn.expectations];
    updated[expIdx] = exp;
    onChange(index, { ...turn, expectations: updated });
  };

  const removeExpectation = (expIdx: number) => {
    onChange(index, {
      ...turn,
      expectations: turn.expectations.filter((_, i) => i !== expIdx),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Turn {index + 1}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            User Input
          </Label>
          <Textarea
            value={turn.user_input}
            onChange={(e) =>
              onChange(index, { ...turn, user_input: e.target.value })
            }
            placeholder="What the user says to the agent..."
            rows={2}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">
              Expectations
            </Label>
            <Button variant="outline" size="sm" onClick={addExpectation}>
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>

          {turn.expectations.map((exp, expIdx) => (
            <div
              key={expIdx}
              className="flex gap-2 items-start rounded-md border p-3 bg-muted/20"
            >
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Select
                    value={exp.type}
                    onValueChange={(v: string | null) =>
                      v && updateExpectation(expIdx, {
                        ...exp,
                        type: v as Expectation["type"],
                      })
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="message">Message</SelectItem>
                      <SelectItem value="function_call">
                        Function Call
                      </SelectItem>
                      <SelectItem value="function_call_output">
                        Function Output
                      </SelectItem>
                      <SelectItem value="agent_handoff">
                        Agent Handoff
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {exp.type === "message" && (
                    <Select
                      value={exp.role || "assistant"}
                      onValueChange={(v: string | null) =>
                        updateExpectation(expIdx, { ...exp, role: v ?? undefined })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assistant">Assistant</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {exp.type === "function_call" && (
                    <Input
                      value={exp.function_name || ""}
                      onChange={(e) =>
                        updateExpectation(expIdx, {
                          ...exp,
                          function_name: e.target.value,
                        })
                      }
                      placeholder="Function name"
                      className="w-48"
                    />
                  )}
                </div>

                {(exp.type === "message" || exp.type === "function_call") && (
                  <Input
                    value={exp.intent || ""}
                    onChange={(e) =>
                      updateExpectation(expIdx, {
                        ...exp,
                        intent: e.target.value,
                      })
                    }
                    placeholder="LLM Judge intent — describe what the agent should do..."
                  />
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeExpectation(expIdx)}
                className="text-destructive hover:text-destructive mt-1"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ScenarioFormProps {
  initial?: Scenario;
}

export function ScenarioForm({ initial }: ScenarioFormProps) {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [agentId, setAgentId] = useState(initial?.agent_id || "");
  const [agentLoad, setAgentLoad] = useState<Agent | null>(null);
  const [agentModule, setAgentModule] = useState(
    initial?.agent_module || "test_agents.interview_agent"
  );
  const [agentClass, setAgentClass] = useState(
    initial?.agent_class || "TestableInterviewAgent"
  );
  const [llmModel, setLlmModel] = useState(initial?.llm_model || "gpt-4o-mini");
  const [judgeModel, setJudgeModel] = useState(
    initial?.judge_model || "gpt-4o-mini"
  );
  const [agentArgs, setAgentArgs] = useState<Record<string, unknown>>(
    initial?.agent_args ? { ...initial.agent_args } : {}
  );
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>(
    initial?.turns?.map((t) => ({
      user_input: t.user_input,
      expectations: t.expectations,
    })) || [
      {
        user_input: "",
        expectations: [
          { type: "message", role: "assistant", intent: "" },
        ],
      },
    ]
  );

  useEffect(() => {
    api.agents
      .list(activeWorkspaceId)
      .then(setAgents)
      .catch(() => setAgents([]));
  }, [activeWorkspaceId]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === agentId) || null,
    [agents, agentId]
  );

  useEffect(() => {
    if (!agentId) {
      setAgentLoad(null);
      return;
    }
    api.agents
      .get(agentId)
      .then((a) => {
        setAgentLoad(a);
        setAgentModule(a.module);
        setAgentClass(a.agent_class);
        setLlmModel(a.default_llm_model);
        setJudgeModel(a.default_judge_model);
        if (initial?.agent_id === agentId && initial?.agent_args) {
          setAgentArgs({ ...initial.agent_args });
        } else {
          setAgentArgs(a.default_agent_args ? { ...a.default_agent_args } : {});
        }
      })
      .catch(() => setAgentLoad(null));
  }, [agentId, initial?.agent_id, initial?.agent_args]);

  const updateTurn = (index: number, turn: Turn) => {
    const updated = [...turns];
    updated[index] = turn;
    setTurns(updated);
  };

  const removeTurn = (index: number) => {
    setTurns(turns.filter((_, i) => i !== index));
  };

  const addTurn = () => {
    setTurns([
      ...turns,
      {
        user_input: "",
        expectations: [{ type: "message", role: "assistant", intent: "" }],
      },
    ]);
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const data = {
        name,
        description: description || undefined,
        agent_id: agentId || null,
        agent_module: agentModule,
        agent_class: agentClass,
        llm_model: llmModel,
        judge_model: judgeModel,
        agent_args: Object.keys(agentArgs).length > 0 ? agentArgs : undefined,
        tags: tags.length > 0 ? tags : undefined,
        turns,
        workspace_id: activeWorkspaceId ?? undefined,
      };

      if (initial) {
        await api.scenarios.update(initial.id, data);
      } else {
        await api.scenarios.create(data);
      }
      router.push("/scenarios");
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {initial ? "Edit Scenario" : "New Scenario"}
          </h1>
          {!initial && (
            <p className="text-muted-foreground mt-1">
              Define conversation turns and expected agent behavior
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name || !agentId}>
            {saving ? "Saving…" : initial ? "Save Changes" : "Create Scenario"}
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Scenario Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Agent (required)</Label>
            {agents.length === 0 ? (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                No agents yet.{" "}
                <Link href="/agents" className="underline hover:no-underline">
                  Create an agent
                </Link>{" "}
                first before creating a scenario.
              </p>
            ) : (
              <>
                <Select
                  value={agentId}
                  onValueChange={(v: string | null) => setAgentId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!agentId && (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    You must select an agent to create or update a scenario.
                  </p>
                )}
                {selectedAgent && (
                  <p className="text-xs text-muted-foreground">
                    {selectedAgent.module}.{selectedAgent.agent_class}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Booking Flow - Happy Path"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this scenario test?"
              rows={2}
            />
          </div>

          {agentLoad?.arg_schema && agentLoad.arg_schema.length > 0 ? (
            <div className="space-y-3">
              <div>
                <Label>Scenario overrides</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional. Override constructor args for this scenario only.
                </p>
              </div>
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-4">
                {agentLoad.arg_schema.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={`arg-${field.name}`} className="text-sm">
                      {field.name}
                      {field.required && " *"}
                    </Label>
                    {field.type === "string" && (field.name === "interview_prompt" || field.name === "interview_context") ? (
                      <Textarea
                        id={`arg-${field.name}`}
                        value={String(agentArgs[field.name] ?? field.default ?? "")}
                        onChange={(e) =>
                          setAgentArgs((prev) => ({ ...prev, [field.name]: e.target.value || undefined }))
                        }
                        placeholder={field.default ? String(field.default) : undefined}
                        rows={4}
                        className="font-mono text-xs"
                      />
                    ) : field.type === "boolean" ? (
                      <Select
                        value={agentArgs[field.name] === true ? "true" : agentArgs[field.name] === false ? "false" : ""}
                        onValueChange={(v) =>
                          setAgentArgs((prev) => ({
                            ...prev,
                            [field.name]: v === "true" ? true : v === "false" ? false : undefined,
                          }))
                        }
                      >
                        <SelectTrigger id={`arg-${field.name}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`arg-${field.name}`}
                        type={field.type === "integer" || field.type === "number" ? "number" : "text"}
                        value={String(agentArgs[field.name] ?? field.default ?? "")}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (field.type === "integer") setAgentArgs((prev) => ({ ...prev, [field.name]: v ? parseInt(v, 10) : undefined }));
                          else if (field.type === "number") setAgentArgs((prev) => ({ ...prev, [field.name]: v ? parseFloat(v) : undefined }));
                          else setAgentArgs((prev) => ({ ...prev, [field.name]: v || undefined }));
                        }}
                        placeholder={field.default != null ? String(field.default) : undefined}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : agentLoad ? (
            <div className="space-y-3">
              <div>
                <Label>Scenario overrides</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional. Override constructor args for this scenario only.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 rounded-lg border border-border/60 bg-muted/5 p-4">
                <div className="space-y-2">
                  <Label htmlFor="candidate_name">candidate_name</Label>
                  <Input
                    id="candidate_name"
                    value={String(agentArgs["candidate_name"] ?? "")}
                    onChange={(e) =>
                      setAgentArgs((prev) => ({ ...prev, candidate_name: e.target.value || undefined }))
                    }
                    placeholder="e.g. Alice"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="interview_prompt">interview_prompt</Label>
                  <Textarea
                    id="interview_prompt"
                    value={String(agentArgs["interview_prompt"] ?? "")}
                    onChange={(e) =>
                      setAgentArgs((prev) => ({ ...prev, interview_prompt: e.target.value || undefined }))
                    }
                    placeholder="## Questions\n1. Tell me about yourself..."
                    rows={4}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="llm_model">LLM model</Label>
              <Select value={llmModel} onValueChange={(v: string | null) => v && setLlmModel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                  <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="judge_model">Judge model</Label>
              <Select value={judgeModel} onValueChange={(v: string | null) => v && setJudgeModel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                  <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add a tag..."
                className="w-48"
              />
              <Button variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                  >
                    {tag} &times;
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Conversation turns</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define what the user says and what you expect from the agent each turn.
            </p>
          </div>
          <Button variant="outline" onClick={addTurn} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Add turn
          </Button>
        </div>

        {turns.map((turn, idx) => (
          <TurnEditor
            key={idx}
            turn={turn}
            index={idx}
            onChange={updateTurn}
            onRemove={removeTurn}
          />
        ))}
      </div>

    </div>
  );
}
