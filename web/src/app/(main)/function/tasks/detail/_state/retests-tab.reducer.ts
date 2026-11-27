import {
  createPagination,
  isPaginationAction,
  type Pagination,
  type PaginationAction,
  paginationReducer,
} from "@/lib/reducers/pagination";
import { setSlice } from "@/lib/reducers/slice";
import type { FindingsPage } from "@/lib/types";

export const PAGE_SIZE = 20;

export type RetestsList = {
  /** Last loaded page; may belong to a different page number while the next one loads. */
  data: FindingsPage | null;
  error: string;
};

export type RetestsTabState = {
  /** One-based pages of PAGE_SIZE findings. */
  pagination: Pagination;
  list: RetestsList;
  /** Finding whose retest panel is shown. */
  selectedId: string;
  /** Bumped to reload immediately (retry, retest completed). */
  refreshVersion: number;
};

export type RetestsTabAction =
  | PaginationAction
  | { type: "pageLoaded"; data: FindingsPage }
  | { type: "loadFailed"; error: string }
  | { type: "findingSelected"; id: string }
  | { type: "refreshRequested" };

export const initialRetestsTabState: RetestsTabState = {
  pagination: createPagination(PAGE_SIZE, 1),
  list: { data: null, error: "" },
  selectedId: "",
  refreshVersion: 0,
};

export function retestsTabReducer(state: RetestsTabState, action: RetestsTabAction): RetestsTabState {
  if (isPaginationAction(action)) return setSlice(state, "pagination", paginationReducer(state.pagination, action));
  switch (action.type) {
    case "pageLoaded": {
      // Keep the selection while it is still on the page; otherwise fall back to the first finding.
      const { items } = action.data;
      let selectedId = items.length > 0 ? items[0].id : "";
      if (items.some((finding) => finding.id === state.selectedId)) selectedId = state.selectedId;
      return { ...state, list: { data: action.data, error: "" }, selectedId };
    }
    case "loadFailed":
      return { ...state, list: { ...state.list, error: action.error } };
    case "findingSelected":
      return { ...state, selectedId: action.id };
    case "refreshRequested":
      return { ...state, refreshVersion: state.refreshVersion + 1 };
  }
}
