import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Typography, Tag, Space, Button, Modal, Form,
  Input, Select, Spin, Empty, message, Tooltip, Popconfirm,
  InputNumber, Checkbox, Alert, Tabs, Badge,
} from "antd";
import {
  FilterOutlined, ReloadOutlined, MedicineBoxOutlined, UserAddOutlined,
  UserOutlined, TeamOutlined, AuditOutlined, CheckOutlined, CalendarOutlined, PlusOutlined,
} from "@ant-design/icons";
import { get, post, del } from "@/services/api";
import PermGuard from "@/components/common/PermGuard";
import { PERMS } from "@/constants/permissions";
import { usePermission } from "@/hooks/usePermission";
import MyLeaveTab from "./leave/MyLeaveTab";
import TeamLeaveTab from "./leave/TeamLeaveTab";
import { LeaveStatusBadge, formatDaysDisplay, formatDatesDisplay } from "./leave/leaveStatus";
import { useAuthStore } from "@/store/auth";
import { ApplyLeaveModal } from "@/components/employee/LeaveAndPayslip";
import "./leave/leaveManagement.css";

const { Title, Text } = Typography;

// ── Types ──────────────────────────────────────────────────────────────────────
interface LeaveRequestRow {
  id: string;
  employee_id: string;
  employee: string;
  leave_type: string;
  color: string;
  start_date: string;
  end_date: string;
  leave_duration?: string;
  half_day_period?: string;
  start_day_part?: string;
  end_day_part?: string;
  days_count: number;
  reason: string;
  status: string;
  reviewer: string | null;
  reviewer_remarks: string;
  acknowledged_by?: string | null;
  ack_project?: string | null;
  can_ack?: boolean;
  can_approve?: boolean;
  created_at: string;
  is_emergency?: boolean;
  medical_certificate?: string | null;
  emergency_note?: string;
  certificate_verified?: boolean;
  exempt_from_balance?: boolean;
}

interface Summary {
  pending: number;
  pending_ack?: number;
  pending_manager?: number;
  approved: number;
  rejected: number;
  days_approved: number;
}

interface AdminLeaveResponse {
  summary: Summary;
  results: LeaveRequestRow[];
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, accent }: {
  label: string; value: number | string; sub?: string; accent?: string;
}) {
  return (
    <div style={{
      flex: 1,
      background: "var(--bms-surface)",
      borderRadius: 12,
      border: "1px solid var(--bms-border)",
      padding: "18px 22px",
      minWidth: 160,
    }}>
      <Text style={{ fontSize: 13, color: "var(--bms-text-2)", display: "block", marginBottom: 4 }}>{label}</Text>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent ?? "var(--bms-text)", lineHeight: 1.2 }}>{value}</div>
      {sub && <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>{sub}</Text>}
    </div>
  );
}

// ── Review modal ──────────────────────────────────────────────────────────────
function ReviewModal({ open, record, onClose, onDone }: {
  open: boolean;
  record: LeaveRequestRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form] = Form.useForm();

  const mutation = useMutation({
    mutationFn: ({ id, status, remarks }: { id: string; status: string; remarks: string }) =>
      post(`/leave/requests/${id}/review/`, { status, remarks }),
    onSuccess: () => {
      message.success("Leave request updated");
      form.resetFields();
      onDone();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || (typeof e?.response?.data === "string" ? e.response.data : "Failed to update leave request");
      message.error(msg);
    },
  });

  if (!record) return null;

  const daysLabel = formatDaysDisplay(record.days_count, record);

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: record.color }} />
          <span>Review Leave Request</span>
          {record.is_emergency && (
            <Tag color="error" style={{ fontSize: 11 }}>🚨 Emergency</Tag>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      {/* Request details */}
      <div style={{
        background: "var(--bms-surface-2)",
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 16,
        border: "1px solid var(--bms-border)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px 16px",
      }}>
        {[
          { label: "Employee",   value: record.employee },
          { label: "Leave Type", value: record.leave_type },
          { label: "From",       value: record.start_date },
          { label: "To",         value: record.end_date },
          { label: "Days",       value: daysLabel },
          { label: "Applied On", value: record.created_at },
        ].map(({ label, value }) => (
          <div key={label}>
            <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{label}</Text>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--bms-text)" }}>{value}</div>
          </div>
        ))}
        {record.reason && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Reason</Text>
            <div style={{ fontSize: 13, color: "var(--bms-text-2)" }}>{record.reason}</div>
          </div>
        )}
        {record.emergency_note && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Text style={{ fontSize: 11, color: "var(--bms-danger)" }}>Emergency Note</Text>
            <div style={{ fontSize: 13, color: "var(--bms-text-2)" }}>{record.emergency_note}</div>
          </div>
        )}
      </div>

      {/* Emergency + certificate info banner */}
      {record.is_emergency && (
        <div className={`leave-proof-banner leave-proof-banner--${record.exempt_from_balance ? "success" : "warning"}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MedicineBoxOutlined />
            <Text strong>
              {record.exempt_from_balance
                ? "Proof uploaded — balance will NOT be deducted on approval"
                : "No proof — balance WILL be deducted on approval"}
            </Text>
          </div>
          {record.medical_certificate && (
            <a href={record.medical_certificate} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, display: "block", marginTop: 4 }}>
              View Proof ↗
            </a>
          )}
        </div>
      )}

      {/* Document info for non-emergency leaves */}
      {!record.is_emergency && record.medical_certificate && (
        <div className="leave-proof-banner leave-proof-banner--info">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Text strong>Document Attached</Text>
            <a href={record.medical_certificate} target="_blank" rel="noreferrer">
              View Document ↗
            </a>
          </div>
        </div>
      )}

      <Form form={form} layout="vertical" onFinish={(v) =>
        mutation.mutate({ id: record.id, status: v.status, remarks: v.remarks || "" })
      }>
        <Form.Item name="status" label="Decision" rules={[{ required: true, message: "Please select" }]}>
          <Select placeholder="Select decision">
            <Select.Option value="APPROVED">
              <span className="leave-decision leave-decision--approve">✓ Approve</span>
            </Select.Option>
            <Select.Option value="REJECTED">
              <span className="leave-decision leave-decision--reject">✗ Reject</span>
            </Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="remarks" label="Remarks (optional)">
          <Input.TextArea rows={2} placeholder="Add a note for the employee…" />
        </Form.Item>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            Submit
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

// ── Assign Leave modal ──────────────────────────────────────────────────────────
interface LeaveTypeOption { id: string; name: string; code: string; max_days: number; is_paid: boolean; color: string; }
interface EmployeeOption  { id: string; full_name: string; employee_code: string; designation_name: string | null; }
interface AssignResultRow {
  employee_id: string; employee_name: string | null; status: string; message: string;
  carry_forward_days?: number; total_days?: number;
}

function AssignLeaveModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm();
  const [results, setResults] = useState<{ fy_label: string; leave_type_name: string; summary: Record<string, number>; results: AssignResultRow[] } | null>(null);
  const { user } = useAuthStore();

  const { data: leaveTypes = [] } = useQuery<LeaveTypeOption[]>({
    queryKey: ["leave-types-active"],
    queryFn: () => get<LeaveTypeOption[]>("leave/types/"),
    enabled: open,
  });

  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["employees-simple-dropdown"],
    queryFn: () => get<EmployeeOption[]>("employees/simple-dropdown/"),
    enabled: open,
  });

  const { data: fyData } = useQuery<{ available_years: Array<{ year: number; label: string; working_days: number }> }>({
    queryKey: ["fy-years-metadata"],
    queryFn: () => get("/leave/admin/assign/"),
    enabled: open,
  });

  const assignMut = useMutation({
    mutationFn: (values: any) => post<any>("leave/admin/assign/", {
      leave_type_id:  values.leave_type_id,
      total_days:     values.total_days,
      carry_forward:  !!values.carry_forward,
      financial_year: values.financial_year,
      employee_ids:   values.assign_all
        ? employees.filter((e) => e.id !== user?.id).map((e) => e.id)
        : values.employee_ids,
    }),
    onSuccess: (data) => {
      setResults(data);
      const { assigned = 0, duplicate = 0, max_days_exceeded = 0, error = 0 } = data.summary ?? {};
      if (assigned > 0) message.success(`Assigned to ${assigned} employee(s)`);
      if (duplicate + max_days_exceeded + error > 0) message.warning(`${duplicate + max_days_exceeded + error} skipped — see details below`);
      onDone();
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? "Failed to assign leave"),
  });

  const handleClose = () => {
    form.resetFields();
    setResults(null);
    onClose();
  };

  const assignAll = Form.useWatch("assign_all", form);
  const selectedYear = Form.useWatch("financial_year", form);
  const selectedYearInfo = fyData?.available_years?.find((y) => y.year === selectedYear);
  const defaultFY = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Assign Leave Type to Employee(s)"
      okText={results ? "Assign More" : "Assign"}
      confirmLoading={assignMut.isPending}
      onOk={() => {
        if (results) {
          handleClose();
        } else {
          form.submit();
        }
      }}
      width={results ? 700 : 520}
    >
      {!results ? (
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => { setResults(null); assignMut.mutate(v); }}
        >
          <Form.Item name="financial_year" label="Financial Year" initialValue={defaultFY} rules={[{ required: true, message: "Select financial year" }]}>
            <Select
              placeholder="Select financial year"
              options={fyData?.available_years?.map((y) => ({ value: y.year, label: y.label }))}
            />
          </Form.Item>
          {selectedYearInfo && (
            <div className="leave-proof-banner leave-proof-banner--info">
              <Text>
                Working days in {selectedYearInfo.label}: <strong>{selectedYearInfo.working_days} days</strong> (excluding weekends and holidays)
              </Text>
            </div>
          )}
          <Form.Item name="leave_type_id" label="Leave Type" rules={[{ required: true, message: "Select a leave type" }]}>
            <Select
              placeholder="Select leave type"
              options={leaveTypes.map((lt) => ({ value: lt.id, label: `${lt.name} (${lt.code})${lt.max_days ? ` — max ${lt.max_days}d/yr` : ""}` }))}
              onChange={(id) => {
                const lt = leaveTypes.find((l) => l.id === id);
                if (lt?.max_days) form.setFieldValue("total_days", lt.max_days);
              }}
            />
          </Form.Item>
          <Form.Item name="total_days" label="Total Days for this FY" rules={[{ required: true, message: "Enter total days" }]}>
            <InputNumber min={0} max={365} style={{ width: "100%" }} addonAfter="days" />
          </Form.Item>
          <Form.Item name="assign_all" valuePropName="checked" initialValue={false}>
            <Checkbox>Assign to all active employees</Checkbox>
          </Form.Item>
          {!assignAll && (
            <Form.Item name="employee_ids" label="Employee(s)" rules={[{ required: true, message: "Select at least one employee" }]}>
              <Select
                mode="multiple" placeholder="Search and select employee(s)" showSearch
                optionFilterProp="label"
                options={employees
                  .filter((e) => e.id !== user?.id)
                  .map((e) => ({ value: e.id, label: `${e.full_name} (${e.employee_code})${e.designation_name ? ` — ${e.designation_name}` : ""}` }))}
              />
            </Form.Item>
          )}
          <Form.Item name="carry_forward" valuePropName="checked" initialValue={false}>
            <Checkbox>Carry forward unused leave from last financial year (if the leave type's policy allows it)</Checkbox>
          </Form.Item>
          <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
            Assignment applies to the current financial year. If an employee already has this leave type assigned for this FY, they'll be skipped.
          </Text>
        </Form>
      ) : (
        <div style={{ marginTop: 20 }}>
          {(() => {
            const { assigned = 0, duplicate = 0, max_days_exceeded: exceeded = 0, error = 0 } = results.summary;
            const hasIssues = duplicate > 0 || exceeded > 0 || error > 0;
            
            let friendlyMessage = '';
            const messageParts = [];
            
            if (assigned > 0) {
              messageParts.push(`✓ Successfully assigned to ${assigned} employee${assigned !== 1 ? 's' : ''}`);
            }
            
            if (duplicate > 0) {
              messageParts.push(`⚠ ${duplicate} employee${duplicate !== 1 ? 's' : ''} already ${duplicate !== 1 ? 'have' : 'has'} this leave type assigned`);
            }
            
            if (exceeded > 0) {
              messageParts.push(`⚠ ${exceeded} employee${exceeded !== 1 ? 's' : ''} exceeded the maximum allowed days`);
            }
            
            if (error > 0) {
              messageParts.push(`✕ ${error} error${error !== 1 ? 's' : ''} occurred during assignment`);
            }
            
            friendlyMessage = messageParts.join(' • ');
            if (!friendlyMessage) friendlyMessage = 'No assignments were made';

            return (
              <Alert
                type={hasIssues ? "warning" : assigned > 0 ? "success" : "info"}
                showIcon
                message={`${results.leave_type_name} for ${results.fy_label}`}
                description={friendlyMessage}
              />
            );
          })()}
          <div style={{ marginTop: 12, maxHeight: 260, overflowY: "auto", border: "1px solid var(--bms-border)", borderRadius: 8 }}>
            {results.results.map((r) => (
              <div key={r.employee_id} style={{
                display: "flex", justifyContent: "space-between", gap: 12,
                padding: "8px 12px", borderBottom: "1px solid var(--bms-border)", fontSize: 12,
              }}>
                <Text style={{ fontWeight: 600 }}>{r.employee_name ?? r.employee_id}</Text>
                <Tag color={r.status === "assigned" ? "success" : r.status === "duplicate" ? "default" : "error"} style={{ margin: 0 }}>
                  {r.message}
                </Tag>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function HRLeaveAdminPanel() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") ?? undefined;
  const [statusFilter, setStatusFilter] = useState<string | undefined>(initialStatus || undefined);
  const [reviewRecord, setReviewRecord] = useState<LeaveRequestRow | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const { data, isLoading, isError } = useQuery<AdminLeaveResponse>({
    queryKey: ["leave-admin-requests", statusFilter],
    queryFn: () =>
      get<AdminLeaveResponse>("/leave/admin/requests/", statusFilter ? { status: statusFilter } : {}),
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/leave/requests/${id}/`),
    onSuccess: () => {
      message.success("Request cancelled");
      queryClient.invalidateQueries({ queryKey: ["leave-admin-requests"] });
    },
    onError: () => message.error("Failed to cancel"),
  });

  const summary = data?.summary ?? { pending: 0, approved: 0, rejected: 0, days_approved: 0 };
  const rows    = data?.results ?? [];

  const columns = [
    {
      title: "EMPLOYEE",
      dataIndex: "employee",
      key: "employee",
      render: (v: string) => (
        <Text strong style={{ fontSize: 13, color: "var(--bms-primary)" }}>{v}</Text>
      ),
    },
    {
      title: "LEAVE TYPE",
      key: "leave_type",
      // FIX: horizontal layout — dot + name + emergency tag all in one row
      render: (_: any, r: LeaveRequestRow) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: r.color, flexShrink: 0,
          }} />
          <Text style={{ fontSize: 13, color: "var(--bms-text)", whiteSpace: "nowrap" }}>
            {r.leave_type}
          </Text>
          {r.is_emergency && r.medical_certificate && (
            <Tooltip title="Proof uploaded">
              <MedicineBoxOutlined style={{ color: "var(--bms-success)", fontSize: 13 }} />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: "FROM",
      dataIndex: "start_date",
      key: "start_date",
      render: (v: string) => <Text style={{ fontSize: 13, color: "var(--bms-text)" }}>{v}</Text>,
    },
    {
      title: "TO",
      dataIndex: "end_date",
      key: "end_date",
      render: (v: string) => <Text style={{ fontSize: 13, color: "var(--bms-text)" }}>{v}</Text>,
    },
    {
      title: "DAYS",
      dataIndex: "days_count",
      key: "days_count",
      width: 170,
      render: (v: number, r: LeaveRequestRow) => {
        const text = formatDaysDisplay(v, r);
        return (
          <Tooltip title={r.exempt_from_balance ? "Balance exempt (emergency + certificate)" : undefined}>
            <Text strong style={{ fontSize: 13, color: r.exempt_from_balance ? "var(--bms-success)" : "var(--bms-text)" }}>
              {text}{r.exempt_from_balance ? " *" : ""}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: "REASON",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
      render: (v: string) => (
        <Text style={{ fontSize: 12, color: "var(--bms-text-2)" }}>{v || "—"}</Text>
      ),
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => <LeaveStatusBadge status={v} />,
    },
    {
      title: "APPLIED",
      dataIndex: "created_at",
      key: "created_at",
      render: (v: string) => (
        <Text style={{ fontSize: 12, color: "var(--bms-text-2)" }}>{v}</Text>
      ),
    },
    {
      title: "ACTIONS",
      key: "actions",
      width: 120,
      render: (_: any, record: LeaveRequestRow) => (
        <Space size={4}>
          {record.can_approve && (
            <Button
              size="small"
              type="primary"
              style={{ fontSize: 12, borderRadius: 4 }}
              onClick={() => setReviewRecord(record)}
            >
              Approve / Reject
            </Button>
          )}
          <PermGuard permission={PERMS.HRMS_LEAVE_MANAGE}>
            <Popconfirm
              title="Cancel this leave request?"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button size="small" style={{ fontSize: 12, borderRadius: 4 }}>
                Del
              </Button>
            </Popconfirm>
          </PermGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="leave-toolbar">
        <div>
          <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>All Employee Requests</Title>
          <Text style={{ color: "var(--bms-text-2)", fontSize: 13 }}>HR view — all leave applications across the organisation</Text>
        </div>
        <Space wrap>
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 160 }}
            value={statusFilter}
            onChange={setStatusFilter}
            suffixIcon={<FilterOutlined />}
          >
            <Select.Option value="PENDING">Pending</Select.Option>
            <Select.Option value="APPROVED">Approved</Select.Option>
            <Select.Option value="REJECTED">Rejected</Select.Option>
            <Select.Option value="CANCELLED">Cancelled</Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ["leave-admin-requests"] })}
          >
            Refresh
          </Button>
          <PermGuard permission={PERMS.HRMS_LEAVE_MANAGE}>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setAssignOpen(true)}>
              Assign Leave
            </Button>
          </PermGuard>
        </Space>
      </div>

      {/* Summary cards */}
      <div className="leave-summary-grid">
        <SummaryCard label="Pending" value={summary.pending} sub="Awaiting approval" accent="var(--bms-warning)" />
        <SummaryCard label="Approved" value={summary.approved} accent="var(--bms-success)" />
        <SummaryCard label="Rejected" value={summary.rejected} accent="var(--bms-danger)" />
        <SummaryCard label="Days Approved" value={summary.days_approved} accent="var(--bms-primary)" />
      </div>

      {/* Table */}
      {isError ? (
        <Alert
          type="error"
          showIcon
          message="Employee leave requests could not be loaded"
          action={<Button size="small" onClick={() => queryClient.invalidateQueries({ queryKey: ["leave-admin-requests"] })}>Retry</Button>}
        />
      ) : (
        <div className="leave-hr-table">
          <Table
            dataSource={rows}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            size="middle"
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} requests` }}
            locale={{
              emptyText: (
                <Empty
                  description="No leave requests"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ padding: 40 }}
                />
              ),
            }}
            style={{ fontSize: 13 }}
            rowClassName={(r) => ["PENDING", "PENDING_MANAGER", "PENDING_PROJECT_ACK"].includes(r.status) ? "pending-row" : ""}
          />
        </div>
      )}

      {/* * footnote for exempt leaves */}
      {rows.some((r) => r.exempt_from_balance) && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--bms-text-3)" }}>
          * Days marked with * are emergency leaves with proof — balance is not deducted on approval.
        </div>
      )}

      {/* Review modal */}
      <ReviewModal
        open={!!reviewRecord}
        record={reviewRecord}
        onClose={() => setReviewRecord(null)}
        onDone={() => {
          setReviewRecord(null);
          queryClient.invalidateQueries({ queryKey: ["leave-admin-requests"] });
        }}
      />

      {/* Assign leave modal */}
      <AssignLeaveModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["leave-admin-requests"] })}
      />
    </div>
  );
}

export default function LeaveRequestsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [applyOpen, setApplyOpen] = useState(false);
  const canHrView = usePermission(PERMS.HRMS_LEAVE_VIEW);

  const { data: teamMeta } = useQuery<{ has_team: boolean; pending_count: number }>({
    queryKey: ["leave-team-meta"],
    queryFn: () => get("/leave/team/meta/"),
  });

  const tabFromUrl = searchParams.get("tab");
  const resolvedTab = tabFromUrl === "team" ? "team" : tabFromUrl === "hr" ? "hr" : "mine";
  const [activeTab, setActiveTab] = useState(resolvedTab);

  useEffect(() => {
    if (resolvedTab === "team" && teamMeta && !teamMeta.has_team) {
      setActiveTab("mine");
      return;
    }
    if (resolvedTab === "hr" && !canHrView) {
      setActiveTab("mine");
      return;
    }
    setActiveTab(resolvedTab);
  }, [resolvedTab, teamMeta, canHrView]);

  const tabItems = useMemo(() => {
    const items = [
      {
        key: "mine",
        label: <span><UserOutlined /> My Leave</span>,
        children: <MyLeaveTab />,
      },
    ];
    if (teamMeta?.has_team) {
      items.push({
        key: "team",
        label: (
          <span>
            <TeamOutlined /> Team Leave
            {(teamMeta.pending_count ?? 0) > 0 && (
              <Badge count={teamMeta.pending_count} style={{ marginLeft: 6 }} size="small" />
            )}
          </span>
        ),
        children: <TeamLeaveTab />,
      });
    }
    if (canHrView) {
      items.push({
        key: "hr",
        label: <span><AuditOutlined /> All Requests</span>,
        children: <HRLeaveAdminPanel />,
      });
    }
    return items;
  }, [teamMeta, canHrView]);

  return (
    <div className="leave-page-container">
      {/* Clean White/Surface Header Header with Title & Top-Right Actions (No Dark Blue) */}
      <div className="leave-dashboard-header">
        <Title level={2} className="leave-dashboard-header__title">
          My Leave Dashboard
        </Title>
        <div className="leave-dashboard-header__actions">
          <Button
            className="btn-apply-leave-speedo"
            icon={<PlusOutlined />}
            onClick={() => setApplyOpen(true)}
          >
            Apply Leave
          </Button>
          <Button
            className="btn-refresh-speedo"
            icon={<ReloadOutlined />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["my-leave-requests-list"] });
              queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
              queryClient.invalidateQueries({ queryKey: ["leave-team-requests"] });
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Tabs
        className="leave-tabs-ultra"
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setSearchParams(key === "mine" ? {} : { tab: key });
        }}
        items={tabItems}
        type="card"
      />

      <ApplyLeaveModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onSuccess={() => {
          setApplyOpen(false);
          queryClient.invalidateQueries({ queryKey: ["my-leave-requests-list"] });
          queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
        }}
      />
    </div>
  );
}