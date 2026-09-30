import { Typography } from "antd";
import type { ExecutiveProjectPipeline } from "@/services/dashboard";
import PercentChip from "@/components/common/PercentChip";
import AnimatedNumber from "@/components/dashboard/widgets/AnimatedNumber";

const { Text } = Typography;

interface Props {
  pipeline: ExecutiveProjectPipeline;
  animate?: boolean;
}

const STAGE_SHORT: Record<string, string> = {
  pipeline: "Enquiry",
  active: "In business",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function ExecutivePipelinePanel({ pipeline, animate = true }: Props) {
  const segments = pipeline.breakdown.filter((b) => b.count > 0);

  return (
    <div className={`exec-funnel${animate ? " exec-funnel--animate" : ""}`}>
      <div className="exec-funnel-bar" aria-label="Project pipeline distribution">
        {segments.length > 0 ? (
          segments.map((b, idx) => (
            <div
              key={b.key}
              className="exec-funnel-bar__seg exec-funnel-bar__seg--grow"
              style={{
                flex: b.count,
                background: b.color,
                animationDelay: animate ? `${idx * 90}ms` : undefined,
              }}
              title={`${b.label}: ${b.count} (${b.pct}%)`}
            >
              {b.pct >= 10 && <span>{b.pct}%</span>}
            </div>
          ))
        ) : (
          <div className="exec-funnel-bar__seg exec-funnel-bar__seg--empty" />
        )}
      </div>

      <div className="exec-funnel-stages">
        {pipeline.breakdown.map((b, idx) => (
          <div
            key={b.key}
            className={`exec-funnel-stage exec-funnel-stage--reveal${b.count === 0 ? " exec-funnel-stage--empty" : ""}`}
            style={{ animationDelay: animate ? `${120 + idx * 80}ms` : undefined }}
          >
            {idx > 0 && <div className="exec-funnel-stage__arrow" aria-hidden />}
            <div className="exec-funnel-stage__icon exec-funnel-stage__icon--pop" style={{ background: `${b.color}20`, color: b.color }}>
              {animate ? (
                <AnimatedNumber value={b.count} duration={800 + idx * 100} />
              ) : (
                b.count
              )}
            </div>
            <div className="exec-funnel-stage__label">{STAGE_SHORT[b.key] ?? b.label}</div>
            <Text type="secondary" className="exec-funnel-stage__pct">{b.pct}% of portfolio</Text>
          </div>
        ))}
      </div>

      <div className="exec-funnel-kpis">
        <div className="exec-funnel-kpis__item exec-funnel-kpis__item--reveal" style={{ animationDelay: animate ? "400ms" : undefined }}>
          <Text type="secondary">Enquiry → business</Text>
          <PercentChip value={pipeline.conversion_pct} mode="higher-better" />
        </div>
        <div className="exec-funnel-kpis__item exec-funnel-kpis__item--reveal" style={{ animationDelay: animate ? "480ms" : undefined }}>
          <Text type="secondary">Completed</Text>
          <PercentChip value={pipeline.completion_pct} mode="completion" />
        </div>
        <div className="exec-funnel-kpis__item exec-funnel-kpis__item--reveal" style={{ animationDelay: animate ? "560ms" : undefined }}>
          <Text type="secondary">Win vs cancelled</Text>
          <PercentChip value={pipeline.win_pct} mode="higher-better" />
        </div>
        <div className="exec-funnel-kpis__item exec-funnel-kpis__item--reveal" style={{ animationDelay: animate ? "640ms" : undefined }}>
          <Text type="secondary">New this FY</Text>
          <strong style={{ color: "var(--bms-primary)" }}>
            {animate ? <AnimatedNumber value={pipeline.fy_new} duration={900} /> : pipeline.fy_new}
          </strong>
        </div>
      </div>
    </div>
  );
}
