"use client";

import * as React from "react";

import { LibraryIcon, PlusIcon, SaveIcon, Settings2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  initialTaskTemplateControlsState,
  taskTemplateControlsReducer,
} from "@/components/_state/task-template-controls.reducer";
import {
  initialTaskTemplateManagerState,
  type TemplateDraft,
  type TemplateSeed,
  taskTemplateManagerReducer,
} from "@/components/_state/task-template-manager.reducer";
import { AssetInterceptRulesEditor } from "@/components/asset-intercept-rules-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { AssetInterceptRuleInput, TaskTemplate } from "@/lib/types";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

interface TaskTemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TaskTemplate[];
  seed: TemplateSeed | null;
  onCreated: (template: TaskTemplate) => void;
  onUpdated: (template: TaskTemplate) => void;
  onDeleted: (id: number) => void;
}

function TaskTemplateManager({
  open,
  onOpenChange,
  templates,
  seed,
  onCreated,
  onUpdated,
  onDeleted,
}: TaskTemplateManagerProps) {
  const [state, dispatch] = React.useReducer(taskTemplateManagerReducer, initialTaskTemplateManagerState);
  const { selectedID, draft } = state.editor;
  const { categories, deleteOpen } = state;
  const saving = state.requests.save.pending;
  const deleting = state.requests.delete.pending;
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    api
      .taskCategories()
      .then((loaded) => dispatch({ type: "categoriesLoaded", categories: loaded }))
      .catch(() => dispatch({ type: "categoriesLoaded", categories: [] }));
  }, [open]);

  React.useEffect(() => {
    if (open && !wasOpen.current) dispatch({ type: "managerOpened", seed, templates });
    wasOpen.current = open;
  }, [open, seed, templates]);

  const selectTemplate = (template: TaskTemplate) => {
    dispatch({ type: "templateSelected", template });
  };

  const startNew = () => {
    dispatch({ type: "newStarted" });
  };

  const updateDraft = (field: "name" | "description" | "goal", value: string) => {
    dispatch({ type: "draftChanged", patch: { [field]: value } });
  };

  const patchDraft = (patch: Partial<TemplateDraft>) => {
    dispatch({ type: "draftChanged", patch });
  };

  async function save() {
    const input = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      goal: draft.goal.trim(),
      category_id: draft.categoryID,
      intercept_rules: draft.interceptRules
        .map((r) => ({ ...r, pattern: r.pattern.trim() }))
        .filter((r) => r.pattern !== ""),
    };
    if (!input.name || !input.description || !input.goal) {
      toast.error(t("Fill in the template name, description, and goal"));
      return;
    }
    dispatch({ type: "request/started", key: "save" });
    try {
      if (selectedID == null) {
        const created = await api.createTaskTemplate(input);
        onCreated(created);
        dispatch({ type: "templateCreated", template: created });
        toast.success(t("Template created"));
      } else {
        const updated = await api.updateTaskTemplate(selectedID, input);
        onUpdated(updated);
        dispatch({ type: "templateUpdated", template: updated });
        toast.success(t("Template updated"));
      }
    } catch (error) {
      toast.error(t("Save failed: {error}", { error: (error as Error).message }));
    } finally {
      dispatch({ type: "request/finished", key: "save" });
    }
  }

  async function remove() {
    if (selectedID == null) return;
    const deletedID = selectedID;
    dispatch({ type: "request/started", key: "delete" });
    try {
      await api.deleteTaskTemplate(deletedID);
      onDeleted(deletedID);
      dispatch({ type: "templateDeleted", id: deletedID, templates });
      toast.success(t("Template deleted"));
    } catch (error) {
      toast.error(t("Delete failed: {error}", { error: (error as Error).message }));
    } finally {
      dispatch({ type: "request/finished", key: "delete" });
    }
  }

  let saveLabel = saving ? t("Saving") : t("Save changes");
  if (!saving && selectedID == null) saveLabel = t("Create template");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="grid h-full w-full! max-w-none! grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-[48rem]! sm:max-w-[48rem]!">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{t("Task template management")}</SheetTitle>
            <SheetDescription>
              {t(
                "Templates store the description, goal, category, and task-level intercept/allow rules; edits do not affect already-created tasks.",
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[15rem_minmax(0,1fr)] lg:overflow-hidden">
            <div className="flex min-h-0 flex-col border-b p-3 lg:border-r lg:border-b-0">
              <Button type="button" variant="outline" className="w-full" onClick={startNew}>
                <PlusIcon data-icon="inline-start" />
                {t("Create template")}
              </Button>
              <ScrollArea className="mt-2 max-h-44 lg:max-h-none lg:flex-1">
                <div className="flex flex-col gap-1 pr-2">
                  {templates.length === 0 && (
                    <p className="px-2 py-6 text-center text-muted-foreground text-sm">{t("No templates yet")}</p>
                  )}
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={cn(
                        "min-w-0 rounded-md px-2.5 py-2 text-left transition-colors",
                        selectedID === template.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                      )}
                      onClick={() => selectTemplate(template)}
                    >
                      <span className="block truncate font-medium text-sm">{template.name}</span>
                      <span className="block truncate text-muted-foreground text-xs">{template.description}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <ScrollArea className="min-h-0">
              <FieldGroup className="p-6">
                <Field>
                  <FieldLabel htmlFor="task-template-name">{t("Template name")}</FieldLabel>
                  <Input
                    id="task-template-name"
                    value={draft.name}
                    maxLength={120}
                    placeholder={t("e.g. External web penetration testing")}
                    onChange={(event) => updateDraft("name", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="task-template-description">{t("Description")}</FieldLabel>
                  <Textarea
                    id="task-template-description"
                    className="min-h-28"
                    value={draft.description}
                    placeholder={t("Test target and background")}
                    onChange={(event) => updateDraft("description", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="task-template-goal">{t("Goal")}</FieldLabel>
                  <Textarea
                    id="task-template-goal"
                    className="min-h-28"
                    value={draft.goal}
                    placeholder={t("Goals the task needs to achieve")}
                    onChange={(event) => updateDraft("goal", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="task-template-category">{t("Task category")}</FieldLabel>
                  <NativeSelect
                    id="task-template-category"
                    className="w-full"
                    value={draft.categoryID == null ? "" : String(draft.categoryID)}
                    onChange={(event) =>
                      patchDraft({ categoryID: event.target.value === "" ? null : Number(event.target.value) })
                    }
                  >
                    <NativeSelectOption value="">{t("Uncategorized")}</NativeSelectOption>
                    {categories.map((c) => (
                      <NativeSelectOption key={c.id} value={String(c.id)}>
                        {c.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldDescription>{t("This category is prefilled when the template is applied (still editable).")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>{t("Task-level intercept / allow rules")}</FieldLabel>
                  <AssetInterceptRulesEditor
                    value={draft.interceptRules}
                    onChange={(rules) => patchDraft({ interceptRules: rules })}
                  />
                  <FieldDescription>
                    {t("These task-level rules are prefilled when the template is applied (intercept/allow, effective only for new tasks, never global).")}
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </ScrollArea>
          </div>
          <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:items-center">
            {selectedID != null && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => dispatch({ type: "deleteOpenChanged", open: true })}
              >
                <Trash2Icon data-icon="inline-start" />
                {t("Delete template")}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Close")}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
              {saveLabel}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => dispatch({ type: "deleteOpenChanged", open: nextOpen })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete template "{name}"?', { name: draft.name || t("Untitled template") })}</AlertDialogTitle>
            <AlertDialogDescription>{t("Tasks already created from this template are not affected.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {deleting && <Spinner data-icon="inline-start" />}
              {deleting ? t("Deleting") : t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface TaskTemplateControlsProps {
  description: string;
  goal: string;
  categoryID?: number;
  interceptRules?: AssetInterceptRuleInput[];
  selectedTemplateID: number | null;
  onSelectedTemplateIDChange: (id: number | null) => void;
  onApply: (template: TaskTemplate) => void;
  portalContainer?: React.RefObject<HTMLElement | null>;
}

export function TaskTemplateControls({
  description,
  goal,
  categoryID,
  interceptRules,
  selectedTemplateID,
  onSelectedTemplateIDChange,
  onApply,
  portalContainer,
}: TaskTemplateControlsProps) {
  const [state, dispatch] = React.useReducer(taskTemplateControlsReducer, initialTaskTemplateControlsState);
  const { items: templates, loading } = state.templates;
  const { inputValue: templateInputValue, pending: pendingTemplate } = state.picker;
  const { open: managerOpen, seed: managerSeed } = state.manager;

  const loadTemplates = React.useCallback(async () => {
    dispatch({ type: "list/loadStarted" });
    try {
      dispatch({ type: "list/loaded", items: await api.taskTemplates() });
    } catch (error) {
      dispatch({ type: "list/loaded", items: [] });
      toast.error(t("Failed to load templates: {error}", { error: (error as Error).message }));
    } finally {
      dispatch({ type: "list/loadFinished" });
    }
  }, []);

  React.useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const selectedTemplate = React.useMemo(
    () => templates.find((template) => template.id === selectedTemplateID) ?? null,
    [selectedTemplateID, templates],
  );

  React.useEffect(() => {
    dispatch({ type: "inputValueChanged", value: selectedTemplate?.name ?? "" });
  }, [selectedTemplate]);

  const applyTemplate = (template: TaskTemplate) => {
    onApply(template);
    onSelectedTemplateIDChange(template.id);
    dispatch({ type: "confirmClosed" });
  };

  const chooseTemplate = (template: TaskTemplate | null) => {
    if (!template) {
      dispatch({ type: "inputValueChanged", value: "" });
      onSelectedTemplateIDChange(null);
      return;
    }
    dispatch({ type: "inputValueChanged", value: template.name });
    const hasContent = description.trim() !== "" || goal.trim() !== "";
    const changesContent = description !== template.description || goal !== template.goal;
    if (hasContent && changesContent) {
      dispatch({ type: "confirmRequested", template });
      return;
    }
    applyTemplate(template);
  };

  const openManager = (seed: TemplateSeed | null) => {
    dispatch({ type: "managerOpened", seed });
  };

  const upsertTemplate = (template: TaskTemplate) => {
    dispatch({ type: "templateUpserted", template });
  };

  const deleteTemplate = (id: number) => {
    dispatch({ type: "templateRemoved", id });
    if (selectedTemplateID === id) onSelectedTemplateIDChange(null);
  };

  let pickerPlaceholder = loading ? t("Loading templates") : t("No task templates yet");
  if (!loading && templates.length > 0) pickerPlaceholder = t("Search and select a task template");

  return (
    <>
      <Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel htmlFor="task-template-picker">{t("Task template")}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => openManager(null)}>
              <Settings2Icon data-icon="inline-start" />
              {t("Manage templates")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!description.trim() || !goal.trim()}
              onClick={() =>
                openManager({
                  description,
                  goal,
                  categoryID: categoryID ?? null,
                  interceptRules: interceptRules ?? [],
                })
              }
            >
              <SaveIcon data-icon="inline-start" />
              {t("Save as template")}
            </Button>
          </div>
        </div>
        <Combobox
          items={templates}
          itemToStringLabel={(template) => template.name}
          itemToStringValue={(template) => String(template.id)}
          inputValue={templateInputValue}
          onInputValueChange={(value) => dispatch({ type: "inputValueChanged", value })}
          value={selectedTemplate}
          onValueChange={chooseTemplate}
        >
          <ComboboxInput
            id="task-template-picker"
            className="w-full"
            placeholder={pickerPlaceholder}
            disabled={loading || templates.length === 0}
            showClear
          />
          <ComboboxContent portalContainer={portalContainer}>
            <ComboboxEmpty>{t("No matching templates")}</ComboboxEmpty>
            <ComboboxList>
              {(template) => (
                <ComboboxItem key={template.id} value={template}>
                  <LibraryIcon />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{template.name}</p>
                    {template.description && (
                      <p className="truncate text-muted-foreground text-xs">{template.description}</p>
                    )}
                  </div>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <FieldDescription>
          {t(
            "Selecting copies the template's description, goal, category, and task-level rules; no link to the template is kept.",
          )}
        </FieldDescription>
      </Field>

      <AlertDialog
        open={pendingTemplate != null}
        onOpenChange={(open) => {
          if (open) return;
          dispatch({ type: "confirmDismissed", inputValue: selectedTemplate?.name ?? "" });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Use template "{name}"?', { name: pendingTemplate?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("The description and goal already filled in will be overwritten by the template.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingTemplate && applyTemplate(pendingTemplate)}>
              {t("Overwrite and use")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskTemplateManager
        open={managerOpen}
        onOpenChange={(open) => dispatch({ type: "managerOpenChanged", open })}
        templates={templates}
        seed={managerSeed}
        onCreated={upsertTemplate}
        onUpdated={upsertTemplate}
        onDeleted={deleteTemplate}
      />
    </>
  );
}
