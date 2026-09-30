import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Button, Card, Col, DatePicker, Form, Input, Row, Select, Space,
  Tag, Typography, message, Divider, Descriptions, Spin, Alert,
} from "antd";
import {
  ArrowLeftOutlined, SaveOutlined, FilePdfOutlined,
  EyeOutlined, PlusOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import {
  financeApi,
  type DocumentType,
  type DocumentStatus,
  type DocumentLineItem,
  type ClientDropdownItem,
  ALLOWED_STATUSES,
  STATUS_COLORS,
  DOC_TYPE_LABELS,
} from "@/services/finance";
import LineItemsTable from "./components/LineItemsTable";
import PDFPreviewModal from "./components/PDFPreviewModal";
import AddClientModal, { type CreatedClient } from "@/components/clients/AddClientModal";
import { usePermission } from "@/hooks/usePermission";
import { PERMS } from "@/constants/permissions";
import { apiErrorMsg } from "@/utils/apiError";
import { renderClientDropdown, renderProjectDropdown, formatClientProject } from "@/components/common/DropdownRenderers";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import { projectsApi } from "@/services/projects";

const { Title, Text } = Typography;
const { Option }      = Select;
const { TextArea }    = Input;

const DOC_TYPES: DocumentType[] = [
  "quotation", "proforma_invoice", "gst_invoice", "purchase_order", "receipt",
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

export default function FinanceFormPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { id }     = useParams<{ id: string }>();
  const isEdit     = !!id;
  const qc         = useQueryClient();
  const returnTo   = (location.state as any)?.returnTo || "/finance/documents";

  const [form]          = Form.useForm();
  const [lineItems,     setLineItems]    = useState<DocumentLineItem[]>([]);
  const [selectedClient,setSelectedClient] = useState<ClientDropdownItem | null>(null);
  const [docType,       setDocType]      = useState<DocumentType>("quotation");
  const [currency,      setCurrency]     = useState("INR");
  const [previewOpen,   setPreviewOpen]  = useState(false);
  const [savedId,       setSavedId]      = useState<string | null>(id ?? null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  const canCreateClient = usePermission(PERMS.PROJECT_CLIENT_CREATE);

  const createProjectMut = useMutation({
    mutationFn: (values: any) => projectsApi.create(values),
    onSuccess: (newProject: any) => {
      qc.invalidateQueries({ queryKey: ["finance-projects-dropdown"] });
      setProjectModalOpen(false);
      message.success("Project created successfully");
      form.setFieldValue("project", newProject.id);
    },
    onError: (e: any) => message.error("Failed to create project"),
  });

  // ── Master data queries ─────────────────────────────────────────────────

  const { data: clients = [] } = useQuery({
    queryKey: ["finance-clients-dropdown"],
    queryFn:  financeApi.clientsDropdown,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["finance-projects-dropdown", selectedClient?.id],
    queryFn:  () => financeApi.projectsDropdown(selectedClient?.id),
  });

  const { data: divisions = [] } = useQuery({
    queryKey: ["finance-divisions-dropdown"],
    queryFn:  financeApi.divisionsDropdown,
  });

  // ── Fetch existing document when editing ────────────────────────────────

  const { data: document, isLoading: docLoading } = useQuery({
    queryKey: ["finance-document", id],
    queryFn:  () => financeApi.get(id!),
    enabled:  isEdit,
  });

  useEffect(() => {
    if (!document) return;

    setDocType(document.document_type);
    setCurrency(document.currency);

    const client = clients.find(c => c.id === document.client);
    if (client) setSelectedClient(client);

    form.setFieldsValue({
      document_type:   document.document_type,
      client:          document.client,
      project:         document.project,
      division:        document.division,
      currency:        document.currency,
      status:          document.status,
      valid_until:     document.valid_until ? dayjs(document.valid_until) : null,
      notes:           document.notes,
      billing_address: document.billing_address,
      shipping_address:document.shipping_address,
    });

    setLineItems(
      (document.line_items ?? []).map(li => ({
        description:    li.description,
        quantity:       Number(li.quantity),
        rate:           Number(li.rate),
        gst_percentage: Number(li.gst_percentage),
        amount:         Number(li.amount),
        sort_order:     li.sort_order,
      }))
    );
  }, [document, clients]);

  // ── Save mutation ───────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (values: ReturnType<typeof buildPayload>) =>
      isEdit
        ? financeApi.update(id!, values)
        : financeApi.create(values as Parameters<typeof financeApi.create>[0]),
    onSuccess: (doc) => {
      message.success(isEdit ? "Document updated" : "Document created");
      setSavedId(doc.id);
      qc.invalidateQueries({ queryKey: ["finance-documents"] });
      if (!isEdit) navigate(`/finance/documents/${doc.id}`, { replace: true });
    },
    onError: (e) => message.error(apiErrorMsg(e, "Failed to save document")),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────

  function buildPayload(values: Record<string, unknown>) {
    return {
      ...values,
      document_type: docType,
      currency,
      valid_until: values.valid_until
        ? (values.valid_until as ReturnType<typeof dayjs>).format("YYYY-MM-DD")
        : null,
      line_items: lineItems.map((li, i) => ({
        description:    li.description,
        quantity:       li.quantity,
        rate:           li.rate,
        gst_percentage: li.gst_percentage,
        sort_order:     i,
      })),
    } as Parameters<typeof financeApi.create>[0];
  }

  const handleSave = () => {
    form.validateFields().then(values => {
      if (lineItems.length === 0) {
        message.warning("Add at least one line item");
        return;
      }
      saveMutation.mutate(buildPayload(values));
    });
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId) ?? null;
    setSelectedClient(client);
    if (client) {
      const addr = client.formatted_address || client.address || "";
      form.setFieldsValue({
        billing_address:  addr,
        shipping_address: addr,
      });
    }
    // Clear project when client changes
    form.setFieldValue("project", undefined);
  };

  const handleClientCreated = async (client: CreatedClient) => {
    await qc.invalidateQueries({ queryKey: ["finance-clients-dropdown"] });
    await qc.invalidateQueries({ queryKey: ["clients"] });

    const updatedClients = await qc.fetchQuery({
      queryKey: ["finance-clients-dropdown"],
      queryFn:  financeApi.clientsDropdown,
    });

    const dropdownItem: ClientDropdownItem = updatedClients.find(c => c.id === client.id) ?? {
      id:                client.id,
      name:              client.name,
      code:              client.code,
      contact_email:     client.contact_email,
      gst_number:        client.gst_number,
      address:           client.address,
      formatted_address: client.formatted_address,
    };

    form.setFieldValue("client", client.id);
    setSelectedClient(dropdownItem);

    const addr = client.formatted_address || client.address || "";
    form.setFieldsValue({
      billing_address:  addr,
      shipping_address: addr,
    });
    form.setFieldValue("project", undefined);

    setAddClientOpen(false);
  };

  if (isEdit && docLoading) {
    return (
      <div style={{ textAlign: "center", paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const statusOptions = ALLOWED_STATUSES[docType] ?? [];

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(returnTo)} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isEdit ? `Edit: ${document?.document_number}` : "New Finance Document"}
            </Title>
            <Text type="secondary">
              {isEdit ? `${DOC_TYPE_LABELS[docType]} · ${document?.status_display}` : "Create a new document"}
            </Text>
          </div>
        </Space>
        <Space>
          {savedId && (
            <>
              <Button
                icon={<EyeOutlined />}
                onClick={() => setPreviewOpen(true)}
              >
                Preview
              </Button>
              <Button
                icon={<FilePdfOutlined />}
                onClick={() => window.open(financeApi.pdfUrl(savedId), "_blank")}
              >
                Download PDF
              </Button>
            </>
          )}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saveMutation.isPending}
            onClick={handleSave}
          >
            {isEdit ? "Update" : "Save"}
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical" requiredMark="optional">
        <Row gutter={24}>

          {/* ── Left column ─────────────────────────────────────────────── */}
          <Col xs={24} lg={16}>

            {/* Document basics */}
            <Card
              title="Document Details"
              style={{ borderRadius: 10, marginBottom: 20 }}
              styles={{ header: { borderBottom: "2px solid #1677ff" } }}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Document Type" required>
                    <Select
                      value={docType}
                      disabled={isEdit}
                      onChange={(v: DocumentType) => {
                        setDocType(v);
                        form.setFieldValue("status", "draft");
                      }}
                    >
                      {DOC_TYPES.map(t => (
                        <Option key={t} value={t}>{DOC_TYPE_LABELS[t]}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                    <Select>
                      {statusOptions.map(s => (
                        <Option key={s} value={s}>
                          <Tag color={STATUS_COLORS[s]} style={{ margin: 0 }}>
                            {s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </Tag>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Currency" required>
                    <Select
                      value={currency}
                      onChange={(v: string) => setCurrency(v)}
                    >
                      {CURRENCIES.map(c => (
                        <Option key={c} value={c}>{c}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="valid_until" label="Valid Until">
                    <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="project" label="Project">
                    <Select
                      allowClear
                      showSearch
                      placeholder="Select project…"
                      optionLabelProp="label"
                      optionFilterProp="label"
                      dropdownRender={(menu) => renderProjectDropdown(menu, () => setProjectModalOpen(true))}
                    >
                      {projects.map(p => (
                        <Option key={p.id} value={p.id} label={p.name}>
                          {p.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="division" label="Division">
                    <Select allowClear placeholder="Select division…">
                      {divisions.map(d => (
                        <Option key={d.id} value={d.id}>{d.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Line items */}
            <Card
              title="Line Items"
              style={{ borderRadius: 10, marginBottom: 20 }}
              styles={{ header: { borderBottom: "2px solid #1677ff" } }}
            >
              <LineItemsTable
                items={lineItems}
                currency={currency}
                onChange={setLineItems}
              />
            </Card>

            {/* Notes */}
            <Card
              title="Notes / Terms"
              style={{ borderRadius: 10, marginBottom: 20 }}
            >
              <Form.Item name="notes" noStyle>
                <TextArea
                  rows={4}
                  placeholder="Add notes, payment terms, or special instructions…"
                />
              </Form.Item>
            </Card>
          </Col>

          {/* ── Right column ──────────────────────────────────────────────── */}
          <Col xs={24} lg={8}>

            {/* Client selection */}
            <Card
              title="Client"
              style={{ borderRadius: 10, marginBottom: 20 }}
              styles={{ header: { borderBottom: "2px solid #1677ff" } }}
            >
              <Form.Item
                name="client"
                label="Select Client"
                rules={[{ required: true, message: "Client is required" }]}
              >
                <Select
                  showSearch
                  placeholder="Search and select client…"
                  optionLabelProp="label"
                  optionFilterProp="label"
                  onChange={handleClientChange}
                  dropdownRender={(menu) => renderClientDropdown(menu, () => setAddClientOpen(true))}
                >
                  {clients.map(c => {
                    const clientDisplay = c.display_name || formatClientProject(c.client_name || c.name, c.project_name);
                    return (
                      <Option key={c.id} value={c.id} label={clientDisplay}>
                        <div>
                          <Text strong>{clientDisplay}</Text>
                          {c.code && (
                            <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                              ({c.code})
                            </Text>
                          )}
                        </div>
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>

              {/* Auto-populated client info */}
              {selectedClient && (selectedClient.contact_email || selectedClient.gst_number) && (
                <div style={{
                  background: "var(--bms-surface-2, #f8fafc)",
                  border: "1px solid var(--bms-border, #e8edf3)",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                }}>
                  <Descriptions size="small" column={1} labelStyle={{ color: "var(--bms-text-3, #8c9ab0)", fontSize: 11 }}>
                    {selectedClient.contact_email && (
                      <Descriptions.Item label="Email">
                        {selectedClient.contact_email}
                      </Descriptions.Item>
                    )}
                    {selectedClient.gst_number && (
                      <Descriptions.Item label="GSTIN">
                        <Text code>{selectedClient.gst_number}</Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </div>
              )}

              <Form.Item name="billing_address" label="Billing Address">
                <TextArea rows={3} placeholder="Billing address…" />
              </Form.Item>
              <Form.Item name="shipping_address" label="Shipping Address">
                <TextArea rows={3} placeholder="Shipping address (if different)…" />
              </Form.Item>
            </Card>

            {/* Document number (edit mode) */}
            {isEdit && document && (
              <Card style={{ borderRadius: 10, marginBottom: 20, background: "color-mix(in srgb, var(--bms-primary) 15%, var(--bms-surface))" }}>
                <Descriptions size="small" column={1} title="Document Info">
                  <Descriptions.Item label="Number">
                    <Text strong style={{ color: "#1677ff", fontFamily: "monospace" }}>
                      {document.document_number}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Created">
                    {new Date(document.created_at).toLocaleDateString("en-IN")}
                  </Descriptions.Item>
                  <Descriptions.Item label="Subtotal">
                    {currency} {parseFloat(document.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Descriptions.Item>
                  <Descriptions.Item label="GST">
                    {currency} {parseFloat(document.gst_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Descriptions.Item>
                  <Descriptions.Item label="Total">
                    <Text strong style={{ color: "#1677ff", fontSize: 14 }}>
                      {currency} {parseFloat(document.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* Future integration notice */}
            <Alert
              type="info"
              showIcon
              style={{ borderRadius: 8 }}
              message="Auto-Generation Ready"
              description="This document can be auto-generated from Timesheet entries or Project milestones in future."
            />
          </Col>
        </Row>
      </Form>

      {/* ── PDF Preview Modal ── */}
      {previewOpen && savedId && (
        <PDFPreviewModal
          documentId={savedId}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      <AddClientModal
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onSuccess={handleClientCreated}
      />
      <CreateProjectModal
        open={projectModalOpen}
        onCancel={() => setProjectModalOpen(false)}
        onSuccess={(newProject: any) => {
          qc.invalidateQueries({ queryKey: ["finance-projects-dropdown"] });
          setProjectModalOpen(false);
          form.setFieldValue("project", newProject.id);
        }}
      />
    </div>
  );
}
