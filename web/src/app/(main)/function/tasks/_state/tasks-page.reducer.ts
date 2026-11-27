import {
  createPagination,
  isPaginationAction,
  type Pagination,
  type PaginationAction,
  paginationReducer,
} from "@/lib/reducers/pagination";
import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { isSelectionAction, type SelectionAction, selectionReducer } from "@/lib/reducers/selection";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { Task, TaskCategory, TaskStatus } from "@/lib/types";

export type TaskStatusFilter = TaskStatus | "all";

export type TasksFilters = {
  query: string;
  status: TaskStatusFilter;
  /** "all", the uncategorized sentinel, or a category ID as a string. */
  category: string;
  /** Set once the saved status/category filters were read from localStorage. */
  hydrated: boolean;
};

export type TasksCategories = {
  items: TaskCategory[];
  loaded: boolean;
};

/** Bulk actions in flight, used to disable their buttons. */
export type TasksBulkRequest = "pause" | "resume" | "moveCategory";

export type TasksPageState = {
  activeTab: string;
  tasks: Task[];
  categories: TasksCategories;
  filters: TasksFilters;
  /** One-based, client-side pager over the filtered list. */
  pagination: Pagination;
  /** Unix seconds, ticked every second while a task is running. */
  nowSec: number;
  /** Multi-select survives paging/filter changes and only shrinks when a task disappears. */
  selectedIds: Set<string>;
  bulk: Requests<TasksBulkRequest>;
};

export type TasksPageAction =
  | PaginationAction
  | SelectionAction<string>
  | RequestAction<TasksBulkRequest>
  | { type: "tabChanged"; tab: string }
  | { type: "tasksLoaded"; tasks: Task[] }
  | { type: "taskCategoryMoved"; taskID: string; category: TaskCategory | null }
  | { type: "categoriesLoaded"; categories: TaskCategory[] }
  | { type: "filtersChanged"; patch: Partial<TasksFilters> }
  | { type: "filtersHydrated"; status?: TaskStatusFilter; category?: string }
  | { type: "clockTicked"; nowSec: number }
  | { type: "taskSelectionToggled"; id: string; checked: boolean }
  | { type: "pageSelectionToggled"; ids: string[]; checked: boolean }
  | { type: "tasksDeselected"; ids: string[] };

export function initTasksPageState(nowSec: number): TasksPageState {
  return {
    activeTab: "current",
    tasks: [],
    categories: { items: [], loaded: false },
    filters: { query: "", status: "all", category: "all", hydrated: false },
    pagination: createPagination(20, 1),
    nowSec,
    selectedIds: new Set(),
    bulk: createRequests(["pause", "resume", "moveCategory"]),
  };
}

/** The pause/resume bulk action in flight, if any. */
export function bulkControlling(bulk: Requests<TasksBulkRequest>): "pause" | "resume" | null {
  if (bulk.pause.pending) return "pause";
  if (bulk.resume.pending) return "resume";
  return null;
}

/** moveTaskCategory applies a category move to one task, as the optimistic local update after the API call. */
export function moveTaskCategory(tasks: Task[], taskID: string, category: TaskCategory | null): Task[] {
  return tasks.map((task) =>
    task.id === taskID ? { ...task, category_id: category?.id, category_name: category?.name } : task,
  );
}

function withSelection(state: TasksPageState, action: SelectionAction<string>): TasksPageState {
  return setSlice(state, "selectedIds", selectionReducer(state.selectedIds, action));
}

// Replace the task list and drop selected IDs whose task no longer exists.
function withTasks(state: TasksPageState, tasks: Task[]): TasksPageState {
  return withSelection({ ...state, tasks }, { type: "selection/pruned", keep: tasks.map((task) => task.id) });
}

export function tasksPageReducer(state: TasksPageState, action: TasksPageAction): TasksPageState {
  if (isPaginationAction(action)) return setSlice(state, "pagination", paginationReducer(state.pagination, action));
  if (isSelectionAction<string>(action)) return withSelection(state, action);
  if (isRequestAction<TasksBulkRequest>(action)) return setSlice(state, "bulk", requestReducer(state.bulk, action));
  switch (action.type) {
    case "tabChanged":
      if (action.tab === state.activeTab) return state;
      return { ...state, activeTab: action.tab };
    case "tasksLoaded":
      return withTasks(state, action.tasks);
    case "taskCategoryMoved":
      return withTasks(state, moveTaskCategory(state.tasks, action.taskID, action.category));
    case "categoriesLoaded":
      return { ...state, categories: { items: action.categories, loaded: true } };
    case "filtersChanged":
      return setSlice(state, "filters", mergePatch(state.filters, action.patch));
    case "filtersHydrated":
      return {
        ...state,
        filters: {
          ...state.filters,
          status: action.status ?? state.filters.status,
          category: action.category ?? state.filters.category,
          hydrated: true,
        },
      };
    case "clockTicked":
      if (action.nowSec === state.nowSec) return state;
      return { ...state, nowSec: action.nowSec };
    // The checkboxes report the wanted state, so these check or uncheck explicitly.
    case "taskSelectionToggled":
      return withSelection(state, { type: "selection/changed", ids: [action.id], selected: action.checked });
    case "pageSelectionToggled":
      return withSelection(state, { type: "selection/changed", ids: action.ids, selected: action.checked });
    case "tasksDeselected":
      return withSelection(state, { type: "selection/changed", ids: action.ids, selected: false });
  }
}
