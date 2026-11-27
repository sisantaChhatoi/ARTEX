import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import {
  createPagination,
  isPaginationAction,
  type Pagination,
  type PaginationAction,
  paginationReducer,
  toFirstPage,
} from "@/lib/reducers/pagination";
import { selectionReducer } from "@/lib/reducers/selection";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { TrafficExchange } from "@/lib/types";

export const PAGE_SIZE = 25;

export type TrafficPickerFilters = {
  host: string;
  /** "all" or an HTTP method. */
  method: string;
  query: string;
};

export type TrafficPickerState = {
  filters: TrafficPickerFilters;
  pagination: Pagination;
  list: ListState<TrafficExchange>;
  /** Traffic IDs checked for binding; kept across pages. */
  selected: Set<string>;
  /** Traffic ID shown in the preview viewer. */
  preview: string | null;
  saving: boolean;
  /** One message for both the list load and the save, like the dialog shows it. */
  error: string;
};

export type TrafficPickerAction =
  | PaginationAction
  | ListAction<TrafficExchange>
  | { type: "filtersChanged"; patch: Partial<TrafficPickerFilters> }
  | { type: "selectionChanged"; ids: string[]; checked: boolean }
  | { type: "previewChanged"; id: string | null }
  | { type: "loadFailed"; error: string }
  | { type: "saveStarted" }
  | { type: "saveFailed"; error: string }
  | { type: "saveFinished" };

/** Built per mount so every dialog gets its own selection Set. */
export function createTrafficPickerState(): TrafficPickerState {
  return {
    filters: { host: "", method: "all", query: "" },
    pagination: createPagination(PAGE_SIZE),
    // The first load starts on mount.
    list: { ...createList<TrafficExchange>(), loading: true },
    selected: new Set(),
    preview: null,
    saving: false,
    error: "",
  };
}

export function trafficPickerReducer(state: TrafficPickerState, action: TrafficPickerAction): TrafficPickerState {
  if (isPaginationAction(action)) return setSlice(state, "pagination", paginationReducer(state.pagination, action));
  if (isListAction<TrafficExchange>(action)) {
    // Every load clears the previous error.
    const next = setSlice(state, "list", listReducer(state.list, action));
    return action.type === "list/loadStarted" ? setSlice(next, "error", "") : next;
  }
  switch (action.type) {
    case "filtersChanged": {
      const filters = mergePatch(state.filters, action.patch);
      // Any filter edit returns to the first page.
      const pagination = toFirstPage(state.pagination);
      if (filters === state.filters && pagination === state.pagination) return state;
      return { ...state, filters, pagination };
    }
    case "selectionChanged": {
      const next = new Set(state.selected);
      for (const id of action.ids) {
        if (action.checked) next.add(id);
        else next.delete(id);
      }
      return setSlice(state, "selected", selectionReducer(state.selected, { type: "selection/set", ids: next }));
    }
    case "previewChanged":
      return setSlice(state, "preview", action.id);
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
