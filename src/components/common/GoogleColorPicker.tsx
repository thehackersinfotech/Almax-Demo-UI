import { CheckOutlined } from "@ant-design/icons";

const GOOGLE_COLORS = [
  "#AD1457", "#D81B60", "#E67C73", "#D50000", "#F4511E", "#EF6C00", "#F09300", "#F6BF26", "#E4C441",
  "#C0CA33", "#7CB342", "#0B8043", "#33B679", "#009688", "#039BE5", "#4285F4", "#7986CB",
  "#3F51B5", "#B39DDB", "#9E69AF", "#8E24AA", "#795548", "#616161", "#A79B8E",
];

export default function GoogleColorPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (color: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {GOOGLE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            style={{
              width: 24, height: 24, borderRadius: "50%",
              border: "none", background: c,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
              position: "relative",
            }}
          >
            {value === c && <CheckOutlined style={{ fontSize: 12, fontWeight: "bold" }} />}
          </button>
        ))}
      </div>

    </div>
  );
}
