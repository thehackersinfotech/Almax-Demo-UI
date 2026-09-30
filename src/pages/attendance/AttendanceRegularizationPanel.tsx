import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Modal, Form, DatePicker, Select, TimePicker, Input,
  Table, Tag, Typography, Space, Alert, Divider, message, Tooltip,
} from "antd";
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { get, post } from "@/services/api";
import { useAuthStore } from "@/store/auth";

const { Text } = Typography;
const { TextArea } = Input;

interface RegRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  date: string;
  reason: string;
  reason_label: string;
  requested_status: string;
  check_in: string | null;
  check_out: string | null;
  remarks: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewer_remarks: string;
  reviewed_by: string | null;
  created_at: string | null;
}

const REASON_OPTIONS = [
  { value: "FORGOT_CHECKIN",  label: "Forgot to Check-In" },
  { value: "FORGOT_CHECKOUT", label: "Forgot to Check-Out" },
  { value: "SYSTEM_ERROR",    label: "System / Technical Error" },
  { value: "WFH_MISSED",      label: "WFH Not Marked" },
  { value: "OTHER",           label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "PRESENT",  label: "Present" },
  { value: "WFH",      label: "Work From Home" },
  { value: "HALF_DAY", label: "Half Day" },
];

const STATUS_COLOR: Record<string, string> = {
  PENDING:  "orange",
  APPROVED: "green",
  REJECTED: "red",
};

// ─── Employee: My Regularization Requests ────────────────────────────────────
export function MyRegularizationRequests() {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: requests = [], isLoading } = useQuery<RegRequest[]>({
    queryKey: ["my-regularization"],
    queryFn: () => get("/attendance/regularization/"),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => {
      const payload: any = {
        date:             values.date.format("YYYY-MM-DD"),
        reason:           values.reason,
        requested_status: values.requested_status,
        remarks:          values.remarks || "",
      };
      if (values.check_in)  payload.check_in  = values.check_in.format("HH:mm");
      if (values.check_out) payload.check_out = values.check_out.format("HH:mm");
      return post("/attendance/regularization/", payload);
    },
    onSuccess: () => {
      message.success("Regularization request submitted to the Project Manager.");
      form.resetFields();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["my-regularization"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Failed to submit request.");
    },
  });

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (d: string) => dayjs(d).format("DD MMM YYYY"),
    },
    {
      title: "Reason",
      dataIndex: "reason_label",
      key: "reason_label",
    },
    {
      title: "Check-In",
      dataIndex: "check_in",
      key: "check_in",
      width: 90,
      render: (t: string | null) => t ?? "—",
    },
    {
      title: "Check-Out",
      dataIndex: "check_out",
      key: "check_out",
      width: 90,
      render: (t: string | null) => t ?? "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: string) => <Tag style={{ whiteSpace: "nowrap" }} color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: "Reviewer Note",
      dataIndex: "reviewer_remarks",
      key: "reviewer_remarks",
      render: (r: string) => r || "—",
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ fontSize: 13, color: "var(--bms-text-2)" }}>
          If you forgot to check-in or check-out, raise a regularization request to your Project Manager.
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Request Regularization
        </Button>
      </div>

      <Table
        dataSource={requests}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: "No regularization requests yet." }}
      />

      {/* ── New Request Modal ─────────────────────────────────────────────── */}
      <Modal
        open={open}
        title={<><ClockCircleOutlined /> Request Attendance Regularization</>}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Submit to PM"
        okButtonProps={{ loading: createMutation.isPending }}
        centered
        width={520}
      >
        <Alert
          type="info"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="Your request will be sent to the Project Manager for approval. On approval, your attendance will be updated automatically."
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={createMutation.mutate}
          initialValues={{ requested_status: "PRESENT", reason: "FORGOT_CHECKIN" }}
        >
          <Form.Item name="date" label="Date" rules={[{ required: true, message: "Please select the date" }]}>
            <DatePicker
              style={{ width: "100%" }}
              disabledDate={(d) => d && d.isAfter(dayjs(), "day")}
              format="DD MMM YYYY"
            />
          </Form.Item>

          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Select options={REASON_OPTIONS} placeholder="Select reason" />
          </Form.Item>

          <Form.Item name="requested_status" label="Mark Attendance As" rules={[{ required: true }]}>
            <Select options={STATUS_OPTIONS} placeholder="Select status" />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="check_in" label="Check-In Time (optional)">
              <TimePicker format="HH:mm" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="check_out" label="Check-Out Time (optional)">
              <TimePicker format="HH:mm" style={{ width: "100%" }} />
            </Form.Item>
          </div>

          <Form.Item name="remarks" label="Additional Remarks">
            <TextArea rows={3} placeholder="Any additional information..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}


// ─── PM / HR Admin: Review Regularization Requests ───────────────────────────
export function RegularizationAdminPanel() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState<RegRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [reviewerRemarks, setReviewerRemarks] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ count: number; results: RegRequest[]; pending_count: number }>({
    queryKey: ["regularization-admin"],
    queryFn: () => get("/attendance/regularization/admin/"),
    staleTime: 30_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action, remarks }: { id: string; action: string; remarks: string }) =>
      post(`/attendance/regularization/${id}/review/`, { action, reviewer_remarks: remarks }),
    onSuccess: (_data, vars) => {
      const approved = vars.action === "APPROVE";
      message.success(
        approved
          ? "Approved. Attendance record updated automatically."
          : "Request rejected.",
      );
      setReviewOpen(false);
      setReviewerRemarks("");
      qc.invalidateQueries({ queryKey: ["regularization-admin"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Action failed.");
    },
  });

  const openReview = (req: RegRequest, action: "APPROVE" | "REJECT") => {
    setSelected(req);
    setReviewAction(action);
    setReviewOpen(true);
  };

  const columns = [
    {
      title: "Employee",
      key: "employee",
      render: (r: RegRequest) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.employee_name}</div>
          <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{r.employee_code}</div>
        </div>
      ),
    },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (d: string) => dayjs(d).format("DD MMM YYYY"),
    },
    {
      title: "Reason",
      dataIndex: "reason_label",
      key: "reason_label",
    },
    {
      title: "Requested As",
      dataIndex: "requested_status",
      key: "requested_status",
      width: 110,
    },
    {
      title: "Check-In",
      dataIndex: "check_in",
      key: "check_in",
      width: 80,
      render: (t: string | null) => t ?? "—",
    },
    {
      title: "Check-Out",
      dataIndex: "check_out",
      key: "check_out",
      width: 80,
      render: (t: string | null) => t ?? "—",
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      ellipsis: true,
      render: (r: string) => <Tooltip title={r}>{r || "—"}</Tooltip>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: string) => <Tag style={{ whiteSpace: "nowrap" }} color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: "Action",
      key: "action",
      width: 140,
      render: (r: RegRequest) =>
        r.status === "PENDING" ? (
          <Space size={4}>
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => openReview(r, "APPROVE")}
            >
              Approve
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => openReview(r, "REJECT")}
            >
              Reject
            </Button>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.reviewed_by ? `By ${r.reviewed_by}` : "Reviewed"}
          </Text>
        ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        {(data?.pending_count ?? 0) > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`${data!.pending_count} regularization request${data!.pending_count > 1 ? "s" : ""} pending your review.`}
            style={{ marginBottom: 12, borderRadius: 8 }}
          />
        )}
      </div>

      <Table
        dataSource={data?.results ?? []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: false }}
        locale={{ emptyText: "No regularization requests." }}
      />

      {/* ── Review Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={reviewOpen}
        title={
          reviewAction === "APPROVE"
            ? <><CheckCircleOutlined style={{ color: "#22c55e" }} /> Approve Regularization</>
            : <><CloseCircleOutlined style={{ color: "#ef4444" }} /> Reject Regularization</>
        }
        onCancel={() => { setReviewOpen(false); setReviewerRemarks(""); }}
        onOk={() => {
          if (!selected) return;
          reviewMutation.mutate({ id: selected.id, action: reviewAction, remarks: reviewerRemarks });
        }}
        okText={reviewAction === "APPROVE" ? "Approve & Update Attendance" : "Reject Request"}
        okButtonProps={{
          loading: reviewMutation.isPending,
          danger: reviewAction === "REJECT",
        }}
        centered
        width={480}
      >
        {selected && (
          <>
            <div style={{
              background: "var(--bms-surface-2)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 14,
              fontSize: 13,
            }}>
              <div><b>Employee:</b> {selected.employee_name} ({selected.employee_code})</div>
              <div><b>Date:</b> {dayjs(selected.date).format("DD MMM YYYY")}</div>
              <div><b>Reason:</b> {selected.reason_label}</div>
              <div><b>Requested as:</b> {selected.requested_status}</div>
              {selected.check_in  && <div><b>Check-In:</b>  {selected.check_in}</div>}
              {selected.check_out && <div><b>Check-Out:</b> {selected.check_out}</div>}
              {selected.remarks   && <div><b>Remarks:</b>   {selected.remarks}</div>}
            </div>

            {reviewAction === "APPROVE" ? (
              <Alert
                type="success"
                showIcon
                message="Approving will auto-create or update this employee's attendance record for the selected date."
                style={{ marginBottom: 12, borderRadius: 8 }}
              />
            ) : (
              <Alert
                type="error"
                showIcon
                message="The employee will be notified that their request was rejected."
                style={{ marginBottom: 12, borderRadius: 8 }}
              />
            )}

            <Text type="secondary" style={{ fontSize: 12 }}>Reviewer Remarks (optional)</Text>
            <TextArea
              rows={2}
              value={reviewerRemarks}
              onChange={(e) => setReviewerRemarks(e.target.value)}
              placeholder="Add remarks..."
              style={{ marginTop: 6, borderRadius: 8 }}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
