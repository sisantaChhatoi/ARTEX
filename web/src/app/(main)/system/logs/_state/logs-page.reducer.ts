import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { LogLine } from "@/lib/types";

/** Live tail keeps the newest lines only. */
export const LIVE_LINES_MAX = 3000;
/** Upper bound once older history has been prepended. */
export const HISTORY_LINES_MAX = 5000;

export type LogsFilters = {
  q: string;
  level: "all" | LogLine["level"];
};

export type LogsPageState = {
  lines: LogLine[];
  filters: LogsFilters;
  /** Paused: incoming live lines are dropped and the view stops auto-scrolling. */
  paused: boolean;
  /** Whether older history can still be loaded. */
  hasMore: boolean;
  requests: Requests<"history">;
};

export type LogsPageAction =
  | RequestAction<"history">
  | { type: "linesReplaced"; lines: LogLine[] }
  | { type: "lineReceived"; line: LogLine }
  | { type: "olderLoaded"; items: LogLine[]; hasMore: boolean }
  | { type: "hasMoreChanged"; hasMore: boolean }
  | { type: "queryChanged"; q: string }
  | { type: "levelChanged"; level: LogsFilters["level"] }
  | { type: "pauseToggled" }
  | { type: "cleared" };

export const initialLogsPageState: LogsPageState = {
  lines: [],
  filters: { q: "", level: "all" },
  paused: false,
  hasMore: false,
  requests: createRequests(["history"]),
};

/** Prepends older history lines, giving them synthetic seq numbers below the current minimum so seq dedup keeps working. */
function prependOlder(lines: LogLine[], items: LogLine[]): LogLine[] {
  const minSeq = lines.reduce((m, l) => Math.min(m, l.seq ?? 0), 0);
  const older = items.map((l, i) => ({ ...l, seq: minSeq - items.length + i }));
  // Prepend, dedup by db_id, cap.
  const merged = [...older, ...lines];
  const seen = new Set<number>();
  const deduped = merged.filter((l) => {
    if (!l.db_id) return true;
    if (seen.has(l.db_id)) return false;
    seen.add(l.db_id);
    return true;
  });
  return deduped.slice(-HISTORY_LINES_MAX);
}

export function logsPageReducer(state: LogsPageState, action: LogsPageAction): LogsPageState {
  if (isRequestAction<"history">(action)) return setSlice(state, "requests", requestReducer(state.requests, action));
  switch (action.type) {
    case "linesReplaced":
      return { ...state, lines: action.lines };
    case "lineReceived":
      if (state.lines.some((x) => x.seq === action.line.seq)) return state;
      return { ...state, lines: [...state.lines, action.line].slice(-LIVE_LINES_MAX) };
    case "olderLoaded": {
      const lines = action.items.length ? prependOlder(state.lines, action.items) : state.lines;
      if (lines === state.lines && action.hasMore === state.hasMore) return state;
      return { ...state, lines, hasMore: action.hasMore };
    }
    case "hasMoreChanged":
      return action.hasMore === state.hasMore ? state : { ...state, hasMore: action.hasMore };
    case "queryChanged":
      return { ...state, filters: { ...state.filters, q: action.q } };
    case "levelChanged":
      if (action.level === state.filters.level) return state;
      return { ...state, filters: { ...state.filters, level: action.level } };
    case "pauseToggled":
      return { ...state, paused: !state.paused };
    case "cleared":
      return { ...state, lines: [] };
  }
}
