import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber,
  Space, Tag, Typography, Card, Row, Col, message, Popconfirm, Tooltip,
  Statistic, Badge, notification,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ArrowLeftOutlined,
  StopOutlined, FilterOutlined, EyeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { invoicesApi, milestonesApi, Invoice, InvoiceStatus, InvoiceType } from "@/services/payment";
import ProjectBudgetSummary from "@/components/payment/ProjectBudgetSummary";
import { apiErrorMsg } from "@/utils/apiError";
import { get } from "@/services/api";
import { renderClientDropdown, renderProjectDropdown, formatClientProject } from "@/components/common/DropdownRenderers";
import CreateClientModal from "@/components/clients/CreateClientModal";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import { projectsApi } from "@/services/projects";

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  UNPAID:    "default",
  PARTIAL:   "warning",
  PAID:      "success",
  OVERDUE:   "error",
  CANCELLED: "default",
};

const TYPE_COLORS: Record<InvoiceType, string> = {
  ADVANCE:   "purple",
  MILESTONE: "blue",
  FINAL:     "green",
  PROFORMA:  "orange",
  REGULAR:   "cyan",
};

function fmtCurrency(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAddMode = searchParams.get("add_invoice") === "true";
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  const createClientMut = useMutation({
    mutationFn: (values: any) => projectsApi.createClient(values),
    onSuccess: (newClient: any) => {
      qc.invalidateQueries({ queryKey: ["clients-dropdown"] });
      setClientModalOpen(false);
      message.success("Client created successfully");
      form.setFieldValue("client", newClient.id);
    },
    onError: (e: any) => message.error("Failed to create client"),
  });

  const createProjectMut = useMutation({
    mutationFn: (values: any) => projectsApi.create(values),
    onSuccess: (newProject: any) => {
      qc.invalidateQueries({ queryKey: ["projects-dropdown"] });
      setProjectModalOpen(false);
      message.success("Project created successfully");
      form.setFieldValue("project", newProject.id);
    },
    onError: (e: any) => message.error("Failed to create project"),
  });

  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const params: Record<string, unknown> = {};
  if (search) params.search = search;
  if (typeFilter) params.invoice_type = typeFilter;
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["payment-invoices", search, statusFilter, typeFilter],
    queryFn: () => invoicesApi.list(params),
  });

  const { data: summaryData } = useQuery({
    queryKey: ["payment-invoices-summary"],
    queryFn: () => invoicesApi.receivableSummary(),
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients-dropdown"],
    queryFn: () => get<{ id: string; name: string }[]>("/clients/dropdown/"),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects-dropdown"],
    queryFn: () => get<{ id: string; name: string; code: string }[]>("/projects/dropdown/"),
  });

  const createMut = useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: (data: Invoice) => {
      qc.invalidateQueries({ queryKey: ["payment-invoices"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-for-alloc"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-summary"] });
      qc.invalidateQueries({ queryKey: ["payment-dashboard"] });
      qc.invalidateQueries({ queryKey: ["payment-client-receivable"] });
      qc.invalidateQueries({ queryKey: ["payment-project-receivable"] });

      notification.success({
        message: "Invoice Created",
        description: `Invoice ${data?.invoice_number || ""} has been created and is now available in the payments module.`,
        placement: "topRight",
      });

      setModalOpen(false);
      form.resetFields();
      const sp = new URLSearchParams(searchParams); sp.delete("add_invoice"); setSearchParams(sp);
    },
    onError: (e) => message.error(apiErrorMsg(e, "Failed to create invoice")),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Invoice> }) => invoicesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-invoices"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-for-alloc"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-summary"] });
      qc.invalidateQueries({ queryKey: ["payment-dashboard"] });
      qc.invalidateQueries({ queryKey: ["payment-client-receivable"] });
      qc.invalidateQueries({ queryKey: ["payment-project-receivable"] });
      message.success("Invoice updated");
      setModalOpen(false);
      form.resetFields();
      const sp = new URLSearchParams(searchParams); sp.delete("add_invoice"); setSearchParams(sp);
      setEditing(null);
    },
    onError: (e) => message.error(apiErrorMsg(e, "Failed to update invoice")),
  });

  const cancelMut = useMutation({
    mutationFn: invoicesApi.cancel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-invoices"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-for-alloc"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-summary"] });
      qc.invalidateQueries({ queryKey: ["payment-dashboard"] });
      qc.invalidateQueries({ queryKey: ["payment-client-receivable"] });
      qc.invalidateQueries({ queryKey: ["payment-project-receivable"] });
      message.success("Invoice cancelled");
    },
    onError: () => message.error("Failed to cancel invoice"),
  });

  const deleteMut = useMutation({
    mutationFn: invoicesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-invoices"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-for-alloc"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-summary"] });
      qc.invalidateQueries({ queryKey: ["payment-dashboard"] });
      qc.invalidateQueries({ queryKey: ["payment-client-receivable"] });
      qc.invalidateQueries({ queryKey: ["payment-project-receivable"] });
      message.success("Invoice deleted");
    },
    onError: () => message.error("Failed to delete invoice"),
  });

  const rows: Invoice[] = (data as any)?.results ?? [];
  const modalProjectId = Form.useWatch("project", form);

  const { data: budgetSummary } = useQuery({
    queryKey: ["invoice-budget", modalProjectId],
    queryFn: () => milestonesApi.budgetSummary(modalProjectId),
    enabled: modalOpen && !!modalProjectId,
  });
  const summary = summaryData as any;

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (r: Invoice) => {
    setEditing(r);
    form.setFieldsValue({
      client: r.client, project: r.project, invoice_type: r.invoice_type,
      invoice_amount: r.invoice_amount, tax_percentage: r.tax_percentage,
      notes: r.notes,
      invoice_date: r.invoice_date ? dayjs(r.invoice_date) : null,
      due_date:     r.due_date     ? dayjs(r.due_date)     : null,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (vals: any) => {
    const payload = {
      ...vals,
      invoice_date: vals.invoice_date ? vals.invoice_date.format("YYYY-MM-DD") : null,
      due_date:     vals.due_date     ? vals.due_date.format("YYYY-MM-DD")     : null,
    };
    if (editing) updateMut.mutate({ id: editing.id, data: payload });
    else         createMut.mutate(payload);
  };

  const columns: ColumnsType<Invoice> = [
    {
      title: "Invoice #",
      dataIndex: "invoice_number",
      render: (v, r) => (
        <a onClick={() => navigate(`/payment/invoices/${r.id}`)} style={{ cursor: "pointer" }}>
          <Tag color="blue" style={{ fontFamily: "monospace", cursor: "pointer" }}>{v}</Tag>
        </a>
      ),
      width: 140,
    },
    {
      title: "Type",
      dataIndex: "invoice_type",
      render: (v: InvoiceType, r) => (
        <Tag color={TYPE_COLORS[v]}>{r.invoice_type_label}</Tag>
      ),
      width: 160,
    },
    {
      title: "Client",
      key: "client",
      ellipsis: true,
      render: (_, r) => <strong>{formatClientProject(r.client_name, r.project_name)}</strong>,
    },
    { title: "Project", dataIndex: "project_name", ellipsis: true, render: (v) => v ?? "—" },
    {
      title: "Invoice Date",
      dataIndex: "invoice_date",
      render: (v) => dayjs(v).format("DD MMM YYYY"),
      width: 120,
    },
    {
      title: "Due Date",
      dataIndex: "due_date",
      render: (v, r) => {
        if (!v) return "—";
        const isOverdue = r.status === "OVERDUE";
        return <span style={{ color: isOverdue ? "#ff4d4f" : undefined }}>{dayjs(v).format("DD MMM YYYY")}</span>;
      },
      width: 120,
    },
    {
      title: "Invoice Amount",
      dataIndex: "total_amount",
      align: "right",
      render: (v) => fmtCurrency(Number(v)),
    },
    {
      title: "Received",
      dataIndex: "received_amount",
      align: "right",
      render: (v) => <Text style={{ color: "#52c41a" }}>{fmtCurrency(Number(v))}</Text>,
    },
    {
      title: "Pending",
      dataIndex: "pending_amount",
      align: "right",
      render: (v) => <Text style={{ color: Number(v) > 0 ? "#ff4d4f" : "#52c41a" }}><strong>{fmtCurrency(Number(v))}</strong></Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v: InvoiceStatus) => <Badge status={STATUS_COLORS[v] as any} text={v} />,
      width: 100,
    },
    {
      title: "Actions",
      width: 160,
      render: (_, r) => (
        <Space>
          <Tooltip title="View Invoice">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/payment/invoices/${r.id}`)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} disabled={r.is_cancelled} />
          </Tooltip>
          <Popconfirm title="Cancel this invoice?" onConfirm={() => cancelMut.mutate(r.id)} okText="Yes" okType="danger" cancelText="No" disabled={r.is_cancelled || r.status === "PAID"}>
            <Tooltip title="Cancel Invoice">
              <Button size="small" danger icon={<StopOutlined />} disabled={r.is_cancelled || r.status === "PAID"} />
            </Tooltip>
          </Popconfirm>
          <Popconfirm title="Delete this invoice?" onConfirm={() => deleteMut.mutate(r.id)} okText="Yes" cancelText="No">
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
            <Title level={4} style={{ margin: 0 }}>New Invoice</Title>
          </Space>
          <Button type="primary" loading={createMut.isPending} onClick={() => form.submit()}>
            Save Invoice
          </Button>
        </div>
        <Card style={{ borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            {budgetSummary && budgetSummary.budget > 0 && (
              <ProjectBudgetSummary summary={budgetSummary} compact />
            )}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="client" label="Client" rules={[{ required: true }]}>
                  <Select
                    placeholder="Select client"
                    showSearch
                    filterOption={(i, o) => (o?.children as string ?? "").toLowerCase().includes(i.toLowerCase())}
                    dropdownRender={(menu) => renderClientDropdown(menu, () => setClientModalOpen(true))}
                  >
                    {(clientsData as any[])?.map((c: any) => (
                      <Option key={c.id} value={c.id}>
                        {c.display_name || formatClientProject(c.client_name || c.name, c.project_name)}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="project" label="Project (Optional)">
                  <Select
                    placeholder="Select project (optional)"
                    showSearch
                    allowClear
                    filterOption={(i, o) => (o?.children as string ?? "").toLowerCase().includes(i.toLowerCase())}
                    dropdownRender={(menu) => renderProjectDropdown(menu, () => setProjectModalOpen(true))}
                  >
                    {(projectsData as any[])?.map((p: any) => (
                      <Option key={p.id} value={p.id}>{p.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="invoice_type" label="Invoice Type" rules={[{ required: true }]}>
                  <Select placeholder="Select type">
                    {["ADVANCE", "MILESTONE", "FINAL", "PROFORMA", "REGULAR"].map((t) => (
                      <Option key={t} value={t}>{t}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="invoice_amount" label="Amount (₹, pre-tax)" rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="tax_percentage" label="Tax %" initialValue={18}>
                  <InputNumber min={0} max={100} style={{ width: "100%" }} addonAfter="%" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="due_date" label="Due Date">
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>
        </Card>
        <CreateClientModal
          open={clientModalOpen}
          onCancel={() => setClientModalOpen(false)}
          onOk={(v) => createClientMut.mutate(v)}
          confirmLoading={createClientMut.isPending}
        />
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
        <Title level={3} style={{ margin: 0 }}>Invoices & Receivables</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); const sp = new URLSearchParams(searchParams); sp.set("add_invoice", "true"); setSearchParams(sp); }}>New Invoice</Button>
      </div>

      {/* Summary Strip */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: "Total Invoiced",  value: fmtCurrency(summary?.total_invoiced  ?? 0), color: "#722ed1" },
          { label: "Total Received",  value: fmtCurrency(summary?.total_received  ?? 0), color: "#52c41a" },
          { label: "Total Pending",   value: fmtCurrency(summary?.total_pending   ?? 0), color: "#1677ff" },
          { label: "Overdue Amount",  value: fmtCurrency(summary?.overdue_amount  ?? 0), color: "#ff4d4f" },
          { label: "Collection %",    value: `${(summary?.collection_pct ?? 0).toFixed(1)}%`, color: "#13c2c2" },
        ].map((s) => (
          <Col xs={12} sm={8} lg={4} key={s.label}>
            <Card size="small">
              <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search invoice # or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            allowClear
          >
            {["UNPAID", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
              <Option key={s} value={s}>{s}</Option>
            ))}
          </Select>
          <Select
            placeholder="Filter by type"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 160 }}
            allowClear
          >
            {["ADVANCE", "MILESTONE", "FINAL", "PROFORMA", "REGULAR"].map((t) => (
              <Option key={t} value={t}>{t}</Option>
            ))}
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
        rowClassName={(r) => r.status === "OVERDUE" ? "ant-table-row-danger" : ""}
      />

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? `Edit Invoice ${editing.invoice_number}` : "New Invoice"}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={680}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {budgetSummary && budgetSummary.budget > 0 && (
            <ProjectBudgetSummary summary={budgetSummary} compact />
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="client" label="Client" rules={[{ required: true }]}>
                <Select placeholder="Select client" showSearch filterOption={(i, o) => (o?.children as string ?? "").toLowerCase().includes(i.toLowerCase())} dropdownRender={(menu) => renderClientDropdown(menu, () => setClientModalOpen(true))}>
                  {(clientsData as any[])?.map((c: any) => (
                    <Option key={c.id} value={c.id}>
                      {c.display_name || formatClientProject(c.client_name || c.name, c.project_name)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="project" label="Project (Optional)">
                <Select placeholder="Select project (optional)" showSearch allowClear filterOption={(i, o) => (o?.children as string ?? "").toLowerCase().includes(i.toLowerCase())}>
                  {(projectsData as any[])?.map((p: any) => (
                    <Option key={p.id} value={p.id}>{p.code} — {p.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="invoice_type" label="Invoice Type" rules={[{ required: true }]}>
                <Select placeholder="Select type">
                  {["ADVANCE", "MILESTONE", "FINAL", "PROFORMA", "REGULAR"].map((t) => (
                    <Option key={t} value={t}>{t}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="invoice_amount" label="Amount (₹, pre-tax)" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tax_percentage" label="Tax %" initialValue={18}>
                <InputNumber min={0} max={100} style={{ width: "100%" }} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="due_date" label="Due Date">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
