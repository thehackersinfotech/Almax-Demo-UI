import type { ReactNode } from "react";

interface TrendPanelProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function TrendPanel({ children, footer }: TrendPanelProps) {
  return (
    <div>
      {children}
      {footer && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--bms-border)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}
