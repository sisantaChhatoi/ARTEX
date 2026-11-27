import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type {
  Activity,
  Agent,
  ConvTokenSummary,
  Finding,
  InterceptPending,
  LLMProfile,
  MCPServer,
  Settings,
  SkillItem,
  Stats,
  Task,
  TokenTotal,
  Tool,
  TrafficExchange,
  UsageStats,
} from "@/lib/types";

export type TokenVersion = "old" | "new";
/** "all" = every profile; a number (or null for the default bucket) = one profile. */
export type TokenTab = number | null | "all";
export type TokenDays = 7 | 30 | 90 | 180 | 365;

/** Fast-poll sources (every 5s), fetched together so one poll causes a single render. */
export type DashboardLive = {
  findings: Finding[];
  stats: Stats | null;
  settings: Settings | null;
  pending: InterceptPending[];
  activity: Activity[];
  tokens: TokenTotal | null;
  convTokens: ConvTokenSummary[];
};

/** Slow-poll sources (every 15s): traffic, assets and mostly static system config. */
export type DashboardSystem = {
  traffic: TrafficExchange[];
  assetCounts: Record<string, number>;
  agents: Agent[];
  mcpServers: MCPServer[];
  skills: SkillItem[];
  tools: Tool[];
  llmProfiles: LLMProfile[];
  usageStats: UsageStats | null;
};

/** Controls of the token usage panel. */
export type TokenView = {
  /** Data source: old = activity (task.tokens + conversations), new = the llm_usage metering ledger. */
  version: TokenVersion;
  tab: TokenTab;
  /** Day range of the daily bar chart. */
  days: TokenDays;
};

export type DashboardPageState = {
  /** Polled on its own: the task list is the most expensive source. */
  tasks: Task[];
  live: DashboardLive;
  system: DashboardSystem;
  tokenView: TokenView;
};

export type DashboardPageAction =
  | { type: "tasksLoaded"; tasks: Task[] }
  | { type: "liveLoaded"; live: DashboardLive }
  | { type: "systemLoaded"; system: DashboardSystem }
  | { type: "tokenViewChanged"; patch: Partial<TokenView> };

export const initialDashboardPageState: DashboardPageState = {
  tasks: [],
  live: {
    findings: [],
    stats: null,
    settings: null,
    pending: [],
    activity: [],
    tokens: null,
    convTokens: [],
  },
  system: {
    traffic: [],
    assetCounts: {},
    agents: [],
    mcpServers: [],
    skills: [],
    tools: [],
    llmProfiles: [],
    usageStats: null,
  },
  tokenView: { version: "old", tab: "all", days: 30 },
};

export function dashboardPageReducer(state: DashboardPageState, action: DashboardPageAction): DashboardPageState {
  switch (action.type) {
    case "tasksLoaded":
      return action.tasks === state.tasks ? state : { ...state, tasks: action.tasks };
    case "liveLoaded":
      return { ...state, live: action.live };
    case "systemLoaded":
      return { ...state, system: action.system };
    case "tokenViewChanged":
      return setSlice(state, "tokenView", mergePatch(state.tokenView, action.patch));
  }
}
