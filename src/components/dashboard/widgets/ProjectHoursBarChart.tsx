import { Bar } from "@ant-design/charts";
import { AXIS_COLORS, PROJECT_BAR_COLORS } from "@/utils/chartColors";

export interface ProjectHoursRow {
  code: string;
  hours: number;
}

export default function ProjectHoursBarChart({ rows }: { rows: ProjectHoursRow[] }) {
  return (
    <div className="pmo-bar-chart">
      <Bar
        data={rows}
        xField="code"
        yField="hours"
        colorField="code"
        legend={false}
        height={Math.max(180, rows.length * 46)}
        scale={{ color: { range: PROJECT_BAR_COLORS } }}
        style={{
          maxWidth: 22,
          radiusTopRight: 8,
          radiusBottomRight: 8,
        }}
        label={{
          text: "hours",
          position: "right",
          style: { fontSize: 11, fill: AXIS_COLORS.labelStrong, fontWeight: 600 },
        }}
        axis={{
          x: {
            title: "Hours",
            gridLineDash: [4, 6],
            gridStroke: AXIS_COLORS.line,
            labelFill: AXIS_COLORS.label,
            titleFill: AXIS_COLORS.label,
            line: true,
            lineStroke: AXIS_COLORS.line,
          },
          y: {
            labelFill: AXIS_COLORS.labelStrong,
            line: true,
            lineStroke: AXIS_COLORS.line,
          },
        }}
        interaction={{ elementHighlight: true }}
        tooltip={{
          title: (d: { code: string }) => d.code,
          items: [(item: { hours: number }) => ({
            name: "Hours",
            value: `${Number(item.hours).toFixed(1)}h`,
          })],
        }}
      />
    </div>
  );
}
