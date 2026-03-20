import { getAuthToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Expectation {
  type: "message" | "function_call" | "function_call_output" | "agent_handoff";
  role?: string;
  intent?: string;
  function_name?: string;
  function_args?: Record<string, unknown>;
  new_agent_type?: string;
}

export interface Turn {
  user_input: string;
  expectations: Expectation[];
}

export interface TurnResponse extends Turn {
  id: string;
  turn_index: number;
  created_at: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  agent_id: string | null;
  agent_name?: string | null;
  agent_module: string;
  agent_class: string;
  llm_model: string;
  judge_model: string;
  agent_args: Record<string, unknown> | null;
  chat_history: Array<{ role: string; content: string }> | null;
  mock_tools: Record<string, unknown> | null;
  tags: string[] | null;
  version: number;
  turns: TurnResponse[];
  created_at: string;
  updated_at: string;
}

export interface ScenarioListItem {
  id: string;
  name: string;
  description: string | null;
  agent_id: string | null;
  agent_name?: string | null;
  agent_module: string;
  tags: string[] | null;
  turn_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ScenarioExportResponse {
  version: number;
  scenario: ScenarioCreate;
}

export interface ScenarioVersionListItem {
  version: number;
  created_at: string;
}

export interface AgentListItem {
  id: string;
  name: string;
  description: string | null;
  module: string;
  agent_class: string;
  tags: string[] | null;
  updated_at: string;
}

export interface ArgSchemaField {
  name: string;
  type: string;
  required?: boolean;
  default?: string | number | boolean | null;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  module: string;
  agent_class: string;
  default_llm_model: string;
  default_judge_model: string;
  default_agent_args: Record<string, unknown> | null;
  arg_schema?: ArgSchemaField[] | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface AgentCreate {
  name: string;
  description?: string;
  module: string;
  agent_class: string;
  default_llm_model?: string;
  default_judge_model?: string;
  default_agent_args?: Record<string, unknown> | null;
  tags?: string[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatTurnRequest {
  agent_id?: string | null;
  agent_module: string;
  agent_class: string;
  llm_model?: string;
  agent_args?: Record<string, unknown> | null;
  mock_tools?: Record<string, unknown> | null;
  history: ChatMessage[];
  user_input: string;
}

export interface ChatTurnResponse {
  assistant_message: string;
  events: Array<Record<string, unknown>>;
  history: ChatMessage[];
}

export interface ScenarioCreate {
  name: string;
  description?: string;
  agent_id?: string | null;
  agent_module?: string;
  agent_class?: string;
  llm_model?: string;
  judge_model?: string;
  agent_args?: Record<string, unknown>;
  chat_history?: Array<{ role: string; content: string }>;
  mock_tools?: Record<string, unknown>;
  tags?: string[];
  turns: Turn[];
}

export interface ActualEvent {
  type?: string;
  role?: string;
  content?: string;
  function_name?: string;
  arguments?: string;
  output?: string;
  is_error?: boolean;
  metrics?: {
    started_speaking_at?: number;
    stopped_speaking_at?: number;
    llm_node_ttft?: number;
  };
}

export interface JudgeVerdict {
  expectation_index: number;
  passed: boolean;
  intent: string | null;
  reasoning: string | null;
  /** Optional; not all API responses include actual event. */
  actual_event?: ActualEvent | null;
}

export interface TurnResult {
  id: string;
  turn_index: number;
  user_input: string;
  events: Array<Record<string, unknown>>;
  expectations: Array<Record<string, unknown>>;
  structured_events?: Record<string, unknown> | null;
  passed: boolean | null;
  judge_verdicts: JudgeVerdict[] | null;
  latency_ms: number | null;
  error_message: string | null;
  input_audio_url?: string | null;
  output_audio_url?: string | null;
  stt_latency_ms?: number | null;
  tts_latency_ms?: number | null;
  interruption?: boolean | null;
}

export interface RunEvaluation {
  id: string;
  test_run_id: string;
  metrics: Record<string, unknown>;
  judge_output: Record<string, unknown> | null;
  created_at: string;
}

export interface TestRun {
  id: string;
  scenario_id: string;
  suite_id: string | null;
  agent_id: string | null;
  agent_version_id?: string | null;
  status: "pending" | "running" | "passed" | "failed" | "error";
  config: Record<string, unknown> | null;
  execution_snapshot?: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  turn_results: TurnResult[];
  run_evaluation?: RunEvaluation | null;
  created_at: string;
}

export interface TestRunListItem {
  id: string;
  scenario_id: string;
  scenario_name: string | null;
  suite_id: string | null;
  agent_id: string | null;
  agent_version_id?: string | null;
  status: "pending" | "running" | "passed" | "failed" | "error";
  duration_ms: number | null;
  passed_turns: number;
  total_turns: number;
  created_at: string;
}

export interface FailureInboxItem {
  run_id: string;
  scenario_id: string;
  scenario_name: string | null;
  suite_id: string | null;
  agent_id: string | null;
  status: "failed" | "error";
  created_at: string;
  duration_ms: number | null;
  first_failed_turn_index: number | null;
  first_failed_user_input: string | null;
  first_failed_reasoning: string | null;
  first_failed_error: string | null;
}

export interface AuthMe {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface AuthTokenResponse {
  token: string;
  user: AuthSessionUser;
}

export interface AuthMeUpdate {
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface Suite {
  id: string;
  name: string;
  description: string | null;
  scenarios: ScenarioListItem[];
  created_at: string;
  updated_at: string;
}

export interface SuiteListItem {
  id: string;
  name: string;
  description: string | null;
  scenario_count: number;
  created_at: string;
  updated_at: string;
}

export const api = {
  auth: {
    me: () => request<AuthMe>("/api/auth/me"),
    updateMe: (data: AuthMeUpdate) =>
      request<AuthMe>("/api/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
    logout: () => request<void>("/api/auth/logout", { method: "POST" }),
    register: (data: { email: string; password: string; display_name?: string | null }) =>
      request<AuthTokenResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<AuthTokenResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  },
  agents: {
    list: () => request<AgentListItem[]>("/api/agents"),
    get: (id: string) => request<Agent>(`/api/agents/${id}`),
    getArgSchema: (id: string) =>
      request<{ arg_schema: ArgSchemaField[] | null }>(`/api/agents/${id}/arg-schema`),
    create: (data: AgentCreate) =>
      request<Agent>("/api/agents", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AgentCreate>) =>
      request<Agent>(`/api/agents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/api/agents/${id}`, { method: "DELETE" }),
  },
  scenarios: {
    list: (tag?: string) =>
      request<ScenarioListItem[]>(`/api/scenarios${tag ? `?tag=${tag}` : ""}`),
    get: (id: string) => request<Scenario>(`/api/scenarios/${id}`),
    export: (id: string) => request<ScenarioExportResponse>(`/api/scenarios/${id}/export`),
    versions: (id: string) => request<ScenarioVersionListItem[]>(`/api/scenarios/${id}/versions`),
    import: (data: ScenarioCreate) =>
      request<Scenario>("/api/scenarios/import", { method: "POST", body: JSON.stringify(data) }),
    create: (data: ScenarioCreate) =>
      request<Scenario>("/api/scenarios", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<ScenarioCreate>) =>
      request<Scenario>(`/api/scenarios/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/api/scenarios/${id}`, { method: "DELETE" }),
  },
  suites: {
    list: () => request<SuiteListItem[]>("/api/suites"),
    get: (id: string) => request<Suite>(`/api/suites/${id}`),
    create: (data: { name: string; description?: string; scenario_ids?: string[] }) =>
      request<Suite>("/api/suites", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; description?: string; scenario_ids?: string[] }) =>
      request<Suite>(`/api/suites/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/suites/${id}`, { method: "DELETE" }),
  },
  runs: {
    list: (params?: { scenario_id?: string; suite_id?: string; agent_id?: string; status?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.scenario_id) searchParams.set("scenario_id", params.scenario_id);
      if (params?.suite_id) searchParams.set("suite_id", params.suite_id);
      if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      const qs = searchParams.toString();
      return request<TestRunListItem[]>(`/api/runs${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<TestRun>(`/api/runs/${id}`),
    create: (scenario_id: string, config?: Record<string, unknown>) =>
      request<TestRun>("/api/runs", {
        method: "POST",
        body: JSON.stringify({ scenario_id, config }),
      }),
    createSuiteRun: (suite_id: string, config?: Record<string, unknown>) =>
      request<TestRunListItem[]>("/api/runs/suite", {
        method: "POST",
        body: JSON.stringify({ suite_id, config }),
      }),
    delete: (id: string) =>
      request<void>(`/api/runs/${id}`, { method: "DELETE" }),
  },
  chat: {
    turn: (data: ChatTurnRequest) =>
      request<ChatTurnResponse>("/api/chat/turn", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  failures: {
    list: (params?: { limit?: number; suite_id?: string; scenario_id?: string; agent_id?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit != null) searchParams.set("limit", String(params.limit));
      if (params?.suite_id) searchParams.set("suite_id", params.suite_id);
      if (params?.scenario_id) searchParams.set("scenario_id", params.scenario_id);
      if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
      const qs = searchParams.toString();
      return request<FailureInboxItem[]>(`/api/failures${qs ? `?${qs}` : ""}`);
    },
  },
};
