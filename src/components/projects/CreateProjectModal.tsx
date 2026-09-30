import React, { useState } from "react";
import { Modal, Form, Input, Button, Select, Switch, Row, Col, DatePicker, InputNumber, message, Tooltip, Spin, Space, Tag } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { post, get } from "@/services/api";
import { businessTypeApi, billingTypeApi, type BusinessTypeDropdown, type DropdownOption } from "@/services/master";
import { projectsApi } from "@/services/projects";
import RichTextEditor from "@/components/common/RichTextEditor";
import { renderClientDropdown } from "@/components/common/DropdownRenderers";
import CreateClientModal from "@/components/clients/CreateClientModal";

const { Option } = Select;
const toOptions = (arr: any) => (Array.isArray(arr) ? arr.map((x: any) => ({ value: x.id, label: x.name })) : []);

interface CreateProjectModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (project: any) => void;
}

export default function CreateProjectModal({ open, onCancel, onSuccess }: CreateProjectModalProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  const { data: clientsData } = useQuery({
    queryKey: ["clients-dropdown-prj-modal"],
    queryFn: () => get<any>(`/clients/?limit=1000`),
    enabled: open,
  });
  const clients = clientsData?.results || clientsData || [];

  const { data: businessTypes = [] } = useQuery<BusinessTypeDropdown[]>({
    queryKey: ["dd", "business-types"],
    queryFn: () => businessTypeApi.dropdown(),
    staleTime: 60_000,
    enabled: open,
  });
  
  const { data: billingTypes = [] } = useQuery<DropdownOption[]>({
    queryKey: ["dd", "billing-types"],
    queryFn: () => billingTypeApi.dropdown(),
    staleTime: 60_000,
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (d: any) => post("/projects/", d),
    onSuccess: (res) => {
      message.success("Project created successfully");
      queryClient.invalidateQueries();
      form.resetFields();
      onSuccess(res);
    },
    onError: () => message.error("Failed to create project"),
  });

  const createClientMutation = useMutation({
    mutationFn: (values: any) => projectsApi.createClient(values),
    onSuccess: (newClient: any) => {
      queryClient.invalidateQueries();
      setClientModalOpen(false);
      message.success("Client created successfully");
      form.setFieldValue("client", newClient.id);
    },
    onError: () => message.error("Failed to create client"),
  });

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
    if (open) {
      generateCode();
    }
  }, [open]);

  return (
    <>
      <Modal
        title="New Project"
        open={open}
        onCancel={() => { form.resetFields(); onCancel(); }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={760}
        destroyOnHidden
      >
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
          <Form.Item name="name" label="Project Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. E-Commerce Platform Development" size="large" />
          </Form.Item>

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

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="business_type" label="Business Type">
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
              <Form.Item name="billing_type" label="Billing Type">
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

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="estimated_hours" label="Estimated Hours" initialValue={0}>
                <InputNumber min={0} step={8} style={{ width: "100%" }} addonAfter="hours" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="budget" label="Project Budget" initialValue={0}>
                <InputNumber min={0} step={10000} style={{ width: "100%" }} prefix="₹" />
              </Form.Item>
            </Col>
          </Row>
          
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
    </>
  );
}
