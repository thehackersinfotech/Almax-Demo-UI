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
import { meetingApi, MeetingItem, MEETING_PRIORITIES } from "@/services/meetings";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";
import { useSearchParams, useNavigate } from "react-router-dom";
import MeetingDetailDrawer from "./MeetingDetailDrawer";
import { formatTimeRange } from "@/pages/followups/followupCalendarUtils";
import PastelTag, { OverdueTag } from "@/components/common/PastelTag";
import KanbanColumnScroll from "@/components/common/KanbanColumnScroll";
import KanbanBoardGrid from "@/components/common/KanbanBoardGrid";
import "@/components/common/KanbanBoard.css";
import { DANGER } from "@/utils/semanticColors";
import MeetingCreateModal from "@/pages/workspace/MeetingCreateModal";

type ViewMode = "board" | "list";

const { Title, Text, Paragraph } = Typography;

const LIST_PAGE_SIZE = 10;



const BOARD_COLUMNS = [
  { slug: "planning",   label: "Planning",    color: "#14B8A6" },
  { slug: "inprogress", label: "In Progress", color: "#3B82F6" },
  { slug: "completed",  label: "Completed",   color: "#10B981" },
  { slug: "cancelled",  label: "Cancelled",   color: "#d96560" },
];

const MEETING_MOVES: Record<string, string[]> = {
  planning: ["inprogress", "completed", "cancelled"],
  inprogress: ["completed", "planning", "cancelled"],
  completed: ["cancelled", "inprogress", "planning"],
  cancelled: ["planning", "inprogress", "completed"],
};

function userCanViewMeeting(item: MeetingItem, userId: string | undefined): boolean {
  if (!userId) return false;
  return (item.assignees || []).includes(userId) || item.reporter === userId;
}

function filterItemsForUser(items: MeetingItem[], userId: string | undefined, viewAll: boolean): MeetingItem[] {
  if (!userId) return items;
  return items.filter((item) => userCanViewMeeting(item, userId));
}

function canDropOnColumn(item: MeetingItem, destSlug: string): boolean {
  if (item.workflow_state_slug === destSlug) return false;
  if (Array.isArray(item.allowed_destination_slugs) && item.allowed_destination_slugs.length > 0) {
    return item.allowed_destination_slugs.includes(destSlug);
  }
  return (MEETING_MOVES[item.workflow_state_slug] ?? []).includes(destSlug);
}



function PriorityTag({ priority, label, size = "default" }: { priority: string; label?: string; size?: "default" | "small" }) {
  const cfg = MEETING_PRIORITIES.find((p) => p.value === priority) ?? MEETING_PRIORITIES[2];
  return <PastelTag tone={cfg} size={size}>{label ?? cfg.label}</PastelTag>;
}

function PriorityPicker({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {MEETING_PRIORITIES.map((p) => {
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
  return MEETING_PRIORITIES.find((p) => p.value === priority)?.accent ?? "#d9a300";
}

function MeetingCard({
  item, onView, onDragStart, onDragEnd, isDragging, draggable, didDragRef,
}: {
  item: MeetingItem;
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
        <span className="kanban-card__type">{item.meeting_mode ? (item.meeting_mode === "ONLINE" ? "Online" : "Offline") : "Meeting"}</span>
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
  items: MeetingItem[];
  draggedItem: MeetingItem | null;
  canTransitionGlobally: boolean;
  didDragRef: React.MutableRefObject<boolean>;
  onDragStart: (item: MeetingItem) => void;
  onDragEnd: () => void;
  onDrop: (destSlug: string) => void;
  onView: (item: MeetingItem) => void;
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
          <MeetingCard
            key={item.id}
            item={item}
            onView={() => onView(item)}
            draggable={
              canTransitionGlobally && item.can_transition &&
              (item.allowed_destination_slugs?.length ?? (MEETING_MOVES[item.workflow_state_slug]?.length ?? 0)) > 0
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

export default function MeetingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = useAuthStore((s) => s.permissions);
  const userId = useAuthStore((s) => s.user?.id);
  const canCreate  = permissions.length === 0 || permissions.includes(PERMS.CRM_MEETING_CREATE as never) || permissions.includes(PERMS.CRM_FOLLOWUP_CREATE as never) || Boolean(userId);
  const canUpdate  = permissions.length === 0 || permissions.includes(PERMS.CRM_MEETING_UPDATE as never) || permissions.includes(PERMS.CRM_FOLLOWUP_UPDATE as never) || Boolean(userId);
  const canDelete  = permissions.length === 0 || permissions.includes(PERMS.CRM_MEETING_DELETE as never) || permissions.includes(PERMS.CRM_FOLLOWUP_DELETE as never);
  const canTransition = permissions.length === 0 || permissions.includes(PERMS.CRM_MEETING_TRANSITION as never) || permissions.includes(PERMS.CRM_FOLLOWUP_TRANSITION as never) || Boolean(userId);
  const canViewAll = permissions.includes(PERMS.CRM_MEETING_VIEW_ALL as never) || permissions.includes(PERMS.CRM_FOLLOWUP_VIEW_ALL as never);

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
  const [modeFilter, setModeFilter] = useState<string>("");
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(LIST_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingItem | null>(null);
  const [detailItem, setDetailItem] = useState<MeetingItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<MeetingItem | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    const urlId = searchParams.get("id");
    if (urlId) {
      meetingApi.retrieve(urlId).then((res) => {
        setDetailItem(res);
        searchParams.delete("id");
        setSearchParams(searchParams, { replace: true });
      }).catch(() => {
        message.error("Could not load meeting from URL");
      });
    }
  }, [searchParams, setSearchParams]);

  const setView = (mode: ViewMode) => {
    setViewMode(mode);
    setSearchParams(mode === "board" ? {} : { view: mode }, { replace: true });
  };

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;
  if (modeFilter) params.meeting_mode = modeFilter;

  const listParams: Record<string, string | number> = {
    ...params,
    page: listPage,
    page_size: listPageSize,
  };

  useEffect(() => {
    setListPage(1);
  }, [statusFilter, modeFilter, listPageSize]);

  const { data: boardData, isLoading: boardLoading } = useQuery({
    queryKey: ["meetings-board", userId, params],
    queryFn: () => meetingApi.board(params),
    enabled: viewMode === "board" && Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["meetings-list", userId, listParams],
    queryFn: () => meetingApi.list(listParams),
    enabled: viewMode === "list" && Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["meetings-board"] });
    qc.invalidateQueries({ queryKey: ["meetings-list"] });
    qc.invalidateQueries({ queryKey: ["lead-meetings-all"] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-meetings"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
    qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => meetingApi.delete(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["meetings-board"] });
      const previousData = qc.getQueryData<any>(["meetings-board", userId, params]);
      if (previousData?.columns) {
        const newCols: Record<string, MeetingItem[]> = {};
        for (const [colSlug, items] of Object.entries(previousData.columns as Record<string, MeetingItem[]>)) {
          newCols[colSlug] = items.filter(it => it.id !== id);
        }
        qc.setQueryData(["meetings-board", userId, params], {
          ...previousData,
          columns: newCols,
          count: Math.max(0, (previousData.count || 0) - 1),
        });
      }
      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        qc.setQueryData(["meetings-board", userId, params], context.previousData);
      }
      message.error("Failed to delete");
    },
    onSuccess: () => {
      message.success("Meeting deleted");
      invalidate();
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) => meetingApi.transition(id, state),
    onMutate: async ({ id, state }) => {
      await qc.cancelQueries({ queryKey: ["meetings-board"] });
      const previousData = qc.getQueryData<any>(["meetings-board", userId, params]);
      if (previousData?.columns) {
        const newCols: Record<string, MeetingItem[]> = {};
        let moved: MeetingItem | null = null;
        for (const [colSlug, items] of Object.entries(previousData.columns as Record<string, MeetingItem[]>)) {
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
          qc.setQueryData(["meetings-board", userId, params], {
            ...previousData,
            columns: newCols,
          });
        }
      }
      return { previousData };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previousData) {
        qc.setQueryData(["meetings-board", userId, params], context.previousData);
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

  const openEdit = (item: MeetingItem) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditing(null);
    invalidate();
  };

  const handleDone = (item: MeetingItem) => {
    transitionMutation.mutate(
      { id: item.id, state: "completed" },
      { onSuccess: () => message.success("Marked as done") },
    );
  };

  const handleDrop = (destSlug: string) => {
    if (!draggedItem) return;
    if (!canDropOnColumn(draggedItem, destSlug)) {
      message.warning("This meeting cannot move to that stage");
      setDraggedItem(null);
      return;
    }
    transitionMutation.mutate(
      { id: draggedItem.id, state: destSlug },
      { onSuccess: () => message.success("Meeting moved") },
    );
  };

  const isLoading = viewMode === "board" ? boardLoading : listLoading;

  const columns = useMemo(() => {
    const raw = boardData?.columns ?? {};
    if (canViewAll) return raw;
    const scoped: Record<string, MeetingItem[]> = {};
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
      render: (_: any, item: MeetingItem) => (
        <Text strong style={{ color: "var(--bms-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.title}
        </Text>
      ),
    },
    {
      title: "Priority",
      key: "priority",
      width: 120,
      render: (_: any, item: MeetingItem) => (
        <PriorityTag priority={item.priority || "MEDIUM"} label={item.priority_label} size="small" />
      ),
    },
    {
      title: "Mode",
      key: "meeting_mode",
      width: 140,
      render: (_: any, item: MeetingItem) => {
        const bg = item.meeting_mode === "ONLINE" ? "#0284c7" : item.meeting_mode === "OFFLINE" ? "#0d9488" : "#2563eb";
        return (
          <Tag style={{ background: bg, color: "#fff", border: "none", borderRadius: 12, padding: "2px 10px", fontWeight: 500 }}>
            {item.meeting_mode ? (item.meeting_mode === "ONLINE" ? "Online" : "Offline") : "Meeting"}
          </Tag>
        );
      },
    },
    {
      title: "Stage",
      key: "stage",
      width: 140,
      render: (_: any, item: MeetingItem) => (
        <Tag style={{ background: item.workflow_state_color || "#3b82f6", color: "#fff", border: "none", borderRadius: 12, padding: "2px 10px", fontWeight: 500 }}>
          {item.workflow_state_name}
        </Tag>
      ),
    },
    {
      title: "Assignees",
      key: "assignees",
      width: 180,
      render: (_: any, item: MeetingItem) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {(item.assignees_data || []).map(a => a.full_name).join(", ") || "Unassigned"}
        </Text>
      ),
    },
    {
      title: "Date & Time",
      key: "datetime",
      width: 220,
      render: (_: any, item: MeetingItem) => {
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
      render: (_: any, item: MeetingItem) => (
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
          <Title level={4} style={{ margin: 0 }}>Meetings</Title>
          <Text type="secondary">
            {canViewAll
              ? "Manage all client meetings"
              : "Only meetings assigned to you or created by you are shown"}
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
            <>
              <Select
                allowClear
                style={{ width: 160 }}
                value={statusFilter || ""}
                onChange={(v) => setStatusFilter(v || "")}
                options={[{ value: "", label: "All Stages" }, ...BOARD_COLUMNS.map((c) => ({ value: c.slug, label: c.label }))]}
              />
              <Select
                allowClear
                style={{ width: 120 }}
                value={modeFilter || ""}
                onChange={(v) => setModeFilter(v || "")}
                options={[
                  { value: "", label: "All Modes" },
                  { value: "ONLINE", label: "Online" },
                  { value: "OFFLINE", label: "Offline" },
                ]}
              />
            </>
          )}
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Schedule Meeting
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
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} meetings`,
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

      <MeetingDetailDrawer
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

      <MeetingCreateModal
        open={modalOpen}
        editItem={editing}
        onClose={handleCloseModal}
      />
    </div>
  );
}
