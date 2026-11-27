import { createList, isListAction, type ListAction, type ListState, listReducer } from "@/lib/reducers/list";
import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { AssetInterceptKind, AssetInterceptRule } from "@/lib/types";

export type RuleForm = {
  enabled: boolean;
  kind: AssetInterceptKind;
  pattern: string;
  note: string;
};

export const defaultForm = (): RuleForm => ({ enabled: true, kind: "fuzzy_domain", pattern: "", note: "" });

/** Create/edit rule sheet. */
export type RuleEditor = {
  open: boolean;
  /** Rule being edited; null = creating a new one. */
  editing: AssetInterceptRule | null;
  form: RuleForm;
};

export type AssetInterceptPageState = {
  /** Rules list; `loaded` false until the first load settles. */
  list: ListState<AssetInterceptRule>;
  editor: RuleEditor;
  requests: Requests<"save">;
};

export type AssetInterceptPageAction =
  | ListAction<AssetInterceptRule>
  | RequestAction<"save">
  | { type: "newRuleOpened" }
  | { type: "editRuleOpened"; rule: AssetInterceptRule }
  | { type: "editorOpenChanged"; open: boolean }
  | { type: "formFieldChanged"; patch: Partial<RuleForm> };

export const initialAssetInterceptPageState: AssetInterceptPageState = {
  list: createList(),
  editor: { open: false, editing: null, form: defaultForm() },
  requests: createRequests(["save"]),
};

export function assetInterceptPageReducer(
  state: AssetInterceptPageState,
  action: AssetInterceptPageAction,
): AssetInterceptPageState {
  if (isListAction<AssetInterceptRule>(action)) return setSlice(state, "list", listReducer(state.list, action));
  if (isRequestAction<"save">(action)) return setSlice(state, "requests", requestReducer(state.requests, action));
  switch (action.type) {
    case "newRuleOpened":
      return { ...state, editor: { open: true, editing: null, form: defaultForm() } };
    case "editRuleOpened": {
      const { enabled, kind, pattern, note } = action.rule;
      return { ...state, editor: { open: true, editing: action.rule, form: { enabled, kind, pattern, note } } };
    }
    case "editorOpenChanged":
      if (action.open === state.editor.open) return state;
      return { ...state, editor: { ...state.editor, open: action.open } };
    case "formFieldChanged":
      return { ...state, editor: { ...state.editor, form: { ...state.editor.form, ...action.patch } } };
  }
}
