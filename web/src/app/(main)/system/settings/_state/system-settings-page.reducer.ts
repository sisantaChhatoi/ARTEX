import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { Settings } from "@/lib/types";

/** On/off switches that save immediately (optimistic, reverted on failure). */
export type SettingsSwitches = {
  trafficCapture: boolean;
  agentTrafficBinding: boolean;
  /** Operation constraint injection scope (both on by default). */
  injectPlanner: boolean;
  injectWorker: boolean;
  /** Experimental: noa context compaction (off by default). */
  noaCompaction: boolean;
};

export type SettingsSwitch = keyof SettingsSwitches;

export type WebSearchSettings = {
  enabled: boolean;
  backend: string;
  /** Dedicated egress proxy for search endpoints, as typed. */
  proxy: string;
};

export type ApiKeyProvider = "brave" | "tavily" | "keenable";

/** A write-only search API key: whether one is stored, and what is typed into the input. */
export type ApiKeyField = { set: boolean; input: string };

export type RuntimeSettings = {
  pythonInterpreter: string;
  /** Concurrent worker agent count, as typed. */
  workers: string;
};

/**
 * "save" covers the shared busy flag (traffic switches, web search, Python interpreter);
 * the rest each guard their own input.
 */
export type SettingsRequest =
  | "save"
  | "braveKey"
  | "tavilyKey"
  | "keenableKey"
  | "proxy"
  | "globalProxy"
  | "workers"
  | "test";

export type SystemSettingsPageState = {
  /** True once the first settings fetch settled (success or not). */
  loaded: boolean;
  switches: SettingsSwitches;
  webSearch: WebSearchSettings;
  apiKeys: Record<ApiKeyProvider, ApiKeyField>;
  /** Global egress proxy, as typed. */
  globalProxy: string;
  runtime: RuntimeSettings;
  requests: Requests<SettingsRequest>;
};

export type SystemSettingsPageAction =
  | RequestAction<SettingsRequest>
  | { type: "settingsLoaded"; settings: Settings }
  | { type: "loadFinished" }
  | { type: "switchChanged"; key: SettingsSwitch; value: boolean }
  | { type: "webSearchChanged"; patch: Partial<WebSearchSettings> }
  | { type: "apiKeyInputChanged"; provider: ApiKeyProvider; input: string }
  /** A key was stored: apply the returned settings and clear the input. */
  | { type: "apiKeySaved"; provider: ApiKeyProvider; settings: Settings }
  | { type: "globalProxyChanged"; value: string }
  | { type: "runtimeChanged"; patch: Partial<RuntimeSettings> };

export const initialSystemSettingsPageState: SystemSettingsPageState = {
  loaded: false,
  switches: {
    trafficCapture: false,
    agentTrafficBinding: false,
    injectPlanner: true,
    injectWorker: true,
    noaCompaction: false,
  },
  webSearch: { enabled: false, backend: "ddgs", proxy: "" },
  apiKeys: {
    brave: { set: false, input: "" },
    tavily: { set: false, input: "" },
    keenable: { set: false, input: "" },
  },
  globalProxy: "",
  runtime: { pythonInterpreter: "", workers: "3" },
  requests: createRequests<SettingsRequest>([
    "save",
    "braveKey",
    "tavilyKey",
    "keenableKey",
    "proxy",
    "globalProxy",
    "workers",
    "test",
  ]),
};

function setApiKey(state: SystemSettingsPageState, provider: ApiKeyProvider, patch: Partial<ApiKeyField>) {
  const next = mergePatch(state.apiKeys[provider], patch);
  return next === state.apiKeys[provider] ? state : { ...state, apiKeys: { ...state.apiKeys, [provider]: next } };
}

/** Copies server settings into the form. Typed API keys are left alone (the server never returns them). */
function applySettings(state: SystemSettingsPageState, s: Settings): SystemSettingsPageState {
  let next = setSlice(
    state,
    "switches",
    mergePatch(state.switches, {
      trafficCapture: !!s.traffic_capture,
      agentTrafficBinding: !!s.agent_traffic_binding,
      injectPlanner: s.constraints_inject_planner !== false,
      injectWorker: s.constraints_inject_worker !== false,
      noaCompaction: !!s.noa_compaction,
    }),
  );
  next = setSlice(
    next,
    "webSearch",
    mergePatch(next.webSearch, {
      enabled: !!s.web_search_enabled,
      backend: s.web_search_backend || "ddgs",
      proxy: s.web_search_proxy ?? "",
    }),
  );
  next = setApiKey(next, "brave", { set: !!s.brave_key_set });
  next = setApiKey(next, "tavily", { set: !!s.tavily_key_set });
  next = setApiKey(next, "keenable", { set: !!s.keenable_key_set });
  next = setSlice(next, "globalProxy", s.global_proxy ?? "");
  return setSlice(
    next,
    "runtime",
    mergePatch(next.runtime, { pythonInterpreter: s.python_interpreter ?? "", workers: String(s.workers ?? 3) }),
  );
}

export function systemSettingsPageReducer(
  state: SystemSettingsPageState,
  action: SystemSettingsPageAction,
): SystemSettingsPageState {
  if (isRequestAction<SettingsRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "settingsLoaded":
      return applySettings(state, action.settings);
    case "loadFinished":
      return setSlice(state, "loaded", true);
    case "switchChanged":
      return setSlice(state, "switches", mergePatch(state.switches, { [action.key]: action.value }));
    case "webSearchChanged":
      return setSlice(state, "webSearch", mergePatch(state.webSearch, action.patch));
    case "apiKeyInputChanged":
      return setApiKey(state, action.provider, { input: action.input });
    case "apiKeySaved":
      return setApiKey(applySettings(state, action.settings), action.provider, { input: "" });
    case "globalProxyChanged":
      return setSlice(state, "globalProxy", action.value);
    case "runtimeChanged":
      return setSlice(state, "runtime", mergePatch(state.runtime, action.patch));
  }
}
