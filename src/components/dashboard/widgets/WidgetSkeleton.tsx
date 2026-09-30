interface WidgetSkeletonProps {
  height?: number;
}

export default function WidgetSkeleton({ height = 120 }: WidgetSkeletonProps) {
  return <div className="dash-skeleton-block" style={{ height, width: "100%" }} />;
}

export function DashboardPageSkeleton() {
  return (
    <div className="dash-root">
      <div className="dash-skeleton-block" style={{ height: 56, marginBottom: 16 }} />
      <div className="dash-skeleton-block" style={{ height: 72, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="dash-skeleton-block" style={{ height: 100 }} />
        ))}
      </div>
      <div className="dash-skeleton-block" style={{ height: 320 }} />
    </div>
  );
}
