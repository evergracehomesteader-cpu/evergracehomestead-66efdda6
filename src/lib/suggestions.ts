export const SUGGESTION_CATEGORIES = [
  { value: "feature", label: "Feature idea" },
  { value: "bug", label: "Bug report" },
  { value: "improvement", label: "Improvement" },
  { value: "question", label: "Question" },
] as const;

export const SUGGESTION_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const SUGGESTION_STATUSES = [
  { value: "submitted", label: "Submitted", progress: 10 },
  { value: "under_review", label: "Under Review", progress: 25 },
  { value: "needs_more_info", label: "Needs More Info", progress: 30 },
  { value: "planned", label: "Planned", progress: 50 },
  { value: "in_progress", label: "In Progress", progress: 75 },
  { value: "added", label: "Added", progress: 100 },
  { value: "rejected", label: "Rejected", progress: 100 },
] as const;

export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number]["value"];
export type SuggestionPriority = (typeof SUGGESTION_PRIORITIES)[number]["value"];
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number]["value"];

export function statusMeta(status: string) {
  return SUGGESTION_STATUSES.find((s) => s.value === status) ?? SUGGESTION_STATUSES[0];
}

export function categoryLabel(c: string) {
  return SUGGESTION_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export function priorityLabel(p: string) {
  return SUGGESTION_PRIORITIES.find((x) => x.value === p)?.label ?? p;
}

export function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "added") return "default";
  if (status === "rejected") return "destructive";
  if (status === "in_progress" || status === "planned") return "default";
  return "secondary";
}
