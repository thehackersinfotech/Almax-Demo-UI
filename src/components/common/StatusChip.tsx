import type { PastelTone } from "@/utils/semanticColors";

export default function StatusChip({
  tone,
  children,
  size = "default",
  uniformWidth,
}: {
  tone: PastelTone;
  children: React.ReactNode;
  size?: "default" | "small";
  /** Fixed outer width — keeps table chips aligned */
  uniformWidth?: number;
}) {
  const compact = size === "small";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: uniformWidth ? "center" : undefined,
        gap: compact ? 5 : 6,
        padding: compact ? "3px 9px" : "4px 11px",
        borderRadius: 6,
        background: tone.text,
        color: "#ffffff",
        border: `1px solid ${tone.text}`,
        fontSize: compact ? 12 : 13,
        fontWeight: 700,
        lineHeight: 1.35,
        whiteSpace: "nowrap",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        ...(uniformWidth ? { width: uniformWidth, minWidth: uniformWidth, boxSizing: "border-box" as const } : {}),
      }}
    >
      <span
        style={{
          width: compact ? 7 : 8,
          height: compact ? 7 : 8,
          borderRadius: "50%",
          background: "#ffffff",
          flexShrink: 0,
        }}
        aria-hidden
      />
      <span style={{ fontVariantNumeric: "tabular-nums", textAlign: uniformWidth ? "center" : undefined, flex: uniformWidth ? 1 : undefined }}>
        {children}
      </span>
    </span>
  );
}
