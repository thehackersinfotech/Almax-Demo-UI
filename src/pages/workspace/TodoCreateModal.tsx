import { useEffect } from "react";
import { Modal, Form, Input, Select, DatePicker, TimePicker, Row, Col, message, Tooltip } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { todoApi, type TodoCreate, TODO_PRIORITIES } from "@/services/todos";
import { get } from "@/services/api";
import { ENDPOINTS } from "@/constants/api";
import { fetchLeads, type Lead } from "@/services/leads";
import { useAuthStore } from "@/store/auth";
import { isTimeWindowInvalid } from "@/pages/workspace/workspaceDateRules";
import { apiErrorMsg } from "@/utils/apiError";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import GoogleColorPicker from "@/components/common/GoogleColorPicker";
import ClockTimePicker from "@/components/common/ClockTimePicker";

const { TextArea } = Input;

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



export default function TodoCreateModal({
  open,
  dueDate,
  onClose,
  onCreated,
}: {
  open: boolean;
  dueDate?: string | null;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: employees } = useQuery({
    queryKey: ["employees-dropdown"],
    queryFn: () => get<Array<{ id: string; full_name: string }>>(ENDPOINTS.EMPLOYEES_DROPDOWN),
    staleTime: 60_000,
    enabled: open,
  });

  const { data: leadsData } = useQuery({
    queryKey: ["leads-dropdown-all"],
    queryFn: () => fetchLeads({}),
    staleTime: 60_000,
    enabled: open,
  });
  const leads: Lead[] = leadsData?.results ?? [];

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      priority: "MEDIUM",
      date_range: dueDate ? [dayjs(dueDate), dayjs(dueDate)] : [null, null],
      assignees: userId ? [userId] : [],
      lead: undefined,
      color: null,
    });
  }, [open, dueDate, userId, form]);

  const createMutation = useMutation({
    mutationFn: (data: TodoCreate) => todoApi.create(data),
    onSuccess: (_, variables) => {
      message.success("To-do created");
      form.resetFields();
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
      onCreated?.();
      onClose();
    },
    onError: (err: any) => {
      message.error(apiErrorMsg(err, "Failed to create to-do"));
    },
  });

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const [startDate, endDate] = values.date_range ?? [null, null];
      const startDateStr = startDate ? startDate.format("YYYY-MM-DD") : null;
      const endDateStr = endDate ? endDate.format("YYYY-MM-DD") : null;
      const startTime = values.start_time;
      const endTime = values.end_time;
      const startTimeStr = startTime
        ? (typeof startTime.format === "function"
            ? startTime.format("HH:mm:ss")
            : typeof startTime === "string" && startTime.trim()
            ? startTime.trim()
            : null)
        : null;
      const endTimeStr = endTime
        ? (typeof endTime.format === "function"
            ? endTime.format("HH:mm:ss")
            : typeof endTime === "string" && endTime.trim()
            ? endTime.trim()
            : null)
        : null;

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
        start_date: startDateStr,
        due_date: endDateStr,
        start_time: startTimeStr,
        end_time: endTimeStr,
        comments: values.comments || "",
        lead: values.lead || undefined,
        source,
      };
      createMutation.mutate(payload);
    });
  };

  return (
    <Modal
      title={dueDate ? `Add To-Do · ${dayjs(dueDate).format("ddd, DD MMM YYYY")}` : "Add To-Do"}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={createMutation.isPending}
      okText="Create to-do"
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
  );
}
