import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Button, Typography, Tag, Select, DatePicker, Input,
  Modal, message, Tooltip, Progress, Card, Statistic, Badge, Space, 
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, FilterOutlined,
  ClockCircleOutlined, DownloadOutlined, EditOutlined, TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import PercentChip from "@/components/common/PercentChip";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import {
  DashboardShell,
  DashboardHeader,
  DashboardPanel,
  AttentionQueue,
  ActionMetric,
  WorkQueue,
  DashboardPageSkeleton,
  type AttentionItem,
} from "@/components/dashboard";
import {
  timesheetApi, STATUS_COLOR,
  type WeeklyTimesheet,
} from "@/services/timesheets";
import client, { get } from "@/services/api";
import { employeeApi } from "@/services/employees";
import { ENDPOINTS, API_BASE } from "@/constants/api";
import { apiErrorMsg } from "@/utils/apiError";
import PermGuard from "@/components/common/PermGuard";
import { PERMS } from "@/constants/permissions";
import { sundayOf } from "@/utils/weekDates";

const { Text } = Typography;

function EmployeeCell({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <Space size={10}>
      <AssigneeAvatar name={name} size={size} />
      <Text style={{ fontWeight: 500 }}>{name}</Text>
    </Space>
  );
}

interface TeamAggregatRow {
  employee_id: string;
  employee_name: string;
  department: string | null;
  status: string;
  total_hours: number;
  expected_hours: number;
  hours_behind: number;
  utilization_pct: number;
}

export default function ReportingTimesheetPage({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<string | undefined>();
  const [projectId, setProjectId] = useState<string | undefined>();
  const [employeeId, setEmployeeId] = useState<string | undefined>();
  const [selected, setSelected] = useState<string[]>([]);

  // Approve modal
  const [approveModal, setApproveModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [approveComment, setApproveComment] = useState("");

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [rejectComment, setRejectComment] = useState("");

  // Request Changes modal
  const [rcModal, setRcModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [rcComment, setRcComment] = useState("");

  // Team aggregate panel toggle
  const [showAggregate, setShowAggregate] = useState(false);
  const [aggWeekStart, setAggWeekStart] = useState<string | undefined>();

  const params: Record<string, string> = {};
  if (weekStart)    params.week_start = weekStart;
  if (projectId)    params.project    = projectId;
  if (employeeId)   params.employee   = employeeId;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["reporting-dashboard"],
    queryFn: () => timesheetApi.reportingDashboard(),
  });

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reporting-review", params],
    queryFn: () => timesheetApi.reportingReview(params),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-dropdown-reporting"],
    queryFn: () => get<Array<{ id: string; name: string; code: string }>>(ENDPOINTS.PROJECT_DROPDOWN),
    staleTime: 60_000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-simple-dropdown-reporting"],
    queryFn: () => employeeApi.simpleDropdown(),
    staleTime: 60_000,
  });

  const { data: aggregateData = [], isLoading: aggLoading } = useQuery<TeamAggregatRow[]>({
    queryKey: ["team-aggregate", aggWeekStart],
    queryFn: () => get<TeamAggregatRow[]>(
  (ENDPOINTS as Record<string, string>)["TIMESHEET_TEAM_AGGREGATE"],
  aggWeekStart ? { week_start: aggWeekStart } : {}
),
    enabled: showAggregate,
  });

  const filteredAggregateData = useMemo(() => {
    if (!employeeId) return aggregateData;
    return aggregateData.filter((row) => row.employee_id === employeeId);
  }, [aggregateData, employeeId]);

  // ── Invalidation ───────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reporting-review"] });
    qc.invalidateQueries({ queryKey: ["reporting-dashboard"] });
    qc.invalidateQueries({ queryKey: ["team-aggregate"] });
    setSelected([]);
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const approveMut = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      timesheetApi.approve(id, comment),
    onSuccess: () => {
      message.success("Approved");
      setApproveModal({ open: false });
      setApproveComment("");
      invalidate();
    },
    onError: (e) => message.error(apiErrorMsg(e, "Approve failed")),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      timesheetApi.reject(id, comment),
    onSuccess: () => {
      message.success("Rejected");
      setRejectModal({ open: false });
      setRejectComment("");
      invalidate();
    },
    onError: (e) => message.error(apiErrorMsg(e, "Reject failed")),
  });

  const requestChangesMut = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      timesheetApi.reject(id, comment),
    onSuccess: () => {
      message.success("Changes requested — employee will be notified");
      setRcModal({ open: false });
      setRcComment("");
      invalidate();
    },
    onError: (e) => message.error(apiErrorMsg(e, "Request failed")),
  });

  const bulkApproveMut = useMutation({
    mutationFn: (ids: string[]) => timesheetApi.bulkApprove(ids),
    onSuccess: () => { message.success("Bulk approved"); invalidate(); },
    onError: (e) => message.error(apiErrorMsg(e, "Bulk approve failed")),
  });

  const bulkRejectMut = useMutation({
    mutationFn: (ids: string[]) => timesheetApi.bulkReject(ids),
    onSuccess: () => { message.success("Bulk rejected"); invalidate(); },
    onError: (e) => message.error(apiErrorMsg(e, "Bulk reject failed")),
  });

  // ── Attention items ────────────────────────────────────────────────────────
  const attentionItems = useMemo((): AttentionItem[] => {
    if (!dashboard) return [];
    const items: AttentionItem[] = [];
    if (dashboard.pending_reviews > 0) {
      items.push({
        key: "pending",
        severity: "warning",
        title: "Pending reviews",
        count: dashboard.pending_reviews,
        detail: "Submitted timesheets awaiting your approval",
      });
    }
    if (dashboard.missing_timesheets > 0) {
      items.push({
        key: "missing",
        severity: "error",
        title: "Missing timesheets",
        count: dashboard.missing_timesheets,
        detail: "Team members who haven't submitted this week",
      });
    }
    if (dashboard.rejected_this_week > 0) {
      items.push({
        key: "rejected",
        severity: "info",
        title: "Rejected this week",
        count: dashboard.rejected_this_week,
        detail: "May need follow-up with employees",
      });
    }
    return items;
  }, [dashboard]);

  const missingQueue = useMemo(() => {
    if (!dashboard?.missing_details) return [];
    return dashboard.missing_details.map((m) => ({
      id: m.employee_id,
      title: m.employee_name,
      subtitle: `Week of ${dayjs(m.week_start).format("DD MMM YYYY")}`,
      badge: { label: m.status, color: "warning" },
      meta: "Not submitted",
      metaColor: "var(--bms-warning)",
    }));
  }, [dashboard]);

  const pendingReviews = reviews.filter((r) => r.status === "SUBMITTED");

  // ── Review table columns ───────────────────────────────────────────────────
  const columns = [
    {
      title: "Employee",
      dataIndex: "employee_name",
      key: "employee",
      width: 200,
      render: (name: string) => <EmployeeCell name={name} />,
    },
    {
      title: "Week", key: "week", width: 180,
      render: (_: unknown, r: WeeklyTimesheet) =>
        `${dayjs(r.week_start).format("DD MMM")} – ${dayjs(r.week_end).format("DD MMM YYYY")}`,
    },
    {
      title: "Hours", key: "hours", width: 120,
      render: (_: unknown, r: WeeklyTimesheet) => `${r.total_hours}h / ${r.expected_hours}h`,
    },
    {
      title: "Behind", dataIndex: "hours_behind", key: "behind", width: 80,
      render: (v: number) => (v > 0 ? <Text type="warning">{v}h</Text> : "—"),
    },
    {
      title: (
        <span>
          Status
          {/* Badge count of pending */}
          {pendingReviews.length > 0 && (
            <Badge count={pendingReviews.length} size="small" style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      dataIndex: "status", key: "status", width: 150,
      render: (v: WeeklyTimesheet["status"]) => (
        <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>
      ),
    },
    {
      title: "Submitted", dataIndex: "submitted_at", key: "submitted", width: 130,
      render: (v: string) => (v ? dayjs(v).format("DD MMM HH:mm") : "—"),
    },
    {
      title: "Actions", key: "actions", width: 240, fixed: "right" as const,
      render: (_: unknown, r: WeeklyTimesheet) =>
        r.status === "SUBMITTED" ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {/* Approve */}
            <Button
              type="primary" size="small" icon={<CheckCircleOutlined />}
              onClick={() => setApproveModal({ open: true, id: r.id })}
              loading={approveMut.isPending}
            >
              Approve
            </Button>
            {/* Request Changes */}
            <Button
              size="small" icon={<EditOutlined />}
              onClick={() => setRcModal({ open: true, id: r.id })}
            >
              Changes
            </Button>
            {/* Reject */}
            <Button
              size="small" danger icon={<CloseCircleOutlined />}
              onClick={() => setRejectModal({ open: true, id: r.id })}
            >
              Reject
            </Button>
          </div>
        ) : "—",
    },
  ];

  // ── Team aggregate columns ─────────────────────────────────────────────────
  const aggregateColumns = [
    {
      title: "Employee",
      dataIndex: "employee_name",
      key: "name",
      width: 200,
      render: (name: string) => <EmployeeCell name={name} />,
    },
    { title: "Department", dataIndex: "department",    key: "dept", width: 130,
      render: (v: string | null) => v || "—" },
    {
      title: "Status", dataIndex: "status", key: "status", width: 130,
      render: (v: string) => {
        const color = v === "APPROVED" ? "success" : v === "SUBMITTED" ? "processing"
          : v === "REJECTED" ? "error" : v === "MISSING" ? "warning" : "default";
        const label = v === "MISSING" ? "Not submitted"
          : STATUS_LABEL[v as WeeklyTimesheet["status"]] ?? v;
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "Logged / Expected", key: "hours", width: 140,
      render: (_: unknown, r: TeamAggregatRow) =>
        `${r.total_hours}h / ${r.expected_hours}h`,
    },
    {
      title: "Behind", dataIndex: "hours_behind", key: "behind", width: 80,
      render: (v: number) => (v > 0 ? <Text type="warning">{v}h ↓</Text> : <Text type="success">—</Text>),
      sorter: (a: TeamAggregatRow, b: TeamAggregatRow) => b.hours_behind - a.hours_behind,
    },
    {
      title: "Utilization", dataIndex: "utilization_pct", key: "util", width: 120, align: "right" as const,
      render: (v: number) => <PercentChip value={v} mode="utilization" decimals={0} />,
      sorter: (a: TeamAggregatRow, b: TeamAggregatRow) => a.utilization_pct - b.utilization_pct,
    },
  ];

  if (dashLoading) {
    return (
      <DashboardShell>
        <DashboardPageSkeleton />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      {!embedded && (
        <DashboardHeader
          title="Timesheet Approval"
          subtitle="Review submissions, chase missing logs, and approve in bulk"
        />
      )}

      <AttentionQueue
        items={attentionItems}
        onItemClick={() => {
          document.getElementById("approval-queue")?.scrollIntoView({ behavior: "smooth" });
        }}
        emptyMessage="No timesheet issues — team is up to date this week."
      />

      {/* Metric cards */}
      <div className="dash-metrics">
        <ActionMetric
          label="Pending reviews"
          value={dashboard?.pending_reviews ?? 0}
          sub="Awaiting approval"
          accent={(dashboard?.pending_reviews ?? 0) > 0 ? "warning" : "success"}
          icon={<ClockCircleOutlined />}
        />
        <ActionMetric
          label="Approved this week"
          value={dashboard?.approved_this_week ?? 0}
          sub="Processed submissions"
          accent="success"
          icon={<CheckCircleOutlined />}
        />
        <ActionMetric
          label="Changes requested"
          value={dashboard?.rejected_this_week ?? 0}
          sub="Sent back for correction"
          accent={(dashboard?.rejected_this_week ?? 0) > 0 ? "danger" : "default"}
          icon={<CloseCircleOutlined />}
        />
        <ActionMetric
          label="Missing"
          value={dashboard?.missing_timesheets ?? 0}
          sub="Not yet submitted"
          accent={(dashboard?.missing_timesheets ?? 0) > 0 ? "warning" : "success"}
          icon={<WarningOutlined />}
        />
      </div>

      {/* Missing submissions queue */}
      {missingQueue.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <DashboardPanel
            title="Missing submissions"
            extra={<WarningOutlined style={{ color: "var(--bms-warning)" }} />}
          >
            <WorkQueue items={missingQueue} emptyTitle="No missing timesheets" />
          </DashboardPanel>
        </div>
      )}

      {/* Team aggregate panel */}
      <div style={{ marginBottom: 16 }}>
      <DashboardPanel
        title="Team Hours Overview"
        extra={
          <Space wrap>
            <TeamOutlined style={{ marginRight: 6 }} />
            <DatePicker
              picker="week"
              placeholder="Week"
              allowClear
              size="small"
              onChange={(d) => setAggWeekStart(d ? sundayOf(d).format("YYYY-MM-DD") : undefined)}
            />
            <Button
              size="small"
              type={showAggregate ? "primary" : "default"}
              onClick={() => setShowAggregate((v) => !v)}
            >
              {showAggregate ? "Hide" : "Show"}
            </Button>
          </Space>
        }
      >
        {showAggregate && (
          <Table
            columns={aggregateColumns}
            dataSource={filteredAggregateData}
            rowKey="employee_id"
            loading={aggLoading}
            size="small"
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 800 }}
          />
        )}
        {!showAggregate && (
          <div style={{ color: "#9ca3af", padding: "8px 0", fontSize: 13 }}>
            Click <strong>Show</strong> to load team hours — logged vs expected, sortable by department.
          </div>
        )}
      </DashboardPanel>
      </div>

      {/* Approval queue */}
      <DashboardPanel
        title="Approval queue"
        extra={
          pendingReviews.length > 0 ? (
            <Badge count={pendingReviews.length} style={{ backgroundColor: "#f97316" }}>
              <Tag color="processing" style={{ marginRight: 8 }}>to review</Tag>
            </Badge>
          ) : undefined
        }
      >
        {/* Filter bar */}
        <div className="dash-filter-bar">
          <FilterOutlined style={{ color: "var(--bms-text-3)" }} />
          <DatePicker
            picker="week"
            placeholder="Week"
            allowClear
            onChange={(d) => setWeekStart(d ? sundayOf(d).format("YYYY-MM-DD") : undefined)}
          />
          <Select
            allowClear
            placeholder="Project"
            style={{ width: 200, maxWidth: "100%" }}
            value={projectId}
            onChange={setProjectId}
            options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
          <Select
            allowClear
            placeholder="Employee"
            style={{ width: 200, maxWidth: "100%" }}
            showSearch
            value={employeeId}
            onChange={setEmployeeId}
            filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
            options={employees.map((e) => ({ value: e.id, label: e.full_name }))}
          />
          {/* Export per-employee / per-week */}
          <Tooltip title="Export filtered list to CSV">
            <Button
              icon={<DownloadOutlined />}
              onClick={async () => {
                try {
                  const exportParams = new URLSearchParams();
                  if (weekStart) exportParams.set("week_start", weekStart);
                  if (projectId) exportParams.set("project", projectId);
                  if (employeeId) exportParams.set("employee", employeeId);
                  const url = `/timesheets/reporting/export${exportParams.toString() ? `?${exportParams}` : ""}`;
                  
                  const response = await client.get(url, { responseType: "blob" });
                  const downloadUrl = URL.createObjectURL(response.data);
                  const a = document.createElement("a");
                  a.href = downloadUrl;
                  a.download = `reporting_export_${weekStart || "all"}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(downloadUrl);
                } catch (error) {
                  console.error("Export failed:", error);
                  message.error("Failed to export reporting list.");
                }
              }}
            >
              Export CSV
            </Button>
          </Tooltip>
          {/* Bulk actions */}
          {selected.length > 0 && (
            <div className="dash-filter-bar__bulk">
              <PermGuard permission={PERMS.PROJECT_TIMESHEET_APPROVE}>
                <Button
                  type="primary"
                  onClick={() => bulkApproveMut.mutate(selected)}
                  loading={bulkApproveMut.isPending}
                >
                  Approve {selected.length}
                </Button>
                <Button
                  danger
                  onClick={() => bulkRejectMut.mutate(selected)}
                  loading={bulkRejectMut.isPending}
                >
                  Reject {selected.length}
                </Button>
              </PermGuard>
            </div>
          )}
        </div>

        <div id="approval-queue" className="dash-table-wrap" style={{ maxHeight: "min(520px, 70vh)", overflow: "auto" }}>
          <Table
            rowSelection={{
              selectedRowKeys: selected,
              onChange: (keys) => setSelected(keys as string[]),
              getCheckboxProps: (r) => ({ disabled: r.status !== "SUBMITTED" }),
            }}
            columns={columns}
            dataSource={reviews}
            rowKey="id"
            loading={isLoading}
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: true }}
            scroll={{ x: 1000 }}
          />
        </div>
      </DashboardPanel>

      {/* Approve modal (with optional comment) */}
      <Modal
        title="Approve Timesheet"
        open={approveModal.open}
        onCancel={() => { setApproveModal({ open: false }); setApproveComment(""); }}
        onOk={() =>
          approveModal.id &&
          approveMut.mutate({ id: approveModal.id, comment: approveComment })
        }
        confirmLoading={approveMut.isPending}
        okText="Approve"
        okButtonProps={{ type: "primary" }}
      >
        <p style={{ marginBottom: 8, color: "#374151" }}>
          Optionally leave a note for the employee before approving.
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Optional approval note…"
          value={approveComment}
          onChange={(e) => setApproveComment(e.target.value)}
          style={{ marginTop: 4 }}
        />
      </Modal>

      {/* Request Changes modal */}
      <Modal
        title="Request Changes"
        open={rcModal.open}
        onCancel={() => { setRcModal({ open: false }); setRcComment(""); }}
        onOk={() => rcModal.id && requestChangesMut.mutate({ id: rcModal.id, comment: rcComment })}
        confirmLoading={requestChangesMut.isPending}
        okText="Send back"
        okButtonProps={{ disabled: !rcComment.trim() }}
      >
        <p style={{ marginBottom: 8, color: "#374151" }}>
          Describe what the employee needs to correct before resubmitting.
          This comment will be visible to them.
        </p>
        <Input.TextArea
          rows={3}
          placeholder="e.g. Please split the Monday entry — 3h on BMS-101, 2h on BMS-205"
          value={rcComment}
          onChange={(e) => setRcComment(e.target.value)}
          style={{ marginTop: 4 }}
        />
      </Modal>

      {/* Reject modal */}
      <Modal
        title="Reject Timesheet"
        open={rejectModal.open}
        onCancel={() => { setRejectModal({ open: false }); setRejectComment(""); }}
        onOk={() =>
          rejectModal.id &&
          rejectMut.mutate({ id: rejectModal.id, comment: rejectComment })
        }
        confirmLoading={rejectMut.isPending}
        okButtonProps={{ danger: true, disabled: !rejectComment.trim() }}
        okText="Reject"
      >
        <p style={{ marginBottom: 8, color: "#374151" }}>
          State the reason clearly — the employee will see this when they log back in.
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Reason for rejection (required)"
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          style={{ marginTop: 4 }}
        />
      </Modal>
    </DashboardShell>
  );
}

// Local status labels (module doesn't export STATUS_LABEL)
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  MISSING: "Not submitted",
  DRAFT: "Draft",
};