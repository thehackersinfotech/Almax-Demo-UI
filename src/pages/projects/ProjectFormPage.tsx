import React, { useState } from "react";
import { Form, Input, Button, Select, Switch, Row, Col, DatePicker, InputNumber, Card, Typography, Space, message, Tag, Tooltip, Spin } from "antd";
import { ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { post, get } from "@/services/api";
import { businessTypeApi, billingTypeApi, type BusinessTypeDropdown, type DropdownOption } from "@/services/master";
import { projectsApi } from "@/services/projects";
import RichTextEditor from "@/components/common/RichTextEditor";
const toOptions = (arr: any) => (Array.isArray(arr) ? arr.map((x: any) => ({ value: x.id, label: x.name })) : []);
import { renderClientDropdown } from "@/components/common/DropdownRenderers";
import CreateClientModal from "@/components/clients/CreateClientModal";
import { apiErrorMsg } from "@/utils/apiError";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function ProjectFormPage() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [isSuccess, setIsSuccess] = useState(false);
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [clientModalOpen, setClientModalOpen] = useState(false);

  const createClientMutation = useMutation({
    mutationFn: (values: any) => projectsApi.createClient(values),
    onSuccess: (newClient: any) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setClientModalOpen(false);
      message.success("Client created successfully");
      form.setFieldValue("client", newClient.id);
    },
    onError: (e: any) => message.error("Failed to create client"),
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: () => get<any>(`/clients/?limit=1000`),
  });
  const clients = clientsData?.results || clientsData || [];

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

  const saveMutation = useMutation({
    mutationFn: (d: any) => post("/projects/", d),
    onSuccess: () => {
      message.success("Project created successfully");
      queryClient.invalidateQueries();
      if (searchParams.get("add_project") === "true") {
        window.history.back();
      } else {
        setIsSuccess(true);
      }
    },
    onError: (err: any) => message.error(apiErrorMsg(err, "Failed to create project")),
  });

  const onFinish = (values: any) => {
    const payload = {
      ...values,
      business_type: values.business_type || null,
      billing_type: values.billing_type || null,
      client: values.client || null,
      start_date: values.start_date && dayjs.isDayjs(values.start_date) ? values.start_date.format("YYYY-MM-DD") : (values.start_date ? String(values.start_date) : null),
      end_date: values.end_date && dayjs.isDayjs(values.end_date) ? values.end_date.format("YYYY-MM-DD") : (values.end_date ? String(values.end_date) : null),
    };
    saveMutation.mutate(payload);
  };

    const [generatingCode, setGeneratingCode] = useState(false);
  const generateCode = async (btId?: string) => {
    try {
      setGeneratingCode(true);
      const { code } = await projectsApi.generateCode(btId);
      form.setFieldValue("code", code);
    } catch (e: any) {
      message.error("Failed to generate code");
    } finally {
      setGeneratingCode(false);
    }
  };
  const filterOpt = (input: string, option: any) =>
    (option?.label ?? "").toLowerCase().includes(input.toLowerCase());
    
  const onBusinessTypeChange = (val: string) => {
    const bt = businessTypes.find((b: any) => b.id === val);
    if (bt?.name === "Internal") form.setFieldsValue({ client: null });
    generateCode(val);
  };

  React.useEffect(() => {
    generateCode();
  }, []);

  if (isSuccess) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", padding: 24, textAlign: "center" }}>
        <Card style={{ borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: "#52c41a", marginBottom: 24 }} />
          <Title level={3}>Project Created Successfully</Title>
          <Text style={{ color: "var(--bms-text-2)" }}>
            The project has been created. You can now go back to your original page.
          </Text>
          <div style={{ marginTop: 32 }}>
            <Button size="large" onClick={() => window.history.back()}>Go Back</Button>
            <Button size="large" type="primary" style={{ marginLeft: 16 }} onClick={() => { setIsSuccess(false); form.resetFields(); }}>
              Create Another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: "16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Space align="center" size={16}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => window.history.back()} />
          <Title level={4} style={{ margin: 0 }}>Create New Project</Title>
        </Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saveMutation.isPending}
          onClick={() => form.submit()}
        >
          Save Project
        </Button>
      </div>

      <Card style={{ borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => {
            const payload = {
              ...v,
              start_date: v.start_date ? v.start_date.format("YYYY-MM-DD") : null,
              end_date:   v.end_date   ? v.end_date.format("YYYY-MM-DD")   : null,
            };
            saveMutation.mutate(payload);
          }}
        >
          {/* Row 1: Name */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Project Name" rules={[{ required: true, message: "Project name is required" }]}>
                <Input placeholder="e.g. E-Commerce Platform Development" size="large" />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 2: Code + Status */}
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="code"
                label={
                  <Space size={4}>
                    Project Code
                    <Tag color="blue" style={{ fontSize: 11, fontWeight: 500, margin: 0 }}>Auto-generated</Tag>
                  </Space>
                }
                tooltip="Automatically generated based on the selected Business Type."
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

          {/* Row 3: Business Type + Billing Type — locked after creation */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="business_type"
                label={
                  <Space size={4}>
                    Business Type
                    
                  </Space>
                }
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
                label={
                  <Space size={4}>
                    Billing Type
                    
                  </Space>
                }
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
          <Row gutter={16}>
            <Col xs={24} md={12}>
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
            </Col>
          </Row>

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
      </Card>
      <CreateClientModal
        open={clientModalOpen}
        onCancel={() => setClientModalOpen(false)}
        onOk={(v) => createClientMutation.mutate(v)}
        confirmLoading={createClientMutation.isPending}
      />
    </div>
  );
}
