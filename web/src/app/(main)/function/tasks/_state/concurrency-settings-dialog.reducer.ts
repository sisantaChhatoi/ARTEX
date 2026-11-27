import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";

export type ConcurrencySettingsForm = {
  enabled: boolean;
  /** Raw input value; parsed and clamped on save. */
  limit: string;
};

/** `load`: settings are being fetched after the dialog opened. */
export type ConcurrencySettingsRequest = "load" | "save";

export type ConcurrencySettingsDialogState = {
  open: boolean;
  form: ConcurrencySettingsForm;
  requests: Requests<ConcurrencySettingsRequest>;
};

export type ConcurrencySettingsDialogAction =
  | RequestAction<ConcurrencySettingsRequest>
  | { type: "openChanged"; open: boolean }
  | { type: "formChanged"; patch: Partial<ConcurrencySettingsForm> }
  | { type: "settingsLoaded"; form: ConcurrencySettingsForm };

export const initialConcurrencySettingsDialogState: ConcurrencySettingsDialogState = {
  open: false,
  form: { enabled: false, limit: "5" },
  requests: createRequests(["load", "save"]),
};

export function concurrencySettingsDialogReducer(
  state: ConcurrencySettingsDialogState,
  action: ConcurrencySettingsDialogAction,
): ConcurrencySettingsDialogState {
  if (isRequestAction<ConcurrencySettingsRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "openChanged":
      if (action.open === state.open) return state;
      return { ...state, open: action.open };
    case "formChanged":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "settingsLoaded":
      return { ...state, form: action.form };
  }
}
