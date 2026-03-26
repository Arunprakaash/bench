"use client";

import React, { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { getAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2,
  SendHorizontal,
  X,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Bench logo ───────────────────────────────────────────────────────────────

function BenchLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="6.5" cy="6.5" r="2.7" fill="currentColor" />
      <circle cx="17.5" cy="6.5" r="2.7" fill="currentColor" />
      <circle cx="12" cy="17.5" r="2.7" fill="currentColor" />
      <path
        d="M8.5 8.2L10.5 12.2M15.5 8.2L13.5 12.2M9.8 15.4H14.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolEvent = {
  name: string;
  label: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  done: boolean;
};

type ElicitationFieldDef = {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "email" | "textarea";
  description?: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

type ElicitationRequest = {
  message: string;
  fields: ElicitationFieldDef[];
};

type TextBlock = { kind: "text"; content: string };
type ToolBlock = { kind: "tool"; tool: ToolEvent };
type Block = TextBlock | ToolBlock;

type UserMessage = { id: string; role: "user"; content: string };
type AssistantMessage = {
  id: string;
  role: "assistant";
  blocks: Block[];
  streaming: boolean;
  elicitation?: ElicitationRequest;
  elicitationDone?: boolean;
};
type Message = UserMessage | AssistantMessage;

function uid() {
  return Math.random().toString(36).slice(2);
}

function assistantText(msg: AssistantMessage): string {
  return msg.blocks
    .filter((b): b is TextBlock => b.kind === "text")
    .map((b) => b.content)
    .join("");
}

function toConversationMessages(messages: Message[]) {
  return messages.map((m) => ({
    role: m.role,
    content: m.role === "assistant" ? assistantText(m) : m.content,
  }));
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code
          key={i}
          className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.8em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre
          key={`code-${i}`}
          className="my-2 overflow-x-auto rounded-md bg-black/10 dark:bg-white/5 p-3 font-mono text-xs whitespace-pre"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      i++;
      continue;
    }

    const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = [
        "mt-2 text-sm font-bold",
        "mt-1.5 text-sm font-semibold",
        "mt-1 text-sm font-medium",
      ][level - 1];
      nodes.push(
        <p key={`h-${i}`} className={cls}>
          {renderInline(hMatch[2])}
        </p>,
      );
      i++;
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5 pl-4">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      const firstMatch = line.match(/^(\d+)\./);
      const start = firstMatch ? parseInt(firstMatch[1]) : 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      nodes.push(
        <ol
          key={`ol-${i}`}
          className="my-1 list-decimal space-y-0.5 pl-5"
          start={start}
        >
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (!line.trim()) {
      nodes.push(<div key={`br-${i}`} className="h-1" />);
      i++;
      continue;
    }

    nodes.push(<p key={`p-${i}`}>{renderInline(line)}</p>);
    i++;
  }

  return <div className="space-y-0.5 text-sm leading-relaxed">{nodes}</div>;
}

// ─── Elicitation form ─────────────────────────────────────────────────────────

function ElicitationForm({
  elicitation,
  onSubmit,
  onDismiss,
}: {
  elicitation: ElicitationRequest;
  onSubmit: (data: Record<string, unknown>) => void;
  onDismiss: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    for (const f of elicitation.fields) {
      defaults[f.name] = f.type === "boolean" ? false : "";
    }
    return defaults;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/60 placeholder:text-muted-foreground/60";

  return (
    <div className="mt-2 rounded-xl border border-primary/25 bg-background/80 p-3 shadow-sm backdrop-blur-sm">
      <p className="mb-2.5 text-xs font-medium text-foreground">
        {elicitation.message}
      </p>
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {elicitation.fields.map((field) => (
          <div key={field.name}>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {field.label}
              {field.required && (
                <span className="ml-0.5 text-destructive">*</span>
              )}
            </label>
            {field.description && (
              <p className="mb-1 text-[10px] text-muted-foreground/70">
                {field.description}
              </p>
            )}
            {field.type === "boolean" ? (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={field.name}
                  checked={Boolean(values[field.name])}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [field.name]: e.target.checked }))
                  }
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <label htmlFor={field.name} className="text-xs text-foreground">
                  {field.label}
                </label>
              </div>
            ) : field.type === "select" ? (
              <select
                value={String(values[field.name] ?? "")}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                required={field.required}
                className={inputCls}
              >
                <option value="">Select…</option>
                {field.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                value={String(values[field.name] ?? "")}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                required={field.required}
                rows={3}
                className={cn(inputCls, "resize-none")}
              />
            ) : (
              <input
                type={
                  field.type === "number"
                    ? "number"
                    : field.type === "email"
                      ? "email"
                      : "text"
                }
                value={String(values[field.name] ?? "")}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                required={field.required}
                className={inputCls}
              />
            )}
          </div>
        ))}
        <div className="flex gap-2 pt-0.5">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Submit
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            Dismiss
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Tool indicator ───────────────────────────────────────────────────────────

function ToolIndicator({ tool }: { tool: ToolEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isScenario = tool.name === "create_scenario" && tool.result?.id;
  const isSuite = tool.name === "create_suite" && tool.result?.id;
  const hasDetails = tool.done && (tool.input || tool.result);

  return (
    <div
      className={cn(
        "w-full rounded-md border text-xs",
        tool.done
          ? "border-border bg-muted/40 text-muted-foreground"
          : "border-primary/20 bg-primary/5 text-primary",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        {!tool.done && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
        <span className="flex-1">
          {tool.label.replace("…", tool.done ? "…" : "…")}
        </span>
        {isScenario && (
          <Link
            href={`/scenarios/${tool.result!.id}`}
            className="text-primary underline hover:opacity-80"
          >
            View
          </Link>
        )}
        {isSuite && (
          <Link
            href={`/suites/${tool.result!.id}`}
            className="text-primary underline hover:opacity-80"
          >
            View
          </Link>
        )}
        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto flex h-4 w-4 items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUpIcon className="h-3 w-3" />
            ) : (
              <ChevronDownIcon className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
      {expanded && hasDetails && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {tool.input && Object.keys(tool.input).length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">
                Input
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-black/5 dark:bg-white/5 p-2 font-mono text-[10px]">
                {JSON.stringify(tool.input, null, 2)}
              </pre>
            </div>
          )}
          {tool.result && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">
                Output
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-black/5 dark:bg-white/5 p-2 font-mono text-[10px]">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onElicitationSubmit,
  onElicitationDismiss,
}: {
  message: Message;
  onElicitationSubmit: (msgId: string, data: Record<string, unknown>) => void;
  onElicitationDismiss: (msgId: string) => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="w-full bg-muted/40 px-4 py-2.5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          You
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>
      </div>
    );
  }

  const blocks = message.blocks ?? [];
  const hasContent = blocks.some((b) => b.kind === "text" && b.content);
  const isEmpty = blocks.length === 0;

  return (
    <div className="w-full px-4 py-2.5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
        Bench Agent
      </p>
      <div className="space-y-2">
        {blocks.map((block, i) =>
          block.kind === "tool" ? (
            <ToolIndicator key={i} tool={block.tool} />
          ) : block.content ? (
            <MarkdownContent key={i} content={block.content} />
          ) : null,
        )}
        {isEmpty && message.streaming && (
          <span className="inline-block h-4 w-1 animate-pulse rounded-full bg-foreground/60" />
        )}
        {!hasContent && !isEmpty && message.streaming && (
          <span className="inline-block h-4 w-1 animate-pulse rounded-full bg-foreground/60" />
        )}
        {message.elicitation && !message.elicitationDone && (
          <ElicitationForm
            elicitation={message.elicitation}
            onSubmit={(data) => onElicitationSubmit(message.id, data)}
            onDismiss={() => onElicitationDismiss(message.id)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function BenchAIPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { activeWorkspaceId } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 150);
  }, [open]);

  async function sendMessage(content: string, currentMessages: Message[]) {
    const userMsg: UserMessage = { id: uid(), role: "user", content };
    const assistantId = uid();
    const assistantMsg: AssistantMessage = {
      id: assistantId,
      role: "assistant",
      blocks: [],
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    const token = getAuthToken();
    const conversation = toConversationMessages([...currentMessages, userMsg]);

    try {
      const response = await fetch(`${API_URL}/api/bench-agent/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: conversation,
          workspace_id: activeWorkspaceId ?? null,
        }),
      });

      if (!response.ok || !response.body)
        throw new Error(`Request failed: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              name?: string;
              label?: string;
              input?: Record<string, unknown>;
              result?: Record<string, unknown>;
              message?: string;
              fields?: ElicitationFieldDef[];
            };

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId || m.role !== "assistant") return m;

                if (data.type === "delta" && data.text) {
                  const blocks = [...m.blocks];
                  const last = blocks[blocks.length - 1];
                  if (last?.kind === "text") {
                    blocks[blocks.length - 1] = {
                      kind: "text",
                      content: last.content + data.text,
                    };
                  } else {
                    blocks.push({ kind: "text", content: data.text });
                  }
                  return { ...m, blocks };
                }

                if (data.type === "tool_start")
                  return {
                    ...m,
                    blocks: [
                      ...m.blocks,
                      {
                        kind: "tool",
                        tool: {
                          name: data.name ?? "",
                          label: data.label ?? data.name ?? "",
                          input: data.input,
                          done: false,
                        },
                      },
                    ],
                  };

                if (data.type === "tool_done") {
                  const blocks = [...m.blocks];
                  const lastPending = [...blocks]
                    .reverse()
                    .findIndex((b) => b.kind === "tool" && !b.tool.done);
                  if (lastPending !== -1) {
                    const idx = blocks.length - 1 - lastPending;
                    const b = blocks[idx] as ToolBlock;
                    blocks[idx] = {
                      kind: "tool",
                      tool: { ...b.tool, result: data.result, done: true },
                    };
                  }
                  return { ...m, blocks };
                }

                if (data.type === "elicitation") {
                  const blocks = [...m.blocks];
                  const lastPending = [...blocks]
                    .reverse()
                    .findIndex((b) => b.kind === "tool" && !b.tool.done);
                  if (lastPending !== -1) {
                    const idx = blocks.length - 1 - lastPending;
                    const b = blocks[idx] as ToolBlock;
                    blocks[idx] = {
                      kind: "tool",
                      tool: { ...b.tool, done: true },
                    };
                  }
                  return {
                    ...m,
                    blocks,
                    streaming: false,
                    elicitation: {
                      message: data.message ?? "",
                      fields: data.fields ?? [],
                    },
                  };
                }

                if (data.type === "done") return { ...m, streaming: false };
                if (data.type === "error")
                  return {
                    ...m,
                    blocks: [
                      ...m.blocks,
                      { kind: "text", content: `Error: ${data.message}` },
                    ],
                    streaming: false,
                  };

                return m;
              }),
            );
          } catch {
            // malformed SSE — skip
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.role === "assistant"
            ? {
                ...m,
                blocks: [
                  ...m.blocks,
                  {
                    kind: "text" as const,
                    content: "Something went wrong. Please try again.",
                  },
                ],
                streaming: false,
              }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(text, messages);
  }

  function handleElicitationSubmit(
    msgId: string,
    data: Record<string, unknown>,
  ) {
    // Find the elicitation to get field labels for formatting
    const msg = messages.find((m) => m.id === msgId);
    const elicitation = msg?.role === "assistant" ? msg.elicitation : undefined;

    // Mark elicitation as done
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.role === "assistant"
          ? { ...m, elicitationDone: true }
          : m,
      ),
    );

    // Format the submitted data using field labels
    const lines = elicitation
      ? elicitation.fields.map((f) => `${f.label}: ${data[f.name] ?? ""}`)
      : Object.entries(data).map(([k, v]) => `${k}: ${v}`);
    const formattedContent = lines.join("\n");

    void sendMessage(
      formattedContent,
      [
        ...messages,
        { id: msgId, role: "user" as const, content: formattedContent },
      ].slice(0, -1),
    );
  }

  function handleElicitationDismiss(msgId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.role === "assistant"
          ? { ...m, elicitationDone: true }
          : m,
      ),
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  }

  const SUGGESTIONS = [
    "What agents do I have?",
    "Help me write test scenarios",
    "Show my existing scenarios and suites",
    "Probe one of my agents and suggest edge cases",
  ];

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className="flex w-[440px] shrink-0 flex-col border-l bg-background"
          aria-label="Bench Agent panel"
        >
          {/* Header */}
          <div className="flex h-11 shrink-0 items-center border-b bg-muted/30 px-4">
            <BenchLogo className="h-4 w-4 shrink-0 text-foreground mr-2" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Bench Agent
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Bench Agent"
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-1">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <BenchLogo className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Bench Agent</p>
                  <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
                    Tell me about your agents and I&apos;ll probe them, then
                    write test scenarios and suites.
                  </p>
                </div>
                <div className="mt-1 flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setInput(s);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-lg border border-primary/20 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onElicitationSubmit={handleElicitationSubmit}
                onElicitationDismiss={handleElicitationDismiss}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t px-3 py-2.5">
            <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask Bench Agent…"
                disabled={loading}
                className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                style={{ minHeight: "22px", maxHeight: "140px" }}
                aria-label="Message input"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void send()}
                disabled={!input.trim() || loading}
                className="h-7 w-7 shrink-0 p-0"
                aria-label="Send"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SendHorizontal className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
