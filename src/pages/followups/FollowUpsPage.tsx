import { useState, useMemo, useEffect, useRef } from "react";
import {
  Button, Select, Tag, Space,
  Popconfirm, message, Typography, Segmented, Empty, Spin, Pagination,
  Table, Card, Tooltip,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined,
  PhoneOutlined, MailOutlined, CalendarOutlined, WhatsAppOutlined,
  EnvironmentOutlined, ClockCircleOutlined, WarningOutlined,
  AppstoreOutlined, UnorderedListOutlined, HolderOutlined, UserOutlined, CheckSquareOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { followUpApi, FollowUpItem, FOLLOWUP_PRIORITIES } from "@/services/followups";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";
import { useSearchParams, useNavigate } from "react-router-dom";
import FollowUpDetailDrawer from "./FollowUpDetailDrawer";
import { formatTimeRange, getTypeTagColor } from "./followupCalendarUtils";
import PastelTag, { OverdueTag } from "@/components/common/PastelTag";
import KanbanColumnScroll from "@/components/common/KanbanColumnScroll";
import KanbanBoardGrid from "@/components/common/KanbanBoardGrid";
import "@/components/common/KanbanBoard.css";
import { DANGER } from "@/utils/semanticColors";
import FollowUpCreateModal from "@/pages/workspace/FollowUpCreateModal";

type ViewMode = "board" | "list";

const { Title, Text, Paragraph } = Typography;

const LIST_PAGE_SIZE = 10;

const TYPE_OPTIONS = [
  { value: "EMAIL",      label: "Email",      icon: <MailOutlined /> },
  { value: "CALL",       label: "Call",       icon: <PhoneOutlined /> },
  { value: "WHATSAPP",   label: "WhatsApp",   icon: <WhatsAppOutlined /> },
  { value: "SITE_VISIT", label: "Site Visit", icon: <EnvironmentOutlined /> },
];

const BOARD_COLUMNS = [
  { slug: "planning",   label: "Planning",    color: "#8B5CF6" },
  { slug: "inprogress", label: "In Progress", color: "#3B82F6" },
  { slug: "completed",  label: "Completed",   color: "#10B981" },
  { slug: "cancelled",  label: "Cancelled",   color: "#EF4444" },
];

const FOLLOWUP_MOVES: Record<string, string[]> = {
  planning: ["inprogress", "completed", "cancelled"],
  inprogress: ["completed", "planning", "cancelled"],
  completed: ["cancelled", "inprogress", "planning"],
  cancelled: ["planning", "inprogress", "completed"],
};

function userCanViewFollowUp(item: FollowUpItem, userId: string | undefined): boolean {
  if (!userId) return false;
  return (item.assignees || []).includes(userId) || item.reporter === userId;
}

function filterItemsForUser(items: FollowUpItem[], userId: string | undefined, viewAll: boolean): FollowUpItem[] {
  if (!userId) return items;
  return items.filter((item) => userCanViewFollowUp(item, userId));
}

function canDropOnColumn(item: FollowUpItem, destSlug: string): boolean {
  if (item.workflow_state_slug === destSlug) return false;
  if (Array.isArray(item.allowed_destination_slugs) && item.allowed_destination_slugs.length > 0) {
    return item.allowed_destination_slugs.includes(destSlug);
  }
  return (FOLLOWUP_MOVES[item.workflow_state_slug] ?? []).includes(destSlug);
}

function TypeIcon({ type }: { type: string }) {
  const opt = TYPE_OPTIONS.find((t) => t.value === type);
  return opt ? <span style={{ marginRight: 4 }}>{opt.icon}</span> : <CheckSquareOutlined style={{ marginRight: 4 }} />;
}

function PriorityTag({ priority, label, size = "default" }: { priority: string; label?: string; size?: "default" | "small" }) {
  const cfg = FOLLOWUP_PRIORITIES.find((p) => p.value === priority) ?? FOLLOWUP_PRIORITIES[2];
  return <PastelTag tone={cfg} size={size}>{label ?? cfg.label}</PastelTag>;
}

function PriorityPicker({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {FOLLOWUP_PRIORITIES.map((p) => {
        const active = (value ?? "MEDIUM") === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange?.(p.value)}
            style={{
              padding: "8px 4px",
              borderRadius: 8,
              border: `2px solid ${active ? p.border : "var(--bms-border)"}`,
              background: active ? p.bg : "var(--bms-surface)",
              color: active ? p.text : "var(--bms-text-2)",
              fontWeight: active ? 700 : 500,
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.15s ease",
              textAlign: "center",
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function priorityAccent(priority: string) {
  return FOLLOWUP_PRIORITIES.find((p) => p.value === priority)?.accent ?? "#d9a300";
}

function FollowUpCard({
  item, onView, onDragStart, onDragEnd, isDragging, draggable, didDragRef,
}: {
  item: FollowUpItem;
  onView: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  draggable?: boolean;
  didDragRef: React.MutableRefObject<boolean>;
}) {
  const isCancelled = item.workflow_state_slug === "cancelled";
  const accent = isCancelled ? "#EF4444" : priorityAccent(item.priority || "MEDIUM");
  const timeRange = formatTimeRange(item.start_time, item.end_time);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      className={[
        "kanban-card",
        "kanban-card--compact",
        draggable ? "kanban-card--draggable" : "",
        isDragging ? "kanban-card--dragging" : "",
      ].filter(Boolean).join(" ")}
      style={{
        ["--card-accent" as string]: accent,
        background: isCancelled ? "rgba(239, 68, 68, 0.07)" : undefined,
        borderColor: isCancelled ? "rgba(239, 68, 68, 0.35)" : undefined,
      }}
      onClick={() => {
        if (didDragRef.current) return;
        onView();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView();
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        didDragRef.current = true;
        onDragStart?.();
      }}
      onDragEnd={() => {
        onDragEnd?.();
        requestAnimationFrame(() => { didDragRef.current = false; });
      }}
    >
      <span className="kanban-card__accent" style={{ background: accent }} aria-hidden />

      <div className="kanban-card__row-top">
        <span className="kanban-card__type">
          <TypeIcon type={item.type} />
          {item.type_label}
        </span>
        <Space size={4}>
          {isCancelled && (
            <Tag color="error" style={{ margin: 0, fontWeight: 700, fontSize: 10, borderRadius: 10, padding: "0 6px" }}>
              CANCELLED
            </Tag>
          )}
          <PriorityTag priority={item.priority || "MEDIUM"} label={item.priority_label} size="small" />
        </Space>
      </div>

      <div className="kanban-card__title">{item.title}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0 8px 0", fontSize: 11, color: "var(--bms-text-3)" }}>
        <UserOutlined style={{ fontSize: 10, color: "var(--bms-text-3)" }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {(item.assignees_data || []).map(a => a.full_name).join(", ") || "Unassigned"}
        </span>
      </div>

      <div className={`kanban-card__meta${item.is_overdue ? " kanban-card__meta--overdue" : ""}`}>
        <ClockCircleOutlined style={{ fontSize: 11 }} />
        <span>{item.start_date ? dayjs(item.start_date).format("DD MMM YYYY") : "No date"}
          {item.end_date && item.end_date !== item.start_date
            ? ` – ${dayjs(item.end_date).format("DD MMM YYYY")}`
            : ""}
        </span>
        {timeRange && <span>· {timeRange}</span>}
        {item.is_overdue && <OverdueTag size="small" />}
      </div>
    </div>
  );
}

function KanbanColumn({
  col, items, draggedItem, canTransitionGlobally, didDragRef,
  onDragStart, onDragEnd, onDrop, onView,
}: {
  col: typeof BOARD_COLUMNS[number];
  items: FollowUpItem[];
  draggedItem: FollowUpItem | null;
  canTransitionGlobally: boolean;
  didDragRef: React.MutableRefObject<boolean>;
  onDragStart: (item: FollowUpItem) => void;
  onDragEnd: () => void;
  onDrop: (destSlug: string) => void;
  onView: (item: FollowUpItem) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const canDrop = Boolean(
    draggedItem &&
    canDropOnColumn(draggedItem, col.slug) &&
    canTransitionGlobally &&
    draggedItem.can_transition,
  );

  return (
    <div
      className="kanban-column"
      style={{
        background: isDragOver && canDrop ? `${col.color}14` : "var(--bms-board-column)",
        border: isDragOver && canDrop ? `2px dashed ${col.color}` : "2px solid transparent",
      }}
      onDragOver={(e) => {
        if (canDrop) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (canDrop) onDrop(col.slug);
      }}
    >
      <div className="kanban-column__head">
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0 }}>{col.label}</span>
        <Tag style={{ margin: 0, borderRadius: 12, flexShrink: 0 }}>{items.length}</Tag>
      </div>

      <KanbanColumnScroll itemCount={items.length}>
        {items.map((item) => (
          <FollowUpCard
            key={item.id}
            item={item}
            onView={() => onView(item)}
            draggable={
              canTransitionGlobally && item.can_transition &&
              (item.allowed_destination_slugs?.length ?? (FOLLOWUP_MOVES[item.workflow_state_slug]?.length ?? 0)) > 0
            }
            isDragging={draggedItem?.id === item.id}
            onDragStart={() => onDragStart(item)}
            onDragEnd={onDragEnd}
            didDragRef={didDragRef}
          />
        ))}

        {isDragOver && canDrop && (
          <div className="kanban-column__drop-hint" style={{ color: col.color, border: `2px dashed ${col.color}`, background: `${col.color}08` }}>
            Drop here
          </div>
        )}

        {items.length === 0 && !isDragOver && (
          <div className="kanban-column__empty">No items</div>
        )}
      </KanbanColumnScroll>
    </div>
  );
}

export default function FollowUpsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = useAuthStore((s) => s.permissions);
  const userId = useAuthStore((s) => s.user?.id);
  const canCreate  = permissions.includes(PERMS.CRM_FOLLOWUP_CREATE as never);
  const canUpdate  = permissions.includes(PERMS.CRM_FOLLOWUP_UPDATE as never);
  const canDelete  = permissions.includes(PERMS.CRM_FOLLOWUP_DELETE as never);
  const canTransition = permissions.includes(PERMS.CRM_FOLLOWUP_TRANSITION as never);
  const canViewAll = permissions.includes(PERMS.CRM_FOLLOWUP_VIEW_ALL as never);

  const initialView = (searchParams.get("view") as ViewMode) || "board";
  const [viewMode, setViewMode] = useState<ViewMode>(
    ["board", "list"].includes(initialView) ? initialView : "board",
  );

  useEffect(() => {
    if (searchParams.get("view") === "calendar") {
      navigate("/workspace/calendar", { replace: true });
    }
  }, [searchParams, navigate]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(LIST_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FollowUpItem | null>(null);
  const [detailItem, setDetailItem] = useState<FollowUpItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<FollowUpItem | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    const urlId = searchParams.get("id");
    if (urlId) {
      followUpApi.retrieve(urlId).then((res) => {
        setDetailItem(res);
        searchParams.delete("id");
        setSearchParams(searchParams, { replace: true });
      }).catch(() => {
        message.error("Could not load follow-up from URL");
      });
    }
  }, [searchParams, setSearchParams]);

  const setView = (mode: ViewMode) => {
    setViewMode(mode);
    setSearchParams(mode === "board" ? {} : { view: mode }, { replace: true });
  };

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const listParams: Record<string, string | number> = {
    ...params,
    page: listPage,
    page_size: listPageSize,
  };

  useEffect(() => {
    setListPage(1);
  }, [statusFilter, listPageSize]);

  const { data: boardData, isLoading: boardLoading } = useQuery({
    queryKey: ["followups-board", userId, params],
    queryFn: () => followUpApi.board(params),
    enabled: viewMode === "board" && Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["followups-list", userId, listParams],
    queryFn: () => followUpApi.list(listParams),
    enabled: viewMode === "list" && Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["followups-board"] });
    qc.invalidateQueries({ queryKey: ["followups-list"] });
    qc.invalidateQueries({ queryKey: ["lead-followups-all"] });
    qc.invalidateQueries({ queryKey: ["sales-followups-all"] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-followups"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
    qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => followUpApi.delete(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["followups-board"] });
      const previousData = qc.getQueryData<any>(["followups-board", userId, params]);
      if (previousData?.columns) {
        const newCols: Record<string, FollowUpItem[]> = {};
        for (const [colSlug, items] of Object.entries(previousData.columns as Record<string, FollowUpItem[]>)) {
          newCols[colSlug] = items.filter(it => it.id !== id);
        }
        qc.setQueryData(["followups-board", userId, params], {
          ...previousData,
          columns: newCols,
          count: Math.max(0, (previousData.count || 0) - 1),
        });
      }
      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        qc.setQueryData(["followups-board", userId, params], context.previousData);
      }
      message.error("Failed to delete");
    },
    onSuccess: () => {
      message.success("Follow-up deleted");
      invalidate();
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) => followUpApi.transition(id, state),
    onMutate: async ({ id, state }) => {
      await qc.cancelQueries({ queryKey: ["followups-board"] });
      const previousData = qc.getQueryData<any>(["followups-board", userId, params]);
      if (previousData?.columns) {
        const newCols: Record<string, FollowUpItem[]> = {};
        let moved: FollowUpItem | null = null;
        for (const [colSlug, items] of Object.entries(previousData.columns as Record<string, FollowUpItem[]>)) {
          newCols[colSlug] = items.filter(it => {
            if (it.id === id) {
              moved = { ...it, workflow_state_slug: state, workflow_state_name: state.toUpperCase() };
              return false;
            }
            return true;
          });
        }
        if (moved) {
          newCols[state] = [...(newCols[state] || []), moved];
          qc.setQueryData(["followups-board", userId, params], {
            ...previousData,
            columns: newCols,
          });
        }
      }
      return { previousData };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previousData) {
        qc.setQueryData(["followups-board", userId, params], context.previousData);
      }
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Cannot move to this stage");
    },
    onSuccess: () => { invalidate(); },
    onSettled: () => setDraggedItem(null),
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item: FollowUpItem) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditing(null);
    invalidate();
  };

  const handleDone = (item: FollowUpItem) => {
    transitionMutation.mutate(
      { id: item.id, state: "completed" },
      { onSuccess: () => message.success("Marked as done") },
    );
  };

  const handleDrop = (destSlug: string) => {
    if (!draggedItem) return;
    if (!canDropOnColumn(draggedItem, destSlug)) {
      message.warning("This follow-up cannot move to that stage");
      setDraggedItem(null);
      return;
    }
    transitionMutation.mutate(
      { id: draggedItem.id, state: destSlug },
      { onSuccess: () => message.success("Follow-up moved") },
    );
  };

  const isLoading = viewMode === "board" ? boardLoading : listLoading;

  const columns = useMemo(() => {
    const raw = boardData?.columns ?? {};
    if (canViewAll) return raw;
    const scoped: Record<string, FollowUpItem[]> = {};
    for (const [slug, items] of Object.entries(raw)) {
      const visible = filterItemsForUser(items, userId, false);
      if (visible.length > 0) scoped[slug] = visible;
    }
    return scoped;
  }, [boardData?.columns, canViewAll, userId]);

  const listItems = listData?.results ?? [];
  const listTotal = listData?.count ?? 0;

  const listColumns = [
    {
      title: "Title",
      key: "title",
      width: 280,
      render: (_: any, item: FollowUpItem) => (
        <Text strong style={{ color: "var(--bms-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.title}
        </Text>
      ),
    },
    {
      title: "Priority",
      key: "priority",
      width: 120,
      render: (_: any, item: FollowUpItem) => (
        <PriorityTag priority={item.priority || "MEDIUM"} label={item.priority_label} size="small" />
      ),
    },
    {
      title: "Type",
      key: "type",
      width: 140,
      render: (_: any, item: FollowUpItem) => {
        const bg = getTypeTagColor(item.type);
        return (
          <Tag icon={<TypeIcon type={item.type} />} style={{ background: bg, color: "#fff", border: "none", borderRadius: 12, padding: "2px 10px", fontWeight: 500 }}>
            {item.type_label}
          </Tag>
        );
      },
    },
    {
      title: "Stage",
      key: "stage",
      width: 140,
      render: (_: any, item: FollowUpItem) => (
        <Tag style={{ background: item.workflow_state_color || "#3b82f6", color: "#fff", border: "none", borderRadius: 12, padding: "2px 10px", fontWeight: 500 }}>
          {item.workflow_state_name}
        </Tag>
      ),
    },
    {
      title: "Assignees",
      key: "assignees",
      width: 180,
      render: (_: any, item: FollowUpItem) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {(item.assignees_data || []).map(a => a.full_name).join(", ") || "Unassigned"}
        </Text>
      ),
    },
    {
      title: "Date & Time",
      key: "datetime",
      width: 220,
      render: (_: any, item: FollowUpItem) => {
        const timeRange = formatTimeRange(item.start_time, item.end_time);
        return (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {item.start_date ? dayjs(item.start_date).format("DD MMM YYYY") : "No date"}
              {item.end_date && item.end_date !== item.start_date ? ` – ${dayjs(item.end_date).format("DD MMM YYYY")}` : ""}
            </Text>
            {timeRange && <Text type="secondary" style={{ fontSize: 12 }}>{timeRange}</Text>}
            {item.is_overdue && <Text strong style={{ color: "var(--bms-danger)", fontSize: 12, marginTop: 4 }}><WarningOutlined /> OVERDUE</Text>}
          </div>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 120,

      align: "right" as const,
      render: (_: any, item: FollowUpItem) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          {canTransition && item.can_transition && item.workflow_state_slug !== "completed" && item.workflow_state_slug !== "cancelled" && (
            <Tooltip title="Done">
              <Button size="small" icon={<CheckOutlined />} onClick={() => handleDone(item)} />
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(item)} />
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete">
              <Popconfirm title="Delete?" onConfirm={() => deleteMutation.mutate(item.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Follow-ups</Title>
          <Text type="secondary">
            {canViewAll
              ? "Manage all client follow-ups"
              : "Only follow-ups assigned to you or created by you are shown"}
          </Text>
        </div>
        <Space wrap>
          <Segmented
            value={viewMode}
            onChange={(v) => setView(v as ViewMode)}
            options={[
              { value: "board", icon: <AppstoreOutlined />, label: "Board" },
              { value: "list",  icon: <UnorderedListOutlined />, label: "List" },
            ]}
          />
          {viewMode === "list" && (
            <Select
              allowClear
              style={{ width: 160 }}
              value={statusFilter || ""}
              onChange={(v) => setStatusFilter(v || "")}
              options={[{ value: "", label: "All Stages" }, ...BOARD_COLUMNS.map((c) => ({ value: c.slug, label: c.label }))]}
            />
          )}
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Schedule
            </Button>
          )}
        </Space>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
      ) : viewMode === "board" ? (
        <KanbanBoardGrid columnCount={BOARD_COLUMNS.length} boardHeight="calc(100vh - 280px)">
          {BOARD_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.slug}
              col={col}
              items={columns[col.slug] ?? []}
              draggedItem={draggedItem}
              canTransitionGlobally={canTransition}
              didDragRef={didDragRef}
              onDragStart={setDraggedItem}
              onDragEnd={() => setDraggedItem(null)}
              onDrop={handleDrop}
              onView={setDetailItem}
            />
          ))}
        </KanbanBoardGrid>
      ) : (
        <Card>
          <Table
            columns={listColumns}
            dataSource={listItems}
            rowKey="id"
            loading={listLoading}
            pagination={{
              current: listPage,
              pageSize: listPageSize,
              total: listTotal,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} follow-ups`,
              onChange: (page, size) => {
                setListPage(page);
                if (size !== listPageSize) setListPageSize(size);
              }
            }}
            size="middle"
            tableLayout="fixed"
            scroll={{ x: 1080 }}
            onRow={(record) => ({
              onClick: () => setDetailItem(record),
              style: { cursor: "pointer" }
            })}
          />
        </Card>
      )}

      <FollowUpDetailDrawer
        item={detailItem}
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        onEdit={openEdit}
        onDone={handleDone}
        onDelete={(id) => deleteMutation.mutate(id)}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canTransition={canTransition}
      />

      <FollowUpCreateModal
        open={modalOpen}
        editItem={editing}
        onClose={handleCloseModal}
      />
    </div>
  );
}
