import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { isSelectionAction, type SelectionAction, selectionReducer } from "@/lib/reducers/selection";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { Agent, ChatAttachment, Conversation, LLMProfile } from "@/lib/types";

export const CONVERSATION_LIST_PAGE = 100;

export type ChatPageRequest = "bulkDelete";

/** Text and uploads a draft handed off to the conversation it created. */
export type PendingHandoff = { input?: string; attachments?: ChatAttachment[] };

/** Agents and LLM profiles, loaded once; both are optional for rendering. */
export type ChatCatalog = {
  agents: Agent[];
  profiles: LLMProfile[];
};

/** Which conversation the right pane shows. */
export type ChatNav = {
  selectedId: number | null;
  /** Opened from an approval link (?approval=): show a status line instead of the draft while it resolves. */
  sourceRequested: boolean;
};

/** How the left rail is filtered and laid out. */
export type ChatSidebar = {
  /** null = all agents. */
  agentFilter: string | null;
  /** Rows rendered so far; "Load more" adds a page. */
  visibleCount: number;
  /**
   * Agent groups the user collapsed. Persisted to localStorage by the page and hydrated
   * after mount (not in the initial state) so the server and client render the same first pass.
   */
  collapsedAgents: Set<string>;
};

/** Inline rename of one conversation. */
export type ChatRename = {
  id: number | null;
  text: string;
};

export type ChatPageState = {
  catalog: ChatCatalog;
  /** Conversations from the 2s list poll; `loaded` turns true after the first one lands. */
  list: ListState<Conversation>;
  nav: ChatNav;
  sidebar: ChatSidebar;
  rename: ChatRename;
  /** Multi-select mode gates the checkboxes; off by default. */
  selectionMode: boolean;
  /** Conversations checked for bulk delete. */
  selection: Set<number>;
  bulkDeleteOpen: boolean;
  requests: Requests<ChatPageRequest>;
  /**
   * Handoffs keyed by the new conversation id, consumed once by ChatView on mount
   * (ids never repeat, so leftover entries are harmless).
   */
  pendingByConv: Record<number, PendingHandoff>;
};

export type ChatPageAction =
  | ListAction<Conversation>
  | SelectionAction<number>
  | RequestAction<ChatPageRequest>
  | { type: "catalogChanged"; patch: Partial<ChatCatalog> }
  // nav
  | { type: "selectionRestored"; id: number | null; sourceRequested: boolean }
  | { type: "conversationSelected"; id: number | null }
  | { type: "conversationStarted"; conversation: Conversation; pending?: PendingHandoff }
  | { type: "conversationDeleted"; id: number }
  // sidebar
  | { type: "agentFilterChanged"; agentFilter: string | null }
  | { type: "moreConversationsShown" }
  | { type: "agentGroupToggled"; key: string }
  | { type: "collapsedAgentsRestored"; keys: string[] }
  // rename
  | { type: "renameChanged"; patch: Partial<ChatRename> }
  // multi-select + bulk delete
  | { type: "selectionModeEntered" }
  | { type: "selectionModeExited" }
  | { type: "conversationCheckedChanged"; id: number; checked: boolean }
  | { type: "bulkDeleteOpenChanged"; open: boolean }
  | { type: "bulkDeleteSettled"; deleted: number[]; allSucceeded: boolean };

export function initChatPageState(): ChatPageState {
  return {
    catalog: { agents: [], profiles: [] },
    list: createList(),
    nav: { selectedId: null, sourceRequested: false },
    sidebar: { agentFilter: null, visibleCount: CONVERSATION_LIST_PAGE, collapsedAgents: new Set() },
    rename: { id: null, text: "" },
    selectionMode: false,
    selection: new Set(),
    bulkDeleteOpen: false,
    requests: createRequests<ChatPageRequest>(["bulkDelete"]),
    pendingByConv: {},
  };
}

export function conversationIsPinned(conversation: Conversation): boolean {
  return conversation.pinned ?? Boolean(conversation.pinned_at);
}

function withoutIds(selection: Set<number>, ids: Iterable<number>): Set<number> {
  const next = new Set(selection);
  for (const id of ids) next.delete(id);
  return next.size === selection.size ? selection : next;
}

// A different agent filter starts a fresh view of the rail: first page, nothing
// checked, no open bulk-delete dialog and no rename in progress.
function changeAgentFilter(state: ChatPageState, agentFilter: string | null): ChatPageState {
  return {
    ...state,
    sidebar: { ...state.sidebar, agentFilter, visibleCount: CONVERSATION_LIST_PAGE },
    selection: state.selection.size === 0 ? state.selection : new Set(),
    bulkDeleteOpen: false,
    rename: state.rename.id === null ? state.rename : { ...state.rename, id: null },
  };
}

export function chatPageReducer(state: ChatPageState, action: ChatPageAction): ChatPageState {
  if (isListAction<Conversation>(action)) return setSlice(state, "list", listReducer(state.list, action));
  if (isSelectionAction<number>(action)) return setSlice(state, "selection", selectionReducer(state.selection, action));
  if (isRequestAction<ChatPageRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "catalogChanged":
      return setSlice(state, "catalog", mergePatch(state.catalog, action.patch));

    case "selectionRestored":
      return {
        ...state,
        nav: { selectedId: action.id ?? state.nav.selectedId, sourceRequested: action.sourceRequested },
      };
    case "conversationSelected": {
      // Picking another conversation leaves the approval link behind.
      const sourceRequested = action.id === state.nav.selectedId ? state.nav.sourceRequested : false;
      if (action.id === state.nav.selectedId && sourceRequested === state.nav.sourceRequested) return state;
      return { ...state, nav: { selectedId: action.id, sourceRequested } };
    }
    case "conversationStarted": {
      const c = action.conversation;
      const next =
        state.sidebar.agentFilter !== null && state.sidebar.agentFilter !== c.agent_key
          ? changeAgentFilter(state, null)
          : state;
      // Insert the new conversation right away (above the first unpinned row) so the
      // pane switches to it before the next list poll reconciles titles etc.
      let list = next.list;
      if (!list.items.some((item) => item.id === c.id)) {
        const firstUnpinned = list.items.findIndex((item) => !conversationIsPinned(item));
        const insertAt = firstUnpinned < 0 ? list.items.length : firstUnpinned;
        const items = [...list.items.slice(0, insertAt), c, ...list.items.slice(insertAt)];
        list = { ...list, items, total: list.total + 1 };
      }
      return {
        ...next,
        list,
        nav: { ...next.nav, selectedId: c.id },
        pendingByConv: action.pending ? { ...next.pendingByConv, [c.id]: action.pending } : next.pendingByConv,
      };
    }
    case "conversationDeleted":
      return {
        ...state,
        nav: state.nav.selectedId === action.id ? { ...state.nav, selectedId: null } : state.nav,
        selection: withoutIds(state.selection, [action.id]),
      };

    case "agentFilterChanged":
      return changeAgentFilter(state, action.agentFilter);
    case "moreConversationsShown":
      return {
        ...state,
        sidebar: { ...state.sidebar, visibleCount: state.sidebar.visibleCount + CONVERSATION_LIST_PAGE },
      };
    case "agentGroupToggled": {
      const collapsedAgents = new Set(state.sidebar.collapsedAgents);
      if (!collapsedAgents.delete(action.key)) collapsedAgents.add(action.key);
      return { ...state, sidebar: { ...state.sidebar, collapsedAgents } };
    }
    case "collapsedAgentsRestored":
      return { ...state, sidebar: { ...state.sidebar, collapsedAgents: new Set(action.keys) } };

    case "renameChanged":
      return setSlice(state, "rename", mergePatch(state.rename, action.patch));

    case "selectionModeEntered":
      return state.selectionMode ? state : { ...state, selectionMode: true };
    case "selectionModeExited":
      return { ...state, selectionMode: false, selection: state.selection.size === 0 ? state.selection : new Set() };
    case "conversationCheckedChanged":
      return setSlice(
        state,
        "selection",
        selectionReducer(state.selection, { type: "selection/changed", ids: [action.id], selected: action.checked }),
      );
    case "bulkDeleteOpenChanged":
      if (action.open === state.bulkDeleteOpen) return state;
      return { ...state, bulkDeleteOpen: action.open };
    case "bulkDeleteSettled":
      // Fully successful → back to the clean list; keep selection mode on if some
      // failed so the user can retry the remaining ones.
      return {
        ...state,
        selection: withoutIds(state.selection, action.deleted),
        bulkDeleteOpen: false,
        selectionMode: action.allSucceeded ? false : state.selectionMode,
      };
  }
}
