import { useEffect } from "react";
import { ConfigProvider, theme, App as AntApp } from "antd";
import { useThemeStore, applyThemeToDocument, getPersistedIsDark } from "@/store/theme";

const FONT_STACK = "'Inter', 'Roboto', 'Google Sans', 'Product Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans Tamil', sans-serif";

const lightTokens = {
  colorPrimary: "#1a73e8",
  colorLink: "#1a73e8",
  colorSuccess: "#188038",
  colorWarning: "#e37400",
  colorError: "#c5221f",
  borderRadius: 10,
  borderRadiusLG: 14,
  fontFamily: FONT_STACK,
  fontSize: 14,
  colorBgContainer: "#ffffff",
  colorBgLayout: "#f8f9fa",
  colorBorder: "#dadce0",
  colorText: "#202124",
  colorTextSecondary: "#5f6368",
  colorTextTertiary: "#80868b",
  colorFillAlter: "#f1f3f4",
  colorFillSecondary: "#e8eaed",
  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
  boxShadowSecondary: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
};

const darkTokens = {
  ...lightTokens,
  colorPrimary: "#3b82f6",
  colorLink: "#60a5fa",
  colorBgLayout: "#080c14",      // Deep black page background
  colorBgContainer: "#172136",   // Vibrant dark blue box background
  colorBgElevated: "#1c2842",    // Elevated dark blue modal/popover/select box
  colorBorder: "#2b3d63",        // Blue-tinted border line
  colorBorderSecondary: "#233352",
  colorText: "#f1f5f9",
  colorTextSecondary: "#94a3b8",
  colorTextTertiary: "#64748b",
  colorFillAlter: "#1e2c48",
  colorFillSecondary: "#233352",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.18)",
  boxShadowSecondary: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(59, 130, 246, 0.22)",
};

export default function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const isDark = useThemeStore((s) => s.isDark);

  // Apply CSS variables on every change
  useEffect(() => {
    applyThemeToDocument(isDark);
  }, [isDark]);

  // Apply immediately on first render using persisted value
  // (before Zustand rehydration completes)
  useEffect(() => {
    applyThemeToDocument(getPersistedIsDark());
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: isDark ? darkTokens : lightTokens,
        components: {
          Button:  { borderRadius: 10, fontWeight: 500, controlHeight: 36 },
          Card:    { borderRadius: 14, colorBgContainer: isDark ? "#172136" : "#ffffff" },
          Input:   { borderRadius: 10, controlHeight: 36, colorBgContainer: isDark ? "#121b2d" : "#ffffff", colorBorder: isDark ? "#2b3d63" : "#dadce0" },
          Select:  { borderRadius: 10, controlHeight: 36, colorBgContainer: isDark ? "#121b2d" : "#ffffff", colorBorder: isDark ? "#2b3d63" : "#dadce0" },
          Modal:   { borderRadius: 14, contentBg: isDark ? "#172136" : "#ffffff", headerBg: isDark ? "#172136" : "#ffffff", footerBg: isDark ? "#172136" : "#ffffff" },
          Drawer:  { colorBgElevated: isDark ? "#172136" : "#ffffff" },
          Table: {
            borderRadius: 14,
            headerBg:   isDark ? "#1e2c48" : "#f1f3f4",
            rowHoverBg: isDark ? "#233352" : "#e8f0fe",
            colorBgContainer: isDark ? "#172136" : "#ffffff",
          },
          Menu: {
            itemBorderRadius:    10,
            itemSelectedBg:      "#1a73e8",
            itemSelectedColor:   "#ffffff",
            darkItemBg:          "#080c14",
            darkItemHoverBg:     "#172136",
            darkItemSelectedBg:  "#1a73e8",
          },
          Tag: {
            borderRadius:     6,
            colorError:       "#c5221f",
            colorErrorBg:     "#fce8e6",
            colorErrorBorder: "#f5c2c0",
          },
        },
      }}
    >
      <AntApp>
        {children}
      </AntApp>
    </ConfigProvider>
  );
}