import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import {
  createPagination,
  isPaginationAction,
  type Pagination,
  type PaginationAction,
  paginationReducer,
  toFirstPage,
} from "@/lib/reducers/pagination";
import { setSlice } from "@/lib/reducers/slice";
import type { Finding } from "@/lib/types";

export const PAGE_SIZE = 20;

export type LinkTrafficState = {
  query: string;
  /** 1-based, as the findings API expects. */
  pagination: Pagination;
  list: ListState<Finding>;
  /** Finding the traffic will be linked to (single choice). */
  selected: Finding | null;
  saving: boolean;
  /** One message for both the list load and the save, like the dialog shows it. */
  error: string;
};

export type LinkTrafficAction =
  | PaginationAction
  | ListAction<Finding>
  | { type: "queryChanged"; query: string }
  | { type: "findingSelected"; finding: Finding }
  | { type: "loadFailed"; error: string }
  | { type: "saveStarted" }
  | { type: "saveFailed"; error: string }
  | { type: "saveFinished" };

export const initialLinkTrafficState: LinkTrafficState = {
  query: "",
  pagination: createPagination(PAGE_SIZE, 1),
  // The first load starts on mount.
  list: { ...createList<Finding>(), loading: true },
  selected: null,
  saving: false,
  error: "",
};

export function linkTrafficReducer(state: LinkTrafficState, action: LinkTrafficAction): LinkTrafficState {
  if (isPaginationAction(action)) return setSlice(state, "pagination", paginationReducer(state.pagination, action));
  if (isListAction<Finding>(action)) {
    // Every load clears the previous error.
    const next = setSlice(state, "list", listReducer(state.list, action));
    return action.type === "list/loadStarted" ? setSlice(next, "error", "") : next;
  }
  switch (action.type) {
    case "queryChanged": {
      // A query edit returns to the first page.
      const pagination = toFirstPage(state.pagination);
      if (action.query === state.query && pagination === state.pagination) return state;
      return { ...state, query: action.query, pagination };
    }
    case "findingSelected":
      return setSlice(state, "selected", action.finding);
    case "loadFailed":
      return setSlice(state, "error", action.error);
    case "saveStarted":
      return { ...state, saving: true, error: "" };
    case "saveFailed":
      return setSlice(state, "error", action.error);
    case "saveFinished":
      return setSlice(state, "saving", false);
  }
}
