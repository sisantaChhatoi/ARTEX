import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { LLMRetryOverride } from "@/lib/types";

// LLM profile formats. The default in the create form is "anthropic"; "ollama" is the
// keyless local-server format (base URL defaults to http://127.0.0.1:11434/v1).
export type ProfileFormat = "anthropic" | "openai" | "openai-responses" | "ollama" | "bedrock-gateway";

/** The editable profile, as typed: numbers stay strings until save; selects use the page's "none" sentinel. */
export type ProfileForm = {
  name: string;
  format: ProfileFormat;
  model: string;
  baseUrl: string;
  proxy: string;
  /** New key; empty keeps the stored one. */
  apiKey: string;
  rps: string;
  rpm: string;
  /** Context window (K tokens); 0 = default 200K. */
  cw: string;
  /** EUR per 1M tokens; "0" = not priced. */
  prices: { input: string; output: string; cacheRead: string; cacheWrite: string };
  thinkingType: string;
  effort: string;
  /** Pool order; higher = tried earlier. */
  priority: string;
  poolExclude: boolean;
  /** true = streaming (default); false = non-streaming. */
  streaming: boolean;
  /** Per-reply output cap; 0 = not sent. */
  maxTokens: string;
  /** Which field name carries the cap; the "none" sentinel = max_tokens. */
  maxTokensField: string;
  /** Custom session header name; empty = not sent. */
  sessionHeaderKey: string;
  /** Custom User-Agent; empty = keep the default UA. */
  userAgent: string;
  customHeaders: string;
  clearCustomHeaders: boolean;
  /** Retry override for this profile; all 0 = follow the global. */
  retry: LLMRetryOverride;
};

/** Models fetched from the provider API, picked from a searchable popover. */
export type ModelPicker = {
  items: string[];
  open: boolean;
  /** Filter text for the loaded list; reset on open/close. */
  query: string;
};

type ProfileSheetRequest = "test" | "save" | "models";

export type ProfileSheetState = {
  form: ProfileForm;
  /** Masked hint of the stored key, shown as the key placeholder. */
  keyHint: string;
  models: ModelPicker;
  requests: Requests<ProfileSheetRequest>;
};

export type ProfileSheetAction =
  | RequestAction<ProfileSheetRequest>
  /** The drawer opened: re-fill the form from the profile (or defaults) and drop the previous model list. */
  | { type: "opened"; form: ProfileForm; keyHint: string }
  | {
      type: "formFieldChanged";
      patch: Partial<Omit<ProfileForm, "customHeaders" | "clearCustomHeaders">>;
    }
  /** Typing new headers cancels "clear saved headers". */
  | { type: "customHeadersChanged"; customHeaders: string }
  /** Ticking "clear saved headers" empties the typed headers. */
  | { type: "clearCustomHeadersChanged"; clear: boolean }
  | { type: "modelsLoadStarted" }
  | { type: "modelsLoaded"; models: string[] }
  | { type: "modelsOpenChanged"; open: boolean }
  | { type: "modelQueryChanged"; query: string }
  | { type: "modelPicked"; model: string };

const CLOSED_PICKER: ModelPicker = { items: [], open: false, query: "" };

export function createProfileSheetState(form: ProfileForm, keyHint: string): ProfileSheetState {
  return { form, keyHint, models: CLOSED_PICKER, requests: createRequests(["test", "save", "models"]) };
}

export function profileSheetReducer(state: ProfileSheetState, action: ProfileSheetAction): ProfileSheetState {
  if (isRequestAction<ProfileSheetRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "opened":
      // Busy flags are left alone: they belong to requests that may still be in flight.
      return { ...state, form: action.form, keyHint: action.keyHint, models: CLOSED_PICKER };
    case "formFieldChanged":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "customHeadersChanged":
      return { ...state, form: { ...state.form, customHeaders: action.customHeaders, clearCustomHeaders: false } };
    case "clearCustomHeadersChanged": {
      const customHeaders = action.clear ? "" : state.form.customHeaders;
      return { ...state, form: { ...state.form, clearCustomHeaders: action.clear, customHeaders } };
    }
    case "modelsLoadStarted":
      return {
        ...state,
        models: { ...state.models, items: [], query: "" },
        requests: requestReducer<ProfileSheetRequest>(state.requests, { type: "request/started", key: "models" }),
      };
    case "modelsLoaded":
      return { ...state, models: { ...state.models, items: action.models, open: true } };
    case "modelsOpenChanged":
      // Closing also clears the filter, so the next open starts with the full list.
      return {
        ...state,
        models: { ...state.models, open: action.open, query: action.open ? state.models.query : "" },
      };
    case "modelQueryChanged":
      return { ...state, models: { ...state.models, query: action.query } };
    case "modelPicked":
      return { ...state, form: { ...state.form, model: action.model }, models: { ...state.models, open: false } };
  }
}
