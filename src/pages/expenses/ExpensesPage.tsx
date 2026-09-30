import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber,
  Tag, Space, Popconfirm, message, Card, Statistic, Row, Col, Typography,
  Tooltip, Badge, Tabs,
} from "antd";
import ReimbursementsTab from "./ReimbursementsTab";
import {
  PlusOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, ArrowLeftOutlined,
  SendOutlined, DollarOutlined, FilterOutlined, EditOutlined, DeleteOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { expenseApi, type ExpenseListItem, type ExpenseCreate } from "@/services/expenses";
import { useQuery as useDropdownQuery } from "@tanstack/react-query";
import { get } from "@/services/api";
import { ENDPOINTS } from "@/constants/api";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";
import ExpenseStatusTag from "@/components/common/ExpenseStatusTag";
import ExpenseAttachmentsModal from "./ExpenseAttachmentsModal";
import { PaperClipOutlined, UploadOutlined } from "@ant-design/icons";
import { Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { renderClientDropdown, renderProjectDropdown } from "@/components/common/DropdownRenderers";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import CreateClientModal from "@/components/clients/CreateClientModal";

const { Title } = Typography;
const { Option } = Select;

const CATEGORY_OPTIONS = [
  { value: "TRAVEL",    label: "Travel & Transport" },
  { value: "MEALS",     label: "Meals & Entertainment" },
  { value: "OFFICE",    label: "Office Supplies" },
  { value: "SOFTWARE",  label: "Software & Subscriptions" },
  { value: "MARKETING", label: "Marketing & Advertising" },
  { value: "UTILITIES", label: "Utilities & Internet" },
  { value: "EQUIPMENT", label: "Equipment & Hardware" },
  { value: "RENT",      label: "Rent & Facilities" },
  { value: "OTHER",     label: "Other" },
];

const PAYMENT_MODE_OPTIONS = [
  { value: "CASH",           label: "Cash" },
  { value: "CORPORATE_CARD", label: "Corporate Card" },
  { value: "PERSONAL_CARD",  label: "Personal Card" },
  { value: "UPI",            label: "UPI" },
  { value: "BANK_TRANSFER",  label: "Bank Transfer" },
  { value: "CHEQUE",         label: "Cheque" },
];


function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExpensesPage() {
  const qc = useQueryClient();
  const permissions = useAuthStore((s) => s.permissions);
  const canCreate       = permissions.includes(PERMS.CRM_EXPENSE_CREATE as any);
  const canApprove      = permissions.includes(PERMS.CRM_EXPENSE_APPROVE as any);
  const canViewExpenses = permissions.includes(PERMS.CRM_EXPENSE_VIEW as any);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch]   = useState("");

  const params = { ...filters, ...(search ? { search } : {}) };

  // ── Data (company expenses — only fetched when user has CRM_EXPENSE_VIEW) ──
  const { data, isLoading } = useQuery({
    queryKey: ["expenses", params],
    queryFn:  () => expenseApi.list(params),
    enabled:  canViewExpenses,
  });

  const { data: employees } = useDropdownQuery({
    queryKey: ["employees-dropdown"],
    queryFn:  () => get<any[]>(ENDPOINTS.EMPLOYEES_DROPDOWN),
    staleTime: 60_000,
    enabled:  canViewExpenses,
  });

  const { data: projects } = useDropdownQuery({
    queryKey: ["projects-dropdown"],
    queryFn:  () => get<any>(`${ENDPOINTS.PROJECT_DROPDOWN}`),
    staleTime: 60_000,
    enabled:  canViewExpenses,
  });

  const { data: clients } = useDropdownQuery({
    queryKey: ["clients-dropdown"],
    queryFn:  () => get<any>(`${ENDPOINTS.FINANCE_CLIENTS_DROPDOWN}`),
    staleTime: 60_000,
    enabled:  canViewExpenses,
  });

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [form] = Form.useForm();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAddMode = searchParams.get("add_expense") === "true";
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<ExpenseListItem | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [attachModal, setAttachModal] = useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [rejectReason, setRejectReason] = useState("");

  function openCreate() {
    form.resetFields();
    setFileList([]);
    form.setFieldValue("date", dayjs());
    setEditing(null);
    const sp = new URLSearchParams(searchParams); sp.set("add_expense", "true"); setSearchParams(sp);
  }

  function openEdit(row: ExpenseListItem) {
    form.setFieldsValue({
      ...row,
      date: dayjs(row.date),
    });
    setEditing(row);
    setFileList([]);
    const sp = new URLSearchParams(searchParams); sp.set("add_expense", "true"); setSearchParams(sp);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => qc.invalidateQueries({ queryKey: ["expenses"] });

  const createClientMut = useMutation({
    mutationFn: async (values: any) => {
      return post("/clients/", values);
    },
    onSuccess: (newClient: any) => {
      qc.invalidateQueries({ queryKey: ["clients-dropdown"] });
      setClientModalOpen(false);
      message.success("Client created successfully");
      form.setFieldValue("client", newClient.id);
    },
    onError: () => message.error("Failed to create client"),
  });

    const createMut = useMutation({
    mutationFn: async (d: ExpenseCreate) => {
      const res = await expenseApi.create(d);
      for (const f of fileList) {
        if (f.originFileObj) {
          const fd = new FormData();
          fd.append("file", f.originFileObj);
          await expenseApi.uploadAttachment(res.id, fd);
        }
      }
      return res;
    },
    onSuccess: () => { message.success("Expense created"); setFileList([]); setModalOpen(false); invalidate(); const sp = new URLSearchParams(searchParams); sp.delete("add_expense"); setSearchParams(sp); },
    onError:   () => message.error("Failed to create expense"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }: { id: string; d: Partial<ExpenseCreate> }) => {
      const res = await expenseApi.update(id, d);
      for (const f of fileList) {
        if (f.originFileObj) {
          const fd = new FormData();
          fd.append("file", f.originFileObj);
          await expenseApi.uploadAttachment(id, fd);
        }
      }
      return res;
    },
    onSuccess: () => { message.success("Expense updated"); setFileList([]); setModalOpen(false); invalidate(); },
    onError:   () => message.error("Failed to update expense"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => expenseApi.delete(id),
    onSuccess: () => { message.success("Expense deleted"); invalidate(); },
    onError:   () => message.error("Failed to delete"),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => expenseApi.submit(id),
    onSuccess: () => { message.success("Submitted for approval"); invalidate(); },
    onError:   () => message.error("Failed to submit"),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => expenseApi.approve(id),
    onSuccess: () => { message.success("Expense approved"); invalidate(); },
    onError:   () => message.error("Failed to approve"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => expenseApi.reject(id, reason),
    onSuccess: () => { message.success("Expense rejected"); setRejectModal({ open: false, id: "" }); invalidate(); },
    onError:   () => message.error("Failed to reject"),
  });

  const reimburseMut = useMutation({
    mutationFn: (id: string) => expenseApi.reimburse(id),
    onSuccess: () => { message.success("Marked as reimbursed"); invalidate(); },
    onError:   () => message.error("Failed to reimburse"),
  });

  function onFinish(values: any) {
    const payload: ExpenseCreate = {
      ...values,
      date: values.date?.format("YYYY-MM-DD"),
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, d: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  const summary = data?.summary;
  const pendingCount  = summary?.by_status?.SUBMITTED?.count ?? 0;
  const approvedAmt   = summary?.by_status?.APPROVED?.amount ?? 0;
  const rejectedCount = summary?.by_status?.REJECTED?.count ?? 0;

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      title: "Expense #",
      dataIndex: "expense_number",
      width: 120,
      render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>{v}</span>,
    },
    { title: "Date", dataIndex: "date", width: 100 },
    {
      title: "Category",
      dataIndex: "category_label",
      width: 150,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "Description",
      dataIndex: "description",
      ellipsis: true,
      render: (v: string, row: any) => (
        <div>
          <span>{v}</span>
          {row.is_from_reimbursement && (
            <Tag
              color="purple"
              style={{ marginLeft: 6, fontSize: 10, padding: "0 5px", borderRadius: 4 }}
            >
              {row.reimbursement_claim_number
                ? `Reimbursement: ${row.reimbursement_claim_number}`
                : "From Reimbursement"}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      width: 130,
      align: "right" as const,
      render: (v: number) => <strong>{fmt(Number(v))}</strong>,
    },
    { title: "Paid By", dataIndex: "paid_by_name", width: 140 },
    {
      title: "Approver",
      dataIndex: "approved_by_name",
      width: 140,
      render: (v: string | null) => v ? <Tag color="purple">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    { title: "Project", dataIndex: "project_code", width: 100, render: (v: string | null) => v || "—" },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      align: "center" as const,
      render: (v: string, row: ExpenseListItem) => (
        <ExpenseStatusTag status={v} label={row.status_label} />
      ),
    },
    {
      title: "Actions",
      width: 200,
      render: (_: any, row: ExpenseListItem) => (
        <Space size={4} wrap>
          <Tooltip title="Attachments">
            <Button size="small" icon={<PaperClipOutlined />} onClick={() => setAttachModal({ open: true, id: row.id })} />
          </Tooltip>
          {row.status === "DRAFT" && (
            <>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
              <Tooltip title="Submit for approval">
                <Popconfirm title="Submit this expense?" onConfirm={() => submitMut.mutate(row.id)}>
                  <Button size="small" icon={<SendOutlined />} type="primary" ghost />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="Delete">
                <Popconfirm title="Delete this expense?" onConfirm={() => deleteMut.mutate(row.id)}>
                  <Button size="small" icon={<DeleteOutlined />} danger />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          {row.status === "SUBMITTED" && canApprove && (
            <>
              <Tooltip title="Approve">
                <Popconfirm title="Approve expense?" onConfirm={() => approveMut.mutate(row.id)}>
                  <Button size="small" icon={<CheckCircleOutlined />} type="primary" />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  size="small"
                  icon={<CloseCircleOutlined />}
                  danger
                  onClick={() => { setRejectModal({ open: true, id: row.id }); setRejectReason(""); }}
                />
              </Tooltip>
            </>
          )}
          {row.status === "APPROVED" && canApprove && (
            <Tooltip title="Mark Reimbursed">
              <Popconfirm title="Mark as reimbursed?" onConfirm={() => reimburseMut.mutate(row.id)}>
                <Button size="small" icon={<DollarOutlined />} type="primary" style={{ background: "#7c3aed" }} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const employeeList: any[] = Array.isArray(employees)
    ? employees
    : (employees as any)?.results ?? [];

  const projectList: any[] = Array.isArray(projects)
    ? projects
    : (projects as any)?.results ?? [];

  const clientList: any[] = Array.isArray(clients)
    ? clients
    : (clients as any)?.results ?? [];

  
  if (isAddMode) {
    return (
      <div style={{ width: "100%", padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <Space align="center" size={16}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => window.history.back()} />
            <Title level={4} style={{ margin: 0 }}>New Expense</Title>
          </Space>
          <Button type="primary" loading={createMut.isPending} onClick={() => form.submit()}>
            Save Expense
          </Button>
        </div>
        <Card style={{ borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}>
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                  <Select placeholder="Select category">
                    {CATEGORY_OPTIONS.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="description" label="Description" rules={[{ required: true }]}>
              <Input.TextArea rows={2} placeholder="Describe the expense..." />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0.01}
                    precision={2}
                    prefix="₹"
                    placeholder="0.00"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="payment_mode" label="Payment Mode" rules={[{ required: true }]}>
                  <Select placeholder="Select mode">
                    {PAYMENT_MODE_OPTIONS.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="paid_by" label="Paid By" rules={[{ required: true }]}>
                  <Select
                    showSearch
                    filterOption={(input, opt) =>
                      String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    placeholder="Select employee"
                    options={employeeList.map((e: any) => ({
                      value: e.id,
                      label: e.full_name ?? `${e.first_name} ${e.last_name}`,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="approved_by" label="Approver Employee">
                  <Select
                    showSearch
                    allowClear
                    filterOption={(input, opt) =>
                      String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    placeholder="Select approver (optional)"
                    options={employeeList.map((e: any) => ({
                      value: e.id,
                      label: e.full_name ?? `${e.first_name} ${e.last_name}`,
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="reference_number" label="Reference / Bill No.">
                  <Input placeholder="Optional reference number" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="project" label="Project">
                  <Select
                    showSearch
                    allowClear
                    filterOption={(input, opt) =>
                      String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    placeholder="Link to project (optional)"
                    options={projectList.map((p: any) => ({
                      value: p.id,
                      label: `${p.code} — ${p.name}`,
                    }))}
                    dropdownRender={(menu) => renderProjectDropdown(menu, () => setProjectModalOpen(true))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="client" label="Client">
                  <Select
                    showSearch
                    allowClear
                    filterOption={(input, opt) =>
                      String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    placeholder="Link to client (optional)"
                    options={clientList.map((c: any) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    dropdownRender={(menu) => renderClientDropdown(menu, () => setClientModalOpen(true))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Attachments (New)">
              <Upload
                multiple
                fileList={fileList}
                beforeUpload={(file) => {
                  setFileList((prev) => [...prev, { uid: file.uid, name: file.name, status: 'done', originFileObj: file }]);
                  return false; // prevent auto upload
                }}
                onRemove={(file) => {
                  setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
                }}
              >
                <Button icon={<UploadOutlined />}>Select Files</Button>
              </Upload>
            </Form.Item>

            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} placeholder="Internal notes..." />
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
      <Tabs
        defaultActiveKey="reimbursements"
        size="large"
        items={[
          {
            key: "reimbursements",
            label: "Employee Reimbursements",
            children: <ReimbursementsTab />,
          },
          ...(canViewExpenses
            ? [{
                key: "company-expenses",
            label: "Company Expenses",
            children: (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <Title level={4} style={{ margin: 0 }}>Company Expenses</Title>
                  {canCreate && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                      New Expense
                    </Button>
                  )}
                </div>

                {/* ── KPI strip ── */}
                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card size="small">
                      <Statistic title="Total Expenses" value={fmt(summary?.total_amount ?? 0)} valueStyle={{ fontSize: 18 }} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card size="small">
                      <Statistic title="Total Records" value={summary?.total_count ?? 0} />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card size="small">
                      <Statistic
                        title="Pending Approval"
                        value={pendingCount}
                        prefix={pendingCount > 0 ? <Badge dot status="processing" /> : null}
                        valueStyle={{ color: pendingCount > 0 ? "#faad14" : undefined }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card size="small">
                      <Statistic title="Approved (₹)" value={fmt(approvedAmt)} valueStyle={{ color: "#52c41a", fontSize: 18 }} />
                    </Card>
                  </Col>
                </Row>

                {/* ── Filters ── */}
                <Card size="small" style={{ marginBottom: 16 }}>
                  <Space wrap>
                    <Input
                      prefix={<SearchOutlined />}
                      placeholder="Search expenses..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ width: 220 }}
                      allowClear
                    />
                    <Select
                      placeholder="Category"
                      allowClear
                      style={{ width: 180 }}
                      onChange={(v) => setFilters((f) => ({ ...f, category: v ?? "" }))}
                      suffixIcon={<FilterOutlined />}
                    >
                      {CATEGORY_OPTIONS.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                    </Select>
                    <Select
                      placeholder="Status"
                      allowClear
                      style={{ width: 140 }}
                      onChange={(v) => setFilters((f) => ({ ...f, status: v ?? "" }))}
                    >
                      {["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"].map((s) => (
                        <Option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</Option>
                      ))}
                    </Select>
                    <DatePicker
                      placeholder="From date"
                      onChange={(d) => setFilters((f) => ({ ...f, date_from: d?.format("YYYY-MM-DD") ?? "" }))}
                    />
                    <DatePicker
                      placeholder="To date"
                      onChange={(d) => setFilters((f) => ({ ...f, date_to: d?.format("YYYY-MM-DD") ?? "" }))}
                    />
                  </Space>
                </Card>

                {/* ── Table ── */}
                <Card size="small">
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={data?.results ?? []}
                    loading={isLoading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    scroll={{ x: 1100 }}
                    size="small"
                  />
                </Card>
              </div>
            ),
          }]
            : []),
        ]}
      />

      {/* ── Create / Edit modal ── */}

      {/* ── Create / Edit modal ── */}
      <Modal
        open={modalOpen}
        title={editing ? "Edit Expense" : "New Expense"}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select placeholder="Select category">
                  {CATEGORY_OPTIONS.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Describe the expense..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: "100%" }}
                  min={0.01}
                  precision={2}
                  prefix="₹"
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_mode" label="Payment Mode" rules={[{ required: true }]}>
                <Select placeholder="Select mode">
                  {PAYMENT_MODE_OPTIONS.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="paid_by" label="Paid By" rules={[{ required: true }]}>
                <Select
                  showSearch
                  filterOption={(input, opt) =>
                    String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  placeholder="Select employee"
                  options={employeeList.map((e: any) => ({
                    value: e.id,
                    label: e.full_name ?? `${e.first_name} ${e.last_name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="approved_by" label="Approver Employee">
                <Select
                  showSearch
                  allowClear
                  filterOption={(input, opt) =>
                    String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  placeholder="Select approver (optional)"
                  options={employeeList.map((e: any) => ({
                    value: e.id,
                    label: e.full_name ?? `${e.first_name} ${e.last_name}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="reference_number" label="Reference / Bill No.">
                <Input placeholder="Optional reference number" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="project" label="Project">
                <Select
                  showSearch
                  allowClear
                  filterOption={(input, opt) =>
                    String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  placeholder="Link to project (optional)"
                  options={projectList.map((p: any) => ({
                    value: p.id,
                    label: `${p.code} — ${p.name}`,
                  }))}
                  dropdownRender={(menu) => renderProjectDropdown(menu, () => setProjectModalOpen(true))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="client" label="Client">
                <Select
                  showSearch
                  allowClear
                  filterOption={(input, opt) =>
                    String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  placeholder="Link to client (optional)"
                  options={clientList.map((c: any) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

                    <Form.Item label="Attachments (New)">
            <Upload
              multiple
              fileList={fileList}
              beforeUpload={(file) => {
                setFileList((prev) => [...prev, { uid: file.uid, name: file.name, status: 'done', originFileObj: file }]);
                return false; // prevent auto upload
              }}
              onRemove={(file) => {
                setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
              }}
            >
              <Button icon={<UploadOutlined />}>Select Files</Button>
            </Upload>
            {editing && <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>Use the Attachments button in the table to view/delete existing files.</div>}
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Internal notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Reject reason modal ── */}
      <Modal
        open={rejectModal.open}
        title={<><ExclamationCircleOutlined style={{ color: "#ff4d4f", marginRight: 8 }} />Reject Expense</>}
        onCancel={() => setRejectModal({ open: false, id: "" })}
        onOk={() => rejectMut.mutate({ id: rejectModal.id, reason: rejectReason })}
        confirmLoading={rejectMut.isPending}
        okText="Reject"
        okButtonProps={{ danger: true }}
      >
        <Form layout="vertical">
          <Form.Item label="Reason for rejection" required>
            <Input.TextArea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please provide a reason..."
            />
          </Form.Item>
        </Form>
      </Modal>
      <ExpenseAttachmentsModal
        open={attachModal.open}
        expenseId={attachModal.id || null}
        onClose={() => setAttachModal({ open: false, id: "" })}
      />
    </div>
  );
}
