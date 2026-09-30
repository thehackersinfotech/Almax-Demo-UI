import { Button, Tooltip } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useThemeStore } from "@/store/theme";

export default function ThemeToggle() {
  const isDark = useThemeStore((s) => s.isDark);
  const toggle = useThemeStore((s) => s.toggle);

  const label = isDark ? "Light" : "Dark";
  const tooltip = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Tooltip title={tooltip}>
      <Button
        type="default"
        icon={isDark ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggle}
        aria-label={tooltip}
        aria-pressed={isDark}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 8,
          fontWeight: 500,
        }}
      >
        <span className="bms-theme-toggle-label">{label}</span>
      </Button>
    </Tooltip>
  );
}
