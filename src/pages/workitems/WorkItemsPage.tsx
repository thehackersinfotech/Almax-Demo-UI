import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select, DatePicker,
  InputNumber, Typography, Card, Row, Col, Tooltip, Tabs, Badge,
} from "antd";
import { PlusOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import { workItemsApi, type WorkItem } from "@/services/workitems";
import PermGuard from "@/components/common/PermGuard";
import { PERMS } from "@/constants/permissions";

const { Title } = Typography;

const TYPE_COLORS: Record<string, string> = { TASK: "blue", BUG: "red", CR: "purple" };
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "red", HIGH: "orange", MEDIUM: "blue", LOW: "default",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "default", IN_PROGRESS: "processing", IN_REVIEW: "warning",
  DONE: "success", CLOSED: "default", REOPENED: "error",
};

export default function WorkItemsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<WorkItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["work-items", typeFilter],
    queryFn: () => workItemsApi.list({ page_size: 100, type: typeFilter === "ALL" ? undefined : typeFilter }),
  });

  const createMutation = useMutation({
    mutationFn: workItemsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-items"] }); setModalOpen(false); form.resetFields(); },
  });

  const items: WorkItem[] = (data as any)?.results ?? [];

  const tabItems = ["ALL", "TASK", "BUG", "CR"].map((t) => ({
    key: t,
    label: (
      <Space>
        {t}
        <Badge count={t === "ALL" ? items.length : items.filter((i) => i.type === t).length} style={{ backgroundColor: "#1677ff" }} />
      </Space>
    ),
  }));

  const columns = [
    {
      title: "Ticket", dataIndex: "ticket_number", key: "ticket_number", width: 120,
      render: (v: string) => <code style={{ color: "#1677ff" }}>{v}</code>,
    },
    {
      title: "Type", dataIndex: "type", key: "type", width: 80,
      render: (v: string) => <Tag color={TYPE_COLORS[v]}>{v}</Tag>,
    },
    { title: "Title", dataIndex: "title", key: "title" },
    {
      title: "Priority", dataIndex: "priority", key: "priority", width: 100,
      render: (v: string) => <Tag color={PRIORITY_COLORS[v]}>{v}</Tag>,
    },
    {
      title: "Status", dataIndex: "status", key: "status", width: 120,
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v?.replace(/_/g, " ")}</Tag>,
    },
    { title: "Assignee", dataIndex: "assignee_name", key: "assignee_name", render: (v: any) => v ?? "—" },
    { title: "Est.", dataIndex: "estimated_hours", key: "estimated_hours", render: (v: number) => `${v}h`, width: 80 },
    { title: "Logged", dataIndex: "logged_hours", key: "logged_hours", render: (v: number) => `${v ?? 0}h`, width: 80 },
    {
      title: "Actions", key: "actions", width: 100,
      render: (_: any, r: WorkItem) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailItem(r)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={3} style={{ margin: 0 }}>Work Items</Title></Col>
        <Col>
          <PermGuard permission={PERMS.PROJECT_WORKITEM_CREATE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              New Item
            </Button>
          </PermGuard>
        </Col>
      </Row>

      <Card>
        <Tabs
          items={tabItems}
          activeKey={typeFilter}
          onChange={setTypeFilter}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={typeFilter === "ALL" ? items : items.filter((i) => i.type === typeFilter)}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal title="New Work Item" open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        width={640}>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Select options={[
                  { value: "TASK", label: "Task" },
                  { value: "BUG", label: "Bug" },
                  { value: "CR", label: "Change Request" },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
                <Select options={[
                  { value: "CRITICAL", label: "Critical" },
                  { value: "HIGH", label: "High" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "LOW", label: "Low" },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="estimated_hours" label="Estimated Hours">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="Due Date">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Detail Drawer (simplified) */}
      <Modal title={detailItem?.ticket_number} open={!!detailItem}
        onCancel={() => setDetailItem(null)} footer={null} width={720}>
        {detailItem && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <p><strong>Title:</strong> {detailItem.title}</p>
            <p><strong>Type:</strong> <Tag color={TYPE_COLORS[detailItem.type]}>{detailItem.type}</Tag></p>
            <p><strong>Status:</strong> <Tag color={STATUS_COLORS[detailItem.status]}>{detailItem.status}</Tag></p>
            <p><strong>Priority:</strong> <Tag color={PRIORITY_COLORS[detailItem.priority]}>{detailItem.priority}</Tag></p>
            <p><strong>Estimated:</strong> {detailItem.estimated_hours}h | <strong>Logged:</strong> {detailItem.logged_hours ?? 0}h</p>
            <p><strong>Assignee:</strong> {detailItem.assignee_name ?? "Unassigned"}</p>
          </Space>
        )}
      </Modal>
    </div>
  );
}
