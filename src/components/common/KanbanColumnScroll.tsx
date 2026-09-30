import { useRef, useState, useCallback, useEffect, type ReactNode, type MouseEvent } from "react";
import "./KanbanBoard.css";

/** Per-column scroll area — hover-only scrollbar rail, all items loaded (no load-more). */
export default function KanbanColumnScroll({ itemCount, children }: { itemCount: number; children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [thumb, setThumb] = useState({ top: 0, height: 0 });

  const updateScrollState = useCallback(() => {
    const el = bodyRef.current;
    const rail = railRef.current;
    if (!el) return;

    const scrollable = el.scrollHeight > el.clientHeight + 4;
    setCanScroll(scrollable);

    if (!scrollable || !rail) {
      setThumb({ top: 0, height: 0 });
      return;
    }

    const railH = rail.clientHeight;
    const ratio = el.clientHeight / el.scrollHeight;
    const thumbH = Math.max(28, Math.round(railH * ratio));
    const maxScroll = el.scrollHeight - el.clientHeight;
    const scrollRatio = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
    const thumbTop = Math.round((railH - thumbH) * scrollRatio);

    setThumb({ top: thumbTop, height: thumbH });
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = bodyRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    const rail = railRef.current;
    if (rail) ro.observe(rail);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, itemCount, canScroll]);

  const handleRailClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = bodyRef.current;
    const rail = railRef.current;
    if (!el || !rail || !canScroll) return;
    const rect = rail.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const targetTop = clickY - thumb.height / 2;
    const maxThumbTop = rail.clientHeight - thumb.height;
    const scrollRatio = maxThumbTop > 0 ? Math.max(0, Math.min(1, targetTop / maxThumbTop)) : 0;
    el.scrollTop = scrollRatio * (el.scrollHeight - el.clientHeight);
  };

  return (
    <div className={`kanban-column__scroll-wrap${canScroll ? " kanban-column__scroll-wrap--scrollable" : ""}`}>
      <div ref={bodyRef} className="kanban-column__body">
        {children}
      </div>
      {canScroll && (
        <div
          ref={railRef}
          className="kanban-column__scroll-rail"
          onClick={handleRailClick}
          aria-hidden
        >
          <div
            className="kanban-column__scroll-thumb"
            style={{ top: thumb.top, height: thumb.height }}
          />
        </div>
      )}
    </div>
  );
}
