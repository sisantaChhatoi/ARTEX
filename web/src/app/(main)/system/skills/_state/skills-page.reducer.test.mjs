import { initialSkillsPageState, skillsPageReducer } from "./skills-page.reducer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const reduce = (actions, state = initialSkillsPageState) => actions.reduce(skillsPageReducer, state);

test("pathExpanded opens the skill and every folder on the path, keeping others", () => {
  const s = reduce([
    { type: "nodeToggled", key: "other" },
    { type: "pathExpanded", skill: "sk", dirPath: "a/b" },
  ]);
  assert.deepEqual([...s.expanded].sort(), ["other", "sk", "sk:a", "sk:a/b"]);
  assert.equal(skillsPageReducer(s, { type: "pathExpanded", skill: "sk", dirPath: "a" }), s);
});

test("inlineCreateStarted expands the target folder and resets the name", () => {
  const s = reduce([
    { type: "inlineCreateNameChanged", name: "old" },
    { type: "inlineCreateStarted", skill: "sk", inDir: "scripts", kind: "file" },
  ]);
  assert.deepEqual(s.inlineCreate, { creating: { skill: "sk", inDir: "scripts", kind: "file" }, name: "" });
  assert.ok(s.expanded.has("sk") && s.expanded.has("sk:scripts"));
  const ended = skillsPageReducer(s, { type: "inlineCreateEnded" });
  assert.deepEqual(ended.inlineCreate, { creating: null, name: "" });
});

test("selecting always stores a new object so effects re-run", () => {
  const sel = { skill: "sk", path: "a.py" };
  const s = reduce([{ type: "selected", selected: sel }]);
  assert.notEqual(skillsPageReducer(s, { type: "selected", selected: sel }), s);
});

test("deletes deselect only the open item", () => {
  const file = reduce([{ type: "selected", selected: { skill: "sk", path: "a.py" } }]);
  assert.equal(skillsPageReducer(file, { type: "pathDeleted", skill: "sk", path: "b.py" }), file);
  assert.equal(skillsPageReducer(file, { type: "pathDeleted", skill: "sk", path: "a.py" }).selected, null);
  assert.equal(skillsPageReducer(file, { type: "skillDeleted", skill: "other" }), file);
  assert.equal(skillsPageReducer(file, { type: "skillDeleted", skill: "sk" }).selected, null);
});

test("file editor tracks dirty across edit, load and save", () => {
  const edited = reduce([
    { type: "fileLoaded", content: "x" },
    { type: "fileEdited", content: "xy" },
  ]);
  assert.deepEqual(edited.editor, { content: "xy", loading: false, dirty: true });
  assert.equal(skillsPageReducer(edited, { type: "fileSaved" }).editor.dirty, false);
  assert.deepEqual(skillsPageReducer(edited, { type: "fileCleared" }).editor, {
    content: "",
    loading: false,
    dirty: false,
  });
});
