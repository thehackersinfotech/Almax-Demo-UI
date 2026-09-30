import StatusChip from "@/components/common/StatusChip";
import { healthTone, healthStatusLabel } from "@/utils/semanticColors";

interface HealthStatusTagProps {
  status: string;
  size?: "default" | "small";
}

/** Delivery health chip — On Track / At Risk / Delayed */
export default function HealthStatusTag({ status, size = "small" }: HealthStatusTagProps) {
  return (
    <StatusChip tone={healthTone(status)} size={size}>
      {healthStatusLabel(status)}
    </StatusChip>
  );
}

export function healthMetaColor(status: string): string {
  return healthTone(status).text;
}

export { healthStatusLabel, healthTone } from "@/utils/semanticColors";
