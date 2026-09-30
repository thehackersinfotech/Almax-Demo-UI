import { useState } from "react";
import {
  Drawer, Button, Tag, Tabs, Spin, Empty, Popconfirm,
  Form, Input, Select, DatePicker, TimePicker, Checkbox, Upload,
  Typography, Modal, App,
} from "antd";
import {
  PhoneOutlined, MailOutlined, WhatsAppOutlined, UserOutlined,
  PlusOutlined, DeleteOutlined, FileOutlined, UploadOutlined,
  CheckCircleOutlined, SwapOutlined, EditOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ClockTimePicker } from "@/components/common/ClockTimePicker";
import { followUpApi, type FollowUpItem } from "@/services/followups";
import { meetingApi, type MeetingItem } from "@/services/meetings";
import { todoApi, type TodoItem } from "@/services/todos";
import { employeeApi, type SimpleDropdownEmployee } from "@/services/employees";
import { apiErrorMsg } from "@/utils/apiError";
import {
  fetchDocuments, uploadDocument, deleteDocument,
  convertLead,
} from "@/services/leads";
import type { Lead } from "@/services/leads";
import CrmSharedDocumentsManager from "@/components/crm/CrmSharedDocumentsManager";

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const STATUS_COLORS: Record<string, string> = {
  new_lead:      "blue",
  contacted:     "cyan",
  proposal_sent: "gold",
  qualified:     "green",
  converted:     "purple",
  lost:          "red",
};

const STATUS_LABELS: Record<string, string> = {
  new_lead:      "New Lead",
  contacted:     "Contacted",
  proposal_sent: "Proposal Sent",
  qualified:     "Qualified",
  converted:     "Converted",
  lost:          "Lost",
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    "default",
  medium: "orange",
  high:   "red",
};

const FOLLOWUP_TYPE_ICONS: Record<string, React.ReactNode> = {
  CALL:    <PhoneOutlined />,
  MESSAGE: <MailOutlined />,
  MEETING: <UserOutlined />,
  EMAIL:   <MailOutlined />,
};

const FOLLOWUP_TYPE_COLORS: Record<string, string> = {
  CALL:    "rgba(24, 144, 255, 0.15)",
  MESSAGE: "rgba(114, 46, 209, 0.15)",
  MEETING: "rgba(82, 196, 26, 0.15)",
  EMAIL:   "rgba(250, 140, 22, 0.15)",
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="lead-detail-row">
      <span className="lead-detail-label">{label}</span>
      <span className="lead-detail-value">{value}</span>
    </div>
  );
}

// ─── FollowUps Tab ────────────────────────────────────────────────────────────
const DRAWER_FOLLOWUP_TYPES = [
  { type: "CALL", label: "CALL", icon: <PhoneOutlined />, color: "#1890ff" },
  { type: "MESSAGE", label: "MESSAGE", icon: <MailOutlined />, color: "#722ed1" },
  { type: "MEETING", label: "MEETING", icon: <UserOutlined />, color: "#52c41a" },
  { type: "EMAIL", label: "EMAIL", icon: <MailOutlined />, color: "#fa8c16" },
];

function FollowUpsTab({ leadId, contextType = "sales" }: { leadId: string; contextType?: "sales" | "lead" }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [adding, setAdding] = useState(false);
  const [selectedType, setSelectedType] = useState("CALL");
  const [draggedItem, setDraggedItem] = useState<any | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const effectiveSource = contextType === "sales" ? "SALES_MANAGEMENT" : "LEAD_MANAGEMENT";

  const { data: empData } = useQuery({
    queryKey: ["employees-simple-dropdown"],
    queryFn: () => employeeApi.simpleDropdown(),
    staleTime: 5 * 60 * 1000,
  });
  const employees = empData ?? [];

  const { data: followUpsData, isLoading: isFpLoading } = useQuery({
    queryKey: ["lead-drawer-followups", leadId, effectiveSource],
    queryFn: () => followUpApi.list({ lead: leadId, source: effectiveSource }),
    enabled: !!leadId,
  });

  const { data: meetingsData, isLoading: isMtLoading } = useQuery({
    queryKey: ["lead-drawer-meetings", leadId, effectiveSource],
    queryFn: () => meetingApi.list({ lead: leadId, source: effectiveSource }),
    enabled: !!leadId,
  });

  const isLoading = isFpLoading || isMtLoading;

  const invalidateAllFollowUps = () => {
    qc.invalidateQueries({ queryKey: ["lead-drawer-followups", leadId] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-meetings", leadId] });
    if (effectiveSource === "SALES_MANAGEMENT") {
      qc.invalidateQueries({ queryKey: ["sales-followups-all"] });
      qc.invalidateQueries({ queryKey: ["sales-meetings-all"] });
    } else {
      qc.invalidateQueries({ queryKey: ["lead-followups-all"] });
      qc.invalidateQueries({ queryKey: ["lead-meetings-all"] });
    }
    qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
  };

  const createFollowUpMut = useMutation({
    mutationFn: (payload: any) => followUpApi.create(payload),
    onSuccess: () => {
      invalidateAllFollowUps();
      form.resetFields();
      setAdding(false);
      message.success("Follow-up added successfully");
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to add follow-up")),
  });

  const createMeetingMut = useMutation({
    mutationFn: (payload: any) => meetingApi.create(payload),
    onSuccess: () => {
      invalidateAllFollowUps();
      form.resetFields();
      setAdding(false);
      message.success("Meeting scheduled successfully");
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to schedule meeting")),
  });

  const updateFollowUpMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => followUpApi.update(id, data),
    onSuccess: () => {
      invalidateAllFollowUps();
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to update follow-up")),
  });

  const updateMeetingMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => meetingApi.update(id, data),
    onSuccess: () => {
      invalidateAllFollowUps();
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to update meeting")),
  });

  const deleteFollowUpMut = useMutation({
    mutationFn: (id: string) => followUpApi.delete(id),
    onSuccess: () => {
      invalidateAllFollowUps();
      message.success("Follow-up deleted");
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to delete follow-up")),
  });

  const deleteMeetingMut = useMutation({
    mutationFn: (id: string) => meetingApi.delete(id),
    onSuccess: () => {
      invalidateAllFollowUps();
      message.success("Meeting deleted");
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to delete meeting")),
  });

  const transitionFollowUpMut = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) => followUpApi.transition(id, state),
    onMutate: async ({ id, state }) => {
      const qKey = ["lead-drawer-followups", leadId, effectiveSource];
      await qc.cancelQueries({ queryKey: qKey });
      const previousData = qc.getQueryData<any>(qKey);
      if (previousData) {
        const isArr = Array.isArray(previousData);
        const items = isArr ? previousData : previousData.results;
        if (items) {
          const updated = items.map((it: any) =>
            it.id === id
              ? {
                  ...it,
                  workflow_state_slug: state,
                  workflow_state_name: state.toUpperCase(),
                  is_completed: state === "completed",
                }
              : it
          );
          qc.setQueryData(qKey, isArr ? updated : { ...previousData, results: updated });
        }
      }
      return { previousData, qKey };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousData && context?.qKey) {
        qc.setQueryData(context.qKey, context.previousData);
      }
      message.error(apiErrorMsg(err, "Failed to update status"));
    },
    onSuccess: (_, { state }) => {
      invalidateAllFollowUps();
      message.success(state === "completed" ? "Follow-up completed" : "Follow-up marked open");
    },
  });

  const transitionMeetingMut = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) => meetingApi.transition(id, state),
    onMutate: async ({ id, state }) => {
      const qKey = ["lead-drawer-meetings", leadId, effectiveSource];
      await qc.cancelQueries({ queryKey: qKey });
      const previousData = qc.getQueryData<any>(qKey);
      if (previousData) {
        const isArr = Array.isArray(previousData);
        const items = isArr ? previousData : previousData.results;
        if (items) {
          const updated = items.map((it: any) =>
            it.id === id
              ? {
                  ...it,
                  workflow_state_slug: state,
                  workflow_state_name: state.toUpperCase(),
                  is_completed: state === "completed",
                }
              : it
          );
          qc.setQueryData(qKey, isArr ? updated : { ...previousData, results: updated });
        }
      }
      return { previousData, qKey };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousData && context?.qKey) {
        qc.setQueryData(context.qKey, context.previousData);
      }
      message.error(apiErrorMsg(err, "Failed to update status"));
    },
    onSuccess: (_, { state }) => {
      invalidateAllFollowUps();
      message.success(state === "completed" ? "Meeting completed" : "Meeting marked open");
    },
  });

  const rawFollowUps: FollowUpItem[] = Array.isArray(followUpsData) ? followUpsData : (followUpsData as any)?.results ?? [];
  const rawMeetings: MeetingItem[] = Array.isArray(meetingsData) ? meetingsData : (meetingsData as any)?.results ?? [];

  const normalizedFollowUps = rawFollowUps.map(f => ({
    id: f.id,
    itemType: "followup" as const,
    type: (f.type || "CALL").toUpperCase(),
    title: f.title,
    date: f.start_date || (f as any).date_from || f.end_date || (f as any).date_to || "",
    date_to: f.end_date || (f as any).date_to || "",
    time: f.start_time || "",
    endTime: f.end_time || "",
    notes: f.description || (f as any).notes || "",
    is_completed: f.is_completed || f.workflow_state_slug === "completed" || (f as any).status === "DONE",
    workflow_state: f.workflow_state_name || f.workflow_state_slug || (f as any).status || "Open",
    workflow_state_color: f.workflow_state_color || "",
    priority: f.priority,
    assignees: f.assignees || [],
    assignee_names: (f.assignees_data || []).map((a: { id: string; full_name: string }) => a.full_name),
  }));

  const normalizedMeetings = rawMeetings.map(m => ({
    id: m.id,
    itemType: "meeting" as const,
    type: "MEETING",
    title: m.title,
    date: m.start_date || (m as any).date_from || m.end_date || (m as any).date_to || "",
    date_to: m.end_date || (m as any).date_to || "",
    time: m.start_time || "",
    endTime: m.end_time || "",
    notes: (m as any).agenda || m.description || "",
    is_completed: m.is_completed || m.workflow_state_slug === "completed" || (m as any).status === "DONE",
    workflow_state: m.workflow_state_name || m.workflow_state_slug || (m as any).status || "Scheduled",
    workflow_state_color: m.workflow_state_color || "",
    priority: m.priority,
    assignees: m.assignees || [],
    assignee_names: (m.assignees_data || []).map((a: { id: string; full_name: string }) => a.full_name),
  }));

  const allItems = [...normalizedFollowUps, ...normalizedMeetings];
  const activeItems = allItems.filter(f => !f.is_completed);
  const completedItems = allItems.filter(f => f.is_completed);

  const handleAdd = async () => {
    const vals = await form.validateFields();
    let start_date: string | undefined;
    let end_date: string | undefined;

    if (vals.date_range && vals.date_range.length === 2) {
      start_date = vals.date_range[0].format("YYYY-MM-DD");
      end_date = vals.date_range[1].format("YYYY-MM-DD");
    } else if (vals.date) {
      start_date = vals.date.format("YYYY-MM-DD");
      end_date = start_date;
    }

    // Convert dayjs time values from ClockTimePicker to HH:mm:ss strings
    // ClockTimePicker returns dayjs objects; the API expects "HH:mm" or "HH:mm:ss"
    const startTimeStr: string | undefined = vals.start_time
      ? (typeof (vals.start_time as any).format === "function"
          ? (vals.start_time as any).format("HH:mm:ss")
          : String(vals.start_time))
      : undefined;
    const endTimeStr: string | undefined = vals.end_time
      ? (typeof (vals.end_time as any).format === "function"
          ? (vals.end_time as any).format("HH:mm:ss")
          : String(vals.end_time))
      : undefined;

    const type = vals.type || selectedType;
    if (type === "MEETING") {
      createMeetingMut.mutate({
        lead: leadId,
        title: vals.title,
        start_date,
        end_date,
        date_from: start_date,
        date_to: end_date,
        start_time: startTimeStr,
        end_time: endTimeStr,
        assignees: vals.assignees || [],
        agenda: vals.notes || "",
        description: vals.notes || "",
        mode: "ONLINE",
        priority: vals.priority || "MEDIUM",
        source: effectiveSource,
      });
    } else {
      createFollowUpMut.mutate({
        lead: leadId,
        type: type,
        title: vals.title,
        start_date,
        end_date,
        date_from: start_date,
        date_to: end_date,
        start_time: startTimeStr,
        end_time: endTimeStr,
        assignees: vals.assignees || [],
        notes: vals.notes || "",
        description: vals.notes || "",
        priority: vals.priority || "MEDIUM",
        source: effectiveSource,
      });
    }
  };

  const handleToggleComplete = (item: typeof allItems[0], checked: boolean) => {
    const state = checked ? "completed" : "planning";
    if (item.itemType === "followup") {
      transitionFollowUpMut.mutate({ id: item.id, state });
    } else {
      transitionMeetingMut.mutate({ id: item.id, state });
    }
  };

  const handleDelete = (item: typeof allItems[0]) => {
    if (item.itemType === "followup") {
      deleteFollowUpMut.mutate(item.id);
    } else {
      deleteMeetingMut.mutate(item.id);
    }
  };

  const handleDragStart = (e: React.DragEvent, item: typeof allItems[0]) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: item.id, itemType: item.itemType, type: item.type }));
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    if (dragOverColumn !== type) setDragOverColumn(type);
  };

  const handleDragLeave = (e: React.DragEvent, type: string) => {
    e.preventDefault();
    if (dragOverColumn === type) setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetType: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedItem) return;

    if (draggedItem.type !== targetType) {
      if (draggedItem.type !== "MEETING" && targetType === "MEETING") {
        meetingApi.create({
          title: draggedItem.title,
          lead: leadId,
          start_date: draggedItem.date || dayjs().format("YYYY-MM-DD"),
          end_date: draggedItem.date_to || draggedItem.date || dayjs().format("YYYY-MM-DD"),
          start_time: draggedItem.time || undefined,
          end_time: draggedItem.endTime || undefined,
          assignees: draggedItem.assignees || [],
          description: draggedItem.notes || "",
          agenda: draggedItem.notes || "",
          mode: "ONLINE",
          priority: draggedItem.priority || "MEDIUM",
          source: effectiveSource,
        }).then(() => {
          return followUpApi.delete(draggedItem.id);
        }).then(() => {
          invalidateAllFollowUps();
          message.success("Moved to Meeting");
        }).catch((err: any) => {
          message.error(apiErrorMsg(err, "Failed to move to meeting"));
        });
      } else if (draggedItem.type === "MEETING" && targetType !== "MEETING") {
        followUpApi.create({
          title: draggedItem.title,
          type: targetType,
          lead: leadId,
          start_date: draggedItem.date || dayjs().format("YYYY-MM-DD"),
          end_date: draggedItem.date_to || draggedItem.date || dayjs().format("YYYY-MM-DD"),
          start_time: draggedItem.time || undefined,
          end_time: draggedItem.endTime || undefined,
          assignees: draggedItem.assignees || [],
          description: draggedItem.notes || "",
          priority: draggedItem.priority || "MEDIUM",
          source: effectiveSource,
        }).then(() => {
          return meetingApi.delete(draggedItem.id);
        }).then(() => {
          invalidateAllFollowUps();
          message.success(`Moved to ${targetType}`);
        }).catch((err: any) => {
          message.error(apiErrorMsg(err, `Failed to move to ${targetType}`));
        });
      } else {
        followUpApi.update(draggedItem.id, { type: targetType }).then(() => {
          invalidateAllFollowUps();
          message.success(`Moved to ${targetType}`);
        }).catch((err: any) => {
          message.error(apiErrorMsg(err, `Failed to move to ${targetType}`));
        });
      }
    }
    setDraggedItem(null);
  };

  return (
    <div>
      {/* Header Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text strong style={{ color: "var(--bms-text)" }}>Follow-up Board</Text>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => { setSelectedType("CALL"); form.resetFields(); setAdding(true); }}
          style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
        >
          Add Follow-up
        </Button>
      </div>

      {isLoading ? (
        <Spin style={{ display: "block", margin: "24px auto" }} />
      ) : (
        <>
          {/* Draggable Kanban Card Columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {DRAWER_FOLLOWUP_TYPES.map(ft => {
              const items = activeItems.filter(f => f.type === ft.type);
              const isTarget = dragOverColumn === ft.type;
              return (
                <div
                  key={ft.type}
                  onDragOver={e => handleDragOver(e, ft.type)}
                  onDragLeave={e => handleDragLeave(e, ft.type)}
                  onDrop={e => handleDrop(e, ft.type)}
                  style={{
                    background: isTarget ? "rgba(75, 91, 202, 0.08)" : "var(--bms-surface)",
                    border: isTarget ? "2px dashed #4b5bca" : "1px solid var(--bms-border)",
                    borderRadius: 8,
                    padding: 10,
                    minHeight: 220,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--bms-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 13, color: ft.color }}>{ft.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 12, color: "var(--bms-text)" }}>{ft.label}</span>
                    </div>
                    <Tag style={{ borderRadius: 10, margin: 0, fontSize: 10 }}>{items.length}</Tag>
                  </div>

                  {items.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 4px", color: "var(--bms-text-2)", fontSize: 11 }}>
                      No {ft.label.toLowerCase()} items
                    </div>
                  ) : (
                    items.map(f => (
                      <div
                        key={f.id}
                        draggable
                        onDragStart={e => handleDragStart(e, f)}
                        style={{
                          background: "var(--bms-surface-2)",
                          border: "1px solid var(--bms-border)",
                          borderRadius: 6,
                          padding: 8,
                          marginBottom: 8,
                          cursor: "grab",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <Checkbox
                              checked={f.is_completed}
                              onChange={e => handleToggleComplete(f, e.target.checked)}
                              style={{ marginTop: 2 }}
                            />
                            <span style={{ fontWeight: 600, fontSize: 12, color: "var(--bms-text)" }}>{f.title}</span>
                          </div>
                          <Popconfirm title="Delete this item?" onConfirm={() => handleDelete(f)}>
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ padding: "0 2px", height: 16 }} />
                          </Popconfirm>
                        </div>

                        <div style={{ fontSize: 11, color: "var(--bms-text-2)", paddingLeft: 20, marginTop: 4 }}>
                          {f.date} {f.time ? `at ${f.time.slice(0, 5)}` : ""}
                        </div>

                        {f.assignee_names && f.assignee_names.length > 0 && (
                          <div style={{ fontSize: 10, color: "var(--bms-text-2)", paddingLeft: 20, marginTop: 2 }}>
                            👤 {f.assignee_names.join(", ")}
                          </div>
                        )}

                        <div style={{ paddingLeft: 20, marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <Tag
                            color={f.workflow_state_color || "blue"}
                            style={{ fontSize: 10, margin: 0 }}
                          >
                            {f.workflow_state}
                          </Tag>
                          {f.priority && (
                            <Tag color={f.priority === "HIGH" ? "red" : f.priority === "MEDIUM" ? "orange" : "default"} style={{ fontSize: 10, margin: 0 }}>
                              {f.priority}
                            </Tag>
                          )}
                        </div>

                        {f.notes && (
                          <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 4, paddingLeft: 20, fontStyle: "italic" }}>
                            {f.notes.length > 40 ? `${f.notes.slice(0, 40)}...` : f.notes}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>

          {/* Completed Follow-up History Section */}
          <div style={{ marginTop: 20, background: "var(--bms-surface)", border: "1px solid var(--bms-border)", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, borderBottom: "1px solid var(--bms-border)", paddingBottom: 6 }}>
              <CheckCircleOutlined style={{ fontSize: 16, color: "var(--bms-success)" }} />
              <Text strong style={{ fontSize: 13, color: "var(--bms-text)" }}>Completed Follow-up History</Text>
              <Tag color="green" style={{ borderRadius: 10, marginLeft: "auto", fontSize: 10 }}>{completedItems.length} completed</Tag>
            </div>

            {completedItems.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: 11 }}>No completed follow-ups yet.</Text>} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {completedItems.map(f => (
                  <div key={f.id} style={{ background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)", borderRadius: 6, padding: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Checkbox
                      checked={true}
                      onChange={() => handleToggleComplete(f, false)}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, fontSize: 12, textDecoration: "line-through", color: "var(--bms-text-2)" }}>{f.title}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Tag color="default" style={{ fontSize: 9, margin: 0 }}>{f.type}</Tag>
                          <Tag color="green" style={{ fontSize: 9, margin: 0 }}>COMPLETED</Tag>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--bms-text-2)", marginTop: 2 }}>
                        Completed • {f.date} {f.time ? f.time.slice(0, 5) : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Button
        icon={<PlusOutlined />}
        type="dashed"
        block
        style={{ marginTop: 14 }}
        onClick={() => {
          setSelectedType("CALL");
          form.resetFields();
          setAdding(true);
        }}
      >
        Add Follow-up
      </Button>

      {/* Centered Add Follow Up Modal Overlay */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PhoneOutlined style={{ color: "#4b5bca" }} />
            <span style={{ fontWeight: 600 }}>Add Follow Up</span>
          </div>
        }
        open={adding}
        onCancel={() => {
          setAdding(false);
          form.resetFields();
        }}
        onOk={handleAdd}
        confirmLoading={createFollowUpMut.isPending || createMeetingMut.isPending}
        okText="Save Follow Up"
        cancelText="Cancel"
        destroyOnHidden
        centered
        zIndex={1100}
        width={580}
        styles={{
          body: {
            maxHeight: "calc(80vh - 120px)",
            overflowY: "auto",
            paddingTop: 8,
            paddingRight: 4,
          },
        }}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item name="type" label="Follow Up Type" initialValue={selectedType} rules={[{ required: true }]}>
              <Select onChange={val => setSelectedType(val)}>
                {DRAWER_FOLLOWUP_TYPES.map(t => (
                  <Option key={t.type} value={t.type}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: t.color }}>{t.icon}</span>
                      <span>{t.label}</span>
                    </span>
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
              <Select>
                <Option value="HIGH">High</Option>
                <Option value="MEDIUM">Medium</Option>
                <Option value="LOW">Low</Option>
              </Select>
            </Form.Item>
            <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]} style={{ gridColumn: "1/-1" }}>
              <Input placeholder="e.g. Discuss proposal requirements" />
            </Form.Item>
            <Form.Item name="assignees" label="Assignee(s)" rules={[{ required: true, message: "Please select an assignee" }]} style={{ gridColumn: "1/-1" }}>
              <Select mode="multiple" placeholder="Select employee assignees" showSearch optionFilterProp="children">
                {employees.map(e => (
                  <Option key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_code || "Staff"})
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="date_range" label="Date Range" initialValue={[dayjs(), dayjs().add(1, "day")]} rules={[{ required: true }]} style={{ gridColumn: "1/-1" }}>
              <DatePicker.RangePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
            </Form.Item>
            <Form.Item name="start_time" label="Start Time">
              <ClockTimePicker placeholder="Start time" />
            </Form.Item>
            <Form.Item name="end_time" label="End Time">
              <ClockTimePicker placeholder="End time" />
            </Form.Item>
          </div>
          <Form.Item name="notes" label={selectedType === "MEETING" ? "Agenda / Description" : "Notes"}>
            <TextArea rows={3} placeholder="Add follow-up notes or meeting agenda details..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────
function TasksTab({ leadId, contextType = "sales" }: { leadId: string; contextType?: "sales" | "lead" }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [adding, setAdding] = useState(false);

  const effectiveSource = contextType === "sales" ? "SALES_MANAGEMENT" : "LEAD_MANAGEMENT";

  const { data: empData } = useQuery({
    queryKey: ["employees-simple-dropdown"],
    queryFn: () => employeeApi.simpleDropdown(),
    staleTime: 5 * 60 * 1000,
  });
  const employees = empData ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["lead-drawer-todos", leadId, effectiveSource],
    queryFn: () => todoApi.list({ lead: leadId, source: effectiveSource }),
    enabled: !!leadId,
  });

  const invalidateAllTasks = () => {
    qc.invalidateQueries({ queryKey: ["lead-drawer-todos", leadId] });
    if (effectiveSource === "SALES_MANAGEMENT") {
      qc.invalidateQueries({ queryKey: ["sales-tasks-all"] });
    } else {
      qc.invalidateQueries({ queryKey: ["lead-tasks-all"] });
    }
    qc.invalidateQueries({ queryKey: ["todos-board"] });
    qc.invalidateQueries({ queryKey: ["todos-list"] });
    qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
  };

  const createMut = useMutation({
    mutationFn: (payload: any) => todoApi.create(payload),
    onSuccess: () => {
      invalidateAllTasks();
      form.resetFields();
      setAdding(false);
      message.success("Task added to Workspace Todos");
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to add task")),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TodoItem> }) => todoApi.update(id, data),
    onSuccess: () => {
      invalidateAllTasks();
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to update task")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => todoApi.delete(id),
    onSuccess: () => {
      invalidateAllTasks();
      message.success("Task deleted");
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to delete task")),
  });

  const transitionMut = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) => todoApi.transition(id, state),
    onMutate: async ({ id, state }) => {
      const qKey = ["lead-drawer-todos", leadId, effectiveSource];
      await qc.cancelQueries({ queryKey: qKey });
      const previousData = qc.getQueryData<any>(qKey);
      if (previousData) {
        const isArr = Array.isArray(previousData);
        const items = isArr ? previousData : previousData.results;
        if (items) {
          const updated = items.map((it: any) =>
            it.id === id
              ? {
                  ...it,
                  workflow_state_slug: state,
                  workflow_state_name: state.toUpperCase(),
                  is_completed: state === "done" || state === "completed",
                }
              : it
          );
          qc.setQueryData(qKey, isArr ? updated : { ...previousData, results: updated });
        }
      }
      return { previousData, qKey };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousData && context?.qKey) {
        qc.setQueryData(context.qKey, context.previousData);
      }
      message.error(apiErrorMsg(err, "Failed to update task status"));
    },
    onSuccess: () => {
      invalidateAllTasks();
    },
  });

  const handleAdd = async () => {
    const vals = await form.validateFields();
    let start_date: string | undefined;
    let due_date: string | undefined;

    if (vals.date_range && vals.date_range.length === 2) {
      start_date = vals.date_range[0]?.format("YYYY-MM-DD");
      due_date = vals.date_range[1]?.format("YYYY-MM-DD");
    }

    const startTimeStr = vals.start_time
      ? (typeof vals.start_time.format === "function"
          ? vals.start_time.format("HH:mm:ss")
          : typeof vals.start_time === "string" && vals.start_time.trim()
          ? vals.start_time.trim()
          : undefined)
      : undefined;
    const endTimeStr = vals.end_time
      ? (typeof vals.end_time.format === "function"
          ? vals.end_time.format("HH:mm:ss")
          : typeof vals.end_time === "string" && vals.end_time.trim()
          ? vals.end_time.trim()
          : undefined)
      : undefined;

    createMut.mutate({
      lead: leadId,
      title: vals.title,
      description: vals.description || "",
      start_date,
      due_date,
      start_time: startTimeStr,
      end_time: endTimeStr,
      assignees: vals.assignees || [],
      priority: vals.priority || "MEDIUM",
      source: effectiveSource,
    });
  };

  const tasks: TodoItem[] = Array.isArray(data) ? data : (data as any)?.results ?? [];

  return (
    <div>
      {isLoading ? <Spin style={{ display: "block", margin: "24px auto" }} /> : (
        tasks.length === 0 && !adding
          ? <Empty description="No tasks yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          : tasks.map(t => {
              const isCompleted = t.is_completed || t.workflow_state_slug === "completed" || t.workflow_state_slug === "done" || t.workflow_state === "COMPLETED" || t.workflow_state === "DONE" || t.status === "DONE";
              return (
                <div key={t.id} className="task-row" style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--bms-border)" }}>
                  <Checkbox
                    checked={isCompleted}
                    onChange={e => {
                      transitionMut.mutate({ id: t.id, state: e.target.checked ? "done" : "open" });
                    }}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 500,
                      fontSize: 13,
                      textDecoration: isCompleted ? "line-through" : "none",
                      color: isCompleted ? "var(--bms-text-2)" : "var(--bms-text)",
                    }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 2 }}>
                      {t.start_date || t.due_date ? `Dates: ${t.start_date || "—"} to ${t.due_date || "—"}` : ""}
                      {t.start_time ? ` • ${t.start_time.slice(0, 5)}${t.end_time ? ` - ${t.end_time.slice(0, 5)}` : ""}` : ""}
                    </div>
                    {(t.assignees_data && t.assignees_data.length > 0) ? (
                      <div style={{ fontSize: 10, color: "var(--bms-text-2)", marginTop: 1 }}>
                        👤 {t.assignees_data.map(a => a.full_name).join(", ")}
                      </div>
                    ) : t.assignee_name ? (
                      <div style={{ fontSize: 10, color: "var(--bms-text-2)", marginTop: 1 }}>
                        👤 {t.assignee_name}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                      <Tag
                        color={t.workflow_state_color || (isCompleted ? "green" : "blue")}
                        style={{ fontSize: 9, margin: 0 }}
                      >
                        {t.workflow_state_name || t.workflow_state_slug || t.workflow_state || (isCompleted ? "Done" : "Open")}
                      </Tag>
                      <Tag color={t.priority === "HIGH" ? "red" : t.priority === "MEDIUM" ? "orange" : "default"} style={{ fontSize: 9, margin: 0 }}>
                        {t.priority}
                      </Tag>
                    </div>
                  </div>
                  <Popconfirm title="Delete this task?" onConfirm={() => deleteMut.mutate(t.id)}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              );
            })
      )}

      {adding && (
        <div style={{ border: "1px solid var(--bms-border)", background: "var(--bms-surface)", borderRadius: 8, padding: 14, marginTop: 12 }}>
          <Form form={form} layout="vertical" size="small">
            <Form.Item name="title" label="Task Title" rules={[{ required: true }]}>
              <Input placeholder="Task title..." />
            </Form.Item>
            <Form.Item name="assignees" label="Assignee(s)" rules={[{ required: true, message: "Please select an assignee" }]}>
              <Select mode="multiple" placeholder="Select employee assignees" showSearch optionFilterProp="children">
                {employees.map(e => (
                  <Option key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_code || "Staff"})
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
                <Select>
                  <Option value="HIGH">High</Option>
                  <Option value="MEDIUM">Medium</Option>
                  <Option value="LOW">Low</Option>
                </Select>
              </Form.Item>
              <Form.Item name="date_range" label="Date Range" initialValue={[dayjs(), dayjs().add(2, 'day')]} rules={[{ required: true }]}>
                <DatePicker.RangePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
              </Form.Item>
              <Form.Item name="start_time" label="Start Time">
                <ClockTimePicker placeholder="Start time" />
              </Form.Item>
              <Form.Item name="end_time" label="End Time">
                <ClockTimePicker placeholder="End time" />
              </Form.Item>
            </div>
            <Form.Item name="description" label="Description">
              <TextArea rows={2} placeholder="Task description..." />
            </Form.Item>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="primary" size="small" onClick={handleAdd} loading={createMut.isPending}>Save</Button>
              <Button size="small" onClick={() => { setAdding(false); form.resetFields(); }}>Cancel</Button>
            </div>
          </Form>
        </div>
      )}

      {!adding && (
        <Button icon={<PlusOutlined />} type="dashed" block style={{ marginTop: 12 }} onClick={() => { form.resetFields(); setAdding(true); }}>
          Add Task
        </Button>
      )}
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────
function DocumentsTab({ leadId }: { leadId: string }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <CrmSharedDocumentsManager
        leadId={leadId}
        compact={true}
        title="Lead Documents"
        description="Shared documents associated with this lead/opportunity."
      />
    </div>
  );
}

// ─── Main Drawer ─────────────────────────────────────────────────────────────

interface DrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  contextType?: "sales" | "lead";
}

export default function LeadDetailsDrawer({ lead, onClose, onEdit, contextType = "sales" }: DrawerProps) {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const convertMut = useMutation({
    mutationFn: () => convertLead(lead!.id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      message.success(updated.is_converted ? "Lead converted to client" : "Conversion unlinked");
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Conversion failed")),
  });

  if (!lead) return null;

  const tabItems = [
    {
      key: "overview",
      label: "Overview",
      children: (
        <div style={{ padding: "16px 0" }}>
          <div className="lead-detail-section">
            <h4>Project Details</h4>
            <InfoRow label="Project Name" value={lead.institution_name} />
            <InfoRow label="Client Name" value={lead.client_name} />
            <InfoRow label="Company Name" value={lead.company} />
            <InfoRow label="Business Type" value={lead.business_type_name} />
            <InfoRow label="Billing Type" value={lead.billing_type_name} />
          </div>
          <div className="lead-detail-section">
            <h4>Contact Info</h4>
            <InfoRow label="Contact Person" value={lead.contact_person} />
            <InfoRow label="Designation" value={lead.designation} />
            <InfoRow label="Mobile Number" value={lead.phone} />
            <InfoRow label="WhatsApp" value={lead.whatsapp} />
            <InfoRow label="Email" value={lead.email} />
          </div>
          <div className="lead-detail-section">
            <h4>Deal Info</h4>
            <InfoRow label="Expected Value"
              value={`₹${parseFloat(lead.expected_deal_value || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
            <InfoRow label="Next Follow-up" value={lead.next_followup_date || ""} />
          </div>
          {lead.is_converted && (
            <div className="lead-detail-section">
              <h4>Conversion</h4>
              <div className="lead-detail-row">
                <span className="lead-detail-label">CRM Client</span>
                <span className="lead-detail-value converted-badge">
                  <CheckCircleOutlined /> {lead.converted_client_name}
                </span>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "followups",
      label: "Follow-ups",
      children: <div style={{ padding: "16px 0" }}><FollowUpsTab leadId={lead.id} contextType={contextType} /></div>,
    },
    {
      key: "tasks",
      label: "Tasks",
      children: <div style={{ padding: "16px 0" }}><TasksTab leadId={lead.id} contextType={contextType} /></div>,
    },
    {
      key: "documents",
      label: "Documents",
      children: <div style={{ padding: "16px 0" }}><DocumentsTab leadId={lead.id} /></div>,
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{lead.institution_name}</span>
            <Tag color={STATUS_COLORS[lead.status] || "default"} style={{ borderRadius: 20, fontSize: 11 }}>
              {STATUS_LABELS[lead.status] || lead.status}
            </Tag>
            <Tag color={PRIORITY_COLORS[lead.priority] || "default"} style={{ borderRadius: 20, fontSize: 11 }}>
              {lead.priority}
            </Tag>
          </div>
          {(lead.client_name || lead.company) && (
            <div style={{ fontSize: 12, color: "var(--bms-text-2)", fontWeight: 400 }}>
              {lead.client_name && <span>{lead.client_name}</span>}
              {lead.client_name && lead.company && <span style={{ margin: "0 6px" }}>·</span>}
              {lead.company && <span>{lead.company}</span>}
            </div>
          )}
        </div>
      }
      open={!!lead}
      onClose={onClose}
      width={520}
      className="lead-details-drawer"
      extra={
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<EditOutlined />} onClick={() => onEdit(lead)} size="small">Edit</Button>
          <Button
            icon={<SwapOutlined />}
            size="small"
            type={lead.is_converted ? "default" : "primary"}
            onClick={() => convertMut.mutate()}
            loading={convertMut.isPending}
          >
            {lead.is_converted ? "Unlink Client" : "Convert to Client"}
          </Button>
        </div>
      }
    >
      <Tabs items={tabItems} size="small" />
    </Drawer>
  );
}
