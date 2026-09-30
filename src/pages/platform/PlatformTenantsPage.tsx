import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Collapse,
  Drawer,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  BankOutlined,
  CloudServerOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  platformTenantsApi,
  type PlanDefinition,
  type PlatformTenantCreatePayload,
  type PlatformTenantDetail,
  type PlatformTenantSummary,
  type TenantBillingSnapshot,
  type TenantCompanyDetails,
} from "@/services/platformTenants";

const { Title, Text } = Typography;

/** Business-friendly labels for workspace setup steps (backend keys unchanged). */
const STEP_LABELS: Record<string, string> = {
  create_schema: "Prepare workspace",
  provision_keycloak_realm: "Set up secure sign-in",
  provision_minio_bucket: "Prepare file storage",
  seed_admin: "Create workspace admin",
  send_invite: "Send admin invite",
  activate_tenant: "Activate workspace",
};

const STEP_SUCCESS_HINTS: Record<string, string> = {
  create_schema: "Workspace foundation is ready",
  provision_keycloak_realm: "Secure login is configured",
  provision_minio_bucket: "File storage is ready",
  seed_admin: "Workspace admin account created",
  send_invite: "Invite ready for the workspace admin",
  activate_tenant: "Workspace is live",
};

const STEP_ORDER = Object.keys(STEP_LABELS);

const MODULE_LABELS: Record<string, string> = {
  hms: "People / HR",
  workspace: "Workspace",
  master: "Master data",
  policy: "Policies",
  role: "Roles & permissions",
  plan: "Plan & usage",
  project: "Projects",
  crm: "CRM",
  finance: "Finance",
  executive: "Executive dashboard",
  chat: "Chat",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending: "Setting up",
  suspended: "Suspended",
  in_progress: "Setting up",
  started: "In progress",
  success: "Done",
  failure: "Failed",
  failed: "Needs attention",
};

function statusColor(status: string): string {
  switch (status) {
    case "active":
    case "success":
      return "success";
    case "pending":
    case "started":
    case "in_progress":
      return "processing";
    case "suspended":
    case "failure":
    case "failed":
      return "error";
    default:
      return "default";
  }
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status.replace(/_/g, " ");
}

function moduleLabel(key: string): string {
  return MODULE_LABELS[key] || key;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function formatLimit(n: number | null | undefined): string {
  return n == null ? "Unlimited" : String(n);
}

/** Turn raw step detail / dict strings into short business-facing copy. */
function humanizeStepDetail(step: string, raw?: string): string | undefined {
  if (!raw?.trim()) return STEP_SUCCESS_HINTS[step];

  const text = raw.trim();

  // Prefer known business outcomes over dumping dict / JSON blobs.
  if (step === "send_invite") {
    if (/['"]sent['"]\s*:\s*True/i.test(text) || /"sent"\s*:\s*true/i.test(text)) {
      return "Invite email sent to the workspace admin";
    }
    if (/email_not_configured/i.test(text)) {
      return "Invite email is not configured — share the onboarding link below";
    }
    if (/invite_link/i.test(text)) {
      return "Invite prepared — share the onboarding link if email did not arrive";
    }
  }

  if (step === "seed_admin" && /email/i.test(text)) {
    const emailMatch = text.match(/['"]email['"]\s*:\s*['"]([^'"]+)['"]/i);
    if (emailMatch?.[1]) {
      return `Admin account ready for ${emailMatch[1]}`;
    }
    return STEP_SUCCESS_HINTS[step];
  }

  if (step === "activate_tenant" && /ACTIVE/i.test(text)) {
    return "Workspace is active and ready for login";
  }

  if (step === "create_schema") {
    return STEP_SUCCESS_HINTS[step];
  }
  if (step === "provision_keycloak_realm") {
    return STEP_SUCCESS_HINTS[step];
  }
  if (step === "provision_minio_bucket") {
    return STEP_SUCCESS_HINTS[step];
  }

  // Hide technical dumps (dict / JSON / exception traces with infra nouns).
  if (
    text.startsWith("{") ||
    text.startsWith("'") ||
    /keycloak|minio|schema_name|celery|traceback/i.test(text)
  ) {
    return STEP_SUCCESS_HINTS[step] || "Completed";
  }

  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

function CompanyLogo({
  name,
  logoUrl,
  size = 28,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";

  const resolvedUrl = useMemo(() => {
    if (!logoUrl) return null;
    let url = logoUrl;
    if (url.includes("/pmt/media/")) {
      url = url.replace("/pmt/media/", "/bms/media/");
    } else if (url.startsWith("/media/")) {
      url = url.replace("/media/", "/bms/media/");
    }
    return url;
  }, [logoUrl]);

  return (
    <Avatar
      src={resolvedUrl || undefined}
      size={size}
      shape="square"
      style={{
        backgroundColor: "var(--bms-primary, #1a73e8)",
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.45)),
        flexShrink: 0,
      }}
    >
      {initial}
    </Avatar>
  );
}

function UsageBar({
  label,
  used,
  max,
  atLimit,
}: {
  label: string;
  used: number;
  max: number | null;
  atLimit: boolean;
}) {
  const pct = max == null ? 0 : Math.min(100, Math.round((used / Math.max(max, 1)) * 100));
  return (
    <div style={{ marginBottom: 8 }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Text>{label}</Text>
        <Text type={atLimit ? "danger" : "secondary"}>
          {used} / {formatLimit(max)}
        </Text>
      </Space>
      {max != null && (
        <Progress
          percent={pct}
          size="small"
          status={atLimit ? "exception" : "normal"}
          showInfo={false}
        />
      )}
    </div>
  );
}

function BillingPanel({
  billing,
  plans,
  onChangePlan,
  changing,
}: {
  billing: TenantBillingSnapshot;
  plans: PlanDefinition[];
  onChangePlan: (plan: string) => void;
  changing: boolean;
}) {
  return (
    <Card size="small" title="Plan & usage" style={{ marginBottom: 16 }}>
      <Form.Item label="Subscription plan" style={{ marginBottom: 12 }}>
        <Select
          value={billing.plan.slug}
          loading={changing}
          onChange={onChangePlan}
          options={plans.map((p) => ({
            value: p.slug,
            label: `${p.name} (${formatLimit(p.max_employees)} users)`,
          }))}
        />
      </Form.Item>
      <Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
        Included:{" "}
        {(billing.plan.modules || []).map(moduleLabel).join(", ") || "—"}
      </Text>
      <UsageBar
        label="Team members"
        used={billing.usage.employees}
        max={billing.limits.max_employees}
        atLimit={billing.at_limit.employees}
      />
      {(billing.plan.modules || []).includes("project") ? (
        <UsageBar
          label="Projects"
          used={billing.usage.projects}
          max={billing.limits.max_projects}
          atLimit={billing.at_limit.projects}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 4 }}
          message="Projects not included"
          description="Upgrade to SMEs or Enterprises to unlock Projects, CRM, and Finance."
        />
      )}
    </Card>
  );
}

function CompanyDetailsPanel({
  detail,
  onSaveDetails,
  savingDetails,
  onUploadLogo,
  uploadingLogo,
}: {
  detail: PlatformTenantDetail;
  onSaveDetails: (values: TenantCompanyDetails) => void;
  savingDetails: boolean;
  onUploadLogo: (file: File) => void;
  uploadingLogo: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm<TenantCompanyDetails>();

  const hasAnyDetail = Boolean(
    detail.industry || detail.website || detail.contact_phone || detail.address || detail.tax_id
  );

  return (
    <Card size="small" title="Company details" style={{ marginBottom: 16 }}>
      <Space align="start" style={{ marginBottom: 16 }}>
        <CompanyLogo name={detail.name} logoUrl={detail.logo_url} size={48} />
        <Upload
          showUploadList={false}
          beforeUpload={(file) => {
            onUploadLogo(file as unknown as File);
            return false;
          }}
          accept="image/*"
        >
          <Button size="small" icon={<UploadOutlined />} loading={uploadingLogo}>
            {detail.logo_url ? "Replace logo" : "Upload logo"}
          </Button>
        </Upload>
      </Space>

      {editing ? (
        <Form
          form={form}
          layout="vertical"
          size="small"
          initialValues={{
            industry: detail.industry,
            website: detail.website,
            contact_phone: detail.contact_phone,
            address: detail.address,
            tax_id: detail.tax_id,
          }}
          onFinish={(values) => {
            onSaveDetails(values);
            setEditing(false);
          }}
        >
          <Form.Item name="industry" label="Industry">
            <Input placeholder="Software" />
          </Form.Item>
          <Form.Item name="website" label="Website" rules={[{ type: "url", message: "Enter a valid URL" }]}>
            <Input placeholder="https://acme.test" />
          </Form.Item>
          <Form.Item name="contact_phone" label="Contact phone">
            <Input placeholder="+1 555 0100" />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="123 Main St" />
          </Form.Item>
          <Form.Item name="tax_id" label="Tax ID (GSTIN)">
            <Input placeholder="22AAAAA0000A1Z5" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" size="small" loading={savingDetails}>
              Save
            </Button>
            <Button size="small" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </Space>
        </Form>
      ) : (
        <>
          {hasAnyDetail ? (
            <Space direction="vertical" size={4} style={{ width: "100%", marginBottom: 8 }}>
              {detail.industry && <Text>{detail.industry}</Text>}
              {detail.website && (
                <Text>
                  <a href={detail.website} target="_blank" rel="noreferrer">
                    {detail.website}
                  </a>
                </Text>
              )}
              {detail.contact_phone && <Text type="secondary">{detail.contact_phone}</Text>}
              {detail.address && <Text type="secondary">{detail.address}</Text>}
              {detail.tax_id && <Text type="secondary">Tax ID: {detail.tax_id}</Text>}
            </Space>
          ) : (
            <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              No company details added yet.
            </Text>
          )}
          <Button size="small" onClick={() => setEditing(true)}>
            {hasAnyDetail ? "Edit details" : "Add details"}
          </Button>
        </>
      )}
    </Card>
  );
}

function ProvisioningStepsPanel({
  detail,
  onRetry,
  retrying,
  plans,
  onChangePlan,
  changingPlan,
  onSaveDetails,
  savingDetails,
  onUploadLogo,
  uploadingLogo,
}: {
  detail: PlatformTenantDetail;
  onRetry: () => void;
  retrying: boolean;
  plans: PlanDefinition[];
  onChangePlan: (plan: string) => void;
  changingPlan: boolean;
  onSaveDetails: (values: TenantCompanyDetails) => void;
  savingDetails: boolean;
  onUploadLogo: (file: File) => void;
  uploadingLogo: boolean;
}) {
  const currentIndex = useMemo(() => {
    for (let i = 0; i < STEP_ORDER.length; i++) {
      const row = detail.steps[STEP_ORDER[i]];
      if (!row || row.status === "started") return i;
      if (row.status === "failure") return i;
    }
    return STEP_ORDER.length;
  }, [detail.steps]);

  const stalled =
    detail.status !== "active" &&
    (detail.provisioning_status === "failed" || detail.provisioning_status === "pending");

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Tag color={statusColor(detail.status)}>{statusLabel(detail.status)}</Tag>
        <Tag color={statusColor(detail.provisioning_status)}>
          Setup: {statusLabel(detail.provisioning_status)}
        </Tag>
        {detail.plan && <Tag color="blue">{detail.plan_name || detail.plan}</Tag>}
      </Space>

      <CompanyDetailsPanel
        detail={detail}
        onSaveDetails={onSaveDetails}
        savingDetails={savingDetails}
        onUploadLogo={onUploadLogo}
        uploadingLogo={uploadingLogo}
      />

      {detail.billing && (
        <BillingPanel
          billing={detail.billing}
          plans={plans}
          onChangePlan={onChangePlan}
          changing={changingPlan}
        />
      )}

      {stalled && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Setup did not finish"
          description="You can safely resume — completed steps are skipped automatically."
          action={
            <Button size="small" loading={retrying} onClick={onRetry}>
              Resume setup
            </Button>
          }
        />
      )}

      <Title level={5} style={{ marginBottom: 12 }}>
        Onboarding progress
      </Title>
      <Steps
        direction="vertical"
        size="small"
        current={currentIndex}
        items={STEP_ORDER.map((step) => {
          const row = detail.steps[step];
          const status =
            row?.status === "success"
              ? "finish"
              : row?.status === "failure"
                ? "error"
                : row?.status === "started"
                  ? "process"
                  : "wait";
          const description =
            row?.status === "failure"
              ? humanizeStepDetail(step, row.error_detail) || "Something went wrong — try Resume setup"
              : row?.status === "success"
                ? humanizeStepDetail(step, row.error_detail)
                : row?.status === "started"
                  ? "In progress…"
                  : undefined;
          return {
            title: STEP_LABELS[step] || step,
            status,
            description,
          };
        })}
      />

      {detail.login_url && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message="Workspace sign-in (onboarding)"
          description={
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <Text copyable={{ text: detail.login_url }} style={{ wordBreak: "break-all" }}>
                {detail.login_url}
              </Text>
              <Text type="secondary">
                Share this URL with the workspace admin. They sign in here after setting their
                password from the invite email.
              </Text>
            </Space>
          }
        />
      )}

      {detail.invite_link && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message="First-time password setup"
          description={
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <Text copyable={{ text: detail.invite_link }} style={{ wordBreak: "break-all" }}>
                {detail.invite_link}
              </Text>
              <Text type="secondary">
                Use only if the admin has not completed password setup (invite email missing or
                expired). After setup, they use the sign-in URL above.
              </Text>
            </Space>
          }
        />
      )}

      {detail.domain && !detail.login_url && (
        <Text type="secondary" style={{ display: "block", marginTop: 12 }}>
          Login address: <code>{detail.domain}</code>
        </Text>
      )}
    </div>
  );
}

export default function PlatformTenantsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form] = Form.useForm<PlatformTenantCreatePayload>();
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoList, setPendingLogoList] = useState<UploadFile[]>([]);

  const listQuery = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: () => platformTenantsApi.list(),
  });

  const plansQuery = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => platformTenantsApi.plans(),
  });

  const detailQuery = useQuery({
    queryKey: ["platform-tenant", selectedId],
    queryFn: () => platformTenantsApi.status(selectedId!),
    enabled: selectedId != null,
    refetchInterval: (query) => {
      const st = query.state.data?.provisioning_status;
      return st === "in_progress" || st === "pending" ? 2500 : false;
    },
  });

  useEffect(() => {
    if (detailQuery.data?.status === "active") {
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
    }
  }, [detailQuery.data?.status, qc]);

  const createMutation = useMutation({
    mutationFn: (payload: PlatformTenantCreatePayload) =>
      platformTenantsApi.create(payload),
    onSuccess: (data) => {
      message.success(`Workspace setup started for ${data.slug}`);
      setCreateOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      setSelectedId(data.id);

      if (pendingLogoFile) {
        platformTenantsApi
          .uploadLogo(data.id, pendingLogoFile)
          .then(() => qc.invalidateQueries({ queryKey: ["platform-tenants"] }))
          .catch(() => message.warning("Workspace created, but the logo upload failed. You can retry it from the workspace details."))
          .finally(() => {
            setPendingLogoFile(null);
            setPendingLogoList([]);
          });
      }
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const msg =
        data?.message ||
        (typeof data?.errors === "string" ? data.errors : null) ||
        "Failed to create workspace";
      message.error(msg);
    },
  });

  const detailsMutation = useMutation({
    mutationFn: ({ tenantId, details }: { tenantId: number; details: TenantCompanyDetails }) =>
      platformTenantsApi.updateDetails(tenantId, details),
    onSuccess: () => {
      message.success("Company details updated");
      detailQuery.refetch();
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Failed to update company details");
    },
  });

  const logoMutation = useMutation({
    mutationFn: ({ tenantId, file }: { tenantId: number; file: File }) =>
      platformTenantsApi.uploadLogo(tenantId, file),
    onSuccess: () => {
      message.success("Logo updated");
      detailQuery.refetch();
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Failed to upload logo");
    },
  });

  const retryMutation = useMutation({
    mutationFn: (tenantId: number) => platformTenantsApi.retry(tenantId),
    onSuccess: () => {
      message.success("Resuming workspace setup");
      detailQuery.refetch();
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Failed to resume setup");
    },
  });

  const planMutation = useMutation({
    mutationFn: ({ tenantId, plan }: { tenantId: number; plan: string }) =>
      platformTenantsApi.updatePlan(tenantId, plan),
    onSuccess: (data) => {
      const planName =
        (plansQuery.data?.results ?? []).find((p) => p.slug === data.plan)?.name || data.plan;
      message.success(`Plan updated to ${planName}`);
      detailQuery.refetch();
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Failed to update plan");
    },
  });

  const planOptions = (plansQuery.data?.results ?? []).map((p) => {
    const seats = formatLimit(p.max_employees);
    const price = p.monthly_inr != null ? `₹${p.monthly_inr}/mo` : "";
    return {
      value: p.slug,
      label: `${p.name} — ${seats} users${price ? ` · ${price}` : ""}`,
    };
  });

  const columns = [
    {
      title: "Company",
      dataIndex: "name",
      key: "name",
      render: (name: string, row: PlatformTenantSummary) => (
        <Space align="center">
          <CompanyLogo name={name} logoUrl={row.logo_url} size={24} />
          <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => setSelectedId(row.id)}>
            {name}
          </Button>
        </Space>
      ),
    },
    {
      title: "Workspace ID",
      dataIndex: "slug",
      key: "slug",
      render: (s: string) => <Text code>{s}</Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (s: string) => <Tag color={statusColor(s)}>{statusLabel(s)}</Tag>,
    },
    {
      title: "Login address",
      dataIndex: "domain",
      key: "domain",
      render: (d: string | null) => (d ? <Text code>{d}</Text> : "—"),
    },
    {
      title: "Plan",
      dataIndex: "plan",
      key: "plan",
      width: 130,
      render: (p: string, row: PlatformTenantSummary) => row.plan_name || p || "—",
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space align="center">
            <CloudServerOutlined style={{ fontSize: 22, color: "var(--bms-primary, #1a73e8)" }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Workspaces
              </Title>
              <Text type="secondary">
                Create and manage customer workspaces — setup, plans, and admin invites.
              </Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => listQuery.refetch()}
              loading={listQuery.isFetching}
            >
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              New workspace
            </Button>
          </Space>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Platform operators only"
        description="New workspaces are prepared automatically (secure login, storage, and the first admin). You can track progress and share the admin invite from the workspace details."
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={listQuery.data?.results ?? []}
          columns={columns}
          pagination={{ pageSize: 20 }}
          onRow={(row) => ({
            onClick: () => setSelectedId(row.id),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      <Modal
        title="Create workspace"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setPendingLogoFile(null);
          setPendingLogoList([]);
        }}
        okText="Create workspace"
        confirmLoading={createMutation.isPending}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
          initialValues={{ plan: "starter" }}
        >
          <Form.Item label="Company logo (optional)">
            <Upload
              listType="picture-card"
              fileList={pendingLogoList}
              maxCount={1}
              accept="image/*"
              beforeUpload={(file) => {
                setPendingLogoFile(file as unknown as File);
                setPendingLogoList([
                  {
                    uid: "pending-logo",
                    name: file.name,
                    status: "done",
                    url: URL.createObjectURL(file),
                  },
                ]);
                return false;
              }}
              onRemove={() => {
                setPendingLogoFile(null);
                setPendingLogoList([]);
              }}
            >
              {pendingLogoList.length === 0 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </Form.Item>
          <Form.Item
            name="name"
            label="Company name"
            rules={[{ required: true, message: "Company name is required" }]}
          >
            <Input
              placeholder="Acme Corp"
              onChange={(e) => {
                if (!form.isFieldTouched("slug")) {
                  form.setFieldValue("slug", slugify(e.target.value));
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="slug"
            label="Workspace ID"
            rules={[
              { required: true, message: "Workspace ID is required" },
              {
                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: "Lowercase letters, numbers, and hyphens only",
              },
            ]}
            extra="Used in the login address (e.g. acme.yourdomain.com). Keep it short and unique."
          >
            <Input placeholder="acme" />
          </Form.Item>
          <Form.Item
            name="admin_email"
            label="Workspace admin email"
            rules={[
              { required: true, message: "Admin email is required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input placeholder="admin@acme.test" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="admin_first_name" label="Admin first name">
                <Input placeholder="Ada" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="admin_last_name" label="Admin last name">
                <Input placeholder="Lovelace" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="plan"
            label="Subscription plan"
            rules={[{ required: true, message: "Plan is required" }]}
            extra="Controls how many users and which modules the workspace can use."
          >
            <Select options={planOptions} placeholder="Select a plan" />
          </Form.Item>
          <Form.Item
            name="domain"
            label="Custom login address (optional)"
            extra="Leave blank to use the default Workspace ID address."
          >
            <Input placeholder="acme.localhost" />
          </Form.Item>

          <Collapse
            ghost
            style={{ marginBottom: 8 }}
            items={[
              {
                key: "company-details",
                label: (
                  <Space size={6}>
                    <BankOutlined />
                    <Text>Company details (optional)</Text>
                  </Space>
                ),
                children: (
                  <>
                    <Form.Item name="industry" label="Industry">
                      <Input placeholder="Software" />
                    </Form.Item>
                    <Form.Item
                      name="website"
                      label="Website"
                      rules={[{ type: "url", message: "Enter a valid URL" }]}
                    >
                      <Input placeholder="https://acme.test" />
                    </Form.Item>
                    <Form.Item name="contact_phone" label="Contact phone">
                      <Input placeholder="+1 555 0100" />
                    </Form.Item>
                    <Form.Item name="address" label="Address">
                      <Input.TextArea rows={2} placeholder="123 Main St" />
                    </Form.Item>
                    <Form.Item name="tax_id" label="Tax ID (GSTIN)">
                      <Input placeholder="22AAAAA0000A1Z5" />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <Drawer
        title={detailQuery.data?.name || "Workspace details"}
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
        width={440}
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={detailQuery.isFetching}
            onClick={() => detailQuery.refetch()}
          >
            Refresh
          </Button>
        }
      >
        {detailQuery.isLoading && <Text type="secondary">Loading…</Text>}
        {detailQuery.isError && (
          <Alert type="error" message="Could not load workspace details" showIcon />
        )}
        {detailQuery.data && (
          <ProvisioningStepsPanel
            detail={detailQuery.data}
            retrying={retryMutation.isPending}
            onRetry={() => retryMutation.mutate(detailQuery.data!.id)}
            plans={plansQuery.data?.results ?? []}
            changingPlan={planMutation.isPending}
            onChangePlan={(plan) =>
              planMutation.mutate({ tenantId: detailQuery.data!.id, plan })
            }
            savingDetails={detailsMutation.isPending}
            onSaveDetails={(values) =>
              detailsMutation.mutate({ tenantId: detailQuery.data!.id, details: values })
            }
            uploadingLogo={logoMutation.isPending}
            onUploadLogo={(file) =>
              logoMutation.mutate({ tenantId: detailQuery.data!.id, file })
            }
          />
        )}
      </Drawer>
    </div>
  );
}
