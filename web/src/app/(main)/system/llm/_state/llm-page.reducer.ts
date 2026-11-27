import type { LLMPoolStatus, LLMProfile } from "@/lib/types";

export type LLMPageData = {
  profiles: LLMProfile[];
  pool: LLMPoolStatus | null;
};

/**
 * The profile drawer. Its open flag and its content are stored separately: the profile stays put on close,
 * otherwise during the closing animation the title would flash from "Edit X" to "New".
 */
export type LLMProfileEditor = {
  open: boolean;
  /** null = create. */
  profile: LLMProfile | null;
};

export type LLMPageState = {
  data: LLMPageData;
  poolOpen: boolean;
  editor: LLMProfileEditor;
};

export type LLMPageAction =
  | { type: "profilesLoaded"; profiles: LLMProfile[] }
  | { type: "poolLoaded"; pool: LLMPoolStatus }
  | { type: "poolOpenChanged"; open: boolean }
  | { type: "editorOpened"; profile: LLMProfile | null }
  | { type: "editorOpenChanged"; open: boolean };

export const initialLLMPageState: LLMPageState = {
  data: { profiles: [], pool: null },
  poolOpen: false,
  editor: { open: false, profile: null },
};

export function llmPageReducer(state: LLMPageState, action: LLMPageAction): LLMPageState {
  switch (action.type) {
    case "profilesLoaded":
      return { ...state, data: { ...state.data, profiles: action.profiles } };
    case "poolLoaded":
      return { ...state, data: { ...state.data, pool: action.pool } };
    case "poolOpenChanged":
      return action.open === state.poolOpen ? state : { ...state, poolOpen: action.open };
    case "editorOpened":
      if (state.editor.open && state.editor.profile === action.profile) return state;
      return { ...state, editor: { open: true, profile: action.profile } };
    case "editorOpenChanged":
      return action.open === state.editor.open ? state : { ...state, editor: { ...state.editor, open: action.open } };
  }
}
