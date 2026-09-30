import type { ReactNode } from "react";

interface DashboardPanelProps {
  title: string;
  meta?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}

export default function DashboardPanel({
  title,
  meta,
  extra,
  children,
  flush,
  className,
}: DashboardPanelProps) {
  return (
    <section className={`dash-panel${className ? ` ${className}` : ""}`}>
      <div className="dash-panel__head">
        <div>
          <h2 className="dash-panel__title">{title}</h2>
          {meta && <div className="dash-panel__meta">{meta}</div>}
        </div>
        {extra}
      </div>
      <div className={`dash-panel__body${flush ? " dash-panel__body--flush" : ""}`}>
        {children}
      </div>
    </section>
  );
}
