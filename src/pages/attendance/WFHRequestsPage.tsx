import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Card, Table, Tag, Button, Space, Select, DatePicker,
  Modal, Input, message, Badge, Tabs, Empty, Spin, Tooltip, Avatar, Divider, Switch,
} from "antd";
import {
  HomeOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, FilterOutlined, UserOutlined, CalendarOutlined,
  ExclamationCircleOutlined, TeamOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { get, post } from "@/services/api";
import { usePermission } from "@/hooks/usePermission";
import { PERMS } from "@/constants/permissions";

const { Title, Text } = Typography;
const { TextArea } = Input;

// ─── Types ────────────────────────────────────────────────────────────────────
interface WFHRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  division: string;
  requested_date: string;        // The date employee wants to WFH
  request_date: string;          // When the request was submitted
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_note: string | null;
}
// ADD after WFHRequest interface:
interface EmployeeWFHAccess {
  id: string;
  full_name: string;
  employee_code: string;
  department: string;
  wfh_allowed: boolean;
}

const WFH_STATUS: Record<string, { color: string; bg: string; label: string; antColor: string }> = {
  PENDING:  { color: "var(--bms-warning)", bg: "rgba(217, 119, 6, 0.15)", label: "Pending",  antColor: "warning" },
  APPROVED: { color: "var(--bms-success)", bg: "rgba(22, 163, 74, 0.15)", label: "Approved", antColor: "success" },
  REJECTED: { color: "var(--bms-danger)", bg: "var(--bms-danger-bg)", label: "Rejected", antColor: "error"   },
};

// ─── Reject modal ─────────────────────────────────────────────────────────────
function RejectModal({ open, onCancel, onConfirm, loading }: {
  open: boolean; onCancel: () => void;
  onConfirm: (note: string) => void; loading: boolean;
}) {
  const [note, setNote] = useState("");
  const handle = () => {
    if (!note.trim()) { message.warning("Please provide a rejection reason"); return; }
    onConfirm(note.trim());
    setNote("");
  };
  return (
    <Modal title={<span><ExclamationCircleOutlined style={{ color: "var(--bms-danger)", marginRight: 8 }} />Reject WFH Request</span>}
      open={open} onCancel={onCancel} onOk={handle} okText="Reject" okButtonProps={{ danger: true, loading }}
      destroyOnHidden>
      <Text style={{ fontSize: 13, color: "var(--bms-text)" }}>Provide a reason for rejection (visible to employee):</Text>
      <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Not enough notice period, team meeting required..." style={{ marginTop: 10 }} />
    </Modal>
  );
}

// ─── Request card (detail view) ───────────────────────────────────────────────
function WFHRequestCard({ req, onApprove, onReject, approving, rejecting }: {
  req: WFHRequest;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  approving: boolean; rejecting: boolean;
}) {
  const ss = WFH_STATUS[req.status] ?? WFH_STATUS.PENDING;
  return (
    <Card size="small" style={{ borderRadius: 10, marginBottom: 12, borderLeft: `4px solid ${ss.color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        {/* Employee info */}
        <Space>
          <Avatar size={40} style={{ background: "#1677ff", fontSize: 16, fontWeight: 700 }}>
            {req.employee_name.slice(0, 1).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{req.employee_name}</div>
            <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>{req.employee_code}</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>{req.department}{req.division ? ` · ${req.division}` : ""}</div>
          </div>
        </Space>

        {/* WFH date + status */}
        <div style={{ textAlign: "right" }}>
          <Tag color="blue" style={{ fontSize: 13, padding: "2px 10px" }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {dayjs(req.requested_date).format("DD MMM YYYY")}
          </Tag>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: ss.color, background: ss.bg,
              border: `1px solid ${ss.color}33`, borderRadius: 20, padding: "2px 12px" }}>
              {ss.label}
            </span>
          </div>
        </div>
      </div>

      <Divider style={{ margin: "10px 0" }} />

      {/* Reason */}
      <div style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>
        <span style={{ fontWeight: 600, color: "#6b7280", marginRight: 6 }}>Reason:</span>
        {req.reason}
      </div>

      {/* Submitted at */}
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: req.status === "PENDING" ? 12 : 0 }}>
        Submitted: {dayjs(req.request_date).format("DD MMM YYYY, HH:mm")}
      </div>

      {/* Rejection note */}
      {req.status === "REJECTED" && req.rejection_note && (
        <div style={{ background: "#fff1f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", marginTop: 8, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#dc2626" }}>Rejection reason: </span>
          <span style={{ color: "#374151" }}>{req.rejection_note}</span>
          {req.reviewed_by && <span style={{ color: "#9ca3af", marginLeft: 8 }}>— {req.reviewed_by}</span>}
        </div>
      )}

      {/* Approval info */}
      {req.status === "APPROVED" && req.reviewed_by && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "8px 12px", marginTop: 8, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#059669" }}>Approved by </span>
          <span style={{ color: "#374151" }}>{req.reviewed_by}</span>
          {req.reviewed_at && <span style={{ color: "#9ca3af" }}> on {dayjs(req.reviewed_at).format("DD MMM YYYY, HH:mm")}</span>}
        </div>
      )}

      {/* Action buttons — only for pending */}
      {req.status === "PENDING" && (
        <Space style={{ marginTop: 10 }}>
          <Button type="primary" icon={<CheckCircleOutlined />} size="small"
            onClick={() => onApprove(req.id)} loading={approving}
            style={{ background: "#059669", borderColor: "#059669" }}>
            Approve
          </Button>
          <Button danger icon={<CloseCircleOutlined />} size="small"
            onClick={() => onReject(req.id)} loading={rejecting}>
            Reject
          </Button>
        </Space>
      )}
    </Card>
  );
}
// ─── Main WFH Requests Page ───────────────────────────────────────────────────
export default function WFHRequestsPage() {
  const canApprove = usePermission(PERMS.HRMS_LEAVE_APPROVE);
  const qc = useQueryClient();

  const [activeTab,    setActiveTab]    = useState<string>("PENDING");
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [deptFilter,   setDeptFilter]   = useState<string>("");
  const [dateFilter,   setDateFilter]   = useState<Dayjs | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  // Fetch departments
  const { data: departments } = useQuery<string[]>({
    queryKey: ["departments-list"],
    queryFn:  () => get("/master/departments/?dropdown=1").then((d: any) => (d.results ?? d).map((x: any) => x.name)),
    staleTime: 120_000,
  });

  // Build query params
  const REAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", ""];
const params: Record<string, string> = {};
if (statusFilter && REAL_STATUSES.includes(statusFilter)) params.status = statusFilter;
if (deptFilter)   params.department = deptFilter;
if (dateFilter)   params.date       = dateFilter.format("YYYY-MM-DD");

 const { data: requests, isLoading } = useQuery<WFHRequest[]>({
  queryKey: ["wfh-requests", params],
  queryFn:  () => get("/attendance/wfh-requests/", params).then((d: any) => d.results ?? d),
  staleTime: 0,
  enabled: canApprove && activeTab !== "access",
});

  // ── Approve mutation ────────────────────────────────────────────────────────
  const approveMut = useMutation({
    mutationFn: (id: string) => post(`/attendance/wfh-requests/${id}/approve/`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wfh-requests"] });
      message.success("WFH request approved");
    },
    onError: () => message.error("Failed to approve request"),
  });

  // ── Reject mutation ─────────────────────────────────────────────────────────
  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      post(`/attendance/wfh-requests/${id}/reject/`, { rejection_note: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wfh-requests"] });
      message.success("WFH request rejected");
      setRejectTarget(null);
    },
    onError: () => message.error("Failed to reject request"),
  });

  if (!canApprove) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <HomeOutlined style={{ fontSize: 48, color: "#d1d5db" }} />
        <div style={{ marginTop: 16, color: "#6b7280" }}>You don't have permission to view WFH requests.</div>
      </div>
    );
  }

  const pending  = (requests ?? []).filter((r) => r.status === "PENDING");
  const approved = (requests ?? []).filter((r) => r.status === "APPROVED");
  const rejected = (requests ?? []).filter((r) => r.status === "REJECTED");
  const displayList = activeTab === "access" ? [] : (requests ?? []);
  const tabItems = [
    {
      key: "PENDING",
      label: (
        <span>
          <ClockCircleOutlined style={{ color: "#d97706" }} /> Pending
          {pending.length > 0 && <Badge count={pending.length} style={{ marginLeft: 6 }} />}
        </span>
      ),
    },
    {
      key: "APPROVED",
      label: <span><CheckCircleOutlined style={{ color: "#059669" }} /> Approved</span>,
    },
    {
      key: "REJECTED",
      label: <span><CloseCircleOutlined style={{ color: "#dc2626" }} /> Rejected</span>,
    },
    { key: "", label: "All" },
    {
      key: "access",
      label: (
        <span>
          <TeamOutlined style={{ color: "#7c3aed" }} /> WFH Access
          <Tooltip title="Enable or disable WFH permission per employee">
            <Badge count="HR" style={{ marginLeft: 6, background: "#7c3aed", fontSize: 10 }} />
          </Tooltip>
        </span>
      ),
    },
  ];



  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <HomeOutlined style={{ color: "#1677ff", marginRight: 8 }} />WFH Requests
          </Title>
          <Text style={{ color: "#6b7280", fontSize: 13 }}>
            Review and approve Work From Home requests from employees
          </Text>
        </div>
        <Space>
          <Badge count={pending.length} offset={[-4, 4]}>
            <Tag color="warning" style={{ fontSize: 13, padding: "4px 12px" }}>
              {pending.length} Pending
            </Tag>
          </Badge>
        </Space>
      </div>

      {/* Filter bar */}
     {/* Filter bar — hidden on WFH Access tab */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 10, display: activeTab === "access" ? "none" : undefined }}>
        <Space wrap>
          <DatePicker
            value={dateFilter} onChange={(d) => setDateFilter(d)}
            format="DD MMM YYYY" placeholder="Filter by WFH date"
            style={{ width: 180 }} allowClear
          />
          <Select
            allowClear placeholder="Filter by Department"
            style={{ width: 200 }} value={deptFilter || undefined}
            onChange={(v) => setDeptFilter(v ?? "")}
            options={(departments ?? []).map((d) => ({ value: d, label: d }))}
            suffixIcon={<FilterOutlined />}
          />
        </Space>
      </Card>

      {/* Request list */}
      <Card style={{ borderRadius: "0 0 12px 12px", borderTop: "none" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
        ) : displayList.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              statusFilter === "PENDING"
                ? "No pending WFH requests"
                : `No ${statusFilter.toLowerCase()} requests`
            }
            style={{ padding: 60 }}
          />
        ) : (
          <div style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto", paddingRight: 4 }}>
            {displayList.map((req) => (
              <WFHRequestCard
                key={req.id}
                req={req}
                onApprove={(id) => approveMut.mutate(id)}
                onReject={(id) => setRejectTarget(id)}
                approving={approveMut.isPending && approveMut.variables === req.id}
                rejecting={rejectMut.isPending  && rejectMut.variables?.id === req.id}
              />
            ))}
          </div>
        )}
      </Card>
      {/* Reject modal */}
      <RejectModal
        open={!!rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(note) => rejectTarget && rejectMut.mutate({ id: rejectTarget, note })}
        loading={rejectMut.isPending}
      />
    </div>
  );
}