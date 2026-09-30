import { useEffect, useState, useMemo } from "react";
import {
  Modal, Form, Input, Select, DatePicker, Row, Col, message, Tooltip, Divider, Button, Typography,
} from "antd";
import {
  CheckOutlined, PhoneOutlined, TeamOutlined,
  MailOutlined, CalendarOutlined, WhatsAppOutlined, EnvironmentOutlined,
  VideoCameraOutlined, PlusOutlined, CheckSquareOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { todoApi, type TodoCreate, TODO_PRIORITIES } from "@/services/todos";
import { followUpApi, type FollowUpCreate, FOLLOWUP_PRIORITIES } from "@/services/followups";
import { meetingApi, type MeetingCreate } from "@/services/meetings";
import { followupTypeApi } from "@/services/master";
import { fetchLeads, type Lead } from "@/services/leads";
import { apiErrorMsg } from "@/utils/apiError";
import { get } from "@/services/api";
import { ENDPOINTS } from "@/constants/api";
import { useAuthStore } from "@/store/auth";
import { isTimeWindowInvalid } from "@/pages/workspace/workspaceDateRules";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import GoogleColorPicker from "@/components/common/GoogleColorPicker";
import ClockTimePicker from "@/components/common/ClockTimePicker";

const { TextArea } = Input;

type EventTab = "todo" | "followup" | "meeting";

const TAB_OPTIONS = [
  { label: "To-Do", value: "todo" as EventTab, icon: <CheckOutlined /> },
  { label: "Follow-up", value: "followup" as EventTab, icon: <PhoneOutlined /> },
  { label: "Meeting", value: "meeting" as EventTab, icon: <TeamOutlined /> },
];

const FOLLOWUP_TYPE_OPTIONS = [
  { value: "EMAIL", label: "Email", icon: <MailOutlined /> },
  { value: "CALL", label: "Call", icon: <PhoneOutlined /> },
  { value: "MEETING", label: "Meeting", icon: <CalendarOutlined /> },
  { value: "WHATSAPP", label: "WhatsApp", icon: <WhatsAppOutlined /> },
  { value: "SITE_VISIT", label: "Site Visit", icon: <EnvironmentOutlined /> },
];

const MEETING_MODE_OPTIONS = [
  {
    value: "ONLINE",
    label: "Online",
    icon: <VideoCameraOutlined />,
    color: "#3B82F6",
    bg: "rgba(59, 130, 246, 0.1)",
    border: "#3B82F6",
  },
  {
    value: "OFFLINE",
    label: "Offline",
    icon: <TeamOutlined />,
    color: "#0D9488",
    bg: "rgba(13, 148, 136, 0.1)",
    border: "#0D9488",
  },
];

// ─── Priority Picker (shared) ──────────────────────────────────────────────
function PriorityPicker({
  value, onChange, priorities,
}: {
  value?: string;
  onChange?: (v: string) => void;
  priorities: Array<{ value: string; label: string; border: string; bg: string; text: string }>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${priorities.length}, 1fr)`, gap: 8 }}>
      {priorities.map((p) => {
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
              transition: "all 0.15s ease",
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Meeting Mode Picker ───────────────────────────────────────────────────
function MeetingModePicker({ value, onChange }: { value?: string | null; onChange?: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {MEETING_MODE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 10,
              border: `2px solid ${active ? opt.border : "var(--bms-border)"}`,
              background: active ? opt.bg : "var(--bms-surface)",
              color: active ? opt.color : "var(--bms-text-2)",
              fontWeight: active ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: 16 }}>{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tab Content ───────────────────────────────────────────────────────────
function TabContent({
  activeTab,
  onFinish,
}: {
  activeTab: EventTab;
  onFinish: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);

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

  const qc = useQueryClient();

  const createTodoMutation = useMutation({
    mutationFn: (data: TodoCreate) => todoApi.create(data),
    onSuccess: (_, variables) => {
      message.success("To-do created");
      qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
      qc.invalidateQueries({ queryKey: ["todos-board"] });
      qc.invalidateQueries({ queryKey: ["todos-list"] });
      qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
      if (variables.lead) {
        qc.invalidateQueries({ queryKey: ["lead-drawer-todos", variables.lead] });
        if (variables.source === "SALES_MANAGEMENT") {
          qc.invalidateQueries({ queryKey: ["sales-tasks-all"] });
        } else {
          qc.invalidateQueries({ queryKey: ["lead-tasks-all"] });
        }
      }
      onFinish();
    },
    onError: (err: any) => {
      message.error(apiErrorMsg(err, "Failed to create to-do"));
    },
  });

  const createFollowUpMutation = useMutation({
    mutationFn: (data: FollowUpCreate) => followUpApi.create(data),
    onSuccess: () => {
      message.success("Event scheduled");
      qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
      qc.invalidateQueries({ queryKey: ["followups-board"] });
      qc.invalidateQueries({ queryKey: ["followups-list"] });
      qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
      onFinish();
    },
    onError: (error: any) => {
      message.error(apiErrorMsg(error, "Failed to schedule follow-up"));
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: (data: MeetingCreate) => meetingApi.create(data),
    onSuccess: () => {
      message.success("Meeting scheduled");
      qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings-board"] });
      qc.invalidateQueries({ queryKey: ["meetings-list"] });
      qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
      onFinish();
    },
    onError: (error: any) => {
      message.error(apiErrorMsg(error, "Failed to schedule meeting"));
    },
  });

  const handleTodoSubmit = (values: any) => {
    const [startDate, endDate] = values.date_range ?? [null, null];
    const startTime = values.start_time;
    const endTime = values.end_time;
    const startTimeStr = startTime ? startTime.format("HH:mm:ss") : null;
    const endTimeStr = endTime ? endTime.format("HH:mm:ss") : null;
    const assignees = values.assignees && values.assignees.length > 0 ? values.assignees : [];
    
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
      assignees,
      start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
      due_date: endDate ? endDate.format("YYYY-MM-DD") : null,
      start_time: startTimeStr,
      end_time: endTimeStr,
      comments: values.comments || "",
      lead: values.lead || undefined,
      source,
    };
    createTodoMutation.mutate(payload);
  };

  const handleFollowUpSubmit = (values: any, isMeeting: boolean) => {
    const [startDate, endDate] = values.date_range ?? [null, null];
    const startTimeStr = values.start_time ? values.start_time.format("HH:mm:ss") : null;
    const endTimeStr = values.end_time ? values.end_time.format("HH:mm:ss") : null;
    const [sDate, eDate] = values.date_range ?? [null, null];

    if (isTimeWindowInvalid(startTimeStr, endTimeStr, sDate, eDate)) {
      message.error("Enter a valid time range.");
      return;
    }

    const assignees = values.assignees && values.assignees.length > 0 ? values.assignees : [];

    let finalComments = values.comments || "";
    if (values.color) {
      finalComments += ` <!--color:${values.color}-->`;
    }

    const payload: FollowUpCreate = {
      title: values.title,
      type: isMeeting ? "MEETING" : (values.type || "CALL"),
      priority: values.priority || "MEDIUM",
      description: values.description || "",
      content: "",
      comments: finalComments,
      assignees,
      start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
      end_date: endDate ? endDate.format("YYYY-MM-DD") : null,
      start_time: startTimeStr,
      end_time: endTimeStr,
      meeting_mode: isMeeting ? (values.meeting_mode || null) : null,
    };
    createFollowUpMutation.mutate(payload);
  };

  const handleMeetingSubmit = (values: any) => {
    const [startDate, endDate] = values.date_range ?? [null, null];
    const startTimeStr = values.start_time ? values.start_time.format("HH:mm:ss") : null;
    const endTimeStr = values.end_time ? values.end_time.format("HH:mm:ss") : null;
    const [sDate, eDate] = values.date_range ?? [null, null];

    if (isTimeWindowInvalid(startTimeStr, endTimeStr, sDate, eDate)) {
      message.error("Enter a valid time range.");
      return;
    }

    const assignees = values.assignees && values.assignees.length > 0 ? values.assignees : [];

    let finalComments = values.comments || "";
    if (values.color) {
      finalComments += ` <!--color:${values.color}-->`;
    }

    const payload: MeetingCreate = {
      title: values.title,
      priority: values.priority || "MEDIUM",
      description: values.description || "",
      content: values.content || "",
      comments: finalComments,
      assignees,
      start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
      end_date: endDate ? endDate.format("YYYY-MM-DD") : null,
      start_time: startTimeStr,
      end_time: endTimeStr,
      meeting_mode: values.meeting_mode || null,
    };
    createMeetingMutation.mutate(payload);
  };

  switch (activeTab) {
    case "todo":
      return <TodoForm onSubmit={handleTodoSubmit} employees={employees || []} leads={leads} userId={userId} />;
    case "followup":
      return <FollowUpForm onSubmit={(v) => handleFollowUpSubmit(v, false)} employees={employees || []} userId={userId} />;
    case "meeting":
      return <MeetingForm onSubmit={handleMeetingSubmit} employees={employees || []} userId={userId} />;
  }
}

// ─── Todo Form ─────────────────────────────────────────────────────────────
function TodoForm({
  onSubmit,
  employees,
  leads = [],
  userId,
}: {
  onSubmit: (values: any) => void;
  employees: Array<{ id: string; full_name: string }>;
  leads?: Lead[];
  userId?: string;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    form.resetFields();
    form.setFieldsValue({
      priority: "MEDIUM",
      assignees: userId ? [userId] : [],
      lead: undefined,
      color: null,
    });
  }, [form, userId]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      setSubmitting(true);
      onSubmit(values);
      setSubmitting(false);
    }).catch(() => {});
  };

  return (
    <div style={{ paddingTop: 8 }}>
      <Form form={form} layout="vertical" initialValues={{ priority: "MEDIUM" }}>
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
          <PriorityPicker priorities={TODO_PRIORITIES} />
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
            },
          ]}
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
                      if (sDate && eDate) {
                        const sDt = sDate.hour(start.hour()).minute(start.minute()).second(0);
                        const eDt = eDate.hour(end.hour()).minute(end.minute()).second(0);
                        if (eDt.isAfter(sDt)) return Promise.resolve();
                        return Promise.reject(new Error("Enter a valid time range"));
                      }
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
        <Form.Item name="assignees" label="Assignees" rules={[{ required: true, message: "Assignees are required" }]}>
          <Select
            mode="multiple"
            allowClear
            showSearch
            placeholder="Select assignees"
            size="large"
            getPopupContainer={(triggerNode) => (triggerNode.closest('.ant-modal-content') || document.body) as HTMLElement}
            listHeight={220}
            popupMatchSelectWidth={true}
            dropdownStyle={{ zIndex: 1050, overflowY: "auto" }}
            optionFilterProp="label"
            options={employees.map((e) => ({ value: e.id, label: e.full_name }))}
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
        <Form.Item name="description" label="Description" rules={[{ required: true, message: "Description is required" }]}>
          <TextArea rows={3} placeholder="What needs to be done?" />
        </Form.Item>
        <Form.Item name="comments" label="Comment">
          <TextArea rows={3} placeholder="Detailed comment" />
        </Form.Item>
        <Form.Item name="color" label="Event Color">
          <GoogleColorPicker />
        </Form.Item>
      </Form>
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
        <button
          type="button"
          onClick={handleOk}
          disabled={submitting}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: submitting ? "var(--bms-text-3)" : "#6366F1",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {submitting ? "Creating..." : "Create To-Do"}
        </button>
      </div>
    </div>
  );
}

// ─── Follow-up Form ────────────────────────────────────────────────────────
function FollowUpForm({
  onSubmit,
  employees,
  userId,
}: {
  onSubmit: (values: any) => void;
  employees: Array<{ id: string; full_name: string }>;
  userId?: string;
}) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const { data: customFollowupTypes = [] } = useQuery({
    queryKey: ["master-followup-types-dropdown"],
    queryFn: () => followupTypeApi.dropdown(),
    staleTime: 60_000,
  });

  const allTypeOptions = useMemo(() => {
    const optsMap = new Map<string, { value: string; label: string; icon?: React.ReactNode }>();
    FOLLOWUP_TYPE_OPTIONS.forEach((t) => optsMap.set(t.value, t));
    (customFollowupTypes || []).forEach((ct) => {
      const key = ct.slug || ct.name.toUpperCase().replace(/\s+/g, "_");
      if (!optsMap.has(key) && !optsMap.has(ct.name)) {
        optsMap.set(key, {
          value: key,
          label: ct.name,
          icon: <CheckSquareOutlined />,
        });
      }
    });
    return Array.from(optsMap.values());
  }, [customFollowupTypes]);

  const createTypeMutation = useMutation({
    mutationFn: (name: string) => followupTypeApi.create({ name }),
    onSuccess: (data) => {
      message.success(`Follow-up type "${data.name}" created`);
      qc.invalidateQueries({ queryKey: ["master-followup-types-dropdown"] });
      const val = data.slug || data.name.toUpperCase().replace(/\s+/g, "_");
      form.setFieldsValue({ type: val });
      setIsAddTypeModalOpen(false);
      setNewTypeName("");
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Failed to create follow-up type")),
  });

  useEffect(() => {
    form.resetFields();
    form.setFieldsValue({
      type: "CALL",
      priority: "MEDIUM",
      assignees: userId ? [userId] : [],
      color: null,
    });
  }, [form, userId]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      setSubmitting(true);
      onSubmit(values);
      setSubmitting(false);
    }).catch(() => {});
  };

  return (
    <div style={{ paddingTop: 8 }}>
      <Form form={form} layout="vertical" initialValues={{ type: "CALL", priority: "MEDIUM" }}>
        <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
          <Input placeholder="e.g. Client call — project scope review" size="large" />
        </Form.Item>
        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Select
            size="large"
            getPopupContainer={(triggerNode) => (triggerNode.closest('.ant-modal-content') || document.body) as HTMLElement}
            listHeight={220}
            popupMatchSelectWidth={true}
            dropdownStyle={{ zIndex: 1050, overflowY: "auto" }}
            options={allTypeOptions.map((t) => ({ value: t.value, label: t.label }))}
            optionRender={(opt) => (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {allTypeOptions.find((t) => t.value === opt.value)?.icon || <CheckSquareOutlined />}
                {opt.label}
              </span>
            )}
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: "6px 0" }} />
                <div style={{ padding: "4px 8px 6px" }}>
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={() => setIsAddTypeModalOpen(true)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      color: "#2563eb",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    Add New Follow-up Type
                  </Button>
                </div>
              </>
            )}
          />
        </Form.Item>
        <Form.Item
          name="date_range"
          label="Date range"
          rules={[
            { required: true, message: "Date range (start date & end date) is required" },
            {
              validator(_, value) {
                const [start, end] = value ?? [null, null];
                if (!start || !end) {
                  return Promise.reject(new Error("Both start date and end date are required"));
                }
                if (end.isBefore(start, "day")) {
                  return Promise.reject(new Error("End date must be after start date"));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <DatePicker.RangePicker
            style={{ width: "100%" }}
            size="large"
            format="DD MMM YYYY"
            placeholder={["Start date", "End date"]}
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
                      if (sDate && eDate) {
                        const sDt = sDate.hour(start.hour()).minute(start.minute()).second(0);
                        const eDt = eDate.hour(end.hour()).minute(end.minute()).second(0);
                        if (eDt.isAfter(sDt)) return Promise.resolve();
                        return Promise.reject(new Error("Enter a valid time range"));
                      }
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
        <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
          <PriorityPicker priorities={FOLLOWUP_PRIORITIES} />
        </Form.Item>
        <Form.Item name="assignees" label="Assignees" rules={[{ required: true, message: "Assignees are required" }]}>
          <Select
            mode="multiple"
            allowClear
            showSearch
            placeholder="Select assignees"
            size="large"
            getPopupContainer={(triggerNode) => (triggerNode.closest('.ant-modal-content') || document.body) as HTMLElement}
            listHeight={220}
            popupMatchSelectWidth={true}
            dropdownStyle={{ zIndex: 1050, overflowY: "auto" }}
            optionFilterProp="label"
            options={employees.map((e) => ({ value: e.id, label: e.full_name }))}
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
        <Form.Item name="description" label="Description" rules={[{ required: true, message: "Description is required" }]}>
          <TextArea rows={3} placeholder="What needs to be done?" showCount maxLength={500} />
        </Form.Item>
        <Form.Item name="comments" label="Comment">
          <TextArea rows={3} placeholder="Detailed comment" />
        </Form.Item>
        <Form.Item name="color" label="Event Color">
          <GoogleColorPicker />
        </Form.Item>
      </Form>
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
        <button
          type="button"
          onClick={handleOk}
          disabled={submitting}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: submitting ? "var(--bms-text-3)" : "#0D9488",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {submitting ? "Scheduling..." : "Schedule Follow-up"}
        </button>
      </div>

      <Modal
        title="Add New Follow-up Type"
        open={isAddTypeModalOpen}
        onCancel={() => { setIsAddTypeModalOpen(false); setNewTypeName(""); }}
        onOk={() => {
          if (!newTypeName.trim()) {
            message.error("Follow-up type name is required");
            return;
          }
          createTypeMutation.mutate(newTypeName.trim());
        }}
        confirmLoading={createTypeMutation.isPending}
        okText="Create Type"
        width={400}
        centered
      >
        <div style={{ paddingTop: 8 }}>
          <Typography.Text style={{ display: "block", marginBottom: 8, fontSize: 13, color: "var(--bms-text-2)" }}>
            Type Name
          </Typography.Text>
          <Input
            placeholder="e.g. Client Demo, Contract Review"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onPressEnter={() => {
              if (newTypeName.trim()) createTypeMutation.mutate(newTypeName.trim());
            }}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}

// ─── Meeting Form ──────────────────────────────────────────────────────────
function MeetingForm({
  onSubmit,
  employees,
  userId,
}: {
  onSubmit: (values: any) => void;
  employees: Array<{ id: string; full_name: string }>;
  userId?: string;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    form.resetFields();
    form.setFieldsValue({
      priority: "MEDIUM",
      meeting_mode: null,
      assignees: userId ? [userId] : [],
      color: null,
    });
  }, [form, userId]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      setSubmitting(true);
      onSubmit(values);
      setSubmitting(false);
    }).catch(() => {});
  };

  return (
    <div style={{ paddingTop: 8 }}>
      <Form form={form} layout="vertical" initialValues={{ priority: "MEDIUM", meeting_mode: null }}>
        <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
          <Input placeholder="e.g. Sprint planning" size="large" />
        </Form.Item>
        <Form.Item
          name="date_range"
          label="Date range"
          rules={[
            { required: true, message: "Date range (start date & end date) is required" },
            {
              validator(_, value) {
                const [start, end] = value ?? [null, null];
                if (!start || !end) {
                  return Promise.reject(new Error("Both start date and end date are required"));
                }
                if (end.isBefore(start, "day")) {
                  return Promise.reject(new Error("End date must be after start date"));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <DatePicker.RangePicker
            style={{ width: "100%" }}
            size="large"
            format="DD MMM YYYY"
            placeholder={["Start date", "End date"]}
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
                      if (sDate && eDate) {
                        const sDt = sDate.hour(start.hour()).minute(start.minute()).second(0);
                        const eDt = eDate.hour(end.hour()).minute(end.minute()).second(0);
                        if (eDt.isAfter(sDt)) return Promise.resolve();
                        return Promise.reject(new Error("Enter a valid time range"));
                      }
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
        <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
          <PriorityPicker priorities={FOLLOWUP_PRIORITIES} />
        </Form.Item>
        <Form.Item name="meeting_mode" label="Meeting Mode">
          <MeetingModePicker />
        </Form.Item>
        <Form.Item name="assignees" label="Assignees" rules={[{ required: true, message: "Assignees are required" }]}>
          <Select
            mode="multiple"
            allowClear
            showSearch
            placeholder="Select assignees"
            size="large"
            getPopupContainer={(triggerNode) => (triggerNode.closest('.ant-modal-content') || document.body) as HTMLElement}
            listHeight={220}
            popupMatchSelectWidth={true}
            dropdownStyle={{ zIndex: 1050, overflowY: "auto" }}
            optionFilterProp="label"
            options={employees.map((e) => ({ value: e.id, label: e.full_name }))}
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
        <Form.Item name="description" label="Description" rules={[{ required: true, message: "Description is required" }]}>
          <TextArea rows={3} placeholder="Meeting agenda" showCount maxLength={500} />
        </Form.Item>
        <Form.Item name="comments" label="Comment">
          <TextArea rows={3} placeholder="Detailed comment" />
        </Form.Item>
        <Form.Item name="color" label="Event Color">
          <GoogleColorPicker />
        </Form.Item>
      </Form>
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
        <button
          type="button"
          onClick={handleOk}
          disabled={submitting}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: submitting ? "var(--bms-text-3)" : "#1677ff",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {submitting ? "Scheduling..." : "Schedule Meeting"}
        </button>
      </div>
    </div>
  );
}

// ─── Main EventCreateModal ─────────────────────────────────────────────────
export default function EventCreateModal({
  open,
  dueDate,
  onClose,
}: {
  open: boolean;
  dueDate?: string | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<EventTab>("todo");
  const [transitioning, setTransitioning] = useState(false);

  // Reset to To-Do tab when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab("todo");
    }
  }, [open]);

  const handleClose = () => {
    onClose();
  };

  const handleTabChange = (tab: EventTab) => {
    if (tab === activeTab) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTransitioning(false);
    }, 150);
  };

  return (
    <Modal
      title={dueDate ? `Create Event · ${dayjs(dueDate).format("ddd, DD MMM YYYY")}` : "Create Event"}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
      centered
      destroyOnHidden
      styles={{
        content: { maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column" },
        body: { paddingTop: 8, overflowY: "auto", flex: "1 1 auto" },
      }}
    >
      <div style={{
        paddingBottom: 16,
        borderBottom: "1px solid var(--bms-border)",
      }}>
        {/* Segmented Tabs - Google Calendar style */}
        <div style={{
          display: "flex",
          gap: 2,
          background: "var(--bms-surface-2)",
          borderRadius: 10,
          padding: 3,
        }}>
          {TAB_OPTIONS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleTabChange(tab.value)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? "var(--bms-surface)" : "transparent",
                  color: isActive ? "var(--bms-text)" : "var(--bms-text-3)",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <span style={{
                  fontSize: 14,
                  display: "flex",
                  color: isActive
                    ? (tab.value === "todo" ? "#6366F1" : tab.value === "followup" ? "#0D9488" : "#1677ff")
                    : "var(--bms-text-3)",
                }}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <div style={{
        paddingTop: 16,
        opacity: transitioning ? 0.5 : 1,
        transform: transitioning ? "translateY(-4px)" : "translateY(0)",
        transition: "opacity 0.15s ease, transform 0.15s ease",
      }}>
        <TabContent
          key={activeTab}
          activeTab={activeTab}
          onFinish={handleClose}
        />
      </div>
    </Modal>
  );
}
