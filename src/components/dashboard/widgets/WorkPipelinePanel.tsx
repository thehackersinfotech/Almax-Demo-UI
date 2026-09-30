import { Button, Progress } from "antd";
import { useCountUp } from "@/hooks/useCountUp";

export interface WorkPipelineItems {
  open: number;
  in_progress: number;
  done: number;
  overdue: number;
  total: number;
}

interface PipelineRowProps {
  label: string;
  value: number;
  total: number;
  color: string;
  delay: number;
}

function PipelineRow({ label, value, total, color, delay }: PipelineRowProps) {
  const animatedValue = useCountUp(value, { duration: 900 });
  const pct = total ? Math.round((value / total) * 100) : 0;
  const animatedPct = useCountUp(pct, { duration: 1100 });

  return (
    <div
      className="exec-funnel-kpis__item--reveal"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
        <span>{label}</span>
        <strong style={{ color }}>{animatedValue}</strong>
      </div>
      <Progress
        percent={animatedPct}
        showInfo={false}
        strokeColor={color}
        size="small"
      />
    </div>
  );
}

interface WorkPipelinePanelProps {
  items: WorkPipelineItems;
  onOverdueClick?: () => void;
}

export default function WorkPipelinePanel({ items, onOverdueClick }: WorkPipelinePanelProps) {
  const rows = [
    { label: "Open", value: items.open, color: "var(--bms-text-3)", delay: 0 },
    { label: "In progress", value: items.in_progress, color: "var(--bms-primary)", delay: 80 },
    { label: "Done", value: items.done, color: "var(--bms-success)", delay: 160 },
    { label: "Overdue", value: items.overdue, color: "var(--bms-danger)", delay: 240 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "center" }}>
      {rows.map((row) => (
        <PipelineRow
          key={row.label}
          label={row.label}
          value={row.value}
          total={items.total}
          color={row.color}
          delay={row.delay}
        />
      ))}
      {items.overdue > 0 && onOverdueClick && (
        <Button
          size="small"
          type="link"
          className="exec-funnel-kpis__item--reveal"
          style={{ padding: 0, alignSelf: "flex-start", animationDelay: "320ms" }}
          onClick={onOverdueClick}
        >
          Triage overdue tickets →
        </Button>
      )}
    </div>
  );
}
