import {
  createPagination,
  isPaginationAction,
  type Pagination,
  type PaginationAction,
  paginationReducer,
  toFirstPage,
} from "@/lib/reducers/pagination";
import { setSlice } from "@/lib/reducers/slice";
import type { Edge, ExploreKind, FindingAsset, TaskNode } from "@/lib/types";

export const DEFAULT_PAGE_SIZE = 20;

export type BroadcastOrder = "asc" | "desc";

export type BroadcastFilters = {
  kinds: ExploreKind[];
  /** Raw search box value, updated on every keystroke. */
  queryInput: string;
  /** Debounced query actually sent to the API. */
  query: string;
  order: BroadcastOrder;
};

/** Broadcast content of the current page, plus the unread bookkeeping that comes with each poll. */
export type BroadcastFeed = {
  items: TaskNode[];
  edges: Edge[];
  refs: Record<string, TaskNode>;
  assets: Record<string, FindingAsset[]>;
  total: number;
  /** Whether the first response has arrived. */
  loaded: boolean;
  /** Nodes that appeared since the previous poll at the live seat. */
  freshIDs: Set<string>;
  /** New broadcasts since the user left the live seat. */
  pending: number;
};

export type BroadcastTabState = {
  filters: BroadcastFilters;
  /** One-based pages. */
  pagination: Pagination;
  /** Auto-refresh on/off. */
  live: boolean;
  feed: BroadcastFeed;
  /** Clock used for relative times; 0 until mounted. */
  now: number;
};

export type BroadcastFeedContent = Pick<BroadcastFeed, "items" | "edges" | "refs" | "assets">;

export type BroadcastTabAction =
  | PaginationAction
  | { type: "queryInputChanged"; queryInput: string }
  | { type: "queryDebounced" }
  | { type: "kindToggled"; kind: ExploreKind }
  | { type: "kindsCleared" }
  | { type: "orderToggled" }
  | { type: "previousPage" }
  | { type: "nextPage"; pageCount: number }
  | { type: "pageClamped"; pageCount: number }
  | { type: "liveToggled" }
  | { type: "backToLive" }
  | { type: "streamReset" }
  | {
      type: "feedLoaded";
      total: number;
      /** New page content, or null to keep what is shown. */
      content: BroadcastFeedContent | null;
      /** New "fresh" marks, or null to keep the current ones. */
      freshIDs: Set<string> | null;
      pending: number;
    }
  | { type: "ticked"; now: number };

export const initialBroadcastTabState: BroadcastTabState = {
  filters: { kinds: [], queryInput: "", query: "", order: "desc" },
  pagination: createPagination(DEFAULT_PAGE_SIZE, 1),
  live: true,
  feed: {
    items: [],
    edges: [],
    refs: {},
    assets: {},
    total: 0,
    loaded: false,
    freshIDs: new Set(),
    pending: 0,
  },
  now: 0,
};

function withPage(state: BroadcastTabState, page: number): BroadcastTabState {
  return setSlice(state, "pagination", paginationReducer(state.pagination, { type: "pagination/pageChanged", page }));
}

export function broadcastTabReducer(state: BroadcastTabState, action: BroadcastTabAction): BroadcastTabState {
  // A page-size change returns to page 1 inside the slice.
  if (isPaginationAction(action)) return setSlice(state, "pagination", paginationReducer(state.pagination, action));
  switch (action.type) {
    case "queryInputChanged":
      return { ...state, filters: { ...state.filters, queryInput: action.queryInput } };
    case "queryDebounced":
      // The debounced query always returns to page 1.
      return {
        ...state,
        filters: { ...state.filters, query: state.filters.queryInput },
        pagination: toFirstPage(state.pagination),
      };
    case "kindToggled": {
      const cur = state.filters.kinds;
      const kinds = cur.includes(action.kind) ? cur.filter((k) => k !== action.kind) : [...cur, action.kind];
      return { ...state, filters: { ...state.filters, kinds }, pagination: toFirstPage(state.pagination) };
    }
    case "kindsCleared":
      return { ...state, filters: { ...state.filters, kinds: [] }, pagination: toFirstPage(state.pagination) };
    case "orderToggled": {
      const order = state.filters.order === "desc" ? "asc" : "desc";
      return { ...state, filters: { ...state.filters, order }, pagination: toFirstPage(state.pagination) };
    }
    case "previousPage":
      return withPage(state, state.pagination.page - 1);
    case "nextPage":
      return withPage(state, Math.min(action.pageCount, state.pagination.page + 1));
    case "pageClamped":
      if (state.pagination.page <= action.pageCount) return state;
      return withPage(state, action.pageCount);
    case "liveToggled":
      return { ...state, live: !state.live };
    case "backToLive":
      return {
        ...state,
        filters: { ...state.filters, order: "desc" },
        pagination: toFirstPage(state.pagination),
        feed: { ...state.feed, pending: 0 },
      };
    case "streamReset":
      return { ...state, feed: { ...state.feed, pending: 0 } };
    case "feedLoaded":
      return {
        ...state,
        feed: {
          ...state.feed,
          ...action.content,
          total: action.total,
          freshIDs: action.freshIDs ?? state.feed.freshIDs,
          pending: action.pending,
          loaded: true,
        },
      };
    case "ticked":
      return { ...state, now: action.now };
  }
}
