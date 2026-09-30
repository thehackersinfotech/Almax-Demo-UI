import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Table, Typography, Space, Button, Modal, Form, Input, Select,
  Empty, Skeleton, Tag, Badge, message, Tooltip, Card,
} from "antd";
import {
  CalendarOutlined, EyeOutlined, FilterOutlined, MedicineBoxOutlined,
  ReloadOutlined, TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { get, post } from "@/services/api";
import { LeaveStatusBadge, formatDaysDisplay, formatDatesDisplay } from "./leaveStatus.tsx";
import "./leaveManagement.css";

const { Text } = Typography;

interface TeamLeaveRow {
  id: string;
  employee: string;
  employee_code?: string;
  leave_type: string;
  color: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: string;
  acknowledged_by?: string | null;
  ack_project?: string | null;
  created_at: string;
  reporting_level: string;
  can_approve: boolean;
  can_ack?: boolean;
  can_view_only: boolean;
  medical_certificate?: string | null;
  is_emergency?: boolean;
  exempt_from_balance?: boolean;
}

interface TeamLeaveResponse {
  pending_count: number;
  direct_count: number;
  indirect_count: number;
  results: TeamLeaveRow[];
}

function ReviewModal({ open, record, onClose, onDone }: {
  open: boolean;
  record: TeamLeaveRow | null;
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

  return (
    <Modal
      title={`Approve / Reject — ${record.employee}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      <div style={{
        background: "var(--bms-surface-2)", borderRadius: 10, padding: "12px 16px",
        marginBottom: 16, border: "1px solid var(--bms-border)",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px",
      }}>
        {[
          { label: "Employee", value: record.employee },
          { label: "Leave Type", value: record.leave_type },
          { label: "From", value: dayjs(record.start_date).format("DD MMM YYYY") },
          { label: "To", value: dayjs(record.end_date).format("DD MMM YYYY") },
          { label: "Days", value: formatDaysDisplay(record.days_count, record) },
        ].map(({ label, value }) => (
          <div key={label}>
            <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{label}</Text>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
          </div>
        ))}
        {record.reason && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Reason</Text>
            <div style={{ fontSize: 13, color: "var(--bms-text-2)" }}>{record.reason}</div>
          </div>
        )}
      </div>

      {/* Emergency + Proof Certificate Info Banner */}
      {record.is_emergency && (
        <div className={`leave-proof-banner leave-proof-banner--${record.medical_certificate ? "success" : "warning"}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MedicineBoxOutlined />
              <Text strong>
                {record.medical_certificate
                  ? "Emergency Proof Uploaded (Balance will NOT be deducted)"
                  : "Emergency Leave (No proof attached)"}
              </Text>
            </div>
            {record.medical_certificate && (
              <a href={record.medical_certificate} target="_blank" rel="noreferrer">
                View Proof ↗
              </a>
            )}
          </div>
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
        <Form.Item name="status" label="Decision" rules={[{ required: true }]}>
          <Select placeholder="Select decision">
            <Select.Option value="APPROVED"><span className="leave-decision leave-decision--approve">Approve</span></Select.Option>
            <Select.Option value="REJECTED"><span className="leave-decision leave-decision--reject">Reject</span></Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="remarks" label="Remarks (optional)">
          <Input.TextArea rows={2} placeholder="Optional note for the employee…" />
        </Form.Item>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>Submit</Button>
        </div>
      </Form>
    </Modal>
  );
}

export default function TeamLeaveTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [reviewRecord, setReviewRecord] = useState<TeamLeaveRow | null>(null);

  const { data: meta } = useQuery<{ has_team: boolean; direct_count: number; indirect_count: number }>({
    queryKey: ["leave-team-meta"],
    queryFn: () => get("/leave/team/meta/"),
  });

  const { data, isLoading, isError } = useQuery<TeamLeaveResponse>({
    queryKey: ["leave-team-requests", statusFilter],
    queryFn: () =>
      get<TeamLeaveResponse>("/leave/team/requests/", statusFilter ? { status: statusFilter } : {}),
    enabled: meta?.has_team !== false,
    staleTime: 0,
  });

  if (meta && !meta.has_team) {
    return (
      <Empty
        description="You have no team members in your reporting line"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: 48 }}
      />
    );
  }

  const columns = [
    {
      title: "Employee",
      key: "employee",
      width: 160,
      render: (_: unknown, r: TeamLeaveRow) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.employee}</Text>
          {r.employee_code && (
            <div style={{ fontSize: 11, color: "var(--bms-text-3)", fontFamily: "monospace" }}>{r.employee_code}</div>
          )}
        </div>
      ),
    },
    {
      title: "Team",
      key: "level",
      width: 100,
      render: (_: unknown, r: TeamLeaveRow) => (
        <Tag color={r.reporting_level === "direct" ? "blue" : "default"} style={{ margin: 0, fontSize: 11 }}>
          {r.reporting_level === "direct" ? "Direct" : "Indirect"}
        </Tag>
      ),
    },
    {
      title: "Leave",
      key: "leave",
      width: 120,
      render: (_: unknown, r: TeamLeaveRow) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.color }} />
          <Text style={{ fontSize: 12 }}>{r.leave_type}</Text>
        </span>
      ),
    },
    {
      title: "Dates",
      key: "dates",
      width: 190,
      render: (_: unknown, r: TeamLeaveRow) => (
        <span style={{ fontSize: 12 }}>
          {formatDatesDisplay(r.start_date, r.end_date, r.days_count, r)}
        </span>
      ),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
      render: (v: string) => <Text style={{ fontSize: 12, color: "var(--bms-text-2)" }}>{v || "—"}</Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (v: string) => <LeaveStatusBadge status={v} />,
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_: unknown, record: TeamLeaveRow) => (
        <Space size={4}>
          {record.can_approve ? (
            <Button type="primary" size="small" onClick={() => setReviewRecord(record)}>
              Review
            </Button>
          ) : (
            <Tag icon={<EyeOutlined />} style={{ margin: 0, fontSize: 11 }}>View only</Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="leave-toolbar">
        <Text style={{ fontSize: 13, color: "var(--bms-text-2)" }}>
          Direct reports ({data?.direct_count ?? meta?.direct_count ?? 0}) — you can approve.
          {" "}Indirect ({data?.indirect_count ?? meta?.indirect_count ?? 0}) — view only.
        </Text>
        <Space wrap className="leave-toolbar__actions">
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            suffixIcon={<FilterOutlined />}
          >
            <Select.Option value="PENDING_MANAGER">Awaiting Approval</Select.Option>
            <Select.Option value="PENDING">Pending</Select.Option>
            <Select.Option value="APPROVED">Approved</Select.Option>
            <Select.Option value="REJECTED">Rejected</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["leave-team-requests"] });
            queryClient.invalidateQueries({ queryKey: ["leave-team-meta"] });
          }}>
            Refresh
          </Button>
        </Space>
      </div>

      {(data?.pending_count ?? 0) > 0 && (
        <div className="leave-pending-banner">
          <Badge count={data?.pending_count} style={{ marginRight: 8 }} />
          <Text>
            {data?.pending_count} team leave request{(data?.pending_count ?? 0) === 1 ? "" : "s"} awaiting approval
          </Text>
        </div>
      )}

      {isError ? (
        <Alert
          type="error"
          showIcon
          message="Team leave requests could not be loaded"
          action={<Button size="small" onClick={() => queryClient.invalidateQueries({ queryKey: ["leave-team-requests"] })}>Retry</Button>}
        />
      ) : (
        <div className="leave-table-container-ultra">
          <div className="leave-table-header-bar">
            <div className="leave-table-header-bar__title">
              <TeamOutlined style={{ color: "#6366f1" }} /> Team Leave Requests
            </div>
            <Space wrap>
              <Select
                placeholder="Filter by status"
                allowClear
                style={{ width: 180 }}
                value={statusFilter}
                onChange={setStatusFilter}
                suffixIcon={<FilterOutlined />}
              >
                <Select.Option value="PENDING_MANAGER">Awaiting Approval</Select.Option>
                <Select.Option value="PENDING">Pending</Select.Option>
                <Select.Option value="APPROVED">Approved</Select.Option>
                <Select.Option value="REJECTED">Rejected</Select.Option>
              </Select>
              <Button className="btn-refresh-leave-premium" icon={<ReloadOutlined />} onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["leave-team-requests"] });
                queryClient.invalidateQueries({ queryKey: ["leave-team-meta"] });
              }}>
                Refresh
              </Button>
            </Space>
          </div>

          <div className="leave-desktop-table">
            <Table
              dataSource={data?.results ?? []}
              columns={columns}
              rowKey="id"
              loading={isLoading}
              size="middle"
              pagination={{ pageSize: 15, showSizeChanger: false }}
              scroll={{ x: 900 }}
              locale={{
                emptyText: (
                  <Empty description="No team leave requests" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                ),
              }}
            />
          </div>

          <div className="leave-mobile-list" aria-live="polite">
            {isLoading ? (
              [1, 2, 3].map((item) => (
                <Card key={item} className="leave-mobile-card">
                  <Skeleton active paragraph={{ rows: 4 }} />
                </Card>
              ))
            ) : (data?.results ?? []).length === 0 ? (
              <Empty
                description="No team leave requests"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                className="leave-empty"
              />
            ) : (data?.results ?? []).map((request) => (
              <Card key={request.id} className="leave-mobile-card">
                <div className="leave-mobile-card__header">
                  <div>
                    <Text strong>{request.employee}</Text>
                    <div className="leave-mobile-card__subtitle">
                      <TeamOutlined />
                      {request.reporting_level === "direct" ? "Direct report" : "Indirect report"}
                      {request.employee_code ? ` · ${request.employee_code}` : ""}
                    </div>
                  </div>
                  <LeaveStatusBadge status={request.status} />
                </div>
                <div className="leave-mobile-card__date">
                  <CalendarOutlined />
                  {formatDatesDisplay(request.start_date, request.end_date, request.days_count, request)}
                </div>
                <div className="leave-mobile-card__meta">
                  <span>{request.leave_type}</span>
                  <span>{request.can_approve ? "Approval required" : "View only"}</span>
                </div>
                {request.reason && <Text type="secondary">{request.reason}</Text>}
                {request.can_approve ? (
                  <Button type="primary" block onClick={() => setReviewRecord(request)}>
                    Review request
                  </Button>
                ) : (
                  <Button block disabled icon={<EyeOutlined />}>View only</Button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <ReviewModal
        open={!!reviewRecord}
        record={reviewRecord}
        onClose={() => setReviewRecord(null)}
        onDone={() => {
          setReviewRecord(null);
          queryClient.invalidateQueries({ queryKey: ["leave-team-requests"] });
          queryClient.invalidateQueries({ queryKey: ["leave-team-meta"] });
        }}
      />
    </div>
  );
}
