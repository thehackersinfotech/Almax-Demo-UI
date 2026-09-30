import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, Row, Col, Typography, Tag, Button, Table, Modal, Form, Input,
  InputNumber, Select, Descriptions, Spin, Alert, Progress,
  message, Space,
} from "antd";
import {
  ArrowLeftOutlined, DollarOutlined, PlusOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { invoicesApi, paymentsApi, Invoice, Payment, PaymentAllocation } from "@/services/payment";
import { formatClientProject } from "@/components/common/DropdownRenderers";

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_COLORS: Record<string, string> = {
  UNPAID: "default", PARTIAL: "warning", PAID: "success", OVERDUE: "error", CANCELLED: "default",
};

function fmtCurrency(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ["payment-invoice", id],
    queryFn: () => invoicesApi.get(id!),
    enabled: !!id,
  });

  const { data: paymentsData } = useQuery({
    queryKey: ["payment-payments", { client: invoice?.client }],
    queryFn: () => paymentsApi.list({ client: invoice?.client }),
    enabled: !!invoice?.client,
  });

  const allocateMut = useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: string; data: any }) =>
      paymentsApi.allocate(paymentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-invoice", id] });
      message.success("Payment allocated successfully");
      setAllocateOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || err?.response?.data?.[0] || "Failed to allocate";
      message.error(detail);
    },
  });

  if (isLoading) return <Spin size="large" style={{ display: "block", marginTop: 80, textAlign: "center" }} />;
  if (error || !invoice) return <Alert type="error" message="Invoice not found" />;

  const inv = invoice as Invoice;
  const receivedPct = inv.total_amount > 0
    ? Math.round((inv.received_amount / inv.total_amount) * 100)
    : 0;

  const allocColumns: ColumnsType<PaymentAllocation> = [
    { title: "Payment Ref",  dataIndex: "payment_reference", render: (v) => <Tag color="green">{v}</Tag> },
    { title: "Amount",       dataIndex: "allocated_amount",  render: (v) => fmtCurrency(Number(v)), align: "right" },
    { title: "Notes",        dataIndex: "notes",             ellipsis: true, render: (v) => v || "—" },
    { title: "Date",         dataIndex: "created_at",        render: (v) => dayjs(v).format("DD MMM YYYY") },
  ];

  const availablePayments = ((paymentsData as any)?.results ?? []).filter(
    (p: Payment) => p.unallocated_amount > 0
  );

  const handleAllocate = (vals: any) => {
    allocateMut.mutate({ paymentId: vals.payment, data: { invoice: id, allocated_amount: vals.allocated_amount, notes: vals.notes } });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
        <Title level={3} style={{ margin: 0 }}>Invoice: {inv.invoice_number}</Title>
        <Tag color={STATUS_COLORS[inv.status]} style={{ fontSize: 13, padding: "2px 10px" }}>
          {inv.status}
        </Tag>
        <Tag color="blue">{inv.invoice_type_label}</Tag>
        {inv.days_overdue > 0 && (
          <Tag color="red">{inv.days_overdue} days overdue</Tag>
        )}
      </div>

      <Row gutter={[16, 16]}>
        {/* Invoice Details */}
        <Col xs={24} lg={14}>
          <Card title="Invoice Details" size="small">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Client">{formatClientProject(inv.client_name, inv.project_name)}</Descriptions.Item>
              <Descriptions.Item label="Project">{inv.project_name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Invoice Date">{dayjs(inv.invoice_date).format("DD MMM YYYY")}</Descriptions.Item>
              <Descriptions.Item label="Due Date">
                {inv.due_date
                  ? <span style={{ color: inv.status === "OVERDUE" ? "#ff4d4f" : undefined }}>
                      {dayjs(inv.due_date).format("DD MMM YYYY")}
                    </span>
                  : "—"}
              </Descriptions.Item>
              {inv.milestone_name && (
                <Descriptions.Item label="Milestone">{inv.milestone_name}</Descriptions.Item>
              )}
              <Descriptions.Item label="Notes" span={2}>{inv.notes || "—"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Financials */}
        <Col xs={24} lg={10}>
          <Card title="Financial Summary" size="small">
            <div style={{ padding: "4px 0" }}>
              {[
                { label: "Invoice Amount (pre-tax)", value: fmtCurrency(inv.invoice_amount) },
                { label: `GST / Tax (${inv.tax_percentage}%)`, value: fmtCurrency(inv.tax_amount) },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>{r.label}</Text>
                  <Text style={{ fontSize: 13 }}>{r.value}</Text>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "2px solid #1677ff" }}>
                <Text strong>Total Invoice Amount</Text>
                <Text strong style={{ fontSize: 16, color: "#722ed1" }}>{fmtCurrency(inv.total_amount)}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                <Text style={{ color: "#52c41a" }}>Received</Text>
                <Text style={{ color: "#52c41a", fontWeight: 600 }}>{fmtCurrency(inv.received_amount)}</Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <Text style={{ color: inv.pending_amount > 0 ? "#ff4d4f" : "#52c41a" }}>Pending</Text>
                <Text strong style={{ fontSize: 16, color: inv.pending_amount > 0 ? "#ff4d4f" : "#52c41a" }}>
                  {fmtCurrency(inv.pending_amount)}
                </Text>
              </div>
              <Progress
                percent={receivedPct}
                strokeColor="#52c41a"
                trailColor="#ff4d4f20"
                style={{ marginTop: 8 }}
                format={(p) => `${p}% collected`}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Payment Allocations */}
      <Card
        title="Payment Allocations"
        size="small"
        style={{ marginTop: 16 }}
        extra={
          inv.status !== "PAID" && !inv.is_cancelled && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAllocateOpen(true)}>
              Record Payment
            </Button>
          )
        }
      >
        <Table
          rowKey="id"
          columns={allocColumns}
          dataSource={inv.allocations ?? []}
          size="small"
          pagination={false}
          locale={{ emptyText: "No payments recorded yet" }}
        />
      </Card>

      {/* Allocate Payment Modal */}
      <Modal
        open={allocateOpen}
        title="Allocate Payment to Invoice"
        onCancel={() => { setAllocateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={allocateMut.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleAllocate}>
          <Form.Item name="payment" label="Select Payment" rules={[{ required: true }]}>
            <Select placeholder="Choose a payment with unallocated balance" showSearch>
              {availablePayments.map((p: Payment) => (
                <Option key={p.id} value={p.id}>
                  {p.payment_reference} — {dayjs(p.payment_date).format("DD MMM YYYY")} — Unallocated: {fmtCurrency(p.unallocated_amount)}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="allocated_amount" label="Amount to Allocate (₹)" rules={[{ required: true }]}>
            <InputNumber
              min={0.01}
              max={inv.pending_amount}
              style={{ width: "100%" }}
              placeholder={`Max: ${fmtCurrency(inv.pending_amount)}`}
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <Alert
          type="info"
          showIcon
          message={`Pending amount: ${fmtCurrency(inv.pending_amount)}`}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
}
