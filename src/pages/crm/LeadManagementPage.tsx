import { useState, useMemo } from "react";
import {
  Button, Tabs, Table, Tag, Input, Select, Progress, Statistic,
  Popconfirm, message, Spin, Empty, Row, Col, Card, Typography,
  Modal, Form, DatePicker, TimePicker, Checkbox, Upload, Tooltip, Switch,
} from "antd";
import {
  PlusOutlined, SearchOutlined, TeamOutlined, RiseOutlined, FundOutlined,
  BellOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  PhoneOutlined, MailOutlined, MessageOutlined, UserOutlined, FileOutlined, UploadOutlined,
  CheckCircleOutlined, SwapOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useAuthStore } from "@/store/auth";
import { usePermission } from "@/hooks/usePermission";
import { PERMS } from "@/constants/permissions";
import {
  fetchLeads, fetchLeadDashboard, createLead, updateLead, deleteLead, convertLead,
  fetchDocuments, uploadDocument, deleteDocument,
  fetchCustomFollowUpTypes, createCustomFollowUpType,
} from "@/services/leads";
import type { Lead, LeadStatus, LeadDocument, FollowUpType, CustomFollowUpType, PaginatedResponse } from "@/services/leads";
import { followUpApi, type FollowUpItem, type FollowUpCreate } from "@/services/followups";
import { meetingApi, type MeetingItem, type MeetingCreate } from "@/services/meetings";
import { todoApi, type TodoItem, type TodoCreate } from "@/services/todos";
import { employeeApi, type SimpleDropdownEmployee } from "@/services/employees";
import ClockTimePicker from "@/components/common/ClockTimePicker";
import { apiErrorMsg } from "@/utils/apiError";
import AddLeadModal from "./AddLeadModal";
import LeadDetailsDrawer from "./LeadDetailsDrawer";
import CrmSharedDocumentsManager from "@/components/crm/CrmSharedDocumentsManager";
import "./LeadManagementPage.css";

const { Option } = Select;
const { Title, Text } = Typography;
const { TextArea } = Input;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: LeadStatus | ""; label: string }[] = [
  { value: "",              label: "All Statuses" },
  { value: "new_lead",      label: "New Leads" },
  { value: "contacted",     label: "Contacted" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "qualified",     label: "Qualified" },
  { value: "converted",     label: "Converted" },
  { value: "lost",          label: "Lost" },
];

const STATUS_COLORS: Record<string, string> = {
  new_lead:      "blue",
  contacted:     "cyan",
  proposal_sent: "gold",
  qualified:     "green",
  converted:     "purple",
  lost:          "red",
};

const STATUS_LABELS: Record<string, string> = {
  new_lead:      "New Leads",
  contacted:     "Contacted",
  proposal_sent: "Proposal Sent",
  qualified:     "Qualified",
  converted:     "Converted",
  lost:          "Lost",
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    "default",
  medium: "orange",
  high:   "red",
};

const FOLLOWUP_TYPES: { type: FollowUpType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: "CALL",    label: "Call",    icon: <PhoneOutlined />, color: "#1890ff" },
  { type: "MESSAGE", label: "Message", icon: <MailOutlined />,  color: "#722ed1" },
  { type: "MEETING", label: "Meeting", icon: <UserOutlined />,  color: "#52c41a" },
  { type: "EMAIL",   label: "Email",   icon: <MailOutlined />,  color: "#fa8c16" },
];

const FUNNEL_ORDER: LeadStatus[] = [
  "new_lead", "contacted", "proposal_sent", "qualified", "converted", "lost",
];

const FUNNEL_PROGRESS_COLORS: string[] = [
  "#4b5bca", "#7c3aed", "#f59e0b", "#10b981", "#6366f1", "#ef4444",
];

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ onSwitchToLeads }: { onSwitchToLeads: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["lead-dashboard"],
    queryFn: fetchLeadDashboard,
  });

  if (isLoading) return <Spin style={{ display: "block", margin: "40px auto" }} />;
  if (isError) return <Empty description="Failed to load dashboard. Please try again." />;
  if (!data) return <Empty description="No dashboard data" />;

  const total = data.total ?? 0;
  const conversionRate = total > 0 ? ((data.converted / total) * 100).toFixed(1) : "0.0";
  const maxStatusCount = Math.max(1, ...FUNNEL_ORDER.map(s => data.by_status[s] ?? 0));
  const totalExpected = Number(data.total_expected_value ?? 0);
  const expectedDisplay = `₹${totalExpected.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const recentLeads = data.recent_leads ?? [];

  return (
    <div style={{ padding: "20px" }}>
      {/* Stat cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="stat-card" bodyStyle={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "rgba(75, 91, 202, 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <TeamOutlined style={{ fontSize: 22, color: "#4b5bca" }} />
              </div>
              <Statistic title="Total Captured Leads" value={total} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card" bodyStyle={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <RiseOutlined style={{ fontSize: 22, color: "#10b981" }} />
              </div>
              <Statistic title="Conversion Rate" value={`${conversionRate}%`} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card" bodyStyle={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "rgba(124, 58, 237, 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FundOutlined style={{ fontSize: 22, color: "#7c3aed" }} />
              </div>
              <Statistic title="Expected Value" value={expectedDisplay} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Funnel + Recent Leads */}
      <div className="lead-dashboard-grid">
        <div className="funnel-card">
          <Title level={5} style={{ marginBottom: 20 }}>Lead Funnel Stages</Title>
          {FUNNEL_ORDER.map((status, i) => {
            const count = data.by_status[status] ?? 0;
            const pct = Math.round((count / maxStatusCount) * 100);
            return (
              <div key={status} className="funnel-row">
                <div className="funnel-row-label">
                  <span>{STATUS_LABELS[status]}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
                <Progress
                  percent={pct}
                  showInfo={false}
                  strokeColor={FUNNEL_PROGRESS_COLORS[i]}
                  trailColor="#f0f0f0"
                  strokeWidth={8}
                />
              </div>
            );
          })}
        </div>

        <div className="activity-card">
          <Title level={5} style={{ marginBottom: 16 }}>Recent Leads</Title>
          {recentLeads.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">No leads yet. Add your first lead.</Text>}
            />
          ) : (
            <div>
              {recentLeads.slice(0, 5).map(lead => (
                <div key={lead.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: "1px solid #f5f5f5",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.institution_name}</div>
                    <div style={{ fontSize: 11, color: "#8c8c8c" }}>{lead.contact_person}</div>
                  </div>
                  <Tag color={STATUS_COLORS[lead.status] || "default"} style={{ borderRadius: 20, fontSize: 11 }}>
                    {STATUS_LABELS[lead.status] || lead.status}
                  </Tag>
                </div>
              ))}
              <Button type="link" size="small" style={{ paddingLeft: 0, marginTop: 8 }} onClick={onSwitchToLeads}>
                View all leads →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Leads Tab (table) ────────────────────────────────────────────────────────

interface LeadsTabProps {
  onViewLead: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onNewLead: () => void;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

function LeadsTab({ onViewLead, onEditLead, onNewLead, canCreate, canUpdate, canDelete }: LeadsTabProps) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const params: Record<string, unknown> = {};
  if (search)       params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["leads", params],
    queryFn: () => fetchLeads(params),
  });

  const deleteMut = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
      message.success("Lead deleted");
    },
    onError: () => message.error("Failed to delete lead"),
  });

  const convertMut = useMutation({
    mutationFn: (id: string) => convertLead(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["leads"] });
      const previousData = qc.getQueryData<PaginatedResponse<Lead>>(["leads", params]);

      if (previousData) {
        qc.setQueryData<PaginatedResponse<Lead>>(["leads", params], {
          ...previousData,
          results: previousData.results.map(l =>
            l.id === id
              ? {
                  ...l,
                  is_converted: !l.is_converted,
                  status: (!l.is_converted ? "converted" : "new_lead") as LeadStatus,
                }
              : l
          ),
        });
      }

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        qc.setQueryData(["leads", params], context.previousData);
      }
      message.error("Failed to toggle conversion");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
    },
    onSuccess: (updated) => {
      message.success(
        updated.is_converted ? "Lead converted to Client" : "Client conversion removed",
      );
    },
  });

  const leads: Lead[] = data?.results ?? [];

  const columns: ColumnsType<Lead> = [
    {
      title: "Project Name",
      key: "project",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.institution_name}</div>
          {r.client_name && (
            <div style={{ fontSize: 11, color: "var(--bms-text-2)" }}>{r.client_name}</div>
          )}
        </div>
      ),
    },
    {
      title: "Company",
      dataIndex: "company",
      key: "company",
      render: (v: string) => <span style={{ fontSize: 13 }}>{v || "—"}</span>,
    },
    {
      title: "Mobile",
      key: "mobile",
      render: (_, r) => (
        <div>
          {r.contact_person && <div style={{ fontSize: 13 }}>{r.contact_person}</div>}
          <div style={{ fontSize: 11, color: "var(--bms-text-2)" }}>{r.phone || "—"}</div>
        </div>
      ),
    },
    {
      title: "Business Type",
      dataIndex: "business_type_name",
      key: "business_type",
      render: (v?: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Billing Type",
      dataIndex: "billing_type_name",
      key: "billing_type",
      render: (v?: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Expected Value",
      dataIndex: "expected_deal_value",
      render: (v: string) => (
        <Text style={{ fontWeight: 500 }}>
          ₹{parseFloat(v || "0").toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </Text>
      ),
    },
    {
      title: "Next Follow-up",
      dataIndex: "next_followup_date",
      render: (d: string | null) => d || <Text type="secondary">—</Text>,
    },
    {
      title: "Converted",
      key: "converted",
      render: (_, r) => (
        <div
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          onClick={e => e.stopPropagation()}
        >
          <Switch
            checked={r.is_converted}
            disabled={!canUpdate}
            onChange={() => convertMut.mutate(r.id)}
            checkedChildren="ON"
            unCheckedChildren="OFF"
            size="small"
          />
          {r.is_converted && (
            <Tooltip title={`View Client Details for ${r.converted_client_name || r.institution_name}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }} onClick={e => { e.stopPropagation(); onViewLead(r); }}>
                <Text style={{ fontSize: 11, color: "#722ed1", fontWeight: 600 }}>
                  {r.converted_client_name || "Client"}
                </Text>
                <EyeOutlined style={{ fontSize: 11, color: "#722ed1" }} />
              </div>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_, r) => (
        <div style={{ display: "flex", gap: 4 }}>
          <Tooltip title="View Project / Client Details">
            <Button size="small" type="text" icon={<EyeOutlined />} onClick={e => { e.stopPropagation(); onViewLead(r); }} />
          </Tooltip>
          {canUpdate && (
            <Button size="small" type="text" icon={<EditOutlined />} onClick={e => { e.stopPropagation(); onEditLead(r); }} />
          )}
          {canDelete && (
            <Popconfirm
              title="Delete this lead?"
              onConfirm={e => { e?.stopPropagation(); deleteMut.mutate(r.id); }}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];


  return (
    <div>
      <div className="leads-table-toolbar">
        <div className="toolbar-left">
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
          >
            {STATUS_OPTIONS.map(o => (
              <Option key={o.value} value={o.value}>{o.label}</Option>
            ))}
          </Select>
        </div>
        <div className="toolbar-right">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {data?.count ?? 0} leads
          </Text>
        </div>
      </div>
      <Table<Lead>
        dataSource={leads}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="No leads found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        onRow={r => ({ onClick: () => onViewLead(r), style: { cursor: "pointer" } })}
      />
    </div>
  );
}

// ─── Global Followups Tab ─────────────────────────────────────────────────────

function FollowupsTab() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [customTypeModalOpen, setCustomTypeModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [customTypeForm] = Form.useForm();
  const [selectedType, setSelectedType] = useState<string>("CALL");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [draggedItem, setDraggedItem] = useState<(FollowUpItem | MeetingItem) | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const canUpdate = usePermission(PERMS.CRM_LEAD_UPDATE);
  const canDelete = usePermission(PERMS.CRM_LEAD_DELETE);

  const { data: leadsData } = useQuery({
    queryKey: ["leads", {}],
    queryFn: () => fetchLeads({}),
  });
  const leads = leadsData?.results ?? [];

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-simple-dropdown"],
    queryFn: () => employeeApi.simpleDropdown(),
  });

  const { data: followupsRes, isLoading: followupsLoading } = useQuery({
    queryKey: ["lead-followups-all"],
    queryFn: () => followUpApi.list({ source: "LEAD_MANAGEMENT", view_all: "true", page_size: 500 }),
  });

  const { data: meetingsRes, isLoading: meetingsLoading } = useQuery({
    queryKey: ["lead-meetings-all"],
    queryFn: () => meetingApi.list({ source: "LEAD_MANAGEMENT", view_all: "true", page_size: 500 }),
  });

  const { data: customTypesData } = useQuery({
    queryKey: ["custom-followup-types"],
    queryFn: fetchCustomFollowUpTypes,
  });
  const customTypes: CustomFollowUpType[] = customTypesData?.results ?? [];

  const allFollowupTypesList = [
    ...FOLLOWUP_TYPES,
    ...customTypes.map(c => ({
      type: c.code as FollowUpType,
      label: c.name,
      icon: <MessageOutlined />,
      color: c.color || "#4b5bca",
    })),
  ];

  const allFollowups: Array<FollowUpItem | MeetingItem> = useMemo(() => {
    const fList = (followupsRes?.results ?? []).map(f => ({ ...f, type: f.type || "CALL" }));
    const mList = (meetingsRes?.results ?? []).map(m => ({ ...m, type: "MEETING" as const }));
    return [...fList, ...mList].sort(
      (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
    );
  }, [followupsRes, meetingsRes]);

  const activeFollowups = allFollowups.filter(
    f => f.workflow_state_slug !== "completed" && f.workflow_state_slug !== "done" && f.workflow_state_slug !== "cancelled"
  );
  const completedFollowups = allFollowups.filter(
    f => f.workflow_state_slug === "completed" || f.workflow_state_slug === "done"
  );

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["lead-followups-all"] });
    qc.invalidateQueries({ queryKey: ["lead-meetings-all"] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-followups"] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-meetings"] });
    qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
    qc.invalidateQueries({ queryKey: ["followups-board"] });
    qc.invalidateQueries({ queryKey: ["meetings-board"] });
    qc.invalidateQueries({ queryKey: ["followups-list"] });
    qc.invalidateQueries({ queryKey: ["meetings-list"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
    qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
  };

  const createFollowUpMut = useMutation({
    mutationFn: (data: FollowUpCreate) => followUpApi.create({ ...data, source: "LEAD_MANAGEMENT" }),
    onSuccess: () => {
      invalidateAll();
      form.resetFields();
      setModalOpen(false);
      message.success("Follow-up created successfully");
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || "Failed to create follow-up"),
  });

  const createMeetingMut = useMutation({
    mutationFn: (data: MeetingCreate) => meetingApi.create({ ...data, source: "LEAD_MANAGEMENT" }),
    onSuccess: () => {
      invalidateAll();
      form.resetFields();
      setModalOpen(false);
      message.success("Meeting scheduled successfully");
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || "Failed to schedule meeting"),
  });

  const createCustomTypeMut = useMutation({
    mutationFn: (vals: { name: string }) => {
      const code = vals.name.trim().toUpperCase().replace(/\s+/g, "_");
      return createCustomFollowUpType({ name: vals.name.trim(), code });
    },
    onSuccess: (newType) => {
      qc.invalidateQueries({ queryKey: ["custom-followup-types"] });
      customTypeForm.resetFields();
      setCustomTypeModalOpen(false);
      message.success(`Follow-up type '${newType.name}' created`);
    },
    onError: () => message.error("Failed to create custom follow-up type"),
  });

  const handleCreateCustomType = async () => {
    const vals = await customTypeForm.validateFields();
    createCustomTypeMut.mutate(vals);
  };

  const transitionMut = useMutation({
    mutationFn: ({ id, isMeeting, state }: { id: string; isMeeting: boolean; state: string }) =>
      isMeeting ? meetingApi.transition(id, state) : followUpApi.transition(id, state),
    onMutate: async ({ id, isMeeting, state }) => {
      const qKey = isMeeting ? ["lead-meetings-all"] : ["lead-followups-all"];
      await qc.cancelQueries({ queryKey: qKey });
      const previousData = qc.getQueryData<any>(qKey);
      if (previousData?.results) {
        qc.setQueryData(qKey, {
          ...previousData,
          results: previousData.results.map((it: any) =>
            it.id === id
              ? { ...it, workflow_state_slug: state, workflow_state_name: state.toUpperCase() }
              : it
          ),
        });
      }
      return { previousData, qKey };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousData && context.qKey) {
        qc.setQueryData(context.qKey, context.previousData);
      }
      message.error(err?.response?.data?.detail || "Failed to update status");
    },
    onSuccess: () => {
      invalidateAll();
      message.success("Status updated successfully");
    },
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, isMeeting }: { id: string; isMeeting: boolean }) =>
      isMeeting ? meetingApi.delete(id) : followUpApi.delete(id),
    onMutate: async ({ id, isMeeting }) => {
      const qKey = isMeeting ? ["lead-meetings-all"] : ["lead-followups-all"];
      await qc.cancelQueries({ queryKey: qKey });
      const previousData = qc.getQueryData<any>(qKey);
      if (previousData?.results) {
        qc.setQueryData(qKey, {
          ...previousData,
          results: previousData.results.filter((it: any) => it.id !== id),
          count: Math.max(0, (previousData.count || 0) - 1),
        });
      }
      return { previousData, qKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData && context.qKey) {
        qc.setQueryData(context.qKey, context.previousData);
      }
      message.error("Failed to delete");
    },
    onSuccess: () => {
      invalidateAll();
      message.success("Deleted successfully");
    },
  });

  const handleCreate = async () => {
    const vals = await form.validateFields();
    const [startDate, endDate] = vals.date_range ?? [dayjs(), dayjs()];
    const startTimeStr = vals.start_time ? vals.start_time.format("HH:mm:ss") : null;
    const endTimeStr = vals.end_time ? vals.end_time.format("HH:mm:ss") : null;
    const assignees = vals.assignees ? (Array.isArray(vals.assignees) ? vals.assignees : [vals.assignees]) : [];

    if (selectedType === "MEETING") {
      createMeetingMut.mutate({
        title: vals.title,
        lead: vals.lead,
        priority: vals.priority || "MEDIUM",
        description: vals.notes || "",
        assignees,
        start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
        end_date: endDate ? endDate.format("YYYY-MM-DD") : null,
        start_time: startTimeStr,
        end_time: endTimeStr,
        meeting_mode: "ONLINE",
        source: "LEAD_MANAGEMENT",
      });
    } else {
      createFollowUpMut.mutate({
        title: vals.title,
        type: selectedType,
        lead: vals.lead,
        priority: vals.priority || "MEDIUM",
        description: vals.notes || "",
        assignees,
        start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
        end_date: endDate ? endDate.format("YYYY-MM-DD") : null,
        start_time: startTimeStr,
        end_time: endTimeStr,
        source: "LEAD_MANAGEMENT",
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, item: FollowUpItem | MeetingItem) => {
    e.dataTransfer.setData("text/plain", item.id);
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent, targetType: string) => {
    e.preventDefault();
    if (dragOverColumn !== targetType) {
      setDragOverColumn(targetType);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetType: string) => {
    e.preventDefault();
    if (dragOverColumn === targetType) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetType: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!canUpdate) {
      message.warning("You do not have permission to update follow-ups");
      return;
    }
    if (draggedItem && draggedItem.type !== targetType) {
      if (draggedItem.type !== "MEETING" && targetType === "MEETING") {
        const assignees = draggedItem.assignees_data ? draggedItem.assignees_data.map((a: any) => a.id) : ((draggedItem as any).assignees || []);
        meetingApi.create({
          title: draggedItem.title,
          lead: (draggedItem as any).lead || (draggedItem as any).lead_id || undefined,
          start_date: draggedItem.start_date || dayjs().format("YYYY-MM-DD"),
          end_date: draggedItem.end_date || draggedItem.start_date || dayjs().format("YYYY-MM-DD"),
          start_time: draggedItem.start_time || undefined,
          end_time: draggedItem.end_time || undefined,
          assignees,
          description: draggedItem.description || (draggedItem as any).notes || "",
          agenda: draggedItem.description || (draggedItem as any).notes || "",
          mode: "ONLINE",
          priority: draggedItem.priority || "MEDIUM",
          source: "LEAD_MANAGEMENT",
        }).then(() => {
          return followUpApi.delete(draggedItem.id);
        }).then(() => {
          invalidateAll();
          message.success("Moved to Meeting");
        }).catch((err: any) => {
          message.error(apiErrorMsg(err, "Failed to move to meeting"));
        });
      } else if (draggedItem.type === "MEETING" && targetType !== "MEETING") {
        const assignees = draggedItem.assignees_data ? draggedItem.assignees_data.map((a: any) => a.id) : ((draggedItem as any).assignees || []);
        followUpApi.create({
          title: draggedItem.title,
          type: targetType,
          lead: (draggedItem as any).lead || (draggedItem as any).lead_id || undefined,
          start_date: draggedItem.start_date || dayjs().format("YYYY-MM-DD"),
          end_date: draggedItem.end_date || draggedItem.start_date || dayjs().format("YYYY-MM-DD"),
          start_time: draggedItem.start_time || undefined,
          end_time: draggedItem.end_time || undefined,
          assignees,
          description: draggedItem.description || (draggedItem as any).agenda || "",
          priority: draggedItem.priority || "MEDIUM",
          source: "LEAD_MANAGEMENT",
        }).then(() => {
          return meetingApi.delete(draggedItem.id);
        }).then(() => {
          invalidateAll();
          message.success(`Moved to ${targetType}`);
        }).catch((err: any) => {
          message.error(apiErrorMsg(err, `Failed to move to ${targetType}`));
        });
      } else {
        followUpApi.update(draggedItem.id, { type: targetType }).then(() => {
          invalidateAll();
          message.success(`Moved to ${targetType}`);
        }).catch((err: any) => {
          message.error(apiErrorMsg(err, `Failed to move to ${targetType}`));
        });
      }
    }
    setDraggedItem(null);
  };

  const columns: ColumnsType<FollowUpItem | MeetingItem> = [
    {
      title: "Status",
      key: "status",
      width: 140,
      render: (_, r) => {
        const isCompleted = r.workflow_state_slug === "completed" || r.workflow_state_slug === "done";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Checkbox
              checked={isCompleted}
              onChange={() =>
                transitionMut.mutate({
                  id: r.id,
                  isMeeting: r.type === "MEETING",
                  state: isCompleted ? "planning" : "completed",
                })
              }
            />
            <Tag
              color={
                r.workflow_state_color ||
                (isCompleted ? "green" : r.workflow_state_slug === "inprogress" ? "blue" : "purple")
              }
              style={{ borderRadius: 12, fontSize: 11, margin: 0 }}
            >
              {r.workflow_state_name || (r.workflow_state_slug ? r.workflow_state_slug.toUpperCase() : "PENDING")}
            </Tag>
          </div>
        );
      },
    },
    {
      title: "Project / Lead",
      key: "lead",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.lead_name || "—"}</div>
          {r.lead_company && <div style={{ fontSize: 11, color: "var(--bms-text-2)" }}>{r.lead_company}</div>}
        </div>
      ),
    },
    {
      title: "Assignee",
      key: "assignees",
      render: (_, r) => {
        const names = (r.assignees_data ?? []).map(a => a.full_name).join(", ");
        return <span style={{ fontSize: 12 }}>{names || "—"}</span>;
      },
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (t: string) => {
        const item = allFollowupTypesList.find(f => f.type === t);
        return (
          <Tag icon={item?.icon} color={item?.color || "blue"}>
            {item?.label || t}
          </Tag>
        );
      },
    },
    { title: "Title", dataIndex: "title", key: "title", render: (t: string) => <strong>{t}</strong> },
    {
      title: "Date",
      key: "date",
      render: (_, r) => (
        <span>
          {r.start_date && r.end_date && r.start_date !== r.end_date
            ? `${r.start_date} – ${r.end_date}`
            : r.end_date || r.start_date || "—"}
        </span>
      ),
    },
    {
      title: "Time",
      key: "time",
      render: (_, r) => (
        <span>
          {r.start_time && r.end_time
            ? `${r.start_time.slice(0, 5)} – ${r.end_time.slice(0, 5)}`
            : r.start_time
            ? r.start_time.slice(0, 5)
            : "—"}
        </span>
      ),
    },
    { title: "Notes", dataIndex: "description", key: "description", ellipsis: true },
    {
      title: "Action",
      key: "action",
      width: 80,
      render: (_, r) => (
        <Popconfirm
          title="Delete this item?"
          onConfirm={() => deleteMut.mutate({ id: r.id, isMeeting: r.type === "MEETING" })}
        >
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const isLoading = followupsLoading || meetingsLoading;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Title level={4} style={{ margin: 0 }}>Follow-ups & Meetings</Title>
          <Select
            value={viewMode}
            onChange={setViewMode}
            size="small"
            style={{ width: 120 }}
          >
            <Option value="kanban">Card Board</Option>
            <Option value="table">Table View</Option>
          </Select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            icon={<PlusOutlined />}
            onClick={() => { customTypeForm.resetFields(); setCustomTypeModalOpen(true); }}
          >
            Add Follow-Up Type
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setSelectedType("CALL"); form.resetFields(); setModalOpen(true); }}
            style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
          >
            Add Follow Up
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Spin style={{ display: "block", margin: "40px auto" }} />
      ) : viewMode === "table" ? (
        <Table<FollowUpItem | MeetingItem>
          dataSource={allFollowups}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="No follow-ups found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      ) : (
        <>
          {/* Card Columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, overflowX: "auto" }}>
            {FOLLOWUP_TYPES.map(ft => {
              const itemsInCol = activeFollowups.filter(f => f.type === ft.type);
              const isTarget = dragOverColumn === ft.type;
              return (
                <div
                  key={ft.type}
                  onDragOver={e => handleDragOver(e, ft.type)}
                  onDragLeave={e => handleDragLeave(e, ft.type)}
                  onDrop={e => handleDrop(e, ft.type)}
                  style={{
                    background: isTarget ? "rgba(75, 91, 202, 0.08)" : "var(--bms-surface)",
                    border: isTarget ? "2px dashed #4b5bca" : "1px solid var(--bms-border)",
                    borderRadius: 10,
                    padding: 12,
                    height: "calc(100vh - 320px)",
                    minHeight: 380,
                    maxHeight: 560,
                    display: "flex",
                    flexDirection: "column",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--bms-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 16, color: ft.color }}>{ft.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{ft.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Tag style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>{itemsInCol.length}</Tag>
                      <Button
                        size="small"
                        type="text"
                        icon={<PlusOutlined />}
                        onClick={() => { setSelectedType(ft.type); form.resetFields(); setModalOpen(true); }}
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                    {itemsInCol.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px 6px", color: "var(--bms-text-2)", fontSize: 11 }}>
                        Drop follow-ups here
                      </div>
                    ) : (
                      itemsInCol.map(f => (
                        <div
                          key={f.id}
                          draggable={canUpdate}
                          onDragStart={e => handleDragStart(e, f)}
                          style={{
                            background: "var(--bms-surface-2)",
                            border: "1px solid var(--bms-border)",
                            borderRadius: 8,
                            padding: 8,
                            marginBottom: 8,
                            cursor: canUpdate ? "grab" : "default",
                            boxShadow: "var(--shadow-sm)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: 1 }}>
                              <Checkbox
                                checked={f.workflow_state_slug === "completed" || f.workflow_state_slug === "done"}
                                onChange={() =>
                                  transitionMut.mutate({
                                    id: f.id,
                                    isMeeting: f.type === "MEETING",
                                    state: (f.workflow_state_slug === "completed" || f.workflow_state_slug === "done") ? "planning" : "completed",
                                  })
                                }
                                style={{ marginTop: 2 }}
                              />
                              <span style={{ fontWeight: 600, fontSize: 12, color: "var(--bms-text)" }}>{f.title}</span>
                            </div>
                            <Popconfirm
                              title="Delete this item?"
                              onConfirm={() => deleteMut.mutate({ id: f.id, isMeeting: f.type === "MEETING" })}
                            >
                              <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ padding: "0 4px", height: 18 }} />
                            </Popconfirm>
                          </div>

                          {/* Status Tag */}
                          <div style={{ paddingLeft: 22, marginBottom: 4 }}>
                            <Tag
                              color={
                                f.workflow_state_color ||
                                (f.workflow_state_slug === "completed" ? "green" : f.workflow_state_slug === "inprogress" ? "blue" : "purple")
                              }
                              style={{ borderRadius: 10, fontSize: 10, margin: 0, padding: "0 6px" }}
                            >
                              {f.workflow_state_name || (f.workflow_state_slug ? f.workflow_state_slug.toUpperCase() : "PENDING")}
                            </Tag>
                          </div>

                          {f.lead_name && (
                            <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginBottom: 2, paddingLeft: 22 }}>
                              Lead: {f.lead_name}
                            </div>
                          )}

                          {f.assignees_data && f.assignees_data.length > 0 && (
                            <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginBottom: 4, paddingLeft: 22 }}>
                              Assignee: {f.assignees_data.map(a => a.full_name).join(", ")}
                            </div>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--bms-text-2)", paddingLeft: 22 }}>
                            <span>{f.start_date === f.end_date ? f.end_date : `${f.start_date || ""} – ${f.end_date || ""}`}</span>
                            {f.start_time && <span>{f.start_time.slice(0, 5)}</span>}
                          </div>

                          {f.description && (
                            <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 4, paddingLeft: 22, fontStyle: "italic" }}>
                              {f.description.length > 40 ? `${f.description.slice(0, 40)}...` : f.description}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Custom Follow-Up Types */}
            {customTypes.map(ct => {
              const itemsInCol = activeFollowups.filter(f => f.type === ct.code);
              const isTarget = dragOverColumn === ct.code;
              return (
                <div
                  key={ct.id}
                  onDragOver={e => handleDragOver(e, ct.code)}
                  onDragLeave={e => handleDragLeave(e, ct.code)}
                  onDrop={e => handleDrop(e, ct.code)}
                  style={{
                    background: isTarget ? "rgba(75, 91, 202, 0.08)" : "var(--bms-surface)",
                    border: isTarget ? "2px dashed #4b5bca" : "1px solid var(--bms-border)",
                    borderRadius: 10,
                    padding: 12,
                    height: "calc(100vh - 320px)",
                    minHeight: 380,
                    maxHeight: 560,
                    display: "flex",
                    flexDirection: "column",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--bms-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <MessageOutlined style={{ fontSize: 16, color: ct.color || "#4b5bca" }} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{ct.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Tag style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>{itemsInCol.length}</Tag>
                      <Button
                        size="small"
                        type="text"
                        icon={<PlusOutlined />}
                        onClick={() => { setSelectedType(ct.code); form.resetFields(); setModalOpen(true); }}
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                    {itemsInCol.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px 6px", color: "var(--bms-text-2)", fontSize: 11 }}>
                        Drop follow-ups here
                      </div>
                    ) : (
                      itemsInCol.map(f => (
                        <div
                          key={f.id}
                          draggable={canUpdate}
                          onDragStart={e => handleDragStart(e, f)}
                          style={{
                            background: "var(--bms-surface-2)",
                            border: "1px solid var(--bms-border)",
                            borderRadius: 8,
                            padding: 8,
                            marginBottom: 8,
                            cursor: canUpdate ? "grab" : "default",
                            boxShadow: "var(--shadow-sm)",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: 1 }}>
                              <Checkbox
                                checked={f.workflow_state_slug === "completed" || f.workflow_state_slug === "done"}
                                onChange={() =>
                                  transitionMut.mutate({
                                    id: f.id,
                                    isMeeting: f.type === "MEETING",
                                    state: (f.workflow_state_slug === "completed" || f.workflow_state_slug === "done") ? "planning" : "completed",
                                  })
                                }
                                style={{ marginTop: 2 }}
                              />
                              <span style={{ fontWeight: 600, fontSize: 12, color: "var(--bms-text)" }}>{f.title}</span>
                            </div>
                            <Popconfirm title="Delete this item?" onConfirm={() => deleteMut.mutate({ id: f.id, isMeeting: f.type === "MEETING" })}>
                              <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ padding: "0 4px", height: 18 }} />
                            </Popconfirm>
                          </div>

                          {/* Status Tag */}
                          <div style={{ paddingLeft: 22, marginBottom: 4 }}>
                            <Tag
                              color={
                                f.workflow_state_color ||
                                (f.workflow_state_slug === "completed" ? "green" : f.workflow_state_slug === "inprogress" ? "blue" : "purple")
                              }
                              style={{ borderRadius: 10, fontSize: 10, margin: 0, padding: "0 6px" }}
                            >
                              {f.workflow_state_name || (f.workflow_state_slug ? f.workflow_state_slug.toUpperCase() : "PENDING")}
                            </Tag>
                          </div>

                          {f.lead_name && (
                            <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginBottom: 2, paddingLeft: 22 }}>
                              Lead: {f.lead_name}
                            </div>
                          )}

                          {f.assignees_data && f.assignees_data.length > 0 && (
                            <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginBottom: 4, paddingLeft: 22 }}>
                              Assignee: {f.assignees_data.map(a => a.full_name).join(", ")}
                            </div>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--bms-text-2)", paddingLeft: 22 }}>
                            <span>{f.start_date === f.end_date ? f.end_date : `${f.start_date || ""} – ${f.end_date || ""}`}</span>
                            {f.start_time && <span>{f.start_time.slice(0, 5)}</span>}
                          </div>

                          {f.description && (
                            <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 4, paddingLeft: 22, fontStyle: "italic" }}>
                              {f.description.length > 40 ? `${f.description.slice(0, 40)}...` : f.description}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Follow-Up Type Button Card */}
            <div
              onClick={() => { customTypeForm.resetFields(); setCustomTypeModalOpen(true); }}
              style={{
                border: "2px dashed var(--bms-border)",
                borderRadius: 10,
                padding: 12,
                minHeight: 360,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                background: "var(--bms-surface)",
                transition: "all 0.2s ease",
              }}
            >
              <PlusOutlined style={{ fontSize: 24, color: "#4b5bca", marginBottom: 8 }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>+ Add Follow-Up Type</span>
              <span style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 4, textAlign: "center" }}>Create custom category</span>
            </div>
          </div>

          {/* Completed Follow Up History Section */}
          <div style={{ marginTop: 28, background: "var(--bms-surface)", border: "1px solid var(--bms-border)", borderRadius: 10, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, borderBottom: "1px solid var(--bms-border)", paddingBottom: 10 }}>
              <CheckCircleOutlined style={{ fontSize: 18, color: "var(--bms-success)" }} />
              <Title level={5} style={{ margin: 0, color: "var(--bms-text)" }}>Completed Follow Up & Meeting History</Title>
              <Tag color="green" style={{ borderRadius: 12, marginLeft: 8 }}>
                {completedFollowups.length} items
              </Tag>
            </div>

            {completedFollowups.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No completed follow-ups or meetings yet.</Text>} />
            ) : (
              <Row gutter={[12, 12]}>
                {completedFollowups.map(f => {
                  const ft = allFollowupTypesList.find(item => item.type === f.type);
                  return (
                    <Col xs={24} sm={12} md={8} key={f.id}>
                      <div
                        style={{
                          background: "var(--bms-surface-2)",
                          border: "1px solid var(--bms-border)",
                          borderRadius: 8,
                          padding: 12,
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <Checkbox
                          checked={true}
                          onChange={() =>
                            transitionMut.mutate({
                              id: f.id,
                              isMeeting: f.type === "MEETING",
                              state: "planning",
                            })
                          }
                          style={{ marginTop: 2 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 600, fontSize: 13, textDecoration: "line-through", color: "var(--bms-text-2)" }}>
                              {f.title}
                            </span>
                            <Tag icon={ft?.icon} color={ft?.color || "default"} style={{ fontSize: 10, margin: 0 }}>
                              {ft?.label || f.type}
                            </Tag>
                          </div>
                          {f.lead_name && (
                            <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 2 }}>
                              Project: {f.lead_name}
                            </div>
                          )}
                          {f.assignees_data && f.assignees_data.length > 0 && (
                            <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 2 }}>
                              Assignee: {f.assignees_data.map(a => a.full_name).join(", ")}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 4 }}>
                            Completed • {f.start_date || f.end_date} {f.start_time ? f.start_time.slice(0, 5) : ""}
                          </div>
                        </div>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            )}
          </div>
        </>
      )}

      {/* Add Follow Up Modal */}
      <Modal
        title="Add New Follow Up"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setSelectedLeadId(null); form.resetFields(); }}
        onOk={handleCreate}
        confirmLoading={createFollowUpMut.isPending || createMeetingMut.isPending}
        okText="Save Follow Up"
        width={580}
      >
        <Form form={form} layout="vertical" style={{ paddingTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item
              name="lead"
              label="Project Name"
              rules={[{ required: true, message: "Please select a Project" }]}
              style={{ gridColumn: "1/-1" }}
            >
              <Select
                placeholder="Select a Project"
                showSearch
                optionFilterProp="children"
                onChange={(val: string) => {
                  setSelectedLeadId(val);
                  const lead = leads.find(l => l.id === val);
                  form.setFieldValue("company_display", lead?.company || "");
                }}
              >
                {leads.map(l => (
                  <Option key={l.id} value={l.id}>
                    {l.institution_name}
                    {l.client_name ? ` — ${l.client_name}` : ""}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {selectedLeadId && (() => {
              const lead = leads.find(l => l.id === selectedLeadId);
              return lead ? (
                <div style={{ gridColumn: "1/-1", marginTop: -8, marginBottom: 12, padding: "8px 12px", background: "rgba(75, 91, 202, 0.06)", borderRadius: 6, border: "1px solid rgba(75, 91, 202, 0.2)" }}>
                  <span style={{ fontSize: 12, color: "#4b5bca", fontWeight: 500 }}>Company: </span>
                  <span style={{ fontSize: 12, color: "var(--bms-text)" }}>{lead.company}</span>
                </div>
              ) : null;
            })()}
          </div>

          <Form.Item label="Follow-up Type" required>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {allFollowupTypesList.map(ft => (
                <div
                  key={ft.type}
                  onClick={() => setSelectedType(ft.type)}
                  style={{
                    border: selectedType === ft.type ? `2px solid ${ft.color}` : "1px solid var(--bms-border)",
                    borderRadius: 8,
                    padding: "10px 8px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: selectedType === ft.type ? "rgba(75, 91, 202, 0.15)" : "var(--bms-surface)",
                  }}
                >
                  <div style={{ fontSize: 18, color: ft.color, marginBottom: 4 }}>{ft.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: selectedType === ft.type ? 600 : 400, color: "var(--bms-text)" }}>{ft.label}</div>
                </div>
              ))}
            </div>
          </Form.Item>

          <Form.Item
            name="assignees"
            label="Assignee(s)"
            rules={[{ required: true, message: "Please select an assignee" }]}
          >
            <Select
              mode="multiple"
              placeholder="Select employee assignees"
              showSearch
              optionFilterProp="children"
            >
              {employees.map(e => (
                <Option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_code || "Staff"})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input placeholder="e.g. Call regarding quotation update" />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item
              name="date_range"
              label="Date Range (Start & End)"
              initialValue={[dayjs(), dayjs()]}
              rules={[{ required: true, message: "Date range is required" }]}
              style={{ gridColumn: "1/-1" }}
            >
              <DatePicker.RangePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
            </Form.Item>

            <Form.Item name="start_time" label="Start Time">
              <ClockTimePicker placeholder="Select start time" />
            </Form.Item>
            <Form.Item name="end_time" label="End Time">
              <ClockTimePicker placeholder="Select end time" />
            </Form.Item>
          </div>

          <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
            <Select>
              <Option value="HIGH">High</Option>
              <Option value="MEDIUM">Medium</Option>
              <Option value="LOW">Low</Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Enter details or notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Custom Follow-Up Type Modal */}
      <Modal
        title="Add Custom Follow-Up Type"
        open={customTypeModalOpen}
        onCancel={() => setCustomTypeModalOpen(false)}
        onOk={handleCreateCustomType}
        confirmLoading={createCustomTypeMut.isPending}
        okText="Create Type"
        width={420}
      >
        <Form form={customTypeForm} layout="vertical" style={{ paddingTop: 8 }}>
          <Form.Item
            name="name"
            label="Follow-up Type Name"
            rules={[{ required: true, message: "Type name is required" }]}
          >
            <Input placeholder="e.g. WhatsApp, LinkedIn, Site Visit" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Global Tasks Tab ─────────────────────────────────────────────────────────

function TasksTab() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TodoItem | null>(null);
  const [form] = Form.useForm();

  const canUpdate = usePermission(PERMS.CRM_LEAD_UPDATE);
  const canDelete = usePermission(PERMS.CRM_LEAD_DELETE);

  const { data: leadsData } = useQuery({
    queryKey: ["leads", {}],
    queryFn: () => fetchLeads({}),
  });
  const leads = leadsData?.results ?? [];

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-simple-dropdown"],
    queryFn: () => employeeApi.simpleDropdown(),
  });

  const { data: tasksRes, isLoading } = useQuery({
    queryKey: ["lead-tasks-all"],
    queryFn: () => todoApi.list({ source: "LEAD_MANAGEMENT", view_all: "true", page_size: 500 }),
  });

  const tasks: TodoItem[] = tasksRes?.results ?? [];

  const invalidateTasks = () => {
    qc.invalidateQueries({ queryKey: ["lead-tasks-all"] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-todos"] });
    qc.invalidateQueries({ queryKey: ["todos-board"] });
    qc.invalidateQueries({ queryKey: ["todos-list"] });
    qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
    qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
  };

  const createMut = useMutation({
    mutationFn: (data: TodoCreate) => todoApi.create({ ...data, source: "LEAD_MANAGEMENT" }),
    onSuccess: () => {
      invalidateTasks();
      form.resetFields();
      setEditingTask(null);
      setModalOpen(false);
      message.success("Task created successfully");
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to create task")),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TodoCreate> }) => todoApi.update(id, data),
    onSuccess: () => {
      invalidateTasks();
      form.resetFields();
      setEditingTask(null);
      setModalOpen(false);
      message.success("Task updated successfully");
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to update task")),
  });

  const transitionMut = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) => todoApi.transition(id, state),
    onMutate: async ({ id, state }) => {
      await qc.cancelQueries({ queryKey: ["lead-tasks-all"] });
      const previousData = qc.getQueryData<any>(["lead-tasks-all"]);
      if (previousData?.results) {
        qc.setQueryData(["lead-tasks-all"], {
          ...previousData,
          results: previousData.results.map((it: any) =>
            it.id === id
              ? { ...it, workflow_state_slug: state, workflow_state_name: state.toUpperCase() }
              : it
          ),
        });
      }
      return { previousData };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousData) {
        qc.setQueryData(["lead-tasks-all"], context.previousData);
      }
      message.error(apiErrorMsg(err, "Failed to update status"));
    },
    onSuccess: () => {
      invalidateTasks();
      message.success("Task status updated");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => todoApi.delete(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["lead-tasks-all"] });
      const previousData = qc.getQueryData<any>(["lead-tasks-all"]);
      if (previousData?.results) {
        qc.setQueryData(["lead-tasks-all"], {
          ...previousData,
          results: previousData.results.filter((it: any) => it.id !== id),
          count: Math.max(0, (previousData.count || 0) - 1),
        });
      }
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        qc.setQueryData(["lead-tasks-all"], context.previousData);
      }
      message.error("Failed to delete task");
    },
    onSuccess: () => {
      invalidateTasks();
      message.success("Task deleted");
    },
  });

  const handleSave = async () => {
    const vals = await form.validateFields();
    const [startDate, endDate] = vals.date_range ?? [null, null];
    const startTimeStr = vals.start_time
      ? (typeof vals.start_time.format === "function"
          ? vals.start_time.format("HH:mm:ss")
          : typeof vals.start_time === "string" && vals.start_time.trim()
          ? vals.start_time.trim()
          : null)
      : null;
    const endTimeStr = vals.end_time
      ? (typeof vals.end_time.format === "function"
          ? vals.end_time.format("HH:mm:ss")
          : typeof vals.end_time === "string" && vals.end_time.trim()
          ? vals.end_time.trim()
          : null)
      : null;
    const assignees = vals.assignees ? (Array.isArray(vals.assignees) ? vals.assignees : [vals.assignees]) : [];

    const payload: TodoCreate = {
      lead: vals.lead,
      title: vals.title,
      description: vals.description || "",
      priority: vals.priority || "MEDIUM",
      assignees,
      start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
      due_date: endDate ? endDate.format("YYYY-MM-DD") : null,
      start_time: startTimeStr,
      end_time: endTimeStr,
    };

    if (editingTask) {
      updateMut.mutate({ id: editingTask.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleEditTask = (task: TodoItem) => {
    setEditingTask(task);
    form.setFieldsValue({
      lead: task.lead,
      title: task.title,
      description: task.description,
      priority: task.priority || "MEDIUM",
      assignees: task.assignees || [],
      date_range: [
        task.start_date ? dayjs(task.start_date) : null,
        task.due_date ? dayjs(task.due_date) : null,
      ],
      start_time: task.start_time ? dayjs(`2000-01-01T${task.start_time}`) : null,
      end_time: task.end_time ? dayjs(`2000-01-01T${task.end_time}`) : null,
    });
    setModalOpen(true);
  };

  const columns: ColumnsType<TodoItem> = [
    {
      title: "Status",
      key: "status",
      width: 140,
      render: (_, r) => {
        const isCompleted = r.workflow_state_slug === "done" || r.workflow_state_slug === "completed";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Checkbox
              checked={isCompleted}
              onChange={() =>
                transitionMut.mutate({
                  id: r.id,
                  state: isCompleted ? "open" : "done",
                })
              }
            />
            <Tag
              color={
                r.workflow_state_color ||
                (isCompleted ? "green" : r.workflow_state_slug === "inprogress" ? "blue" : "purple")
              }
              style={{ borderRadius: 12, fontSize: 11, margin: 0 }}
            >
              {r.workflow_state_name || (r.workflow_state_slug ? r.workflow_state_slug.toUpperCase() : "OPEN")}
            </Tag>
          </div>
        );
      },
    },
    {
      title: "Task Title",
      dataIndex: "title",
      key: "title",
      render: (t: string, r) => {
        const isCompleted = r.workflow_state_slug === "done" || r.workflow_state_slug === "completed";
        return (
          <span style={{ textDecoration: isCompleted ? "line-through" : "none", color: isCompleted ? "var(--bms-text-2)" : "var(--bms-text)", fontWeight: 500 }}>
            {t}
          </span>
        );
      },
    },
    {
      title: "Project / Lead",
      key: "lead",
      render: (_, r) => <span>{r.lead_name || r.lead_company || "—"}</span>,
    },
    {
      title: "Assignee(s)",
      key: "assignees",
      render: (_, r) => {
        const names = (r.assignees_data ?? []).map(a => a.full_name).join(", ");
        return <span style={{ fontSize: 12 }}>{names || "—"}</span>;
      },
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (p: string) => {
        const textColors: Record<string, string> = { LOW: "var(--bms-text-2)", MEDIUM: "#fa8c16", HIGH: "#f5222d", low: "var(--bms-text-2)", medium: "#fa8c16", high: "#f5222d" };
        return (
          <Text style={{ fontWeight: 500, color: textColors[p] || "inherit" }}>
            {p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "—"}
          </Text>
        );
      },
    },
    {
      title: "Date Range",
      key: "dates",
      render: (_, r) => (
        <span>
          {r.start_date && r.due_date && r.start_date !== r.due_date
            ? `${r.start_date} – ${r.due_date}`
            : r.due_date || r.start_date || <Text type="secondary">—</Text>}
        </span>
      ),
    },
    {
      title: "Time",
      key: "time",
      render: (_, r) => (
        <span>
          {r.start_time && r.end_time
            ? `${r.start_time.slice(0, 5)} – ${r.end_time.slice(0, 5)}`
            : r.start_time
            ? r.start_time.slice(0, 5)
            : "—"}
        </span>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_, r) => (
        <div style={{ display: "flex", gap: 4 }}>
          {canUpdate && (
            <Tooltip title="Edit Task">
              <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEditTask(r)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm title="Delete this task?" onConfirm={() => deleteMut.mutate(r.id)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Tasks</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingTask(null); form.resetFields(); setModalOpen(true); }}
          style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
        >
          Add Task
        </Button>
      </div>

      <Table<TodoItem>
        dataSource={tasks}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="No tasks found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />

      <Modal
        title={editingTask ? "Edit Task" : "Add New Task"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingTask(null); }}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText={editingTask ? "Save Changes" : "Save Task"}
        width={540}
      >
        <Form form={form} layout="vertical" style={{ paddingTop: 8 }}>
          <Form.Item
            name="lead"
            label="Project Name"
            rules={[{ required: true, message: "Please select a Project" }]}
          >
            <Select placeholder="Select a Project" showSearch optionFilterProp="children">
              {leads.map(l => (
                <Option key={l.id} value={l.id}>
                  {l.institution_name}
                  {l.client_name ? ` — ${l.client_name}` : ""}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="Task Title"
            rules={[{ required: true, message: "Task title is required" }]}
          >
            <Input placeholder="e.g. Send proposal document" />
          </Form.Item>

          <Form.Item
            name="assignees"
            label="Assignee(s)"
            rules={[{ required: true, message: "Please select an assignee" }]}
          >
            <Select
              mode="multiple"
              placeholder="Select employee assignees"
              showSearch
              optionFilterProp="children"
            >
              {employees.map(e => (
                <Option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_code || "Staff"})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="date_range"
            label="Date Range (Start Date & Due Date)"
            initialValue={[dayjs(), dayjs().add(2, 'day')]}
            rules={[{ required: true, message: "Date range is required" }]}
          >
            <DatePicker.RangePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="start_time" label="Start Time">
              <ClockTimePicker placeholder="Select start time" />
            </Form.Item>
            <Form.Item name="end_time" label="End Time">
              <ClockTimePicker placeholder="Select end time" />
            </Form.Item>
          </div>

          <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
            <Select>
              <Option value="HIGH">High</Option>
              <Option value="MEDIUM">Medium</Option>
              <Option value="LOW">Low</Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Task description..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Global Documents Tab ─────────────────────────────────────────────────────

function DocumentsTab() {
  return (
    <div style={{ padding: 16 }}>
      <CrmSharedDocumentsManager
        title="Lead Management Documents"
        description="Centralized shared document library connected across CRM, Lead Management, and Sales Management."
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadManagementPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const permissions = useAuthStore(s => s.permissions);

  const canCreate = usePermission(PERMS.CRM_LEAD_CREATE);
  const canUpdate = usePermission(PERMS.CRM_LEAD_UPDATE);
  const canDelete = usePermission(PERMS.CRM_LEAD_DELETE);

  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  const createMut = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
      setAddOpen(false);
      message.success("Lead created successfully");
    },
    onError: () => message.error("Failed to create lead"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateLead(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
      setEditLead(null);
      if (drawerLead?.id === updated.id) setDrawerLead(updated);
      message.success("Lead updated");
    },
    onError: () => message.error("Failed to update lead"),
  });

  const handleNewLead = () => {
    setEditLead(null);
    setAddOpen(true);
  };

  const handleEditLead = (lead: Lead) => {
    setEditLead(lead);
    setAddOpen(true);
  };

  const handleSubmit = (values: any) => {
    if (editLead) {
      updateMut.mutate({ id: editLead.id, data: values });
    } else {
      createMut.mutate(values);
    }
  };

  const tabItems = [
    {
      key: "dashboard",
      label: "Dashboard",
      children: <DashboardTab onSwitchToLeads={() => setActiveTab("leads")} />,
    },
    {
      key: "leads",
      label: "Leads",
      children: (
        <LeadsTab
          onViewLead={setDrawerLead}
          onEditLead={handleEditLead}
          onNewLead={handleNewLead}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      ),
    },
    {
      key: "followups",
      label: "Followups",
      children: <FollowupsTab />,
    },
    {
      key: "tasks",
      label: "Tasks",
      children: <TasksTab />,
    },
    {
      key: "documents",
      label: "Documents",
      children: <DocumentsTab />,
    },
  ];

  const renderTabBarExtra = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 8 }}>
      <Button icon={<BellOutlined />} shape="circle" />
      {activeTab === "leads" && canCreate && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewLead}
          style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
        >
          Add New Lead
        </Button>
      )}
    </div>
  );

  return (
    <div className="lead-page">
      {/* Page header */}
      <div className="lead-page-header">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>Lead Management</Title>
          <p style={{ margin: 0 }}>Capture, nurture, and track pipeline followups.</p>
        </div>
      </div>

      {/* Tab card */}
      <div className="lead-tab-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          tabBarExtraContent={renderTabBarExtra()}
          tabBarStyle={{ margin: 0, padding: "0 20px", borderRadius: "10px 10px 0 0" }}
        />
      </div>

      {/* Add/Edit modal */}
      <AddLeadModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditLead(null); }}
        onSubmit={handleSubmit}
        loading={createMut.isPending || updateMut.isPending}
        initialValues={editLead}
      />

      {/* Details drawer */}
      <LeadDetailsDrawer
        lead={drawerLead}
        onClose={() => setDrawerLead(null)}
        onEdit={(lead) => { handleEditLead(lead); }}
        contextType="lead"
      />
    </div>
  );
}
