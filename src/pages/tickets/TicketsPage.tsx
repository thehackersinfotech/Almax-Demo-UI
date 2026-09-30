import { useState, useMemo, useRef } from "react";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import {
  PriorityIcon, PriorityLabel, TypeIcon, TypeLabel,
  PRIORITY_SELECT_OPTIONS, TYPE_SELECT_OPTIONS,
} from "@/components/tickets/TicketIcons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Tag, Space, Modal, Form, Input, Select, DatePicker,
  InputNumber, Typography, Card, Row, Col, Tooltip,
  Spin, message, Upload, type UploadFile,
} from "antd";
import {
  PlusOutlined, AppstoreOutlined, UnorderedListOutlined,
  SearchOutlined, UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  ticketsApi,
  TICKET_TYPE_LABELS,
  type TicketListItem, type TicketType, type TicketPriority,
} from "@/services/tickets";
import { projectsApi } from "@/services/projects";
import { workflowStateApi, type WorkflowState } from "@/services/workflow";
import { employeeApi } from "@/services/employees";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import RichTextEditor from "@/components/common/RichTextEditor";
import TicketHierarchyTable from "@/components/tickets/TicketHierarchyTable";
import KanbanColumnScroll from "@/components/common/KanbanColumnScroll";
import KanbanBoardGrid from "@/components/common/KanbanBoardGrid";
import "@/components/common/KanbanBoard.css";
import PermGuard from "@/components/common/PermGuard";
import { PERMS } from "@/constants/permissions";
import { apiErrorMsg } from "@/utils/apiError";
import {
  disableTicketDueDate,
  dueDateHelperText,
  estimateHelperText,
  getMaxOriginalEstimate,
  originalEstimateFormRules,
} from "@/utils/ticketProjectConstraints";
import { renderProjectDropdown } from "@/components/common/DropdownRenderers";

dayjs.extend(relativeTime);
const { Title, Text } = Typography;

const ALL_TYPES: TicketType[] = [
  "EPIC", "STORY", "TASK", "SUBTASK", "BUG",
  "CHANGE_REQUEST", "DEPLOYMENT", "DOCUMENT", "MILESTONE",
];

// ── Priority badge (uses shared icon) ─────────────────────────────────────────
function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const labels: Record<TicketPriority, string> = {
    IMMEDIATE: "Immediate", CRITICAL: "Critical",
    HIGH: "High", MEDIUM: "Medium", DEFERRED: "Deferred",
  };
  return (
    <Tooltip title={labels[priority] ?? priority}>
      <span style={{ display: "inline-flex", cursor: "default" }}>
        <PriorityIcon priority={priority} />
      </span>
    </Tooltip>
  );
}

// ── Kanban card ────────────────────────────────────────────────────────────────
function KanbanCard({ ticket, accentColor, onClick, onDragStart, onDragEnd, isDragging, didDragRef }: {
  ticket: TicketListItem;
  accentColor: string;
  onClick: () => void;
  onDragStart: (t: TicketListItem) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  didDragRef: React.MutableRefObject<boolean>;
}) {
  const isOverdue = ticket.due_date && dayjs(ticket.due_date).isBefore(dayjs(), "day");
  const user = useAuthStore((s) => s.user);
  const isReporterOrPrivileged = !!(
    user?.is_superuser ||
    user?.is_staff ||
    user?.is_pmo ||
    user?.is_manager ||
    user?.keycloak_group === "Admin" ||
    (ticket.reporter && String(ticket.reporter) === String(user?.id))
  );
  const isAssignee = !!(ticket.assignee && String(ticket.assignee) === String(user?.id));
  const canTransition = !!(isReporterOrPrivileged || isAssignee);

  return (
    <div
      draggable={canTransition}
      role="button"
      tabIndex={0}
      className={[
        "kanban-card",
        canTransition ? "kanban-card--draggable" : "",
        isDragging ? "kanban-card--dragging" : "",
      ].filter(Boolean).join(" ")}
      style={{ ["--card-accent" as string]: accentColor }}
      onClick={() => {
        if (didDragRef.current) return;
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onDragStart={(e) => {
        if (!canTransition) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        didDragRef.current = true;
        onDragStart(ticket);
      }}
      onDragEnd={onDragEnd}
    >
      <span className="kanban-card__accent" style={{ background: accentColor }} aria-hidden />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
          <TypeIcon type={ticket.type} size={12} />
          {TICKET_TYPE_LABELS[ticket.type]}
        </span>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <Text style={{ fontSize: 13, fontWeight: 500, display: "block", lineHeight: 1.4, marginBottom: 10, color: "var(--bms-text, #111827)" }}>
        {ticket.title}
      </Text>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <code style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>{ticket.ticket_id}</code>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {ticket.due_date && (
            <span style={{ fontSize: 10, color: isOverdue ? "#ef4444" : "#9ca3af" }}>
              {dayjs(ticket.due_date).format("DD MMM")}
            </span>
          )}
          {ticket.assignee_name && (
            <Tooltip title={ticket.assignee_name}>
              <span><AssigneeAvatar name={ticket.assignee_name} size={20} /></span>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kanban column ──────────────────────────────────────────────────────────────
function KanbanColumn({ state, tickets, onCardClick, onCreateHere,
  onDragStart, onDragEnd, onDrop, draggedTicket, didDragRef }: {
  state: WorkflowState;
  tickets: TicketListItem[];
  onCardClick: (t: TicketListItem) => void;
  onCreateHere: () => void;
  onDragStart: (t: TicketListItem) => void;
  onDragEnd: () => void;
  onDrop: (stateSlug: string) => void;
  draggedTicket: TicketListItem | null;
  didDragRef: React.MutableRefObject<boolean>;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const isFinal = state.is_final;
  const dotColor = state.color_code || "#9ca3af";
  const canDrop = draggedTicket && draggedTicket.workflow_state_slug !== state.slug;

  return (
    <div
      className="kanban-column"
      style={{
        background: isDragOver && canDrop ? `${dotColor}12` : "var(--bms-board-column, #f4f5f7)",
        border: isDragOver && canDrop ? `2px dashed ${dotColor}` : "2px solid transparent",
      }}
      onDragOver={(e) => { if (canDrop) { e.preventDefault(); setIsDragOver(true); } }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (canDrop) onDrop(state.slug);
      }}
    >
      <div className="kanban-column__head" style={{ borderBottom: `2px solid ${dotColor}`, paddingBottom: 10 }}>
        <span style={{
          width: 9, height: 9, borderRadius: "50%",
          background: dotColor, flexShrink: 0,
          boxShadow: `0 0 0 2px ${dotColor}33`,
        }} />
        <Text strong ellipsis style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{state.name}</Text>
        <Tag style={{ margin: 0, borderRadius: 10, fontWeight: 600, flexShrink: 0 }}>{tickets.length}</Tag>
      </div>

      <KanbanColumnScroll itemCount={tickets.length}>
        {tickets.map((t) => (
          <KanbanCard
            key={t.id}
            ticket={t}
            accentColor={t.workflow_state_color || dotColor}
            onClick={() => onCardClick(t)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggedTicket?.id === t.id}
            didDragRef={didDragRef}
          />
        ))}

        {isDragOver && canDrop && (
          <div className="kanban-column__drop-hint" style={{ color: dotColor, border: `2px dashed ${dotColor}`, background: `${dotColor}08` }}>
            Drop to move here
          </div>
        )}

        {tickets.length === 0 && !isDragOver && (
          <div className="kanban-column__empty">No tickets</div>
        )}
      </KanbanColumnScroll>

      {!isFinal && (
        <div className="kanban-column__footer">
          <Button
            type="text" size="small" block
            style={{ color: "#9ca3af", fontSize: 12, textAlign: "left" }}
            onClick={onCreateHere}
          >
            + Add ticket
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Create Ticket Modal ────────────────────────────────────────────────────────
export function CreateTicketModal({ open, onClose, defaultProjectId, parentId, defaultType }: {
  open: boolean; onClose: () => void; defaultProjectId?: string; parentId?: string; defaultType?: TicketType;
}) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isDark = useThemeStore((s) => s.isDark);
  const [selectedProject, setSelectedProject] = useState<string>(defaultProjectId ?? "");
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // Minimal project dropdown — id/name/code only
  const { data: projects = [] } = useQuery({
    queryKey: ["dd", "projects-dropdown-minimal"],
    queryFn: () => projectsApi.dropdown(),
    enabled: open,
    staleTime: 60_000,
  });

  // Project bounds for due date / estimate validation
  const { data: projectDetail } = useQuery({
    queryKey: ["project", selectedProject],
    queryFn: () => projectsApi.get(selectedProject),
    enabled: open && !!selectedProject,
    staleTime: 60_000,
  });

  const maxEstimate = getMaxOriginalEstimate(projectDetail);

  // Allocated employees for selected project only
  const { data: allocatedEmployees = [], isFetching: empLoading } = useQuery({
    queryKey: ["dd", "project-allocated-employees", selectedProject],
    queryFn: () => projectsApi.allocatedEmployees(selectedProject),
    enabled: open && !!selectedProject,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: ticketsApi.create,
    onSuccess: async (newTicket) => {
      if (fileList.length > 0) {
        for (const fileObj of fileList) {
          if (fileObj.originFileObj) {
            try {
              await ticketsApi.uploadAttachment(newTicket.id, fileObj.originFileObj);
            } catch (err) {
              console.error("Failed to upload attachment", fileObj.name, err);
            }
          }
        }
      }
      message.success("Ticket created");
      qc.invalidateQueries({ queryKey: ["tickets"] });
      if (parentId) {
        qc.invalidateQueries({ queryKey: ["ticket-children", parentId] });
        qc.invalidateQueries({ queryKey: ["ticket", parentId] });
      }
      onClose();
      form.resetFields();
      setFileList([]);
      setSelectedProject(defaultProjectId ?? "");
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Failed to create ticket")),
  });

  const toEmpOptions = (arr: any[]) => arr.map((e: any) => ({
    value: e.id,
    label: (
      <Space size={6}>
        <AssigneeAvatar name={e.full_name ?? "?"} size={18} />
        <span>{e.full_name}</span>
        {e.designation && <span style={{ color: "#9ca3af", fontSize: 11 }}>({e.designation})</span>}
      </Space>
    ),
    searchLabel: e.full_name,
  }));

  const handleProjectChange = (val: string) => {
    setSelectedProject(val);
    form.setFieldsValue({
      assignee: undefined,
      notify_users: [],
      due_date: undefined,
      original_estimate: undefined,
    });
  };

  return (
    <Modal
      title={<span><PlusOutlined style={{ marginRight: 6, color: "#1677ff" }} />Create Ticket</span>}
      open={open}
      onCancel={() => { onClose(); form.resetFields(); setSelectedProject(defaultProjectId ?? ""); setFileList([]); }}
      onOk={() => form.submit()}
      confirmLoading={createMut.isPending}
      width={720}
      destroyOnHidden
      afterOpenChange={(vis) => {
        if (vis) {
          if (defaultProjectId) {
            form.setFieldValue("project", defaultProjectId);
            setSelectedProject(defaultProjectId);
          }
          if (defaultType) {
            form.setFieldValue("type", defaultType);
          }
        }
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: defaultType || "TASK", priority: "MEDIUM" }}
        onFinish={(v) => createMut.mutate({
          ...v,
          due_date: v.due_date ? dayjs(v.due_date).format("YYYY-MM-DD") : null,
          ...(parentId ? { parent: parentId } : {}),
        })}
      >
        <Form.Item name="project" label="Project" rules={[{ required: true }]}>
          <Select
            showSearch
            placeholder="Select project"
            disabled={!!parentId}
            onChange={handleProjectChange}
            popupRender={renderProjectDropdown}
            filterOption={(input, opt) =>
              (opt?.searchLabel as string ?? "").toLowerCase().includes(input.toLowerCase())
            }
            options={projects
              .filter((p) => {
                if (p.id === selectedProject) return true;
                const slug = ((p as any).workflow_state_slug || "").toLowerCase();
                return !(slug.includes("close") || slug.includes("done") || slug.includes("cancel") || slug.includes("resolve"));
              })
              .map((p) => ({
              value: p.id,
              label: (
                <Space size={6}>
                  <code style={{ fontSize: 11, color: "#4f46e5", background: "#eff0ff", padding: "1px 5px", borderRadius: 4 }}>
                    {p.code}
                  </code>
                  <span>{p.name}</span>
                </Space>
              ),
              searchLabel: `${p.code} ${p.name}`,
            }))}
          />
        </Form.Item>

        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input placeholder="Short, descriptive title" size="large" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select
                options={TYPE_SELECT_OPTIONS}
                optionRender={(opt) => <TypeLabel type={opt.value as TicketType} />}
                labelRender={(opt) => opt.value ? <TypeLabel type={opt.value as TicketType} /> : null}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="priority" label="Priority">
              <Select
                options={PRIORITY_SELECT_OPTIONS}
                optionRender={(opt) => <PriorityLabel priority={opt.value as TicketPriority} />}
                labelRender={(opt) => opt.value ? <PriorityLabel priority={opt.value as TicketPriority} /> : null}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="Description">
          <RichTextEditor placeholder="Describe the ticket..." minHeight={140} />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="assignee" label={
              <Space size={4}>
                <span>Assignee</span>
                {!selectedProject && <Text type="secondary" style={{ fontSize: 11 }}>(select project first)</Text>}
              </Space>
            }>
              <Select
                showSearch
                placeholder={selectedProject ? "Assign to…" : "Select project first"}
                disabled={!selectedProject}
                loading={empLoading}
                options={toEmpOptions(allocatedEmployees)}
                filterOption={(i, o) => (o?.searchLabel as string)?.toLowerCase().includes(i.toLowerCase())}
                allowClear
                notFoundContent={
                  selectedProject
                    ? <span style={{ fontSize: 12, color: "#9ca3af" }}>No active allocations on this project</span>
                    : null
                }
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Reporter">
              <div style={{
                padding: "5px 11px", borderRadius: 6,
                background: isDark ? "#1f293d" : "#f5f5f5",
                border: isDark ? "1px solid #304156" : "1px solid #d9d9d9",
                color: isDark ? "#e2e8f0" : "#1f2937",
                fontSize: 14, minHeight: 32,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {projectDetail?.manager_name ? (
                  <>
                    <AssigneeAvatar name={projectDetail.manager_name} size={20} />
                    <span>{projectDetail.manager_name}</span>
                    <Tag style={{ marginLeft: "auto", fontSize: 10 }} color="blue">Project Manager</Tag>
                  </>
                ) : (
                  <>
                    <AssigneeAvatar name={currentUser?.full_name || currentUser?.username || "?"} size={20} />
                    <span>{currentUser?.full_name || currentUser?.username || "You"}</span>
                    <Tag style={{ marginLeft: "auto", fontSize: 10 }} color="default">Auto</Tag>
                  </>
                )}
              </div>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="original_estimate"
              label="Original Estimate (hours)"
              rules={originalEstimateFormRules(projectDetail)}
              extra={estimateHelperText(projectDetail)}
            >
              <Space.Compact style={{ width: "100%" }}>
                <InputNumber
                  min={0}
                  max={maxEstimate}
                  step={0.5}
                  style={{ width: "100%" }}
                  disabled={!selectedProject}
                />
                <Button size="small" disabled style={{ color: "var(--bms-text-3)", pointerEvents: "none", height: 32 }}>h</Button>
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="due_date"
              label="Due Date"
              extra={dueDateHelperText(projectDetail)}
            >
              <DatePicker
                style={{ width: "100%" }}
                format="DD MMM YYYY"
                disabled={!selectedProject}
                disabledDate={(current) => disableTicketDueDate(current, projectDetail)}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="notify_users" label={
          <Space size={4}>
            <span>Notify Users</span>
            {!selectedProject && <Text type="secondary" style={{ fontSize: 11 }}>(select project first)</Text>}
          </Space>
        }>
          <Select
            mode="multiple"
            showSearch
            placeholder={selectedProject ? "Select users to notify…" : "Select project first"}
            disabled={!selectedProject}
            loading={empLoading}
            options={toEmpOptions(allocatedEmployees)}
            filterOption={(i, o) => (o?.searchLabel as string)?.toLowerCase().includes(i.toLowerCase())}
            maxTagCount="responsive"
            allowClear
            style={{ width: "100%" }}
            notFoundContent={
              selectedProject
                ? <span style={{ fontSize: 12, color: "#9ca3af" }}>No active allocations on this project</span>
                : null
            }
          />
        </Form.Item>

        <Form.Item label="Supporting Attachments / Files">
          <Upload
            fileList={fileList}
            beforeUpload={() => false}
            multiple
            onChange={({ fileList: fl }) => setFileList(fl)}
          >
            <Button icon={<UploadOutlined />}>Choose Files</Button>
          </Upload>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
            Upload supporting documents, logs or screenshots for developers.
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Main Tickets Page ──────────────────────────────────────────────────────────
export default function TicketsPage({ projectId }: { projectId?: string }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const [view, setView] = useState<"list" | "board">((searchParams.get("view") as "list" | "board") || "list");
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [typeFilter, setTypeFilter] = useState<string[]>(searchParams.get("type") ? searchParams.get("type")!.split(",") : []);
  const [priorityFilter, setPriorityFilter] = useState<string[]>(searchParams.get("priority") ? searchParams.get("priority")!.split(",") : []);
  const [statusFilter, setStatusFilter] = useState<string[]>(searchParams.get("status") ? searchParams.get("status")!.split(",") : []);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>(searchParams.get("assignee") ? searchParams.get("assignee")!.split(",") : []);
  const [employeeNameFilter, setEmployeeNameFilter] = useState<string>(searchParams.get("employee_name") || "");
  const [selectedProject, setSelectedProject] = useState<string>(projectId ?? (searchParams.get("project") || ""));
  const [draggedTicket, setDraggedTicket] = useState<TicketListItem | null>(null);
  const didDragRef = useRef(false);

  // Sync state to URL search parameters without full reload
  const updateUrlParams = (updates: Record<string, any>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "")) {
          next.set(k, Array.isArray(v) ? v.join(",") : String(v));
        } else {
          next.delete(k);
        }
      });
      return next;
    }, { replace: true });
  };

  const transitionMut = useMutation({
    mutationFn: ({ ticketId, destSlug }: { ticketId: string; destSlug: string }) =>
      ticketsApi.transition(ticketId, destSlug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      message.success("Ticket status updated");
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Cannot move ticket — check permissions")),
  });

  const queryParams: Record<string, any> = {
    page_size: 200,
    ...(selectedProject ? { project: selectedProject } : {}),
    ...(typeFilter.length ? { type: typeFilter.join(",") } : {}),
    ...(priorityFilter.length ? { priority: priorityFilter.join(",") } : {}),
    ...(statusFilter.length ? { workflow_state: statusFilter.join(",") } : {}),
    ...(assigneeFilter.length ? { assignee: assigneeFilter.join(",") } : {}),
    ...(employeeNameFilter.trim() ? { employee_name: employeeNameFilter.trim() } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", queryParams],
    queryFn: () => ticketsApi.list(queryParams),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["dd", "projects-dropdown-minimal"],
    queryFn: () => projectsApi.dropdown(),
    staleTime: 60_000,
  });

  // Fetch all ticket workflow states for Kanban columns + Status filter options
  const { data: workflowStates = [] } = useQuery({
    queryKey: ["ticket-workflow-states"],
    queryFn: () => workflowStateApi.list("tickets", "ticket"),
    staleTime: 300_000,
  });

  // Permission-free employee dropdown for the Assignee filter
  const { data: employees = [] } = useQuery({
    queryKey: ["dd", "employees-dropdown-minimal"],
    queryFn: () => employeeApi.dropdown(),
    staleTime: 60_000,
  });

  const tickets: TicketListItem[] = useMemo(() => {
    const all = (data as any)?.results ?? [];
    if (!search) return all;
    const lower = search.toLowerCase();
    return all.filter((t: TicketListItem) =>
      t.ticket_id.toLowerCase().includes(lower) ||
      t.title.toLowerCase().includes(lower)
    );
  }, [data, search]);

  // Map tickets into workflow state columns (all states shown even if empty)
  const kanbanColumns = useMemo(() => {
    const ticketsByState = new Map<string, TicketListItem[]>();
    tickets.forEach((t) => {
      const key = t.workflow_state_slug || "__none__";
      if (!ticketsByState.has(key)) ticketsByState.set(key, []);
      ticketsByState.get(key)!.push(t);
    });
    return (workflowStates as WorkflowState[])
      .sort((a, b) => a.order - b.order)
      .map((state) => ({
        state,
        tickets: ticketsByState.get(state.slug) ?? [],
      }));
  }, [workflowStates, tickets]);

  return (
    <div>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Tickets</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {(data as any)?.count ?? 0} total
          </Text>
        </Col>
        <Col>
          <Space>
            <div style={{
              display: "inline-flex", border: "1px solid #e5e7eb",
              borderRadius: 8, overflow: "hidden",
            }}>
              {([
                { key: "board", icon: <AppstoreOutlined />, label: "Board" },
                { key: "list",  icon: <UnorderedListOutlined />, label: "List"  },
              ] as const).map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 14px", border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: view === key ? 600 : 400,
                    background: view === key ? "var(--bms-primary)" : "var(--bms-surface)",
                    color: view === key ? "#fff" : "var(--bms-text)",
                    transition: "background 0.15s, color 0.15s",
                    borderRight: key === "board" ? "1px solid var(--bms-border)" : "none",
                  }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
            <PermGuard permission={PERMS.PROJECT_TICKET_CREATE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                Create Ticket
              </Button>
            </PermGuard>
          </Space>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
        <Row gutter={12} align="middle">
          <Col flex="200px">
            <Input
              prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                updateUrlParams({ search: val });
              }}
              allowClear
            />
          </Col>
          {!projectId && (
            <Col flex="220px">
              <Select
                placeholder="All Projects"
                value={selectedProject || undefined}
                onChange={(v) => {
                  const val = v ?? "";
                  setSelectedProject(val);
                  updateUrlParams({ project: val });
                }}
                allowClear
                showSearch
                style={{ width: "100%" }}
                options={(projects as any[]).map((p: any) => ({
                  value: p.id, label: `${p.code} — ${p.name}`,
                }))}
                filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
              />
            </Col>
          )}
          <Col>
            <Select
              mode="multiple"
              placeholder="All Types"
              value={typeFilter}
              onChange={(vals) => {
                setTypeFilter(vals);
                updateUrlParams({ type: vals });
              }}
              allowClear
              maxTagCount="responsive"
              style={{ width: 180 }}
              options={ALL_TYPES.map((t) => ({
                value: t,
                label: <TypeLabel type={t} />,
              }))}
            />
          </Col>
          <Col>
            <Select
              mode="multiple"
              placeholder="All Status"
              value={statusFilter}
              onChange={(vals) => {
                setStatusFilter(vals);
                updateUrlParams({ status: vals });
              }}
              allowClear
              maxTagCount="responsive"
              style={{ width: 180 }}
              options={(workflowStates as WorkflowState[]).map((s) => ({
                value: s.slug,
                label: s.name,
              }))}
            />
          </Col>
          <Col>
            <Select
              mode="multiple"
              placeholder="All Priorities"
              value={priorityFilter}
              onChange={(vals) => {
                setPriorityFilter(vals);
                updateUrlParams({ priority: vals });
              }}
              allowClear
              maxTagCount="responsive"
              style={{ width: 180 }}
              options={PRIORITY_SELECT_OPTIONS}
            />
          </Col>
          <Col>
            <Select
              mode="multiple"
              placeholder="All Assignees"
              value={assigneeFilter}
              onChange={(vals) => {
                setAssigneeFilter(vals);
                updateUrlParams({ assignee: vals });
              }}
              allowClear
              showSearch
              maxTagCount="responsive"
              style={{ width: 200 }}
              options={(employees as any[]).map((e: any) => ({
                value: e.id,
                label: e.full_name,
              }))}
              filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
            />
          </Col>
          <Col>
            <Input
              prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
              placeholder="Employee name…"
              value={employeeNameFilter}
              onChange={(e) => {
                const val = e.target.value;
                setEmployeeNameFilter(val);
                updateUrlParams({ employee_name: val });
              }}
              allowClear
              style={{ width: 180 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: "center", paddingTop: 60 }}><Spin size="large" /></div>
      ) : view === "list" ? (
        <TicketHierarchyTable tickets={tickets} search={search} />
      ) : (
        <KanbanBoardGrid
          columnCount={kanbanColumns.length || 1}
          boardHeight="calc(100vh - 280px)"
        >
          {kanbanColumns.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", paddingTop: 60, color: "#9ca3af" }}>
              No workflow states configured. Go to Master → Workflow to set up ticket states.
            </div>
          ) : (
            kanbanColumns.map(({ state, tickets: colTickets }) => (
              <KanbanColumn
                key={state.id}
                state={state}
                tickets={colTickets}
                onCardClick={(t) => navigate(`/tickets/${t.id}`)}
                onCreateHere={() => setCreateOpen(true)}
                draggedTicket={draggedTicket}
                didDragRef={didDragRef}
                onDragStart={(t) => setDraggedTicket(t)}
                onDragEnd={() => {
                  setDraggedTicket(null);
                  window.setTimeout(() => { didDragRef.current = false; }, 0);
                }}
                onDrop={(destSlug) => {
                  if (!draggedTicket) return;
                  transitionMut.mutate({ ticketId: draggedTicket.id, destSlug });
                  setDraggedTicket(null);
                }}
              />
            ))
          )}
        </KanbanBoardGrid>
      )}

      <CreateTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultProjectId={selectedProject || projectId}
      />
    </div>
  );
}
