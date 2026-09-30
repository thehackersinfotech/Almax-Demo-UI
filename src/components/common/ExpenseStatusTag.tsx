import StatusChip from "@/components/common/StatusChip";
import { expenseTone } from "@/utils/semanticColors";

interface ExpenseStatusTagProps {
  status: string;
  label?: string;
}

/** Expense status chip — uniform width for table column alignment */
export default function ExpenseStatusTag({ status, label }: ExpenseStatusTagProps) {
  const text = label ?? status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      style={{
        display: "inline-flex",
        minWidth: 108,
        justifyContent: "center",
      }}
    >
      <StatusChip tone={expenseTone(status)} size="small">
        {text}
      </StatusChip>
    </span>
  );
}

export { expenseTone } from "@/utils/semanticColors";
