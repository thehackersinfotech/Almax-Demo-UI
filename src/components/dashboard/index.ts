export { default as DashboardShell } from "./shell/DashboardShell";
export { default as DashboardHeader } from "./shell/DashboardHeader";
export { default as DashboardGrid } from "./shell/DashboardGrid";
export { default as DashboardPanel } from "./shell/DashboardPanel";
export { default as AttentionQueue } from "./shell/AttentionQueue";
export type { AttentionItem } from "./shell/AttentionQueue";
export { default as PeriodControl } from "./shell/PeriodControl";
export { default as QuickActionBar } from "./shell/QuickActionBar";
export type { QuickAction } from "./shell/QuickActionBar";

export { default as ActionMetric } from "./widgets/ActionMetric";
export type { MetricAction, MetricAccent } from "./widgets/ActionMetric";
export { default as HealthRing } from "./widgets/HealthRing";
export { default as WorkQueue } from "./widgets/WorkQueue";
export type { WorkQueueItem } from "./widgets/WorkQueue";
export { default as EmptyGuide } from "./widgets/EmptyGuide";
export { default as TrendPanel } from "./widgets/TrendPanel";
export { default as WorkPipelinePanel } from "./widgets/WorkPipelinePanel";
export type { WorkPipelineItems } from "./widgets/WorkPipelinePanel";
export { default as AnimatedNumber } from "./widgets/AnimatedNumber";
export { default as WidgetSkeleton, DashboardPageSkeleton } from "./widgets/WidgetSkeleton";

export { default as DashboardAlertModal } from "./modals/DashboardAlertModal";

export { useDashboardPeriod } from "./hooks/useDashboardPeriod";
export { usePMOQuickActions } from "./hooks/usePMOQuickActions";
