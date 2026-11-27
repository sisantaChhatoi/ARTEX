import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { JudgeConfig, JudgeUsage, LLMProfile } from "@/lib/types";

export const defaultJudge = (): JudgeConfig => ({
  enabled: false,
  mode: "closed",
  profile_id: 0,
  prompt: "",
  timeout_seconds: 15,
  fail_action: "ask",
  ask_timeout_seconds: 300,
  ask_timeout_action: "deny",
});

export type JudgeCardState = {
  /** Model fallback config being edited. */
  cfg: JudgeConfig;
  profiles: LLMProfile[];
  /** True while the config and profiles are (re)loading. */
  loading: boolean;
  /** Approval token usage stats; null until fetched. */
  usage: JudgeUsage | null;
  /** `save` covers both saving and restoring the built-in prompt. */
  requests: Requests<"save">;
};

export type JudgeCardAction =
  | RequestAction<"save">
  | { type: "loadStarted" }
  | { type: "configLoaded"; cfg: JudgeConfig; profiles: LLMProfile[] }
  | { type: "loadFinished" }
  | { type: "configChanged"; patch: Partial<JudgeConfig> }
  | { type: "configRestored"; cfg: JudgeConfig }
  | { type: "usageLoaded"; usage: JudgeUsage };

export const initialJudgeCardState: JudgeCardState = {
  cfg: defaultJudge(),
  profiles: [],
  loading: true,
  usage: null,
  requests: createRequests(["save"]),
};

export function judgeCardReducer(state: JudgeCardState, action: JudgeCardAction): JudgeCardState {
  if (isRequestAction<"save">(action)) return setSlice(state, "requests", requestReducer(state.requests, action));
  switch (action.type) {
    case "loadStarted":
      return state.loading ? state : { ...state, loading: true };
    case "configLoaded":
      return { ...state, cfg: action.cfg, profiles: action.profiles };
    case "loadFinished":
      return state.loading ? { ...state, loading: false } : state;
    case "configChanged":
      return { ...state, cfg: { ...state.cfg, ...action.patch } };
    case "configRestored":
      return { ...state, cfg: action.cfg };
    case "usageLoaded":
      return { ...state, usage: action.usage };
  }
}
