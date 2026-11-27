import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { selectionReducer } from "@/lib/reducers/selection";
import { setSlice } from "@/lib/reducers/slice";
import type {
  Finding,
  ModelTokenStat,
  Stats,
  Task,
  TaskConstraint,
  TaskGoal,
  TaskNode,
  TaskScopeRow,
} from "@/lib/types";

export type TaskCoverage = {
  enabled: boolean;
  scope_rows: number;
  denominator: number;
  tested: number;
  pct: number | null;
  by_type: { type: string; total: number; tested: number }[];
  gaps?: { kind: string; surface?: string; risk_area: string }[];
  completeness?: { complete: boolean; state: string; caveat: string };
};

/** Data refreshed by the 3s poll. */
export type OverviewData = {
  task: Task | null;
  stats: Stats | null;
  intents: TaskNode[];
  findings: Finding[];
  coverage: TaskCoverage | null;
};

export type ScopeForm = { kind: TaskScopeRow["kind"]; value: string };

export type ScopeSection = {
  rows: TaskScopeRow[];
  form: ScopeForm;
};

export type GoalForm = { text: string; vulnclass: string };
export type GoalEditor = GoalForm & { id: string | null };

export type GoalsSection = {
  items: TaskGoal[];
  form: GoalForm;
  editor: GoalEditor;
};

export type ConstraintForm = { text: string; kind: TaskConstraint["kind"] };
export type ConstraintEditor = ConstraintForm & { id: string | null };

export type ConstraintsSection = {
  items: TaskConstraint[];
  form: ConstraintForm;
  editor: ConstraintEditor;
};

/** Sections with an add/edit form whose requests share one busy flag and error line. */
export type OverviewSection = "scope" | "goals" | "constraints";

export type OverviewTabState = {
  data: OverviewData;
  /** Intent ids currently re-running ("__all__" means the batch). */
  rerunning: Set<string>;
  scope: ScopeSection;
  /** Token usage per model. */
  modelTokens: ModelTokenStat[];
  goals: GoalsSection;
  constraints: ConstraintsSection;
  /** Busy flag + last error of each section's add/save requests. */
  requests: Requests<OverviewSection>;
};

export type OverviewTabAction =
  | RequestAction<OverviewSection>
  | { type: "overviewLoaded"; task: Task; stats: Stats; intents: TaskNode[]; findings: Finding[] }
  | { type: "coverageLoaded"; coverage: TaskCoverage }
  | { type: "tokensLoaded"; models: ModelTokenStat[] }
  | { type: "rerunMarked"; key: string; on: boolean }
  | { type: "intentRerun"; id: string }
  | { type: "blockedIntentsRerun" }
  // Scope
  | { type: "scopeLoaded"; rows: TaskScopeRow[] }
  | { type: "scopeFormChanged"; patch: Partial<ScopeForm> }
  | { type: "scopeAdded" }
  | { type: "scopeRemoved"; id: TaskScopeRow["id"] }
  // Goals
  | { type: "goalsLoaded"; goals: TaskGoal[] }
  | { type: "goalFormChanged"; patch: Partial<GoalForm> }
  | { type: "goalAdded" }
  | { type: "goalEditStarted"; goal: TaskGoal }
  | { type: "goalEditorChanged"; patch: Partial<GoalForm> }
  | { type: "goalEditCancelled" }
  | { type: "goalRemoved"; id: string }
  // Constraints
  | { type: "constraintsLoaded"; constraints: TaskConstraint[] }
  | { type: "constraintFormChanged"; patch: Partial<ConstraintForm> }
  | { type: "constraintAdded" }
  | { type: "constraintEditStarted"; constraint: TaskConstraint }
  | { type: "constraintEditorChanged"; patch: Partial<ConstraintForm> }
  | { type: "constraintEditCancelled" }
  | { type: "constraintRemoved"; id: string };

const closedGoalEditor: GoalEditor = { id: null, text: "", vulnclass: "" };
const closedConstraintEditor: ConstraintEditor = { id: null, text: "", kind: "deny" };

export const initialOverviewTabState: OverviewTabState = {
  data: { task: null, stats: null, intents: [], findings: [], coverage: null },
  rerunning: new Set(),
  scope: { rows: [], form: { kind: "root_domain", value: "" } },
  modelTokens: [],
  goals: { items: [], form: { text: "", vulnclass: "" }, editor: closedGoalEditor },
  constraints: { items: [], form: { text: "", kind: "deny" }, editor: closedConstraintEditor },
  requests: createRequests(["scope", "goals", "constraints"]),
};

export function overviewTabReducer(state: OverviewTabState, action: OverviewTabAction): OverviewTabState {
  if (isRequestAction<OverviewSection>(action)) {
    return setSlice(state, "requests", requestReducer(state.requests, action));
  }
  switch (action.type) {
    case "overviewLoaded":
      return {
        ...state,
        data: {
          ...state.data,
          task: action.task,
          stats: action.stats,
          intents: action.intents,
          findings: action.findings,
        },
      };
    case "coverageLoaded":
      return { ...state, data: { ...state.data, coverage: action.coverage } };
    case "tokensLoaded":
      return { ...state, modelTokens: action.models };
    case "rerunMarked":
      return setSlice(
        state,
        "rerunning",
        selectionReducer(state.rerunning, { type: "selection/changed", ids: [action.key], selected: action.on }),
      );
    // Optimistic update after a successful rerun; the next poll is the backstop.
    case "intentRerun":
      return {
        ...state,
        data: {
          ...state.data,
          intents: state.data.intents.map((i) => (i.id === action.id ? { ...i, state: "open" } : i)),
        },
      };
    case "blockedIntentsRerun":
      return {
        ...state,
        data: {
          ...state.data,
          intents: state.data.intents.map((i) => (i.state === "blocked" ? { ...i, state: "open" } : i)),
        },
      };
    case "scopeLoaded":
      return { ...state, scope: { ...state.scope, rows: action.rows } };
    case "scopeFormChanged":
      return { ...state, scope: { ...state.scope, form: { ...state.scope.form, ...action.patch } } };
    case "scopeAdded":
      return { ...state, scope: { ...state.scope, form: { ...state.scope.form, value: "" } } };
    case "scopeRemoved":
      return { ...state, scope: { ...state.scope, rows: state.scope.rows.filter((s) => s.id !== action.id) } };

    case "goalsLoaded":
      return { ...state, goals: { ...state.goals, items: action.goals } };
    case "goalFormChanged":
      return { ...state, goals: { ...state.goals, form: { ...state.goals.form, ...action.patch } } };
    case "goalAdded":
      return { ...state, goals: { ...state.goals, form: { text: "", vulnclass: "" } } };
    case "goalEditStarted": {
      const { goal } = action;
      return {
        ...state,
        goals: { ...state.goals, editor: { id: goal.id, text: goal.text, vulnclass: goal.vulnclass ?? "" } },
      };
    }
    case "goalEditorChanged":
      return { ...state, goals: { ...state.goals, editor: { ...state.goals.editor, ...action.patch } } };
    case "goalEditCancelled":
      return { ...state, goals: { ...state.goals, editor: closedGoalEditor } };
    case "goalRemoved":
      return { ...state, goals: { ...state.goals, items: state.goals.items.filter((x) => x.id !== action.id) } };

    case "constraintsLoaded":
      return { ...state, constraints: { ...state.constraints, items: action.constraints } };
    case "constraintFormChanged":
      return { ...state, constraints: { ...state.constraints, form: { ...state.constraints.form, ...action.patch } } };
    case "constraintAdded":
      // The kind selector keeps its value for the next constraint.
      return { ...state, constraints: { ...state.constraints, form: { ...state.constraints.form, text: "" } } };
    case "constraintEditStarted": {
      const { constraint } = action;
      return {
        ...state,
        constraints: {
          ...state.constraints,
          editor: { id: constraint.id, text: constraint.text, kind: constraint.kind },
        },
      };
    }
    case "constraintEditorChanged":
      return {
        ...state,
        constraints: { ...state.constraints, editor: { ...state.constraints.editor, ...action.patch } },
      };
    case "constraintEditCancelled":
      return { ...state, constraints: { ...state.constraints, editor: closedConstraintEditor } };
    case "constraintRemoved":
      return {
        ...state,
        constraints: { ...state.constraints, items: state.constraints.items.filter((x) => x.id !== action.id) },
      };
  }
}
