import type { TicketType, TicketPriority } from "@/services/tickets";
import { TICKET_TYPE_LABELS } from "@/services/tickets";

// ── Priority SVG icons — matching Linear/Jira style ──────────────────────────

const PriorityIcons: Record<TicketPriority, React.ReactNode> = {
  // Red filled circle with horizontal bar (blocked / no-entry feel)
  IMMEDIATE: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#ef4444" />
      <rect x="4" y="7" width="8" height="2" rx="1" fill="white" />
    </svg>
  ),
  // Red upward chevron (roof / flag shape)
  CRITICAL: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L14 12H2L8 2Z" fill="#ef4444" />
      <rect x="7" y="8" width="2" height="3" rx="0.5" fill="white" />
      <rect x="7" y="12.5" width="2" height="1.5" rx="0.5" fill="white" />
    </svg>
  ),
  // Orange upward chevron outline
  HIGH: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 12L8 4L13 12" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  // Orange lollipop / umbrella — circle on a stick
  MEDIUM: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 10 Q4 4 8 4 Q12 4 12 10" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" fill="none" />
      <line x1="8" y1="10" x2="8" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  // Grey empty circle (deferred / later)
  DEFERRED: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#9ca3af" strokeWidth="1.8" fill="none" />
    </svg>
  ),
};

const PriorityColors: Record<TicketPriority, string> = {
  IMMEDIATE: "#ef4444",
  CRITICAL:  "#ef4444",
  HIGH:      "#f97316",
  MEDIUM:    "#f59e0b",
  DEFERRED:  "#9ca3af",
};

const PriorityLabels: Record<TicketPriority, string> = {
  IMMEDIATE: "Immediate",
  CRITICAL:  "Critical",
  HIGH:      "High",
  MEDIUM:    "Medium",
  DEFERRED:  "Deferred",
};

export function PriorityIcon({ priority, size = 14 }: { priority: TicketPriority; size?: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, flexShrink: 0,
    }}>
      {PriorityIcons[priority]}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: TicketPriority }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <PriorityIcon priority={priority} />
      <span style={{ fontSize: 13 }}>
        {PriorityLabels[priority]}
      </span>
    </span>
  );
}

export const PRIORITY_SELECT_OPTIONS: { value: TicketPriority; label: React.ReactNode }[] = [
  { value: "IMMEDIATE", label: <PriorityLabel priority="IMMEDIATE" /> },
  { value: "CRITICAL",  label: <PriorityLabel priority="CRITICAL"  /> },
  { value: "HIGH",      label: <PriorityLabel priority="HIGH"      /> },
  { value: "MEDIUM",    label: <PriorityLabel priority="MEDIUM"    /> },
  { value: "DEFERRED",  label: <PriorityLabel priority="DEFERRED"  /> },
];

// ── Type SVG icons ─────────────────────────────────────────────────────────────

const TYPE_META: Record<TicketType, { color: string; icon: React.ReactNode }> = {
  EPIC: {
    color: "#7c3aed",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M8 1L10.5 6.5H15L11 9.5L12.5 15L8 12L3.5 15L5 9.5L1 6.5H5.5L8 1Z" fill="#7c3aed" />
      </svg>
    ),
  },
  STORY: {
    color: "#059669",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" fill="#059669" />
        <path d="M5 6h6M5 8.5h4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  TASK: {
    color: "#2563eb",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" fill="#2563eb" />
        <path d="M5 8l2.5 2.5L11 5.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  SUBTASK: {
    color: "#0891b2",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="#0891b2" strokeWidth="1.5" fill="none" />
        <path d="M5 8l2.5 2.5L11 5.5" stroke="#0891b2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  BUG: {
    color: "#dc2626",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="9" r="4.5" fill="#dc2626" />
        <path d="M6.5 4.5C6.5 3.7 7.2 3 8 3S9.5 3.7 9.5 4.5" stroke="#dc2626" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M8 7v2.5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.7" fill="#fff" />
        <path d="M3 7.5h2.5M10.5 7.5H13M3 11h2.5M10.5 11H13" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  CHANGE_REQUEST: {
    color: "#d97706",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M13 8A5 5 0 003 8" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M3 8A5 5 0 0013 8" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="none" strokeDasharray="2.5 2.5" />
        <path d="M11 5.2L13 8l-2.2 1.4" stroke="#d97706" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  DEPLOYMENT: {
    color: "#4f46e5",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M8 2C5.5 2 3.5 4.5 3.5 7c0 1.2.5 2.2 1.2 3L8 14l3.3-4c.7-.8 1.2-1.8 1.2-3C12.5 4.5 10.5 2 8 2z" fill="#4f46e5" />
        <circle cx="8" cy="7" r="1.8" fill="#fff" />
      </svg>
    ),
  },
  DOCUMENT: {
    color: "#6b7280",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="1.5" width="10" height="13" rx="1.5" fill="#6b7280" />
        <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  MILESTONE: {
    color: "#b45309",
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14 8L8 14L2 8L8 2Z" fill="#b45309" />
        <circle cx="8" cy="8" r="2" fill="#fff" />
      </svg>
    ),
  },
};

export function TypeIcon({ type, size = 16 }: { type: TicketType; size?: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, flexShrink: 0,
    }}>
      {TYPE_META[type].icon}
    </span>
  );
}

export function TypeLabel({ type }: { type: TicketType }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <TypeIcon type={type} />
      <span style={{ fontWeight: 500, fontSize: 13 }}>{TICKET_TYPE_LABELS[type]}</span>
    </span>
  );
}

const ALL_TYPES: TicketType[] = [
  "EPIC", "STORY", "TASK", "SUBTASK", "BUG",
  "CHANGE_REQUEST", "DEPLOYMENT", "DOCUMENT", "MILESTONE",
];

export const TYPE_SELECT_OPTIONS = ALL_TYPES.map((t) => ({
  value: t,
  label: <TypeLabel type={t} />,
}));
