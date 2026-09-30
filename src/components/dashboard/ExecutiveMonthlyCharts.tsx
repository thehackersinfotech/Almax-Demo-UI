import { useMemo } from "react";
import { Column } from "@ant-design/charts";
import { Typography } from "antd";
import TrendPanel from "@/components/dashboard/widgets/TrendPanel";

const { Text } = Typography;

function fmtCurrency(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtAxisCurrency(n: number) {
  const abs = Math.abs(Number(n));
  if (abs >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return `₹${Math.round(n)}`;
}

function fmtHours(n: number) {
  return `${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}h`;
}

function ChartKpiStrip({ items }: { items: Array<{ label: string; value: string; dot: string }> }) {
  return (
    <div className="exec-chart-kpis">
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

const PAYMENT_COLORS = ["#6366f1", "#059669"];
const BILLING_COLORS = ["#2563eb", "#94a3b8"];

const columnTheme = {
  columnWidthRatio: 0.52,
  style: { radiusTopLeft: 5, radiusTopRight: 5 },
  interaction: { elementHighlight: true },
  legend: { position: "top-right" as const, marker: { symbol: "square" as const } },
};

interface PaymentMonth {
  label: string;
  invoiced: number;
  received: number;
}

interface BillingMonth {
  label: string;
  billable_hours: number;
  non_billable_hours: number;
}

export function PaymentMonthlyChart({ months }: { months: PaymentMonth[] }) {
  const chartData = useMemo(
    () => months.flatMap((m) => [
      { month: m.label, type: "Invoiced", amount: m.invoiced },
      { month: m.label, type: "Received", amount: m.received },
    ]),
    [months],
  );

  const kpis = useMemo(() => {
    const invoiced = months.reduce((s, m) => s + m.invoiced, 0);
    const received = months.reduce((s, m) => s + m.received, 0);
    const pct = invoiced > 0 ? Math.round((received / invoiced) * 100) : 0;
    return { invoiced, received, pct };
  }, [months]);

  if (!chartData.length) {
    return <Text type="secondary">No payment data for this FY</Text>;
  }

  return (
    <TrendPanel>
      <ChartKpiStrip
        items={[
          { label: "FY invoiced", value: fmtCurrency(kpis.invoiced), dot: PAYMENT_COLORS[0] },
          { label: "FY received", value: fmtCurrency(kpis.received), dot: PAYMENT_COLORS[1] },
          { label: "Collection", value: `${kpis.pct}%`, dot: kpis.pct >= 80 ? "#059669" : "#f59e0b" },
        ]}
      />
      <Column
        data={chartData}
        xField="month"
        yField="amount"
        seriesField="type"
        isGroup
        height={210}
        color={PAYMENT_COLORS}
        {...columnTheme}
        axis={{
          y: {
            labelFormatter: fmtAxisCurrency,
            gridLineDash: [4, 4],
          },
          x: { labelAutoRotate: false },
        }}
        tooltip={{
          title: (d: { month: string }) => d.month,
          items: [(item: { type: string; amount: number }) => ({
            name: item.type,
            value: fmtCurrency(item.amount),
          })],
        }}
        label={{
          text: (d: { amount: number }) => (d.amount > 0 ? fmtAxisCurrency(d.amount) : ""),
          position: "top" as const,
          style: { fontSize: 10, fill: "#5f6368", fontWeight: 500 },
        }}
      />
    </TrendPanel>
  );
}

export function BillingMonthlyChart({ months }: { months: BillingMonth[] }) {
  const chartData = useMemo(
    () => months.flatMap((m) => [
      { month: m.label, type: "Billable", hours: m.billable_hours },
      { month: m.label, type: "Non-billable", hours: m.non_billable_hours },
    ]),
    [months],
  );

  const kpis = useMemo(() => {
    const billable = months.reduce((s, m) => s + m.billable_hours, 0);
    const nonBillable = months.reduce((s, m) => s + m.non_billable_hours, 0);
    const total = billable + nonBillable;
    const util = total > 0 ? Math.round((billable / total) * 100) : 0;
    return { billable, nonBillable, util };
  }, [months]);

  if (!chartData.length) {
    return <Text type="secondary">No timesheet hours for this FY</Text>;
  }

  return (
    <TrendPanel>
      <ChartKpiStrip
        items={[
          { label: "FY billable", value: fmtHours(kpis.billable), dot: BILLING_COLORS[0] },
          { label: "FY non-billable", value: fmtHours(kpis.nonBillable), dot: BILLING_COLORS[1] },
          { label: "Billable rate", value: `${kpis.util}%`, dot: kpis.util >= 70 ? "#059669" : "#f59e0b" },
        ]}
      />
      <Column
        data={chartData}
        xField="month"
        yField="hours"
        seriesField="type"
        isGroup
        height={210}
        color={BILLING_COLORS}
        {...columnTheme}
        axis={{
          y: {
            labelFormatter: (v: number) => `${v}h`,
            gridLineDash: [4, 4],
          },
          x: { labelAutoRotate: false },
        }}
        tooltip={{
          title: (d: { month: string }) => d.month,
          items: [(item: { type: string; hours: number }) => ({
            name: item.type,
            value: fmtHours(item.hours),
          })],
        }}
        label={{
          text: (d: { hours: number }) => (d.hours > 0 ? `${Math.round(d.hours)}h` : ""),
          position: "top" as const,
          style: { fontSize: 10, fill: "#5f6368", fontWeight: 500 },
        }}
      />
    </TrendPanel>
  );
}
