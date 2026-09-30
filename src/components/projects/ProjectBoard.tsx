import { useMemo, useState, useRef } from "react";
import { Tag, Typography, Progress, Empty, Spin, Tooltip, Modal, Input, Select, Space, Alert, message } from "antd";
import { CalendarOutlined, LockOutlined, SwapOutlined, WarningOutlined } from "@ant-design/icons";
import type { Project } from "@/services/projects";
import type { WorkflowState, WorkflowTransition } from "@/services/workflow";
import type { SimpleDropdownEmployee } from "@/services/employees";
import type { AuthUser } from "@/store/auth";
import dayjs from "dayjs";
import KanbanColumnScroll from "@/components/common/KanbanColumnScroll";
import KanbanBoardGrid from "@/components/common/KanbanBoardGrid";
import "@/components/common/KanbanBoard.css";

const { Text } = Typography;

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(100,116,139,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatHours(h: number) {
  if (h >= 1000) return `${(h / 1000).toFixed(1)}K h`;
  return `${Math.round(h)}h`;
}

function userCanExecuteTransition(
  transition: WorkflowTransition,
  user: AuthUser | null,
): boolean {
  if (!user) return false;
  if (user.is_superuser || user.is_staff) return true;
  const groups = transition.group_names ?? [];
  if (!groups.length) return true;
  const kc = (user.keycloak_group || "").trim();
  return !!kc && groups.includes(kc);
}

export function buildMovePermissionMap(
  transitions: WorkflowTransition[],
  user: AuthUser | null,
): Set<string> {
  const keys = new Set<string>();
  for (const t of transitions) {
    if (!userCanExecuteTransition(t, user)) continue;
    const src = t.source_state_detail?.slug ?? "";
    const dst = t.destination_state_detail?.slug ?? "";
    if (dst) keys.add(`${src}->${dst}`);
  }
  return keys;
}

interface PendingMove {
  project: Project;
  destSlug: string;
  destName: string;
  destColor: string;
  transitionLabel: string;
  isRollback: boolean;
  fromInitial: boolean;
}

function getStateOrder(columns: WorkflowState[], slug: string | undefined): number | null {
  if (!slug) return null;
  const col = columns.find((c) => c.slug === slug);
  return col != null ? col.order : null;
}

function isRollbackMove(columns: WorkflowState[], fromSlug: string | undefined, toSlug: string): boolean {
  const fromOrder = getStateOrder(columns, fromSlug);
  const toOrder = getStateOrder(columns, toSlug);
  if (fromOrder == null || toOrder == null) return false;
  return toOrder < fromOrder;
}

function findTransition(
  transitions: WorkflowTransition[],
  fromSlug: string,
  toSlug: string,
): WorkflowTransition | undefined {
  return transitions.find(
    (tr) =>
      tr.source_state_detail?.slug === fromSlug
      && tr.destination_state_detail?.slug === toSlug,
  );
}

function getMoveBlockMessage(
  project: Project,
  destCol: WorkflowState,
  columns: WorkflowState[],
  transitions: WorkflowTransition[],
  moveKeys: Set<string>,
): string | null {
  const initialSlug = (columns.find((c) => c.is_initial) || columns[0])?.slug ?? "";
  const src = project.workflow_state_slug || initialSlug;
  const destSlug = destCol.slug;
  if (src === destSlug) return null;

  const exists = !!findTransition(transitions, src, destSlug);
  const allowed = moveKeys.has(`${src}->${destSlug}`);
  const rollback = isRollbackMove(columns, src, destSlug);

  if (!exists) {
    if (rollback) {
      return `Cannot move back to "${destCol.name}". No rollback transition is set up in the workflow.`;
    }
    return `Cannot move to "${destCol.name}". This step is not connected in the workflow.`;
  }
  if (!allowed) {
    if (rollback) {
      return `Cannot move back to "${destCol.name}". Your role is not allowed to perform this rollback.`;
    }
    return `Cannot move to "${destCol.name}". Your role is not allowed for this transition.`;
  }
  return null;
}

interface ProjectBoardProps {
  projects: Project[];
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  user: AuthUser | null;
  loading?: boolean;
  employees?: SimpleDropdownEmployee[];
  onMove: (projectId: string, destinationSlug: string, comments?: string, managerId?: string) => Promise<void>;
  moving?: boolean;
}

export default function ProjectBoard({
  projects,
  states,
  transitions,
  user,
  loading,
  moving,
  employees = [],
  onMove,
}: ProjectBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [comment, setComment] = useState("");
  const [selectedManager, setSelectedManager] = useState<string | undefined>();
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const didDragRef = useRef(false);

  const moveKeys = useMemo(
    () => buildMovePermissionMap(transitions, user),
    [transitions, user],
  );

  const canDragAny = moveKeys.size > 0 || !!(user?.is_staff || user?.is_superuser);

  const columns = useMemo(
    () => [...states].sort((a, b) => a.order - b.order),
    [states],
  );

  const projectsBySlug = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const col of columns) map[col.slug] = [];
    const initialCol = columns.find((c) => c.is_initial) || columns[0];
    const unassigned: Project[] = [];
    for (const p of projects) {
      const slug = p.workflow_state_slug;
      if (slug && map[slug]) {
        map[slug].push(p);
      } else if (initialCol) {
        // Newly created or unset projects appear in the initial workflow state column
        map[initialCol.slug].push(p);
      } else {
        unassigned.push(p);
      }
    }
    return { map, unassigned };
  }, [projects, columns]);

  const canMoveTo = (project: Project, destSlug: string) => {
    const initialCol = columns.find((c) => c.is_initial) || columns[0];
    const effectiveSlug = project.workflow_state_slug || (initialCol ? initialCol.slug : "");
    if (effectiveSlug === destSlug) return false;
    const src = effectiveSlug;
    return moveKeys.has(`${src}->${destSlug}`);
  };

  const handleDragStart = (e: React.DragEvent, project: Project) => {
    const hasAny = columns.some((c) => canMoveTo(project, c.slug));
    if (!canDragAny || !hasAny) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/project-id", project.id);
    e.dataTransfer.effectAllowed = "move";
    didDragRef.current = true;
    setDraggingId(project.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverColumn(null);
    window.setTimeout(() => { didDragRef.current = false; }, 0);
  };

  const getTransitionLabel = (project: Project, destSlug: string) => {
    const initialCol = columns.find((c) => c.is_initial) || columns[0];
    const src = project.workflow_state_slug || (initialCol ? initialCol.slug : "");
    return findTransition(transitions, src, destSlug)?.label || "";
  };

  const handleDrop = (e: React.DragEvent, destCol: WorkflowState) => {
    e.preventDefault();
    setOverColumn(null);
    setDraggingId(null);
    const id = e.dataTransfer.getData("text/project-id");
    const project = projects.find((p) => p.id === id);
    if (!project) return;

    const blockMsg = getMoveBlockMessage(project, destCol, columns, transitions, moveKeys);
    if (blockMsg) {
      message.warning(blockMsg);
      return;
    }

    const initialCol = columns.find((c) => c.is_initial) || columns[0];
    const effectiveSrcSlug = project.workflow_state_slug || (initialCol ? initialCol.slug : "");
    const rollback = isRollbackMove(columns, effectiveSrcSlug, destCol.slug);
    const srcState = columns.find((c) => c.slug === effectiveSrcSlug);
    const fromInitial = srcState?.is_initial ?? false;
    setComment("");
    setSelectedManager(fromInitial ? (project.manager ?? undefined) : undefined);
    setPendingMove({
      project,
      destSlug: destCol.slug,
      destName: destCol.name,
      destColor: destCol.color_code || "#1677ff",
      transitionLabel: getTransitionLabel(project, destCol.slug),
      isRollback: rollback,
      fromInitial,
    });
  };

  const handleConfirmMove = async () => {
    if (!pendingMove) return;
    try {
      await onMove(
        pendingMove.project.id,
        pendingMove.destSlug,
        comment.trim() || undefined,
        selectedManager,
      );
      setPendingMove(null);
      setComment("");
      setSelectedManager(undefined);
    } catch {
      /* keep modal open; parent shows error message */
    }
  };

  const handleCancelMove = () => {
    setPendingMove(null);
    setComment("");
    setSelectedManager(undefined);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!columns.length) {
    return <Empty description="No workflow states configured. Set up the project workflow in Master." />;
  }

  return (
    <div>
      {!canDragAny && (
        <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
          <LockOutlined /> View only — your group is not mapped to any workflow transitions.
        </Text>
      )}
      <KanbanBoardGrid columnCount={columns.length} boardHeight="calc(100vh - 260px)">
        {columns.map((col) => {
          const items = projectsBySlug.map[col.slug] ?? [];
          const dotColor = col.color_code || "#94a3b8";
          const dropOk = draggingId
            ? (() => {
                const p = projects.find((x) => x.id === draggingId);
                return p ? canMoveTo(p, col.slug) : false;
              })()
            : false;

          return (
            <div
              key={col.id}
              className="kanban-column"
              style={{
                background: overColumn === col.slug && dropOk ? hexToRgba(dotColor, 0.08) : "var(--bms-board-column)",
                border: overColumn === col.slug && dropOk
                  ? `2px dashed ${dotColor}`
                  : "2px solid transparent",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverColumn(col.slug);
              }}
              onDragLeave={() => setOverColumn((c) => (c === col.slug ? null : c))}
              onDrop={(e) => handleDrop(e, col)}
            >
              <div className="kanban-column__head">
                <span
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: dotColor, flexShrink: 0,
                  }}
                />
                <Text
                  strong
                  ellipsis
                  style={{ fontSize: 13, color: "var(--bms-text)", flex: 1, minWidth: 0 }}
                >
                  {col.name}
                </Text>
                <Tag style={{ margin: 0, borderRadius: 10, fontWeight: 600, flexShrink: 0 }}>{items.length}</Tag>
              </div>

              <KanbanColumnScroll itemCount={items.length}>
                {items.map((p) => {
                  const progress = p.estimated_hours > 0
                    ? Math.min(100, Math.round(((p.logged_hours ?? 0) / p.estimated_hours) * 100))
                    : 0;
                  const overdue = !col.is_final
                    && p.end_date
                    && dayjs(p.end_date).isBefore(dayjs(), "day");
                  const draggable = canDragAny && columns.some((c) => canMoveTo(p, c.slug));
                  const accent = p.workflow_state_color || dotColor;
                  const isActive = activeCardId === p.id;

                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      draggable={draggable}
                      className={[
                        "kanban-card",
                        draggable ? "kanban-card--draggable" : "",
                        draggingId === p.id ? "kanban-card--dragging" : "",
                        isActive ? "kanban-card--active" : "",
                      ].filter(Boolean).join(" ")}
                      style={{ ["--card-accent" as string]: accent }}
                      onDragStart={(e) => handleDragStart(e, p)}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        if (didDragRef.current) return;
                        setActiveCardId((id) => (id === p.id ? null : p.id));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActiveCardId((id) => (id === p.id ? null : p.id));
                        }
                      }}
                    >
                      <span
                        className="kanban-card__accent"
                        style={{ background: accent }}
                        aria-hidden
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <Text strong style={{ fontSize: 13, lineHeight: 1.3 }}>{p.name}</Text>
                        {overdue && <Tag color="error" style={{ margin: 0, fontSize: 10, flexShrink: 0, whiteSpace: "nowrap" }}>Due</Tag>}
                      </div>
                      {p.client_name && (
                        <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                          {p.client_name}
                        </Text>
                      )}
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {p.business_type_name && (
                          <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{p.business_type_name}</Tag>
                        )}
                        {p.billing_type_name && (
                          <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>{p.billing_type_name}</Tag>
                        )}
                      </div>
                      <Text style={{ fontSize: 12, fontWeight: 600, color: "var(--bms-text-2, #5f6368)", display: "block", marginTop: 8 }}>
                        {formatHours(p.estimated_hours)}
                      </Text>
                      {progress > 0 && (
                        <Progress
                          percent={progress}
                          size="small"
                          strokeColor={accent}
                          style={{ marginTop: 6, marginBottom: 0 }}
                        />
                      )}
                      {p.end_date && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                          <CalendarOutlined style={{ fontSize: 11, color: "#8c9ab0" }} />
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(p.end_date).format("YYYY-MM-DD")}
                          </Text>
                        </div>
                      )}
                      {!draggable && canDragAny && (
                        <Tooltip title="No permission to move from this state">
                          <LockOutlined style={{ fontSize: 11, color: "#c0c8d4", marginTop: 6 }} />
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="kanban-column__empty">No projects</div>
                )}
              </KanbanColumnScroll>
            </div>
          );
        })}
      </KanbanBoardGrid>
      {projectsBySlug.unassigned.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
          {projectsBySlug.unassigned.length} project(s) without a workflow state
        </Text>
      )}

      <Modal
        title={
          <Space>
            <SwapOutlined style={{ color: "#1677ff" }} />
            <span>
              {pendingMove?.isRollback ? "Confirm workflow rollback" : "Confirm workflow change"}
            </span>
          </Space>
        }
        open={!!pendingMove}
        onOk={handleConfirmMove}
        onCancel={handleCancelMove}
        okText="OK"
        cancelText="Cancel"
        confirmLoading={moving}
        destroyOnHidden
        width={480}
      >
        {pendingMove && (
          <div>
            {pendingMove.isRollback && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message="Moving back in workflow"
                description="You are rolling this project back to an earlier stage. Add a comment if needed, then click OK to proceed."
                style={{ marginBottom: 16 }}
              />
            )}
            <Text strong style={{ display: "block", marginBottom: 12, fontSize: 14 }}>
              {pendingMove.project.name}
            </Text>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <Tag color={pendingMove.project.workflow_state_color || "default"} style={{ margin: 0 }}>
                {pendingMove.project.workflow_state_name || "Current"}
              </Tag>
              <Text type="secondary">→</Text>
              <Tag color={pendingMove.destColor} style={{ margin: 0 }}>
                {pendingMove.destName}
              </Tag>
            </div>
            {pendingMove.transitionLabel && (
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
                Transition: {pendingMove.transitionLabel}
              </Text>
            )}
            {pendingMove.fromInitial && (
              <>
                <Text style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                  Project Manager
                </Text>
                <Select
                  style={{ width: "100%", marginBottom: 16 }}
                  placeholder="Select a project manager"
                  value={selectedManager}
                  onChange={setSelectedManager}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={employees.map((e) => ({
                    value: e.id,
                    label: `${e.full_name}${e.employee_code ? ` (${e.employee_code})` : ""}`,
                  }))}
                />
              </>
            )}
            <Text style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
              Comment {pendingMove.isRollback ? "(recommended for rollback)" : "(optional)"}
            </Text>
            <Input.TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                pendingMove.isRollback
                  ? "Why is this project being moved back to an earlier stage?"
                  : "Add a note about this workflow change..."
              }
              rows={3}
              maxLength={500}
              showCount
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
