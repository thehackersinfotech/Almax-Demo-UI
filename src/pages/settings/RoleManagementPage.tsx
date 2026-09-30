import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table, Button, Tag, Typography, Card, Row, Col, Space, Tooltip,
  Modal, Form, Input, message, Popconfirm,
} from "antd";
import {
  PlusOutlined, EyeOutlined, TeamOutlined, DeleteOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { rolesApi } from "@/services/roles";
import PermGuard from "@/components/common/PermGuard";
import { PERMS } from "@/constants/permissions";
import { apiErrorMsg } from "@/utils/apiError";

const { Title, Text } = Typography;

interface CreateRoleForm {
  name: string;
  description?: string;
}

export default function RoleManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<CreateRoleForm>();

  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
  });

  const roles = data?.results ?? [];

  const createRole = useMutation({
    mutationFn: (values: CreateRoleForm) =>
      rolesApi.create({ name: values.name.trim(), description: values.description }),
    onSuccess: (res) => {
      message.success("Role created — assign permissions next");
      setCreateOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      navigate(`/settings/roles/${res.id}`);
    },
    onError: (e: unknown) => message.error(apiErrorMsg(e, "Unable to create role")),
  });

  const deleteRole = useMutation({
    mutationFn: (roleId: string) => rolesApi.remove(roleId),
    onSuccess: () => {
      message.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e: unknown) => message.error(apiErrorMsg(e, "Unable to delete role")),
  });

  const columns = [
    {
      title: "Role Name",
      dataIndex: "name",
      key: "name",
      sorter: (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name),
      render: (name: string, record: { id: string }) => (
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 600 }}
          onClick={() => navigate(`/settings/roles/${record.id}`)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: "Users Assigned",
      dataIndex: "users_assigned",
      key: "users_assigned",
      width: 140,
      align: "center" as const,
      render: (n: number) => (
        <Space size={4}>
          <TeamOutlined style={{ color: "#8c9ab0" }} />
          <Text>{n}</Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: () => (
        <Tag color="success" style={{ borderRadius: 12, fontWeight: 600 }}>Active</Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_: unknown, record: { id: string; name: string; users_assigned: number }) => (
        <Space size={4}>
          <Tooltip title="View / manage permissions">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/settings/roles/${record.id}`)}
            />
          </Tooltip>
          <PermGuard permission={PERMS.ROLE_DELETE}>
            <Popconfirm
              title={`Delete role "${record.name}"?`}
              description="Users must be moved to another role first."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteRole.mutate(record.id)}
              disabled={record.name.toLowerCase() === "admin"}
            >
              <Tooltip
                title={
                  record.name.toLowerCase() === "admin"
                    ? "The Admin role cannot be deleted"
                    : "Delete role"
                }
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={record.name.toLowerCase() === "admin"}
                  loading={deleteRole.isPending}
                />
              </Tooltip>
            </Popconfirm>
          </PermGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Role Management</Title>
          <Text type="secondary">
            Roles map to Keycloak groups. Permissions are assigned per role.
          </Text>
        </Col>
        <Col>
          <PermGuard permission={PERMS.ROLE_CREATE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              Create New Role
            </Button>
          </PermGuard>
        </Col>
      </Row>

      <Card title={`Role List (${roles.length})`}>
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20, showTotal: (t, r) => `Showing ${r[0]}-${r[1]} of ${t}` }}
          size="middle"
        />
      </Card>

      <Modal
        title="Create New Role"
        open={createOpen}
        okText="Create"
        confirmLoading={createRole.isPending}
        onOk={() => form.submit()}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createRole.mutate(values)}
        >
          <Form.Item
            name="name"
            label="Role Name"
            rules={[
              { required: true, message: "Role name is required" },
              { max: 60, message: "Keep the name under 60 characters" },
            ]}
          >
            <Input placeholder="e.g. HR Manager" autoFocus />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="What this role is for" />
          </Form.Item>
          <Text type="secondary">
            The role is created without permissions — you will be taken to its
            detail page to assign them.
          </Text>
        </Form>
      </Modal>
    </div>
  );
}
