import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber,
  Space, Tag, Typography, Card, Row, Col, message, Popconfirm, Tooltip,
  Progress, Steps, notification,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FileAddOutlined, ArrowLeftOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { milestonesApi, Milestone, MilestoneStatus } from "@/services/payment";
import ProjectBudgetSummary from "@/components/payment/ProjectBudgetSummary";
import { apiErrorMsg } from "@/utils/apiError";
import PercentChip from "@/components/common/PercentChip";
import { get } from "@/services/api";
import { renderProjectDropdown, formatClientProject } from "@/components/common/DropdownRenderers";
import CreateProjectModal from "@/components/projects/CreateProjectModal";

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_COLORS: Record<MilestoneStatus, string> = {
  PENDING:  "default",
  INVOICED: "processing",
  PAID:     "success",
};

const STATUS_STEP: Record<MilestoneStatus, number> = {
  PENDING:  0,
  INVOICED: 1,
  PAID:     2,
};

function fmtCurrency(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function MilestoneListPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAddMode = searchParams.get("add_milestone") === "true";
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const params: Record<string, unknown> = {};
  if (projectFilter) params.project = projectFilter;
  if (statusFilter)  params.status  = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["payment-milestones", projectFilter, statusFilter],
    queryFn: () => milestonesApi.list(params),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects-dropdown"],
    queryFn: () => get<{ id: string; name: string; code: string }[]>("/projects/dropdown/"),
  });

  const createMut = useMutation({
    mutationFn: milestonesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-milestones"] }); message.success("Milestone created"); setModalOpen(false); form.resetFields(); const sp = new URLSearchParams(searchParams); sp.delete("add_milestone"); setSearchParams(sp); },
    onError: (e) => message.error(apiErrorMsg(e, "Failed to create milestone")),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Milestone> }) => milestonesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-milestones"] }); message.success("Milestone updated"); setModalOpen(false); setEditing(null); },
    onError: (e) => message.error(apiErrorMsg(e, "Failed to update milestone")),
  });

  const deleteMut = useMutation({
    mutationFn: milestonesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-milestones"] }); message.success("Milestone deleted"); },
    onError: () => message.error("Failed to delete milestone"),
  });

  const generateInvoiceMut = useMutation({
    mutationFn: milestonesApi.generateInvoice,
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["payment-milestones"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-for-alloc"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-summary"] });
      qc.invalidateQueries({ queryKey: ["payment-dashboard"] });
      qc.invalidateQueries({ queryKey: ["payment-client-receivable"] });
      qc.invalidateQueries({ queryKey: ["payment-project-receivable"] });

      notification.success({
        message: "Invoice Generated",
        description: `Invoice ${res?.invoice_number || ""} has been successfully generated from this milestone.`,
        placement: "topRight",
      });
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || "Failed to generate invoice"),
  });

  const rows: Milestone[] = (data as any)?.results ?? [];
  const modalProjectId = Form.useWatch("project", form);

  const { data: budgetSummary } = useQuery({
    queryKey: ["milestone-budget", modalProjectId],
    queryFn: () => milestonesApi.budgetSummary(modalProjectId),
    enabled: modalOpen && !!modalProjectId,
  });

  const amountLocked = editing?.status === "INVOICED" || editing?.status === "PAID";

  const openCreate = () => { setEditing(null); form.resetFields(); const sp = new URLSearchParams(searchParams); sp.set("add_milestone", "true"); setSearchParams(sp); };
  const openEdit = (r: Milestone) => {
    setEditing(r);
    form.setFieldsValue({
      project: r.project,
      milestone_name: r.milestone_name, description: r.description,
      percentage: r.percentage, amount: r.amount, sequence: r.sequence,
      due_date: r.due_date ? dayjs(r.due_date) : null,
    });
    setModalOpen(true);
  };

  const handleSubmit = (vals: any) => {
    const payload = { ...vals, due_date: vals.due_date?.format("YYYY-MM-DD") ?? null };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else         createMut.mutate(payload);
  };

  // Group rows by project for a summary view
  const projectGroups = rows.reduce((acc, m) => {
    const key = m.project_code;
    if (!acc[key]) acc[key] = { name: m.project_name, code: m.project_code, milestones: [] };
    acc[key].milestones.push(m);
    return acc;
  }, {} as Record<string, { name: string; code: string; milestones: Milestone[] }>);

  const columns: ColumnsType<Milestone> = [
    {
      title: "#",
      dataIndex: "sequence",
      width: 50,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: "Milestone",
      dataIndex: "milestone_name",
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          {r.description && <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>{r.description}</div>}
        </div>
      ),
    },
    { title: "Project",  render: (_, r) => `${r.project_code} — ${r.project_name}`, ellipsis: true },
    {
      title: "Percentage",
      dataIndex: "percentage",
      render: (v) => <PercentChip value={Number(v)} mode="neutral" decimals={0} />,
      width: 120,
      align: "right" as const,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      align: "right",
      render: (v) => <strong>{fmtCurrency(Number(v))}</strong>,
    },
    {
      title: "Due Date",
      dataIndex: "due_date",
      render: (v) => v ? dayjs(v).format("DD MMM YYYY") : "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v: MilestoneStatus, r) => (
        <div>
          <Tag color={STATUS_COLORS[v]}>{r.status_label}</Tag>
          {r.invoice_count > 0 && <Tag color="blue">{r.invoice_count} invoice{r.invoice_count > 1 ? "s" : ""}</Tag>}
        </div>
      ),
    },
    {
      title: "Actions",
      width: 130,
      render: (_, r) => (
        <Space>
          {r.status === "PENDING" && (
            <Tooltip title="Generate Invoice">
              <Popconfirm title="Generate invoice for this milestone?" onConfirm={() => generateInvoiceMut.mutate(r.id)} okText="Yes" cancelText="No">
                <Button size="small" type="primary" icon={<FileAddOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title="Delete this milestone?" onConfirm={() => deleteMut.mutate(r.id)} okText="Yes" cancelText="No">
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  
  if (isAddMode) {
    return (
      <div style={{ width: "100%", padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <Space align="center" size={16}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => window.history.back()} />
            <Title level={4} style={{ margin: 0 }}>New Milestone</Title>
          </Space>
          <Button type="primary" loading={createMut.isPending} onClick={() => form.submit()}>
            Save Milestone
          </Button>
        </div>
        <Card style={{ borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            {budgetSummary && budgetSummary.budget > 0 && (
              <ProjectBudgetSummary summary={budgetSummary} compact />
            )}
            <Form.Item name="project" label="Project" rules={[{ required: true }]}>
              <Select
                placeholder="Select project"
                showSearch
                filterOption={(i, o) => (o?.children as string ?? "").toLowerCase().includes(i.toLowerCase())}
                dropdownRender={(menu) => renderProjectDropdown(menu, () => setProjectModalOpen(true))}
              >
                {(projectsData as any[])?.map((p: any) => (
                  <Option key={p.id} value={p.id}>{p.name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="milestone_name" label="Milestone Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Design Phase Approval" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="sequence" label="Sequence / #" initialValue={1}>
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="percentage" label="Percentage (%)" rules={[{ required: true }]}>
                  <InputNumber min={0} max={100} step={5} style={{ width: "100%" }} addonAfter="%" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="due_date" label="Expected Date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>
        </Card>
        <CreateProjectModal
          open={projectModalOpen}
          onCancel={() => setProjectModalOpen(false)}
          onSuccess={(newProject: any) => {
            qc.invalidateQueries({ queryKey: ["projects-dropdown"] });
            setProjectModalOpen(false);
            form.setFieldValue("project", newProject.id);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0 }}>Milestone Billing</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Milestone</Button>
      </div>

      {/* Summary Cards by Project */}
      {!projectFilter && Object.keys(projectGroups).length > 0 && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {Object.values(projectGroups).slice(0, 4).map((g) => {
            const total = g.milestones.reduce((s, m) => s + Number(m.amount), 0);
            const paid  = g.milestones.filter(m => m.status === "PAID").reduce((s, m) => s + Number(m.amount), 0);
            const pct   = total > 0 ? Math.round((paid / total) * 100) : 0;
            return (
              <Col xs={24} sm={12} lg={6} key={g.code}>
                <Card size="small" title={g.code} extra={<Text style={{ fontSize: 12 }}>{g.milestones.length} milestones</Text>} style={{ background: "var(--bms-surface)", borderColor: "var(--bms-border)" }}>
                  <Progress percent={pct} size="small" status={pct === 100 ? "success" : "active"} />
                  <div style={{ fontSize: 12, color: "var(--bms-text-2)", marginTop: 4 }}>
                    {fmtCurrency(paid)} / {fmtCurrency(total)}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12, background: "var(--bms-surface)", borderColor: "var(--bms-border)" }}>
        <Space wrap>
          <Select
            placeholder="Filter by project"
            value={projectFilter}
            onChange={setProjectFilter}
            style={{ width: 260 }}
            allowClear
            showSearch
            filterOption={(i, o) => (o?.children as string ?? "").toLowerCase().includes(i.toLowerCase())}
          >
            {(projectsData as any[])?.map((p: any) => (
              <Option key={p.id} value={p.id}>{p.code} — {p.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            allowClear
          >
            <Option value="PENDING">Pending</Option>
            <Option value="INVOICED">Invoiced</Option>
            <Option value="PAID">Paid</Option>
          </Select>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      <Modal
        open={modalOpen}
        title={editing ? "Edit Milestone" : "Add Milestone"}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {budgetSummary && budgetSummary.budget > 0 && (
            <ProjectBudgetSummary summary={budgetSummary} compact />
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="project" label="Project" rules={[{ required: true }]}>
                <Select
                  placeholder="Select project"
                  showSearch
                  disabled={!!editing}
                  filterOption={(i, o) => (o?.children as string ?? "").toLowerCase().includes(i.toLowerCase())}
                >
                  {(projectsData as any[])?.map((p: any) => (
                    <Option key={p.id} value={p.id}>{p.code} — {p.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="milestone_name" label="Milestone Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Requirement Signoff" />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item
                name="percentage"
                label="%"
                tooltip="Auto-calculated from amount ÷ project budget"
              >
                <InputNumber disabled style={{ width: "100%" }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="sequence" label="Order" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
                <InputNumber
                  min={0}
                  disabled={amountLocked}
                  style={{ width: "100%" }}
                  onChange={(v) => {
                    if (budgetSummary?.budget && v != null) {
                      form.setFieldValue(
                        "percentage",
                        Number(((Number(v) / budgetSummary.budget) * 100).toFixed(2)),
                      );
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="Due Date">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
