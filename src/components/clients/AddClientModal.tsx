import { Modal, Form, Input, Select, message } from "antd";
import { BankOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { get, post } from "@/services/api";
import PhoneInput from "@/components/common/PhoneInput";
import { phoneFormRules } from "@/utils/phone";

export interface CreatedClient {
  id: string;
  name: string;
  code: string;
  contact_email?: string;
  contact_person?: string;
  phone?: string;
  address?: string;
  formatted_address?: string;
  gst_number?: string;
  pan_number?: string;
}

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (client: CreatedClient) => void;
}

function UpperInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      onChange={(e) => {
        const up = e.target.value.toUpperCase();
        const synth = Object.create(e);
        synth.target = { ...e.target, value: up };
        props.onChange?.(synth);
      }}
    />
  );
}

export default function AddClientModal({ open, onClose, onSuccess }: AddClientModalProps) {
  const [form] = Form.useForm();

  const { data: categories } = useQuery({
    queryKey: ["client-categories"],
    queryFn:  () => get<Array<{ id: string; name: string }>>("/master/dropdown/client-categories/"),
    staleTime: Infinity,
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => post<CreatedClient>("/clients/", values),
    onSuccess: (client) => {
      message.success("Client created");
      form.resetFields();
      onSuccess(client);
    },
    onError: (e: any) => {
      const errData = e?.response?.data;
      if (errData && typeof errData === "object") {
        // If there is a nested "errors" object (typical for 400 validation errors)
        if (errData.errors && typeof errData.errors === "object") {
          const firstErrList = Object.values(errData.errors).flat();
          if (firstErrList.length > 0 && typeof firstErrList[0] === "string") {
            message.error(firstErrList[0]);
            return;
          }
        }
        // If there is a "detail" field (typical for 403 Forbidden)
        if (errData.detail && typeof errData.detail === "string") {
          message.error(errData.detail);
          return;
        }
        // If there is a "message" field
        if (errData.message && typeof errData.message === "string") {
          message.error(errData.message);
          return;
        }
        // General fallback
        const first = Object.values(errData).flat()[0];
        if (typeof first === "string" && first !== "error") {
          message.error(first);
          return;
        }
      }
      message.error("Failed to create client. Please check details or permissions.");
    },
  });

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BankOutlined style={{ color: "var(--bms-primary)" }} />
          <span>Add Client</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      onOk={() => form.submit()}
      confirmLoading={saveMutation.isPending}
      okText="Create"
      width={520}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => saveMutation.mutate(v)}
        requiredMark="optional"
      >
        <Form.Item
          name="name"
          label="Client Name"
          rules={[{ required: true, message: "Client name is required" }]}
        >
          <Input placeholder="e.g. Acme Corporation" />
        </Form.Item>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Form.Item
            name="code"
            label="Short Code"
            rules={[{ required: true, message: "Short code is required" }]}
          >
            <Input placeholder="e.g. ACME" />
          </Form.Item>

          <Form.Item name="category" label="Category">
            <Select placeholder="Select category" allowClear>
              {(categories ?? []).map((c) => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="contact_person" label="Contact Person">
            <Input placeholder="Primary contact name" />
          </Form.Item>

          <Form.Item
            name="contact_email"
            label="Contact Email"
            rules={[{ type: "email", message: "Enter a valid email" }]}
          >
            <Input placeholder="contact@acme.com" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone"
            style={{ gridColumn: "1 / -1" }}
            rules={phoneFormRules({ label: "Phone number" })}
          >
            <PhoneInput />
          </Form.Item>

          <Form.Item
            name="pan_number"
            label="PAN Number"
            normalize={(v: string) => v?.toUpperCase()}
            rules={[{
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value.toUpperCase()))
                  return Promise.resolve();
                return Promise.reject("Invalid PAN. Format: ABCDE1234F");
              },
            }]}
          >
            <UpperInput placeholder="ABCDE1234F" maxLength={10} />
          </Form.Item>

          <Form.Item
            name="gst_number"
            label="GST Number"
            normalize={(v: string) => v?.toUpperCase()}
            rules={[{
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                if (/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value.toUpperCase()))
                  return Promise.resolve();
                return Promise.reject("Invalid GSTIN. Format: 22ABCDE1234F1Z5");
              },
            }]}
          >
            <UpperInput placeholder="22ABCDE1234F1Z5" maxLength={15} />
          </Form.Item>
        </div>

        <Form.Item name="address" label="Office Address">
          <Input.TextArea rows={2} placeholder="Registered office address" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
