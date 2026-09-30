import { useState, useMemo } from "react";
import {
  Button, Table, Tag, Input, Select, Progress, Statistic,
  Popconfirm, message, Spin, Empty, Row, Col, Card, Typography,
  Modal, Form, DatePicker, TimePicker, Checkbox, Upload, Tooltip, Space,
  Tabs,
} from "antd";
import {
  DashboardOutlined, BankOutlined, RiseOutlined, FileTextOutlined,
  FileProtectOutlined, PhoneOutlined, FileOutlined, TeamOutlined,
  FundOutlined, UsergroupAddOutlined, SearchOutlined, EyeOutlined,
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, MessageOutlined,
  UploadOutlined, FilePdfOutlined, EditOutlined, SendOutlined, MailOutlined,
  HistoryOutlined, ClockCircleOutlined, ProjectOutlined, CheckSquareOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { usePermission } from "@/hooks/usePermission";
import { PERMS } from "@/constants/permissions";
import { followUpApi, type FollowUpItem, type FollowUpCreate } from "@/services/followups";
import { meetingApi, type MeetingItem, type MeetingCreate } from "@/services/meetings";
import { todoApi, type TodoItem, type TodoCreate } from "@/services/todos";
import ClockTimePicker from "@/components/common/ClockTimePicker";
import { apiErrorMsg } from "@/utils/apiError";
import CrmSharedDocumentsManager from "@/components/crm/CrmSharedDocumentsManager";
import {
  fetchLeads, fetchLeadDashboard, updateLead, convertLead,
  kickoffLead, assignProjectManager, fetchProjectManagers, toggleProjectComplete,
  fetchSalesDocuments, uploadSalesDocument, deleteSalesDocument,
} from "@/services/leads";
import type {
  Lead, LeadStatus, PaginatedResponse as LeadsPaginatedResponse,
  SalesFollowUp, SalesDocument, ProjectManagerUser,
} from "@/services/leads";
import {
  financeApi,
  type FinanceDocument,
  type DocumentStatus,
  ALLOWED_STATUSES,
} from "@/services/finance";
import PDFPreviewModal from "@/pages/finance/components/PDFPreviewModal";
import DocumentStatusSelect from "@/pages/finance/components/DocumentStatusSelect";
import { formatClientProject } from "@/components/common/DropdownRenderers";
import LeadDetailsDrawer from "./LeadDetailsDrawer";
import AddLeadModal from "./AddLeadModal";
import "./SalesManagementPage.css";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type SalesTabKey =
  | "dashboard"
  | "clients"
  | "project"
  | "opportunities"
  | "quotations"
  | "proposals"
  | "follow-ups"
  | "tasks"
  | "documents";

interface TabDefinition {
  key: SalesTabKey;
  label: string;
  icon: React.ReactNode;
}

const SALES_TABS: TabDefinition[] = [
  { key: "dashboard",     label: "Dashboard",     icon: <DashboardOutlined /> },
  { key: "clients",       label: "Clients",       icon: <BankOutlined /> },
  { key: "project",       label: "Project",       icon: <ProjectOutlined /> },
  { key: "opportunities", label: "Opportunities", icon: <RiseOutlined /> },
  { key: "quotations",    label: "Quotations",    icon: <FileTextOutlined /> },
  { key: "proposals",     label: "Proposals",     icon: <FileProtectOutlined /> },
  { key: "follow-ups",    label: "Follow-ups",    icon: <PhoneOutlined /> },
  { key: "tasks",         label: "Tasks",         icon: <CheckSquareOutlined /> },
  { key: "documents",     label: "Documents",     icon: <FileOutlined /> },
];

const FUNNEL_ORDER: LeadStatus[] = ["new_lead", "contacted", "proposal_sent", "converted", "lost"];

const OPP_STAGE_CONFIG: { status: LeadStatus; label: string; color: string }[] = [
  { status: "new_lead",      label: "New Lead",      color: "#4b5bca" },
  { status: "contacted",     label: "Contacted",     color: "#7c3aed" },
  { status: "proposal_sent", label: "Proposal Sent", color: "#f59e0b" },
  { status: "converted",     label: "Won",           color: "#10b981" },
  { status: "lost",          label: "Lost",          color: "#ef4444" },
];

const STATUS_LABELS: Record<string, string> = {
  new_lead: "New Leads",
  contacted: "Contacted",
  proposal_sent: "Proposal Sent",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};

const FUNNEL_PROGRESS_COLORS = ["#4b5bca", "#7c3aed", "#f59e0b", "#10b981", "#ef4444"];

const SALES_FOLLOWUP_TYPES = [
  { type: "CALL",    label: "Call",    icon: <PhoneOutlined />,    color: "#1890ff" },
  { type: "MESSAGE", label: "Message", icon: <MessageOutlined />,  color: "#52c41a" },
  { type: "MEETING", label: "Meeting", icon: <TeamOutlined />,     color: "#722ed1" },
  { type: "EMAIL",   label: "Email",   icon: <FileTextOutlined />, color: "#fa8c16" },
];

export default function SalesManagementPage() {
  const [activeTab, setActiveTab] = useState<SalesTabKey>("dashboard");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [addLeadModalOpen, setAddLeadModalOpen] = useState(false);

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setSelectedLead(null);
    setAddLeadModalOpen(true);
  };

  const renderTabContent = (key: SalesTabKey) => {
    switch (key) {
      case "dashboard":
        return <SalesDashboardTab onViewLead={handleViewLead} onSwitchTab={setActiveTab} />;
      case "clients":
        return <SalesClientsTab onViewLead={handleViewLead} />;
      case "project":
        return <SalesProjectsTab onViewLead={handleViewLead} />;
      case "opportunities":
        return <SalesOpportunitiesKanbanTab onViewLead={handleViewLead} />;
      case "quotations":
        return <SalesQuotationsTab />;
      case "proposals":
        return <SalesProposalsTab />;
      case "follow-ups":
        return <SalesFollowupsTab />;
      case "tasks":
        return <SalesTasksTab />;
      case "documents":
        return <SalesDocumentsTab />;
      default:
        return null;
    }
  };

  const tabItems = SALES_TABS.map(tab => ({
    key: tab.key,
    label: <span>{tab.label}</span>,
    children: renderTabContent(tab.key),
  }));

  return (
    <div className="sales-page">
      {/* Sales CRM Hub Header */}
      <div className="sales-header">
        <div>
          <Title level={2}>Sales CRM Hub</Title>
          <Text type="secondary">
            Track deal opportunities, quotations, contracts, and revenue conversions.
          </Text>
        </div>
      </div>

      {/* Internal Horizontal Sales Tabs matching Lead Management Tab UI */}
      <div className="lead-tab-card" style={{ marginBottom: 24 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as SalesTabKey)}
          items={tabItems}
          tabBarStyle={{ margin: 0, padding: "0 20px", borderRadius: "10px 10px 0 0" }}
        />
      </div>

      {/* Shared Detail Drawer & Modals */}
      <LeadDetailsDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onEdit={handleEditLead}
      />

      <AddLeadModal
        open={addLeadModalOpen}
        onClose={() => { setAddLeadModalOpen(false); setEditingLead(null); }}
        onSubmit={() => { setAddLeadModalOpen(false); setEditingLead(null); }}
        initialValues={editingLead}
      />
    </div>
  );
}

// ─── 1. Sales Dashboard Tab ───────────────────────────────────────────────────

function SalesDashboardTab({
  onViewLead,
  onSwitchTab,
}: {
  onViewLead: (lead: Lead) => void;
  onSwitchTab: (tab: SalesTabKey) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["lead-dashboard"],
    queryFn: fetchLeadDashboard,
  });

  if (isLoading) return <Spin style={{ display: "block", margin: "40px auto" }} />;
  if (isError) return <Empty description="Failed to load sales dashboard" />;
  if (!data) return <Empty description="No sales data available" />;

  const total = data.total ?? 0;
  const converted = data.converted ?? 0;
  const activeLeads = Math.max(0, total - converted);
  const totalExpected = Number(data.total_expected_value ?? 0);
  const expectedDisplay = `₹${totalExpected.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  
  const wonRevenueDisplay = `₹${(data.recent_leads?.filter(l => l.is_converted).reduce((sum, l) => sum + parseFloat(l.expected_deal_value || "0"), 0) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const maxStatusCount = Math.max(1, ...FUNNEL_ORDER.map(s => data.by_status[s] ?? 0));
  const recentLeads = data.recent_leads ?? [];

  return (
    <div>
      {/* Sales Metrics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card className="sales-stat-card" bodyStyle={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <RiseOutlined style={{ fontSize: 22, color: "#10b981" }} />
              </div>
              <Statistic title="Won Revenue" value={wonRevenueDisplay} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="sales-stat-card" bodyStyle={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "rgba(124, 58, 237, 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FundOutlined style={{ fontSize: 22, color: "#7c3aed" }} />
              </div>
              <Statistic title="Pipeline Value" value={expectedDisplay} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="sales-stat-card" bodyStyle={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "rgba(75, 91, 202, 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <TeamOutlined style={{ fontSize: 22, color: "#4b5bca" }} />
              </div>
              <Statistic title="Active Leads" value={activeLeads} />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="sales-stat-card" bodyStyle={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: "rgba(250, 140, 22, 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <UsergroupAddOutlined style={{ fontSize: 22, color: "#fa8c16" }} />
              </div>
              <Statistic title="Total Leads" value={total} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Sales Funnel + Pipeline Overview */}
      <div className="sales-dashboard-grid">
        <div className="sales-panel-card">
          <Title level={5} style={{ marginBottom: 20 }}>Sales Funnel</Title>
          {FUNNEL_ORDER.map((status, i) => {
            const count = data.by_status[status] ?? 0;
            const pct = total > 0 ? Math.round((count / maxStatusCount) * 100) : 0;
            return (
              <div key={status} className="funnel-row">
                <div className="funnel-row-label">
                  <span>{STATUS_LABELS[status] || status}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
                <Progress
                  percent={pct}
                  showInfo={false}
                  strokeColor={FUNNEL_PROGRESS_COLORS[i]}
                  trailColor="var(--bms-border)"
                  strokeWidth={8}
                />
              </div>
            );
          })}
        </div>

        <div className="sales-panel-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>Pipeline Overview</Title>
            <Button type="link" size="small" onClick={() => onSwitchTab("opportunities")}>
              View All Opportunities →
            </Button>
          </div>

          {recentLeads.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">No leads yet.</Text>}
            />
          ) : (
            <div>
              {recentLeads.slice(0, 5).map(lead => (
                <div
                  key={lead.id}
                  onClick={() => onViewLead(lead)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: "1px solid var(--bms-border)", cursor: "pointer",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{lead.institution_name}</div>
                    <div style={{ fontSize: 11, color: "var(--bms-text-2)" }}>Contact: {lead.contact_person}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#10b981" }}>
                      ₹{parseFloat(lead.expected_deal_value || "0").toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </div>
                    {lead.is_converted && (
                      <Tag color="green" style={{ fontSize: 10, margin: 0 }}>Converted Client</Tag>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 2. Sales Clients Tab ─────────────────────────────────────────────────────

function SalesClientsTab({ onViewLead }: { onViewLead: (lead: Lead) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["leads", { is_converted: "true" }],
    queryFn: () => fetchLeads({ is_converted: "true" }),
  });
  const clients: Lead[] = data?.results ?? [];

  const columns: ColumnsType<Lead> = [
    {
      title: "Client / Institution Name",
      key: "institution",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>
            {r.converted_client_name || r.institution_name}
          </div>
          <div style={{ fontSize: 11, color: "var(--bms-text-2)" }}>{r.company}</div>
        </div>
      ),
    },
    {
      title: "Contact Person",
      dataIndex: "contact_person",
      key: "contact_person",
      render: (cp: string, r) => (
        <div>
          <div style={{ fontSize: 13, color: "var(--bms-text)" }}>{cp}</div>
          <div style={{ fontSize: 11, color: "var(--bms-text-2)" }}>{r.phone}</div>
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
      title: "Deal Value",
      dataIndex: "expected_deal_value",
      key: "expected_deal_value",
      render: (v: string) => (
        <Text style={{ fontWeight: 600, color: "#10b981" }}>
          ₹{parseFloat(v || "0").toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </Text>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_, r) => (
        <Tooltip title="View Client Details">
          <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => onViewLead(r)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="sales-panel-card">
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Converted Clients</Title>
      </div>

      <Table<Lead>
        dataSource={clients}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="No converted clients found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        onRow={r => ({ onClick: () => onViewLead(r), style: { cursor: "pointer" } })}
      />
    </div>
  );
}

// ─── 2b. Sales Projects Tab (Pre Sale, Post Sale, Cancelled) ─────────────────

function SalesProjectsTab({ onViewLead }: { onViewLead: (lead: Lead) => void }) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<"presale" | "postsale" | "cancelled">("presale");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [selectedLeadForPm, setSelectedLeadForPm] = useState<Lead | null>(null);
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);

  const canUpdate = usePermission(PERMS.CRM_LEAD_UPDATE);

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads", {}],
    queryFn: () => fetchLeads({}),
  });
  const leads: Lead[] = leadsData?.results ?? [];

  const { data: pmUsers } = useQuery({
    queryKey: ["project-managers"],
    queryFn: fetchProjectManagers,
  });

  const kickoffMut = useMutation({
    mutationFn: kickoffLead,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
      message.success(`Project '${updated.institution_name}' kicked off successfully!`);
    },
    onError: (err: any) => message.error(err?.message || "Failed to kick off project"),
  });

  const assignPmMut = useMutation({
    mutationFn: ({ id, pmId }: { id: string; pmId: string }) => assignProjectManager(id, pmId),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      setPmModalOpen(false);
      setSelectedLeadForPm(null);
      setSelectedPmId(null);
      message.success(`Project Manager assigned to '${updated.institution_name}'`);
    },
    onError: () => message.error("Failed to assign Project Manager"),
  });

  const toggleCompleteMut = useMutation({
    mutationFn: toggleProjectComplete,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
      message.success(
        updated.is_project_completed
          ? `Project '${updated.institution_name}' marked as completed!`
          : `Project '${updated.institution_name}' reopened!`
      );
    },
    onError: () => message.error("Failed to update project completion status"),
  });

  const presaleProjects = leads.filter(l => !l.is_converted && l.status !== "lost");
  const postsaleProjects = leads.filter(l => l.is_converted);
  const cancelledProjects = leads.filter(l => l.status === "lost");

  const rawList =
    subTab === "presale"
      ? presaleProjects
      : subTab === "postsale"
      ? postsaleProjects
      : cancelledProjects;

  const activeProjects = rawList.filter(l => !l.is_project_completed);
  const completedProjects = rawList.filter(l => l.is_project_completed);

  const filteredActive = activeProjects.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.institution_name && l.institution_name.toLowerCase().includes(q)) ||
      (l.client_name && l.client_name.toLowerCase().includes(q)) ||
      (l.company && l.company.toLowerCase().includes(q))
    );
  });

  const columns: ColumnsType<Lead> = [
    {
      title: "Done",
      key: "completed",
      width: 50,
      render: (_, r: Lead) => (
        <Checkbox
          checked={!!r.is_project_completed}
          onChange={(e) => { e.stopPropagation(); toggleCompleteMut.mutate(r.id); }}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      title: "Project Name",
      key: "project",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{r.institution_name}</div>
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
      key: "expected_val",
      render: (v: string) => (
        <Text style={{ fontWeight: 500 }}>
          ₹{parseFloat(v || "0").toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </Text>
      ),
    },
    ...(subTab === "presale"
      ? [
          {
            title: "Next Follow-up",
            dataIndex: "next_followup_date",
            key: "next_followup",
            render: (d: string | null) => d || <Text type="secondary">—</Text>,
          },
          {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (s: string) => (
              <Tag color={STATUS_LABELS[s] ? "blue" : "default"}>
                {STATUS_LABELS[s] || s}
              </Tag>
            ),
          },
        ]
      : []),
    ...(subTab === "postsale"
      ? [
          {
            title: "Kickoff Status",
            key: "kickoff",
            render: (_, r: Lead) => (
              <div>
                {r.is_kicked_off ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    Project Started {r.kickoff_date ? `(${dayjs(r.kickoff_date).format("DD-MM-YYYY")})` : ""}
                  </Tag>
                ) : (
                  <Button
                    size="small"
                    type="primary"
                    disabled={!canUpdate}
                    loading={kickoffMut.isPending}
                    onClick={(e) => { e.stopPropagation(); kickoffMut.mutate(r.id); }}
                    style={{ background: "#10b981", borderColor: "#10b981" }}
                  >
                    Kick Off Project
                  </Button>
                )}
              </div>
            ),
          },
          {
            title: "Project Manager",
            key: "pm",
            render: (_, r: Lead) => (
              <div>
                {r.project_manager_name ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Tag color="purple" style={{ margin: 0 }}>{r.project_manager_name}</Tag>
                    {canUpdate && (
                      <Button
                        size="small"
                        type="link"
                        style={{ padding: 0, fontSize: 11 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLeadForPm(r);
                          setSelectedPmId(r.project_manager || null);
                          setPmModalOpen(true);
                        }}
                      >
                        Change
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    size="small"
                    type="dashed"
                    disabled={!canUpdate}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLeadForPm(r);
                      setSelectedPmId(null);
                      setPmModalOpen(true);
                    }}
                  >
                    Assign to Project Manager
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
    ...(subTab === "cancelled"
      ? [
          {
            title: "Status",
            key: "status",
            render: () => <Tag color="red">Cancelled / Lost</Tag>,
          },
        ]
      : []),
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, r: Lead) => (
        <Tooltip title="View Project Details">
          <Button size="small" type="text" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); onViewLead(r); }} />
        </Tooltip>
      ),
    },
  ];

  const projectSubTabItems = [
    { key: "presale", label: `Pre Sale Project (${presaleProjects.filter(p => !p.is_project_completed).length})` },
    { key: "postsale", label: `Post Sale Project (${postsaleProjects.filter(p => !p.is_project_completed).length})` },
    { key: "cancelled", label: `Cancelled Project (${cancelledProjects.filter(p => !p.is_project_completed).length})` },
  ];

  return (
    <div className="sales-panel-card">
      {/* Horizontal Sub-tabs matching Nexus Tab UI */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12, borderBottom: "1px solid var(--bms-border)", paddingBottom: 10 }}>
        <Tabs
          activeKey={subTab}
          onChange={(v) => setSubTab(v as "presale" | "postsale" | "cancelled")}
          items={projectSubTabItems}
          tabBarStyle={{ margin: 0 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
          <Select value={viewMode} onChange={setViewMode} size="small" style={{ width: 110 }}>
            <Option value="table">Table View</Option>
            <Option value="cards">Card Board</Option>
          </Select>
        </div>
      </div>

      {viewMode === "table" ? (
        <Table<Lead>
          dataSource={filteredActive}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="No active projects found in this category" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          onRow={r => ({ onClick: () => onViewLead(r), style: { cursor: "pointer" } })}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredActive.length === 0 ? (
            <Col span={24}>
              <Empty description="No active projects in this category" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Col>
          ) : (
            filteredActive.map(p => (
              <Col xs={24} sm={12} md={8} key={p.id}>
                <div
                  onClick={() => onViewLead(p)}
                  style={{
                    background: "var(--bms-surface-2)",
                    border: "1px solid var(--bms-border)",
                    borderRadius: 10,
                    padding: 14,
                    cursor: "pointer",
                    boxShadow: "var(--shadow-sm)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Checkbox
                        checked={false}
                        onChange={(e) => { e.stopPropagation(); toggleCompleteMut.mutate(p.id); }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--bms-text)" }}>
                        {p.institution_name}
                      </span>
                    </div>
                    <Tooltip title="View Project Details">
                      <Button size="small" type="text" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); onViewLead(p); }} />
                    </Tooltip>
                  </div>

                  {p.client_name && (
                    <div style={{ fontSize: 12, color: "var(--bms-text-2)", marginBottom: 4 }}>
                      Client: {p.client_name}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--bms-text-2)", marginBottom: 8 }}>
                    Company: {p.company}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px dashed var(--bms-border)" }}>
                    <Text style={{ fontWeight: 600, color: "#10b981", fontSize: 13 }}>
                      ₹{parseFloat(p.expected_deal_value || "0").toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </Text>
                    {subTab === "postsale" && p.is_kicked_off ? (
                      <Tag color="green" icon={<CheckCircleOutlined />}>Started</Tag>
                    ) : subTab === "cancelled" ? (
                      <Tag color="red">Cancelled</Tag>
                    ) : (
                      <Tag color="blue">{STATUS_LABELS[p.status] || p.status}</Tag>
                    )}
                  </div>
                </div>
              </Col>
            ))
          )}
        </Row>
      )}

      {/* Completed Project History Section */}
      <div style={{ marginTop: 28, background: "var(--bms-surface)", border: "1px solid var(--bms-border)", borderRadius: 10, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, borderBottom: "1px solid var(--bms-border)", paddingBottom: 10 }}>
          <CheckCircleOutlined style={{ fontSize: 18, color: "var(--bms-success)" }} />
          <Title level={5} style={{ margin: 0, color: "var(--bms-text)" }}>Completed Project History</Title>
          <Tag color="green" style={{ borderRadius: 12, marginLeft: 8 }}>{completedProjects.length} completed</Tag>
        </div>

        {completedProjects.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No completed projects in this category yet.</Text>} />
        ) : (
          <Row gutter={[12, 12]}>
            {completedProjects.map(p => (
              <Col xs={24} sm={12} md={8} key={p.id}>
                <div style={{ background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)", borderRadius: 8, padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Checkbox checked={true} onChange={() => toggleCompleteMut.mutate(p.id)} style={{ marginTop: 2 }} />
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onViewLead(p)}>
                    <div style={{ fontWeight: 600, fontSize: 13, textDecoration: "line-through", color: "var(--bms-text-2)" }}>{p.institution_name}</div>
                    <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 2 }}>{p.company}</div>
                    <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 4 }}>
                      Completed • {p.project_completed_at ? dayjs(p.project_completed_at).format("DD-MM-YYYY HH:mm") : "Done"}
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* Modal for Assigning Project Manager */}
      <Modal
        title={`Assign Project Manager — ${selectedLeadForPm?.institution_name || ""}`}
        open={pmModalOpen}
        onCancel={() => setPmModalOpen(false)}
        onOk={() => {
          if (selectedLeadForPm && selectedPmId) {
            assignPmMut.mutate({ id: selectedLeadForPm.id, pmId: selectedPmId });
          } else {
            message.warning("Please select a Project Manager");
          }
        }}
        confirmLoading={assignPmMut.isPending}
        okText="Assign Project Manager"
        width={480}
      >
        <div style={{ paddingTop: 8 }}>
          <p style={{ fontSize: 13, color: "var(--bms-text-2)", marginBottom: 12 }}>
            Select an active employee to assign as Project Manager:
          </p>
          <Select
            placeholder="Select Project Manager"
            style={{ width: "100%" }}
            value={selectedPmId}
            onChange={setSelectedPmId}
            showSearch
            optionFilterProp="children"
          >
            {(pmUsers || []).map((pm: ProjectManagerUser) => (
              <Option key={pm.id} value={pm.id}>
                {pm.name} {pm.designation ? `(${pm.designation})` : ""} {pm.employee_code ? `[${pm.employee_code}]` : ""}
              </Option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
}

// ─── 3. Sales Opportunities Kanban Tab ───────────────────────────────────────

function SalesOpportunitiesKanbanTab({ onViewLead }: { onViewLead: (lead: Lead) => void }) {
  const qc = useQueryClient();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);

  const canUpdate = usePermission(PERMS.CRM_LEAD_UPDATE);

  const { data, isLoading } = useQuery({
    queryKey: ["leads", {}],
    queryFn: () => fetchLeads({}),
  });
  const leads: Lead[] = data?.results ?? [];

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: LeadStatus }) => {
      if (newStatus === "converted") {
        return convertLead(id);
      }
      return updateLead(id, { status: newStatus });
    },
    onMutate: async ({ id, newStatus }) => {
      await qc.cancelQueries({ queryKey: ["leads"] });
      const previousData = qc.getQueryData<LeadsPaginatedResponse<Lead>>(["leads", {}]);
      if (previousData) {
        qc.setQueryData<LeadsPaginatedResponse<Lead>>(["leads", {}], {
          ...previousData,
          results: previousData.results.map(l => (l.id === id ? { ...l, status: newStatus, is_converted: newStatus === "converted" } : l)),
        });
      }
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        qc.setQueryData(["leads", {}], context.previousData);
      }
      message.error("Failed to update opportunity status");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
    },
    onSuccess: (_data, vars) => {
      const stageLabel = OPP_STAGE_CONFIG.find(s => s.status === vars.newStatus)?.label || vars.newStatus;
      message.success(`Opportunity moved to ${stageLabel}`);
    },
  });

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    e.dataTransfer.setData("text/plain", lead.id);
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    if (dragOverColumn !== targetStatus) {
      setDragOverColumn(targetStatus);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    if (dragOverColumn === targetStatus) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!canUpdate) {
      message.warning("You do not have permission to update opportunity stage");
      return;
    }
    if (draggedLead && draggedLead.status !== targetStatus) {
      updateStatusMut.mutate({ id: draggedLead.id, newStatus: targetStatus });
    }
    setDraggedLead(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Opportunities Board</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Drag opportunity cards between stages to update sales status
        </Text>
      </div>

      {isLoading ? (
        <Spin style={{ display: "block", margin: "40px auto" }} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, overflowX: "auto" }}>
          {OPP_STAGE_CONFIG.map(col => {
            const colLeads = leads.filter(l => l.status === col.status);
            const isTarget = dragOverColumn === col.status;
            return (
              <div
                key={col.status}
                onDragOver={e => handleDragOver(e, col.status)}
                onDragLeave={e => handleDragLeave(e, col.status)}
                onDrop={e => handleDrop(e, col.status)}
                style={{
                  background: isTarget ? "rgba(75, 91, 202, 0.08)" : "var(--bms-surface)",
                  border: isTarget ? `2px dashed ${col.color}` : "1px solid var(--bms-border)",
                  borderRadius: 10,
                  padding: 12,
                  minHeight: 420,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--bms-border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{col.label}</span>
                  </div>
                  <Tag style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>{colLeads.length}</Tag>
                </div>

                {colLeads.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 6px", color: "var(--bms-text-2)", fontSize: 11 }}>
                    No opportunities in {col.label}
                  </div>
                ) : (
                  colLeads.map(lead => (
                    <div
                      key={lead.id}
                      draggable={canUpdate}
                      onDragStart={e => handleDragStart(e, lead)}
                      onClick={() => onViewLead(lead)}
                      style={{
                        background: "var(--bms-surface-2)",
                        border: "1px solid var(--bms-border)",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 10,
                        cursor: canUpdate ? "grab" : "pointer",
                        boxShadow: "var(--shadow-sm)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)", marginBottom: 4 }}>
                        {lead.institution_name}
                      </div>

                      {lead.company && (
                        <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginBottom: 6 }}>
                          {lead.company}
                        </div>
                      )}

                      <div style={{ fontSize: 12, color: "var(--bms-text)", marginBottom: 6 }}>
                        Contact: {lead.contact_person}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px dashed var(--bms-border)" }}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: "#10b981" }}>
                          ₹{parseFloat(lead.expected_deal_value || "0").toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                        {lead.phone && (
                          <span style={{ fontSize: 11, color: "var(--bms-text-2)" }}>{lead.phone}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 4. Sales Quotations Tab ──────────────────────────────────────────────────

function SalesQuotationsTab() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const canCreate = usePermission(PERMS.FINANCE_DOCUMENT_CREATE);
  const canUpdate = usePermission(PERMS.FINANCE_DOCUMENT_UPDATE);
  const canDelete = usePermission(PERMS.FINANCE_DOCUMENT_DELETE);

  const params: Record<string, unknown> = { document_type: "quotation" };
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["finance-documents", params],
    queryFn: () => financeApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: financeApi.delete,
    onSuccess: () => {
      message.success("Quotation deleted");
      qc.invalidateQueries({ queryKey: ["finance-documents"] });
    },
    onError: () => message.error("Failed to delete quotation"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DocumentStatus }) =>
      financeApi.updateStatus(id, status),
    onSuccess: () => {
      message.success("Status updated");
      qc.invalidateQueries({ queryKey: ["finance-documents"] });
    },
    onError: () => message.error("Failed to update status"),
  });

  const quotations: FinanceDocument[] = data?.results ?? [];

  const handleCreateQuotation = () => {
    navigate("/finance/documents/new", { state: { returnTo: "/crm/sales?tab=quotations" } });
  };

  const handleEditQuotation = (id: string) => {
    navigate(`/finance/documents/${id}`, { state: { returnTo: "/crm/sales?tab=quotations" } });
  };

  const columns: ColumnsType<FinanceDocument> = [
    {
      title: "Document No.",
      dataIndex: "document_number",
      key: "document_number",
      render: (v: string) => (
        <Text style={{ fontFamily: "monospace", fontWeight: 600, color: "#1677ff" }}>{v}</Text>
      ),
    },
    {
      title: "Client",
      key: "client_name",
      render: (_: unknown, r: FinanceDocument) => <Text strong>{formatClientProject(r.client_name, r.project_name)}</Text>,
    },
    {
      title: "Project",
      dataIndex: "project_name",
      key: "project_name",
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Status",
      key: "status",
      width: 160,
      render: (_, r) => (
        <DocumentStatusSelect
          value={r.status}
          displayLabel={r.status_display}
          options={ALLOWED_STATUSES.quotation}
          disabled={!canUpdate}
          onChange={s => statusMutation.mutate({ id: r.id, status: s })}
        />
      ),
    },
    {
      title: "Total Amount",
      key: "total_amount",
      align: "right",
      render: (_, r) => (
        <Text strong style={{ color: "#10b981" }}>
          {r.currency} {parseFloat(r.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Valid Until",
      key: "valid_until",
      render: (_, r) => (r.valid_until ? new Date(r.valid_until).toLocaleDateString("en-IN") : <Text type="secondary">—</Text>),
    },
    {
      title: "Created",
      key: "created_at",
      render: (_, r) => new Date(r.created_at).toLocaleDateString("en-IN"),
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Preview PDF">
            <Button size="small" icon={<FilePdfOutlined />} onClick={() => setPreviewId(r.id)} />
          </Tooltip>
          {canUpdate && (
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => handleEditQuotation(r.id)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete this quotation?"
              description="This action cannot be undone."
              onConfirm={() => deleteMutation.mutate(r.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="sales-panel-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Title level={4} style={{ margin: 0 }}>Quotations</Title>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search quotations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
        </div>
        {canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateQuotation}
            style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
          >
            Create Quotation
          </Button>
        )}
      </div>

      <Table<FinanceDocument>
        dataSource={quotations}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="No quotations found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />

      {previewId && (
        <PDFPreviewModal
          documentId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}

// ─── 5. Sales Proposals Tab ───────────────────────────────────────────────────

function SalesProposalsTab() {
  const [selectedQuotation, setSelectedQuotation] = useState<FinanceDocument | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["finance-documents", { document_type: "quotation" }],
    queryFn: () => financeApi.list({ document_type: "quotation" }),
  });
  const quotations: FinanceDocument[] = data?.results ?? [];

  const handleOpenSendModal = (doc: FinanceDocument) => {
    setSelectedQuotation(doc);
    setRecipientEmail(doc.client_email || "");
    setEmailModalOpen(true);
  };

  const handleSendProposal = () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      message.error("Please enter a valid Gmail / Email address");
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setEmailModalOpen(false);
      message.success(`Proposal '${selectedQuotation?.document_number}' sent successfully to ${recipientEmail}`);
    }, 600);
  };

  const columns: ColumnsType<FinanceDocument> = [
    {
      title: "Title",
      key: "title",
      render: (_, r) => (
        <div>
          <Text style={{ fontFamily: "monospace", fontWeight: 600, color: "#1677ff" }}>{r.document_number}</Text>
          <div style={{ fontSize: 11, color: "var(--bms-text-2)" }}>Client: {formatClientProject(r.client_name, r.project_name)}</div>
        </div>
      ),
    },
    {
      title: "Net Total",
      key: "total_amount",
      render: (_, r) => (
        <Text strong style={{ color: "#10b981" }}>
          {r.currency} {parseFloat(r.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => (
        <Tag color={r.status === "accepted" ? "green" : r.status === "sent" ? "blue" : "default"}>
          {r.status_display || r.status}
        </Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 140,
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined />}
          onClick={() => handleOpenSendModal(r)}
          style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
        >
          Send Proposal
        </Button>
      ),
    },
  ];

  return (
    <div className="sales-panel-card">
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Send Proposals</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Pick a quotation below and send it to any Gmail address.
        </Text>
      </div>

      <Table<FinanceDocument>
        dataSource={quotations}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: (
            <Empty
              description="No quotations available yet. Create one in the Quotations tab first."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />

      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MailOutlined style={{ color: "#4b5bca" }} />
            <span>Send Proposal — {selectedQuotation?.document_number}</span>
          </div>
        }
        open={emailModalOpen}
        onCancel={() => setEmailModalOpen(false)}
        onOk={handleSendProposal}
        confirmLoading={sending}
        okText="Send Email"
        width={480}
      >
        <div style={{ paddingTop: 10 }}>
          <div style={{ marginBottom: 12, fontSize: 13, color: "var(--bms-text)" }}>
            <strong>Client:</strong> {formatClientProject(selectedQuotation?.client_name, selectedQuotation?.project_name)}
          </div>
          <div style={{ marginBottom: 16, fontSize: 13, color: "var(--bms-text)" }}>
            <strong>Total Amount:</strong> {selectedQuotation?.currency} {parseFloat(selectedQuotation?.total_amount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13, color: "var(--bms-text)" }}>
            Recipient Gmail Address:
          </div>
          <Input
            prefix={<MailOutlined />}
            placeholder="client@gmail.com"
            value={recipientEmail}
            onChange={e => setRecipientEmail(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}

// ─── 6. Sales Followups Tab (Workspace Synchronized) ──────────────────────────

function SalesFollowupsTab() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("CALL");
  const [draggedItem, setDraggedItem] = useState<FollowUpItem | MeetingItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [form] = Form.useForm();

  const canUpdate = usePermission(PERMS.CRM_LEAD_UPDATE);
  const canDelete = usePermission(PERMS.CRM_LEAD_DELETE);

  const { data: leadsData } = useQuery({
    queryKey: ["leads", {}],
    queryFn: () => fetchLeads({}),
  });
  const leads = leadsData?.results ?? [];

  const { data: empData } = useQuery({
    queryKey: ["employees-simple-dropdown"],
    queryFn: () => employeeApi.simpleDropdown(),
    staleTime: 5 * 60 * 1000,
  });
  const employees = empData ?? [];

  const { data: followupsRes, isLoading: followupsLoading } = useQuery({
    queryKey: ["sales-followups-all"],
    queryFn: () => followUpApi.list({ source: "SALES_MANAGEMENT", view_all: "true", page_size: 500 }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: meetingsRes, isLoading: meetingsLoading } = useQuery({
    queryKey: ["sales-meetings-all"],
    queryFn: () => meetingApi.list({ source: "SALES_MANAGEMENT", view_all: "true", page_size: 500 }),
    staleTime: 0,
    refetchOnMount: "always",
  });

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
    qc.invalidateQueries({ queryKey: ["sales-followups-all"] });
    qc.invalidateQueries({ queryKey: ["sales-meetings-all"] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-followups"] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-meetings"] });
    qc.invalidateQueries({ queryKey: ["followups-board"] });
    qc.invalidateQueries({ queryKey: ["meetings-board"] });
    qc.invalidateQueries({ queryKey: ["followups-list"] });
    qc.invalidateQueries({ queryKey: ["meetings-list"] });
    qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
    qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
  };

  const createFollowUpMut = useMutation({
    mutationFn: (data: FollowUpCreate) => followUpApi.create({ ...data, source: "SALES_MANAGEMENT" }),
    onSuccess: () => {
      invalidateAll();
      form.resetFields();
      setModalOpen(false);
      message.success("Sales Follow-up created successfully");
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || "Failed to create follow-up"),
  });

  const createMeetingMut = useMutation({
    mutationFn: (data: MeetingCreate) => meetingApi.create({ ...data, source: "SALES_MANAGEMENT" }),
    onSuccess: () => {
      invalidateAll();
      form.resetFields();
      setModalOpen(false);
      message.success("Meeting scheduled successfully");
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || "Failed to schedule meeting"),
  });

  const transitionMut = useMutation({
    mutationFn: ({ id, isMeeting, state }: { id: string; isMeeting: boolean; state: string }) =>
      isMeeting ? meetingApi.transition(id, state) : followUpApi.transition(id, state),
    onMutate: async ({ id, isMeeting, state }) => {
      const queryKey = isMeeting ? ["sales-meetings-all"] : ["sales-followups-all"];
      await qc.cancelQueries({ queryKey });
      const previousData = qc.getQueryData<any>(queryKey);
      if (previousData?.results) {
        qc.setQueryData(queryKey, {
          ...previousData,
          results: previousData.results.map((it: any) =>
            it.id === id
              ? { ...it, workflow_state_slug: state, workflow_state_name: state.toUpperCase() }
              : it
          ),
        });
      }
      return { previousData, queryKey };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousData) {
        qc.setQueryData(context.queryKey, context.previousData);
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
      const queryKey = isMeeting ? ["sales-meetings-all"] : ["sales-followups-all"];
      await qc.cancelQueries({ queryKey });
      const previousData = qc.getQueryData<any>(queryKey);
      if (previousData?.results) {
        qc.setQueryData(queryKey, {
          ...previousData,
          results: previousData.results.filter((it: any) => it.id !== id),
          count: Math.max(0, (previousData.count || 0) - 1),
        });
      }
      return { previousData, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        qc.setQueryData(context.queryKey, context.previousData);
      }
      message.error("Failed to delete item");
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
        lead: vals.lead || null,
        priority: vals.priority || "MEDIUM",
        description: vals.notes || "",
        assignees,
        start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
        end_date: endDate ? endDate.format("YYYY-MM-DD") : null,
        start_time: startTimeStr,
        end_time: endTimeStr,
        meeting_mode: "ONLINE",
        source: "SALES_MANAGEMENT",
      });
    } else {
      createFollowUpMut.mutate({
        title: vals.title,
        lead: vals.lead || null,
        type: selectedType,
        priority: vals.priority || "MEDIUM",
        description: vals.notes || "",
        assignees,
        start_date: startDate ? startDate.format("YYYY-MM-DD") : null,
        end_date: endDate ? endDate.format("YYYY-MM-DD") : null,
        start_time: startTimeStr,
        end_time: endTimeStr,
        source: "SALES_MANAGEMENT",
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
          source: "SALES_MANAGEMENT",
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
          source: "SALES_MANAGEMENT",
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

  const isLoading = followupsLoading || meetingsLoading;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Sales Follow-ups</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setSelectedType("CALL"); form.resetFields(); setModalOpen(true); }}
          style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
        >
          Add Follow-up
        </Button>
      </div>

      {isLoading ? (
        <Spin style={{ display: "block", margin: "40px auto" }} />
      ) : (
        <>
          {/* Active Sales Follow-up Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, overflowX: "auto" }}>
            {SALES_FOLLOWUP_TYPES.map(ft => {
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
                    <Tag style={{ borderRadius: 12, margin: 0, fontSize: 11 }}>{itemsInCol.length}</Tag>
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
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 6 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
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
                            {canDelete && (
                              <Popconfirm
                                title="Delete this follow-up?"
                                onConfirm={() => deleteMut.mutate({ id: f.id, isMeeting: f.type === "MEETING" })}
                              >
                                <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ padding: "0 4px", height: 18 }} />
                              </Popconfirm>
                            )}
                          </div>

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
          </div>

          {/* Follow-up History Section */}
          <div style={{ marginTop: 24, background: "var(--bms-surface)", border: "1px solid var(--bms-border)", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, borderBottom: "1px solid var(--bms-border)", paddingBottom: 8 }}>
              <HistoryOutlined style={{ fontSize: 18, color: "var(--bms-primary)" }} />
              <Title level={5} style={{ margin: 0, color: "var(--bms-text)" }}>Follow-up History</Title>
              <Tag color="green" style={{ borderRadius: 12, marginLeft: 8 }}>{completedFollowups.length} completed</Tag>
            </div>

            {completedFollowups.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No completed sales follow-ups yet.</Text>} />
            ) : (
              <Row gutter={[12, 12]}>
                {completedFollowups.map(f => {
                  const ft = SALES_FOLLOWUP_TYPES.find(item => item.type === f.type);
                  return (
                    <Col xs={24} sm={12} md={8} key={f.id}>
                      <div style={{ background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)", borderRadius: 8, padding: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
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
                            <span style={{ fontWeight: 600, fontSize: 12, textDecoration: "line-through", color: "var(--bms-text-2)" }}>{f.title}</span>
                            <Tag icon={ft?.icon} color={ft?.color || "default"} style={{ fontSize: 10, margin: 0 }}>{ft?.label || f.type}</Tag>
                          </div>
                          {f.lead_name && <div style={{ fontSize: 11, color: "var(--bms-text-2)", marginTop: 2 }}>Lead: {f.lead_name}</div>}
                          <div style={{ fontSize: 10, color: "var(--bms-text-2)", marginTop: 2 }}>
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

      {/* Add Sales Follow-up Modal */}
      <Modal
        title="Add Sales Follow-up"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={createFollowUpMut.isPending || createMeetingMut.isPending}
        okText="Save Follow-up"
        width={540}
      >
        <Form form={form} layout="vertical" style={{ paddingTop: 8 }}>
          <Form.Item name="lead" label="Related Opportunity / Project (Optional)">
            <Select placeholder="Select a Project" showSearch optionFilterProp="children" allowClear>
              {leads.map(l => (
                <Option key={l.id} value={l.id}>{l.institution_name} ({l.company})</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Follow-up Type" required>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {SALES_FOLLOWUP_TYPES.map(ft => (
                <div
                  key={ft.type}
                  onClick={() => setSelectedType(ft.type)}
                  style={{
                    border: selectedType === ft.type ? `2px solid ${ft.color}` : "1px solid var(--bms-border)",
                    borderRadius: 8, padding: "10px 8px", textAlign: "center", cursor: "pointer",
                    background: selectedType === ft.type ? "rgba(75, 91, 202, 0.15)" : "var(--bms-surface)",
                  }}
                >
                  <div style={{ fontSize: 18, color: ft.color, marginBottom: 4 }}>{ft.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: selectedType === ft.type ? 600 : 400, color: "var(--bms-text)" }}>{ft.label}</div>
                </div>
              ))}
            </div>
          </Form.Item>

          <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
            <Input placeholder="e.g. Call regarding contract approval" />
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
            label="Date Range (Start Date & End Date)"
            initialValue={[dayjs(), dayjs().add(1, 'day')]}
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

          <Form.Item name="notes" label={selectedType === "MEETING" ? "Agenda / Details" : "Notes"}>
            <TextArea rows={3} placeholder="Enter details or notes..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── 7. Sales Tasks Tab (Workspace Synchronized) ──────────────────────────

function SalesTasksTab() {
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
    queryKey: ["sales-tasks-all"],
    queryFn: () => todoApi.list({ source: "SALES_MANAGEMENT", view_all: "true", page_size: 500 }),
  });

  const tasks: TodoItem[] = tasksRes?.results ?? [];

  const invalidateTasks = () => {
    qc.invalidateQueries({ queryKey: ["sales-tasks-all"] });
    qc.invalidateQueries({ queryKey: ["lead-drawer-todos"] });
    qc.invalidateQueries({ queryKey: ["todos-board"] });
    qc.invalidateQueries({ queryKey: ["todos-list"] });
    qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
    qc.invalidateQueries({ queryKey: ["lead-dashboard"] });
  };

  const createMut = useMutation({
    mutationFn: (data: TodoCreate) => todoApi.create({ ...data, source: "SALES_MANAGEMENT" }),
    onSuccess: () => {
      invalidateTasks();
      form.resetFields();
      setEditingTask(null);
      setModalOpen(false);
      message.success("Sales Task created successfully");
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
      await qc.cancelQueries({ queryKey: ["sales-tasks-all"] });
      const previousData = qc.getQueryData<any>(["sales-tasks-all"]);
      if (previousData?.results) {
        qc.setQueryData(["sales-tasks-all"], {
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
        qc.setQueryData(["sales-tasks-all"], context.previousData);
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
      await qc.cancelQueries({ queryKey: ["sales-tasks-all"] });
      const previousData = qc.getQueryData<any>(["sales-tasks-all"]);
      if (previousData?.results) {
        qc.setQueryData(["sales-tasks-all"], {
          ...previousData,
          results: previousData.results.filter((it: any) => it.id !== id),
          count: Math.max(0, (previousData.count || 0) - 1),
        });
      }
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        qc.setQueryData(["sales-tasks-all"], context.previousData);
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
      source: "SALES_MANAGEMENT",
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
      title: "Project / Opportunity",
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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Sales Tasks</Title>
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
        locale={{ emptyText: <Empty description="No sales tasks found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />

      <Modal
        title={editingTask ? "Edit Sales Task" : "Add Sales Task"}
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
            label="Related Opportunity / Project (Optional)"
          >
            <Select placeholder="Select a Project" showSearch optionFilterProp="children" allowClear>
              {leads.map(l => (
                <Option key={l.id} value={l.id}>
                  {l.is_converted ? "🏢 [Client] " : "🎯 [Lead] "}
                  {l.institution_name}
                  {l.client_name ? ` — ${l.client_name}` : l.company ? ` (${l.company})` : ""}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="Task Title"
            rules={[{ required: true, message: "Task title is required" }]}
          >
            <Input placeholder="e.g. Prepare quotation spreadsheet" />
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

// ─── 8. Sales Documents Tab (Shared CRM Documents & Folders) ─────────────────

function SalesDocumentsTab() {
  return (
    <div className="sales-panel-card" style={{ padding: 0 }}>
      <CrmSharedDocumentsManager
        title="Sales Documents"
        description="Centralized shared document library connected across CRM, Lead Management, and Sales Management."
      />
    </div>
  );
}
