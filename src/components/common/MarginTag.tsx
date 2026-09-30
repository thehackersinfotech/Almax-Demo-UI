import StatusChip from "@/components/common/StatusChip";
import { marginTone, marginStatusLabel } from "@/utils/semanticColors";

function fmtAmount(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface MarginTagProps {
  amount: number;
  pct?: number | null;
  size?: "default" | "small";
}

/** Margin amount chip for tables */
export default function MarginTag({ amount, pct, size = "default" }: MarginTagProps) {
  const tone = marginTone(amount);
  return (
    <StatusChip tone={tone} size={size}>
      {fmtAmount(amount)}
      {pct != null && ` (${pct}%)`}
    </StatusChip>
  );
}

/** Status label chip — Profitable / Loss / Break-even */
export function MarginStatusTag({ amount, size = "small" }: { amount: number; size?: "default" | "small" }) {
  return (
    <StatusChip tone={marginTone(amount)} size={size}>
      {marginStatusLabel(amount)}
    </StatusChip>
  );
}

export function marginMetaColor(amount: number): string {
  return marginTone(amount).text;
}

export { marginStatusLabel } from "@/utils/semanticColors";
export { marginTone };
