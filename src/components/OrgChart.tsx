import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Spin, Empty, Tag, Button, Modal, Tooltip, Space } from "antd";
import {
  TeamOutlined, UserOutlined,
  ZoomInOutlined, ZoomOutOutlined,
  FullscreenOutlined, FullscreenExitOutlined,
  ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from "@ant-design/icons";
import { get } from "@/services/api";
import { avatarPastel, initialsFromName } from "@/utils/avatarColors";
import "./OrgChart.css";
interface OrgNode {
  id: string;
  name: string;
  employee_code: string;
  designation: string;
  department: string;
  manager_id: string | null;
  avatar: string | null;
}
interface TreeNode extends OrgNode { children: TreeNode[] }

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_W    = 170;
const SIBLING_G = 36;
const STEM_H    = 30;
const LINE_CLR  = "var(--bms-border)";

// ── Tree helpers ──────────────────────────────────────────────────────────────
function buildSubtree(nodes: OrgNode[], rootId: string): TreeNode {
  const node = nodes.find((n) => n.id === rootId)!;
  return {
    ...node,
    children: nodes
      .filter((n) => n.manager_id === rootId)
      .map((n) => buildSubtree(nodes, n.id)),
  };
}

/** Build subtree but strip children beyond maxDepth (keeps counts intact). */
function buildSubtreeCapped(nodes: OrgNode[], rootId: string, maxDepth: number, depth = 0): TreeNode {
  const node = nodes.find((n) => n.id === rootId)!;
  if (depth >= maxDepth) return { ...node, children: [] };
  return {
    ...node,
    children: nodes
      .filter((n) => n.manager_id === rootId)
      .map((n) => buildSubtreeCapped(nodes, n.id, maxDepth, depth + 1)),
  };
}

function subtreeWidth(node: TreeNode): number {
  if (!node.children.length) return CARD_W;
  const tot = node.children.reduce((s, c) => s + subtreeWidth(c), 0);
  return Math.max(CARD_W, tot + SIBLING_G * (node.children.length - 1));
}

/** Count descendants from the FULL (uncapped) tree. */
function countDescendants(nodes: OrgNode[], nodeId: string): number {
  const directs = nodes.filter((n) => n.manager_id === nodeId);
  return directs.reduce((sum, d) => sum + 1 + countDescendants(nodes, d.id), 0);
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) => {
      const clean = word.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      if (clean === "it") return word.replace(/it/i, "IT");
      if (clean === "hr") return word.replace(/hr/i, "HR");
      if (clean === "hrms") return word.replace(/hrms/i, "HRMS");
      if (clean === "ceo") return word.replace(/ceo/i, "CEO");
      if (clean === "cto") return word.replace(/cto/i, "CTO");
      if (clean === "cfo") return word.replace(/cfo/i, "CFO");
      if (clean === "coo") return word.replace(/coo/i, "COO");
      if (clean === "pmo") return word.replace(/pmo/i, "PMO");
      if (clean === "qa") return word.replace(/qa/i, "QA");
      if (clean === "ui" || clean === "ux") return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// ── Node card ─────────────────────────────────────────────────────────────────
function NodeCard({
  node, isRoot = false, isParent = false, reportCount = 0, onNavigate,
}: {
  node: TreeNode | OrgNode;
  isRoot?: boolean;
  isParent?: boolean;
  reportCount?: number;
  onNavigate?: (id: string) => void;
}) {
  const nodeName = toTitleCase(node.name || "—");
  const nodeDesig = toTitleCase(node.designation || "");
  const av = avatarPastel(nodeName);
  const borderColor = isRoot ? "var(--org-root-border)" : isParent ? "var(--org-parent-border)" : "var(--bms-border)";
  const bgColor     = isRoot ? "var(--org-root-bg)" : isParent ? "var(--org-parent-bg)" : "var(--bms-surface)";
  const shadow      = isRoot
    ? "var(--org-root-shadow)"
    : isParent
    ? "var(--org-parent-shadow)"
    : "var(--shadow-sm)";

  const designationClass = isRoot
    ? "org-card__designation-pill org-card__designation-pill--root"
    : isParent
    ? "org-card__designation-pill org-card__designation-pill--parent"
    : nodeDesig
    ? "org-card__designation-pill org-card__designation-pill--default"
    : "org-card__designation-pill org-card__designation-pill--empty";

  const showReports = reportCount > 0 && !isRoot && !isParent;
  const tooltipTitle = [
    nodeName,
    node.employee_code,
    nodeDesig,
    showReports ? `${reportCount} direct/indirect reports` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div
      className={`org-card${onNavigate ? "" : " org-card--static"}`}
      onClick={() => onNavigate?.(node.id)}
      title={tooltipTitle}
        style={{
          background: bgColor,
          border: `2px solid ${borderColor}`,
          boxShadow: shadow,
        }}
        onMouseEnter={(e) => {
          if (!onNavigate) return;
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "translateY(-3px)";
          el.style.boxShadow = isRoot
            ? "var(--org-root-shadow-hover)"
            : isParent
            ? "var(--org-parent-shadow-hover)"
            : "var(--shadow-md)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "";
          el.style.boxShadow = shadow;
        }}
      >
        {/* Fixed badge slot — same height on every card */}
        <div className="org-card__badge">
          {isRoot && <span className="org-card__badge-chip org-card__badge-chip--root">▼ Current</span>}
          {isParent && <span className="org-card__badge-chip org-card__badge-chip--parent">▲ Manager</span>}
        </div>

        {/* Fixed avatar slot */}
        <div className="org-card__avatar-wrap">
          {node.avatar ? (
            <img src={node.avatar} alt={nodeName} />
          ) : (
            <div
              className="org-card__initials"
              style={{ background: av.bg, border: `2px solid ${av.border}`, color: av.text }}
            >
              {initialsFromName(nodeName)}
            </div>
          )}
        </div>

        {/* Fixed name slot — always 2 lines max */}
        <div className="org-card__name">{nodeName}</div>

        {/* Fixed code slot — always reserved */}
        <div className={`org-card__code${node.employee_code ? "" : " org-card__code--empty"}`}>
          {node.employee_code || "—"}
        </div>

        {/* Fixed designation slot — always reserved, full text on hover */}
        <div className="org-card__designation">
          <Tooltip title={nodeDesig || undefined} placement="bottom">
            <span className={designationClass}>{nodeDesig || "—"}</span>
          </Tooltip>
        </div>

        {/* Fixed reports footer — always reserved height */}
        <div className={`org-card__reports${showReports ? "" : " org-card__reports--empty"}`}>
          <TeamOutlined style={{ fontSize: 9 }} />
          {reportCount} report{reportCount !== 1 ? "s" : ""}
        </div>
      </div>
  );
}

// ── Subtree renderer (full mode) ──────────────────────────────────────────────
function SubTree({
  node, isRoot = false, allNodes, onNavigate,
}: {
  node: TreeNode;
  isRoot?: boolean;
  allNodes: OrgNode[];
  onNavigate?: (id: string) => void;
}) {
  const sw = subtreeWidth(node);
  const desc = countDescendants(allNodes, node.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: sw }}>
      <NodeCard
        node={node}
        isRoot={isRoot}
        reportCount={isRoot ? 0 : desc}
        onNavigate={onNavigate}
      />

      {node.children.length > 0 && (
        <>
          <div style={{ width: 2, height: STEM_H, background: LINE_CLR, flexShrink: 0 }} />
          <div style={{ position: "relative", width: sw }}>
            {node.children.length > 1 && (() => {
              const fW = subtreeWidth(node.children[0]);
              const lW = subtreeWidth(node.children[node.children.length - 1]);
              return (
                <div style={{
                  position: "absolute", top: 0,
                  left: fW / 2, width: sw - fW / 2 - lW / 2,
                  height: 2, background: LINE_CLR,
                }} />
              );
            })()}
            <div style={{ display: "flex", gap: SIBLING_G }}>
              {node.children.map((child) => (
                <div key={child.id} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  width: subtreeWidth(child),
                }}>
                  <div style={{ width: 2, height: STEM_H, background: LINE_CLR, flexShrink: 0 }} />
                  <SubTree node={child} allNodes={allNodes} onNavigate={onNavigate} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Focused mode renderer: Manager → Root → Direct Reports only ───────────────
function FocusedTree({
  root,
  parent,
  allNodes,
  onNavigate,
}: {
  root: TreeNode;
  parent: OrgNode | null;
  allNodes: OrgNode[];
  onNavigate?: (id: string) => void;
}) {
  const directReports = root.children;

  // Width of the children row
  const rowW = directReports.length > 0
    ? directReports.length * CARD_W + (directReports.length - 1) * SIBLING_G
    : CARD_W;
  const totalW = Math.max(CARD_W, rowW);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>

      {/* ── Manager (parent) ── */}
      {parent && (
        <>
          {/* Section label */}
          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--org-parent-text)",
            letterSpacing: 0.5, marginBottom: 8,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <ArrowUpOutlined style={{ fontSize: 10 }} /> Reports To
          </div>
          <NodeCard
            node={{ ...parent, children: [] }}
            isParent
            onNavigate={onNavigate}
          />
          <div style={{ width: 2, height: STEM_H + 4, background: LINE_CLR }} />
        </>
      )}

      {/* ── Root (current employee) ── */}
      <NodeCard node={root} isRoot onNavigate={onNavigate} />

      {/* ── Direct reports ── */}
      {directReports.length > 0 && (
        <>
          <div style={{ width: 2, height: STEM_H + 4, background: LINE_CLR }} />

          {/* Section label */}
          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--org-root-text)",
            letterSpacing: 0.5, marginBottom: 8,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <ArrowDownOutlined style={{ fontSize: 10 }} /> Direct Reports ({directReports.length})
          </div>

          {/* Children row */}
          <div style={{ position: "relative", width: totalW }}>
            {directReports.length > 1 && (
              <div style={{
                position: "absolute", top: 0,
                left: CARD_W / 2, width: totalW - CARD_W,
                height: 2, background: LINE_CLR,
              }} />
            )}
            <div style={{ display: "flex", gap: SIBLING_G }}>
              {directReports.map((child) => {
                const childReports = countDescendants(allNodes, child.id);
                return (
                  <div key={child.id} style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    width: CARD_W,
                  }}>
                    <div style={{ width: 2, height: STEM_H, background: LINE_CLR, flexShrink: 0 }} />
                    <NodeCard
                      node={child}
                      reportCount={childReports}
                      onNavigate={onNavigate}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {directReports.length === 0 && (
        <div style={{
          marginTop: 14, fontSize: 12, color: "var(--bms-text-3)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <UserOutlined /> No direct reports
        </div>
      )}
    </div>
  );
}



// ── Zoom toolbar ──────────────────────────────────────────────────────────────
function ZoomBar({
  zoom, onZoomIn, onZoomOut, onReset, onFullscreen, isFullscreen,
}: {
  zoom: number; onZoomIn: () => void; onZoomOut: () => void;
  onReset: () => void; onFullscreen?: () => void; isFullscreen?: boolean;
}) {
  return (
    <div className="org-zoom-bar">
      <Tooltip title="Zoom out">
        <Button size="small" type="text" icon={<ZoomOutOutlined />} onClick={onZoomOut} disabled={zoom <= 0.3} />
      </Tooltip>
      <div
        className="org-zoom-bar__pct"
        onClick={onReset} title="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </div>
      <Tooltip title="Zoom in">
        <Button size="small" type="text" icon={<ZoomInOutlined />} onClick={onZoomIn} disabled={zoom >= 2.5} />
      </Tooltip>
      <div className="org-zoom-bar__divider" />
      <Tooltip title="Reset"><Button size="small" type="text" icon={<ReloadOutlined />} onClick={onReset} /></Tooltip>
      {onFullscreen && (
        <>
          <div className="org-zoom-bar__divider" />
          <Tooltip title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            <Button size="small" type="text"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={onFullscreen}
            />
          </Tooltip>
        </>
      )}
    </div>
  );
}

// ── Zoomable canvas ───────────────────────────────────────────────────────────
function ChartCanvas({
  children, zoom, height,
}: { children: React.ReactNode; zoom: number; height: number | string }) {
  return (
    <div className="org-canvas" style={{ height }}>
      <div style={{
        display: "inline-block", minWidth: "100%",
        padding: "40px 32px 36px",
        transformOrigin: "top center",
        zoom,
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OrgChart({
  rootId, onNavigate, height = 560, focusedMode = false,
}: {
  rootId?: string;
  onNavigate?: (id: string) => void;
  height?: number;
  focusedMode?: boolean;
}) {
  const [zoom, setZoom]             = useState(focusedMode ? 1 : 0.85);
  const [fsZoom, setFsZoom]         = useState(0.8);
  const [fullscreen, setFullscreen] = useState(false);

  const step = (set: typeof setZoom, d: number) =>
    () => set((z) => Math.min(2.5, Math.max(0.3, +((z + d).toFixed(2)))));

  const { data, isLoading } = useQuery<{ nodes: OrgNode[]; parent: OrgNode | null }>({
    queryKey: ["org-tree", rootId ?? "all"],
    queryFn:  () => get(`/employees/org-tree/${rootId ? `?root=${rootId}` : ""}`),
    staleTime: 60_000,
  });

  const allNodes = data?.nodes ?? [];
  const apiParent = data?.parent ?? null;

  const { tree, directCount, totalCount } = useMemo(() => {
    if (!allNodes.length) return { tree: [], directCount: 0, totalCount: 0 };

    if (rootId) {
      if (!allNodes.some((n) => n.id === rootId))
        return { tree: [], directCount: 0, totalCount: 0 };

      if (focusedMode) {
        // Only depth=1 (direct reports), but keep full allNodes for counts
        const capped = buildSubtreeCapped(allNodes, rootId, 1);
        return {
          tree: [capped],
          directCount: capped.children.length,
          totalCount: countDescendants(allNodes, rootId),
        };
      }

      const full = buildSubtree(allNodes, rootId);
      return {
        tree: [full],
        directCount: full.children.length,
        totalCount: countDescendants(allNodes, rootId),
      };
    }
    const idSet = new Set(allNodes.map((n) => n.id));
    const roots = allNodes
      .filter((n) => !n.manager_id || !idSet.has(n.manager_id))
      .map((n) => buildSubtree(allNodes, n.id));
    return { tree: roots, directCount: 0, totalCount: 0 };
  }, [data, rootId, focusedMode]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <Spin size="large" />
        <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 13 }}>Loading hierarchy…</div>
      </div>
    );
  }

  if (!tree.length) {
    return (
      <Empty
        image={<TeamOutlined style={{ fontSize: 52, color: "var(--bms-border)" }} />}
        description={
          <span style={{ color: "var(--bms-text-3)", fontSize: 13 }}>
            {rootId ? "No reporting structure found" : "No hierarchy configured"}
          </span>
        }
        style={{ padding: "48px 0" }}
      />
    );
  }

  const renderContent = (nav?: (id: string) => void, z = zoom) => (
    <ChartCanvas zoom={z} height={height}>
      {focusedMode && rootId ? (
        <FocusedTree
          root={tree[0]}
          parent={apiParent}
          allNodes={allNodes}
          onNavigate={nav}
        />
      ) : (
        tree.map((root, i) => (
          <div key={root.id} style={{ marginTop: i > 0 ? 48 : 0 }}>
            <SubTree
              node={root}
              isRoot={tree.length === 1}
              allNodes={allNodes}
              onNavigate={nav}
            />
          </div>
        ))
      )}
    </ChartCanvas>
  );

  return (
    <div>
      {/* Stats */}
      {rootId && (
        <div style={{
          display: "flex", gap: 10, marginBottom: 12,
          padding: "10px 14px", background: "var(--bms-surface)",
          borderRadius: 8, border: "1px solid var(--bms-border)", flexWrap: "wrap",
        }}>
          <Tag icon={<UserOutlined />}   color="blue">Direct Reports: {directCount}</Tag>
          <Tag icon={<TeamOutlined />} color="purple">Total in Team: {totalCount}</Tag>
          {apiParent && (
            <Tag color="volcano">Reports to: {apiParent.name}</Tag>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <ZoomBar
          zoom={zoom}
          onZoomIn={step(setZoom, 0.15)}
          onZoomOut={step(setZoom, -0.15)}
          onReset={() => setZoom(focusedMode ? 1 : 0.85)}
          onFullscreen={() => setFullscreen(true)}
        />
      </div>

      {renderContent(onNavigate, zoom)}

      {/* Legend */}
      <div style={{ marginTop: 10, display: "flex", gap: 20, fontSize: 11, color: "var(--bms-text-3)", flexWrap: "wrap" }}>
        {focusedMode ? (
          <>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", marginRight: 4, verticalAlign: "middle" }} />Purple = manager</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", marginRight: 4, verticalAlign: "middle" }} />Blue = current employee</span>
            <span>Footer = reports under that person</span>
          </>
        ) : (
          <>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", marginRight: 4, verticalAlign: "middle" }} />Blue border = root</span>
            <span>Footer = total reports under that person</span>
          </>
        )}
        <span>Click any card → open profile</span>
      </div>

      {/* Fullscreen modal */}
      <Modal
        open={fullscreen}
        onCancel={() => setFullscreen(false)}
        footer={null}
        width="96vw"
        style={{ top: 16, maxWidth: "none" }}
        styles={{ body: { padding: 0 }, content: { borderRadius: 14, overflow: "hidden" } }}
        closeIcon={<FullscreenExitOutlined style={{ fontSize: 18, color: "var(--bms-text-2)" }} />}
        destroyOnHidden={false}
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 40 }}>
            <Space>
              <TeamOutlined style={{ color: "#3b82f6", fontSize: 18 }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--bms-text)" }}>
                {rootId && focusedMode ? "Reporting Structure" : rootId ? "Team Hierarchy" : "Organisation Chart"}
              </span>
              {rootId && (
                <Space size={6}>
                  <Tag color="blue"   style={{ fontSize: 11 }}>Direct: {directCount}</Tag>
                  <Tag color="purple" style={{ fontSize: 11 }}>Total: {totalCount}</Tag>
                  {apiParent && <Tag color="volcano" style={{ fontSize: 11 }}>Reports to: {apiParent.name}</Tag>}
                </Space>
              )}
            </Space>
            <ZoomBar
              zoom={fsZoom}
              onZoomIn={step(setFsZoom, 0.15)}
              onZoomOut={step(setFsZoom, -0.15)}
              onReset={() => setFsZoom(0.8)}
              isFullscreen
              onFullscreen={() => setFullscreen(false)}
            />
          </div>
        }
      >
        {renderContent(
          (id) => { setFullscreen(false); onNavigate?.(id); },
          fsZoom,
        )}
        {/* re-render canvas with fs zoom and full height */}
        <style>{`.org-fs-canvas { height: calc(100vh - 120px) !important; }`}</style>
      </Modal>
    </div>
  );
}
