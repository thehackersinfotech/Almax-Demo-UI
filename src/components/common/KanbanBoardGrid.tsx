import type { CSSProperties, ReactNode } from "react";
import "./KanbanBoard.css";

interface KanbanBoardGridProps {
  columnCount: number;
  children: ReactNode;
  boardHeight?: string;
  className?: string;
  style?: CSSProperties;
}

/** Equal-width columns that fill the page — works for 3, 4, 6+ workflow states. */
export default function KanbanBoardGrid({
  columnCount,
  children,
  boardHeight = "calc(100vh - 260px)",
  className = "",
  style,
}: KanbanBoardGridProps) {
  const n = Math.max(1, columnCount);
  return (
    <div
      className={`kanban-board-grid ${className}`.trim()}
      style={{
        gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
        ["--board-columns" as string]: n,
        ["--board-height" as string]: boardHeight,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
