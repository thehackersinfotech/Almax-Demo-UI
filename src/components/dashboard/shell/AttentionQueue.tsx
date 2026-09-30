import {
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";

export interface AttentionItem {
  key: string;
  severity: "error" | "warning" | "info";
  title: string;
  count: number;
  detail: string;
  path?: string;
  /** Override default CTA label, e.g. "View 3 projects" */
  actionLabel?: string;
}

interface AttentionQueueProps {
  items: AttentionItem[];
  onItemClick: (item: AttentionItem) => void;
  emptyMessage?: string;
}

const SEVERITY_CLASS: Record<string, string> = {
  error: "dash-attention__chip--error",
  warning: "dash-attention__chip--warning",
  info: "dash-attention__chip--info",
};

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  error: <ExclamationCircleOutlined />,
  warning: <WarningOutlined />,
  info: <InfoCircleOutlined />,
};

function defaultActionLabel(item: AttentionItem): string {
  if (item.actionLabel) return item.actionLabel;
  if (item.path) return "Open →";
  if (item.count > 1) return `Review ${item.count} items →`;
  return "Review →";
}

export default function AttentionQueue({
  items,
  onItemClick,
  emptyMessage,
}: AttentionQueueProps) {
  if (!items.length) {
    if (!emptyMessage) return null;
    return (
      <div className="dash-attention dash-attention--empty">
        {emptyMessage}
      </div>
    );
  }

  const isSingleCritical = items.length === 1 && items[0].severity === "error";

  return (
    <div
      className={`dash-attention${isSingleCritical ? " dash-attention--single-error" : ""}`}
      role="list"
      aria-label="Items needing attention"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="listitem"
          className={`dash-attention__chip ${SEVERITY_CLASS[item.severity] ?? ""}`}
          onClick={() => onItemClick(item)}
        >
          <span className="dash-attention__chip-icon" aria-hidden>
            {SEVERITY_ICON[item.severity]}
          </span>
          <div className="dash-attention__chip-main">
            <div className="dash-attention__chip-top">
              <span className="dash-attention__chip-title">{item.title}</span>
              <span className={`dash-attention__chip-count dash-attention__chip-count--${item.severity}`}>
                {item.count}
              </span>
            </div>
            <span className="dash-attention__chip-detail">{item.detail}</span>
          </div>
          <span className={`dash-attention__chip-action dash-attention__chip-action--${item.severity}`}>
            {defaultActionLabel(item)}
          </span>
        </button>
      ))}
    </div>
  );
}
