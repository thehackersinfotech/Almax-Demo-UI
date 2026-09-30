import type { ReactNode } from "react";

export interface QuickAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  primary?: boolean;
}

interface QuickActionBarProps {
  actions: QuickAction[];
}

export default function QuickActionBar({ actions }: QuickActionBarProps) {
  if (!actions.length) return null;

  return (
    <div className="dash-quick-actions">
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          className={`dash-quick-btn${a.primary ? " dash-quick-btn--primary" : ""}`}
          onClick={a.onClick}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}
