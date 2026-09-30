import type { Rule } from "antd/es/form";
import dayjs, { type Dayjs } from "dayjs";

export interface ProjectDateBounds {
  start_date?: string | null;
  end_date?: string | null;
  estimated_hours?: number | string | null;
}

/** Earliest selectable due date: max(today, project start). Latest: project end. */
export function getTicketDueDateBounds(project?: ProjectDateBounds | null) {
  const today = dayjs().startOf("day");
  const start = project?.start_date ? dayjs(project.start_date).startOf("day") : null;
  const end   = project?.end_date   ? dayjs(project.end_date).startOf("day")   : null;
  const min   = start && start.isAfter(today) ? start : today;
  return { min, max: end };
}

export function disableTicketDueDate(current: Dayjs, project?: ProjectDateBounds | null): boolean {
  const { min, max } = getTicketDueDateBounds(project);
  if (current.isBefore(min, "day")) return true;
  if (max && current.isAfter(max, "day")) return true;
  return false;
}

export function getMaxOriginalEstimate(project?: ProjectDateBounds | null): number | undefined {
  const hrs = Number(project?.estimated_hours ?? 0);
  return hrs > 0 ? hrs : undefined;
}

export function dueDateHelperText(project?: ProjectDateBounds | null): string | undefined {
  const { min, max } = getTicketDueDateBounds(project);
  if (!project?.start_date && !project?.end_date) {
    return `Select today (${min.format("DD MMM YYYY")}) or a future date`;
  }
  const parts = [`from ${min.format("DD MMM YYYY")}`];
  if (max) parts.push(`to ${max.format("DD MMM YYYY")}`);
  return `Select a date ${parts.join(" ")}`;
}

export function estimateHelperText(project?: ProjectDateBounds | null): string | undefined {
  const max = getMaxOriginalEstimate(project);
  if (max == null) return undefined;
  return `Maximum ${max}h (project estimate)`;
}

export function originalEstimateFormRules(
  project?: ProjectDateBounds | null,
  label = "Original estimate",
): Rule[] {
  const max = getMaxOriginalEstimate(project);
  if (max == null) return [];

  return [{
    validator: async (_, value) => {
      if (value == null || value === "") return;
      if (Number(value) > max) {
        throw new Error(`${label} cannot exceed project estimate of ${max}h`);
      }
    },
  }];
}
