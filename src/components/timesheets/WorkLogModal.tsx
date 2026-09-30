import { useEffect, useMemo } from "react";
import { Modal, Form, DatePicker, Select, InputNumber, Input, Alert, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { sundayOf } from "@/utils/weekDates";
import {
  timesheetApi,
  CATEGORY_OPTIONS,
  type WorkLog,
  type WorkLogCreate,
} from "@/services/timesheets";

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (values: WorkLogCreate) => Promise<void>;
  initial?: WorkLog | null;
  defaultDate?: string;
  loading?: boolean;
}

export default function WorkLogModal({
  open, onClose, onSave, initial, defaultDate, loading,
}: Props) {
  const [form] = Form.useForm();
  const logDate: Dayjs | undefined = Form.useWatch("log_date", form);

  const resolvedDate = useMemo(() => {
    if (logDate) return logDate;
    if (defaultDate) return dayjs(defaultDate);
    return dayjs();
  }, [logDate, defaultDate]);

  const dateStr = resolvedDate.format("YYYY-MM-DD");
  const monthStart = resolvedDate.startOf("month").format("YYYY-MM-DD");
  const monthEnd = resolvedDate.endOf("month").format("YYYY-MM-DD");

  const { data: loggableDatesData } = useQuery({
    queryKey: ["loggable-dates", monthStart, monthEnd],
    queryFn: () => timesheetApi.loggableDates(monthStart, monthEnd),
    enabled: open,
    staleTime: 60_000,
  });

  const loggableDateSet = useMemo(
    () => new Set(loggableDatesData?.dates ?? []),
    [loggableDatesData],
  );

  const currentWeekEnd = useMemo(() => sundayOf().add(6, "day"), []);
  const isInCurrentWeek = (d: Dayjs) =>
    !d.isBefore(sundayOf(), "day") && !d.isAfter(currentWeekEnd, "day");

  const { data: ticketData, isLoading: ticketsLoading } = useQuery({
    queryKey: ["loggable-tickets", dateStr],
    queryFn: () => timesheetApi.loggableTickets(dateStr),
    enabled: open,
    staleTime: 30_000,
  });

  const tickets = ticketData?.tickets ?? [];
  const hints = ticketData?.hints ?? [];

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        log_date: dayjs(initial.log_date),
        ticket: initial.ticket,
        hours: initial.hours,
        description: initial.description,
        remarks: initial.remarks,
        category: initial.category || "BILLABLE",
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        log_date: defaultDate ? dayjs(defaultDate) : dayjs(),
        category: "BILLABLE",
      });
    }
  }, [open, initial, defaultDate, form]);

  // Clear ticket if it falls off the list after date change
  useEffect(() => {
    if (!open || !tickets.length) return;
    const current = form.getFieldValue("ticket");
    if (current && !tickets.some((t) => t.id === current)) {
      form.setFieldValue("ticket", undefined);
    }
  }, [open, tickets, form]);

  const handleOk = async () => {
    const v = await form.validateFields();
    await onSave({
      ticket: v.ticket,
      log_date: v.log_date.format("YYYY-MM-DD"),
      hours: v.hours,
      description: v.description || "",
      remarks: v.remarks || "",
      category: v.category,
    });
  };

  return (
    <Modal
      title={initial ? "Edit Work Log" : "Log Time"}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      width={560}
      destroyOnHidden
      okText={initial ? "Save" : "Log time"}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="log_date" label="Date" rules={[{ required: true }]}>
          <DatePicker
            style={{ width: "100%" }}
            format="DD MMM YYYY"
            disabledDate={(d) =>
              !isInCurrentWeek(d)
              || d.isAfter(dayjs(), "day")
              || !loggableDateSet.has(d.format("YYYY-MM-DD"))
            }
          />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: -12, marginBottom: 12 }}>
          Only the current week can be logged. Leave and holiday days are excluded.
        </Text>

        {hints.length > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Why no tickets?"
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {hints.map((h) => <li key={h}>{h}</li>)}
              </ul>
            }
          />
        )}

        <Form.Item name="ticket" label="Ticket" rules={[{ required: true, message: "Select a ticket" }]}>
          <Select
            showSearch
            loading={ticketsLoading}
            placeholder="Search project tickets…"
            optionLabelProp="label"
            filterOption={(input, opt) =>
              (opt?.searchLabel as string ?? "").toLowerCase().includes(input.toLowerCase())
            }
            notFoundContent={
              ticketsLoading ? "Loading…" : (
                <div style={{ padding: "8px 0", textAlign: "center" }}>
                  <Text type="secondary">No tickets on this date</Text>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                    You must be allocated to the project.
                  </div>
                </div>
              )
            }
            options={tickets.map((t) => ({
              value: t.id,
              label: `${t.ticket_id} · ${t.title}`,
              searchLabel: `${t.ticket_id} ${t.title} ${t.project_name}`,
            }))}
            optionRender={(opt) => {
              const t = tickets.find((x) => x.id === opt.value);
              if (!t) return opt.label;
              return (
                <div style={{ padding: "4px 0" }}>
                  <div style={{ fontWeight: 500, lineHeight: 1.4 }}>
                    <span style={{ color: "#4f46e5", marginRight: 6 }}>{t.ticket_id}</span>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.3 }}>
                    {t.project_name} · {t.type}
                  </div>
                </div>
              );
            }}
            labelRender={(opt) => {
              const t = tickets.find((x) => x.id === opt.value);
              const id = t?.ticket_id ?? initial?.ticket_id;
              const title = t?.title ?? initial?.ticket_title;
              if (!id) return <span>{opt.label}</span>;
              return (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ color: "#4f46e5", marginRight: 6 }}>{id}</span>
                  {title}
                </span>
              );
            }}
          />
        </Form.Item>

        <Form.Item name="hours" label="Duration (hours)" rules={[{ required: true }]}>
          <InputNumber min={0.25} max={24} step={0.25} style={{ width: "100%" }} addonAfter="h" />
        </Form.Item>

        <Form.Item name="category" label="Category" rules={[{ required: true }]}>
          <Select options={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </Form.Item>

        <Form.Item name="description" label="Work Description">
          <Input.TextArea rows={2} placeholder="What did you work on?" />
        </Form.Item>

        <Form.Item name="remarks" label="Remarks">
          <Input placeholder="Optional notes" />
        </Form.Item>
      </Form>

      {initial?.warnings && Object.keys(initial.warnings).length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Capacity warning"
          description={Object.values(initial.warnings).join(" ")}
          style={{ marginTop: 8 }}
        />
      )}
    </Modal>
  );
}
