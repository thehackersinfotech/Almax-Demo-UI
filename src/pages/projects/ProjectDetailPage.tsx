import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Spin, Empty, Space, Modal, Form, Input, Select,
  DatePicker, InputNumber, Switch, message, Tabs, Tag, Typography,
} from "antd";
import {
  ArrowLeftOutlined, EditOutlined, HistoryOutlined,
  StopOutlined, IssuesCloseOutlined,
  DashboardOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { projectsApi, type Project, type ProjectHistoryEntry } from "@/services/projects";
import ProjectOverviewTab from "@/components/projects/ProjectOverviewTab";
import ProjectCommentsBlock from "@/components/projects/ProjectCommentsBlock";
import WorkflowChip from "@/components/projects/WorkflowChip";
import TicketsPage from "@/pages/tickets/TicketsPage";
import { businessTypeApi, billingTypeApi, type BusinessTypeDropdown, type DropdownOption } from "@/services/master";
import RichTextEditor from "@/components/common/RichTextEditor";
import PermGuard from "@/components/common/PermGuard";
import { PERMS } from "@/constants/permissions";
import { apiErrorMsg } from "@/utils/apiError";
import { Avatar, Tooltip } from "antd";
import { renderClientDropdown } from "@/components/common/DropdownRenderers";

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

function ActionBadge({ action }: { action: string }) {
  return action === "create"
    ? <Tag color="green">Created</Tag>
    : <Tag color="blue">Updated</Tag>;
}

function HistoryEntry({ entry }: { entry: ProjectHistoryEntry }) {
  const changeKeys = Object.keys(entry.changes);
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--bms-border)" }}>
      <Avatar
        src={entry.changed_by_avatar ?? undefined}
        icon={<span>?</span>}
        style={{ flexShrink: 0, background: "var(--bms-surface-2)" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text strong style={{ fontSize: 13 }}>{entry.changed_by_name}</Text>
          <ActionBadge action={entry.action} />
          <Tooltip title={dayjs(entry.changed_at).format("DD MMM YYYY, hh:mm A")}>
            <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(entry.changed_at).fromNow()}</Text>
          </Tooltip>
        </div>
        {changeKeys.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {changeKeys.map((label) => {
              const { old: oldVal, new: newVal } = entry.changes[label];
              return (
                <div key={label} style={{
                  background: "var(--bms-surface-2)", borderRadius: 6, padding: "6px 10px",
                  fontSize: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
                }}>
                  <Text strong style={{ minWidth: 100 }}>{label}</Text>
                  {entry.action === "create" ? (
                    <Tag color="green">{newVal ?? "—"}</Tag>
                  ) : (
                    <>
                      <Tag>{oldVal ?? "—"}</Tag>
                      <Text type="secondary">→</Text>
                      <Tag color="blue">{newVal ?? "—"}</Tag>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EditModal({ project, open, onClose, onSaved }: {
  project: Project;
  open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [form] = Form.useForm();
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
  const { data: clients = [] } = useQuery({
    queryKey: ["dd", "clients"],
    queryFn: () => projectsApi.clientDropdown(),
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (values: Record<string, unknown>) => projectsApi.update(project.id, values),
    onSuccess: () => { message.success("Project updated"); onSaved(); onClose(); },
    onError: (e: unknown) => message.error(apiErrorMsg(e, "Failed to update project")),
  });

  const toOptions = (arr: any) => (Array.isArray(arr) ? arr.map((x) => ({ value: x.id, label: x.name })) : []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterOpt = (input: string, opt: any) =>
    ((opt?.label as string) ?? "").toLowerCase().includes(input.toLowerCase());

  return (
    <Modal
      title={<span><EditOutlined style={{ marginRight: 6 }} />Edit Project — {project?.code}</span>}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saveMut.isPending}
      width={760}
      destroyOnHidden
      afterOpenChange={(vis) => {
        if (vis && project) {
          form.setFieldsValue({
            ...project,
            start_date: project.start_date ? dayjs(project.start_date as string) : null,
            end_date: project.end_date ? dayjs(project.end_date as string) : null,
          });
        }
      }}
    >
      <Form form={form} layout="vertical" onFinish={(v) => {
        saveMut.mutate({
          ...v,
          start_date: v.start_date?.format("YYYY-MM-DD") ?? null,
          end_date: v.end_date?.format("YYYY-MM-DD") ?? null,
        });
      }}>
        <Form.Item name="name" label="Project Name" rules={[{ required: true }]}>
          <Input size="large" />
        </Form.Item>
        <Form.Item name="code" label="Project Code">
          <Input readOnly style={{ fontFamily: "monospace", cursor: "not-allowed" }} />
        </Form.Item>
        <Form.Item name="is_active" label="Status" valuePropName="checked">
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
        </Form.Item>
        <Form.Item name="business_type" label="Business Type">
          <Select showSearch placeholder="Select business type" options={toOptions(businessTypes)} filterOption={filterOpt} allowClear />
        </Form.Item>
        <Form.Item name="billing_type" label="Billing Type">
          <Select showSearch placeholder="Select billing type" options={toOptions(billingTypes)} filterOption={filterOpt} allowClear />
        </Form.Item>
        <Form.Item name="client" label="Client">
          <Select showSearch placeholder="Select client" options={toOptions(clients as Array<{ id: string; name: string }>)} filterOption={filterOpt} allowClear />
        </Form.Item>
        <Form.Item name="start_date" label="Start Date">
          <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
        </Form.Item>
        <Form.Item name="end_date" label="End Date">
          <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
        </Form.Item>
        <Form.Item name="estimated_hours" label="Estimated Hours">
          <InputNumber min={0} step={8} style={{ width: "100%" }} addonAfter="hours" />
        </Form.Item>
        <Form.Item name="budget" label="Project Budget">
          <InputNumber min={0} step={10000} style={{ width: "100%" }} prefix="₹" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <RichTextEditor placeholder="Project scope and objectives..." minHeight={140} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  });

  const { data: history = [], isLoading: histLoading } = useQuery<ProjectHistoryEntry[]>({
    queryKey: ["project-history", id],
    queryFn: () => projectsApi.history(id!),
    enabled: !!id,
  });

  const { data: billingSummary } = useQuery({
    queryKey: ["project-billing", id],
    queryFn: () => projectsApi.billingSummary(id!),
    enabled: !!id && (project?.budget ?? 0) > 0,
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project || !id) {
    return <Empty description="Project not found" />;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/projects")} style={{ marginTop: 4 }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Title level={3} style={{ margin: 0 }}>{project.name}</Title>
            <Tag style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--bms-primary)" }}>
              {project.code}
            </Tag>
            {!project.is_active && (
              <Tag icon={<StopOutlined />} color="default">Inactive</Tag>
            )}
            {project.workflow_state_name && (
              <WorkflowChip name={project.workflow_state_name} color={project.workflow_state_color} />
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Created {dayjs(project.created_at).format("DD MMM YYYY")}
            {project.client_name && ` · ${project.client_name}`}
          </Text>
        </div>
        <PermGuard permission={PERMS.PROJECT_UPDATE}>
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </PermGuard>
      </div>

      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: "overview",
            label: <Space><DashboardOutlined />Overview</Space>,
            children: (
              <ProjectOverviewTab
                project={project}
                projectId={id}
                billingSummary={billingSummary}
              />
            ),
          },
          {
            key: "tickets",
            label: <Space><IssuesCloseOutlined />Tickets</Space>,
            children: <TicketsPage projectId={id} />,
          },
          {
            key: "history",
            label: <Space><HistoryOutlined />History<Tag>{history.length}</Tag></Space>,
            children: (
              <div className="dash-panel" style={{ padding: "0 20px" }}>
                {histLoading && <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>}
                {!histLoading && history.length === 0 && (
                  <Empty description="No history yet" style={{ padding: "24px 0" }} />
                )}
                {!histLoading && history.map((entry) => (
                  <HistoryEntry key={entry.id} entry={entry} />
                ))}
              </div>
            ),
          },
        ]}
      />

      <div style={{ marginTop: 24 }}>
        <ProjectCommentsBlock
          projectId={id}
          projectName={project.name}
          projectCode={project.code}
        />
      </div>

      <EditModal
        project={project}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["project", id] });
          queryClient.invalidateQueries({ queryKey: ["project-history", id] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
        }}
      />

      <style>{`
        .rte-content ul { padding-left: 20px; margin: 4px 0; }
        .rte-content ol { padding-left: 20px; margin: 4px 0; }
        .rte-content p  { margin: 0 0 4px; }
        .project-overview__desc { font-size: 14px; line-height: 1.7; color: var(--bms-text); }
      `}</style>
    </div>
  );
}
