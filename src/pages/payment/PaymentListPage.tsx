import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber,
  Space, Tag, Typography, Card, Row, Col, message, Popconfirm,
  Tooltip, Divider,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { paymentsApi, invoicesApi, Payment, PaymentMode } from "@/services/payment";
import { get } from "@/services/api";
import RecordPaymentModal from "@/components/payment/RecordPaymentModal";
import { renderClientDropdown, renderProjectDropdown, formatClientProject } from "@/components/common/DropdownRenderers";

const { Title, Text } = Typography;
const { Option } = Select;

const MODE_COLORS: Record<PaymentMode, string> = {
  BANK_TRANSFER:  "blue",
  UPI:            "purple",
  CHEQUE:         "orange",
  CASH:           "green",
  ONLINE_GATEWAY: "cyan",
  NEFT:           "geekblue",
  RTGS:           "magenta",
};

function fmtCurrency(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function PaymentListPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAddPaymentMode = searchParams.get("add_payment") === "true";
  const [form] = Form.useForm();
  const [allocForm] = Form.useForm();
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();

  const params: Record<string, unknown> = {};
  if (search) params.search = search;
  if (modeFilter) params.payment_mode = modeFilter;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo)   params.date_to   = dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ["payment-payments", search, modeFilter, dateFrom, dateTo],
    queryFn: () => paymentsApi.list(params),
  });

  const { data: clientsData = [] } = useQuery({
    queryKey: ["clients-dropdown"],
    queryFn: () => get<{ id: string; name: string }[]>("/clients/dropdown/"),
  });

  const { data: projectsData = [] } = useQuery({
    queryKey: ["projects-dropdown"],
    queryFn: () => get<{ id: string; name: string; code: string }[]>("/projects/dropdown/"),
  });

  // Invoices for standalone allocation modal (filtered by client)
  const { data: invoicesData } = useQuery({
    queryKey: ["payment-invoices-for-alloc", selectedPayment?.client],
    queryFn: () => invoicesApi.list({ client: selectedPayment?.client }),
    enabled: !!selectedPayment?.client,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Payment> }) => paymentsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-payments"] });
      message.success("Payment updated");
      setEditModalOpen(false);
      form.resetFields();
      setEditing(null);
    },
    onError: () => message.error("Failed to update payment"),
  });

  const deleteMut = useMutation({
    mutationFn: paymentsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-payments"] });
      message.success("Payment deleted");
    },
    onError: () => message.error("Failed to delete payment"),
  });

  const allocateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => paymentsApi.allocate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-payments"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices"] });
      message.success("Allocated successfully");
      setAllocOpen(false);
      allocForm.resetFields();
    },
    onError: (err: any) => message.error(err?.response?.data?.detail || "Allocation failed"),
  });

  const rows: Payment[] = (data as any)?.results ?? [];
  const totalReceived = rows.reduce((sum, r) => sum + Number(r.payment_amount), 0);
  const totalUnallocated = rows.reduce((sum, r) => sum + Number(r.unallocated_amount), 0);

  const openCreate = () => {
    setRecordModalOpen(true);
  };

  const openEdit = (r: Payment) => {
    setEditing(r);
    form.setFieldsValue({
      client: r.client,
      project: r.project,
      payment_mode: r.payment_mode,
      payment_amount: r.payment_amount,
      bank_reference: r.bank_reference,
      remarks: r.remarks,
      payment_date: r.payment_date ? dayjs(r.payment_date) : null,
    });
    setEditModalOpen(true);
  };

  const openAllocate = (p: Payment) => {
    setSelectedPayment(p);
    allocForm.resetFields();
    setAllocOpen(true);
  };

  const handleEditSubmit = (vals: any) => {
    if (!editing) return;
    const payload = { ...vals, payment_date: vals.payment_date?.format("YYYY-MM-DD") };
    updateMut.mutate({ id: editing.id, data: payload });
  };

  const handleAllocate = (vals: any) => {
    allocateMut.mutate({ id: selectedPayment!.id, data: vals });
  };

  const columns: ColumnsType<Payment> = [
    {
      title: "Payment Ref",
      dataIndex: "payment_reference",
      render: (v) => <Tag color="green" style={{ fontFamily: "monospace" }}>{v}</Tag>,
      width: 130,
    },
    {
      title: "Date",
      dataIndex: "payment_date",
      render: (v) => dayjs(v).format("DD MMM YYYY"),
      width: 120,
    },
    {
      title: "Client",
      key: "client",
      ellipsis: true,
      render: (_, r) => <strong>{formatClientProject(r.client_name, r.project_name)}</strong>,
    },
    { title: "Project", dataIndex: "project_name", ellipsis: true, render: (v) => v ?? "—" },
    {
      title: "Amount Received",
      dataIndex: "payment_amount",
      align: "right",
      render: (v) => <strong style={{ color: "#52c41a" }}>{fmtCurrency(Number(v))}</strong>,
    },
    {
      title: "Mode",
      dataIndex: "payment_mode",
      render: (v: PaymentMode, r) => <Tag color={MODE_COLORS[v]}>{r.payment_mode_label}</Tag>,
    },
    {
      title: "Bank Ref",
      dataIndex: "bank_reference",
      ellipsis: true,
      render: (v) => v || "—",
    },
    {
      title: "Allocated",
      dataIndex: "allocated_amount",
      align: "right",
      render: (v) => fmtCurrency(Number(v)),
    },
    {
      title: "Unallocated Credit",
      dataIndex: "unallocated_amount",
      align: "right",
      render: (v) => (
        <Text style={{ color: Number(v) > 0 ? "#faad14" : "#52c41a", fontWeight: Number(v) > 0 ? 600 : 400 }}>
          {fmtCurrency(Number(v))}
        </Text>
      ),
    },
    {
      title: "Actions",
      width: 120,
      render: (_, r) => (
        <Space>
          {r.unallocated_amount > 0 && (
            <Tooltip title="Allocate Remaining Credit to Invoice">
              <Button size="small" icon={<LinkOutlined />} onClick={() => openAllocate(r)} type="dashed" />
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title="Delete this payment?" onConfirm={() => deleteMut.mutate(r.id)} okText="Yes" cancelText="No">
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const pendingInvoices = ((invoicesData as any)?.results ?? []).filter(
    (inv: any) => inv.status !== "PAID" && inv.status !== "CANCELLED"
  );

  if (isAddPaymentMode || recordModalOpen) {
    return (
      <RecordPaymentModal
        open={true}
        onClose={() => {
          if (isAddPaymentMode) {
            const sp = new URLSearchParams(searchParams);
            sp.delete("add_payment");
            setSearchParams(sp);
          }
          setRecordModalOpen(false);
        }}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["payment-payments"] });
          setRecordModalOpen(false);
        }}
        clientsData={clientsData}
        projectsData={projectsData}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: "var(--bms-text)" }}>Payment Collections</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: "#4b5bca", borderColor: "#4b5bca" }}>
          Record Payment & Map Invoices
        </Button>
      </div>

      {/* Summary Strip */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ background: "var(--bms-surface)", borderColor: "var(--bms-border)" }}>
            <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Total Received</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#52c41a" }}>{fmtCurrency(totalReceived)}</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ background: "var(--bms-surface)", borderColor: "var(--bms-border)" }}>
            <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Total Unallocated Credit</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#faad14" }}>{fmtCurrency(totalUnallocated)}</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ background: "var(--bms-surface)", borderColor: "var(--bms-border)" }}>
            <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Total Payment Collections</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--bms-text)" }}>{rows.length}</div>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12, background: "var(--bms-surface)", borderColor: "var(--bms-border)" }}>
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search ref, client, bank ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select placeholder="Payment mode" value={modeFilter} onChange={setModeFilter} style={{ width: 160 }} allowClear>
            {["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "ONLINE_GATEWAY", "NEFT", "RTGS"].map((m) => (
              <Option key={m} value={m}>{m.replace(/_/g, " ")}</Option>
            ))}
          </Select>
          <DatePicker placeholder="From date" onChange={(d) => setDateFrom(d?.format("YYYY-MM-DD"))} />
          <DatePicker placeholder="To date"   onChange={(d) => setDateTo(d?.format("YYYY-MM-DD"))} />
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

      {/* Edit Payment Modal */}
      <Modal
        open={editModalOpen}
        title="Edit Payment Collection"
        onCancel={() => { setEditModalOpen(false); form.resetFields(); setEditing(null); }}
        onOk={() => form.submit()}
        confirmLoading={updateMut.isPending}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleEditSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="client" label="Client" rules={[{ required: true }]}>
                <Select placeholder="Select client" disabled>
                  {clientsData.map((c) => (
                    <Option key={c.id} value={c.id}>{c.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="project" label="Project">
                <Select placeholder="Project (optional)" showSearch allowClear>
                  {projectsData.map((p) => (
                    <Option key={p.id} value={p.id}>{p.code} — {p.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_amount" label="Amount Received (₹)" rules={[{ required: true }]}>
                <InputNumber min={0.01} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payment_mode" label="Payment Mode" rules={[{ required: true }]}>
                <Select placeholder="Select mode">
                  {["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "ONLINE_GATEWAY", "NEFT", "RTGS"].map((m) => (
                    <Option key={m} value={m}>{m.replace(/_/g, " ")}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bank_reference" label="Bank Ref / UTR / Cheque #">
                <Input placeholder="Transaction reference" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Allocate Remaining Credit Modal */}
      <Modal
        open={allocOpen}
        title={`Allocate Credit (${selectedPayment?.payment_reference})`}
        onCancel={() => { setAllocOpen(false); allocForm.resetFields(); setSelectedPayment(null); }}
        onOk={() => allocForm.submit()}
        confirmLoading={allocateMut.isPending}
        destroyOnHidden
      >
        <Form form={allocForm} layout="vertical" onFinish={handleAllocate}>
          <Form.Item name="invoice" label="Select Invoice" rules={[{ required: true }]}>
            <Select placeholder="Select invoice to allocate against" showSearch>
              {pendingInvoices.map((inv: any) => (
                <Option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {formatClientProject(inv.client_name, inv.project_name)} — Outstanding: {fmtCurrency(inv.pending_amount)}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="allocated_amount" label="Amount to Allocate (₹)" rules={[{ required: true }]}>
            <InputNumber
              min={0.01}
              max={selectedPayment?.unallocated_amount}
              style={{ width: "100%" }}
              placeholder={`Available Unallocated Credit: ${fmtCurrency(selectedPayment?.unallocated_amount ?? 0)}`}
            />
          </Form.Item>
          <Form.Item name="notes" label="Allocation Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
