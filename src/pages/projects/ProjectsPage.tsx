import { renderClientDropdown } from "@/components/common/DropdownRenderers";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  DatePicker, InputNumber, Tooltip, Typography, Card, Row, Col,
  message, Spin, Switch, Segmented, Divider,
} from "antd";
import {
  PlusOutlined, EditOutlined, EyeOutlined, ReloadOutlined,
  AppstoreOutlined, UnorderedListOutlined, SearchOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { projectsApi, type Project, type ClientDropdownItem } from "@/services/projects";
import { workflowStateApi, workflowTransitionApi } from "@/services/workflow";
import { employeeApi, type SimpleDropdownEmployee } from "@/services/employees";
import ProjectBoard from "@/components/projects/ProjectBoard";
import WorkflowChip from "@/components/projects/WorkflowChip";
import { useAuthStore } from "@/store/auth";
import RichTextEditor from "@/components/common/RichTextEditor";
import { businessTypeApi, billingTypeApi, type BusinessTypeDropdown, type DropdownOption } from "@/services/master";
import PermGuard from "@/components/common/PermGuard";
import { PERMS } from "@/constants/permissions";
import dayjs from "dayjs";
import { apiErrorMsg } from "@/utils/apiError";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import CreateClientModal from "@/components/clients/CreateClientModal";

const { Title, Text } = Typography;

function HoursProgress({ logged, estimated }: { logged?: number; estimated?: number }) {
  const est = estimated ?? 0;
  const log = logged ?? 0;
  const pct = est > 0 ? Math.min(Math.round((log / est) * 100), 999) : 0;
  const barColor = pct > 100 ? "#c5221f" : pct >= 80 ? "#e37400" : "#1e8e3e";
  return (
    <div style={{ minWidth: 72 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{est}h</div>
      {est > 0 && (
        <>
          <div style={{
            height: 4, borderRadius: 2, background: "#e8eaed", marginTop: 4, overflow: "hidden",
          }}>
            <div style={{
              width: `${Math.min(pct, 100)}%`, height: "100%",
              background: barColor, borderRadius: 2,
            }} />
          </div>
          <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: "block" }}>
            {log}h logged · {pct}%
          </Text>
        </>
      )}
    </div>
  );
}

function fmtBudget(n?: number | null) {
  if (n == null) return "—";
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


type ViewMode = "board" | "list";

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [modalOpen, setModalOpen] = useState(false);

  const [editProject, setEditProject] = useState<Project | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [form] = Form.useForm();
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const [addClientOpen, setAddClientOpen] = useState(false);

  // ── Master dropdowns ────────────────────────────────────────────────────────
  const { data: businessTypes = [] } = useQuery<BusinessTypeDropdown[]>({
    queryKey: ["dd", "business-types"],
    queryFn: () => businessTypeApi.dropdown(),
    staleTime: 60_000,
  });
  const { data: billingTypes = [] } = useQuery<DropdownOption[]>({
    queryKey: ["dd", "billing-types"],
    queryFn: () => billingTypeApi.dropdown(),
    staleTime: 60_000,
  });
  const { data: clients = [] } = useQuery<ClientDropdownItem[]>({
    queryKey: ["dd", "clients"],
    queryFn: () => projectsApi.clientDropdown(),
    staleTime: 60_000,
  });

  // ── Projects list ───────────────────────────────────────────────────────────
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["projects", search],
    queryFn: () => {
      const params: Record<string, any> = { page_size: 200 };
      if (search) params.search = search;
      return projectsApi.list(params);
    },
  });

  const { data: workflowStates = [] } = useQuery({
    queryKey: ["wf-states", "projects", "project"],
    queryFn: () => workflowStateApi.list("projects", "project"),
    staleTime: 60_000,
  });

  const { data: workflowTransitions = [] } = useQuery({
    queryKey: ["wf-transitions", "projects", "project"],
    queryFn: () => workflowTransitionApi.list("projects", "project"),
    staleTime: 60_000,
  });

  const { data: employees = [] } = useQuery<SimpleDropdownEmployee[]>({
    queryKey: ["dd", "employees-simple"],
    queryFn: () => employeeApi.simpleDropdown(),
    staleTime: 60_000,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (values: any) =>
      editProject
        ? projectsApi.update(editProject.id, values)
        : projectsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setModalOpen(false);
      form.resetFields();
      setEditProject(null);
      message.success(editProject ? "Project updated" : "Project created");
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Failed to save project")),
  });

  const createClientMutation = useMutation({
    mutationFn: (values: any) => projectsApi.createClient(values),
    onSuccess: (newClient: any) => {
      queryClient.invalidateQueries({ queryKey: ["dd", "clients"] });
      setClientModalOpen(false);
      message.success("Client created successfully");
      form.setFieldValue("client", newClient.id);
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Failed to create client")),
  });

  const transitionMutation = useMutation({
    mutationFn: ({
      id,
      destinationSlug,
      comments,
      managerId,
    }: {
      id: string;
      destinationSlug: string;
      comments?: string;
      managerId?: string;
    }) => projectsApi.transition(id, destinationSlug, comments, managerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      message.success("Project moved to new workflow stage");
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Cannot move project — check workflow permissions")),
  });

  // ── Code generation ─────────────────────────────────────────────────────────
  const generateCode = async (businessTypeId?: string) => {
    if (editProject) return; // no auto-gen on edit
    setGeneratingCode(true);
    try {
      const { code } = await projectsApi.generateCode(businessTypeId);
      form.setFieldValue("code", code);
    } catch {
      // silently ignore
    } finally {
      setGeneratingCode(false);
    }
  };

  // ── Modal open helpers ──────────────────────────────────────────────────────
  const openCreate = async () => {
    setEditProject(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalOpen(true);
    await generateCode();
  };

  const openEdit = (p: Project) => {
    setEditProject(p);
    form.setFieldsValue({
      ...p,
      start_date: p.start_date ? dayjs(p.start_date) : null,
      end_date:   p.end_date   ? dayjs(p.end_date)   : null,
    });
    setModalOpen(true);
  };

  const onBusinessTypeChange = (btId: string) => {
    if (!editProject) generateCode(btId);
  };

  // ── Table data ───────────────────────────────────────────────────────────────
  const projects: Project[] = (data as any)?.results ?? [];

  const columns = [
    {
      title: "Code", dataIndex: "code", key: "code", width: 108, fixed: "left" as const,
      render: (v: string, r: Project) => (
        <Tooltip title={v}>
          <Text
            ellipsis
            style={{
              fontFamily: "ui-monospace, monospace", fontWeight: 600,
              fontSize: 12, color: "var(--bms-text-2, #5f6368)", cursor: "pointer",
            }}
            onClick={() => navigate(`/projects/${r.id}`)}
          >
            {v}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "Project Name", dataIndex: "name", key: "name", width: 260, ellipsis: true,
      render: (v: string, r: Project) => (
        <Tooltip title={v}>
          <Text
            strong
            ellipsis
            style={{ cursor: "pointer", color: "var(--bms-text, #202124)", maxWidth: "100%" }}
            onClick={() => navigate(`/projects/${r.id}`)}
          >
            {v}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "Client", dataIndex: "client_name", key: "client", width: 180, ellipsis: true,
      render: (v: string) => v ? (
        <Tooltip title={v}>
          <Text type="secondary" ellipsis style={{ fontSize: 12, maxWidth: "100%" }}>{v}</Text>
        </Tooltip>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
      ),
    },
    {
      title: "PM", key: "manager", width: 56,
      render: (_: unknown, r: Project) => r.manager_name ? (
        <Tooltip title={r.manager_name}>
          <span><AssigneeAvatar name={r.manager_name} size={28} /></span>
        </Tooltip>
      ) : (
        <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
      ),
    },
    {
      title: "Workflow", key: "workflow", width: 110,
      render: (_: unknown, r: Project) => r.workflow_state_name
        ? <WorkflowChip name={r.workflow_state_name} color={r.workflow_state_color} />
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: "Type", key: "business_type", width: 110,
      render: (_: unknown, r: Project) => r.business_type_name ? (
        <Tooltip title={`Business Type: ${r.business_type_name}`}>
          <Tag color="geekblue" style={{ margin: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.business_type_name}
          </Tag>
        </Tooltip>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
      ),
    },
    {
      title: "Billing Type", key: "billing_type", width: 110,
      render: (_: unknown, r: Project) => r.billing_type_name ? (
        <Tooltip title={`Billing Type: ${r.billing_type_name}`}>
          <Tag color="purple" style={{ margin: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.billing_type_name}
          </Tag>
        </Tooltip>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
      ),
    },
    {
      title: "Budget", dataIndex: "budget", key: "budget", width: 112, align: "right" as const,
      render: (v: number) => (
        <Text style={{ fontWeight: 600, fontSize: 13 }}>{fmtBudget(v)}</Text>
      ),
    },
    {
      title: "Progress", key: "hours", width: 108, align: "right" as const,
      render: (_: unknown, r: Project) => (
        <div style={{ textAlign: "right" }}>
          <HoursProgress logged={r.logged_hours} estimated={r.estimated_hours} />
        </div>
      ),
    },
    {
      title: "Timeline", key: "timeline", width: 128,
      render: (_: unknown, r: Project) => {
        const overdue = r.end_date && dayjs(r.end_date).isBefore(dayjs(), "day")
          && r.workflow_state_slug !== "completed" && r.workflow_state_slug !== "cancelled";
        if (!r.start_date && !r.end_date) return <Text type="secondary">—</Text>;
        const label = [
          r.start_date ? dayjs(r.start_date).format("DD MMM YY") : "…",
          r.end_date ? dayjs(r.end_date).format("DD MMM YY") : "…",
        ].join(" → ");
        return (
          <Tooltip title={overdue ? `${label} (overdue)` : label}>
            <Text
              ellipsis
              type={overdue ? "danger" : "secondary"}
              style={{ fontSize: 12, maxWidth: "100%", display: "block" }}
            >
              {label}{overdue ? " · overdue" : ""}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: "", key: "actions", width: 88, fixed: "right" as const,
      render: (_: any, record: Project) => (
        <Space size={4}>
          <Tooltip title="View Detail">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/projects/${record.id}`)} />
          </Tooltip>
          <PermGuard permission={PERMS.PROJECT_UPDATE}>
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
          </PermGuard>
        </Space>
      ),
    },
  ];

  const toOptions = (arr: any) =>
    Array.isArray(arr) ? arr.map((x: any) => ({ value: x.id, label: x.name })) : [];
  const filterOpt = (input: string, opt: any) =>
    (opt?.label as string)?.toLowerCase().includes(input.toLowerCase());

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Projects</Title>
          <Text type="secondary">{projects.length} project{projects.length !== 1 ? "s" : ""}</Text>
        </Col>
        <Col>
          <Space>
            <Tooltip title="Refresh">
              <Button
                icon={<ReloadOutlined spin={isFetching} />}
                onClick={() => refetch()}
                loading={isFetching}
              />
            </Tooltip>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={[
                { value: "board", icon: <AppstoreOutlined />, label: "Board" },
                { value: "list", icon: <UnorderedListOutlined />, label: "List" },
              ]}
            />
            <PermGuard permission={PERMS.PROJECT_CREATE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                searchParams.set("add_project", "true");
                setSearchParams(searchParams);
              }}>
                New Project
              </Button>
            </PermGuard>
          </Space>
        </Col>
      </Row>

      {/* Search Bar */}
      {viewMode === "list" && (
        <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
          <Input
            prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
            placeholder="Search projects by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 320 }}
          />
        </Card>
      )}

      {viewMode === "board" ? (
        <Card styles={{ body: { padding: 16 } }}>
          <ProjectBoard
            projects={projects}
            states={workflowStates}
            transitions={workflowTransitions}
            user={user}
            loading={isLoading}
            moving={transitionMutation.isPending}
            employees={employees}
            onMove={(id, slug, comments, managerId) =>
              transitionMutation.mutateAsync({ id, destinationSlug: slug, comments, managerId }).then(() => {})
            }
          />
        </Card>
      ) : (
        <Card>
          <Table
            className="projects-table"
            columns={columns}
            dataSource={projects}
            rowKey="id"
            loading={isLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} projects`,
            }}
            size="middle"
            tableLayout="fixed"
            scroll={{ x: 1240 }}
          />
        </Card>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        title={
          <Space>
            {editProject ? <EditOutlined /> : <PlusOutlined />}
            {editProject ? `Edit Project — ${editProject.code}` : "New Project"}
          </Space>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditProject(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending || generatingCode}
        okButtonProps={{ disabled: generatingCode }}
        width={760}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => {
            const payload = {
              ...v,
              business_type: v.business_type || null,
              billing_type: v.billing_type || null,
              client: v.client || null,
              start_date: v.start_date && dayjs.isDayjs(v.start_date) ? v.start_date.format("YYYY-MM-DD") : (v.start_date ? String(v.start_date) : null),
              end_date:   v.end_date && dayjs.isDayjs(v.end_date)   ? v.end_date.format("YYYY-MM-DD")   : (v.end_date ? String(v.end_date) : null),
            };
            saveMutation.mutate(payload);
          }}
        >
          {/* Row 1: Name */}
          <Form.Item name="name" label="Project Name" rules={[{ required: true, message: "Project name is required" }]}>
            <Input placeholder="e.g. E-Commerce Platform Development" size="large" />
          </Form.Item>

          {/* Row 2: Code + Status */}
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="code"
                label={
                  <Space size={4}>
                    Project Code
                    <Tag color={editProject ? "orange" : "blue"} style={{ fontSize: 11, fontWeight: 500, margin: 0 }}>
                      {editProject ? "Locked" : "Auto-generated"}
                    </Tag>
                  </Space>
                }
                tooltip={editProject ? "Project code cannot be changed after creation." : "Automatically generated based on the selected Business Type."}
              >
                <Input
                  readOnly
                  disabled
                  placeholder={generatingCode ? "Generating code..." : "e.g. PRJ-260001"}
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: "var(--bms-primary, #1677ff)",
                    background: "var(--bms-surface-2, #f5f5f5)",
                    cursor: "not-allowed",
                  }}
                  prefix={generatingCode ? <Spin size="small" style={{ marginRight: 6 }} /> : undefined}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_active" label="Status" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 3: Business Type + Billing Type */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="business_type"
                label="Business Type"
              >
                <Select
                  showSearch
                  placeholder="Select business type"
                  options={toOptions(businessTypes as any[])}
                  filterOption={filterOpt}
                  onChange={onBusinessTypeChange}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="billing_type"
                label="Billing Type"
              >
                <Select
                  showSearch
                  placeholder="Select billing type"
                  options={toOptions(billingTypes as any[])}
                  filterOption={filterOpt}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 4: Client (optional) */}
          <Form.Item name="client" label="Client" tooltip="Optional — link this project to a client">
            <Select
              showSearch
              placeholder="Select client (optional)"
              options={toOptions(clients as any[])}
              filterOption={filterOpt}
              allowClear
              open={clientSelectOpen}
              onDropdownVisibleChange={setClientSelectOpen}
              dropdownRender={(menu) => renderClientDropdown(menu, () => setClientModalOpen(true))}
            />
          </Form.Item>

          {/* Row 5: Start Date + End Date */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_date" label="Start Date">
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="End Date">
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 6: Estimated Hours + Budget */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="estimated_hours" label="Estimated Hours" initialValue={0}>
                <InputNumber min={0} step={8} style={{ width: "100%" }} addonAfter="hours" placeholder="e.g. 160" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="budget"
                label="Project Budget"
                initialValue={0}
                rules={[{ type: "number", min: 0, message: "Budget cannot be negative" }]}
              >
                <InputNumber
                  min={0}
                  step={10000}
                  style={{ width: "100%" }}
                  prefix="₹"
                  placeholder="e.g. 500000"
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(v: any) => Number(String(v)?.replace(/,/g, "") || 0)}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 7: Description — rich text */}
          <Form.Item name="description" label="Description">
            <RichTextEditor
              placeholder="Brief description of the project scope and objectives..."
              minHeight={160}
            />
          </Form.Item>
        </Form>
      </Modal>

      <CreateClientModal
        open={clientModalOpen}
        onCancel={() => setClientModalOpen(false)}
        onOk={(v) => createClientMutation.mutate(v)}
        confirmLoading={createClientMutation.isPending}
      />
    </div>
  );
}
