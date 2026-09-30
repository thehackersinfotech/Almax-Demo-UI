import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";

export function useDashboardPeriod(initial?: Dayjs) {
  const [period, setPeriod] = useState<Dayjs>(initial ?? dayjs());

  return {
    period,
    setPeriod,
    year: period.year(),
    month: period.month() + 1,
    label: period.format("MMMM YYYY"),
  };
}
