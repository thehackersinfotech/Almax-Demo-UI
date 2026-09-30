import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button, Modal, Form, Input, Select, DatePicker, Tag, Space,
  Popconfirm, message, Typography, Segmented, Empty, Spin, Row, Col, Tooltip, Pagination,
  Table, Card,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined,
  ClockCircleOutlined, WarningOutlined, AppstoreOutlined, UnorderedListOutlined,
  HolderOutlined, UserOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  todoApi, TodoItem, TodoCreate, TODO_PRIORITIES, TODO_BOARD_COLUMNS,
} from "@/services/todos";
import { fetchLeads, type Lead } from "@/services/leads";
import { get } from "@/services/api";
import { ENDPOINTS } from "@/constants/api";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";
import { parseTime, formatTimeRange } from "@/pages/followups/followupCalendarUtils";
import PastelTag, { OverdueTag } from "@/components/common/PastelTag";
import KanbanColumnScroll from "@/components/common/KanbanColumnScroll";
import KanbanBoardGrid from "@/components/common/KanbanBoardGrid";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import "@/components/common/KanbanBoard.css";
import TodoDetailDrawer from "./TodoDetailDrawer";
import ClockTimePicker from "@/components/common/ClockTimePicker";
import GoogleColorPicker from "@/components/common/GoogleColorPicker";
import { apiErrorMsg } from "@/utils/apiError";
import { extractCustomColor } from "./workspaceCalendarTheme";


type ViewMode = "board" | "list";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const LIST_PAGE_SIZE = 10;

const TODO_MOVES: Record<string, string[]> = {
  open: ["inprogress", "done", "cancelled"],
  inprogress: ["done", "open", "cancelled"],
  done: ["cancelled", "open", "inprogress"],
  cancelled: ["open", "inprogress", "done"],
};

function userCanViewTodo(item: TodoItem, userId: string | undefined): boolean {
  if (!userId) return false;
  return (item.assignees || []).includes(userId) || item.reporter === userId;
}

function filterItemsForUser(items: TodoItem[], userId: string | undefined): TodoItem[] {
  if (!userId) return items;
  return items.filter((item) => userCanViewTodo(item, userId));
}

function canDropOnColumn(item: TodoItem, destSlug: string): boolean {
  if (item.workflow_state_slug === destSlug) return false;
  if (Array.isArray(item.allowed_destination_slugs) && item.allowed_destination_slugs.length > 0) {
    return item.allowed_destination_slugs.includes(destSlug);
  }
  return (TODO_MOVES[item.workflow_state_slug ?? ""] ?? []).includes(destSlug);
}

function PriorityTag({ priority, label, size = "default" }: { priority: string; label?: string; size?: "default" | "small" }) {
  const cfg = TODO_PRIORITIES.find((p) => p.value === priority) ?? TODO_PRIORITIES[1];
  return <PastelTag tone={cfg} size={size}>{label ?? cfg.label}</PastelTag>;
}

function PriorityPicker({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {TODO_PRIORITIES.map((p) => {
        const active = (value ?? "MEDIUM") === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange?.(p.value)}
            style={{
              padding: "8px 4px", borderRadius: 8,
              border: `2px solid ${active ? p.border : "var(--bms-border)"}`,
              background: active ? p.bg : "var(--bms-surface)",
              color: active ? p.text : "var(--bms-text-2)",
              fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer",
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
  return TODO_PRIORITIES.find((p) => p.value === priority)?.accent ?? "#1677ff";
}

function TodoCard({
  item, onView, onDragStart, onDragEnd, isDragging, draggable, didDragRef,
}: {
  item: TodoItem;
  onView: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  draggable?: boolean;
  didDragRef: React.MutableRefObject<boolean>;
}) {
  const isCancelled = item.workflow_state_slug === "cancelled";
  const rawColor = extractCustomColor(item.description);
  const accent = isCancelled ? "#EF4444" : (rawColor || priorityAccent(item.priority || "MEDIUM"));
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
        <span className="kanban-card__type">To-do</span>
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
        <span>{item.due_date ? dayjs(item.due_date).format("DD MMM YYYY") : "No due date"}</span>
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
  col: typeof TODO_BOARD_COLUMNS[number];
  items: TodoItem[];
  draggedItem: TodoItem | null;
  canTransitionGlobally: boolean;
  didDragRef: React.MutableRefObject<boolean>;
  onDragStart: (item: TodoItem) => void;
  onDragEnd: () => void;
  onDrop: (destSlug: string) => void;
  onView: (item: TodoItem) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const canDrop = Boolean(
    draggedItem && canDropOnColumn(draggedItem, col.slug) && canTransitionGlobally && draggedItem.can_transition,
  );

  return (
    <div
      className="kanban-column"
      style={{
        background: isDragOver && canDrop ? `${col.color}14` : "var(--bms-board-column)",
        border: isDragOver && canDrop ? `2px dashed ${col.color}` : "2px solid transparent",
      }}
      onDragOver={(e) => { if (canDrop) { e.preventDefault(); setIsDragOver(true); } }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if (canDrop) onDrop(col.slug); }}
    >
      <div className="kanban-column__head">
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0 }}>{col.label}</span>
        <Tag style={{ margin: 0, borderRadius: 12, flexShrink: 0 }}>{items.length}</Tag>
      </div>

      <KanbanColumnScroll itemCount={items.length}>
        {items.map((item) => (
          <TodoCard
            key={item.id}
            item={item}
            onView={() => onView(item)}
            draggable={canTransitionGlobally && !!item.can_transition}
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

export default function TodosPage() {
  const qc = useQueryClient();
  const permissions = useAuthStore((s) => s.permissions);
  const userId = useAuthStore((s) => s.user?.id);
  const canCreate = permissions.includes(PERMS.CRM_FOLLOWUP_CREATE as never);
  const canUpdate = permissions.includes(PERMS.CRM_FOLLOWUP_UPDATE as never);
  const canDelete = permissions.includes(PERMS.CRM_FOLLOWUP_DELETE as never);
  const canTransition = permissions.includes(PERMS.CRM_FOLLOWUP_TRANSITION as never);
  const canViewAll = permissions.includes(PERMS.CRM_FOLLOWUP_VIEW_ALL as never);

  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [statusFilter, setStatusFilter] = useState("");
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(LIST_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const [detailItem, setDetailItem] = useState<TodoItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<TodoItem | null>(null);
  const didDragRef = useRef(false);
  const [form] = Form.useForm();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const urlId = searchParams.get("id");
    if (urlId) {
      todoApi.retrieve(urlId).then((res) => {
        setDetailItem(res);
        searchParams.delete("id");
        setSearchParams(searchParams, { replace: true });
      }).catch(() => {
        message.error("Could not load to-do from URL");
      });
    }
  }, [searchParams, setSearchParams]);

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
    queryKey: ["todos-board", userId, params],
    queryFn: () => todoApi.board(params),
    enabled: viewMode === "board" && Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["todos-list", userId, listParams],
    queryFn: () => todoApi.list(listParams),
    enabled: viewMode === "list" && Boolean(userId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-dropdown"],
    queryFn: () => get<Array<{ id: string; full_name: string }>>(ENDPOINTS.EMPLOYEES_DROPDOWN),
    staleTime: 60_000,
  });

  const { data: leadsData } = useQuery({
    queryKey: ["leads-dropdown-all"],
    queryFn: () => fetchLeads({}),
    staleTime: 60_000,
  });
  const leads: Lead[] = leadsData?.results ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["todos-board"] });
    qc.invalidateQueries({ queryKey: ["todos-list"] });
    qc.invalidateQueries({ queryKey: ["lead-tasks-all"] });
    qc.invalidateQueries({ queryKey: ["sales-tasks-all"] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-todos"] });
    qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: TodoCreate) => todoApi.create(data),
    onSuccess: () => { message.success("To-do created"); setModalOpen(false); form.resetFields(); invalidate(); },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to create to-do")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TodoCreate> }) => todoApi.update(id, data),
    onSuccess: () => { message.success("To-do updated"); setModalOpen(false); setEditing(null); form.resetFields(); invalidate(); },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to update to-do")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => todoApi.delete(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["todos-board"] });
      const previousData = qc.getQueryData<any>(["todos-board", userId, params]);
      if (previousData?.columns) {
        const newCols: Record<string, TodoItem[]> = {};
        for (const [colSlug, items] of Object.entries(previousData.columns as Record<string, TodoItem[]>)) {
          newCols[colSlug] = items.filter(it => it.id !== id);
        }
        qc.setQueryData(["todos-board", userId, params], {
          ...previousData,
          columns: newCols,
          count: Math.max(0, (previousData.count || 0) - 1),
        });
      }
      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        qc.setQueryData(["todos-board", userId, params], context.previousData);
      }
      message.error("Failed to delete");
    },
    onSuccess: () => {
      message.success("To-do deleted");
      invalidate();
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) => todoApi.transition(id, state),
    onMutate: async ({ id, state }) => {
      await qc.cancelQueries({ queryKey: ["todos-board"] });
      const previousData = qc.getQueryData<any>(["todos-board", userId, params]);
      if (previousData?.columns) {
        const newCols: Record<string, TodoItem[]> = {};
        let moved: TodoItem | null = null;
        for (const [colSlug, items] of Object.entries(previousData.columns as Record<string, TodoItem[]>)) {
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
          qc.setQueryData(["todos-board", userId, params], {
            ...previousData,
            columns: newCols,
          });
        }
      }
      return { previousData };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previousData) {
        qc.setQueryData(["todos-board", userId, params], context.previousData);
      }
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Cannot move to this stage");
    },
    onSuccess: () => invalidate(),
    onSettled: () => setDraggedItem(null),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      priority: "MEDIUM",
      assignees: userId ? [userId] : [],
      lead: undefined,
      color: null,
    });
    setModalOpen(true);
  };

  const openEdit = (item: TodoItem) => {
    setEditing(item);
    const { cleanText, color } = extractCustomColor(item.description);
    form.setFieldsValue({
      title: item.title,
      priority: item.priority || "MEDIUM",
      description: cleanText,
      comments: item.comments,
      color: color,
      lead: item.lead || undefined,
      assignees: item.assignees || (item.assignee ? [item.assignee] : []),
      date_range: [
        item.start_date ? dayjs(item.start_date) : null,
        item.due_date ? dayjs(item.due_date) : null,
      ],
      start_time: parseTime(item.start_time),
      end_time: parseTime(item.end_time),
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const [startDate, endDate] = values.date_range ?? [null, null];

      let finalDescription = values.description || "";
      if (values.color) {
        finalDescription += ` <!--color:${values.color}-->`;
      }

      const selectedLead = leads.find((l) => l.id === values.lead);
      const source = selectedLead
        ? selectedLead.is_converted
          ? "SALES_MANAGEMENT"
          : "LEAD_MANAGEMENT"
        : "WORKSPACE";

      const payload: TodoCreate = {
        title: values.title,
        priority: values.priority || "MEDIUM",
        description: finalDescription,
        comments: values.comments || "",
        assignees: values.assignees || [],
        start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
        due_date: endDate ? endDate.format("YYYY-MM-DD") : null,
        start_time: values.start_time
          ? (typeof values.start_time.format === "function"
              ? values.start_time.format("HH:mm:ss")
              : typeof values.start_time === "string" && values.start_time.trim()
              ? values.start_time.trim()
              : null)
          : null,
        end_time: values.end_time
          ? (typeof values.end_time.format === "function"
              ? values.end_time.format("HH:mm:ss")
              : typeof values.end_time === "string" && values.end_time.trim()
              ? values.end_time.trim()
              : null)
          : null,
        lead: values.lead || undefined,
        source,
      };

      if (editing) {
        const { source: _s, ...updatePayload } = payload;
        updateMutation.mutate({ id: editing.id, data: updatePayload });
      } else {
        createMutation.mutate(payload);
      }
    });
  };

  const handleDone = (item: TodoItem) => {
    transitionMutation.mutate({ id: item.id, state: "done" }, { onSuccess: () => message.success("Marked as done") });
  };

  const handleDrop = (destSlug: string) => {
    if (!draggedItem) return;
    if (!canDropOnColumn(draggedItem, destSlug)) {
      message.warning("This to-do cannot move to that stage");
      setDraggedItem(null);
      return;
    }
    transitionMutation.mutate({ id: draggedItem.id, state: destSlug }, { onSuccess: () => message.success("To-do moved") });
  };

  const isLoading = viewMode === "board" ? boardLoading : listLoading;

  const columns = useMemo(() => {
    const raw = boardData?.columns ?? {};
    const scoped: Record<string, TodoItem[]> = {};
    for (const [slug, items] of Object.entries(raw)) {
      const visible = filterItemsForUser(items, userId);
      if (visible.length > 0) scoped[slug] = visible;
    }
    return scoped;
  }, [boardData?.columns, userId]);

  const listItems = listData?.results ?? [];
  const listTotal = listData?.count ?? 0;

  const listColumns = [
    {
      title: "Title",
      key: "title",
      width: 280,
      render: (_: any, item: TodoItem) => (
        <Text strong style={{ color: "var(--bms-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.title}
        </Text>
      ),
    },
    {
      title: "Priority",
      key: "priority",
      width: 120,
      render: (_: any, item: TodoItem) => (
        <PriorityTag priority={item.priority || "MEDIUM"} label={item.priority_label} size="small" />
      ),
    },
    {
      title: "Stage",
      key: "stage",
      width: 140,
      render: (_: any, item: TodoItem) => (
        <Tag color={item.workflow_state_color || "default"}>
          {item.workflow_state_name}
        </Tag>
      ),
    },
    {
      title: "Assignees",
      key: "assignees",
      width: 180,
      render: (_: any, item: TodoItem) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {(item.assignees_data || []).map(a => a.full_name).join(", ") || "Unassigned"}
        </Text>
      ),
    },
    {
      title: "Due Date",
      key: "duedate",
      width: 220,
      render: (_: any, item: TodoItem) => {
        const timeRange = formatTimeRange(item.start_time, item.end_time);
        return (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {item.due_date ? dayjs(item.due_date).format("DD MMM YYYY") : "No due date"}
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
      render: (_: any, item: TodoItem) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          {canTransition && item.can_transition && item.workflow_state_slug !== "done" && item.workflow_state_slug !== "cancelled" && (
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: "#1e3a8a" }}>To-Do List</Title>
          <Text type="secondary">
            To-dos assigned to you or created by you
          </Text>
        </div>
        <Space wrap>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { value: "board", icon: <AppstoreOutlined />, label: "Board" },
              { value: "list", icon: <UnorderedListOutlined />, label: "List" },
            ]}
          />
          {viewMode === "list" && (
            <Select
              allowClear
              style={{ width: 160 }}
              value={statusFilter || ""}
              onChange={(v) => setStatusFilter(v || "")}
              options={[{ value: "", label: "All Stages" }, ...TODO_BOARD_COLUMNS.map((c) => ({ value: c.slug, label: c.label }))]}
            />
          )}
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add To-Do</Button>
          )}
        </Space>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
      ) : viewMode === "board" ? (
        <KanbanBoardGrid columnCount={TODO_BOARD_COLUMNS.length} boardHeight="calc(100vh - 280px)">
          {TODO_BOARD_COLUMNS.map((col) => (
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
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} to-dos`,
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

      <TodoDetailDrawer
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

      <Modal
        title={editing ? "Edit To-Do" : "Add To-Do"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editing ? "Save changes" : "Create to-do"}
        width={520}
        centered
        destroyOnHidden
        styles={{
          content: { maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column" },
          body: { paddingTop: 8, overflowY: "auto", flex: "1 1 auto" },
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ priority: "MEDIUM", color: "#98b7e2" }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
            <Input placeholder="e.g. Prepare sprint report" size="large" />
          </Form.Item>
          <Form.Item name="lead" label="Related Lead / Opportunity / Client (Optional)">
            <Select
              placeholder="Select a related Lead or Client"
              allowClear
              showSearch
              optionFilterProp="children"
              size="large"
            >
              {leads.map((l) => (
                <Select.Option key={l.id} value={l.id}>
                  {l.is_converted ? "🏢 [Client] " : "🎯 [Lead] "}
                  {l.institution_name}
                  {l.client_name ? ` — ${l.client_name}` : l.company ? ` (${l.company})` : ""}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
            <PriorityPicker />
          </Form.Item>
          <Form.Item
            name="date_range"
            label="Date range"
            rules={[
              { required: true, message: "Date range is required" },
              {
              validator(_, value) {
                const [start, end] = value ?? [null, null];
                if (start && end && end.isBefore(start, "day")) {
                  return Promise.reject(new Error("Due date must be after start date"));
                }
                return Promise.resolve();
              },
            }]}
          >
            <DatePicker.RangePicker
              style={{ width: "100%" }}
              size="large"
              format="DD MMM YYYY"
              placeholder={["Start date", "Due date"]}
              disabledDate={(current) => current && current.isBefore(dayjs(), "day")}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="start_time" label="Start time" rules={[{ required: true, message: "Start time is required" }]}>
                <ClockTimePicker />
              </Form.Item>
            </Col>
            <Col span={12}>
            <Form.Item
              name="end_time"
              label="End time"
              dependencies={["start_time", "date_range"]}
              rules={[
                { required: true, message: "End time is required" },
                ({ getFieldValue }) => ({
                  validator(_, end) {
                    const start = getFieldValue("start_time");
                    const [sDate, eDate] = getFieldValue("date_range") ?? [null, null];
                    if (start && end) {
                      // When both dates are set, compare combined Date+Time objects.
                      if (sDate && eDate) {
                        const sDt = sDate.hour(start.hour()).minute(start.minute()).second(0);
                        const eDt = eDate.hour(end.hour()).minute(end.minute()).second(0);
                        if (eDt.isAfter(sDt)) return Promise.resolve();
                        return Promise.reject(new Error("Enter a valid time range"));
                      }
                      // Fallback: no dates — compare times alone
                      if (!end.isAfter(start)) return Promise.reject(new Error("Enter a valid time range"));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
                <ClockTimePicker />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="assignees" label="Assignees" rules={[{ required: true, message: "Assignees are required" }]}>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  placeholder="Select assignees"
                  size="large"
                  optionFilterProp="label"
                  options={(employees ?? []).map((e) => ({ value: e.id, label: e.full_name }))}
                  tagRender={({ label }) => {
                    const name = String(label);
                    return (
                      <Tooltip title={name}>
                        <span style={{ marginRight: 4, display: "inline-block", verticalAlign: "middle" }}>
                          <AssigneeAvatar name={name} size={24} />
                        </span>
                      </Tooltip>
                    );
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: "Description is required" }]}>
            <TextArea rows={3} placeholder="What needs to be done?" />
          </Form.Item>
          <Form.Item name="comments" label="Comment">
            <TextArea rows={4} placeholder="Detailed comment" />
          </Form.Item>
          <Form.Item name="color" label="Event Color">
            <GoogleColorPicker />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
