import type { ReactNode } from "react";
import { Progress } from "antd";
import { useCountUp } from "@/hooks/useCountUp";

export interface MetricAction {
  label: string;
  onClick: () => void;
}

export type MetricAccent = "default" | "neutral" | "success" | "warning" | "danger" | "primary" | "purple" | "info";

interface ActionMetricProps {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: MetricAccent;
  icon?: ReactNode;
  progress?: number;
  progressLabel?: string;
  /** Mini trend line (right side) — pass 2+ numeric points. */
  trend?: number[];
  actions?: MetricAction[];
  countTo?: number;
  formatCount?: (n: number) => string;
  animateDelay?: number;
  onClick?: () => void;
}

const ACCENT_COLOR: Record<MetricAccent, string> = {
  default: "var(--bms-text-2)",
  neutral: "var(--bms-primary)",
  success: "#059669",
  warning: "#f59e0b",
  danger: "#dc2626",
  primary: "#2563eb",
  purple: "#7c3aed",
  info: "#06b6d4",
};

function MetricSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 84;
  const h = 42;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;

  return (
    <svg className="dash-metric__sparkline" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={areaPath} fill={color} fillOpacity={0.14} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricInner({
  label,
  displayValue,
  sub,
  icon,
  progress,
  progressLabel,
  actions,
  color,
  animateDelay,
  trend,
}: {
  label: string;
  displayValue: ReactNode;
  sub?: string;
  icon?: ReactNode;
  progress?: number;
  progressLabel?: string;
  actions: MetricAction[];
  color: string;
  animateDelay: number;
  trend?: number[];
}) {
  const animatedProgress = useCountUp(progress ?? 0, { enabled: progress !== undefined, duration: 1100 });
  const hasFooter = progress !== undefined || actions.length > 0;

  return (
    <>
      <div className="dash-metric__body">
        <div className="dash-metric__main">
          {icon && (
            <div
              className="dash-metric__icon exec-metric-icon-pop"
              style={{ animationDelay: `${animateDelay + 80}ms` }}
            >
              {icon}
            </div>
          )}
          <div className="dash-metric__content">
            <span className="dash-metric__label">{label}</span>
            <span className="dash-metric__value">{displayValue}</span>
            {sub && <span className="dash-metric__sub">{sub}</span>}
          </div>
        </div>
        {trend && trend.length >= 2 && (
          <MetricSparkline values={trend} color={color} />
        )}
      </div>

      <div className={`dash-metric__footer${hasFooter ? " dash-metric__footer--filled" : ""}`}>
        {progress !== undefined && (
          <div className="dash-metric__progress-wrap">
            {progressLabel && <span className="dash-metric__progress-label">{progressLabel}</span>}
            <Progress
              percent={animatedProgress}
              strokeColor={color}
              showInfo={false}
              size="small"
              className="dash-metric__progress"
            />
          </div>
        )}
        {actions.length > 0 && (
          <div className="dash-metric__actions">
            {actions.map((a, i) => (
              <span key={a.label} className="dash-metric__action-wrap">
                {i > 0 && <span className="dash-metric__action-sep" aria-hidden>·</span>}
                <button
                  type="button"
                  className="dash-metric__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    a.onClick();
                  }}
                >
                  {a.label} →
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function ActionMetric({
  label,
  value,
  sub,
  accent = "default",
  icon,
  progress,
  progressLabel,
  trend,
  actions = [],
  countTo,
  formatCount,
  animateDelay = 0,
  onClick,
}: ActionMetricProps) {
  const color = ACCENT_COLOR[accent];
  const animatedCount = useCountUp(countTo ?? 0, { enabled: countTo !== undefined, duration: 1000 });
  const displayValue = countTo !== undefined
    ? (formatCount ? formatCount(animatedCount) : String(animatedCount))
    : value;

  const className = `dash-metric exec-metric-reveal${onClick ? " dash-metric--clickable" : ""}`;
  const style = { animationDelay: `${animateDelay}ms` } as const;

  const inner = (
    <MetricInner
      label={label}
      displayValue={displayValue}
      sub={sub}
      icon={icon}
      progress={progress}
      progressLabel={progressLabel}
      actions={actions}
      color={color}
      animateDelay={animateDelay}
      trend={trend}
    />
  );

  if (onClick) {
    return (
      <button type="button" className={className} data-accent={accent} style={style} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return (
    <div className={className} data-accent={accent} style={style}>
      {inner}
    </div>
  );
}
