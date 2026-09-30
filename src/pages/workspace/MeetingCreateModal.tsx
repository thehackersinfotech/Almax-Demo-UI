import { useEffect, useState, useMemo } from "react";
import {
  Modal, Form, Input, Select, DatePicker, Row, Col, Divider, Typography, message, Tooltip, Button,
} from "antd";
import {
  PhoneOutlined, MailOutlined, CalendarOutlined, WhatsAppOutlined, EnvironmentOutlined,
  VideoCameraOutlined, TeamOutlined, PlusOutlined, CheckSquareOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { meetingApi, type MeetingCreate, type MeetingItem, MEETING_PRIORITIES } from "@/services/meetings";
import { followupTypeApi } from "@/services/master";

import { apiErrorMsg } from "@/utils/apiError";
import { get } from "@/services/api";
import { ENDPOINTS } from "@/constants/api";
import { useAuthStore } from "@/store/auth";
import { isTimeWindowInvalid } from "@/pages/workspace/workspaceDateRules";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import GoogleColorPicker from "@/components/common/GoogleColorPicker";
import { extractCustomColor } from "./workspaceCalendarTheme";
import ClockTimePicker from "@/components/common/ClockTimePicker";

const { TextArea } = Input;
const { Text } = Typography;



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

export default function MeetingCreateModal({
  open,
  dueDate,
  onClose,
  onCreated,
  editItem,
  defaultType,
}: {
  open: boolean;
  dueDate?: string | null;
  onClose: () => void;
  onCreated?: () => void;
  editItem?: MeetingItem | null;
  /** Lock the type field to this value (e.g. "MEETING" when scheduling from the Meetings page) */
  defaultType?: string;
}) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const isEditing = Boolean(editItem);

  

  



  const { data: employees } = useQuery({
    queryKey: ["employees-dropdown"],
    queryFn: () => get<Array<{ id: string; full_name: string }>>(ENDPOINTS.EMPLOYEES_DROPDOWN),
    staleTime: 60_000,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editItem) {
      const { color, cleanText } = extractCustomColor(editItem.comments);
      form.setFieldsValue({
        title: editItem.title,
        
        priority: editItem.priority || "MEDIUM",
        description: editItem.description,
        content: editItem.content,
        comments: cleanText,
        color: color,
        assignees: editItem.assignees || [],
        date_range: [
          editItem.start_date ? dayjs(editItem.start_date) : null,
          editItem.end_date ? dayjs(editItem.end_date) : null,
        ],
        start_time: editItem.start_time ? dayjs(`2000-01-01T${editItem.start_time}`) : null,
        end_time: editItem.end_time ? dayjs(`2000-01-01T${editItem.end_time}`) : null,
        meeting_mode: editItem.meeting_mode || null,
      });
    } else {
      const initialType = defaultType || "CALL";
      form.setFieldsValue({
        priority: "MEDIUM",
        meeting_mode: "ONLINE",
        date_range: dueDate ? [dayjs(dueDate), dayjs(dueDate)] : [null, null],
        assignees: userId ? [userId] : [],
        color: null,
      });
    }
  }, [open, dueDate, editItem, userId, form]);

  const createMutation = useMutation({
    mutationFn: (data: MeetingCreate) => meetingApi.create(data),
    onSuccess: () => {
      message.success("Meeting scheduled");
      form.resetFields();
      qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings-board"] });
      qc.invalidateQueries({ queryKey: ["meetings-list"] });
      qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
      onCreated?.();
      onClose();
    },
    onError: (error: any) => {
      message.error(apiErrorMsg(error, "Failed to schedule meeting"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MeetingCreate> }) => meetingApi.update(id, data),
    onSuccess: () => {
      message.success("Meeting updated");
      form.resetFields();
      qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
      qc.invalidateQueries({ queryKey: ["meetings-board"] });
      qc.invalidateQueries({ queryKey: ["meetings-list"] });
      qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
      onCreated?.();
      onClose();
    },
    onError: (error: any) => {
      message.error(apiErrorMsg(error, "Failed to update meeting"));
    },
  });

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const [startDate, endDate] = values.date_range ?? [null, null];
      const startTimeStr = values.start_time ? values.start_time.format("HH:mm:ss") : null;
      const endTimeStr = values.end_time ? values.end_time.format("HH:mm:ss") : null;
      const [sDate, eDate] = values.date_range ?? [null, null];

      // Check if time window is invalid (end datetime before start datetime)
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
        type: "MEETING",
        priority: values.priority || "MEDIUM",
        description: values.description || "",
        content: editItem?.content || "",
        comments: finalComments,
        assignees,
        start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
        end_date: endDate ? endDate.format("YYYY-MM-DD") : null,
        start_time: startTimeStr,
        end_time: endTimeStr,
        meeting_mode: values.meeting_mode || null,
      };
      if (isEditing && editItem) {
        updateMutation.mutate({ id: editItem.id, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    }).catch((errorInfo) => {
      if (errorInfo.errorFields && errorInfo.errorFields.length > 0) {
        form.scrollToField(errorInfo.errorFields[0].name, { behavior: "smooth", block: "center" });
      }
    });
  };


  return (
    <Modal
      title={editItem ? "Edit Meeting" : (dueDate ? `Schedule Meeting · ${dayjs(dueDate).format("ddd, DD MMM YYYY")}` : "Schedule Meeting")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleSubmit}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={editItem ? "Save changes" : "Schedule meeting"}
      width={600}
      centered
      destroyOnHidden
      styles={{
        content: { maxHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column" },
        body: { paddingTop: 8, overflowY: "auto", flex: "1 1 auto" },
      }}
    >
      <Form form={form} layout="vertical" initialValues={{ type: defaultType || "CALL", priority: "MEDIUM", color: "#98b7e2" }}>
        <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
          <Input placeholder="e.g. Client call — project scope review" size="large" />
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
                      // When both dates are set, compare combined Date+Time objects.
                      // Extract only hour/minute from the TimePicker (discard its "today" date).
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
        <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
          <PriorityPicker />
        </Form.Item>

        <Form.Item
          name="meeting_mode"
          label="Meeting Mode"
          rules={[{ required: true, message: "Please select Online or Offline meeting mode" }]}
          style={{ marginBottom: 16 }}
        >
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
        <Divider style={{ margin: "4px 0 16px" }} />
        <Form.Item name="description" label="Description" rules={[{ required: true, message: "Description is required" }]}>
          <TextArea rows={3} placeholder="What needs to be done?" showCount maxLength={500} />
        </Form.Item>
        <Form.Item name="comments" label="Comment">
          <TextArea rows={3} placeholder="Detailed comment" />
        </Form.Item>

        <Form.Item name="color" label="Event Color" style={{ marginBottom: 0 }}>
          <GoogleColorPicker />
        </Form.Item>
      </Form>

    </Modal>
  );
}
