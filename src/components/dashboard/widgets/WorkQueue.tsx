import type { ReactNode } from "react";
import { useState } from "react";
import { Button, Tag } from "antd";
import PastelTag from "@/components/common/PastelTag";
import { MarginStatusTag } from "@/components/common/MarginTag";
import HealthStatusTag from "@/components/common/HealthStatusTag";
import type { PastelTone } from "@/utils/semanticColors";

export interface WorkQueueItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: { label: string; color?: string; tone?: PastelTone; marginAmount?: number; healthStatus?: string };
  meta?: string;
  metaColor?: string;
  onClick?: () => void;
}

interface WorkQueueProps {
  items: WorkQueueItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Show only this many rows until expanded */
  previewCount?: number;
  /** Max height when expanded (scrollable) */
  maxHeight?: number;
}

export default function WorkQueue({
  items,
  emptyTitle = "Nothing here",
  emptyDescription,
  emptyAction,
  previewCount,
  maxHeight = 420,
}: WorkQueueProps) {
  const [expanded, setExpanded] = useState(false);

  if (!items.length) {
    return (
      <div className="dash-empty">
        <p className="dash-empty__title">{emptyTitle}</p>
        {emptyDescription && <p className="dash-empty__desc">{emptyDescription}</p>}
        {emptyAction}
      </div>
    );
  }

  const canExpand = previewCount != null && items.length > previewCount;
  const visible = canExpand && !expanded ? items.slice(0, previewCount) : items;

  return (
    <div>
      <div
        className="dash-queue-scroll"
        style={expanded && items.length > (previewCount ?? 0) ? { maxHeight, overflowY: "auto" } : undefined}
        role="list"
      >
        {visible.map((item) => (
          <div
            key={item.id}
            role="listitem"
            className="dash-queue-item"
            onClick={item.onClick}
            onKeyDown={(e) => e.key === "Enter" && item.onClick?.()}
            tabIndex={item.onClick ? 0 : undefined}
          >
            <div className="dash-queue-item__main">
              <div className="dash-queue-item__title">{item.title}</div>
              {item.subtitle && (
                <div className="dash-queue-item__meta">{item.subtitle}</div>
              )}
            </div>
            <div className="dash-queue-item__aside">
              {item.badge && (
                item.badge.marginAmount != null ? (
                  <MarginStatusTag amount={item.badge.marginAmount} />
                ) : item.badge.healthStatus != null ? (
                  <HealthStatusTag status={item.badge.healthStatus} />
                ) : item.badge.tone ? (
                  <PastelTag tone={item.badge.tone} size="small">{item.badge.label}</PastelTag>
                ) : item.badge.color ? (
                  <Tag color={item.badge.color} style={{ margin: 0 }}>{item.badge.label}</Tag>
                ) : (
                  <PastelTag tone={{ bg: "#f1f3f4", text: "#5f6368", border: "#dadce0", accent: "#80868b" }} size="small">
                    {item.badge.label}
                  </PastelTag>
                )
              )}
              {item.meta && (
                <div
                  className="dash-queue-item__meta dash-queue-item__meta--emphasis"
                  style={{ marginTop: 6, color: item.metaColor ?? "var(--bms-text-2)" }}
                >
                  {item.meta}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {canExpand && (
        <div className="dash-queue-expand">
          <Button type="link" size="small" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : `Show all ${items.length}`}
          </Button>
        </div>
      )}
    </div>
  );
}
