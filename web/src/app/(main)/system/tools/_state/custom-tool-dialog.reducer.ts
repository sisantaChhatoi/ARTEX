import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { Tool } from "@/lib/types";

export type CustomToolKind = "shell" | "command" | "script" | "http";

/** Execution spec fields as edited (all strings except the proxy checkbox). */
export type ExecState = {
  command: string;
  code: string;
  method: string;
  url: string;
  headers: string;
  body: string;
  timeout_ms: string;
  proxy: string;
  use_recording_proxy: boolean;
};

export type CustomToolForm = {
  key: string;
  description: string;
  kind: CustomToolKind;
  ex: ExecState;
  /** Parameter JSON Schema as typed. */
  schemaText: string;
  /** Bound agent keys. */
  bound: string[];
  deferred: boolean;
  enabled: boolean;
};

export type CustomToolTestResult = { output: string; is_error: boolean };

/** Dry run of the current (unsaved) form. */
export type CustomToolTest = {
  /** Sample params JSON as typed. */
  paramsText: string;
  result: CustomToolTestResult | null;
};

type CustomToolRequest = "save" | "test";

export type CustomToolDialogState = {
  form: CustomToolForm;
  test: CustomToolTest;
  requests: Requests<CustomToolRequest>;
};

export type CustomToolDialogAction =
  | RequestAction<CustomToolRequest>
  /** The sheet opened for a new tool or an existing one: (re)load the form. */
  | { type: "editLoaded"; edit: Tool | "new" }
  | { type: "formFieldChanged"; patch: Partial<Omit<CustomToolForm, "ex">> }
  | { type: "execFieldChanged"; patch: Partial<ExecState> }
  | { type: "agentToggled"; agent: string }
  | { type: "testChanged"; patch: Partial<CustomToolTest> }
  /** A test run started: mark it running and clear the previous result. */
  | { type: "testStarted" };

const EMPTY_EXEC: ExecState = {
  command: "",
  code: "",
  method: "GET",
  url: "",
  headers: "",
  body: "",
  timeout_ms: "",
  proxy: "",
  use_recording_proxy: false,
};

const EMPTY_FORM: CustomToolForm = {
  key: "",
  description: "",
  kind: "shell",
  ex: EMPTY_EXEC,
  schemaText: "",
  bound: [],
  deferred: false,
  enabled: true,
};

export const initialCustomToolDialogState: CustomToolDialogState = {
  form: EMPTY_FORM,
  test: { paramsText: "", result: null },
  requests: createRequests(["save", "test"]),
};

function formFromTool(tool: Tool): CustomToolForm {
  const e = (tool.exec ?? {}) as Record<string, unknown>;
  return {
    key: tool.key,
    description: tool.description,
    kind: (tool.kind as CustomToolKind) ?? "shell",
    ex: {
      command: String(e.command ?? ""),
      code: String(e.code ?? ""),
      method: String(e.method ?? "GET"),
      url: String(e.url ?? ""),
      headers: e.headers ? JSON.stringify(e.headers, null, 2) : "",
      body: String(e.body ?? ""),
      timeout_ms: e.timeout_ms ? String(e.timeout_ms) : "",
      proxy: String(e.proxy ?? ""),
      use_recording_proxy: !!e.use_recording_proxy,
    },
    // biome-ignore lint/suspicious/noUnnecessaryConditions: older APIs may omit schema/agents despite the type; kept from the original code.
    schemaText: tool.schema && Object.keys(tool.schema).length ? JSON.stringify(tool.schema, null, 2) : "",
    // biome-ignore lint/suspicious/noUnnecessaryConditions: see above.
    bound: tool.agents ?? [],
    deferred: !!tool.deferred,
    enabled: tool.enabled,
  };
}

export function customToolDialogReducer(
  state: CustomToolDialogState,
  action: CustomToolDialogAction,
): CustomToolDialogState {
  if (isRequestAction<CustomToolRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "editLoaded":
      // Busy flags are left alone: they belong to requests that may still be in flight.
      return {
        ...state,
        form: action.edit === "new" ? EMPTY_FORM : formFromTool(action.edit),
        test: { paramsText: "", result: null },
      };
    case "formFieldChanged":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "execFieldChanged":
      return { ...state, form: { ...state.form, ex: { ...state.form.ex, ...action.patch } } };
    case "agentToggled": {
      const { bound } = state.form;
      const next = bound.includes(action.agent) ? bound.filter((x) => x !== action.agent) : [...bound, action.agent];
      return { ...state, form: { ...state.form, bound: next } };
    }
    case "testChanged":
      return { ...state, test: { ...state.test, ...action.patch } };
    case "testStarted":
      return {
        ...state,
        test: { ...state.test, result: null },
        requests: requestReducer<CustomToolRequest>(state.requests, { type: "request/started", key: "test" }),
      };
  }
}
