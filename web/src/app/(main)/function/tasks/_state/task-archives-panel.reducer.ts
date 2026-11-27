import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import {
  createPagination,
  isPaginationAction,
  type Pagination,
  type PaginationAction,
  paginationReducer,
  toFirstPage,
} from "@/lib/reducers/pagination";
import { isSelectionAction, type SelectionAction, selectionReducer } from "@/lib/reducers/selection";
import { setSlice } from "@/lib/reducers/slice";
import type { TaskArchive } from "@/lib/types";

export type TaskArchivesFilters = {
  query: string;
  /** "all" or a TaskArchiveState. */
  state: string;
};

export type TaskArchivesPanelState = {
  filters: TaskArchivesFilters;
  /** One-based, matching the archives API. */
  pagination: Pagination;
  /**
   * The spinner shows only until the first load settles (`!loaded`); polling never
   * dispatches `list/loadStarted`, so it does not show the spinner again.
   */
  list: ListState<TaskArchive>;
  /** Selected archive IDs, always a subset of the current page. */
  selected: Set<number>;
};

export type TaskArchivesPanelAction =
  | PaginationAction
  | ListAction<TaskArchive>
  | SelectionAction<number>
  | { type: "queryChanged"; query: string }
  | { type: "stateFilterChanged"; state: string }
  | { type: "archiveSelectionToggled"; id: number; checked: boolean };

export const initialTaskArchivesPanelState: TaskArchivesPanelState = {
  filters: { query: "", state: "all" },
  pagination: createPagination(20, 1),
  list: createList(),
  selected: new Set(),
};

function withSelection(state: TaskArchivesPanelState, action: SelectionAction<number>): TaskArchivesPanelState {
  return setSlice(state, "selected", selectionReducer(state.selected, action));
}

export function taskArchivesPanelReducer(
  state: TaskArchivesPanelState,
  action: TaskArchivesPanelAction,
): TaskArchivesPanelState {
  if (isPaginationAction(action)) return setSlice(state, "pagination", paginationReducer(state.pagination, action));
  if (isSelectionAction<number>(action)) return withSelection(state, action);
  if (isListAction<TaskArchive>(action)) {
    const next = setSlice(state, "list", listReducer(state.list, action));
    if (action.type !== "list/loaded") return next;
    // Keep only selections that are still on the freshly loaded page.
    return withSelection(next, { type: "selection/pruned", keep: action.items.map((archive) => archive.id) });
  }
  switch (action.type) {
    case "queryChanged":
      // Every filter change sends the user back to the first page.
      if (action.query === state.filters.query) return state;
      return {
        ...state,
        filters: { ...state.filters, query: action.query },
        pagination: toFirstPage(state.pagination),
      };
    case "stateFilterChanged":
      if (action.state === state.filters.state) return state;
      return {
        ...state,
        filters: { ...state.filters, state: action.state },
        pagination: toFirstPage(state.pagination),
      };
    case "archiveSelectionToggled":
      // The checkbox reports the wanted state, so check or uncheck explicitly.
      return withSelection(state, { type: "selection/changed", ids: [action.id], selected: action.checked });
  }
}
