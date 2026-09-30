import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Space,
  Tag,
  Typography,
  Card,
  Row,
  Col,
  Breadcrumb,
  message,
  Popconfirm,
  Tooltip,
  Empty,
  Spin,
  Badge,
} from "antd";
import {
  FolderOutlined,
  FolderOpenOutlined,
  FolderAddOutlined,
  UploadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  DownloadOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  crmFoldersApi,
  crmDocumentsApi,
  CrmFolder,
  CrmDocument,
} from "@/services/crmDocuments";
import { fetchLeads, Lead } from "@/services/leads";
import { financeApi } from "@/services/finance";
import { formatClientProject } from "@/components/common/DropdownRenderers";
import { usePermission } from "@/hooks/usePermission";
import { PERMS } from "@/constants/permissions";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface CrmSharedDocumentsManagerProps {
  /** Optional lead ID to filter or pre-select documents */
  leadId?: string;
  leadName?: string;
  /** Title displayed above the explorer */
  title?: string;
  /** Subtitle description */
  description?: string;
  /** Height or style adjustments */
  compact?: boolean;
}

export default function CrmSharedDocumentsManager({
  leadId,
  leadName,
  title = "CRM Documents & Folders",
  description = "Centralized shared document library for CRM, Lead Management, and Sales Management.",
  compact = false,
}: CrmSharedDocumentsManagerProps) {
  const qc = useQueryClient();
  const canUpdate = usePermission(PERMS.CRM_LEAD_UPDATE);
  const canDelete = usePermission(PERMS.CRM_LEAD_DELETE);

  const [selectedFolder, setSelectedFolder] = useState<CrmFolder | null>(null);
  const [search, setSearch] = useState("");
  const [selectedLeadFilter, setSelectedLeadFilter] = useState<string | undefined>(leadId);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CrmDocument | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const [selectedClientForFolder, setSelectedClientForFolder] = useState<string | undefined>();
  const [downloadingFolderId, setDownloadingFolderId] = useState<string | null>(null);

  const [folderForm] = Form.useForm();
  const [uploadForm] = Form.useForm();

  // Queries
  const { data: foldersData, isLoading: loadingFolders } = useQuery({
    queryKey: ["crm-folders"],
    queryFn: () => crmFoldersApi.list(),
  });
  const folders: CrmFolder[] = Array.isArray(foldersData)
    ? foldersData
    : (foldersData as any)?.results ?? [];

  const { data: leadsData } = useQuery({
    queryKey: ["leads-dropdown-for-docs"],
    queryFn: () => fetchLeads({ page_size: 500 }),
  });
  const leads: Lead[] = leadsData?.results ?? [];

  const { data: clients = [] } = useQuery({
    queryKey: ["finance-clients-dropdown"],
    queryFn: financeApi.clientsDropdown,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["finance-projects-dropdown", selectedClientForFolder],
    queryFn: () => financeApi.projectsDropdown(selectedClientForFolder),
  });

  const handleDownloadFolder = async (folder: CrmFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingFolderId(folder.id);
      message.loading({ content: `Preparing ZIP download for "${folder.name}"...`, key: `dl-${folder.id}` });
      await crmFoldersApi.downloadFolder(folder.id, folder.name);
      message.success({ content: `Downloaded "${folder.name}.zip"`, key: `dl-${folder.id}` });
    } catch (err: any) {
      message.error({ content: err?.message || "Failed to download folder archive", key: `dl-${folder.id}` });
    } finally {
      setDownloadingFolderId(null);
    }
  };

  const docParams = useMemo(() => {
    const p: Record<string, any> = { page_size: 500 };
    if (selectedFolder) p.folder = selectedFolder.id;
    if (selectedLeadFilter) p.lead = selectedLeadFilter;
    if (search) p.search = search;
    return p;
  }, [selectedFolder, selectedLeadFilter, search]);

  const { data: docsData, isLoading: loadingDocs } = useQuery({
    queryKey: ["crm-documents", docParams],
    queryFn: () => crmDocumentsApi.list(docParams),
  });
  const docs: CrmDocument[] = docsData?.results ?? [];

  // Mutations
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["crm-folders"] });
    qc.invalidateQueries({ queryKey: ["crm-documents"] });
    qc.invalidateQueries({ queryKey: ["lead-documents"] });
    qc.invalidateQueries({ queryKey: ["sales-documents-all"] });
  };

  const createFolderMut = useMutation({
    mutationFn: (vals: Partial<CrmFolder>) => crmFoldersApi.create(vals),
    onSuccess: (newFolder) => {
      invalidateAll();
      folderForm.resetFields();
      setCreateFolderOpen(false);
      message.success(`Folder "${newFolder.name}" created successfully`);
    },
    onError: (err: any) =>
      message.error(err?.response?.data?.detail || err?.message || "Failed to create folder"),
  });

  const deleteFolderMut = useMutation({
    mutationFn: (id: string) => crmFoldersApi.delete(id),
    onSuccess: () => {
      invalidateAll();
      if (selectedFolder) setSelectedFolder(null);
      message.success("Folder deleted");
    },
    onError: (err: any) =>
      message.error(err?.response?.data?.detail || "Failed to delete folder"),
  });

  const uploadDocMut = useMutation({
    mutationFn: (data: { file: File; title?: string; folder?: string; lead?: string }) =>
      crmDocumentsApi.upload(data),
    onSuccess: () => {
      invalidateAll();
      uploadForm.resetFields();
      setFileList([]);
      setUploadDocOpen(false);
      message.success("Document uploaded successfully");
    },
    onError: (err: any) =>
      message.error(err?.response?.data?.detail || err?.message || "Failed to upload document"),
  });

  const deleteDocMut = useMutation({
    mutationFn: (id: string) => crmDocumentsApi.delete(id),
    onSuccess: () => {
      invalidateAll();
      message.success("Document deleted");
    },
    onError: (err: any) =>
      message.error(err?.response?.data?.detail || "Failed to delete document"),
  });

  const handleCreateFolder = async () => {
    const vals = await folderForm.validateFields();
    createFolderMut.mutate(vals);
  };

  const handleUploadSubmit = async () => {
    const vals = await uploadForm.validateFields();
    if (fileList.length === 0) {
      message.error("Please select a file to upload");
      return;
    }
    const fileObj = fileList[0].originFileObj || fileList[0];
    uploadDocMut.mutate({
      file: fileObj,
      title: vals.title,
      folder: vals.folder || (selectedFolder ? selectedFolder.id : undefined),
      lead: vals.lead || leadId || undefined,
    });
  };

  const openUploadModal = (folder?: CrmFolder) => {
    uploadForm.resetFields();
    setFileList([]);
    uploadForm.setFieldsValue({
      folder: folder ? folder.id : selectedFolder ? selectedFolder.id : undefined,
      lead: leadId || undefined,
    });
    setUploadDocOpen(true);
  };

  const isPdf = (doc: CrmDocument) =>
    (doc.content_type && doc.content_type.includes("pdf")) ||
    (doc.original_name && doc.original_name.toLowerCase().endsWith(".pdf")) ||
    (doc.file_url && doc.file_url.toLowerCase().endsWith(".pdf"));

  const isImage = (doc: CrmDocument) =>
    (doc.content_type && doc.content_type.startsWith("image/")) ||
    (doc.original_name && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(doc.original_name)) ||
    (doc.file_url && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(doc.file_url));

  const getFileIcon = (doc: CrmDocument) => {
    if (isPdf(doc)) return <FilePdfOutlined style={{ color: "#ef4444", fontSize: 18 }} />;
    if (isImage(doc)) return <FileImageOutlined style={{ color: "#10b981", fontSize: 18 }} />;
    return <FileOutlined style={{ color: "#3b82f6", fontSize: 18 }} />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "—";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const columns: ColumnsType<CrmDocument> = [
    {
      title: "Document",
      key: "title",
      render: (_, r) => (
        <Space orientation="horizontal" size={10} style={{ alignItems: "center" }}>
          {getFileIcon(r)}
          <div>
            <div style={{ fontWeight: 600, color: "var(--bms-text)", fontSize: 13 }}>
              {r.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
              {r.original_name || "Document"}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Folder",
      dataIndex: "folder_name",
      key: "folder_name",
      render: (v: string, r) =>
        v ? (
          <Tag
            icon={<FolderOutlined />}
            style={{ cursor: "pointer" }}
            onClick={() => {
              const f = folders.find((item) => item.id === r.folder);
              if (f) setSelectedFolder(f);
            }}
          >
            {v}
          </Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Uncategorized</Text>
        ),
    },
    {
      title: "Related Lead / Client",
      dataIndex: "lead_name",
      key: "lead_name",
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Size",
      dataIndex: "file_size",
      key: "file_size",
      width: 100,
      render: (s: number) => <Text style={{ fontSize: 12 }}>{formatFileSize(s)}</Text>,
    },
    {
      title: "Uploaded Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 130,
      render: (d: string) => (
        <Text style={{ fontSize: 12 }}>
          {d ? new Date(d).toLocaleDateString("en-IN") : "—"}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      align: "center",
      render: (_, r) => (
        <Space size={6}>
          {r.file_url && (
            <Tooltip title="Preview / View">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => setPreviewDoc(r)}
              />
            </Tooltip>
          )}
          {r.file_url && (
            <Tooltip title="Download">
              <a href={r.file_url} download target="_blank" rel="noopener noreferrer">
                <Button size="small" icon={<DownloadOutlined />} />
              </a>
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete this document?"
              description="This will remove the file from all CRM views."
              onConfirm={() => deleteDocMut.mutate(r.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        background: "var(--bms-surface)",
        borderRadius: 12,
        padding: compact ? 16 : 24,
        border: "1px solid var(--bms-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>
            {title}
          </Title>
          {description && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {description}
            </Text>
          )}
        </div>

        <Space wrap>
          {selectedFolder && (
            <Button
              icon={<DownloadOutlined />}
              loading={downloadingFolderId === selectedFolder.id}
              onClick={() => handleDownloadFolder(selectedFolder)}
            >
              Download Folder (.zip)
            </Button>
          )}
          {canUpdate && (
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => {
                folderForm.resetFields();
                setSelectedClientForFolder(undefined);
                setCreateFolderOpen(true);
              }}
            >
              New Folder
            </Button>
          )}
          {canUpdate && (
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => openUploadModal()}
              style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
            >
              Upload Document
            </Button>
          )}
        </Space>
      </div>

      {/* Breadcrumb & Navigation Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          padding: "10px 14px",
          background: "var(--bms-surface-2)",
          borderRadius: 8,
          border: "1px solid var(--bms-border)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Space size={8} align="center">
          {selectedFolder && (
            <Button
              size="small"
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setSelectedFolder(null)}
            >
              All Folders
            </Button>
          )}
          <Breadcrumb
            items={[
              {
                title: (
                  <span
                    style={{
                      cursor: "pointer",
                      fontWeight: !selectedFolder ? 600 : 400,
                      color: !selectedFolder ? "var(--bms-primary)" : "var(--bms-text)",
                    }}
                    onClick={() => setSelectedFolder(null)}
                  >
                    <FolderOutlined /> All Folders & Files
                  </span>
                ),
              },
              ...(selectedFolder
                ? [
                    {
                      title: (
                        <span style={{ fontWeight: 600, color: "var(--bms-text)" }}>
                          <FolderOpenOutlined style={{ color: selectedFolder.color || "#4b5bca" }} />{" "}
                          {selectedFolder.name}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Space>

        {/* Search & Lead filter */}
        <Space wrap size={10}>
          {!leadId && (
            <Select
              placeholder="Filter by Lead / Client"
              allowClear
              showSearch
              value={selectedLeadFilter}
              onChange={setSelectedLeadFilter}
              style={{ width: 220 }}
              optionFilterProp="children"
            >
              {leads.map((l) => (
                <Option key={l.id} value={l.id}>
                  {formatClientProject(l.client_name, l.institution_name)}
                </Option>
              ))}
            </Select>
          )}
          <Input
            prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
            placeholder="Search documents or files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
        </Space>
      </div>

      {/* Folders Grid Section (When at Root or viewing all folders) */}
      {!selectedFolder && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text strong style={{ fontSize: 14, color: "var(--bms-text)" }}>
              Shared Folders ({folders.length})
            </Text>
          </div>

          {loadingFolders ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <Spin />
            </div>
          ) : folders.length === 0 ? (
            <Card
              size="small"
              style={{
                textAlign: "center",
                padding: "24px 0",
                background: "var(--bms-surface-2)",
                border: "1px dashed var(--bms-border)",
                borderRadius: 8,
              }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No folders created yet. Create a shared folder to organize your CRM documents."
              >
                {canUpdate && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<FolderAddOutlined />}
                    onClick={() => {
                      folderForm.resetFields();
                      setCreateFolderOpen(true);
                    }}
                    style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
                  >
                    Create First Folder
                  </Button>
                )}
              </Empty>
            </Card>
          ) : (
            <Row gutter={[14, 14]}>
              {folders.map((folder) => (
                <Col xs={24} sm={12} md={8} lg={6} key={folder.id}>
                  <div
                    onClick={() => setSelectedFolder(folder)}
                    style={{
                      background: "var(--bms-surface-2)",
                      border: "1px solid var(--bms-border)",
                      borderRadius: 10,
                      padding: "14px 16px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: 100,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#4b5bca";
                      e.currentTarget.style.boxShadow = "var(--shadow-md)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--bms-border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: folder.color ? `${folder.color}15` : "#4b5bca15",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                          color: folder.color || "#4b5bca",
                          flexShrink: 0,
                        }}
                      >
                        <FolderOutlined />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: "var(--bms-text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {folder.name}
                        </div>
                        {folder.description && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--bms-text-3)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginTop: 2,
                            }}
                          >
                            {folder.description}
                          </div>
                        )}
                        {(folder.client_name || folder.project_name || folder.lead_name) && (
                          <div style={{ marginTop: 6 }}>
                            <Tag
                              color="geekblue"
                              style={{
                                fontSize: 10,
                                margin: 0,
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "inline-block",
                              }}
                            >
                              {folder.client_name || folder.project_name
                                ? formatClientProject(folder.client_name, folder.project_name)
                                : folder.lead_name}
                            </Tag>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 12,
                        paddingTop: 8,
                        borderTop: "1px dashed var(--bms-border)",
                      }}
                    >
                      <Tag color="blue" style={{ fontSize: 10, margin: 0, borderRadius: 10 }}>
                        {folder.files_count ?? 0} {Number(folder.files_count) === 1 ? "file" : "files"}
                      </Tag>
                      <Space size={2} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Download Folder (ZIP)">
                          <Button
                            size="small"
                            type="text"
                            icon={<DownloadOutlined />}
                            loading={downloadingFolderId === folder.id}
                            onClick={(e) => handleDownloadFolder(folder, e)}
                          />
                        </Tooltip>
                        <Tooltip title="Upload into this folder">
                          <Button
                            size="small"
                            type="text"
                            icon={<UploadOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              openUploadModal(folder);
                            }}
                          />
                        </Tooltip>
                        {canDelete && (
                          <Popconfirm
                            title="Delete this folder?"
                            description="Documents inside will also be removed."
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              deleteFolderMut.mutate(folder.id);
                            }}
                            onCancel={(e) => e?.stopPropagation()}
                            okText="Delete"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              size="small"
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Popconfirm>
                        )}
                      </Space>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          )}
        </div>
      )}

      {/* Documents Table Section */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text strong style={{ fontSize: 14, color: "var(--bms-text)" }}>
            {selectedFolder
              ? `Files in "${selectedFolder.name}" (${docs.length})`
              : `All Documents & Files (${docs.length})`}
          </Text>
        </div>

        <Table<CrmDocument>
          dataSource={docs}
          columns={columns}
          rowKey="id"
          loading={loadingDocs}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          size="small"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  selectedFolder
                    ? `No documents uploaded into "${selectedFolder.name}" yet.`
                    : "No documents found."
                }
              >
                {canUpdate && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => openUploadModal(selectedFolder || undefined)}
                    style={{ background: "#4b5bca", borderColor: "#4b5bca" }}
                  >
                    Upload Document
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </div>

      {/* Create Folder Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FolderAddOutlined style={{ color: "#4b5bca" }} />
            <span>Create New Shared Folder</span>
          </div>
        }
        open={createFolderOpen}
        onCancel={() => setCreateFolderOpen(false)}
        onOk={handleCreateFolder}
        confirmLoading={createFolderMut.isPending}
        okText="Create Folder"
        destroyOnHidden
        width={520}
      >
        <Form form={folderForm} layout="vertical" style={{ paddingTop: 8 }}>
          <Form.Item
            name="name"
            label="Folder Name"
            rules={[{ required: true, message: "Folder name is required" }]}
          >
            <Input placeholder="e.g. Sales Agreements, Project Proposals, Signed SOWs" />
          </Form.Item>
          <Form.Item name="description" label="Description (Optional)">
            <Input.TextArea rows={2} placeholder="Brief folder notes or purpose..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="client" label="Client (Optional)">
                <Select
                  placeholder="Select Client..."
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  onChange={(val) => {
                    setSelectedClientForFolder(val);
                    folderForm.setFieldValue("project", undefined);
                  }}
                >
                  {clients.map((c) => {
                    const clientDisplay = c.display_name || formatClientProject(c.client_name || c.name, c.project_name);
                    return (
                      <Option key={c.id} value={c.id} label={clientDisplay}>
                        {clientDisplay}
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="project" label="Project (Optional)">
                <Select
                  placeholder="Select Project..."
                  allowClear
                  showSearch
                  optionFilterProp="label"
                >
                  {projects.map((p) => (
                    <Option key={p.id} value={p.id} label={p.name}>
                      {p.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {!leadId && (
            <Form.Item name="lead" label="Related Lead (Optional)">
              <Select
                placeholder="Select Lead..."
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {leads.map((l) => (
                  <Option key={l.id} value={l.id}>
                    {formatClientProject(l.client_name, l.institution_name)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="color" label="Folder Color Tag" initialValue="#4b5bca">
            <Select>
              <Option value="#4b5bca">Indigo Blue (#4b5bca)</Option>
              <Option value="#10b981">Emerald Green (#10b981)</Option>
              <Option value="#f59e0b">Amber Orange (#f59e0b)</Option>
              <Option value="#ef4444">Coral Red (#ef4444)</Option>
              <Option value="#8b5cf6">Purple (#8b5cf6)</Option>
              <Option value="#06b6d4">Cyan (#06b6d4)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UploadOutlined style={{ color: "#4b5bca" }} />
            <span>Upload Shared CRM Document</span>
          </div>
        }
        open={uploadDocOpen}
        onCancel={() => setUploadDocOpen(false)}
        onOk={handleUploadSubmit}
        confirmLoading={uploadDocMut.isPending}
        okText="Upload"
        destroyOnHidden
        width={540}
      >
        <Form form={uploadForm} layout="vertical" style={{ paddingTop: 8 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="folder" label="Target Folder (Optional)">
                <Select placeholder="Select a shared folder" allowClear>
                  {folders.map((f) => (
                    <Option key={f.id} value={f.id}>
                      📁 {f.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lead" label="Related Lead / Client (Optional)">
                <Select
                  placeholder="Select related lead/client"
                  showSearch
                  allowClear
                  optionFilterProp="children"
                >
                  {leads.map((l) => (
                    <Option key={l.id} value={l.id}>
                      {formatClientProject(l.client_name, l.institution_name)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="Document Title"
            rules={[{ required: true, message: "Document title is required" }]}
          >
            <Input placeholder="e.g. Master Service Agreement Signed Copy" />
          </Form.Item>

          <Form.Item label="Select File to Upload" required>
            <Upload
              beforeUpload={() => false}
              fileList={fileList}
              onChange={(info) => {
                setFileList(info.fileList);
                if (info.fileList.length > 0 && !uploadForm.getFieldValue("title")) {
                  uploadForm.setFieldValue("title", info.fileList[0].name.replace(/\.[^/.]+$/, ""));
                }
              }}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Choose File (PDF, Image, Doc)</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {previewDoc && getFileIcon(previewDoc)}
            <span>{previewDoc?.title}</span>
          </div>
        }
        open={!!previewDoc}
        onCancel={() => setPreviewDoc(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewDoc(null)}>
            Close
          </Button>,
          previewDoc?.file_url ? (
            <a
              key="download"
              href={previewDoc.file_url}
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button type="primary" icon={<DownloadOutlined />}>
                Download File
              </Button>
            </a>
          ) : null,
        ]}
        width={850}
        destroyOnHidden
      >
        {previewDoc?.file_url ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            {isImage(previewDoc) ? (
              <img
                src={previewDoc.file_url}
                alt={previewDoc.title}
                style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: 8 }}
              />
            ) : isPdf(previewDoc) ? (
              <iframe
                src={previewDoc.file_url}
                title={previewDoc.title}
                style={{ width: "100%", height: "65vh", border: "1px solid var(--bms-border)", borderRadius: 8 }}
              />
            ) : (
              <div style={{ padding: 40 }}>
                <FileOutlined style={{ fontSize: 48, color: "#3b82f6", marginBottom: 16 }} />
                <Paragraph>Preview not directly supported in browser for this file type.</Paragraph>
                <a href={previewDoc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button type="primary" icon={<DownloadOutlined />}>
                    Download to View ({previewDoc.original_name})
                  </Button>
                </a>
              </div>
            )}
          </div>
        ) : (
          <Empty description="No file URL available" />
        )}
      </Modal>
    </div>
  );
}
