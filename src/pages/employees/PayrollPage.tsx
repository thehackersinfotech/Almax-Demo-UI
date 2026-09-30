import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Typography, Tag, Space, Button, Modal, Form,
  InputNumber, Select, Spin, Empty, message, Popconfirm,
  Row, Col, Divider, Alert, Tooltip, Input,
} from "antd";
import {
  PlusOutlined, FilePdfOutlined, CheckOutlined,
  DollarOutlined, FilterOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, CheckCircleOutlined,
  ThunderboltOutlined, InfoCircleOutlined, BankOutlined, PrinterOutlined,
} from "@ant-design/icons";
import { get, post, patch, del } from "@/services/api";
import PermGuard from "@/components/common/PermGuard";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";
import { getStoredSelfOnboardingData } from "@/pages/employees/EmployeeOnboardingPortalPage";

const { Title, Text } = Typography;

// ── Types ──────────────────────────────────────────────────────────────────────
interface PayrollRow {
  id: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  designation: string;
  department: string;
  month: number;
  month_name: string;
  year: number;
  basic_salary: string;
  hra: string;
  allowances: string;
  overtime: string;
  gross_total: string;
  pf: string;
  tds: string;
  other_deductions: string;
  advance_deduction: string;
  total_deductions: string;
  working_days: number;
  present_days: number;
  leave_days: number;
  net_salary: string;
  status: string;
  payment_mode: string;
  bank_name: string;
  account_number: string;
  cheque_no?: string;
  upi_id?: string;
  receipt_no?: string;
}

interface Summary {
  total: number; draft: number; finalized: number; paid: number; total_net: number;
}

interface EmployeeOption { id: string; full_name: string; employee_code: string; keycloak_group: string; }

const MONTHS = [
  {v:1,l:"January"},{v:2,l:"February"},{v:3,l:"March"},{v:4,l:"April"},
  {v:5,l:"May"},{v:6,l:"June"},{v:7,l:"July"},{v:8,l:"August"},
  {v:9,l:"September"},{v:10,l:"October"},{v:11,l:"November"},{v:12,l:"December"},
];

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  DRAFT:     { color: "#d97706", bg: "#fffbeb" },
  FINALIZED: { color: "#1677ff", bg: "#eff6ff" },
  PAID:      { color: "#059669", bg: "#f0fdf4" },
  CANCELLED: { color: "#6b7280", bg: "#f9fafb" },
};

function fmt(v: string | number) {
  return `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      flex: 1,
      // ✅ FIX: was background: "#fff", border: "1px solid #eaecf0"
      background: "var(--bms-surface)",
      borderRadius: 12,
      border: "1px solid var(--bms-border)",
      padding: "16px 20px",
      minWidth: 150,
    }}>
      {/* ✅ FIX: was color: "#9ca3af" */}
      <Text style={{ fontSize: 12, color: "var(--bms-text-3)", display: "block", marginBottom: 4 }}>{label}</Text>
      {/* ✅ FIX: was color: "#111827" */}
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? "var(--bms-text)" }}>{value}</div>
    </div>
  );
}

// ── Net Salary display ────────────────────────────────────────────────────────
function NetSalaryBox({ basic, hra, allowances, overtime, pf, tds, other, advance }: Record<string, number>) {
  const gross = basic + hra + allowances + overtime;
  const deductions = pf + tds + other + advance;
  const net = gross - deductions;
  return (
    <div style={{
      // kept as-is — this is a modal-only component with intentional brand color
      background: "#eff6ff", borderRadius: 10, padding: "12px 16px",
      border: "1px solid #bfdbfe",
    }}>
      <Text style={{ fontSize: 13, color: "#374151" }}>
        Net Salary: <strong style={{ fontSize: 18, color: "#1d4ed8" }}>₹{net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
      </Text>
    </div>
  );
}

// ── Statement Print Modal ──────────────────────────────────────────────────────
function StatementPrintModal({ open, record, onClose }: {
  open: boolean;
  record: PayrollRow | null;
  onClose: () => void;
}) {
  if (!record) return null;
  const selfData = getStoredSelfOnboardingData(record.employee);
  const bankName = selfData?.bankName || record.bank_name || "N/A";
  const accountNumber = selfData?.accountNumber || record.account_number || "N/A";
  const ifscCode = selfData?.ifscCode || "N/A";
  const panNumber = selfData?.panNumber || "N/A";

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      message.error("Pop-up blocked. Please allow pop-ups to print statement.");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salary Statement - ${record.employee_name} - ${record.month_name} ${record.year}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #111827; }
            .header { text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 15px; margin-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: bold; color: #1d4ed8; }
            .subtitle { font-size: 14px; color: #6b7280; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 13px; }
            .box { background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
            .box-title { font-weight: bold; color: #374151; margin-bottom: 6px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .total-row { font-weight: bold; background-color: #eff6ff; }
            .net-pay { font-size: 18px; font-weight: bold; color: #1d4ed8; text-align: right; margin-top: 15px; padding: 12px; background: #eff6ff; border-radius: 6px; }
            .footer { margin-top: 40px; font-size: 11px; text-align: center; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">NEXUS HRMS & PAYROLL</div>
            <div class="subtitle">SALARY STATEMENT / PAYSLIP — ${record.month_name.toUpperCase()} ${record.year}</div>
          </div>

          <div class="grid">
            <div class="box">
              <div class="box-title">EMPLOYEE INFORMATION</div>
              <div><strong>Name:</strong> ${record.employee_name}</div>
              <div><strong>Employee ID:</strong> ${record.employee_code}</div>
              <div><strong>Designation:</strong> ${record.designation || 'N/A'}</div>
              <div><strong>Department:</strong> ${record.department || 'N/A'}</div>
            </div>
            <div class="box">
              <div class="box-title">PAYMENT & BANK DETAILS</div>
              <div><strong>Payment Mode:</strong> ${record.payment_mode}</div>
              <div><strong>Bank Name:</strong> ${bankName}</div>
              <div><strong>Account No:</strong> ${accountNumber}</div>
              <div><strong>IFSC Code:</strong> ${ifscCode}</div>
              <div><strong>PAN:</strong> ${panNumber}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>EARNINGS</th>
                <th style="text-align:right">AMOUNT (₹)</th>
                <th>DEDUCTIONS</th>
                <th style="text-align:right">AMOUNT (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Basic Salary</td>
                <td style="text-align:right">₹${Number(record.basic_salary).toLocaleString("en-IN")}</td>
                <td>Provident Fund (PF)</td>
                <td style="text-align:right">₹${Number(record.pf).toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td>House Rent Allowance (HRA)</td>
                <td style="text-align:right">₹${Number(record.hra).toLocaleString("en-IN")}</td>
                <td>Tax Deducted at Source (TDS)</td>
                <td style="text-align:right">₹${Number(record.tds).toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td>Special Allowances</td>
                <td style="text-align:right">₹${Number(record.allowances).toLocaleString("en-IN")}</td>
                <td>Advance / Loan Deduction</td>
                <td style="text-align:right">₹${Number(record.advance_deduction).toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td>Overtime Pay</td>
                <td style="text-align:right">₹${Number(record.overtime).toLocaleString("en-IN")}</td>
                <td>Other Deductions</td>
                <td style="text-align:right">₹${Number(record.other_deductions).toLocaleString("en-IN")}</td>
              </tr>
              <tr class="total-row">
                <td><strong>GROSS EARNINGS</strong></td>
                <td style="text-align:right"><strong>₹${Number(record.gross_total).toLocaleString("en-IN")}</strong></td>
                <td><strong>TOTAL DEDUCTIONS</strong></td>
                <td style="text-align:right"><strong>₹${Number(record.total_deductions).toLocaleString("en-IN")}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="net-pay">
            NET SALARY PAYABLE: ₹${Number(record.net_salary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>

          <div class="footer">
            This is an official computer-generated salary statement and does not require a physical signature.
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Modal
      title={
        <Space>
          <PrinterOutlined style={{ color: "#1d4ed8" }} />
          <span>Salary Statement Print / Preview — {record.employee_name} ({record.month_name} {record.year})</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={680}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
          Print / Download PDF Statement
        </Button>,
      ]}
    >
      <div style={{ padding: "16px", background: "var(--bms-surface-2)", borderRadius: 8, border: "1px solid var(--bms-border)" }}>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>EMPLOYEE</Text>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--bms-text)" }}>{record.employee_name} ({record.employee_code})</div>
            <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>{record.designation} · {record.department}</div>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>BANK DETAILS</Text>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}><BankOutlined style={{ color: "#1890ff", marginRight: 4 }} />{bankName}</div>
            <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>Acc: <code>{accountNumber}</code> · IFSC: {ifscCode}</div>
          </Col>
        </Row>

        <Divider style={{ margin: "12px 0" }} />

        <Row gutter={16}>
          <Col span={12}>
            <div style={{ fontWeight: 700, color: "#10b981", marginBottom: 6 }}>Gross Earnings: ₹{Number(record.gross_total).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 12 }}>Basic: ₹{Number(record.basic_salary).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 12 }}>HRA: ₹{Number(record.hra).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 12 }}>Allowances: ₹{Number(record.allowances).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 12 }}>Overtime: ₹{Number(record.overtime).toLocaleString("en-IN")}</div>
          </Col>
          <Col span={12}>
            <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>Total Deductions: ₹{Number(record.total_deductions).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 12 }}>PF: ₹{Number(record.pf).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 12 }}>TDS: ₹{Number(record.tds).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 12 }}>Advance: ₹{Number(record.advance_deduction).toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 12 }}>Other: ₹{Number(record.other_deductions).toLocaleString("en-IN")}</div>
          </Col>
        </Row>

        <div style={{
          marginTop: 16, padding: "12px 16px", background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <Text style={{ fontWeight: 600, color: "#1e3a8a" }}>Net Salary Payable</Text>
          <Text style={{ fontWeight: 800, fontSize: 18, color: "#1d4ed8" }}>₹{Number(record.net_salary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Text>
        </div>
      </div>
    </Modal>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function PayrollModal({ open, record, onClose, onDone }: {
  open: boolean; record: PayrollRow | null; onClose: () => void; onDone: () => void;
}) {
  const [form]         = Form.useForm();
  const vals           = Form.useWatch([], form) ?? {};
  const [autoFilled, setAutoFilled] = useState<{ designation: string; department: string; daily_rate: number } | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["employees-dropdown"],
    queryFn: () => get<any>("/employees/?dropdown=1&page_size=500"),
    select: (d: any) => {
      const list = Array.isArray(d) ? d : (d.results ?? []);
      const user = useAuthStore.getState().user;
      return list.filter((e: any) => e.id !== user?.id);
    },
    enabled: open,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      record ? patch(`/payroll/${record.id}/`, data) : post("/payroll/", data),
    onSuccess: () => {
      message.success(record ? "Payroll updated" : "Payroll saved");
      form.resetFields();
      setAutoFilled(null);
      onDone();
    },
    onError: (e: any) => {
      message.error(
        e?.response?.data?.non_field_errors?.[0] ||
        e?.response?.data?.detail || "Failed to save payroll"
      );
    },
  });

  const fetchPreview = async (empId: string, month: number, year: number) => {
    if (!empId || !month || !year || record) return;
    setAutoLoading(true);
    try {
      const preview: any = await get("/payroll/generate/", {
        employee_id: empId, month, year,
      });
      if (preview.has_rate_card) {
        form.setFieldsValue({
          basic_salary:     preview.basic_salary,
          hra:              preview.hra,
          allowances:       preview.allowances,
          overtime:         0,
          pf:               preview.pf,
          tds:              preview.tds,
          other_deductions: 0,
          advance_deduction: 0,
          working_days:     preview.working_days,
          present_days:     preview.present_days,
          leave_days:       preview.leave_days,
        });
        setAutoFilled({
          designation: preview.designation,
          department:  preview.department,
          daily_rate:  preview.hr_daily_rate,
        });
      } else {
        setAutoFilled(null);
        form.setFieldsValue({
          working_days: preview.working_days,
          present_days: preview.present_days,
          leave_days:   preview.leave_days,
        });
        if (preview.message) message.warning(preview.message);
      }
    } catch { /* silently skip */ }
    finally { setAutoLoading(false); }
  };

  const onValuesChange = (changed: any, all: any) => {
    if (!record && (changed.employee || changed.month || changed.year)) {
      const { employee, month, year } = all;
      if (employee && month && year) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchPreview(employee, month, year), 400);
      }
    }
    if (changed.employee) {
      const selfBank = getStoredSelfOnboardingData(changed.employee);
      if (selfBank && (selfBank.bankName || selfBank.accountNumber)) {
        form.setFieldsValue({
          bank_name: selfBank.bankName || form.getFieldValue("bank_name"),
          account_number: selfBank.accountNumber || form.getFieldValue("account_number"),
        });
      }
    }
    if (changed.basic_salary !== undefined) {
      form.setFieldValue("pf", Math.round((changed.basic_salary ?? 0) * 0.12 * 100) / 100);
    }
  };

  React.useEffect(() => {
    if (open && record) {
      form.setFieldsValue({
        employee: record.employee, month: record.month, year: record.year,
        basic_salary: parseFloat(record.basic_salary),
        hra: parseFloat(record.hra), allowances: parseFloat(record.allowances),
        overtime: parseFloat(record.overtime), pf: parseFloat(record.pf),
        tds: parseFloat(record.tds), other_deductions: parseFloat(record.other_deductions),
        advance_deduction: parseFloat(record.advance_deduction),
        working_days: record.working_days, present_days: record.present_days,
        leave_days: record.leave_days, status: record.status,
        payment_mode: record.payment_mode, bank_name: record.bank_name,
        account_number: record.account_number,
        cheque_no: record.cheque_no || "",
        upi_id: record.upi_id || "",
        receipt_no: record.receipt_no || "",
      });
      setAutoFilled(null);
    } else if (open && !record) {
      form.setFieldsValue({
        month: new Date().getMonth() + 1, year: new Date().getFullYear(),
        basic_salary: 0, hra: 0, allowances: 0, overtime: 0,
        pf: 0, tds: 0, other_deductions: 0, advance_deduction: 0,
        working_days: 26, present_days: 0, leave_days: 0,
        status: "DRAFT", payment_mode: "BANK_TRANSFER",
        bank_name: "", account_number: "",
        cheque_no: "", upi_id: "", receipt_no: "",
      });
      setAutoFilled(null);
    }
  }, [open, record]);

  const n = (k: string) => Number(vals[k] ?? 0);
  const gross      = n("basic_salary") + n("hra") + n("allowances") + n("overtime");
  const deductions = n("pf") + n("tds") + n("other_deductions") + n("advance_deduction");
  const net        = gross - deductions;
  const inp        = { style: { width: "100%" }, min: 0, precision: 2 };

  return (
    <Modal
      title={record ? "Edit Payroll" : "Add Payroll"}
      open={open} onCancel={onClose} width={680} footer={null} destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)} onValuesChange={onValuesChange}>

        {/* ── Employee / Period ── */}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="employee" label="Employee" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" placeholder="Select employee"
                suffixIcon={autoLoading ? <Spin size="small" /> : undefined}>
                {employees.map((e) => (
                  <Select.Option key={e.id} value={e.id} label={e.full_name}>
                    {e.full_name}
                    <Text type="secondary" style={{ fontSize: 11 }}> ({e.keycloak_group})</Text>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="month" label="Month" rules={[{ required: true }]}>
              <Select>
                {MONTHS.map((m) => <Select.Option key={m.v} value={m.v}>{m.l}</Select.Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="year" label="Year" rules={[{ required: true }]}>
              <InputNumber style={{ width: "100%" }} min={2020} max={2099} />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Rate card auto-fill banner ── */}
        {autoFilled && (
          <Alert
            type="success"
            showIcon
            icon={<ThunderboltOutlined />}
            style={{ marginBottom: 14, borderRadius: 8 }}
            message={
              <span>
                <strong>Auto-filled from Rate Card</strong>
                &nbsp;·&nbsp; {autoFilled.designation} / {autoFilled.department}
                &nbsp;·&nbsp; ₹{autoFilled.daily_rate}/day
                &nbsp;
                <Text type="secondary" style={{ fontSize: 11 }}>You can adjust the values below manually.</Text>
              </span>
            }
          />
        )}

        {/* ── Earnings ── */}
        <Divider orientation="left" style={{ fontSize: 11, color: "var(--bms-text-3)", borderColor: "var(--bms-border)", margin: "8px 0 12px" }}>
          EARNINGS
        </Divider>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="basic_salary" label={<span>Basic Salary <Tooltip title="40% of monthly CTC"><InfoCircleOutlined style={{ color: "var(--bms-text-3)" }} /></Tooltip></span>}>
              <InputNumber {...inp} prefix="₹" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="hra" label={<span>HRA <Tooltip title="20% of monthly CTC (50% of Basic)"><InfoCircleOutlined style={{ color: "var(--bms-text-3)" }} /></Tooltip></span>}>
              <InputNumber {...inp} prefix="₹" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="allowances" label={<span>Allowances <Tooltip title="40% of monthly CTC"><InfoCircleOutlined style={{ color: "var(--bms-text-3)" }} /></Tooltip></span>}>
              <InputNumber {...inp} prefix="₹" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="overtime" label="Overtime">
              <InputNumber {...inp} prefix="₹" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Deductions ── */}
        <Divider orientation="left" style={{ fontSize: 11, color: "var(--bms-text-3)", borderColor: "var(--bms-border)", margin: "8px 0 12px" }}>
          DEDUCTIONS
        </Divider>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="pf" label={<span>PF <Tooltip title="12% of Basic (auto-calculated)"><InfoCircleOutlined style={{ color: "var(--bms-text-3)" }} /></Tooltip></span>}>
              <InputNumber {...inp} prefix="₹" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="tds" label={<span>TDS <Tooltip title="Income Tax — new regime slab"><InfoCircleOutlined style={{ color: "var(--bms-text-3)" }} /></Tooltip></span>}>
              <InputNumber {...inp} prefix="₹" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="other_deductions" label="Other Deductions">
              <InputNumber {...inp} prefix="₹" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="advance_deduction" label="Advance Deduction">
              <InputNumber {...inp} prefix="₹" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Attendance ── */}
        <Divider orientation="left" style={{ fontSize: 11, color: "var(--bms-text-3)", borderColor: "var(--bms-border)", margin: "8px 0 12px" }}>
          ATTENDANCE
        </Divider>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="working_days" label="Working Days"><InputNumber style={{ width: "100%" }} min={0} max={31} /></Form.Item></Col>
          <Col span={8}><Form.Item name="present_days" label="Present Days"><InputNumber style={{ width: "100%" }} min={0} max={31} /></Form.Item></Col>
          <Col span={8}><Form.Item name="leave_days"   label="Leave Days"><InputNumber   style={{ width: "100%" }} min={0} max={31} /></Form.Item></Col>
        </Row>

        {/* ── Live Net Salary ── */}
        <div style={{
          // ✅ FIX: was hardcoded "#eff6ff"/"#f9fafb" backgrounds and "#e5e7eb"/"#bfdbfe" borders
          background: net > 0 ? "#1677ff0d" : "var(--bms-surface-2)",
          borderRadius: 10, padding: "14px 18px", marginBottom: 16,
          border: `1px solid ${net > 0 ? "#1677ff33" : "var(--bms-border)"}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            {/* ✅ FIX: was color: "#9ca3af" */}
            <div style={{ fontSize: 11, color: "var(--bms-text-3)", marginBottom: 2 }}>Net Salary</div>
            <strong style={{ fontSize: 22, color: net > 0 ? "#1d4ed8" : "var(--bms-text-3)" }}>
              ₹{net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </strong>
          </div>
          {/* ✅ FIX: was color: "#6b7280" */}
          <div style={{ textAlign: "right", fontSize: 12, color: "var(--bms-text-2)" }}>
            <div>Gross: <strong style={{ color: "#059669" }}>₹{gross.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
            <div>Deductions: <strong style={{ color: "#dc2626" }}>₹{deductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
          </div>
        </div>

        {/* ── Payment details ── */}
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="status" label="Status">
              <Select>
                <Select.Option value="DRAFT">Draft</Select.Option>
                <Select.Option value="FINALIZED">Finalized</Select.Option>
                <Select.Option value="PAID">Paid</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="payment_mode" label="Payment Mode">
              <Select>
                <Select.Option value="BANK_TRANSFER">Bank Transfer</Select.Option>
                <Select.Option value="CASH">Cash</Select.Option>
                <Select.Option value="CHEQUE">Cheque</Select.Option>
                <Select.Option value="UPI">UPI</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        {vals.payment_mode === "BANK_TRANSFER" && (
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="bank_name" label="Bank Name">
                <Input placeholder="e.g. HDFC Bank / ICICI Bank / SBI" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="account_number" label="Account Number">
                <InputNumber style={{ width: "100%" }} controls={false} stringMode />
              </Form.Item>
            </Col>
          </Row>
        )}

        {vals.payment_mode === "CHEQUE" && (
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="cheque_no" label="Cheque No." rules={[{ required: true, message: "Please enter cheque number" }]}>
                <Input placeholder="Cheque No." />
              </Form.Item>
            </Col>
          </Row>
        )}

        {vals.payment_mode === "UPI" && (
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="upi_id" label="UPI ID" rules={[{ required: true, message: "Please enter UPI ID" }]}>
                <Input placeholder="example@upi" />
              </Form.Item>
            </Col>
          </Row>
        )}

        {vals.payment_mode === "CASH" && (
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="receipt_no" label="Receipt No." rules={[{ required: true, message: "Please enter receipt number" }]}>
                <Input placeholder="Receipt No." />
              </Form.Item>
            </Col>
          </Row>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--bms-border)", paddingTop: 16 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={mutation.isPending} icon={<DollarOutlined />}>
            Save Payroll
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PayrollPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PayrollRow | null>(null);
  const [printRecord, setPrintRecord] = useState<PayrollRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<number>(currentYear);

  const { data, isLoading } = useQuery<{ summary: Summary; results: PayrollRow[] }>({
    queryKey: ["payroll-list", statusFilter, yearFilter],
    queryFn: () => {
      const params: any = { year: yearFilter };
      if (statusFilter) params.status = statusFilter;
      return get("/payroll/", params);
    },
    staleTime: 0,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/payroll/${id}/`, { status }),
    onSuccess: () => {
      message.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["payroll-list"] });
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.detail || "Failed to update status");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => post(`/payroll/${id}/approve/`, {}),
    onSuccess: () => { message.success("Payroll finalized"); queryClient.invalidateQueries({ queryKey: ["payroll-list"] }); },
  });

  const paidMutation = useMutation({
    mutationFn: (id: string) => post(`/payroll/${id}/mark-paid/`, {}),
    onSuccess: () => { message.success("Marked as Paid"); queryClient.invalidateQueries({ queryKey: ["payroll-list"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/payroll/${id}/`),
    onSuccess: () => { message.success("Deleted"); queryClient.invalidateQueries({ queryKey: ["payroll-list"] }); },
  });

  const summary = data?.summary ?? { total: 0, draft: 0, finalized: 0, paid: 0, total_net: 0 };
  const rows = data?.results ?? [];
  const user = useAuthStore((s) => s.user);

  const downloadPDF = async (id: string, name: string, monthName: string, year: number) => {
    try {
      const res = await fetch(`/bms/api/v1/payroll/${id}/payslip-pdf/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("kc_access_token") ?? ""}` },
      });
      if (!res.ok) { message.error("Failed to generate PDF"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Payslip-${name}-${monthName}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { message.error("PDF download failed"); }
  };

  const columns = [
    {
      title: "Employee", key: "employee",
      render: (_: any, r: PayrollRow) => (
        <div>
          <Text strong style={{ fontSize: 13, color: "var(--bms-text)" }}>{r.employee_name}</Text>
          <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{r.employee_code} {r.designation && `· ${r.designation}`}</div>
        </div>
      ),
    },
    {
      title: "Period", key: "period",
      render: (_: any, r: PayrollRow) => <Text style={{ fontSize: 13, color: "var(--bms-text)" }}>{r.month_name} {r.year}</Text>,
    },
    {
      title: <span><BankOutlined style={{ marginRight: 4 }} />Bank Details</span>,
      key: "bank_details",
      render: (_: any, r: PayrollRow) => {
        const selfData = getStoredSelfOnboardingData(r.employee);
        const bankName = selfData?.bankName || r.bank_name;
        const accountNumber = selfData?.accountNumber || r.account_number;
        const ifscCode = selfData?.ifscCode;
        const accountHolder = selfData?.accountHolderName;
        if (!bankName && !accountNumber) {
          return <Text type="secondary" style={{ fontSize: 11 }}>Not submitted</Text>;
        }
        return (
          <div>
            {accountHolder && <div style={{ fontWeight: 600, fontSize: 12, color: "var(--bms-text)" }}>{accountHolder}</div>}
            {bankName && <div style={{ fontSize: 12, color: "var(--bms-text)" }}>{bankName}</div>}
            {accountNumber && <div style={{ fontSize: 11, color: "var(--bms-text-3)", fontFamily: "monospace" }}>A/C: {accountNumber}</div>}
            {ifscCode && <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>IFSC: {ifscCode}</div>}
          </div>
        );
      },
    },
    {
      title: "Gross", dataIndex: "gross_total",
      render: (v: string) => <Text style={{ fontSize: 13, color: "var(--bms-text)" }}>{fmt(v)}</Text>,
    },
    {
      title: "Deductions", dataIndex: "total_deductions",
      render: (v: string) => <Text style={{ fontSize: 13, color: "#dc2626" }}>−{fmt(v)}</Text>,
    },
    {
      title: "Net Salary", dataIndex: "net_salary",
      render: (v: string) => <Text strong style={{ fontSize: 14, color: "#1677ff" }}>{fmt(v)}</Text>,
    },
    {
      title: "Status", key: "status", width: 130,
      render: (_: any, r: PayrollRow) => (
        <Select
          size="small"
          value={r.status}
          onChange={(newStatus) => statusMutation.mutate({ id: r.id, status: newStatus })}
          style={{ width: 115 }}
          variant="borderless"
          popupMatchSelectWidth={false}
        >
          <Select.Option value="DRAFT">
            <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fffbeb", padding: "2px 8px", borderRadius: 12, border: "1px solid #d9770633" }}>DRAFT</span>
          </Select.Option>
          <Select.Option value="FINALIZED">
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1677ff", background: "#eff6ff", padding: "2px 8px", borderRadius: 12, border: "1px solid #1677ff33" }}>FINALIZED</span>
          </Select.Option>
          <Select.Option value="PAID">
            <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#f0fdf4", padding: "2px 8px", borderRadius: 12, border: "1px solid #05966933" }}>PAID</span>
          </Select.Option>
          <Select.Option value="CANCELLED">
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", background: "#f9fafb", padding: "2px 8px", borderRadius: 12, border: "1px solid #6b728033" }}>CANCELLED</span>
          </Select.Option>
        </Select>
      ),
    },
    {
      title: "Actions", key: "actions", width: 160,
      render: (_: any, r: PayrollRow) => {
        const canApprove = user?.id !== r.employee;
        
        return (
          <Space size={4}>
            <Tooltip title="Print / Download Salary Statement">
              <Button size="small" icon={<PrinterOutlined />}
                style={{ color: "#7c3aed", borderColor: "#7c3aed" }}
                onClick={() => setPrintRecord(r)}
              />
            </Tooltip>
            <Button size="small" icon={<FilePdfOutlined />}
              style={{ color: "#7c3aed", borderColor: "#7c3aed" }}
              onClick={() => downloadPDF(r.id, r.employee_name.replace(" ", "-"), r.month_name, r.year)}
            />
            {r.status !== "PAID" && (
              <PermGuard permission={PERMS.HRMS_PAYROLL_UPDATE}>
                <Button size="small" icon={<EditOutlined />}
                  onClick={() => { setEditRecord(r); setModalOpen(true); }}
                />
              </PermGuard>
            )}
            <PermGuard permission={PERMS.HRMS_PAYROLL_APPROVE}>
              {r.status === "DRAFT" && (
                <Popconfirm 
                  title="Finalize this payroll?" 
                  disabled={!canApprove}
                  onConfirm={() => approveMutation.mutate(r.id)}
                >
                  <Button 
                    size="small" 
                    icon={<CheckOutlined />} 
                    style={{ color: "#059669", borderColor: "#059669" }}
                    disabled={!canApprove}
                    title={!canApprove ? "You cannot approve your own payroll" : ""}
                  />
                </Popconfirm>
              )}
              {r.status === "FINALIZED" && (
                <Popconfirm 
                  title="Mark as Paid?" 
                  disabled={!canApprove}
                  onConfirm={() => paidMutation.mutate(r.id)}
                >
                  <Button 
                    size="small" 
                    icon={<CheckCircleOutlined />} 
                    style={{ color: "#1677ff", borderColor: "#1677ff" }}
                    disabled={!canApprove}
                    title={!canApprove ? "You cannot approve your own payroll" : ""}
                  />
                </Popconfirm>
              )}
            </PermGuard>
            {r.status === "DRAFT" && (
              <PermGuard permission={PERMS.HRMS_PAYROLL_DELETE}>
                <Popconfirm title="Delete payroll?" onConfirm={() => deleteMutation.mutate(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </PermGuard>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", rowGap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>Payroll</Title>
          <Text style={{ color: "var(--bms-text-2)", fontSize: 13 }}>Manage employee salary &amp; payslips</Text>
        </div>
        <Space wrap>
          <Select value={yearFilter} onChange={setYearFilter} style={{ width: 90 }}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <Select.Option key={y} value={y}>{y}</Select.Option>)}
          </Select>
          <Select allowClear placeholder="Status" style={{ width: 130 }} value={statusFilter} onChange={setStatusFilter} suffixIcon={<FilterOutlined />}>
            <Select.Option value="DRAFT">Draft</Select.Option>
            <Select.Option value="FINALIZED">Finalized</Select.Option>
            <Select.Option value="PAID">Paid</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ["payroll-list"] })} />
          <PermGuard permission={PERMS.HRMS_PAYROLL_CREATE}>
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => { setEditRecord(null); setModalOpen(true); }}>
              Add Payroll
            </Button>
          </PermGuard>
        </Space>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <SCard label="Total Records"    value={summary.total} />
        <SCard label="Draft"            value={summary.draft}     color="#d97706" />
        <SCard label="Finalized"        value={summary.finalized} color="#1677ff" />
        <SCard label="Paid"             value={summary.paid}      color="#059669" />
        <SCard label="Total Net Payout" value={`₹${Number(summary.total_net).toLocaleString("en-IN")}`} color="#7c3aed" />
      </div>

      {/* Table */}
      <div style={{
        background: "var(--bms-surface)",
        borderRadius: 12,
        border: "1px solid var(--bms-border)",
        overflow: "hidden",
      }}>
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} records` }}
          locale={{ emptyText: <Empty description="No payroll records" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} /> }}
        />
      </div>

      <PayrollModal
        open={modalOpen}
        record={editRecord}
        onClose={() => { setModalOpen(false); setEditRecord(null); }}
        onDone={() => {
          setModalOpen(false);
          setEditRecord(null);
          queryClient.invalidateQueries({ queryKey: ["payroll-list"] });
        }}
      />

      <StatementPrintModal
        open={!!printRecord}
        record={printRecord}
        onClose={() => setPrintRecord(null)}
      />
    </div>
  );
}