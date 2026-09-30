import { Tag } from "antd";
import type { PastelTone } from "@/utils/semanticColors";
import { DANGER, pastelTagStyle } from "@/utils/semanticColors";

interface PastelTagProps {
  tone: PastelTone;
  children: React.ReactNode;
  size?: "default" | "small";
  icon?: React.ReactNode;
}

export default function PastelTag({ tone, children, size = "default", icon }: PastelTagProps) {
  return (
    <Tag
      icon={icon}
      style={{
        margin: 0,
        borderRadius: 6,
        fontWeight: 600,
        fontSize: size === "small" ? 10 : 11,
        lineHeight: size === "small" ? "18px" : "20px",
        padding: size === "small" ? "0 6px" : "0 8px",
        ...pastelTagStyle(tone),
      }}
    >
      {children}
    </Tag>
  );
}

export function OverdueTag({ size = "small" }: { size?: "default" | "small" }) {
  return <PastelTag tone={DANGER} size={size}>Overdue</PastelTag>;
}
