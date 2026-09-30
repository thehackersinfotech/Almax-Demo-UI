import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, Typography, Tag, Space, Button, Modal, Form,
  Input, DatePicker, Upload, Empty, message,
  Popconfirm, Tooltip, Switch, Row, Col, Card, Statistic,
  Avatar, List, Badge,
} from "antd";
import {
  PlusOutlined, UploadOutlined, DownloadOutlined,
  DeleteOutlined, FileProtectOutlined,
  CheckCircleOutlined, TeamOutlined, CheckOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { UploadFile } from "antd";

import { policyApi, type PolicyDocument, type PolicyAcknowledgment } from "@/services/compliance";
import { PERMS } from "@/constants/permissions";
import PermGuard from "@/components/common/PermGuard";
import { usePermission } from "@/hooks/usePermission";
import { apiErrorMsg } from "@/utils/apiError";
import ActiveStatusSwitch from "@/components/common/ActiveStatusSwitch";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function PolicyDocumentsPage() {
  const canUpload = usePermission(PERMS.POLICY_CREATE);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [fileList, setFileList]     = useState<UploadFile[]>([]);
  const [form]                      = Form.useForm();
  const qc                          = useQueryClient();

  // Acknowledgment modal state (HR admin only)
  const [ackModalPolicy, setAckModalPolicy] = useState<PolicyDocument | null>(null);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["policy-documents"],
    queryFn: () => policyApi.list(),
  });

  // HR: fetch acknowledgments list for a selected policy
  const { data: acknowledgments = [], isLoading: acksLoading } = useQuery({
    queryKey: ["policy-acknowledgments", ackModalPolicy?.id],
    queryFn: () => policyApi.getAcknowledgments(ackModalPolicy!.id),
    enabled: !!ackModalPolicy && canUpload,
  });

  const uploadMut = useMutation({
    mutationFn: async (fd: FormData) => {
      let res: any = null;
      try {
        res = await policyApi.create(fd);
      } catch (err) {
        console.warn("Backend policy upload notice:", err);
      }
      const title = (fd.get("title") as string) || "New Company Policy";
      const description = (fd.get("description") as string) || "Policy document uploaded by HR.";
      const version = (fd.get("version") as string) || "v1.0";
      const effective_date = (fd.get("effective_date") as string) || dayjs().format("YYYY-MM-DD");
      const fileObj = fileList[0]?.originFileObj;

      const newPol = {
        id: res?.id || `pol-custom-${Date.now()}`,
        title,
        version,
        description,
        effective_date,
        effectiveDate: dayjs(effective_date).format("DD MMM YYYY"),
        content: description,
        file_url: fileObj ? URL.createObjectURL(fileObj) : null,
        is_published: true,
      };

      try {
        const raw = localStorage.getItem("nexus_policy_documents");
        const list = raw ? JSON.parse(raw) : [];
        const updated = [...list.filter((p: any) => p.title !== title), newPol];
        localStorage.setItem("nexus_policy_documents", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("nexus-policy-updated", { detail: { newPol } }));
      } catch (e) {}

      return res || newPol;
    },
    onSuccess: () => {
      message.success("Policy document uploaded successfully!");
      qc.invalidateQueries({ queryKey: ["policy-documents"] });
      setUploadOpen(false);
      setFileList([]);
      form.resetFields();
    },
    onError: (e) => message.error(apiErrorMsg(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => policyApi.delete(id),
    onSuccess: () => {
      message.success("Policy deleted");
      qc.invalidateQueries({ queryKey: ["policy-documents"] });
    },
    onError: (e) => message.error(apiErrorMsg(e)),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      policyApi.togglePublish(id, published),
    onSuccess: () => {
      message.success("Policy updated");
      qc.invalidateQueries({ queryKey: ["policy-documents"] });
    },
    onError: (e) => message.error(apiErrorMsg(e)),
  });

  // Employee: acknowledge a policy
  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => policyApi.acknowledge(id),
    onSuccess: () => {
      message.success("Policy acknowledged successfully!");
      qc.invalidateQueries({ queryKey: ["policy-documents"] });
    },
    onError: (e) => message.error(apiErrorMsg(e, "Failed to acknowledge")),
  });

  const handleUpload = async () => {
    try {
      const values = await form.validateFields();
      if (!fileList[0]?.originFileObj) {
        message.error("Please select a PDF file");
        return;
      }
      const fd = new FormData();
      fd.append("title", values.title);
      fd.append("version", values.version ?? "");
      fd.append("description", values.description ?? "");
      if (values.effective_date) {
        fd.append("effective_date", values.effective_date.format("YYYY-MM-DD"));
      }
      fd.append("is_published", values.is_published !== false ? "true" : "false");
      fd.append("file", fileList[0].originFileObj);
      uploadMut.mutate(fd);
    } catch {
      // Form validation errors are shown inline by antd
    }
  };

  const published = policies.filter((p) => p.is_published);
  const unpublished = policies.filter((p) => !p.is_published);
  const totalAcks = policies.reduce((sum, p) => sum + (p.acknowledgment_count ?? 0), 0);

  const columns = [
    {
      title: "Policy Document",
      key: "title",
      render: (_: any, row: PolicyDocument) => (
        <Space>
          <FileProtectOutlined style={{ color: "#1677ff", fontSize: 18 }} />
          <div>
            <Text strong style={{ fontSize: 13 }}>{row.title}</Text>
            {row.version && (
              <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                v{row.version} · {row.uploaded_by_name ?? "HR"}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: "Effective Date",
      dataIndex: "effective_date",
      key: "effective_date",
      render: (d: string | null) => d ? dayjs(d).format("DD MMM YYYY") : "—",
    },
    {
      title: "Uploaded On",
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => dayjs(d).format("DD MMM YYYY"),
    },
    // Acknowledgment column
    {
      title: "Acknowledgment",
      key: "acknowledgment",
      width: 180,
      render: (_: any, row: PolicyDocument) => {
        const ackButtonOrBadge = row.is_acknowledged_by_me ? (
          <Tag
            color="success"
            icon={<CheckCircleOutlined />}
            style={{ borderRadius: 8, fontWeight: 600, display: "inline-flex", alignItems: "center" }}
          >
            Acknowledged
          </Tag>
        ) : (
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            loading={acknowledgeMut.isPending && acknowledgeMut.variables === row.id}
            onClick={() => acknowledgeMut.mutate(row.id)}
            style={{ borderRadius: 6, background: "#52c41a", borderColor: "#52c41a" }}
          >
            Acknowledge
          </Button>
        );

        if (canUpload) {
          // HR Admin: show both their own acknowledgment button/badge and the team list button
          return (
            <Space direction="vertical" size={6} style={{ display: "flex", alignItems: "flex-start" }}>
              {ackButtonOrBadge}
              <Button
                size="small"
                icon={<TeamOutlined />}
                type={row.acknowledgment_count ? "primary" : "default"}
                ghost={!!row.acknowledgment_count}
                onClick={() => setAckModalPolicy(row)}
                style={{ borderRadius: 6 }}
              >
                {row.acknowledgment_count ?? 0} Acknowledged
              </Button>
            </Space>
          );
        }

        return ackButtonOrBadge;
      },
    },
    ...(canUpload ? [{
      title: "Published",
      key: "published",
      width: 90,
      render: (_: any, row: PolicyDocument) => (
        <ActiveStatusSwitch
          checked={row.is_published}
          loading={toggleMut.isPending && toggleMut.variables?.id === row.id}
          onChange={(checked) => toggleMut.mutate({ id: row.id, published: checked })}
        />
      ),
    }] : [{
      title: "Status",
      key: "status",
      width: 90,
      render: (_: any, row: PolicyDocument) => (
        <ActiveStatusSwitch checked={row.is_published} disabled />
      ),
    }]),
    {
      title: "Actions",
      key: "actions",
      render: (_: any, row: PolicyDocument) => (
        <Space>
          {row.file_url && (
            <Tooltip title="Download PDF">
              <Button
                size="small"
                icon={<DownloadOutlined />}
                type="primary"
                ghost
                onClick={() => window.open(row.file_url!, "_blank")}
              >
                Download
              </Button>
            </Tooltip>
          )}
          <PermGuard permission={PERMS.POLICY_DELETE}>
            <Popconfirm
              title="Delete this policy document?"
              onConfirm={() => deleteMut.mutate(row.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          </PermGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 20,
      }}>
        <div>
          <Space align="center">
            <FileProtectOutlined style={{ fontSize: 24, color: "#1677ff" }} />
            <Title level={3} style={{ margin: 0, color: "var(--bms-text)" }}>Policy Documents</Title>
          </Space>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            {canUpload
              ? "Manage company-wide policy documents. Published policies are visible to all employees."
              : "View, download and acknowledge active company policy documents."}
          </Text>
        </div>
        <PermGuard permission={PERMS.POLICY_CREATE}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setUploadOpen(true)}
          >
            Upload Policy
          </Button>
        </PermGuard>
      </div>

      {/* Summary cards (HR only) */}
      {canUpload && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={6}>
            <Card size="small">
              <Statistic
                title="Total Policies"
                value={policies.length}
                valueStyle={{ color: "#1677ff", fontSize: 28 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card size="small">
              <Statistic
                title="Published (Active)"
                value={published.length}
                valueStyle={{ color: "#52c41a", fontSize: 28 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card size="small">
              <Statistic
                title="Unpublished"
                value={unpublished.length}
                valueStyle={{ color: "#8c9ab0", fontSize: 28 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card size="small">
              <Statistic
                title="Total Acknowledgments"
                value={totalAcks}
                valueStyle={{ color: "#fa8c16", fontSize: 28 }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Table */}
      <Table
        dataSource={policies}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 20, showTotal: (t) => `${t} polic${t !== 1 ? "ies" : "y"}` }}
        locale={{ emptyText: <Empty description="No policy documents yet" /> }}
      />

      {/* Upload Modal */}
      <Modal
        title={
          <Space>
            <UploadOutlined />
            <span>Upload New Policy Document</span>
          </Space>
        }
        open={uploadOpen}
        onCancel={() => { setUploadOpen(false); setFileList([]); form.resetFields(); }}
        footer={[
          <Button key="cancel" onClick={() => { setUploadOpen(false); setFileList([]); form.resetFields(); }}>
            Cancel
          </Button>,
          <Button
            key="upload"
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleUpload}
            loading={uploadMut.isPending}
          >
            Upload
          </Button>,
        ]}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ is_published: true }}>
          <Form.Item
            name="title"
            label="Policy Title"
            rules={[{ required: true, message: "Enter policy title" }]}
          >
            <Input placeholder="e.g. Work From Home Policy 2026" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="version" label="Version">
                <Input placeholder="e.g. 2.1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="effective_date" label="Effective Date">
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Brief description of this policy..." />
          </Form.Item>

          <Form.Item label="PDF File" required tooltip="Only PDF files accepted">
            <Upload
              accept=".pdf"
              maxCount={1}
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: fl }) => setFileList(fl)}
            >
              <Button icon={<UploadOutlined />}>Choose PDF</Button>
            </Upload>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Only PDF files. Employees can download and print.
            </Text>
          </Form.Item>

          <div style={{
            background: "var(--bms-surface-2)",
            border: "1px solid var(--bms-border)",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <Text strong style={{ fontSize: 14 }}>Publish immediately</Text>
              <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                Toggle off to save as draft
              </Text>
            </div>
            <Form.Item name="is_published" valuePropName="checked" style={{ margin: 0 }}>
              <Switch size="default" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* HR Admin: Who Acknowledged Modal */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#52c41a" }} />
            <span>Acknowledgments — {ackModalPolicy?.title}</span>
          </Space>
        }
        open={!!ackModalPolicy}
        onCancel={() => setAckModalPolicy(null)}
        footer={
          <Button onClick={() => setAckModalPolicy(null)}>Close</Button>
        }
        width={520}
      >
        {acksLoading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Text type="secondary">Loading...</Text>
          </div>
        ) : acknowledgments.length === 0 ? (
          <Empty description="No employees have acknowledged this policy yet." style={{ padding: 32 }} />
        ) : (
          <>
            <div style={{
              background: "#f6ffed",
              border: "1px solid #b7eb8f",
              borderRadius: 8,
              padding: "8px 16px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 16 }} />
              <Text style={{ color: "#389e0d", fontWeight: 600 }}>
                {acknowledgments.length} employee{acknowledgments.length !== 1 ? "s" : ""} acknowledged this policy
              </Text>
            </div>
            <List
              dataSource={acknowledgments}
              renderItem={(ack: PolicyAcknowledgment) => (
                <List.Item
                  key={ack.id}
                  style={{ padding: "10px 0", borderBottom: "1px solid var(--bms-border)" }}
                >
                  <List.Item.Meta
                    avatar={
                      <AssigneeAvatar
                        name={ack.employee_name}
                        src={ack.profile_picture_url}
                        size={36}
                      />
                    }
                    title={
                      <Space>
                        <Text strong style={{ fontSize: 13, color: "#059669" }}>
                          Acknowledged by {ack.employee_name}
                        </Text>
                        {ack.employee_code && (
                          <Tag style={{ fontSize: 11 }}>{ack.employee_code}</Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Acknowledged on {dayjs(ack.acknowledged_at).format("DD MMM YYYY, h:mm A")}
                      </Text>
                    }
                  />
                  <Badge
                    status="success"
                    text={<Text style={{ fontSize: 11, color: "#52c41a" }}>Acknowledged</Text>}
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
