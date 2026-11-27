import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import {
  createPagination,
  isPaginationAction,
  type Pagination,
  type PaginationAction,
  paginationReducer,
  toFirstPage,
} from "@/lib/reducers/pagination";
import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { Asset, NewAssetType } from "@/lib/types";

export const DEFAULT_PAGE_SIZE = 50;

export type AssetsFilters = {
  /** Asset type tab. */
  tab: NewAssetType;
  /** Raw DSL search box value; empty means a plain listing. */
  query: string;
};

/** What comes with the asset list besides its rows. */
export type AssetsListMeta = {
  /** Per-type asset counts shown on the tabs. */
  counts: Record<string, number>;
  /** Error from the last DSL search, shown under the search box. */
  dslError: string;
  /** Bumped to force a reload. */
  refreshKey: number;
};

export type AssetsDialogs = {
  addOpen: boolean;
  /** Asset awaiting remove confirmation. */
  removeTarget: Asset | null;
};

export type AssetsTabState = {
  filters: AssetsFilters;
  /** Zero-based pages. */
  pagination: Pagination;
  /** `loaded` is false until the first load for the current view settles (shows the spinner row). */
  list: ListState<Asset>;
  listMeta: AssetsListMeta;
  dialogs: AssetsDialogs;
  requests: Requests<"remove">;
};

export type AssetsTabAction =
  | PaginationAction
  | ListAction<Asset>
  | RequestAction<"remove">
  | { type: "tabChanged"; tab: NewAssetType }
  | { type: "queryChanged"; query: string }
  | { type: "assetsLoaded"; rows: Asset[]; total: number; counts: Record<string, number> }
  | { type: "searchFailed"; error: string }
  | { type: "refreshRequested" }
  | { type: "dialogsChanged"; patch: Partial<AssetsDialogs> };

export const initialAssetsTabState: AssetsTabState = {
  filters: { tab: "root_domain", query: "" },
  pagination: createPagination(DEFAULT_PAGE_SIZE),
  list: createList(),
  listMeta: { counts: {}, dslError: "", refreshKey: 0 },
  dialogs: { addOpen: false, removeTarget: null },
  requests: createRequests(["remove"]),
};

export function assetsTabReducer(state: AssetsTabState, action: AssetsTabAction): AssetsTabState {
  // Page-size changes restart server pagination inside the slice.
  if (isPaginationAction(action)) return setSlice(state, "pagination", paginationReducer(state.pagination, action));
  if (isListAction<Asset>(action)) return setSlice(state, "list", listReducer(state.list, action));
  if (isRequestAction<"remove">(action)) return setSlice(state, "requests", requestReducer(state.requests, action));
  switch (action.type) {
    case "tabChanged":
      if (action.tab === state.filters.tab) return state;
      // DSL fields differ per type, so switching tabs also clears the search.
      return {
        ...state,
        filters: { tab: action.tab, query: "" },
        pagination: toFirstPage(state.pagination),
        listMeta: { ...state.listMeta, dslError: "" },
      };
    case "queryChanged":
      if (action.query === state.filters.query) return state;
      return {
        ...state,
        filters: { ...state.filters, query: action.query },
        pagination: toFirstPage(state.pagination),
      };
    case "assetsLoaded":
      return {
        ...state,
        list: listReducer(state.list, { type: "list/loaded", items: action.rows, total: action.total }),
        listMeta: { ...state.listMeta, counts: action.counts, dslError: "" },
      };
    case "searchFailed":
      return {
        ...state,
        list: listReducer(state.list, { type: "list/loaded", items: [], total: 0 }),
        listMeta: { ...state.listMeta, dslError: action.error },
      };
    case "refreshRequested":
      return {
        ...state,
        list: { ...state.list, loaded: false },
        listMeta: { ...state.listMeta, refreshKey: state.listMeta.refreshKey + 1 },
      };
    case "dialogsChanged":
      return setSlice(state, "dialogs", mergePatch(state.dialogs, action.patch));
  }
}
