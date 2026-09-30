/** Soft Google-inspired tones — readable red/orange without harsh solid fills */

export interface PastelTone {
  bg: string;
  text: string;
  border: string;
  accent: string;
}

export const DANGER: PastelTone = {
  bg: "#fce8e6",
  text: "#c5221f",
  border: "#f5c2c0",
  accent: "#d96560",
};

/** Profit / loss / break-even — high-contrast pastel (WCAG-friendly on white) */
export const MARGIN_PROFIT: PastelTone = {
  bg: "#e8f5e9",
  text: "#0b5723",
  border: "#6fbf73",
  accent: "#188038",
};

export const MARGIN_LOSS: PastelTone = {
  bg: "#fdecea",
  text: "#9b0f09",
  border: "#e57373",
  accent: "#c5221f",
};

export const MARGIN_NEUTRAL: PastelTone = {
  bg: "#eef0f2",
  text: "#3c4043",
  border: "#9aa0a6",
  accent: "#5f6368",
};

export function marginTone(amount: number): PastelTone {
  if (amount > 0) return MARGIN_PROFIT;
  if (amount < 0) return MARGIN_LOSS;
  return MARGIN_NEUTRAL;
}

export function marginStatusLabel(amount: number): string {
  if (amount > 0) return "Profitable";
  if (amount < 0) return "Loss";
  return "Break-even";
}

/** Project delivery health — high-contrast pastel (matches margin chips) */
export const HEALTH_ON_TRACK: PastelTone = {
  bg: "#e8f5e9",
  text: "#0b5723",
  border: "#6fbf73",
  accent: "#188038",
};

export const HEALTH_AT_RISK: PastelTone = {
  bg: "#fff8e1",
  text: "#7a4f01",
  border: "#f0c14b",
  accent: "#e37400",
};

export const HEALTH_DELAYED: PastelTone = {
  bg: "#fdecea",
  text: "#9b0f09",
  border: "#e57373",
  accent: "#c5221f",
};

export type HealthStatus = "ON_TRACK" | "AT_RISK" | "DELAYED";

export function healthTone(status: string): PastelTone {
  switch (status) {
    case "ON_TRACK":
      return HEALTH_ON_TRACK;
    case "AT_RISK":
      return HEALTH_AT_RISK;
    case "DELAYED":
      return HEALTH_DELAYED;
    default:
      return MARGIN_NEUTRAL;
  }
}

export function healthStatusLabel(status: string): string {
  switch (status) {
    case "ON_TRACK":
      return "On Track";
    case "AT_RISK":
      return "At Risk";
    case "DELAYED":
      return "Delayed";
    default:
      return status.replace(/_/g, " ");
  }
}

/** Percentage badge semantics — shared across allocation, billing, collection, completion */
export type PctToneMode = "higher-better" | "allocation" | "utilization" | "completion" | "neutral";

export function pctTone(
  value: number,
  mode: PctToneMode = "higher-better",
  overAllocated = false,
): PastelTone {
  const pct = Number(value) || 0;

  if (mode === "neutral") return MARGIN_NEUTRAL;

  if (mode === "allocation") {
    if (overAllocated || pct > 100) return HEALTH_DELAYED;
    if (pct >= 80) return HEALTH_AT_RISK;
    return HEALTH_ON_TRACK;
  }

  if (mode === "utilization") {
    if (pct > 100) return HEALTH_DELAYED;
    if (pct >= 70) return HEALTH_ON_TRACK;
    if (pct >= 40) return HEALTH_AT_RISK;
    return HEALTH_DELAYED;
  }

  if (mode === "completion") {
    if (pct >= 70) return HEALTH_ON_TRACK;
    if (pct >= 40) return HEALTH_AT_RISK;
    return HEALTH_DELAYED;
  }

  // higher-better — billing util, collection rate, etc.
  if (pct >= 80) return HEALTH_ON_TRACK;
  if (pct >= 50) return HEALTH_AT_RISK;
  return HEALTH_DELAYED;
}

export function fmtPct(value: number, decimals = 0): string {
  return `${Number(value).toFixed(decimals)}%`;
}

export const PRIORITY_TONES = {
  IMPORTANT: { bg: "#fee2e2", text: "#ef4444", border: "#fca5a5", accent: "#ef4444" },
  HIGH:      { bg: "#fee2e2", text: "#ef4444", border: "#fca5a5", accent: "#ef4444" },
  MEDIUM:    { bg: "#fef3c7", text: "#f59e0b", border: "#fde68a", accent: "#f59e0b" },
  LOW:       { bg: "#d1fae5", text: "#10b981", border: "#a7f3d0", accent: "#10b981" },
} satisfies Record<string, PastelTone>;

export function pastelTagStyle(tone: PastelTone) {
  return {
    background: tone.text,
    color: "#ffffff",
    border: "none",
  } as const;
}

export function priorityTone(value: string): PastelTone {
  const key = value.toUpperCase();
  return (PRIORITY_TONES as Record<string, PastelTone>)[key] ?? PRIORITY_TONES.MEDIUM;
}

/** Company expense workflow status — aligned high-contrast chips */
export const EXPENSE_SUBMITTED: PastelTone = {
  bg: "#e8f0fe",
  text: "#174ea6",
  border: "#aecbfa",
  accent: "#1a73e8",
};

export const EXPENSE_REIMBURSED: PastelTone = {
  bg: "#f3e8fd",
  text: "#5b21b6",
  border: "#c4b5fd",
  accent: "#7c3aed",
};

export function expenseTone(status: string): PastelTone {
  switch (status.toUpperCase()) {
    case "SUBMITTED":
      return EXPENSE_SUBMITTED;
    case "APPROVED":
      return HEALTH_ON_TRACK;
    case "REJECTED":
      return HEALTH_DELAYED;
    case "REIMBURSED":
      return EXPENSE_REIMBURSED;
    case "DRAFT":
    default:
      return MARGIN_NEUTRAL;
  }
}
