import { useMemo, useState } from "react";
import { Segmented, Typography } from "antd";
import type { ExecutiveProjectRow } from "@/services/dashboard";
import { marginTone } from "@/utils/semanticColors";
import MarginTag, { marginMetaColor } from "@/components/common/MarginTag";

const { Text } = Typography;

type SortMode = "low" | "high";

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtHours(n: number) {
  return `${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 1 })}h`;
}

interface Props {
  projects: ExecutiveProjectRow[];
  onProjectClick?: (projectId: string) => void;
}

export default function ExecutivePortfolioPanel({ projects, onProjectClick }: Props) {
  const [sort, setSort] = useState<SortMode>("low");

  const ranked = useMemo(() => {
    const list = [...projects];
    list.sort((a, b) => (sort === "low" ? a.gross_margin - b.gross_margin : b.gross_margin - a.gross_margin));
    return list;
  }, [projects, sort]);

  const summary = useMemo(() => {
    const totalMargin = projects.reduce((s, p) => s + p.gross_margin, 0);
    const negative = projects.filter((p) => p.gross_margin < 0).length;
    const totalRevenue = projects.reduce((s, p) => s + p.revenue_invoiced, 0);
    return { totalMargin, negative, totalRevenue };
  }, [projects]);

  const maxAbs = useMemo(
    () => Math.max(...ranked.map((p) => Math.abs(p.gross_margin)), 1),
    [ranked],
  );

  if (!projects.length) {
    return <Text type="secondary">No projects in portfolio for this FY.</Text>;
  }

  return (
    <div className="exec-portfolio-panel">
      <div className="exec-portfolio-panel__summary">
        {[
          { label: "Projects", value: String(projects.length), color: "var(--bms-text)" },
          { label: "FY invoiced", value: fmt(summary.totalRevenue), color: "#4f46e5" },
          { label: "Portfolio margin", value: fmt(summary.totalMargin), color: marginMetaColor(summary.totalMargin) },
          { label: "At risk", value: String(summary.negative), color: summary.negative > 0 ? "var(--bms-danger)" : "var(--bms-success)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="exec-portfolio-panel__stat">
            <span className="exec-portfolio-panel__stat-label">{label}</span>
            <span className="exec-portfolio-panel__stat-value" style={{ color }}>{value}</span>
          </div>
        ))}
        <div className="exec-portfolio-panel__sort">
          <Segmented<SortMode>
            size="small"
            value={sort}
            onChange={setSort}
            options={[
              { label: "Lowest margin", value: "low" },
              { label: "Highest margin", value: "high" },
            ]}
          />
        </div>
      </div>

      <div className="exec-portfolio-panel__head" aria-hidden>
        <span className="exec-portfolio-panel__col exec-portfolio-panel__col--project">Project</span>
        <span className="exec-portfolio-panel__col exec-portfolio-panel__col--metric">Hours</span>
        <span className="exec-portfolio-panel__col exec-portfolio-panel__col--metric">Revenue</span>
        <span className="exec-portfolio-panel__col exec-portfolio-panel__col--metric">Cost</span>
        <span className="exec-portfolio-panel__col exec-portfolio-panel__col--margin">Margin</span>
      </div>

      <div className="exec-portfolio-panel__list" role="list">
        {ranked.map((p, idx) => {
          const tone = marginTone(p.gross_margin);
          const widthPct = Math.max(4, (Math.abs(p.gross_margin) / maxAbs) * 100);

          return (
            <div
              key={p.id}
              className={`exec-portfolio-panel__row${onProjectClick ? " exec-portfolio-panel__row--clickable" : ""}`}
              role="listitem"
              onClick={onProjectClick ? () => onProjectClick(p.id) : undefined}
              onKeyDown={onProjectClick ? (e) => e.key === "Enter" && onProjectClick(p.id) : undefined}
              tabIndex={onProjectClick ? 0 : undefined}
            >
              <div className="exec-portfolio-panel__col exec-portfolio-panel__col--project">
                <span className="exec-portfolio-panel__rank">{idx + 1}</span>
                <div className="exec-portfolio-panel__project">
                  <div className="exec-portfolio-panel__project-top">
                    <code className="exec-portfolio-panel__code">{p.code}</code>
                    <Text strong className="exec-portfolio-panel__name" ellipsis>{p.name}</Text>
                  </div>
                  {p.client_name && (
                    <Text type="secondary" className="exec-portfolio-panel__client" ellipsis>
                      {p.client_name}
                    </Text>
                  )}
                </div>
              </div>
              <div className="exec-portfolio-panel__col exec-portfolio-panel__col--metric">
                <span className="exec-portfolio-panel__metric-value">{fmtHours(p.logged_hours_fy)}</span>
                <span className="exec-portfolio-panel__metric-sub">/ {fmtHours(p.estimated_hours)}</span>
              </div>
              <div className="exec-portfolio-panel__col exec-portfolio-panel__col--metric">
                <span className="exec-portfolio-panel__metric-value">{fmt(p.revenue_invoiced)}</span>
              </div>
              <div className="exec-portfolio-panel__col exec-portfolio-panel__col--metric">
                <span className="exec-portfolio-panel__metric-value">{fmt(p.total_cost)}</span>
              </div>
              <div className="exec-portfolio-panel__col exec-portfolio-panel__col--margin">
                <div className="exec-portfolio-panel__margin-top">
                  <MarginTag amount={p.gross_margin} pct={p.gross_margin_pct} size="small" />
                </div>
                <div className="exec-portfolio-panel__track">
                  <div
                    className="exec-portfolio-panel__fill"
                    style={{ width: `${widthPct}%`, background: tone.accent }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
