import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button, DatePicker, Divider, Form, Input, Modal, Select, Typography, message,
  Upload, Alert, Radio,
} from "antd";
import {
  DownloadOutlined, EyeInvisibleOutlined, EyeOutlined, FilePdfOutlined, PlusOutlined,
  WalletOutlined, MedicineBoxOutlined, UploadOutlined, WarningOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { get, post } from "@/services/api";
import type { EmpDashboard } from "./types";

const { Text } = Typography;

interface ModalLeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  leave_type_color: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

function LeaveLimitWarningAlert({
  form,
  balances,
}: {
  form: any;
  balances: ModalLeaveBalance[];
}) {
  const selectedType = Form.useWatch("leave_type", form);
  const leaveDuration = Form.useWatch("leave_duration", form);
  const dates = Form.useWatch("dates", form);
  const singleDate = Form.useWatch("single_date", form);

  const selectedBalance = balances.find(
    (b) => b.leave_type_id === selectedType || b.leave_type_name === selectedType,
  );

  let requestedDays = 0;
  if (leaveDuration === "HALF_DAY") {
    if (singleDate) requestedDays = 0.5;
  } else if (dates && dates[0] && dates[1]) {
    let count = 0;
    let curr = dates[0].clone();
    const end = dates[1].clone();
    while (curr.isBefore(end) || curr.isSame(end, "day")) {
      if (curr.day() !== 0 && curr.day() !== 6) {
        count++;
      }
      curr = curr.add(1, "day");
    }
    requestedDays = count;
  }

  if (!selectedBalance || requestedDays === 0) return null;

  const remaining = selectedBalance.remaining_days ?? 0;
  const isOverLimit = requestedDays > remaining;

  if (!isOverLimit) return null;

  return (
    <Alert
      type="warning"
      showIcon
      icon={<WarningOutlined style={{ color: "#d97706" }} />}
      style={{ marginTop: 8, marginBottom: 14, borderRadius: 8, background: "#fffbeb", borderColor: "#fde68a" }}
      message={
        <Text strong style={{ color: "#b45309", fontSize: 13 }}>
          Leave Limit Warning
        </Text>
      }
      description={
        <Text style={{ color: "#92400e", fontSize: 12, lineHeight: 1.5, display: "block" }}>
          You are applying for leave out of your limit! You have <strong>{remaining} day(s)</strong> available for <strong>{selectedBalance.leave_type_name}</strong>, but are requesting <strong>{requestedDays} day(s)</strong>.
        </Text>
      }
    />
  );
}

export function ApplyLeaveModal({
  open,
  onClose,
  onSuccess,
  balances: passedBalances,
  prefillLeaveTypeId,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  balances?: ModalLeaveBalance[];
  prefillLeaveTypeId?: string | null;
}) {
  const [blockModal, setBlockModal] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [regularForm]   = Form.useForm();
  const [emergencyForm] = Form.useForm();
  const [fileList,      setFileList]      = useState<any[]>([]);
  const [mode, setMode] = useState<"regular" | "emergency">("regular");

  const queryClient = useQueryClient();
  const [newTypeName, setNewTypeName] = useState("");

  const { data: leaveTypes = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["leave-types"],
    queryFn: () => get("/leave/types/"),
    enabled: open,
  });

  const { data: queriedBalances = [] } = useQuery<ModalLeaveBalance[]>({
    queryKey: ["my-leave-balances"],
    queryFn: () => get("/leave/balances/"),
    enabled: open && !passedBalances,
  });

  const balances = passedBalances ?? queriedBalances;

  const selectedType    = Form.useWatch("leave_type", regularForm);
  const selectedBalance = balances.find((b) => b.leave_type_id === selectedType);

  const defaultTypes = [
    { value: "Casual Leave", label: "Casual Leave" },
    { value: "Emergency Leave", label: "Emergency Leave" },
    { value: "Sick Leave", label: "Sick Leave" },
  ];
  const typeOptions = leaveTypes.length > 0
    ? leaveTypes.map((t) => ({ value: t.id, label: t.name }))
    : (balances.length > 0
        ? balances.map((b) => ({ value: b.leave_type_id, label: b.leave_type_name }))
        : defaultTypes);

  const addTypeMutation = useMutation({
    mutationFn: (name: string) => {
      const trimmed = name.trim();
      const words = trimmed.split(/\s+/);
      const code = words.length > 1
        ? words.map(w => w[0]).join("").toUpperCase().slice(0, 5)
        : trimmed.slice(0, 3).toUpperCase();
      const colors = ["#1677ff", "#2f54eb", "#722ed1", "#eb2f96", "#fa8c16", "#faad14", "#52c41a", "#13c2c2", "#fa541c"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return post("/master/leave/my-types/", {
        name: trimmed,
        code,
        is_paid: true,
        color,
        max_days: 0,
      });
    },
    onSuccess: (newType: any) => {
      message.success("New leave type added and assigned");
      setNewTypeName("");
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      regularForm.setFieldValue("leave_type", newType.id);
    },
    onError: () => message.error("Failed to add leave type"),
  });

  const addLeaveType = () => {
    if (!newTypeName.trim()) return;
    addTypeMutation.mutate(newTypeName);
  };

  useEffect(() => {
    if (open) {
      if (prefillLeaveTypeId === "__EMERGENCY__") {
        setMode("emergency");
      } else {
        setMode("regular");
        if (prefillLeaveTypeId) {
          regularForm.setFieldValue("leave_type", prefillLeaveTypeId);
        }
      }
    }
  }, [open, prefillLeaveTypeId]);

  const minDate = dayjs().subtract(1, "month").startOf("day");
  const isDateDisabled = (d: dayjs.Dayjs) => !d || d < minDate;

  const regularMutation = useMutation({
    mutationFn: (values: any) => post("/leave/requests/", values),
    onSuccess: () => {
      regularForm.resetFields();
      setSuccessModal("Your leave request has been submitted successfully and sent to your Reporting Manager for review.");
      onSuccess();
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      let detail = "Failed to submit leave request";
      if (typeof data === "string") {
        detail = data.includes("<!DOCTYPE") || data.includes("<html") ? "Server error occurred while processing your request." : data;
      } else if (data) {
        detail =
          data?.detail ??
          data?.errors?.non_field_errors?.[0] ??
          data?.non_field_errors?.[0] ??
          Object.entries(data?.errors ?? data ?? {})
            .map(([k, v]: any) => {
              if (Array.isArray(v)) return `${k}: ${v[0]}`;
              if (typeof v === "object" && v !== null) return `${k}: ${JSON.stringify(v)}`;
              return `${k}: ${v}`;
            })
            .join(", ");
      }
      setBlockModal(detail);
    },
  });

  const emergencyMutation = useMutation({
    mutationFn: async (values: any) => {
      if (fileList.length > 0 && fileList[0].originFileObj) {
        const fd = new FormData();
        Object.entries(values).forEach(([k, v]: any) => {
            if (v !== undefined && v !== null) fd.append(k, v);
        });
        fd.append("is_emergency", "true");
        fd.append("medical_certificate", fileList[0].originFileObj);
        return post("/leave/requests/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      return post("/leave/requests/", { ...values, is_emergency: true });
    },
    onSuccess: () => {
      emergencyForm.resetFields();
      setFileList([]);
      setSuccessModal("Your emergency leave request has been submitted successfully and sent to your Reporting Manager for immediate review.");
      onSuccess();
    },
    onError: (e: any) => {
      const data   = e?.response?.data;
      let detail = "Failed to submit leave request";
      if (typeof data === "string") {
        detail = data.includes("<!DOCTYPE") || data.includes("<html") ? "Server error occurred while processing your request." : data;
      } else if (data) {
        detail =
          data?.detail ??
          data?.errors?.non_field_errors?.[0] ??
          data?.non_field_errors?.[0] ??
          Object.entries(data?.errors ?? data ?? {})
            .map(([k, v]: any) => {
              if (Array.isArray(v)) return `${k}: ${v[0]}`;
              if (typeof v === "object" && v !== null) return `${k}: ${JSON.stringify(v)}`;
              return `${k}: ${v}`;
            })
            .join(", ");
      }
      setBlockModal(detail);
    },
  });

  const handleClose = () => {
    regularForm.resetFields();
    emergencyForm.resetFields();
    setFileList([]);
    setMode("regular");
    onClose();
  };

  return (
    <>
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <WalletOutlined style={{ color: "#7c3aed" }} />
            <span>Apply for Leave</span>
          </div>
        }
        open={open}
        onCancel={handleClose}
        footer={null}
        width={500}
        destroyOnHidden
      >
        <div style={{
          display: "flex", gap: 0, marginBottom: 20, marginTop: 4,
          borderRadius: 10, overflow: "hidden", border: "1px solid var(--bms-border)",
        }}>
          <button
            onClick={() => setMode("regular")}
            style={{
              flex: 1, padding: "9px 0", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.15s",
              background: mode === "regular" ? "#7c3aed" : "var(--bms-surface-2)",
              color:      mode === "regular" ? "#fff"    : "var(--bms-text-2)",
              borderRight: "1px solid var(--bms-border)",
            }}
          >
            <WalletOutlined style={{ marginRight: 6 }} />
            Regular Leave
          </button>
          <button
            onClick={() => setMode("emergency")}
            style={{
              flex: 1, padding: "9px 0", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.15s",
              background: mode === "emergency" ? "#dc2626" : "var(--bms-surface-2)",
              color:      mode === "emergency" ? "#fff"    : "#dc2626",
            }}
          >
            <MedicineBoxOutlined style={{ marginRight: 6 }} />
            Emergency Leave
          </button>
        </div>

        <div style={{ display: mode === "regular" ? "block" : "none" }}>
          <Form form={regularForm} layout="vertical" initialValues={{ leave_duration: "FULL_DAY" }} onFinish={(v) => {
            const isHalf = v.leave_duration === "HALF_DAY";
            const startDate = isHalf ? v.single_date.format("YYYY-MM-DD") : v.dates[0].format("YYYY-MM-DD");
            const endDate = isHalf ? startDate : v.dates[1].format("YYYY-MM-DD");
            regularMutation.mutate({
              leave_type: v.leave_type,
              leave_duration: v.leave_duration,
              half_day_period: isHalf ? v.half_day_period : null,
              start_date: startDate,
              end_date: endDate,
              reason: v.reason || "",
              is_emergency: false,
            });
          }}>
            <Form.Item name="leave_type" label="Leave Type"
              rules={[{ required: true, message: "Please select a leave type" }]}>
              <Select
                placeholder="Select leave type"
                options={typeOptions}
              />
            </Form.Item>

            <Form.Item name="leave_duration" label="Leave Duration" initialValue="FULL_DAY" rules={[{ required: true }]}>
              <Radio.Group style={{ display: "flex", gap: 24, marginTop: 4 }}>
                <Radio value="FULL_DAY">Full day</Radio>
                <Radio value="HALF_DAY">Half day</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.leave_duration !== curr.leave_duration}>
              {({ getFieldValue }) =>
                getFieldValue("leave_duration") === "HALF_DAY" ? (
                  <Form.Item
                    name="half_day_period"
                    label="Half Day"
                    initialValue="FIRST_HALF"
                    rules={[{ required: true, message: "Please select First Half or Second Half" }]}
                  >
                    <Radio.Group style={{ display: "flex", gap: 24, marginTop: 4 }}>
                      <Radio value="FIRST_HALF">First Half</Radio>
                      <Radio value="SECOND_HALF">Second Half</Radio>
                    </Radio.Group>
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.leave_duration !== curr.leave_duration}>
              {({ getFieldValue }) =>
                getFieldValue("leave_duration") === "HALF_DAY" ? (
                  <Form.Item
                    name="single_date"
                    label="Leave Date"
                    rules={[{ required: true, message: "Please select a date" }]}
                  >
                    <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" disabledDate={isDateDisabled} />
                  </Form.Item>
                ) : (
                  <Form.Item
                    name="dates"
                    label="Leave Dates"
                    rules={[{ required: true, message: "Please select dates" }]}
                  >
                    <DatePicker.RangePicker style={{ width: "100%" }} format="DD MMM YYYY" disabledDate={isDateDisabled} />
                  </Form.Item>
                )
              }
            </Form.Item>

            <LeaveLimitWarningAlert form={regularForm} balances={balances} />

            <Form.Item
              name="reason"
              label={<span style={{ fontWeight: 600 }}>Reason <span style={{ color: "#ef4444" }}>*</span></span>}
              rules={[{ required: true, message: "Please provide a reason for your leave" }]}
            >
              <Input.TextArea rows={3} placeholder="Provide a reason for your leave..." />
            </Form.Item>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button onClick={handleClose}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={regularMutation.isPending}
                icon={<WalletOutlined />}
                style={{ background: "#7c3aed", borderColor: "#7c3aed" }}>
                Submit Request
              </Button>
            </div>
          </Form>
        </div>

        <div style={{ display: mode === "emergency" ? "block" : "none" }}>
          <Alert
            type="error" showIcon icon={<MedicineBoxOutlined />}
            style={{ marginBottom: 16, borderRadius: 8 }}
            message={<Text style={{ fontSize: 13, fontWeight: 600, color: "#991b1b" }}>Emergency Leave</Text>}
            description={
              <Text style={{ fontSize: 12, color: "#7f1d1d" }}>
                For unforeseen medical or personal crises. Your Reporting Manager will review your request immediately.
                Proof speeds up approval.
              </Text>
            }
          />
          <Form form={emergencyForm} layout="vertical" initialValues={{ leave_duration: "FULL_DAY" }} onFinish={(v) => {
            const isHalf = v.leave_duration === "HALF_DAY";
            const startDate = isHalf ? v.single_date.format("YYYY-MM-DD") : v.dates[0].format("YYYY-MM-DD");
            const endDate = isHalf ? startDate : v.dates[1].format("YYYY-MM-DD");
            emergencyMutation.mutate({
              leave_type: v.leave_type,
              leave_duration: v.leave_duration,
              half_day_period: isHalf ? v.half_day_period : null,
              start_date: startDate,
              end_date: endDate,
              reason: v.reason || "",
            });
          }}>
            <Form.Item name="leave_type" label="Leave Type"
              rules={[{ required: true, message: "Please select a leave type" }]}>
              <Select
                placeholder="Select leave type"
                options={typeOptions}
                notFoundContent={<div style={{ padding: "12px 0", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>No leave types assigned. Contact HR.</div>}
              />
            </Form.Item>

            <Form.Item name="leave_duration" label="Leave Duration" initialValue="FULL_DAY" rules={[{ required: true }]}>
              <Radio.Group style={{ display: "flex", gap: 24, marginTop: 4 }}>
                <Radio value="FULL_DAY">Full day</Radio>
                <Radio value="HALF_DAY">Half day</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.leave_duration !== curr.leave_duration}>
              {({ getFieldValue }) =>
                getFieldValue("leave_duration") === "HALF_DAY" ? (
                  <Form.Item
                    name="half_day_period"
                    label="Half Day"
                    initialValue="FIRST_HALF"
                    rules={[{ required: true, message: "Please select First Half or Second Half" }]}
                  >
                    <Radio.Group style={{ display: "flex", gap: 24, marginTop: 4 }}>
                      <Radio value="FIRST_HALF">First Half</Radio>
                      <Radio value="SECOND_HALF">Second Half</Radio>
                    </Radio.Group>
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.leave_duration !== curr.leave_duration}>
              {({ getFieldValue }) =>
                getFieldValue("leave_duration") === "HALF_DAY" ? (
                  <Form.Item
                    name="single_date"
                    label="Leave Date"
                    rules={[{ required: true, message: "Please select a date" }]}
                  >
                    <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" disabledDate={isDateDisabled} />
                  </Form.Item>
                ) : (
                  <Form.Item
                    name="dates"
                    label="Leave Dates"
                    rules={[{ required: true, message: "Please select dates" }]}
                  >
                    <DatePicker.RangePicker style={{ width: "100%" }} format="DD MMM YYYY" disabledDate={isDateDisabled} />
                  </Form.Item>
                )
              }
            </Form.Item>

            <LeaveLimitWarningAlert form={emergencyForm} balances={balances} />

            <Form.Item name="reason" label="Reason"
              rules={[{ required: true, message: "Please describe the emergency" }]}>
              <Input.TextArea rows={3}
                placeholder="Describe the emergency — e.g. hospitalisation, accident, family crisis" />
            </Form.Item>

            <Form.Item
              name="medical_certificate"
              label={
                <span>
                  Proof
                  <Text style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6, fontWeight: 400 }}>
                    optional but recommended
                  </Text>
                </span>
              }
            >
              <Upload
                fileList={fileList}
                beforeUpload={() => false}
                accept=".pdf,.jpg,.jpeg,.png"
                maxCount={1}
                onChange={({ fileList: fl }) => setFileList(fl)}
                onRemove={() => setFileList([])}
              >
                <Button icon={<UploadOutlined />} style={{ borderRadius: 8 }}>Upload Certificate</Button>
              </Upload>
              {fileList.length === 0 && (
                <Text style={{ fontSize: 11, color: "#9ca3af", display: "block", marginTop: 4 }}>
                  PDF, JPG, or PNG · max 5 MB
                </Text>
              )}
            </Form.Item>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button onClick={handleClose}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={emergencyMutation.isPending}
                icon={<MedicineBoxOutlined />}
                style={{ background: "#dc2626", borderColor: "#dc2626" }}>
                Request Emergency Leave
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* ── Warning / Block Notification Modal Popup ── */}
      <Modal
        open={!!blockModal}
        onCancel={() => setBlockModal(null)}
        onOk={() => setBlockModal(null)}
        okText="Got it"
        zIndex={2000}
        style={{ zIndex: 2000 }}
        cancelButtonProps={{ style: { display: "none" } }}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#d97706" }}>
            <WarningOutlined style={{ fontSize: 20, color: "#d97706" }} />
            <span>Leave Submission Notice</span>
          </div>
        }
      >
        <div style={{ padding: "12px 0" }}>
          <Text style={{ fontSize: 14, lineHeight: 1.5, display: "block" }}>{blockModal}</Text>
        </div>
      </Modal>

      {/* ── Success Notification Modal Popup ── */}
      <Modal
        open={!!successModal}
        onCancel={() => {
          setSuccessModal(null);
          handleClose();
        }}
        onOk={() => {
          setSuccessModal(null);
          handleClose();
        }}
        okText="Got it"
        zIndex={2000}
        style={{ zIndex: 2000 }}
        cancelButtonProps={{ style: { display: "none" } }}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#059669" }}>
            <CheckCircleOutlined style={{ fontSize: 20, color: "#059669" }} />
            <span>Leave Request Submitted</span>
          </div>
        }
      >
        <div style={{ padding: "12px 0" }}>
          <Text style={{ fontSize: 14, display: "block" }}>{successModal}</Text>
        </div>
      </Modal>
    </>
  );
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: "#d97706", bg: "#fffbeb" },
  FINALIZED: { color: "#1677ff", bg: "#eff6ff" },
  PAID: { color: "#059669", bg: "#f0fdf4" },
};

export function PayslipWidget({
  records,
  fy,
}: {
  records: EmpDashboard["payslips"];
  fy: string;
}) {
  const [amountVisible, setAmountVisible] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadPayslip = async (id: string, monthName: string, year: number) => {
    setDownloading(id);
    try {
      const res = await fetch(`/bms/api/v1/payroll/my/${id}/payslip-pdf/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("kc_access_token") ?? ""}` },
      });
      if (!res.ok) {
        message.error("Failed to generate payslip");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Payslip-${monthName}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error("Download failed");
    } finally {
      setDownloading(null);
    }
  };

  if (records.length === 0) {
    return <Text type="secondary">No payslips available for {fy}</Text>;
  }

  return (
    <div className="emp-payslips">
      <div className="emp-payslips__head">
        <Text type="secondary">{fy}</Text>
        <Button
          type="text"
          size="small"
          icon={amountVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
          onClick={() => setAmountVisible((v) => !v)}
        />
      </div>
      {records.map((r) => {
        const ss = STATUS_STYLE[r.status] ?? STATUS_STYLE.DRAFT;
        return (
          <div key={r.id} className="emp-payslips__row">
            <div className="emp-payslips__icon" style={{ background: ss.bg }}>
              <FilePdfOutlined style={{ color: ss.color }} />
            </div>
            <div style={{ flex: 1 }}>
              <Text strong style={{ fontSize: 13 }}>{r.month_name} {r.year}</Text>
              <div style={{ fontSize: 12, color: "var(--bms-text-2)" }}>
                Net:{" "}
                {amountVisible ? (
                  <span style={{ fontWeight: 700, color: "var(--bms-primary)" }}>
                    ₹{r.net_salary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span style={{ letterSpacing: 2 }}>••••••</span>
                )}
              </div>
            </div>
            <span className="emp-payslips__status" style={{ color: ss.color, background: ss.bg }}>
              {r.status}
            </span>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              loading={downloading === r.id}
              onClick={() => downloadPayslip(r.id, r.month_name, r.year)}
            >
              PDF
            </Button>
          </div>
        );
      })}
    </div>
  );
}
