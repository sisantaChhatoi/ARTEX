import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { type SelectionAction, selectionReducer } from "@/lib/reducers/selection";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { Agent, MCPServer, MissingSkill, SkillCall, SkillItem } from "@/lib/types";

/** A skill (detail panel, `path: null`) or one of its files (editor). */
export type Selected = { skill: string; path: null } | { skill: string; path: string };

/** Inline "new file / new folder" input shown in the tree. */
export type Creating = {
  skill: string;
  inDir: string;
  kind: "file" | "dir";
} | null;

export type PendingDelete =
  | { kind: "skill"; skill: string }
  | { kind: "file"; skill: string; path: string }
  | { kind: "dir"; skill: string; path: string }
  | null;

/** Server data shown across the page. */
export type SkillsLibrary = {
  skills: SkillItem[];
  agents: Agent[];
  mcpOptions: MCPServer[];
  /** Skills invoked by name that do not exist (wanted but absent). */
  missing: MissingSkill[];
  /** Agent ids each skill is visible to, by skill name. */
  visibility: Record<string, string[]>;
};

export type SkillFileEditor = {
  content: string;
  loading: boolean;
  dirty: boolean;
};

export type InlineCreate = {
  creating: Creating;
  name: string;
};

export type NewSkillForm = {
  name: string;
  desc: string;
  license: string;
  compat: string;
  inst: string;
  mcps: string[];
  /** Agent ids granted visibility once the skill is created. */
  visibility: string[];
};

export type NewSkillDialog = {
  open: boolean;
  form: NewSkillForm;
};

/** Recent calls of the selected skill (detail panel). */
export type SkillUsage = {
  calls: SkillCall[];
  loading: boolean;
};

export type SkillsRequest = "saveFile" | "createSkill" | "upload" | "delete";

export type SkillsPageState = {
  library: SkillsLibrary;
  /** Expanded tree nodes: skill names and `${skill}:${dirPath}` keys. */
  expanded: Set<string>;
  selected: Selected | null;
  editor: SkillFileEditor;
  inlineCreate: InlineCreate;
  newSkill: NewSkillDialog;
  /** MCPs linked to the selected skill (optimistic, rolled back on error). */
  detailMcps: string[];
  usage: SkillUsage;
  pendingDelete: PendingDelete;
  requests: Requests<SkillsRequest>;
};

export type SkillsPageAction =
  | RequestAction<SkillsRequest>
  | { type: "libraryChanged"; patch: Partial<SkillsLibrary> }
  | { type: "visibilityLoaded"; skill: string; ids: string[] }
  | { type: "nodeToggled"; key: string }
  /** Expands a skill and every folder along `dirPath`. */
  | { type: "pathExpanded"; skill: string; dirPath: string }
  /** Always stores a new object, so selecting the same file again reloads it. */
  | { type: "selected"; selected: Selected | null }
  | { type: "skillDeleted"; skill: string }
  | { type: "pathDeleted"; skill: string; path: string }
  | { type: "fileCleared" }
  | { type: "editorChanged"; patch: Partial<SkillFileEditor> }
  | { type: "fileLoaded"; content: string }
  | { type: "fileEdited"; content: string }
  | { type: "fileSaved" }
  | { type: "inlineCreateStarted"; skill: string; inDir: string; kind: "file" | "dir" }
  | { type: "inlineCreateNameChanged"; name: string }
  | { type: "inlineCreateEnded" }
  | { type: "newSkillOpenChanged"; open: boolean }
  | { type: "newSkillFieldChanged"; patch: Partial<NewSkillForm> }
  | { type: "newSkillMcpToggled"; name: string; on: boolean }
  | { type: "newSkillAgentToggled"; id: string; on: boolean }
  /** Closes the dialog and resets the form. */
  | { type: "newSkillCreated" }
  | { type: "detailMcpsSet"; mcps: string[] }
  | { type: "usageChanged"; patch: Partial<SkillUsage> }
  | { type: "pendingDeleteChanged"; pendingDelete: PendingDelete };

const EMPTY_NEW_SKILL_FORM: NewSkillForm = {
  name: "",
  desc: "",
  license: "",
  compat: "",
  inst: "",
  mcps: [],
  visibility: [],
};

export const initialSkillsPageState: SkillsPageState = {
  library: { skills: [], agents: [], mcpOptions: [], missing: [], visibility: {} },
  expanded: new Set(),
  selected: null,
  editor: { content: "", loading: false, dirty: false },
  inlineCreate: { creating: null, name: "" },
  newSkill: { open: false, form: EMPTY_NEW_SKILL_FORM },
  detailMcps: [],
  usage: { calls: [], loading: false },
  pendingDelete: null,
  requests: createRequests<SkillsRequest>(["saveFile", "createSkill", "upload", "delete"]),
};

function setLibrary(state: SkillsPageState, patch: Partial<SkillsLibrary>): SkillsPageState {
  return setSlice(state, "library", mergePatch(state.library, patch));
}

function setEditor(state: SkillsPageState, patch: Partial<SkillFileEditor>): SkillsPageState {
  return setSlice(state, "editor", mergePatch(state.editor, patch));
}

function setNewSkillForm(state: SkillsPageState, patch: Partial<NewSkillForm>): SkillsPageState {
  const form = mergePatch(state.newSkill.form, patch);
  return form === state.newSkill.form ? state : { ...state, newSkill: { ...state.newSkill, form } };
}

/** Adds `item` when checked, removes it when unchecked. */
function toggleIn<T>(list: T[], item: T, on: boolean): T[] {
  return on ? [...list, item] : list.filter((x) => x !== item);
}

function expandPath(expanded: Set<string>, skill: string, dirPath: string): Set<string> {
  const keys = [skill];
  if (dirPath) {
    let cur = "";
    for (const part of dirPath.split("/")) {
      cur = cur ? `${cur}/${part}` : part;
      keys.push(`${skill}:${cur}`);
    }
  }
  if (keys.every((k) => expanded.has(k))) return expanded;
  return new Set([...expanded, ...keys]);
}

export function skillsPageReducer(state: SkillsPageState, action: SkillsPageAction): SkillsPageState {
  if (isRequestAction<SkillsRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "libraryChanged":
      return setLibrary(state, action.patch);
    case "visibilityLoaded":
      return setLibrary(state, { visibility: { ...state.library.visibility, [action.skill]: action.ids } });
    case "nodeToggled": {
      const toggle: SelectionAction<string> = { type: "selection/toggled", id: action.key };
      return setSlice(state, "expanded", selectionReducer(state.expanded, toggle));
    }
    case "pathExpanded":
      return setSlice(state, "expanded", expandPath(state.expanded, action.skill, action.dirPath));
    case "selected":
      return { ...state, selected: action.selected };
    case "skillDeleted":
      return state.selected?.skill === action.skill ? { ...state, selected: null } : state;
    case "pathDeleted":
      return state.selected?.skill === action.skill && state.selected.path === action.path
        ? { ...state, selected: null }
        : state;
    case "fileCleared":
      return setEditor(state, { content: "", dirty: false });
    case "editorChanged":
      return setEditor(state, action.patch);
    case "fileLoaded":
      return setEditor(state, { content: action.content, dirty: false });
    case "fileEdited":
      return setEditor(state, { content: action.content, dirty: true });
    case "fileSaved":
      return setEditor(state, { dirty: false });
    case "inlineCreateStarted": {
      const { skill, inDir, kind } = action;
      return {
        ...state,
        expanded: expandPath(state.expanded, skill, inDir),
        inlineCreate: { creating: { skill, inDir, kind }, name: "" },
      };
    }
    case "inlineCreateNameChanged":
      return setSlice(state, "inlineCreate", mergePatch(state.inlineCreate, { name: action.name }));
    case "inlineCreateEnded":
      return setSlice(state, "inlineCreate", mergePatch(state.inlineCreate, { creating: null, name: "" }));
    case "newSkillOpenChanged":
      return setSlice(state, "newSkill", mergePatch(state.newSkill, { open: action.open }));
    case "newSkillFieldChanged":
      return setNewSkillForm(state, action.patch);
    case "newSkillMcpToggled":
      return setNewSkillForm(state, { mcps: toggleIn(state.newSkill.form.mcps, action.name, action.on) });
    case "newSkillAgentToggled":
      return setNewSkillForm(state, { visibility: toggleIn(state.newSkill.form.visibility, action.id, action.on) });
    case "newSkillCreated":
      return { ...state, newSkill: { open: false, form: EMPTY_NEW_SKILL_FORM } };
    case "detailMcpsSet":
      return setSlice(state, "detailMcps", action.mcps);
    case "usageChanged":
      return setSlice(state, "usage", mergePatch(state.usage, action.patch));
    case "pendingDeleteChanged":
      return setSlice(state, "pendingDelete", action.pendingDelete);
  }
}
