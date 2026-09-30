import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tag, Typography, Button, Spin, Space, Empty,
  Select, Avatar, Tooltip, Input, Upload, message,
  DatePicker, InputNumber, Switch, Tabs, Modal, Progress,
  Mentions, Dropdown, Image,
} from "antd";
import {
  ArrowLeftOutlined, EditOutlined, PaperClipOutlined, SendOutlined,
  DeleteOutlined, UserOutlined, PlusOutlined,
  CalendarOutlined, ClockCircleOutlined, FlagOutlined, LinkOutlined, DownloadOutlined,
  CheckCircleOutlined, ArrowRightOutlined, EyeOutlined, DownOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  ticketsApi,
  TICKET_TYPE_LABELS, PRIORITY_ICONS,
  type TicketDetail, type TicketComment, type TicketHistoryEntry,
  type TicketType, type TicketPriority,
} from "@/services/tickets";
import { employeeApi } from "@/services/employees";
import RichTextEditor from "@/components/common/RichTextEditor";
import {
  PriorityIcon, PriorityLabel, TypeIcon,
  PRIORITY_SELECT_OPTIONS,
} from "@/components/tickets/TicketIcons";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import { workflowStateApi, type WorkflowState } from "@/services/workflow";
import PermGuard from "@/components/common/PermGuard";
import { useAuthStore } from "@/store/auth";
import { PERMS } from "@/constants/permissions";
import { apiErrorMsg } from "@/utils/apiError";
import { projectsApi } from "@/services/projects";
import { CreateTicketModal } from "./TicketsPage";
import {
  disableTicketDueDate,
  getMaxOriginalEstimate,
} from "@/utils/ticketProjectConstraints";
import "./TicketDetailPage.css";

dayjs.extend(relativeTime);
const { Title, Text } = Typography;
const { TextArea } = Input;

const ALLOWED_CHILD_TYPES: Record<TicketType, TicketType[]> = {
  EPIC: ["STORY", "TASK", "SUBTASK", "BUG", "CHANGE_REQUEST"],
  STORY: ["TASK", "SUBTASK", "BUG", "CHANGE_REQUEST"],
  TASK: ["SUBTASK", "BUG", "CHANGE_REQUEST"],
  SUBTASK: ["BUG", "CHANGE_REQUEST"],
  BUG: ["CHANGE_REQUEST"],
  CHANGE_REQUEST: [],
  DEPLOYMENT: [],
  DOCUMENT: [],
  MILESTONE: [],
};

// ── Status transition dropdown ─────────────────────────────────────────────────
function StatusTransition({ ticket, onTransitioned }: {
  ticket: TicketDetail; onTransitioned: () => void;
}) {
  const qc = useQueryClient();
  const transMut = useMutation({
    mutationFn: ({ dest, comments }: { dest: string; comments?: string }) =>
      ticketsApi.transition(ticket.id, dest, comments),
    onSuccess: () => {
      message.success("Status updated");
      qc.invalidateQueries({ queryKey: ["ticket", ticket.id] });
      onTransitioned();
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Transition failed")),
  });

  const lozengeColor = ticket.workflow_state_color || "#dfe1e6";
  const lozengeText  = ticket.workflow_state_color || "#42526e";

  const user = useAuthStore((s) => s.user);
  const isReporterOrPrivileged = !!(
    user?.is_superuser ||
    user?.is_staff ||
    user?.is_pmo ||
    user?.is_manager ||
    user?.keycloak_group === "Admin" ||
    (ticket.reporter && String(ticket.reporter) === String(user?.id)) ||
    (ticket.project_manager_id && String(ticket.project_manager_id) === String(user?.id))
  );
  const isAssignee = ticket.assignee && String(ticket.assignee) === String(user?.id);
  const canTransition = isReporterOrPrivileged || !!isAssignee;

  if (!canTransition || !ticket.available_states?.length) {
    return (
      <span
        className="jira-status-lozenge"
        style={{ background: `${lozengeColor}33`, color: lozengeText }}
      >
        <span className="jira-status-lozenge__dot" style={{ background: lozengeColor }} />
        {ticket.workflow_state_name || "No Status"}
      </span>
    );
  }

  return (
    <PermGuard permission={PERMS.PROJECT_TICKET_TRANSITION} fallback={
      <span
        className="jira-status-lozenge"
        style={{ background: `${lozengeColor}33`, color: lozengeText }}
      >
        <span className="jira-status-lozenge__dot" style={{ background: lozengeColor }} />
        {ticket.workflow_state_name || "No Status"}
      </span>
    }>
      <Select
        className="jira-status-select"
        value={ticket.workflow_state || undefined}
        onChange={(val) => {
          const state = ticket.available_states.find((s) => s.id === val || s.slug === val);
          if (state) transMut.mutate({ dest: state.slug });
        }}
        loading={transMut.isPending}
        style={{ minWidth: 140 }}
        placeholder="Set status"
        options={[
          {
            label: <span style={{ fontSize: 11, color: "#9ca3af" }}>CURRENT</span>,
            options: ticket.workflow_state_name ? [{
              value: ticket.workflow_state,
              label: (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ticket.workflow_state_color || "#9ca3af" }} />
                  {ticket.workflow_state_name}
                </span>
              ),
              disabled: true,
            }] : [],
          },
          {
            label: <span style={{ fontSize: 11, color: "#9ca3af" }}>TRANSITION TO</span>,
            options: ticket.available_states.map((s) => ({
              value: s.slug,
              label: (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color || "#9ca3af" }} />
                  {s.name}
                </span>
              ),
            })),
          },
        ]}
      />
    </PermGuard>
  );
}

// ── Inline field editor ────────────────────────────────────────────────────────
function FieldRow({ label, icon, children }: {
  label: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="jira-field">
      <div className="jira-field__label">
        <span className="jira-field__label-icon">{icon}</span>
        {label}
      </div>
      <div className="jira-field__value">{children}</div>
    </div>
  );
}

// ── Comment item ───────────────────────────────────────────────────────────────
function CommentItem({ comment, ticketId, onDelete }: {
  comment: TicketComment; ticketId: string; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const qc = useQueryClient();

  const editMut = useMutation({
    mutationFn: (body: string) => ticketsApi.updateComment(ticketId, comment.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
      setEditing(false);
    },
    onError: (e: any) => message.error(apiErrorMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => ticketsApi.deleteComment(ticketId, comment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
      onDelete();
    },
  });

  return (
    <div className="jira-comment">
      <Avatar
        size={32}
        className="jira-comment__avatar"
        src={comment.author_avatar ?? undefined}
        icon={<UserOutlined />}
      >
        {comment.author_name?.charAt(0)}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="jira-comment__header">
          <Space size={6}>
            <span className="jira-comment__author">{comment.author_name || "Unknown"}</span>
            {comment.is_edited && <Text type="secondary" style={{ fontSize: 11 }}>(edited)</Text>}
            <Tooltip title={dayjs(comment.created_at).format("DD MMM YYYY, hh:mm A")}>
              <span className="jira-comment__time">{dayjs(comment.created_at).fromNow()}</span>
            </Tooltip>
          </Space>
          <Space size={0}>
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { setEditing(true); setEditBody(comment.body); }} />
            <Button size="small" type="text" danger icon={<DeleteOutlined />} loading={deleteMut.isPending}
              onClick={() => Modal.confirm({
                title: "Delete comment?",
                onOk: () => deleteMut.mutateAsync(),
              })} />
          </Space>
        </div>
        {editing ? (
          <div style={{ marginTop: 8 }}>
            <TextArea rows={3} className="jira-comment-compose__input" value={editBody} onChange={(e) => setEditBody(e.target.value)} />
            <Space style={{ marginTop: 8 }}>
              <Button size="small" type="primary" loading={editMut.isPending}
                onClick={() => editMut.mutate(editBody)}>Save</Button>
              <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
            </Space>
          </div>
        ) : (
          <div className="jira-comment__body">{comment.body}</div>
        )}
      </div>
    </div>
  );
}

// ── History entry ──────────────────────────────────────────────────────────────
function historyActionMeta(action: string) {
  if (action === "create") return { label: "Created", tone: "create" as const };
  if (action === "transition") return { label: "Transitioned", tone: "transition" as const };
  return { label: "Updated", tone: "update" as const };
}

function historyInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function HistoryItem({ entry }: { entry: TicketHistoryEntry }) {
  const changeKeys = Object.keys(entry.changes ?? {});
  const { label: actionLabel, tone } = historyActionMeta(entry.action);
  const isCreate = entry.action === "create";

  return (
    <article className={`jira-history-entry${isCreate ? " jira-history-entry--create" : ""}`}>
      <div className="jira-history-entry__timeline">
        <Avatar size={32} className="jira-history-entry__avatar">
          {historyInitials(entry.changed_by_name) || <UserOutlined />}
        </Avatar>
      </div>
      <div className="jira-history-entry__body">
        <header className="jira-history-entry__head">
          <div className="jira-history-entry__meta">
            <span className="jira-history-entry__author">{entry.changed_by_name}</span>
            <span className={`jira-history__badge jira-history__badge--${tone}`}>{actionLabel}</span>
          </div>
          <Tooltip title={dayjs(entry.changed_at).format("DD MMM YYYY, hh:mm A")}>
            <time className="jira-history-entry__time" dateTime={entry.changed_at}>
              {dayjs(entry.changed_at).fromNow()}
            </time>
          </Tooltip>
        </header>

        {entry.comments && (
          <p className="jira-history-entry__note">&ldquo;{entry.comments}&rdquo;</p>
        )}

        {changeKeys.length > 0 && (
          <div className="jira-history-entry__changes">
            {changeKeys.map((field) => {
              const { old: oldVal, new: newVal } = entry.changes[field];
              return (
                <div key={field} className="jira-history-entry__change">
                  <span className="jira-history-entry__field">{field}</span>
                  <div className="jira-history-entry__values">
                    {isCreate ? (
                      <span className="jira-history-pill jira-history-pill--set">{newVal ?? "—"}</span>
                    ) : (
                      <>
                        <span className="jira-history-pill jira-history-pill--old">{oldVal ?? "—"}</span>
                        <ArrowRightOutlined className="jira-history-entry__arrow" aria-hidden />
                        <span className="jira-history-pill jira-history-pill--new">{newVal ?? "—"}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Main Detail Page ───────────────────────────────────────────────────────────
export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isManagerOrAdmin = !!(user?.is_pmo || user?.is_manager || user?.is_superuser || user?.is_staff || user?.keycloak_group === "Admin");
  const qc = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);
  const [createChildModalOpen, setCreateChildModalOpen] = useState(false);
  const [createChildDefaultType, setCreateChildDefaultType] = useState<TicketType | undefined>(undefined);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => ticketsApi.retrieve(id!),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["ticket-comments", id],
    queryFn: () => ticketsApi.getComments(id!),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["ticket-history", id],
    queryFn: () => ticketsApi.getHistory(id!),
    enabled: !!id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["dd", "employees-simple"],
    queryFn: () => employeeApi.simpleDropdown(),
    staleTime: 60_000,
  });

  const { data: allTickets = [] } = useQuery({
    queryKey: ["tickets-dropdown", ticket?.project],
    queryFn: () => ticketsApi.list({ project: ticket?.project, page_size: 200 }),
    select: (d: any) => d.results ?? [],
    enabled: !!ticket?.project,
  });

  const { data: projectDetail } = useQuery({
    queryKey: ["project", ticket?.project],
    queryFn: () => projectsApi.get(ticket!.project),
    enabled: !!ticket?.project,
    staleTime: 60_000,
  });

  const maxEstimate = getMaxOriginalEstimate(projectDetail);

  const updateMut = useMutation({
    mutationFn: (data: any) => ticketsApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setEditingTitle(false);
      setEditingDesc(false);
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Update failed")),
  });

  const verifyMut = useMutation({
    mutationFn: () => ticketsApi.verify(id!),
    onSuccess: (res) => {
      message.success(res.message || "Ticket verified successfully");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket-history", id] });
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Verification failed")),
  });

  const commentMut = useMutation({
    mutationFn: ({ body, mentionedUserIds }: { body: string; mentionedUserIds?: string[] }) =>
      ticketsApi.addComment(id!, body, mentionedUserIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-comments", id] });
      setCommentBody("");
      setSelectedMentionIds([]);
    },
    onError: (e: any) => message.error(apiErrorMsg(e)),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => ticketsApi.uploadAttachment(id!, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      message.success("Attachment uploaded");
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Upload failed")),
  });

  const deleteAttachMut = useMutation({
    mutationFn: (attachId: string) => ticketsApi.deleteAttachment(id!, attachId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      message.success("Attachment removed");
    },
  });

  const toEmpOptions = (arr: any[]) => arr.map((e: any) => ({ value: e.id, label: e.full_name }));

  const getAssigneeOptions = () => {
    const opts = toEmpOptions(employees as any[]);
    if (ticket?.assignee && !opts.some((o) => String(o.value) === String(ticket.assignee))) {
      opts.push({
        value: ticket.assignee,
        label: ticket.assignee_name || "Unknown Assignee",
      });
    }
    return opts;
  };

  const getNotifyOptions = () => {
    const opts = toEmpOptions(employees as any[]);
    if (ticket?.notify_users_info) {
      ticket.notify_users_info.forEach((u: any) => {
        if (!opts.some((o) => String(o.value) === String(u.id))) {
          opts.push({
            value: u.id,
            label: u.name || "Unknown User",
          });
        }
      });
    }
    return opts;
  };

  const getAncestors = (parentId: string | null): any[] => {
    if (!parentId) return [];
    const p = (allTickets as any[]).find((t: any) => t.id === parentId);
    if (!p) return [];
    return [...getAncestors(p.parent), p];
  };
  const ancestors = ticket?.parent ? getAncestors(ticket.parent) : [];

  const buildHierarchy = (parentId: string | null): string[] => {
    return getAncestors(parentId).map((a: any) => a.title);
  };

  // Keep parent hierarchy tree nodes expanded in hierarchy table when returning
  useEffect(() => {
    if (ticket) {
      try {
        const saved = sessionStorage.getItem("bms_ticket_hierarchy_expanded");
        const set = saved ? new Set(JSON.parse(saved)) : new Set();
        if (ticket.parent) set.add(ticket.parent);
        if (ancestors?.length) ancestors.forEach((a: any) => set.add(a.id));
        set.delete(ticket.id);
        sessionStorage.setItem("bms_ticket_hierarchy_expanded", JSON.stringify(Array.from(set)));
      } catch {}
    }
  }, [ticket, ancestors]);

  if (isLoading) {
    return <div style={{ textAlign: "center", paddingTop: 100 }}><Spin size="large" /></div>;
  }
  if (!ticket) {
    return <Empty description="Ticket not found" />;
  }

  const fileIconMap: Record<string, string> = {
    "application/pdf": "📄",
    "application/msword": "📝",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
    "application/vnd.ms-excel": "📊",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
    "text/csv": "📊",
  };
  const getFileIcon = (ct: string) => {
    if (!ct) return "📎";
    if (ct.startsWith("image/")) return "🖼️";
    return fileIconMap[ct] || "📎";
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const allowedChildTypes = ALLOWED_CHILD_TYPES[ticket.type] ?? [];

  const childCreateMenu = (
    <div style={{ background: "var(--bms-surface, #fff)", border: "1px solid var(--bms-border, #dfe1e6)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", padding: "6px 0" }}>
      {allowedChildTypes.length > 0 ? (
        allowedChildTypes.map((childType) => (
          <div
            key={childType}
            style={{ padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
            onClick={() => {
              setCreateChildDefaultType(childType);
              setCreateChildModalOpen(true);
            }}
          >
            <TypeIcon type={childType} size={14} />
            <span>Create {TICKET_TYPE_LABELS[childType]}</span>
          </div>
        ))
      ) : (
        <div style={{ padding: "8px 16px", color: "#9ca3af", fontSize: 12 }}>No child types allowed</div>
      )}
    </div>
  );

  return (
    <div className="jira-issue">
      <nav className="jira-issue__breadcrumb" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Button
            type="text"
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              try {
                const saved = sessionStorage.getItem("bms_ticket_hierarchy_expanded");
                const set = saved ? new Set(JSON.parse(saved)) : new Set();
                if (ticket.parent) set.add(ticket.parent);
                if (ancestors?.length) ancestors.forEach((a: any) => set.add(a.id));
                set.delete(ticket.id);
                sessionStorage.setItem("bms_ticket_hierarchy_expanded", JSON.stringify(Array.from(set)));
              } catch {}

              if (ticket.project) {
                navigate(`/tickets?project=${ticket.project}`);
              } else {
                navigate("/tickets");
              }
            }}
            style={{ marginRight: 4 }}
            title="Back to tickets list"
          />
          <Link to="/tickets">Tickets</Link>
          <span className="jira-issue__breadcrumb-sep">/</span>
          <Link to={`/projects/${ticket.project}`}>{ticket.project_code}</Link>
          {ancestors.map((ancestor: any) => (
            <span key={ancestor.id}>
              <span className="jira-issue__breadcrumb-sep">/</span>
              <Link to={`/tickets/${ancestor.id}`} style={{ fontWeight: 500 }}>
                {ancestor.ticket_id}
              </Link>
            </span>
          ))}
          <span className="jira-issue__breadcrumb-sep">/</span>
          <span className="jira-issue__breadcrumb-current">{ticket.ticket_id}</span>
        </div>

        {allowedChildTypes.length > 0 && (
          <PermGuard permission={PERMS.PROJECT_TICKET_CREATE}>
            <Dropdown popupRender={() => childCreateMenu} trigger={["click"]}>
              <Button type="primary" size="small" icon={<PlusOutlined />}>
                Create Child Item <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
          </PermGuard>
        )}
      </nav>

      <div className="jira-issue__layout">
        <main className="jira-issue__main">
          <div className="jira-issue__type-row">
            <span className="jira-issue__type-badge">
              <TypeIcon type={ticket.type} size={16} />
              {TICKET_TYPE_LABELS[ticket.type]}
            </span>
            <span className="jira-issue__key">{ticket.ticket_id}</span>
          </div>

          <div className="jira-issue__title-wrap">
            {editingTitle ? (
              <Space.Compact style={{ width: "100%" }}>
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  size="large"
                  className="jira-issue__title"
                  onPressEnter={() => updateMut.mutate({ title: titleValue })}
                  autoFocus
                />
                <Button type="primary" loading={updateMut.isPending}
                  onClick={() => updateMut.mutate({ title: titleValue })}>Save</Button>
                <Button onClick={() => setEditingTitle(false)}>Cancel</Button>
              </Space.Compact>
            ) : (
              <div
                className="jira-issue__title-edit"
                onClick={() => { setTitleValue(ticket.title); setEditingTitle(true); }}
              >
                <Title level={2} className="jira-issue__title">{ticket.title}</Title>
                <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE}>
                  <Button size="small" type="text" icon={<EditOutlined />} className="jira-issue__title-edit-btn" />
                </PermGuard>
              </div>
            )}
          </div>

          <div className="jira-issue__toolbar">
            <StatusTransition ticket={ticket} onTransitioned={() => {
              qc.invalidateQueries({ queryKey: ["ticket", id] });
              qc.invalidateQueries({ queryKey: ["ticket-history", id] });
            }} />
          </div>

          <section className="jira-section">
            <div className="jira-section__header">
              <h2 className="jira-section__title">Description</h2>
              <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE}>
                <Button type="text" size="small" className="jira-section__action" icon={<EditOutlined />}
                  onClick={() => { setDescValue(ticket.description || ""); setEditingDesc(true); }}>
                  Edit
                </Button>
              </PermGuard>
            </div>
            <div className="jira-section__body">
              {editingDesc ? (
                <div>
                  <RichTextEditor
                    value={descValue}
                    onChange={setDescValue}
                    placeholder="Describe the ticket..."
                    minHeight={160}
                  />
                  <Space style={{ marginTop: 10 }}>
                    <Button type="primary" size="small" loading={updateMut.isPending}
                      onClick={() => updateMut.mutate({ description: descValue })}>Save</Button>
                    <Button size="small" onClick={() => setEditingDesc(false)}>Cancel</Button>
                  </Space>
                </div>
              ) : ticket.description ? (
                <div
                  className="rte-content jira-section__body--rte"
                  dangerouslySetInnerHTML={{ __html: ticket.description }}
                  onClick={() => { setDescValue(ticket.description || ""); setEditingDesc(true); }}
                />
              ) : (
                <div
                  className="jira-section__body--empty"
                  onClick={() => { setDescValue(""); setEditingDesc(true); }}
                >
                  Add a description…
                </div>
              )}
            </div>
          </section>

          <section className="jira-section">
            <div className="jira-section__header">
              <h2 className="jira-section__title">
                <PaperClipOutlined style={{ marginRight: 8, fontSize: 14 }} />
                Attachments
                <span className="jira-attachments__count">{ticket.attachments?.length ?? 0}</span>
              </h2>
              <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE}>
                <Upload
                  showUploadList={false}
                  beforeUpload={(file) => {
                    uploadMut.mutate(file);
                    return false;
                  }}
                >
                  <Button size="small" className="jira-section__action" loading={uploadMut.isPending}>
                    Attach file
                  </Button>
                </Upload>
              </PermGuard>
            </div>
            {(ticket.attachments?.length ?? 0) === 0 && (
              <Text type="secondary" style={{ fontSize: 13 }}>No attachments yet.</Text>
            )}
            <div className="jira-attachment-grid">
              {ticket.attachments?.map((att) => (
                <div key={att.id} className="jira-attachment-item" style={{ cursor: "pointer" }}>
                  <span className="jira-attachment-item__icon" onClick={() => setPreviewAttachment(att)}>
                    {getFileIcon(att.content_type)}
                  </span>
                  <div className="jira-attachment-item__meta" onClick={() => setPreviewAttachment(att)}>
                    <div className="jira-attachment-item__name">{att.file_name}</div>
                    <div className="jira-attachment-item__size">{formatBytes(att.file_size)}</div>
                  </div>
                  <Space size={0}>
                    {att.file_url && (
                      <>
                        <Button
                          size="small"
                          type="text"
                          icon={<EyeOutlined />}
                          title="Preview File"
                          onClick={() => setPreviewAttachment(att)}
                        />
                        <a href={att.file_url} target="_blank" rel="noreferrer" download={att.file_name}>
                          <Button size="small" type="text" icon={<DownloadOutlined />} title="Download File" />
                        </a>
                      </>
                    )}
                    <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />}
                        onClick={() => Modal.confirm({
                          title: "Remove attachment?",
                          onOk: () => deleteAttachMut.mutateAsync(att.id),
                        })} />
                    </PermGuard>
                  </Space>
                </div>
              ))}
            </div>
          </section>

          {/* Attachment Preview Modal */}
          {previewAttachment && (
            <Modal
              title={`Preview: ${previewAttachment.file_name}`}
              open={!!previewAttachment}
              onCancel={() => setPreviewAttachment(null)}
              footer={[
                <a key="download" href={previewAttachment.file_url} target="_blank" rel="noreferrer" download={previewAttachment.file_name}>
                  <Button icon={<DownloadOutlined />}>Download</Button>
                </a>,
                <Button key="close" type="primary" onClick={() => setPreviewAttachment(null)}>Close</Button>,
              ]}
              width={800}
            >
              <div style={{ textAlign: "center", minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {previewAttachment.content_type?.startsWith("image/") ? (
                  <img
                    src={previewAttachment.file_url}
                    alt={previewAttachment.file_name}
                    style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }}
                  />
                ) : previewAttachment.content_type === "application/pdf" ? (
                  <iframe
                    src={previewAttachment.file_url}
                    title={previewAttachment.file_name}
                    style={{ width: "100%", height: "65vh", border: "none", borderRadius: 8 }}
                  />
                ) : (
                  <div>
                    <p style={{ fontSize: 16 }}>{previewAttachment.file_name}</p>
                    <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>In-page preview not available for this file type.</Text>
                    <a href={previewAttachment.file_url} target="_blank" rel="noreferrer">
                      <Button type="primary" icon={<DownloadOutlined />}>Open / Download File</Button>
                    </a>
                  </div>
                )}
              </div>
            </Modal>
          )}

          <ChildrenPanel ticketId={id!} projectId={ticket.project} navigate={navigate} />

          <section className="jira-section jira-activity">
            <h2 className="jira-section__title" style={{ marginBottom: 0 }}>Activity</h2>
            <Tabs
              defaultActiveKey="comments"
              items={[
                {
                  key: "comments",
                  label: (
                    <span>
                      Comments
                      <span className="jira-activity__count">{(comments as TicketComment[]).length}</span>
                    </span>
                  ),
                  children: (
                    <div>
                      {(comments as TicketComment[]).map((c) => (
                        <CommentItem
                          key={c.id}
                          comment={c}
                          ticketId={id!}
                          onDelete={() => qc.invalidateQueries({ queryKey: ["ticket-comments", id] })}
                        />
                      ))}
                      <div className="jira-comment-compose">
                        <Avatar size={32} className="jira-comment__avatar" icon={<UserOutlined />} />
                        <div style={{ flex: 1 }}>
                          <Mentions
                            rows={3}
                            className="jira-comment-compose__input"
                            placeholder="Add a comment... Type @ to tag a person"
                            value={commentBody}
                            onChange={(val) => setCommentBody(val)}
                            onSelect={(option) => {
                              if (option.key && !selectedMentionIds.includes(String(option.key))) {
                                setSelectedMentionIds((prev) => [...prev, String(option.key)]);
                              }
                            }}
                            options={(employees as any[]).map((emp: any) => ({
                              value: emp.full_name,
                              label: emp.full_name,
                              key: emp.id,
                            }))}
                          />
                          <div className="jira-comment-compose__actions" style={{ marginTop: 8 }}>
                            <Button
                              type="primary" size="small" icon={<SendOutlined />}
                              loading={commentMut.isPending}
                              disabled={!commentBody.trim()}
                              onClick={() => commentMut.mutate({ body: commentBody, mentionedUserIds: selectedMentionIds })}
                            >
                              Comment
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "history",
                  label: (
                    <span>
                      History
                      <span className="jira-activity__count">{(history as TicketHistoryEntry[]).length}</span>
                    </span>
                  ),
                  children: (
                    <div className="jira-history-list">
                      {(history as TicketHistoryEntry[]).length === 0 && (
                        <Empty description="No history yet" style={{ padding: "32px 0" }} />
                      )}
                      {(history as TicketHistoryEntry[]).map((h) => (
                        <HistoryItem key={h.id} entry={h} />
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </main>

        <aside className="jira-details">
          <h3 className="jira-details__title">Details</h3>
          <FieldRow label="Project" icon={<LinkOutlined />}>
            <span className="jira-project-link" onClick={() => navigate(`/projects/${ticket.project}`)}>
              {ticket.project_code}
            </span>
            <span className="jira-project-name">{ticket.project_name}</span>
          </FieldRow>

          <FieldRow label="Assignee" icon={<UserOutlined />}>
                <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE} fallback={
                  <Text style={{ fontSize: 13 }}>{ticket.assignee_name || "Unassigned"}</Text>
                }>
                  <Select
                    value={ticket.assignee || undefined}
                    onChange={(v) => updateMut.mutate({ assignee: v ?? null })}
                    size="small" style={{ width: "100%" }}
                    showSearch allowClear placeholder="Unassigned"
                    options={getAssigneeOptions()}
                    filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
                  />
                </PermGuard>
          </FieldRow>

          <FieldRow label="Reporter" icon={<UserOutlined />}>
            <Text style={{ fontSize: 13 }}>{ticket.reporter_name || "—"}</Text>
          </FieldRow>

          <FieldRow label="Priority" icon={<FlagOutlined />}>
                <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE} fallback={
                  <PriorityLabel priority={ticket.priority} />
                }>
                  <Select
                    value={ticket.priority}
                    onChange={(v) => updateMut.mutate({ priority: v })}
                    size="small" style={{ width: "100%" }}
                    options={PRIORITY_SELECT_OPTIONS}
                    optionRender={(opt) => <PriorityLabel priority={opt.value as TicketPriority} />}
                    labelRender={(opt) => opt.value ? <PriorityLabel priority={opt.value as TicketPriority} /> : null}
                  />
                </PermGuard>
          </FieldRow>

          <FieldRow label="Due Date" icon={<CalendarOutlined />}>
                <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE} fallback={
                  <Text style={{ fontSize: 13, color: ticket.due_date && dayjs(ticket.due_date).isBefore(dayjs()) ? "#ef4444" : "inherit" }}>
                    {ticket.due_date ? dayjs(ticket.due_date).format("DD MMM YYYY") : "—"}
                  </Text>
                }>
                  <DatePicker
                    value={ticket.due_date ? dayjs(ticket.due_date) : null}
                    onChange={(d) => updateMut.mutate({ due_date: d ? d.format("YYYY-MM-DD") : null })}
                    size="small" style={{ width: "100%" }}
                    format="DD MMM YYYY"
                    disabledDate={(current) => disableTicketDueDate(current, projectDetail)}
                  />
                </PermGuard>
          </FieldRow>

          <FieldRow label="Estimate" icon={<ClockCircleOutlined />}>
                <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE} fallback={
                  <Text style={{ fontSize: 13 }}>{ticket.original_estimate || 0}h</Text>
                }>
                  <Space.Compact style={{ width: "100%" }}>
                    <InputNumber
                      value={Number(ticket.original_estimate) || 0}
                      onChange={(v) => {
                        if (maxEstimate != null && v != null && v > maxEstimate) {
                          message.error(`Original estimate cannot exceed project estimate of ${maxEstimate}h`);
                          return;
                        }
                        updateMut.mutate({ original_estimate: v });
                      }}
                      size="small" style={{ width: "100%" }} min={0} max={maxEstimate} step={0.5}
                    />
                    <Button size="small" disabled style={{ color: "var(--bms-text-3)", pointerEvents: "none" }}>h</Button>
                  </Space.Compact>
                </PermGuard>
          </FieldRow>

          <FieldRow label="Parent" icon={<LinkOutlined />}>
                <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE} fallback={
                  <span style={{ fontSize: 13, color: "var(--bms-text)", display: "flex", alignItems: "center", gap: 6 }}>
                    {ticket.parent_ticket_id && (
                      <TypeIcon type={(allTickets as any[]).find((t: any) => t.id === ticket.parent)?.type || "TASK"} size={13} />
                    )}
                    {ticket.parent_ticket_id || "—"}
                  </span>
                }>
                  <Select
                    value={ticket.parent || undefined}
                    onChange={(v) => updateMut.mutate({ parent: v ?? null })}
                    size="small"
                    style={{ width: "100%" }}
                    showSearch
                    allowClear
                    placeholder={<span style={{ color: "var(--bms-text-3)" }}>No parent</span>}
                    notFoundContent={
                      <div style={{ padding: 16, textAlign: "center", color: "var(--bms-text-3)" }}>
                        No tickets available
                      </div>
                    }
                    optionFilterProp="searchLabel"
                    getPopupContainer={(trigger) => trigger.parentElement || document.body}
                    options={(allTickets as any[])
                      .filter((t: any) => {
                        if (ticket.excluded_parent_ids?.includes(t.id)) return false;
                        if (ticket.parent === t.id) return true;
                        const slug = (t.workflow_state_slug || "").toLowerCase();
                        return !(slug.includes("close") || slug.includes("done") || slug.includes("cancel") || slug.includes("resolve"));
                      })
                      .map((t: any) => {
                        const hierarchy = buildHierarchy(t.parent);
                        const hierarchyStr = hierarchy.length > 0 ? hierarchy.join(" → ") : null;
                        return {
                          value: t.id,
                          searchLabel: `${t.ticket_id} ${t.title} ${t.parent_title || ""} ${t.ticket_id} ${hierarchyStr || ""}`,
                          label: (
                            <Tooltip
                              title={
                                hierarchyStr ? (
                                  <span style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
                                    <span style={{ fontWeight: 600, marginBottom: 2 }}>Parent hierarchy:</span>
                                    <span style={{ opacity: 0.85 }}>{hierarchyStr}</span>
                                  </span>
                                ) : undefined
                              }
                              placement="right"
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
                                <TypeIcon type={t.type} size={14} />
                                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
                                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#4f46e5" }}>
                                      {t.ticket_id}
                                    </span>
                                    {t.parent_ticket_id && (
                                      <span style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
                                        ← {t.parent_ticket_id}
                                      </span>
                                    )}
                                  </span>
                                  <span style={{ fontSize: 12, color: "var(--bms-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {t.title}
                                  </span>
                                </span>
                              </span>
                            </Tooltip>
                          ),
                        };
                      })
                    }
                    labelRender={(opt) => {
                      if (!opt.value) return undefined;
                      const raw = (allTickets as any[]).find((t: any) => t.id === opt.value);
                      if (!raw) return <span style={{ fontFamily: "monospace", fontSize: 12, color: "#4f46e5" }}>{String(opt.value)}</span>;
                      return (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <TypeIcon type={raw.type} size={13} />
                          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "#4f46e5" }}>
                            {raw.ticket_id}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--bms-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {raw.title}
                          </span>
                        </span>
                      );
                    }}
                  />
                </PermGuard>
          </FieldRow>

          {isManagerOrAdmin && (
            <FieldRow label="Approved" icon={<CheckCircleOutlined />}>
                  <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE} fallback={
                    <Tag color={ticket.approved ? "success" : "default"}>
                      {ticket.approved ? "Yes" : "No"}
                    </Tag>
                  }>
                    <Switch
                      checked={ticket.approved}
                      onChange={(v) => updateMut.mutate({ approved: v })}
                      checkedChildren="Yes" unCheckedChildren="No"
                      size="small"
                    />
                  </PermGuard>
            </FieldRow>
          )}

          <FieldRow label="Verified By" icon={<CheckCircleOutlined />}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}>
              <Text style={{ fontSize: 13, color: ticket.verified_by_name ? "#16a34a" : "inherit" }}>
                {ticket.verified_by_name ? (
                  <>
                    <span style={{ fontWeight: 600 }}>{ticket.verified_by_name}</span>
                    {ticket.verified_at && (
                      <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 4 }}>
                        ({dayjs(ticket.verified_at).format("DD MMM YYYY, hh:mm A")})
                      </span>
                    )}
                  </>
                ) : (
                  <Text type="secondary">Not Verified</Text>
                )}
              </Text>
              <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE}>
                {ticket.verified_by_name ? (
                  <Button
                    size="small"
                    type="default"
                    danger
                    loading={updateMut.isPending}
                    onClick={() => updateMut.mutate({ verified_by: null })}
                    style={{ fontSize: 11, borderRadius: 6 }}
                  >
                    Unverify
                  </Button>
                ) : (
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={verifyMut.isPending}
                    onClick={() => verifyMut.mutate()}
                    style={{ backgroundColor: "#16a34a", borderColor: "#16a34a", fontSize: 11, borderRadius: 6 }}
                  >
                    Verify
                  </Button>
                )}
              </PermGuard>
            </div>
          </FieldRow>

          <FieldRow label="Notify" icon={<UserOutlined />}>
                <PermGuard permission={PERMS.PROJECT_TICKET_UPDATE} fallback={
                  <Text style={{ fontSize: 12 }}>
                    {ticket.notify_users_info?.map((u) => u.name).join(", ") || "—"}
                  </Text>
                }>
                  <Select
                    mode="multiple"
                    value={ticket.notify_users}
                    onChange={(v) => updateMut.mutate({ notify_users: v })}
                    size="small" style={{ width: "100%" }}
                    showSearch
                    placeholder="Select users to notify…"
                    options={getNotifyOptions()}
                    filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
                    maxTagCount="responsive"
                    allowClear
                  />
                </PermGuard>
          </FieldRow>

          <div className="jira-details__meta">
            <div>Created {dayjs(ticket.created_at).format("DD MMM YYYY, hh:mm A")}</div>
            <div>Updated {dayjs(ticket.updated_at).fromNow()}</div>
          </div>
        </aside>
      </div>

      <CreateTicketModal
        open={createChildModalOpen}
        onClose={() => setCreateChildModalOpen(false)}
        defaultProjectId={ticket.project}
        parentId={id}
        defaultType={createChildDefaultType}
      />
    </div>
  );
}

// ── Child row status chip (inline transition dropdown) ─────────────────────────
function ChildStatusChip({ child, workflowStates, transitioning, onTransition }: {
  child: any;
  workflowStates: WorkflowState[];
  transitioning: boolean;
  onTransition: (destSlug: string) => void;
}) {
  const color = child.workflow_state_color || "#9ca3af";
  const lozenge = (
    <span className="jira-status-lozenge" style={{ background: `${color}33`, color }}>
      <span className="jira-status-lozenge__dot" style={{ background: color }} />
      {child.workflow_state_name || "No Status"}
    </span>
  );

  if (!workflowStates.length) return lozenge;

  return (
    <PermGuard permission={PERMS.PROJECT_TICKET_TRANSITION} fallback={lozenge}>
      <Select
        size="small"
        className="jira-status-select"
        value={child.workflow_state_slug || undefined}
        loading={transitioning}
        style={{ minWidth: 130 }}
        onChange={(slug) => {
          if (slug && slug !== child.workflow_state_slug) onTransition(slug);
        }}
        options={workflowStates.map((s) => ({
          value: s.slug,
          label: (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color_code || "#9ca3af" }} />
              {s.name}
            </span>
          ),
        }))}
      />
    </PermGuard>
  );
}

// ── Children sub-panel ─────────────────────────────────────────────────────────
function ChildrenPanel({ ticketId, projectId, navigate }: {
  ticketId: string; projectId: string; navigate: (to: string) => void;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const { data: children = [], isLoading } = useQuery({
    queryKey: ["ticket-children", ticketId],
    queryFn: () => ticketsApi.getChildren(ticketId),
  });
  const { data: workflowStates = [] } = useQuery({
    queryKey: ["ticket-workflow-states"],
    queryFn: () => workflowStateApi.list("tickets", "ticket"),
    staleTime: 300_000,
  });

  const transitionMut = useMutation({
    mutationFn: ({ childId, destSlug }: { childId: string; destSlug: string }) =>
      ticketsApi.transition(childId, destSlug),
    onSuccess: () => {
      message.success("Status updated");
      qc.invalidateQueries({ queryKey: ["ticket-children", ticketId] });
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Cannot update status — check permissions")),
  });

  const rows = children as any[];
  const total = rows.length;
  const done = rows.filter((c) => c.is_final).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section className="jira-section">
      <div className="jira-section__header">
        <h2 className="jira-section__title">
          <LinkOutlined style={{ marginRight: 8, fontSize: 14 }} />
          Child work items
          <span className="jira-attachments__count">{total}</span>
        </h2>
        <PermGuard permission={PERMS.PROJECT_TICKET_CREATE}>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            Add
          </Button>
        </PermGuard>
      </div>
      {isLoading && <Spin />}

      {total > 0 && (
        <>
          <div className="jira-children__progress">
            <Progress percent={pct} size="small" showInfo={false} strokeColor="#36b37e" />
            <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
              {done}/{total} done · {pct}%
            </Text>
          </div>

          <div className="jira-children__table">
            <div className="jira-children__row jira-children__row--head">
              <span>Work item</span>
              <span>Priority</span>
              <span>Est</span>
              <span>Assignee</span>
              <span>Status</span>
            </div>
            {rows.map((c) => (
              <div key={c.id} className="jira-children__row">
                <div className="jira-children__work" onClick={() => navigate(`/tickets/${c.id}`)}>
                  <TypeIcon type={c.type as TicketType} size={14} />
                  <span
                    className="jira-child-item__key"
                    style={c.is_final ? { textDecoration: "line-through", opacity: 0.6 } : undefined}
                  >
                    {c.ticket_id}
                  </span>
                  <Text
                    style={{
                      fontSize: 13, flex: 1, minWidth: 0,
                      textDecoration: c.is_final ? "line-through" : undefined,
                      opacity: c.is_final ? 0.6 : 1,
                    }}
                    ellipsis
                  >
                    {c.title}
                  </Text>
                </div>
                <span className="jira-children__cell">
                  <PriorityIcon priority={c.priority as TicketPriority} />
                </span>
                <span className="jira-children__cell jira-children__cell--muted">
                  {c.original_estimate ? `${c.original_estimate}h` : "—"}
                </span>
                <span className="jira-children__cell">
                  {c.assignee_name ? (
                    <Tooltip title={c.assignee_name}>
                      <span><AssigneeAvatar name={c.assignee_name} size={22} /></span>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Unassigned">
                      <UserOutlined style={{ color: "#9ca3af" }} />
                    </Tooltip>
                  )}
                </span>
                <span className="jira-children__cell jira-children__cell--status">
                  <ChildStatusChip
                    child={c}
                    workflowStates={workflowStates as WorkflowState[]}
                    transitioning={transitionMut.isPending && transitionMut.variables?.childId === c.id}
                    onTransition={(destSlug) => transitionMut.mutate({ childId: c.id, destSlug })}
                  />
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {total === 0 && !isLoading && (
        <Empty description="No child work items" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}

      <CreateTicketModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultProjectId={projectId}
        parentId={ticketId}
      />
    </section>
  );
}
