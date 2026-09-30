import { Input, Progress, Typography } from "antd";
import { LockOutlined, EyeTwoTone, EyeInvisibleOutlined } from "@ant-design/icons";
import {
  evaluatePasswordStrength,
  PASSWORD_RULE_LABELS,
  type PasswordStrength,
} from "@/utils/passwordValidation";

const { Text } = Typography;

const LEVEL_COLOR: Record<PasswordStrength["level"], string> = {
  weak: "#ff4d4f",
  medium: "#faad14",
  strong: "#52c41a",
};

const LEVEL_PERCENT: Record<PasswordStrength["level"], number> = {
  weak: 33,
  medium: 66,
  strong: 100,
};

interface PasswordStrengthInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  showRules?: boolean;
}

export default function PasswordStrengthInput({
  value = "",
  onChange,
  placeholder = "Enter your password",
  showRules = true,
}: PasswordStrengthInputProps) {
  const strength = evaluatePasswordStrength(value);

  return (
    <div>
      <Input.Password
        prefix={<LockOutlined style={{ color: "#a0abbe" }} />}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        style={{ borderRadius: 9, height: 46 }}
        autoComplete="new-password"
        iconRender={(visible) =>
          visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
        }
      />
      {value.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: "var(--bms-text-2)" }}>Password strength</Text>
            <Text style={{ fontSize: 12, color: LEVEL_COLOR[strength.level], fontWeight: 600, textTransform: "capitalize" }}>
              {strength.level}
            </Text>
          </div>
          <Progress
            percent={LEVEL_PERCENT[strength.level]}
            showInfo={false}
            strokeColor={LEVEL_COLOR[strength.level]}
            size="small"
          />
        </div>
      )}
      {showRules && value.length > 0 && (
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
          {PASSWORD_RULE_LABELS.map(({ key, label }) => (
            <li
              key={key}
              style={{
                fontSize: 12,
                color: strength.rules[key] ? "#52c41a" : "var(--bms-text-3)",
                marginBottom: 3,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{strength.rules[key] ? "✓" : "○"}</span>
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { evaluatePasswordStrength };
