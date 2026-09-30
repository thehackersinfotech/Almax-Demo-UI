import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";

interface PeriodControlProps {
  value: Dayjs;
  onChange: (value: Dayjs) => void;
  picker?: "month" | "week";
}

export default function PeriodControl({
  value,
  onChange,
  picker = "month",
}: PeriodControlProps) {
  return (
    <DatePicker
      picker={picker}
      value={value}
      onChange={(v) => v && onChange(v)}
      allowClear={false}
      size="middle"
    />
  );
}
