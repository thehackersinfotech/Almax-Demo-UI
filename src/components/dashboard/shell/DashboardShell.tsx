import type { ReactNode } from "react";
import "../dashboard.css";

interface DashboardShellProps {
  children: ReactNode;
  className?: string;
}

export default function DashboardShell({ children, className }: DashboardShellProps) {
  return (
    <div className={`dash-root ${className ?? ""}`.trim()}>
      {children}
    </div>
  );
}
