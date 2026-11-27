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
import type { NotificationDelivery } from "@/lib/types";

export const PAGE_SIZE = 50;

export type DeliveryFilters = {
  /** undefined = all channels. */
  channelID: number | undefined;
  /** Delivery state; undefined = all states. */
  state: string | undefined;
};

export type DeliveryListState = {
  filters: DeliveryFilters;
  /** 1-based, fixed size. */
  pagination: Pagination;
  list: ListState<NotificationDelivery>;
};

export type DeliveryListAction =
  | PaginationAction
  | ListAction<NotificationDelivery>
  | { type: "filtersChanged"; patch: Partial<DeliveryFilters> }
  | { type: "pageStepped"; delta: number };

export const initialDeliveryListState: DeliveryListState = {
  filters: { channelID: undefined, state: undefined },
  pagination: createPagination(PAGE_SIZE, 1),
  list: createList(),
};

export function deliveryListReducer(state: DeliveryListState, action: DeliveryListAction): DeliveryListState {
  if (isPaginationAction(action)) return setSlice(state, "pagination", paginationReducer(state.pagination, action));
  if (isListAction<NotificationDelivery>(action)) return setSlice(state, "list", listReducer(state.list, action));
  switch (action.type) {
    case "filtersChanged": {
      const filters = { ...state.filters, ...action.patch };
      const same = filters.channelID === state.filters.channelID && filters.state === state.filters.state;
      // Every filter change returns to the first page (picking the current value again does too).
      const pagination = toFirstPage(state.pagination);
      if (same && pagination === state.pagination) return state;
      return { ...state, filters: same ? state.filters : filters, pagination };
    }
    case "pageStepped": {
      const page = state.pagination.page + action.delta;
      return setSlice(
        state,
        "pagination",
        paginationReducer(state.pagination, { type: "pagination/pageChanged", page }),
      );
    }
  }
}
