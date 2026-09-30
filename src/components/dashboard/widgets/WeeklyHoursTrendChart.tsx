import { useMemo } from "react";
import { Line } from "@ant-design/charts";
import { Typography } from "antd";
import {
  PMO_TOTAL_COLOR,
  PMO_BILLABLE_COLOR,
  PMO_LINE_CHART_THEME,
  TREND_LINE_COLORS,
} from "@/utils/chartColors";

const { Text } = Typography;

const SERIES = { total: "Total", billable: "Billable" } as const;

export interface WeeklyTrendWeek {
  label: string;
  total_hours: number;
  billable_hours: number;
}

function ChartKpiStrip({ items }: { items: Array<{ label: string; value: string; dot: string }> }) {
  return (
    <div className="exec-chart-kpis pmo-trend-chart__kpis">
      {items.map(({ label, value, dot }) => (
        <div key={label} className="exec-chart-kpis__item">
          <span className="exec-chart-kpis__dot" style={{ background: dot }} />
          <div>
            <div className="exec-chart-kpis__label">{label}</div>
            <div className="exec-chart-kpis__value">{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="pmo-trend-chart__legend">
      {items.map(({ label, color }) => (
        <span key={label} className="pmo-trend-chart__legend-item">
          <span className="pmo-trend-chart__legend-line" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function WeeklyHoursTrendChart({
  weeks,
  utilizationPct,
}: {
  weeks: WeeklyTrendWeek[];
  utilizationPct: number;
}) {
  const chartData = useMemo(
    () => weeks.flatMap((w) => [
      { week: w.label, type: SERIES.total, hours: w.total_hours },
      { week: w.label, type: SERIES.billable, hours: w.billable_hours },
    ]),
    [weeks],
  );

  const kpis = useMemo(() => {
    const total = weeks.reduce((s, w) => s + w.total_hours, 0);
    const billable = weeks.reduce((s, w) => s + w.billable_hours, 0);
    const rate = total > 0 ? Math.round((billable / total) * 100) : 0;
    return { total, billable, rate };
  }, [weeks]);

  return (
    <div className="pmo-trend-chart">
      <ChartKpiStrip
        items={[
          { label: "8-wk total", value: `${kpis.total.toFixed(0)}h`, dot: PMO_TOTAL_COLOR },
          { label: "Billable", value: `${kpis.billable.toFixed(0)}h`, dot: PMO_BILLABLE_COLOR },
          { label: "Billable rate", value: `${kpis.rate}%`, dot: kpis.rate >= 70 ? "#059669" : "#d97706" },
        ]}
      />
      <ChartLegend
        items={[
          { label: "Total hours", color: PMO_TOTAL_COLOR },
          { label: "Billable hours", color: PMO_BILLABLE_COLOR },
        ]}
      />
      <div className="pmo-trend-chart__plot">
        <Line
          data={chartData}
          xField="week"
          yField="hours"
          colorField="type"
          shapeField="smooth"
          height={200}
          color={TREND_LINE_COLORS}
          scale={{
            color: {
              domain: [SERIES.total, SERIES.billable],
              range: TREND_LINE_COLORS,
            },
          }}
          area={{
            style: {
              fillOpacity: (d: { type: string }) => (d.type === SERIES.total ? 0.1 : 0.06),
            },
          }}
          style={{
            lineWidth: (d: { type: string }) => (d.type === SERIES.total ? 2.5 : 2),
            stroke: (d: { type: string }) =>
              d.type === SERIES.total ? PMO_TOTAL_COLOR : PMO_BILLABLE_COLOR,
          }}
          point={{
            size: 3.5,
            shape: "circle",
            style: {
              fill: (d: { type: string }) =>
                d.type === SERIES.total ? PMO_TOTAL_COLOR : PMO_BILLABLE_COLOR,
              stroke: "#ffffff",
              lineWidth: 2,
            },
          }}
          legend={false}
          {...PMO_LINE_CHART_THEME}
          tooltip={{
            title: (d: { week: string }) => d.week,
            items: [(item: { type: string; hours: number }) => ({
              name: item.type,
              value: `${Number(item.hours).toFixed(1)}h`,
            })],
          }}
        />
      </div>
      <div className="pmo-trend-chart__footer">
        <Text type="secondary" style={{ fontSize: 12 }}>Team avg utilization</Text>
        <Text strong style={{ fontSize: 13, color: utilizationPct >= 70 ? "#059669" : "var(--bms-text)" }}>
          {utilizationPct}%
        </Text>
      </div>
    </div>
  );
}
