import type { ReactNode } from "react";
import { Button } from "antd";

interface EmptyGuideProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  extra?: ReactNode;
}

export default function EmptyGuide({
  title,
  description,
  actionLabel,
  onAction,
  extra,
}: EmptyGuideProps) {
  return (
    <div className="dash-empty">
      <p className="dash-empty__title">{title}</p>
      <p className="dash-empty__desc">{description}</p>
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {extra}
    </div>
  );
}
