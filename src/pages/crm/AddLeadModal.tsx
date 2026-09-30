import { useEffect } from "react";
import {
  Modal, Form, Input, Select, DatePicker, InputNumber,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { Lead, LeadPayload } from "@/services/leads";
import { businessTypeApi, billingTypeApi, type BusinessTypeDropdown, type DropdownOption } from "@/services/master";

const { Option } = Select;
const toOptions = (arr: any) => (Array.isArray(arr) ? arr.map((x: any) => ({ value: x.id, label: x.name })) : []);
const filterOpt = (input: string, opt: any) =>
  (opt?.label as string)?.toLowerCase().includes(input.toLowerCase());

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: LeadPayload) => void;
  loading?: boolean;
  initialValues?: Lead | null;
}

export default function AddLeadModal({ open, onClose, onSubmit, loading, initialValues }: Props) {
  const [form] = Form.useForm();
  const isEdit = !!initialValues;

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

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue({
          ...initialValues,
          business_type: initialValues.business_type || undefined,
          billing_type: initialValues.billing_type || undefined,
          expected_deal_value: parseFloat(initialValues.expected_deal_value || "0"),
          next_followup_date: initialValues.next_followup_date
            ? dayjs(initialValues.next_followup_date)
            : null,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, initialValues, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSubmit({
        ...values,
        business_type: values.business_type || null,
        billing_type: values.billing_type || null,
        next_followup_date: values.next_followup_date
          ? values.next_followup_date.format("YYYY-MM-DD")
          : null,
      });
    } catch {
      // validation failed — antd handles field highlighting
    }
  };

  return (
    <Modal
      title={isEdit ? "Edit Lead" : "Add New Lead"}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      okText={isEdit ? "Save Changes" : "Save Lead"}
      width={680}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ paddingTop: 8 }}>
        {/* ── Required fields ── */}
        <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Project Information
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <Form.Item
            name="institution_name"
            label="Project Name"
            rules={[{ required: true, message: "Project name is required" }]}
          >
            <Input placeholder="e.g. AI Training Programme 2026" />
          </Form.Item>

          <Form.Item
            name="client_name"
            label="Client Name"
            rules={[{ required: true, message: "Client name is required" }]}
          >
            <Input placeholder="e.g. Dr. John Smith" />
          </Form.Item>

          <Form.Item
            name="company"
            label="Company Name"
            rules={[{ required: true, message: "Company name is required" }]}
          >
            <Input placeholder="e.g. ABC Pvt Ltd" />
          </Form.Item>

          <Form.Item
            name="expected_deal_value"
            label="Expected Deal Value (₹)"
            rules={[{ required: true, message: "Expected deal value is required" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              precision={2}
              placeholder="0.00"
            />
          </Form.Item>

          <Form.Item
            name="next_followup_date"
            label="Next Follow Up Date"
            rules={[{ required: true, message: "Next follow-up date is required" }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
          </Form.Item>

          <Form.Item name="business_type" label="Business Type">
            <Select
              showSearch
              placeholder="Select business type"
              options={toOptions(businessTypes)}
              filterOption={filterOpt}
              allowClear
            />
          </Form.Item>

          <Form.Item name="billing_type" label="Billing Type">
            <Select
              showSearch
              placeholder="Select billing type"
              options={toOptions(billingTypes)}
              filterOption={filterOpt}
              allowClear
            />
          </Form.Item>

          <Form.Item name="status" label="Status" initialValue="new_lead">
            <Select>
              <Option value="new_lead">New Lead</Option>
              <Option value="contacted">Contacted</Option>
              <Option value="proposal_sent">Proposal Sent</Option>
              <Option value="qualified">Qualified</Option>
              <Option value="converted">Converted</Option>
              <Option value="lost">Lost</Option>
            </Select>
          </Form.Item>
        </div>

        {/* ── Optional contact fields ── */}
        <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 8 }}>
          Contact Details <span style={{ fontWeight: 400, textTransform: "none", color: "#bfbfbf" }}>(optional)</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <Form.Item name="contact_person" label="Contact Person">
            <Input placeholder="e.g. Mr. Raj Kumar" />
          </Form.Item>

          <Form.Item name="designation" label="Designation">
            <Input placeholder="e.g. Procurement Manager" />
          </Form.Item>

          <Form.Item name="phone" label="Mobile Number">
            <Input placeholder="+91 9XXXXXXXXX" />
          </Form.Item>

          <Form.Item name="whatsapp" label="WhatsApp">
            <Input placeholder="+91 9XXXXXXXXX" />
          </Form.Item>

          <Form.Item name="email" label="Email" style={{ gridColumn: "1/-1" }}>
            <Input placeholder="contact@example.com" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
