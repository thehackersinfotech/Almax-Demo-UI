import { Typography } from "antd";
import type { ExecutiveProjectRow } from "@/services/dashboard";
import { marginTone } from "@/utils/semanticColors";

const { Text } = Typography;

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  projects: ExecutiveProjectRow[];
  limit?: number;
  onProjectClick?: (projectId: string) => void;
}

export default function ExecutiveMarginRank({ projects, limit = 5, onProjectClick }: Props) {
  const ranked = [...projects]
    .sort((a, b) => b.gross_margin - a.gross_margin)
    .slice(0, limit);

  if (ranked.length === 0) {
    return <Text type="secondary">No project margin data</Text>;
  }

  const maxAbs = Math.max(...ranked.map((p) => Math.abs(p.gross_margin)), 1);

  return (
    <div className="exec-margin-rank" role="list">
      {ranked.map((p, idx) => {
        const tone = marginTone(p.gross_margin);
        const widthPct = Math.max(4, (Math.abs(p.gross_margin) / maxAbs) * 100);

        return (
          <div
            key={p.id}
            className={`exec-margin-rank__row${onProjectClick ? " exec-margin-rank__row--clickable" : ""}`}
            role="listitem"
            onClick={onProjectClick ? () => onProjectClick(p.id) : undefined}
            onKeyDown={onProjectClick ? (e) => e.key === "Enter" && onProjectClick(p.id) : undefined}
            tabIndex={onProjectClick ? 0 : undefined}
          >
            <div className="exec-margin-rank__rank">{idx + 1}</div>
            <div className="exec-margin-rank__main">
              <div className="exec-margin-rank__head">
                <Text strong className="exec-margin-rank__code">{p.code}</Text>
                <Text
                  strong
                  className="exec-margin-rank__value"
                  style={{ color: tone.text }}
                >
                  {fmt(p.gross_margin)}
                </Text>
              </div>
              <Text type="secondary" className="exec-margin-rank__name" ellipsis>
                {p.name}
              </Text>
              <div className="exec-margin-rank__track">
                <div
                  className="exec-margin-rank__fill"
                  style={{
                    width: `${widthPct}%`,
                    background: tone.accent,
                  }}
                />
              </div>
              {p.gross_margin_pct != null && (
                <Text type="secondary" className="exec-margin-rank__pct">
                  {p.gross_margin_pct}% margin
                </Text>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
