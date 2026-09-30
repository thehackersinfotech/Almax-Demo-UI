import { useCountUp } from "@/hooks/useCountUp";

export interface HealthSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface HealthRingProps {
  segments: HealthSegment[];
  centerLabel?: string;
  centerValue?: string | number;
  centerCountTo?: number;
  centerSuffix?: string;
  size?: number;
  showLegend?: boolean;
  formatValue?: (value: number, segment: HealthSegment) => string | number;
  animate?: boolean;
}

function DonutChart({
  segments,
  size,
  animate = false,
}: {
  segments: HealthSegment[];
  size: number;
  animate?: boolean;
}) {
  const strokeWidth = Math.max(12, Math.round(size * 0.1));
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);

  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--bms-border, #eef2f6)"
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  let cumulative = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className={animate ? "exec-health-ring__svg" : undefined}
    >
      {segments.map((seg, idx) => {
        if (seg.value <= 0) return null;
        const dash = (seg.value / total) * circumference;
        const offset = (cumulative / total) * circumference;
        cumulative += seg.value;
        return (
          <circle
            key={seg.key}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className={animate ? "exec-health-ring__arc" : undefined}
            style={animate ? { animationDelay: `${idx * 120}ms` } : undefined}
          />
        );
      })}
    </svg>
  );
}

export default function HealthRing({
  segments,
  centerLabel = "Active",
  centerValue,
  centerCountTo,
  centerSuffix = "",
  size = 140,
  showLegend = true,
  formatValue,
  animate = false,
}: HealthRingProps) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const animatedCenter = useCountUp(centerCountTo ?? 0, { enabled: animate && centerCountTo !== undefined, duration: 1200 });
  const displayCenter = centerCountTo !== undefined && animate
    ? `${animatedCenter}${centerSuffix}`
    : (centerValue ?? total);
  const fmtVal = formatValue ?? ((v: number) => v);

  return (
    <div className={animate ? "exec-health-ring" : undefined} style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
        <DonutChart segments={segments} size={size} animate={animate} />
        <div
          className={animate ? "exec-health-ring__center" : undefined}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{centerLabel}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--bms-text)", lineHeight: 1.2 }}>
            {displayCenter}
          </div>
        </div>
      </div>
      {showLegend && (
        <div className="dash-health-legend">
          {segments.map((s) => (
            <div key={s.key} className="dash-health-legend__row">
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                {s.label}
              </span>
              <strong style={{ color: s.color }}>{fmtVal(s.value, s)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
