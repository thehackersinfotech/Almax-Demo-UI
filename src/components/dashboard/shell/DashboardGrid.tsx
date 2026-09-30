import type { ReactNode } from "react";

interface DashboardGridProps {
  primary: ReactNode;
  secondary: ReactNode;
}

export default function DashboardGrid({ primary, secondary }: DashboardGridProps) {
  return (
    <div className="dash-grid dash-grid--primary">
      <div className="dash-stack">{primary}</div>
      <div className="dash-stack">{secondary}</div>
    </div>
  );
}
