import { Progress, Typography, Row, Col } from "antd";
import type { ProjectBillingSummary } from "@/services/projects";

const { Text } = Typography;

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export default function ProjectBudgetSummary({
  summary,
  compact = false,
}: {
  summary: ProjectBillingSummary;
  compact?: boolean;
}) {
  const { budget, milestone_planned, invoiced, received, milestone_remaining, invoice_remaining } = summary;

  const rows = [
    {
      label: "Milestones planned",
      value: milestone_planned,
      remaining: milestone_remaining,
      color: "#722ed1",
      hint: "Billing schedule — cannot exceed project budget",
    },
    {
      label: "Invoiced (pre-tax)",
      value: invoiced,
      remaining: invoice_remaining,
      color: "#1677ff",
      hint: "Actual invoices — separate from milestone plan",
    },
    {
      label: "Received",
      value: received,
      remaining: Math.max(0, invoiced - received),
      color: "#52c41a",
      hint: "Cash collected against invoices",
    },
  ];

  if (compact) {
    return (
      <div style={{ marginBottom: 12, padding: "10px 12px", background: "var(--bms-surface-2)", borderRadius: 8, border: "1px solid var(--bms-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>Project budget</Text>
          <Text strong>{fmt(budget)}</Text>
        </div>
        {rows.slice(0, 2).map((r) => (
          <div key={r.label} style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <Text type="secondary">{r.label}</Text>
              <Text>{fmt(r.value)} · {fmt(r.remaining)} left</Text>
            </div>
            <Progress percent={pct(r.value, budget)} showInfo={false} size="small" strokeColor={r.color} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <Text type="secondary" style={{ fontSize: 12, flex: 1 }}>
          Budget is the contract ceiling. Milestones plan billing; invoices bill; payments collect — no double-counting.
        </Text>
        <Text strong style={{ fontSize: 18 }}>{fmt(budget)}</Text>
      </div>
      <Row gutter={[16, 12]}>
        {rows.map((r) => (
          <Col xs={24} md={8} key={r.label}>
            <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--bms-border)", background: "var(--bms-surface-2)" }}>
              <Text style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</Text>
              <div style={{ fontSize: 16, fontWeight: 700, color: r.color, margin: "4px 0" }}>{fmt(r.value)}</div>
              <Progress percent={pct(r.value, budget)} strokeColor={r.color} size="small" />
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                {fmt(r.remaining)} remaining · {r.hint}
              </Text>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
}
