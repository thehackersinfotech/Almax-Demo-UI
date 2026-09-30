import { Switch, Tooltip } from "antd";

interface ActiveStatusSwitchProps {
  checked: boolean;
  loading?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

/** Compact on/off control for active/inactive rows — no text label in the cell. */
export default function ActiveStatusSwitch({
  checked,
  loading,
  disabled,
  onChange,
}: ActiveStatusSwitchProps) {
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Tooltip title={checked ? "Active — click to deactivate" : "Inactive — click to activate"}>
        <Switch
          size="small"
          checked={checked}
          loading={loading}
          disabled={disabled}
          onChange={onChange}
        />
      </Tooltip>
    </span>
  );
}
