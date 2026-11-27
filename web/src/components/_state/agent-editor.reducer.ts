import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { AgentDetail, MCPServer, PromptVar, PromptVersion, Settings, SkillItem, Tool } from "@/lib/types";

export type LlmProfile = NonNullable<AgentDetail["llm_profiles"]>[number];

/** The loaded agent and the read-only data that came with it. */
export type AgentEditorAgent = {
  /** null = not loaded yet, or the agent was not found. */
  detail: AgentDetail | null;
  /** True once the first load attempt finished (success or failure). */
  loaded: boolean;
  /** Newest first; [0] is the current version. */
  versions: PromptVersion[];
  variables: PromptVar[];
  llmProfiles: LlmProfile[];
};

/** Built-in defaults shown as placeholders and read-only references. */
export type AgentEditorDefaults = {
  wrapup: string;
  wrapupTurns: number;
  /** Task-level timeout wrap-up is only offered to worker/planner agents. */
  ttSupported: boolean;
  ttWrapup: string;
  ttTurns: number;
};

/** Editable fields; numbers stay strings while typed and are parsed on save. */
export type AgentEditorForm = {
  prompt: string;
  maxTurns: string;
  runSecs: string;
  /** "" = follow (unbound); otherwise a profile id string. */
  llmProfileId: string;
  webSearch: boolean;
  interactiveShell: boolean;
  wrapup: string;
  wrapupTurns: string;
  ttWrapup: string;
  ttTurns: string;
};

/** MCP servers and Skills visible to this agent; toggled live and saved immediately. */
export type AgentEditorVisibility = {
  mcp: number[];
  skill: string[];
};

/** Global lists loaded once when the editor mounts. */
export type AgentEditorCatalog = {
  mcp: MCPServer[];
  skills: SkillItem[];
  tools: Tool[];
  settings: Settings | null;
};

/** Version shown in the view dialog and version compared with the current one (null = closed). */
export type AgentEditorVersionDialogs = {
  viewing: PromptVersion | null;
  diffing: PromptVersion | null;
};

export type AgentEditorState = {
  agent: AgentEditorAgent;
  defaults: AgentEditorDefaults;
  form: AgentEditorForm;
  visibility: AgentEditorVisibility;
  catalog: AgentEditorCatalog;
  versionDialogs: AgentEditorVersionDialogs;
  /** Rendered prompt preview, or the error text when rendering failed. */
  preview: string;
};

export type AgentEditorAction =
  | { type: "catalogLoaded"; patch: Partial<AgentEditorCatalog> }
  | { type: "agentLoaded"; detail: AgentDetail }
  | { type: "agentLoadFailed" }
  | { type: "agentLoadFinished" }
  | { type: "formFieldChanged"; patch: Partial<AgentEditorForm> }
  | { type: "variableInserted"; name: string }
  | { type: "previewRendered"; text: string }
  | { type: "visibilityChanged"; patch: Partial<AgentEditorVisibility> }
  | { type: "toolAgentsChanged"; key: string; agents: string[] }
  | { type: "versionDialogsChanged"; patch: Partial<AgentEditorVersionDialogs> }
  | { type: "viewedVersionCompared" }
  | { type: "viewedVersionLoaded" };

export const initialAgentEditorState: AgentEditorState = {
  agent: { detail: null, loaded: false, versions: [], variables: [], llmProfiles: [] },
  defaults: { wrapup: "", wrapupTurns: 5, ttSupported: false, ttWrapup: "", ttTurns: 5 },
  form: {
    prompt: "",
    maxTurns: "0",
    runSecs: "600",
    llmProfileId: "",
    webSearch: false,
    interactiveShell: false,
    wrapup: "",
    wrapupTurns: "0",
    ttWrapup: "",
    ttTurns: "0",
  },
  visibility: { mcp: [], skill: [] },
  catalog: { mcp: [], skills: [], tools: [], settings: null },
  versionDialogs: { viewing: null, diffing: null },
  preview: "",
};

/** Fills the whole editor from a freshly loaded agent; unsaved edits are replaced. */
function fromDetail(state: AgentEditorState, d: AgentDetail): AgentEditorState {
  // biome-ignore-start lint/suspicious/noUnnecessaryConditions: the backend may send null for nil slices/strings despite the type; fallbacks kept from the original code.
  return {
    ...state,
    agent: {
      ...state.agent,
      detail: d,
      versions: d.versions ?? [],
      variables: d.variables ?? [],
      llmProfiles: d.llm_profiles ?? [],
    },
    defaults: {
      wrapup: d.wrapup_default ?? "",
      wrapupTurns: d.wrapup_max_turns_default ?? 5,
      ttSupported: !!d.task_timeout_wrapup_supported,
      ttWrapup: d.task_timeout_wrapup_default ?? "",
      ttTurns: d.task_timeout_wrapup_max_turns_default ?? 5,
    },
    form: {
      prompt: d.prompt ?? "",
      maxTurns: String(d.agent?.max_turns ?? 0),
      runSecs: String(d.agent?.run_seconds ?? 600),
      llmProfileId: d.agent?.llm_profile_id != null ? String(d.agent.llm_profile_id) : "",
      webSearch: !!d.agent?.web_search,
      interactiveShell: !!d.agent?.interactive_shell,
      wrapup: d.wrapup_prompt ?? "",
      wrapupTurns: String(d.wrapup_max_turns ?? 0),
      ttWrapup: d.task_timeout_wrapup_prompt ?? "",
      ttTurns: String(d.task_timeout_wrapup_max_turns ?? 0),
    },
    visibility: { mcp: d.visibility?.mcp ?? [], skill: d.visibility?.skill ?? [] },
  };
  // biome-ignore-end lint/suspicious/noUnnecessaryConditions: see above.
}

export function agentEditorReducer(state: AgentEditorState, action: AgentEditorAction): AgentEditorState {
  switch (action.type) {
    case "catalogLoaded":
      return setSlice(state, "catalog", mergePatch(state.catalog, action.patch));
    case "agentLoaded":
      return fromDetail(state, action.detail);
    case "agentLoadFailed":
      if (state.agent.detail === null) return state;
      return { ...state, agent: { ...state.agent, detail: null } };
    case "agentLoadFinished":
      if (state.agent.loaded) return state;
      return { ...state, agent: { ...state.agent, loaded: true } };
    case "formFieldChanged":
      return setSlice(state, "form", mergePatch(state.form, action.patch));
    case "variableInserted":
      return { ...state, form: { ...state.form, prompt: `${state.form.prompt}{{.${action.name}}}` } };
    case "previewRendered":
      return action.text === state.preview ? state : { ...state, preview: action.text };
    case "visibilityChanged":
      return setSlice(state, "visibility", mergePatch(state.visibility, action.patch));
    case "toolAgentsChanged": {
      const tools = state.catalog.tools.map((x) => (x.key === action.key ? { ...x, agents: action.agents } : x));
      return { ...state, catalog: { ...state.catalog, tools } };
    }
    case "versionDialogsChanged":
      return setSlice(state, "versionDialogs", mergePatch(state.versionDialogs, action.patch));
    case "viewedVersionCompared": {
      // Switches from the view dialog to the diff dialog for the same version.
      const { viewing } = state.versionDialogs;
      if (!viewing) return state;
      return { ...state, versionDialogs: { viewing: null, diffing: viewing } };
    }
    case "viewedVersionLoaded": {
      // Copies the viewed version's template into the editor and closes the dialog.
      const { viewing } = state.versionDialogs;
      if (!viewing) return state;
      return {
        ...state,
        form: { ...state.form, prompt: viewing.template_text },
        versionDialogs: { ...state.versionDialogs, viewing: null },
      };
    }
  }
}
