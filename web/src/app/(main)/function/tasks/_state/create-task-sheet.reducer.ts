import {
  createRequests,
  isRequestAction,
  type RequestAction,
  type Requests,
  requestReducer,
} from "@/lib/reducers/request";
import { setSlice } from "@/lib/reducers/slice";
import type { AssetInterceptRuleInput, Company, LLMProfile, TaskCredentialInput } from "@/lib/types";

// UPLOAD_MARKER labels the auto-appended block of uploaded-file paths inside the task
// description, so re-uploads append under the same block instead of adding a new header.
const UPLOAD_MARKER = "[Uploaded Files (Absolute Paths)]";

// appendUploads folds newly-uploaded files' ABSOLUTE paths into the description as a
// Read/Bash-friendly manifest — the worker opens them by path. Keeps one marked block:
// first upload adds the header, later uploads append bullets under it. Each file comes
// in as an already-rendered "- <path> (<size>)" line, so this file needs no formatter.
export function appendUploads(desc: string, lines: string[]): string {
  const bullets = lines.join("\n");
  if (desc.includes(UPLOAD_MARKER)) {
    return `${desc.replace(/\s*$/, "")}\n${bullets}\n`;
  }
  const head = desc.trim() ? `${desc.replace(/\s*$/, "")}\n\n` : "";
  return `${head}${UPLOAD_MARKER} worker can open them by path with Read/Bash:\n${bullets}\n`;
}

/** The task fields the user fills in; reset to the defaults after a successful create. */
export type CreateTaskForm = {
  name: string;
  categoryID: number | undefined;
  description: string;
  goal: string;
  selectedTemplateID: number | null;
  sourceTaskIDs: string[];
  companyIDs: number[];
  llmProfileIDs: string[];
  llmRotate: boolean;
  /** Task-level timeout (minutes); empty/0 = no limit. */
  timeoutMin: string;
  /** Planner heartbeat (minutes); default 10, minimum 10 (matching the backend). */
  heartbeatMin: string;
  /** Dispatch a seed intent at creation so the worker starts without waiting for the first planner round; off by default, standard plan-then-execute. */
  seedFirstIntent: boolean;
  /** Asset coverage feature; on by default. Off = no coverage computed/displayed, no scope accumulation, scope-related tools hidden (company links unaffected). */
  coverageEnabled: boolean;
  /** Task-level asset intercept rules (this task only, never entering the global table). */
  interceptRules: AssetInterceptRuleInput[];
  /** Test accounts declared at creation (#3); an empty password = the agent registers that account and records it. */
  credentials: TaskCredentialInput[];
};

/** Choices for the pickers, loaded once on mount. */
export type CreateTaskOptions = {
  profiles: LLMProfile[];
  companies: Company[];
};

/** File upload (method 1): files are staged under drafts/<draftId>/uploads/ before the task is created. */
export type CreateTaskUpload = {
  /** Files uploaded into the current draft. */
  count: number;
};

/** `upload`: staging files into the draft; `create`: submitting the task. */
export type CreateTaskRequest = "upload" | "create";

export type CreateTaskSheetState = {
  open: boolean;
  form: CreateTaskForm;
  options: CreateTaskOptions;
  upload: CreateTaskUpload;
  requests: Requests<CreateTaskRequest>;
};

export type CreateTaskTemplate = Pick<CreateTaskForm, "description" | "goal" | "categoryID" | "interceptRules">;

export type CreateTaskSheetAction =
  | RequestAction<CreateTaskRequest>
  | { type: "openChanged"; open: boolean }
  | { type: "formFieldChanged"; patch: Partial<CreateTaskForm> }
  | { type: "templateApplied"; template: CreateTaskTemplate }
  | { type: "credentialAdded" }
  | { type: "credentialChanged"; index: number; patch: Partial<TaskCredentialInput> }
  | { type: "credentialRemoved"; index: number }
  | { type: "profilesLoaded"; profiles: LLMProfile[] }
  | { type: "companiesLoaded"; companies: Company[] }
  | { type: "filesUploaded"; manifestLines: string[] }
  | { type: "taskCreated" };

export const initialCreateTaskForm: CreateTaskForm = {
  name: "",
  categoryID: undefined,
  description: "",
  goal: "",
  selectedTemplateID: null,
  sourceTaskIDs: [],
  companyIDs: [],
  llmProfileIDs: [],
  llmRotate: false,
  timeoutMin: "",
  heartbeatMin: "10",
  seedFirstIntent: false,
  coverageEnabled: true,
  interceptRules: [],
  credentials: [],
};

export const initialCreateTaskSheetState: CreateTaskSheetState = {
  open: false,
  form: initialCreateTaskForm,
  options: { profiles: [], companies: [] },
  upload: { count: 0 },
  requests: createRequests(["upload", "create"]),
};

function withForm(state: CreateTaskSheetState, patch: Partial<CreateTaskForm>): CreateTaskSheetState {
  return { ...state, form: { ...state.form, ...patch } };
}

export function createTaskSheetReducer(
  state: CreateTaskSheetState,
  action: CreateTaskSheetAction,
): CreateTaskSheetState {
  if (isRequestAction<CreateTaskRequest>(action))
    return setSlice(state, "requests", requestReducer(state.requests, action));
  switch (action.type) {
    case "openChanged":
      if (action.open === state.open) return state;
      return { ...state, open: action.open };
    case "formFieldChanged":
      return withForm(state, action.patch);
    case "templateApplied":
      // A template replaces the description, so the uploaded-files note no longer applies.
      return { ...withForm(state, action.template), upload: { ...state.upload, count: 0 } };
    case "credentialAdded":
      return withForm(state, {
        credentials: [...state.form.credentials, { domain: "", username: "", password: "", note: "" }],
      });
    case "credentialChanged":
      return withForm(state, {
        credentials: state.form.credentials.map((credential, i) =>
          i === action.index ? { ...credential, ...action.patch } : credential,
        ),
      });
    case "credentialRemoved":
      return withForm(state, { credentials: state.form.credentials.filter((_, i) => i !== action.index) });
    case "profilesLoaded":
      return { ...state, options: { ...state.options, profiles: action.profiles } };
    case "companiesLoaded":
      return { ...state, options: { ...state.options, companies: action.companies } };
    case "filesUploaded":
      return {
        ...withForm(state, { description: appendUploads(state.form.description, action.manifestLines) }),
        upload: { ...state.upload, count: state.upload.count + action.manifestLines.length },
      };
    case "taskCreated":
      return { ...state, open: false, form: initialCreateTaskForm, upload: { ...state.upload, count: 0 } };
  }
}
