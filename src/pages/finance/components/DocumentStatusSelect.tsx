import { Select } from "antd";
import { DownOutlined, CheckOutlined } from "@ant-design/icons";
import {
  type DocumentStatus,
  STATUS_STYLE,
  formatDocumentStatusLabel,
} from "@/services/finance";
import "./financeStatus.css";

export function DocumentStatusPill({
  status,
  displayLabel,
  compact,
}: {
  status: DocumentStatus;
  displayLabel?: string;
  compact?: boolean;
}) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span
      className={`fin-status-pill${compact ? " fin-status-pill--compact" : ""}`}
      style={{
        background: style.bg,
        borderColor: style.border,
        color: style.text,
      }}
    >
      <span className="fin-status-pill__dot" style={{ background: style.dot }} />
      <span className="fin-status-pill__label">{displayLabel ?? style.label}</span>
    </span>
  );
}

export default function DocumentStatusSelect({
  value,
  options,
  disabled,
  loading,
  displayLabel,
  onChange,
}: {
  value: DocumentStatus;
  options: DocumentStatus[];
  disabled?: boolean;
  loading?: boolean;
  displayLabel?: string;
  onChange: (status: DocumentStatus) => void;
}) {
  if (disabled) {
    return <DocumentStatusPill status={value} displayLabel={displayLabel} />;
  }

  return (
    <Select<DocumentStatus>
      value={value}
      loading={loading}
      disabled={disabled}
      className="fin-status-select"
      popupClassName="fin-status-select-dropdown"
      popupMatchSelectWidth={false}
      suffixIcon={<DownOutlined style={{ fontSize: 10, color: "var(--bms-text-3)" }} />}
      options={options.map((s) => ({
        value: s,
        label: formatDocumentStatusLabel(s),
      }))}
      labelRender={() => (
        <DocumentStatusPill status={value} displayLabel={displayLabel} compact />
      )}
      optionRender={(opt) => {
        const status = opt.value as DocumentStatus;
        const selected = status === value;
        return (
          <div className={`fin-status-option${selected ? " fin-status-option--selected" : ""}`}>
            <DocumentStatusPill status={status} />
            {selected && <CheckOutlined className="fin-status-option__check" />}
          </div>
        );
      }}
      onChange={onChange}
    />
  );
}
