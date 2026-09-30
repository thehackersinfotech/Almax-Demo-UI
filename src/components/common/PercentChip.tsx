import StatusChip from "@/components/common/StatusChip";
import { fmtPct, pctTone, type PctToneMode } from "@/utils/semanticColors";

interface PercentChipProps {
  value: number;
  mode?: PctToneMode;
  decimals?: number;
  overAllocated?: boolean;
  /** Override formatted label (e.g. "Over · 105%") */
  label?: string;
  size?: "default" | "small";
  /** Fixed chip width in tables (default on). Off for custom labels. */
  uniform?: boolean;
}

/** Width fits dot + "100%" or "100.0%" with tabular digits */
function percentChipWidth(decimals: number, size: "default" | "small"): number {
  const base = size === "small" ? 68 : 76;
  return decimals > 0 ? base + 10 : base;
}

/** Semantic percentage badge — consistent across tables and dashboards */
export default function PercentChip({
  value,
  mode = "higher-better",
  decimals = 0,
  overAllocated = false,
  label,
  size = "small",
  uniform = true,
}: PercentChipProps) {
  const tone = pctTone(value, mode, overAllocated);
  const uniformWidth = uniform && !label ? percentChipWidth(decimals, size) : undefined;
  return (
    <StatusChip tone={tone} size={size} uniformWidth={uniformWidth}>
      {label ?? fmtPct(value, decimals)}
    </StatusChip>
  );
}

export { fmtPct, pctTone, type PctToneMode };
