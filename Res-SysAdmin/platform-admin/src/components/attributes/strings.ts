/**
 * UI chrome strings for the Attributes (taxonomy) screen.
 *
 * PA-UI has no i18n framework — the established convention (see
 * components/organizations/suppression-control.tsx) is a co-located `STRINGS`
 * object of English literals. We follow that convention here, centralized for
 * the screen + its dialogs. The taxonomy *data* labels (labelHy/Ru/En) are the
 * content being managed and are NOT part of this chrome.
 */
export const STRINGS = {
  // Page
  title: "Attributes",
  description:
    "Shared filter vocabulary for the consumer app — categories and values used across all restaurants. Curated centrally; owners only select from it.",
  newCategory: "New category",
  addValue: "Add value",

  // Empty / error / loading
  emptyTitle: "No attribute categories yet",
  emptyDescription: "Create your first category to start building the taxonomy.",
  noValues: "No values yet.",
  loadError: "Couldn’t load attributes",

  // Column / row chrome
  filterableBadge: "Filter",
  displayOnlyBadge: "Display-only",
  valuesCount: (n: number) => `${n} ${n === 1 ? "value" : "values"}`,

  // Actions
  edit: "Edit",
  delete: "Delete",
  cancel: "Cancel",

  // Filterable helper
  filterableHelp:
    "Filterable categories appear as filters in the consumer filter sheet. Non-filterable categories are shown as display-only “Features” on a restaurant.",

  // Category dialog
  createCategoryTitle: "Create category",
  editCategoryTitle: "Edit category",
  createCategorySubmit: "Create category",
  saveChanges: "Save changes",

  // Value dialog
  createValueTitle: "Add value",
  editValueTitle: "Edit value",
  createValueSubmit: "Add value",

  // Field labels
  slugLabel: "Slug",
  slugHintCreate: "Lowercase, no spaces (e.g. outdoor-seating). Permanent — can’t be changed later.",
  slugHintEdit: "Slug is permanent and can’t be changed.",
  labelEnLabel: "Label (English)",
  labelRuLabel: "Label (Russian)",
  labelHyLabel: "Label (Armenian)",
  positionLabel: "Position",
  positionHint: "Lower numbers appear first.",
  filterableLabel: "Filterable",

  // Validation
  slugRequired: "Slug is required.",
  slugInvalid: "Use lowercase letters, numbers and hyphens only — no spaces.",
  labelsRequired: "All three language labels are required.",

  // Confirm delete
  deleteCategoryTitle: "Delete category?",
  deleteValueTitle: "Delete value?",
  deleteCategoryBody: (label: string) =>
    `Delete “${label}” and all of its values? This removes it from the consumer filter sheet. This can’t be undone.`,
  deleteValueBody: (label: string) =>
    `Delete “${label}”? This removes it from the consumer taxonomy. This can’t be undone.`,
  deleteConfirm: "Delete",

  // In-use blocked message (no count exposed by the API contract)
  inUseTitle: "Can’t delete — in use",
  inUseCategoryDesc:
    "One or more values in this category are selected by restaurants. Remove those selections first, then try again.",
  inUseValueDesc:
    "This value is selected by one or more restaurants. Remove those selections first, then try again.",

  // Generic toasts
  categoryCreated: "Category created",
  categoryUpdated: "Category updated",
  categoryDeleted: "Category deleted",
  valueCreated: "Value added",
  valueUpdated: "Value updated",
  valueDeleted: "Value deleted",
  createFailed: "Create failed",
  updateFailed: "Update failed",
  deleteFailed: "Delete failed",
} as const;

/** Error code returned by the backend when a value/category is still referenced. */
export const ATTRIBUTE_VALUE_IN_USE = "ATTRIBUTE_VALUE_IN_USE";

/** Slug rule: lowercase letters, numbers, hyphen-separated (matches seed style). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
