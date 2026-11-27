import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { mergePatch, setSlice } from "@/lib/reducers/slice";
import type { Agent, AgentTrigger, Tool } from "@/lib/types";

export type TriggerRunMode = "serial" | "parallel";
export type TriggerMergeMode = "by_task" | "all" | "none";

/** Per-agent post-trigger handling policy; each change is saved immediately. */
export type TriggerBehavior = {
  runMode: TriggerRunMode;
  mergeMode: TriggerMergeMode;
  /** Typed value; normalized and saved on blur. */
  maxParallel: string;
};

/** Create/edit form for one trigger; each condition carries its own user message. */
export type TriggerForm = {
  onInterval: boolean;
  intervalSec: string;
  onFinding: boolean;
  onGoalMet: boolean;
  onTaskTimeout: boolean;
  onToolCall: boolean;
  onTaskCreate: boolean;
  intervalMsg: string;
  findingMsg: string;
  goalMsg: string;
  taskTimeoutMsg: string;
  toolCallMsg: string;
  taskCreateMsg: string;
  /** Tools watched by the tool-call condition. */
  toolNames: string[];
};

export type TriggerEditor = {
  /** null = create mode; otherwise the id of the trigger being edited. */
  editingId: number | null;
  form: TriggerForm;
};

export type AgentTriggersTabRequest = "save";

/** The trigger policy fields of a saved agent. */
export type TriggerPolicy = Pick<Agent, "trigger_run_mode" | "trigger_merge_mode" | "trigger_max_parallel">;

export type AgentTriggersTabState = {
  triggers: AgentTrigger[];
  /** Tools offered for the tool-call condition. */
  tools: Tool[];
  behavior: TriggerBehavior;
  editor: TriggerEditor;
  requests: Requests<AgentTriggersTabRequest>;
};

export type AgentTriggersTabAction =
  | RequestAction<AgentTriggersTabRequest>
  | { type: "triggersLoaded"; triggers: AgentTrigger[] }
  | { type: "toolsLoaded"; tools: Tool[] }
  /** The agent's saved policy changed (new agent or reload); replaces the local values. */
  | { type: "behaviorSynced"; policy: TriggerPolicy }
  | { type: "behaviorChanged"; patch: Partial<TriggerBehavior> }
  | { type: "formFieldChanged"; patch: Partial<TriggerForm> }
  | { type: "toolNameToggled"; key: string }
  | { type: "formReset" }
  | { type: "editStarted"; trigger: AgentTrigger };

export const emptyTriggerForm: TriggerForm = {
  onInterval: false,
  intervalSec: "60",
  onFinding: false,
  onGoalMet: false,
  onTaskTimeout: false,
  onToolCall: false,
  onTaskCreate: false,
  intervalMsg: "",
  findingMsg: "",
  goalMsg: "",
  taskTimeoutMsg: "",
  toolCallMsg: "",
  taskCreateMsg: "",
  toolNames: [],
};

function behaviorOf(agent?: TriggerPolicy): TriggerBehavior {
  return {
    runMode: agent?.trigger_run_mode ?? "serial",
    mergeMode: agent?.trigger_merge_mode ?? "all",
    maxParallel: String(agent?.trigger_max_parallel ?? 5),
  };
}

export function createAgentTriggersTabState(agent?: TriggerPolicy): AgentTriggersTabState {
  return {
    triggers: [],
    tools: [],
    behavior: behaviorOf(agent),
    editor: { editingId: null, form: emptyTriggerForm },
    requests: createRequests(["save"]),
  };
}

function formOf(trg: AgentTrigger): TriggerForm {
  return {
    onInterval: trg.interval_sec > 0,
    intervalSec: trg.interval_sec > 0 ? String(trg.interval_sec) : "60",
    onFinding: trg.on_finding,
    onGoalMet: trg.on_goal_met,
    onTaskTimeout: trg.on_task_timeout,
    onToolCall: trg.on_tool_call,
    onTaskCreate: trg.on_task_create,
    intervalMsg: trg.interval_message,
    findingMsg: trg.finding_message,
    goalMsg: trg.goal_message,
    taskTimeoutMsg: trg.task_timeout_message,
    toolCallMsg: trg.tool_call_message,
    taskCreateMsg: trg.task_create_message,
    // biome-ignore lint/suspicious/noUnnecessaryConditions: the backend may send null for a nil slice; fallback kept from the original code.
    toolNames: trg.tool_names ?? [],
  };
}

function setForm(state: AgentTriggersTabState, form: TriggerForm): AgentTriggersTabState {
  return form === state.editor.form ? state : { ...state, editor: { ...state.editor, form } };
}

export function agentTriggersTabReducer(
  state: AgentTriggersTabState,
  action: AgentTriggersTabAction,
): AgentTriggersTabState {
  if (isRequestAction<AgentTriggersTabRequest>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "triggersLoaded":
      return { ...state, triggers: action.triggers };
    case "toolsLoaded":
      return { ...state, tools: action.tools };
    case "behaviorSynced":
      return setSlice(state, "behavior", mergePatch(state.behavior, behaviorOf(action.policy)));
    case "behaviorChanged":
      return setSlice(state, "behavior", mergePatch(state.behavior, action.patch));
    case "formFieldChanged":
      return setForm(state, mergePatch(state.editor.form, action.patch));
    case "toolNameToggled": {
      const { toolNames } = state.editor.form;
      const next = toolNames.includes(action.key)
        ? toolNames.filter((k) => k !== action.key)
        : [...toolNames, action.key];
      return setForm(state, { ...state.editor.form, toolNames: next });
    }
    case "formReset":
      // Clears the form and returns to create mode.
      if (state.editor.editingId === null && state.editor.form === emptyTriggerForm) return state;
      return { ...state, editor: { editingId: null, form: emptyTriggerForm } };
    case "editStarted":
      return { ...state, editor: { editingId: action.trigger.id, form: formOf(action.trigger) } };
  }
}
