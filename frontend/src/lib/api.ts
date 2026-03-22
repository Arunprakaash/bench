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
  owner_user_id?: string | null;
  owner_display_name?: string | null;
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
  provider_type?: string;
  tags: string[] | null;
  owner_user_id?: string | null;
  owner_display_name?: string | null;
  created_at: string;
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
  provider_type: string;
  connection_config?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
  auth_config?: Record<string, unknown> | null;
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
  provider_type?: string;
  connection_config?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
  auth_config?: Record<string, unknown> | null;
  default_llm_model?: string;
  default_judge_model?: string;
  default_agent_args?: Record<string, unknown> | null;
  tags?: string[];
  workspace_id?: string | null;
}

export interface AgentConnectionTestResponse {
  ok: boolean;
  provider_type: string;
  detail?: string | null;
  sample?: string | null;
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
  workspace_id?: string | null;
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
  owner_user_id?: string | null;
  owner_display_name?: string | null;
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
  owner_user_id?: string | null;
  owner_display_name?: string | null;
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

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ApiTokenMeta {
  has_token: boolean;
  prefix?: string | null;
  last4?: string | null;
  created_at?: string | null;
}

export interface ApiTokenCreateResponse {
  token: string;
  prefix: string;
  last4: string;
  created_at: string;
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
  scenario_ids?: string[];
  owner_user_id?: string | null;
  owner_display_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledRun {
  id: string;
  target_type: "scenario" | "suite";
  scenario_id: string | null;
  suite_id: string | null;
  interval_minutes: number;
  config: Record<string, unknown> | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string;
  created_at: string;
}

export interface ScheduledRunCreate {
  target_type: "scenario" | "suite";
  scenario_id?: string;
  suite_id?: string;
  interval_minutes: number;
  config?: Record<string, unknown> | null;
  is_active?: boolean;
}

export interface ScheduledRunUpdate {
  interval_minutes?: number;
  config?: Record<string, unknown> | null;
  is_active?: boolean;
}

export interface RegressionAlert {
  id: string;
  scenario_id: string | null;
  run_id: string;
  previous_run_id: string | null;
  title: string;
  detail: string | null;
  is_acknowledged: boolean;
  created_at: string;
}

export interface WorkspaceMemberResponse {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  joined_at: string;
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  description: string | null;
  my_role: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string | null;
  my_role: string;
  members: WorkspaceMemberResponse[];
  created_at: string;
  updated_at: string;
}

export interface WorkspaceCreate {
  name: string;
  description?: string | null;
}

export interface WorkspaceUpdate {
  name?: string;
  description?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role?: string;
}

export const api = {
  auth: {
    me: () => request<AuthMe>("/api/auth/me"),
    updateMe: (data: AuthMeUpdate) =>
      request<AuthMe>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    logout: () => request<void>("/api/auth/logout", { method: "POST" }),
    register: (data: {
      email: string;
      password: string;
      display_name?: string | null;
    }) =>
      request<AuthTokenResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<AuthTokenResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    changePassword: (data: ChangePasswordRequest) =>
      request<void>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getApiTokenMeta: () => request<ApiTokenMeta>("/api/auth/api-token"),
    createApiToken: () =>
      request<ApiTokenCreateResponse>("/api/auth/api-token", {
        method: "POST",
      }),
    revokeApiToken: () =>
      request<void>("/api/auth/api-token", { method: "DELETE" }),
  },
  agents: {
    list: (workspaceId?: string | null) => {
      const qs = workspaceId ? `?workspace_id=${workspaceId}` : "";
      return request<AgentListItem[]>(`/api/agents${qs}`);
    },
    get: (id: string) => request<Agent>(`/api/agents/${id}`),
    getArgSchema: (id: string) =>
      request<{ arg_schema: ArgSchemaField[] | null }>(
        `/api/agents/${id}/arg-schema`,
      ),
    create: (data: AgentCreate) =>
      request<Agent>("/api/agents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<AgentCreate>) =>
      request<Agent>(`/api/agents/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    testConnection: (id: string) =>
      request<AgentConnectionTestResponse>(
        `/api/agents/${id}/connection-test`,
        { method: "POST" },
      ),
    delete: (id: string) =>
      request<void>(`/api/agents/${id}`, { method: "DELETE" }),
  },
  scenarios: {
    list: (tag?: string, workspaceId?: string | null) => {
      const params = new URLSearchParams();
      if (tag) params.set("tag", tag);
      if (workspaceId) params.set("workspace_id", workspaceId);
      const qs = params.toString();
      return request<ScenarioListItem[]>(`/api/scenarios${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<Scenario>(`/api/scenarios/${id}`),
    export: (id: string) =>
      request<ScenarioExportResponse>(`/api/scenarios/${id}/export`),
    versions: (id: string) =>
      request<ScenarioVersionListItem[]>(`/api/scenarios/${id}/versions`),
    restoreVersion: (id: string, version: number) =>
      request<Scenario>(`/api/scenarios/${id}/versions/${version}/restore`, { method: "POST" }),
    import: (data: ScenarioCreate) =>
      request<Scenario>("/api/scenarios/import", {
        method: "POST",
        body: JSON.stringify(data),
      }),
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
    list: (workspaceId?: string | null) => {
      const qs = workspaceId ? `?workspace_id=${workspaceId}` : "";
      return request<SuiteListItem[]>(`/api/suites${qs}`);
    },
    get: (id: string) => request<Suite>(`/api/suites/${id}`),
    create: (data: {
      name: string;
      description?: string;
      scenario_ids?: string[];
      workspace_id?: string | null;
    }) =>
      request<Suite>("/api/suites", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: { name?: string; description?: string; scenario_ids?: string[] },
    ) =>
      request<Suite>(`/api/suites/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/api/suites/${id}`, { method: "DELETE" }),
  },
  runs: {
    list: (params?: {
      scenario_id?: string;
      suite_id?: string;
      agent_id?: string;
      status?: string;
      limit?: number;
      workspace_id?: string | null;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.scenario_id)
        searchParams.set("scenario_id", params.scenario_id);
      if (params?.suite_id) searchParams.set("suite_id", params.suite_id);
      if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.workspace_id) searchParams.set("workspace_id", params.workspace_id);
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
    list: (params?: {
      limit?: number;
      suite_id?: string;
      scenario_id?: string;
      agent_id?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit != null)
        searchParams.set("limit", String(params.limit));
      if (params?.suite_id) searchParams.set("suite_id", params.suite_id);
      if (params?.scenario_id)
        searchParams.set("scenario_id", params.scenario_id);
      if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
      const qs = searchParams.toString();
      return request<FailureInboxItem[]>(`/api/failures${qs ? `?${qs}` : ""}`);
    },
  },
  workspaces: {
    list: () => request<WorkspaceListItem[]>("/api/workspaces"),
    get: (id: string) => request<WorkspaceResponse>(`/api/workspaces/${id}`),
    create: (data: WorkspaceCreate) =>
      request<WorkspaceResponse>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: WorkspaceUpdate) =>
      request<WorkspaceResponse>(`/api/workspaces/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/api/workspaces/${id}`, { method: "DELETE" }),
    listMembers: (id: string) =>
      request<WorkspaceMemberResponse[]>(`/api/workspaces/${id}/members`),
    inviteMember: (id: string, data: InviteMemberRequest) =>
      request<WorkspaceMemberResponse>(`/api/workspaces/${id}/members`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    removeMember: (id: string, userId: string) =>
      request<void>(`/api/workspaces/${id}/members/${userId}`, {
        method: "DELETE",
      }),
    createInvite: (id: string, data: { email: string; role?: string }) =>
      request<{ token: string; invite_url: string; email_sent: boolean }>(`/api/workspaces/${id}/invites`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  invites: {
    getInfo: (token: string) =>
      request<{ token: string; workspace_id: string; workspace_name: string; role: string; expires_at: string | null }>(
        `/api/invites/${token}`
      ),
    accept: (token: string) =>
      request<{ workspace_id: string; already_member: boolean }>(`/api/invites/${token}/accept`, { method: "POST" }),
  },
  automation: {
    listSchedules: () => request<ScheduledRun[]>("/api/automation/schedules"),
    getSchedule: (id: string) =>
      request<ScheduledRun>(`/api/automation/schedules/${id}`),
    createSchedule: (data: ScheduledRunCreate) =>
      request<ScheduledRun>("/api/automation/schedules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateSchedule: (id: string, data: ScheduledRunUpdate) =>
      request<ScheduledRun>(`/api/automation/schedules/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteSchedule: (id: string) =>
      request<void>(`/api/automation/schedules/${id}`, { method: "DELETE" }),
    listAlerts: (acknowledged?: boolean) =>
      request<RegressionAlert[]>(
        `/api/automation/alerts${acknowledged == null ? "" : `?acknowledged=${String(acknowledged)}`}`,
      ),
    acknowledgeAlert: (id: string) =>
      request<RegressionAlert>(`/api/automation/alerts/${id}/ack`, {
        method: "POST",
      }),
  },
};
