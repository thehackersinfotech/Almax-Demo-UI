function hexToRgba(hex: string, alpha: number) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(95, 99, 104, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function WorkflowChip({ name, color }: { name: string; color?: string }) {
  const accent = color || "#80868b";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 6,
      background: hexToRgba(accent, 0.12),
      border: `1px solid ${hexToRgba(accent, 0.28)}`,
      fontSize: 11, fontWeight: 600, color: accent, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
      {name}
    </span>
  );
}
