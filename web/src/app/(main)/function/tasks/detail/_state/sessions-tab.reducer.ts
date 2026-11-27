import { mergeActivities } from "@/lib/activity-merge";
import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type {
  Activity,
  ChatAttachment,
  IntentAsset,
  InterceptApprovalRow,
  Session,
  SessionTokenUsage,
  TaskLLMResolutions,
  TaskNode,
  TokenTotal,
} from "@/lib/types";

// One session's lazily-loaded, reverse-paginated cache. `lastTs`/`unread` are kept
// live even for sessions that were never opened, so the list shows liveness + unread
// without holding their full history.
export type SessionState = {
  items: Activity[];
  loaded: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean; // older history remains above the loaded window
  earliestSeq: number; // earliest loaded id — reverse-pagination anchor
  unread: number;
  lastTs: string; // most-recent activity time (drives live badge; updated even when unloaded)
  error?: string;
};
export type SessionStore = Record<string, SessionState>;

export function emptyState(): SessionState {
  return {
    items: [],
    loaded: false,
    loading: false,
    loadingMore: false,
    hasMore: false,
    earliestSeq: 0,
    unread: 0,
    lastTs: "",
  };
}

// mergeBySeq unions two activity lists by seq (dedup) in ascending seq order. Every
// data source — latest page, older page, SSE compensation, live tail — goes through
// this, so history responses can never clobber live records received meanwhile.
export function mergeBySeq(current: Activity[], incoming: Activity[]): Activity[] {
  return incoming.length ? mergeActivities(current, incoming) : current;
}

export type MainSegment = { seq: number; created_at: string };

/** Which session is shown and how the session list is laid out. */
export type SessionsNav = {
  /** Session picked by the user; an approval focus overrides it while open. */
  selectedSessionId: string;
  /** A located archived/older session, kept selectable after leaving focus mode. */
  locatedSession?: { taskId: string; session: Session };
  // On mobile (<lg) the session list is collapsed by default: screen height is already tight, and a fixed 10~15rem list
  // would squeeze the transcript below down to just the header and input. Collapsed, the transcript gets nearly all the height;
  // tapping the title bar expands it to pick a session, collapsing again after choosing. Desktop is unaffected (always expanded from lg up).
  listOpen: boolean;
};

/** Main-agent conversation segments (newest-first); currentSeg is the writable one. */
export type MainAgentState = {
  segs: MainSegment[];
  currentSeg: number;
  confirmNew: boolean;
  /** Authoritative chat-running flag from the backend; null until known. */
  chatRunning: boolean | null;
};

/** Worker sessions derived from exploration intents (first page polled, older pages on demand). */
export type WorkersState = {
  intents: TaskNode[];
  olderIntents: TaskNode[];
  firstHasMore: boolean;
  olderHasMore: boolean;
  hasLoadedOlderPage: boolean;
  loadingOlder: boolean;
  assets: IntentAsset[];
};

/** Main-agent message composer. */
export type ComposerState = {
  input: string;
  // Method 1, file upload: chosen attachments (already landed in the task work dir uploads/) are sent with the next message.
  attachments: ChatAttachment[];
};

/** Message composer for a paused worker. */
export type WorkerChatState = {
  message: string;
  /** Idempotency key reused across retries of the same message. */
  requestId: string;
};

/** Worker pause/resume/delete and the delete dialog. */
export type WorkerControlState = {
  /** Intent with a control request in flight. */
  controllingIntent: string | null;
  cancelIntent: Session | null;
  cancelReason: string;
  // Delete mode: soft = soft delete (default, sets deleted + records the reason, keeps data) | hard = hard delete (cascade-removes exclusive descendants).
  deleteMode: "soft" | "hard";
};

/** Polled/streamed task-wide status. */
export type TaskStatusState = {
  // SSE connection state — surfaced so a dropped realtime link is visible, never
  // silently shown as "no messages".
  sseLive: boolean;
  // Whole-task token total (all agents), polled from the backend aggregate.
  taskTokens: TokenTotal | null;
  sessionTokens: Record<string, SessionTokenUsage>;
  llmResolutions: TaskLLMResolutions | null;
  // Pending intercept requests for this task — used to show warning icons on sessions.
  pendingIntercepts: InterceptApprovalRow[];
};

/**
 * User-triggered requests in flight: main-session creation, composer upload/send/stop
 * and the paused-worker message. Only the busy flags are used; failures are toasts.
 */
export type SessionsRequest = "createMain" | "upload" | "send" | "stop" | "workerSend";

export type SessionsTabState = {
  nav: SessionsNav;
  main: MainAgentState;
  /** Per-session caches keyed by session_key (main:<seg> | plan | system | intent:<id>). */
  store: SessionStore;
  workers: WorkersState;
  composer: ComposerState;
  workerChat: WorkerChatState;
  workerControl: WorkerControlState;
  taskStatus: TaskStatusState;
  requests: Requests<SessionsRequest>;
  /** Bumped on a timer so time-derived liveness re-renders. */
  tick: number;
};

export type SessionsTabAction =
  | RequestAction<SessionsRequest>
  // nav
  | { type: "sessionSelected"; id: string }
  | { type: "navChanged"; patch: Partial<SessionsNav> }
  | { type: "sessionListToggled" }
  // task switch
  | { type: "taskChanged"; mainId: string }
  // main agent
  | { type: "mainSegmentsResolved"; segs: MainSegment[]; current: number; key: string; id: string }
  | { type: "mainChanged"; patch: Partial<MainAgentState> }
  | { type: "mainSessionCreated"; segment: MainSegment; current: number; key: string; id: string }
  | { type: "mainSessionCreateFinished" }
  // session store
  | { type: "storeReplaced"; store: SessionStore }
  | { type: "sessionLoadStarted"; key: string }
  | { type: "sessionLatestLoaded"; key: string; items: Activity[]; hasMore: boolean }
  | { type: "mainBootHistoryLoaded"; key: string; items: Activity[]; hasMore: boolean }
  | { type: "systemHistoryLoaded"; key: string; items: Activity[] }
  | { type: "sessionLoadFailed"; key: string; error: string }
  | { type: "sessionOlderLoadStarted"; key: string }
  | { type: "sessionOlderLoaded"; key: string; items: Activity[]; hasMore: boolean }
  | { type: "sessionOlderLoadFailed"; key: string }
  | { type: "focusPageMerged"; key: string; items: Activity[]; hasMore: boolean }
  | { type: "sessionRead"; key: string }
  | {
      type: "activityReceived";
      key: string;
      activity: Activity;
      /** Session key on screen and whether the transcript is pinned to the bottom, read when the frame arrived. */
      activeKey: string;
      atBottom: boolean;
      maxKeep: number;
    }
  // workers
  | { type: "intentsReset" }
  | { type: "firstIntentsLoaded"; items: TaskNode[]; hasMore: boolean; displaced: TaskNode[] }
  | { type: "workersChanged"; patch: Partial<WorkersState> }
  | { type: "olderIntentsLoaded"; items: TaskNode[]; hasMore: boolean; knownIntents: TaskNode[] }
  | { type: "intentStatePatched"; intentId: string; state?: string }
  // composer
  | { type: "inputChanged"; input: string }
  | { type: "attachmentsUploaded"; attachments: ChatAttachment[] }
  | { type: "attachmentRemoved"; path: string }
  | { type: "messageSendStarted" }
  | { type: "messageSendFailed"; input: string; attachments: ChatAttachment[] }
  // worker chat
  | { type: "workerMessageChanged"; message: string }
  | { type: "workerSideQuestionSent" }
  | { type: "workerMessageSendStarted"; requestId: string }
  | { type: "workerMessageSent" }
  // worker control
  | { type: "workerControlChanged"; patch: Partial<WorkerControlState> }
  | { type: "workerControlFinished" }
  | { type: "cancelDialogClosed" }
  // task status
  | { type: "taskStatusChanged"; patch: Partial<TaskStatusState> }
  | { type: "tokenStatsLoaded"; total: TokenTotal; sessions: SessionTokenUsage[] }
  | { type: "ticked" };

const initialMainSegments = (): MainSegment[] => [{ seq: 0, created_at: "" }];

export function initSessionsTabState(mainId: string): SessionsTabState {
  return {
    nav: { selectedSessionId: mainId, locatedSession: undefined, listOpen: false },
    main: { segs: initialMainSegments(), currentSeg: 0, confirmNew: false, chatRunning: null },
    store: {},
    workers: {
      intents: [],
      olderIntents: [],
      firstHasMore: false,
      olderHasMore: false,
      hasLoadedOlderPage: false,
      loadingOlder: false,
      assets: [],
    },
    composer: { input: "", attachments: [] },
    workerChat: { message: "", requestId: "" },
    workerControl: { controllingIntent: null, cancelIntent: null, cancelReason: "", deleteMode: "soft" },
    taskStatus: { sseLive: false, taskTokens: null, sessionTokens: {}, llmResolutions: null, pendingIntercepts: [] },
    requests: createRequests(["createMain", "upload", "send", "stop", "workerSend"]),
    tick: 0,
  };
}

function patchSession(state: SessionsTabState, key: string, fn: (s: SessionState) => SessionState): SessionsTabState {
  return { ...state, store: { ...state.store, [key]: fn(state.store[key] ?? emptyState()) } };
}

// Merges an SSE frame into its session cache.
function receiveActivity(
  prev: SessionStore,
  k: string,
  a: Activity,
  activeK: string,
  atBottom: boolean,
  maxKeep: number,
): SessionStore {
  const cur = prev[k] ?? emptyState();
  // Merge into sessions that are loaded, actively loading, or the current
  // view (so returning is instant + a frame that lands mid-load isn't lost).
  // A cold, inactive session also keeps a tiny accounting tail so the
  // sidebar can add the latest unfinished usage without loading history.
  if (!cur.loaded && !cur.loading && k !== activeK) {
    const accountingItems =
      a.kind === "usage" || a.kind === "result" ? mergeBySeq(cur.items, [a]).slice(-4) : cur.items;
    return {
      ...prev,
      [k]: { ...cur, items: accountingItems, lastTs: a.ts, unread: cur.unread + 1 },
    };
  }
  let items = mergeBySeq(cur.items, [a]);
  // Memory bound: trim oldest when over cap (older re-fetched on scroll-up),
  // but never while the user is reading this session's history (scrolled up).
  let hasMore = cur.hasMore;
  let earliestSeq = cur.earliestSeq;
  const trimmable = k !== activeK || atBottom;
  if (trimmable && items.length > maxKeep) {
    items = items.slice(items.length - maxKeep);
    hasMore = true;
    earliestSeq = items[0].seq;
  }
  const unread = k === activeK ? 0 : cur.unread + 1;
  return { ...prev, [k]: { ...cur, items, lastTs: a.ts, unread, hasMore, earliestSeq } };
}

function patchIntentRows(rows: TaskNode[], intentId: string, state?: string): TaskNode[] {
  return state
    ? rows.map((row) => (row.id === intentId ? { ...row, state } : row))
    : rows.filter((row) => row.id !== intentId);
}

function withRequest(state: SessionsTabState, action: RequestAction<SessionsRequest>): SessionsTabState {
  return setSlice(state, "requests", requestReducer(state.requests, action));
}

export function sessionsTabReducer(state: SessionsTabState, action: SessionsTabAction): SessionsTabState {
  if (isRequestAction<SessionsRequest>(action)) return withRequest(state, action);
  switch (action.type) {
    case "sessionSelected":
      // Picking a session collapses the mobile list and drops any unsent worker message.
      return {
        ...state,
        nav: { ...state.nav, selectedSessionId: action.id, listOpen: false },
        workerChat: { ...state.workerChat, message: "", requestId: "" },
      };
    case "navChanged":
      return setSlice(state, "nav", mergePatch(state.nav, action.patch));
    case "sessionListToggled":
      return { ...state, nav: { ...state.nav, listOpen: !state.nav.listOpen } };

    case "taskChanged":
      // A stale worker id / caches from the previous task must not leak in.
      return {
        ...state,
        nav: { ...state.nav, selectedSessionId: action.mainId },
        main: { ...state.main, segs: initialMainSegments(), currentSeg: 0 },
        store: {},
        workers: {
          ...state.workers,
          intents: [],
          olderIntents: [],
          firstHasMore: false,
          olderHasMore: false,
          hasLoadedOlderPage: false,
          assets: [],
        },
        taskStatus: { ...state.taskStatus, sseLive: false, taskTokens: null, sessionTokens: {}, llmResolutions: null },
      };

    case "mainSegmentsResolved": {
      const next = patchSession(state, action.key, (s) => ({ ...s, loading: true }));
      return {
        ...next,
        nav: { ...next.nav, selectedSessionId: action.id },
        main: { ...next.main, segs: action.segs, currentSeg: action.current },
      };
    }
    case "mainChanged":
      return setSlice(state, "main", mergePatch(state.main, action.patch));
    case "mainSessionCreated": {
      const { segment } = action;
      return {
        ...state,
        nav: { ...state.nav, selectedSessionId: action.id, listOpen: false },
        main: {
          ...state.main,
          segs: [segment, ...state.main.segs.filter((m) => m.seq !== segment.seq)],
          currentSeg: action.current,
        },
        // Seed an empty, loaded state so the new (empty) session renders immediately.
        store: { ...state.store, [action.key]: { ...emptyState(), loaded: true } },
        composer: { ...state.composer, input: "" },
      };
    }
    case "mainSessionCreateFinished":
      return {
        ...withRequest(state, { type: "request/finished", key: "createMain" }),
        main: { ...state.main, confirmNew: false },
      };

    case "storeReplaced":
      return { ...state, store: action.store };
    case "sessionLoadStarted":
      return patchSession(state, action.key, (s) => ({ ...s, loading: true, error: undefined }));
    case "sessionLatestLoaded":
      return patchSession(state, action.key, (s) => {
        const items = mergeBySeq(action.items, s.items); // keep any live frames arrived meanwhile
        return {
          ...s,
          items,
          loaded: true,
          loading: false,
          hasMore: action.hasMore,
          earliestSeq: items.length ? items[0].seq : 0,
          unread: 0,
          error: undefined,
        };
      });
    case "mainBootHistoryLoaded":
      return patchSession(state, action.key, (s) => {
        const items = mergeBySeq(action.items, s.items);
        return {
          ...s,
          items,
          loaded: true,
          loading: false,
          hasMore: action.hasMore,
          earliestSeq: items.length ? items[0].seq : 0,
          unread: 0,
        };
      });
    case "systemHistoryLoaded":
      return patchSession(state, action.key, (s) => {
        const items = mergeBySeq(action.items, s.items);
        return {
          ...s,
          items,
          loaded: true,
          loading: false,
          hasMore: false,
          earliestSeq: items.length ? items[0].seq : 0,
          unread: 0,
          lastTs: items.length ? items[items.length - 1].ts : s.lastTs,
          error: undefined,
        };
      });
    case "sessionLoadFailed":
      return patchSession(state, action.key, (s) => ({ ...s, loading: false, error: action.error }));
    case "sessionOlderLoadStarted":
      return patchSession(state, action.key, (s) => ({ ...s, loadingMore: true }));
    case "sessionOlderLoaded":
      return patchSession(state, action.key, (s) => {
        const items = mergeBySeq(action.items, s.items);
        return {
          ...s,
          items,
          loadingMore: false,
          hasMore: action.hasMore,
          earliestSeq: items.length ? items[0].seq : s.earliestSeq,
        };
      });
    case "sessionOlderLoadFailed":
      return patchSession(state, action.key, (s) => ({ ...s, loadingMore: false }));
    case "focusPageMerged":
      return patchSession(state, action.key, (s) => {
        const items = mergeBySeq(action.items, s.items);
        return { ...s, items, hasMore: action.hasMore, earliestSeq: items[0]?.seq ?? s.earliestSeq };
      });
    case "sessionRead":
      return patchSession(state, action.key, (s) => ({ ...s, unread: 0 }));
    case "activityReceived":
      return {
        ...state,
        store: receiveActivity(
          state.store,
          action.key,
          action.activity,
          action.activeKey,
          action.atBottom,
          action.maxKeep,
        ),
      };

    case "intentsReset":
      return {
        ...state,
        workers: { ...state.workers, intents: [], olderIntents: [], firstHasMore: false, olderHasMore: false },
      };
    case "firstIntentsLoaded": {
      let olderIntents = state.workers.olderIntents;
      // Items pushed off the first page by newer ones move to the older list.
      if (action.displaced.length > 0) {
        const byId = new Map(olderIntents.map((item) => [item.id, item]));
        for (const item of action.displaced) byId.set(item.id, item);
        olderIntents = [...byId.values()];
      }
      return {
        ...state,
        workers: { ...state.workers, intents: action.items, olderIntents, firstHasMore: action.hasMore },
      };
    }
    case "workersChanged":
      return setSlice(state, "workers", mergePatch(state.workers, action.patch));
    case "olderIntentsLoaded": {
      // knownIntents is the first page as it was when the request was made.
      const prev = state.workers.olderIntents;
      const seen = new Set([...action.knownIntents, ...prev].map((n) => n.id));
      return {
        ...state,
        workers: {
          ...state.workers,
          olderIntents: [...prev, ...action.items.filter((n) => !seen.has(n.id))],
          olderHasMore: action.hasMore,
          hasLoadedOlderPage: true,
        },
      };
    }
    case "intentStatePatched":
      return {
        ...state,
        workers: {
          ...state.workers,
          intents: patchIntentRows(state.workers.intents, action.intentId, action.state),
          olderIntents: patchIntentRows(state.workers.olderIntents, action.intentId, action.state),
        },
      };

    case "inputChanged":
      return { ...state, composer: { ...state.composer, input: action.input } };
    case "attachmentsUploaded":
      return {
        ...state,
        composer: { ...state.composer, attachments: [...state.composer.attachments, ...action.attachments] },
      };
    case "attachmentRemoved":
      return {
        ...state,
        composer: {
          ...state.composer,
          attachments: state.composer.attachments.filter((x) => x.path !== action.path),
        },
      };
    case "messageSendStarted":
      // The composer is cleared eagerly; a failed send restores it.
      return {
        ...withRequest(state, { type: "request/started", key: "send" }),
        composer: { ...state.composer, input: "", attachments: [] },
      };
    case "messageSendFailed":
      return { ...state, composer: { ...state.composer, input: action.input, attachments: action.attachments } };

    case "workerMessageChanged":
      // Editing the message makes it a new request.
      return { ...state, workerChat: { ...state.workerChat, message: action.message, requestId: "" } };
    case "workerSideQuestionSent":
      return { ...state, workerChat: { ...state.workerChat, message: "" } };
    case "workerMessageSendStarted":
      return {
        ...withRequest(state, { type: "request/started", key: "workerSend" }),
        workerChat: { ...state.workerChat, requestId: action.requestId },
      };
    case "workerMessageSent":
      return { ...state, workerChat: { ...state.workerChat, message: "", requestId: "" } };

    case "workerControlChanged":
      return setSlice(state, "workerControl", mergePatch(state.workerControl, action.patch));
    case "workerControlFinished":
      return { ...state, workerControl: { ...state.workerControl, controllingIntent: null, cancelIntent: null } };
    case "cancelDialogClosed":
      return {
        ...state,
        workerControl: { ...state.workerControl, cancelIntent: null, cancelReason: "", deleteMode: "soft" },
      };

    case "taskStatusChanged":
      return setSlice(state, "taskStatus", mergePatch(state.taskStatus, action.patch));
    case "tokenStatsLoaded":
      return {
        ...state,
        taskStatus: {
          ...state.taskStatus,
          taskTokens: action.total,
          sessionTokens: Object.fromEntries(action.sessions.map((item) => [item.session, item])),
        },
      };
    case "ticked":
      return { ...state, tick: state.tick + 1 };
  }
}
