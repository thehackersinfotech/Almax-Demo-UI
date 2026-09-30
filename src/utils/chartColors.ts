/** Dashboard chart palettes — muted indigo / emerald / amber (professional, not neon). */

export const PMO_TOTAL_COLOR = "#4f46e5";
export const PMO_BILLABLE_COLOR = "#0d9488";
export const PMO_NON_BILLABLE_COLOR = "#94a3b8";

export const TREND_LINE_COLORS = [PMO_TOTAL_COLOR, PMO_BILLABLE_COLOR];

export const PROJECT_BAR_COLORS = [
  "#4f46e5",
  "#0d9488",
  "#b45309",
  "#be185d",
  "#7c3aed",
  "#0369a1",
  "#65a30d",
  "#c026d3",
  "#0e7490",
  "#64748b",
];

export const HOURS_PIE_COLORS = [
  "#4f46e5",
  "#0d9488",
  "#b45309",
  "#be185d",
  "#7c3aed",
  "#0369a1",
  "#65a30d",
  "#c026d3",
  "#0e7490",
  "#64748b",
];

export const ALLOCATION_PIE_COLORS = [
  "#b45309",
  "#d97706",
  "#ca8a04",
  "#0d9488",
  "#4f46e5",
  "#7c3aed",
  "#be185d",
  "#0369a1",
  "#65a30d",
  "#64748b",
];

export const PROJECT_TYPE_COLORS = [
  "#4f46e5",
  "#0d9488",
  "#b45309",
  "#be185d",
  "#7c3aed",
  "#0369a1",
  "#65a30d",
  "#c026d3",
  "#0e7490",
  "#64748b",
];

export const DEPT_COLORS = [
  "#4f46e5",
  "#7c3aed",
  "#0d9488",
  "#b45309",
  "#be185d",
  "#0369a1",
  "#65a30d",
  "#c026d3",
  "#0e7490",
  "#94a3b8",
];

/** Canvas-rendered AntV charts can't resolve CSS custom properties, so axis
 * colors here must be literal hex values (matching the light theme palette). */
const AXIS_LABEL_COLOR = "#80868b";
const AXIS_LABEL_COLOR_STRONG = "#5f6368";
const AXIS_LINE_COLOR = "#dadce0";

export const PMO_LINE_CHART_THEME = {
  insetTop: 8,
  insetBottom: 4,
  axis: {
    y: {
      title: "Hours",
      gridLineDash: [4, 6] as [number, number],
      gridStroke: AXIS_LINE_COLOR,
      labelFormatter: (v: number) => `${v}h`,
      titleFill: AXIS_LABEL_COLOR,
      labelFill: AXIS_LABEL_COLOR,
      line: true,
      lineStroke: AXIS_LINE_COLOR,
    },
    x: {
      labelAutoRotate: false,
      labelAutoHide: true,
      labelFill: AXIS_LABEL_COLOR,
      line: true,
      lineStroke: AXIS_LINE_COLOR,
    },
  },
  interaction: { tooltip: { shared: true } },
};

export const AXIS_COLORS = {
  label: AXIS_LABEL_COLOR,
  labelStrong: AXIS_LABEL_COLOR_STRONG,
  line: AXIS_LINE_COLOR,
};

export function chartColorByIndex(index: number, palette = PROJECT_BAR_COLORS): string {
  return palette[index % palette.length];
}
