import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { Tool } from "@/lib/types";

// ParamRow is one flattened schema.properties entry for editing.
// name/type/required are read-only (welded to the Go handler); description/default
// are editable. Non-scalar params (array/object) can't carry an editable default.
// parentKey is set for rows that live inside an array param's items.properties.
export type ParamRow = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultStr: string; // "" = no default declared
  scalar: boolean;
  parentKey?: string; // set when this is a sub-field of an array param's items
};

export type ToolEditorForm = {
  description: string;
  /** Bound agent keys. */
  bound: string[];
  enabled: boolean;
  rows: ParamRow[];
};

type ToolEditorRequest = "save";

export type ToolEditorState = {
  form: ToolEditorForm;
  requests: Requests<ToolEditorRequest>;
};

export type ToolEditorAction =
  | RequestAction<ToolEditorRequest>
  | { type: "formFieldChanged"; patch: Partial<Pick<ToolEditorForm, "description" | "enabled">> }
  | { type: "agentToggled"; agent: string }
  | { type: "rowChanged"; index: number; patch: Partial<ParamRow> };

/** Initial editor state for `tool`; `rows` is its schema flattened by the page. */
export function createToolEditorState(tool: Tool, rows: ParamRow[]): ToolEditorState {
  return {
    form: { description: tool.description, bound: tool.agents, enabled: tool.enabled, rows },
    requests: createRequests(["save"]),
  };
}

export function toolEditorReducer(state: ToolEditorState, action: ToolEditorAction): ToolEditorState {
  if (isRequestAction<ToolEditorRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "formFieldChanged":
      return { ...state, form: { ...state.form, ...action.patch } };
    case "agentToggled": {
      const { bound } = state.form;
      const next = bound.includes(action.agent) ? bound.filter((x) => x !== action.agent) : [...bound, action.agent];
      return { ...state, form: { ...state.form, bound: next } };
    }
    case "rowChanged": {
      const rows = state.form.rows.map((r, j) => (j === action.index ? { ...r, ...action.patch } : r));
      return { ...state, form: { ...state.form, rows } };
    }
  }
}
