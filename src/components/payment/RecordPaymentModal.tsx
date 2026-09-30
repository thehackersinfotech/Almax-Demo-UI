import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal, Form, Input, Select, DatePicker, InputNumber,
  Row, Col, Table, Checkbox, Button, Tag, Typography, Card,
  Alert, Space, Tooltip, Divider, message, notification,
} from "antd";
import {
  PlusOutlined, ThunderboltOutlined, ClearOutlined,
  DollarOutlined, CheckCircleOutlined, InfoCircleOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { paymentsApi, invoicesApi, Invoice, InvoiceStatus, PaymentMode } from "@/services/payment";
import { get } from "@/services/api";
import AddClientModal from "@/components/clients/AddClientModal";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import { renderClientDropdown, renderProjectDropdown, formatClientProject } from "@/components/common/DropdownRenderers";
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

function fmtCurrency(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientsData?: { id: string; name: string }[];
  projectsData?: { id: string; name: string; code: string }[];
}

export default function RecordPaymentModal({
  open,
  onClose,
  onSuccess,
  clientsData = [],
  projectsData = [],
}: RecordPaymentModalProps) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

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

  // Watch form fields for dynamic invoice fetching and math
  const selectedClientId = Form.useWatch("client", form);
  const selectedProjectId = Form.useWatch("project", form);
  const rawPaymentAmount = Form.useWatch("payment_amount", form);
  const paymentAmount = Number(rawPaymentAmount || 0);

  // Allocations state: mapping from invoiceId -> allocatedAmount
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  // Fetch pending/partially paid invoices for selected client
  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ["payment-invoices-mapping", selectedClientId],
    queryFn: () => invoicesApi.list({ client: selectedClientId }),
    enabled: !!selectedClientId && open,
  });

  const allInvoices: Invoice[] = (invoicesData as any)?.results ?? [];
  const pendingInvoices = allInvoices.filter(
    (inv) => inv.status !== "PAID" && inv.status !== "CANCELLED" && Number(inv.pending_amount) > 0
  );

  // Reset allocations when modal opens or client changes
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setAllocations({});
      setSelectedInvoiceIds([]);
    }
  }, [open, form]);

  useEffect(() => {
    setAllocations({});
    setSelectedInvoiceIds([]);
  }, [selectedClientId]);

  // FIFO Auto-Allocation logic
  const handleAutoAllocateFIFO = () => {
    if (!paymentAmount || paymentAmount <= 0) {
      message.warning("Please enter a valid Amount Received (₹) first.");
      return;
    }
    if (!pendingInvoices || pendingInvoices.length === 0) {
      message.info("No pending or partially paid invoices available for this client.");
      return;
    }

    // Sort by invoice_date ascending (oldest first)
    const sorted = [...pendingInvoices].sort(
      (a, b) => dayjs(a.invoice_date).valueOf() - dayjs(b.invoice_date).valueOf()
    );

    let remaining = paymentAmount;
    const newAlloc: Record<string, number> = {};
    const newSelected: string[] = [];

    for (const inv of sorted) {
      if (remaining <= 0) break;
      const pending = Number(inv.pending_amount);
      const alloc = Math.min(remaining, pending);
      if (alloc > 0) {
        const roundedAlloc = Number(alloc.toFixed(2));
        newAlloc[inv.id] = roundedAlloc;
        newSelected.push(inv.id);
        remaining -= roundedAlloc;
      }
    }

    setAllocations(newAlloc);
    setSelectedInvoiceIds(newSelected);
    message.success(
      `Auto-allocated ${fmtCurrency(paymentAmount - Math.max(0, remaining))} across ${newSelected.length} invoice(s) using FIFO (oldest first).`
    );
  };

  const handleClearAllocations = () => {
    setAllocations({});
    setSelectedInvoiceIds([]);
    message.info("Allocations cleared.");
  };

  // Checkbox row select handler
  const handleRowSelect = (invoiceId: string, checked: boolean) => {
    const inv = pendingInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    if (checked) {
      const currentTotalAllocated = Object.entries(allocations).reduce(
        (sum, [id, val]) => (id === invoiceId ? sum : sum + (val || 0)),
        0
      );
      const available = Math.max(0, paymentAmount - currentTotalAllocated);
      const defaultAlloc = Math.min(available, Number(inv.pending_amount));
      const rounded = Number(defaultAlloc.toFixed(2));

      setAllocations((prev) => ({ ...prev, [invoiceId]: rounded }));
      setSelectedInvoiceIds((prev) => Array.from(new Set([...prev, invoiceId])));
    } else {
      setAllocations((prev) => {
        const next = { ...prev };
        delete next[invoiceId];
        return next;
      });
      setSelectedInvoiceIds((prev) => prev.filter((id) => id !== invoiceId));
    }
  };

  // Editable allocation input handler
  const handleAllocationChange = (invoiceId: string, value: number | null) => {
    const val = Number(value || 0);
    if (val > 0) {
      setAllocations((prev) => ({ ...prev, [invoiceId]: val }));
      setSelectedInvoiceIds((prev) => Array.from(new Set([...prev, invoiceId])));
    } else {
      setAllocations((prev) => {
        const next = { ...prev };
        delete next[invoiceId];
        return next;
      });
      setSelectedInvoiceIds((prev) => prev.filter((id) => id !== invoiceId));
    }
  };

  // Summary calculations
  const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + (v || 0), 0);
  const remainingUnallocated = paymentAmount - totalAllocated;
  const isOverAllocated = totalAllocated > paymentAmount + 0.01;

  const createMutation = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["payment-payments"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices"] });
      qc.invalidateQueries({ queryKey: ["payment-dashboard"] });
      qc.invalidateQueries({ queryKey: ["payment-invoices-summary"] });
      qc.invalidateQueries({ queryKey: ["payment-client-receivable"] });

      notification.success({
        message: "Payment Recorded & Mapped",
        description: `Payment ${data?.payment_reference || ""} recorded successfully with ${
          Object.keys(allocations).length
        } invoice mapping(s).`,
        placement: "topRight",
      });

      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail || err?.response?.data?.allocations || "Failed to record payment";
      message.error(typeof detail === "string" ? detail : JSON.stringify(detail));
    },
  });

  const handleSubmit = (values: any) => {
    if (isOverAllocated) {
      message.error("Total allocated amount cannot exceed the received payment amount.");
      return;
    }

    const nestedAllocations = Object.entries(allocations)
      .filter(([_, amt]) => amt && amt > 0)
      .map(([invId, amt]) => ({
        invoice: invId,
        allocated_amount: amt,
      }));

    const payload = {
      ...values,
      payment_date: values.payment_date?.format("YYYY-MM-DD"),
      allocations: nestedAllocations,
    };

    createMutation.mutate(payload);
  };

  const invoiceColumns: ColumnsType<Invoice> = [
    {
      title: "Select",
      width: 60,
      align: "center",
      render: (_, r) => (
        <Checkbox
          checked={selectedInvoiceIds.includes(r.id)}
          onChange={(e) => handleRowSelect(r.id, e.target.checked)}
        />
      ),
    },
    {
      title: "Invoice #",
      dataIndex: "invoice_number",
      key: "invoice_number",
      render: (v, r) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontFamily: "monospace" }}>{v}</Text>
          <Space size={4}>
            <Tag color={STATUS_COLORS[r.status]} style={{ fontSize: 10, margin: 0 }}>
              {r.status}
            </Tag>
            {r.project_code && <Tag style={{ fontSize: 10, margin: 0 }}>{r.project_code}</Tag>}
          </Space>
        </Space>
      ),
    },
    {
      title: "Invoice Date",
      dataIndex: "invoice_date",
      key: "invoice_date",
      width: 110,
      render: (v) => dayjs(v).format("DD MMM YYYY"),
    },
    {
      title: "Due Date",
      dataIndex: "due_date",
      key: "due_date",
      width: 110,
      render: (v) => (v ? dayjs(v).format("DD MMM YYYY") : "—"),
    },
    {
      title: "Total (₹)",
      dataIndex: "total_amount",
      key: "total_amount",
      align: "right",
      width: 110,
      render: (v) => fmtCurrency(Number(v)),
    },
    {
      title: "Outstanding Balance",
      dataIndex: "pending_amount",
      key: "pending_amount",
      align: "right",
      width: 150,
      render: (v) => (
        <Text strong style={{ color: "#d97706" }}>
          {fmtCurrency(Number(v))}
        </Text>
      ),
    },
    {
      title: "Allocated Amount (₹)",
      key: "allocation",
      align: "right",
      width: 160,
      render: (_, r) => {
        const curVal = allocations[r.id] ?? 0;
        const maxVal = Number(r.pending_amount);
        return (
          <InputNumber
            min={0}
            max={maxVal}
            step={0.01}
            precision={2}
            value={curVal}
            onChange={(v) => handleAllocationChange(r.id, v)}
            style={{ width: 140 }}
            placeholder="0.00"
            status={curVal > maxVal ? "error" : undefined}
          />
        );
      },
    },
  ];

  if (!open) return null;

  return (
    <>
      <div style={{ width: "100%", padding: "16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Space align="center" size={16}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onClose} />
          <Title level={4} style={{ margin: 0 }}>
            Record Payment & Invoice Mapping
          </Title>
        </Space>
        <Button
          type="primary"
          loading={createMutation.isPending}
          onClick={() => form.submit()}
        >
          Save & Record Payment
        </Button>
      </div>

      <Card style={{ borderRadius: 12, border: "1px solid var(--bms-border)", background: "var(--bms-surface)", boxShadow: "var(--shadow-sm)" }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {/* Header Details Section */}
          <div style={{ background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)", padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <Text strong style={{ fontSize: 13, display: "block", marginBottom: 12, color: "var(--bms-text)" }}>
              1. Payment Header Details
            </Text>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="client" label="Client" rules={[{ required: true, message: "Select client" }]}>
                  <Select
                    placeholder="Select client"
                    showSearch
                    filterOption={(i, o) => String(o?.children ?? "").toLowerCase().includes(i.toLowerCase())}
                    dropdownRender={(menu) => renderClientDropdown(menu, () => setAddClientOpen(true))}
                  >
                    {clientsData.map((c) => (
                      <Option key={c.id} value={c.id}>
                        {c.display_name || formatClientProject(c.client_name || c.name, c.project_name)}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="project" label="Project (Optional Filter)">
                  <Select
                    placeholder="All projects for client"
                    showSearch
                    allowClear
                    filterOption={(i, o) => String(o?.children ?? "").toLowerCase().includes(i.toLowerCase())}
                    dropdownRender={(menu) => renderProjectDropdown(menu, () => setProjectModalOpen(true))}
                  >
                    {projectsData.map((p) => (
                      <Option key={p.id} value={p.id}>
                        {p.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true, message: "Select date" }]}>
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="payment_amount" label="Amount Received (₹)" rules={[{ required: true, message: "Enter amount" }]}>
                  <InputNumber min={0.01} precision={2} style={{ width: "100%" }} placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="payment_mode" label="Payment Mode" rules={[{ required: true, message: "Select mode" }]}>
                  <Select placeholder="Select mode">
                    {["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "ONLINE_GATEWAY", "NEFT", "RTGS"].map((m) => (
                      <Option key={m} value={m}>
                        {m.replace(/_/g, " ")}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="bank_reference" label="Bank Ref / UTR / Cheque #">
                  <Input placeholder="Transaction reference or UTR number" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="remarks" label="Remarks">
                  <Input placeholder="Optional payment notes" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Invoice Mapping Section */}
          <div style={{ border: "1px solid var(--bms-border)", background: "var(--bms-surface)", padding: 16, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <Text strong style={{ fontSize: 14, color: "var(--bms-text)" }}>
                  2. Invoice Mapping
                </Text>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                  Select and allocate payment to pending invoices. Unallocated amount is saved as Customer Credit.
                </Text>
              </div>
              <Space>
                <Button
                  type="dashed"
                  icon={<ThunderboltOutlined style={{ color: "#f59e0b" }} />}
                  onClick={handleAutoAllocateFIFO}
                  disabled={!selectedClientId || !paymentAmount}
                >
                  Auto-Allocate FIFO (Oldest First)
                </Button>
                <Button icon={<ClearOutlined />} onClick={handleClearAllocations} disabled={Object.keys(allocations).length === 0}>
                  Clear
                </Button>
              </Space>
            </div>

            {!selectedClientId ? (
              <Alert
                type="warning"
                showIcon
                message="Please select a Client above to view pending invoices and map allocations."
              />
            ) : (
              <Table
                rowKey="id"
                columns={invoiceColumns}
                dataSource={pendingInvoices}
                loading={loadingInvoices}
                pagination={false}
                size="small"
                scroll={{ y: 220 }}
                locale={{ emptyText: "No pending or partially paid invoices found for this client." }}
              />
            )}

            {/* Live Allocation Summary Section */}
            {selectedClientId && (
              <Card
                size="small"
                style={{
                  marginTop: 16,
                  background: isOverAllocated ? "rgba(239,68,68,0.08)" : "var(--bms-surface-2)",
                  borderColor: isOverAllocated ? "#ef4444" : "var(--bms-border)",
                }}
              >
                <Row gutter={[16, 12]} align="middle">
                  <Col xs={24} sm={8}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Total Payment Received
                    </Text>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>
                      {fmtCurrency(paymentAmount)}
                    </div>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Total Allocated to Invoices
                    </Text>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#3b82f6" }}>
                      {fmtCurrency(totalAllocated)}
                    </div>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Remaining Unallocated
                    </Text>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: isOverAllocated
                          ? "#ef4444"
                          : remainingUnallocated > 0
                          ? "#f59e0b"
                          : "var(--bms-text-3)",
                      }}
                    >
                      {fmtCurrency(Math.max(0, remainingUnallocated))}
                    </div>
                  </Col>
                </Row>

                {remainingUnallocated > 0 && paymentAmount > 0 && !isOverAllocated && (
                  <Alert
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined style={{ color: "#f59e0b" }} />}
                    style={{ marginTop: 12 }}
                    message={
                      <span style={{ fontSize: 12 }}>
                        <strong>Advance Payment / Customer Credit: </strong>
                        {fmtCurrency(remainingUnallocated)} will be saved as unallocated Customer Credit for this client and can be mapped to future invoices anytime.
                      </span>
                    }
                  />
                )}

                {isOverAllocated && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginTop: 12 }}
                    message={`Total allocated amount (${fmtCurrency(totalAllocated)}) exceeds the received payment amount (${fmtCurrency(paymentAmount)}). Please reduce invoice allocations.`}
                  />
                )}
              </Card>
            )}
          </div>
        </Form>
      </Card>
    </div>

    <AddClientModal
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onSuccess={(client) => {
          qc.invalidateQueries({ queryKey: ["clients-dropdown"] });
          form.setFieldValue("client", client.id);
          setAddClientOpen(false);
        }}
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
    </>
  );
}
