import dayjs, { type Dayjs } from "dayjs";

/** Start of calendar week (Sunday) for the given date. */
export function sundayOf(d: Dayjs = dayjs()) {
  return d.subtract(d.day(), "day").startOf("day");
}
