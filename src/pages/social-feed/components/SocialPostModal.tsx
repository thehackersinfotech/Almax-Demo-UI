import { useEffect, useMemo, useState } from "react";
import { Modal, Form, Input, Button, message, Switch, Typography, Upload } from "antd";
import {
  PictureOutlined, PaperClipOutlined, DeleteOutlined, GlobalOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import RichTextEditor from "@/components/common/RichTextEditor";
import { socialFeedApi, type SocialPostItem, type SocialPostCreate } from "@/services/socialFeed";

const { Text } = Typography;

type MediaKind = "image" | "file";

interface MediaSelection {
  file: File;
  kind: MediaKind;
  previewUrl?: string;
}

interface SocialPostModalProps {
  open: boolean;
  onClose: () => void;
  editPost?: SocialPostItem | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SocialPostModal({ open, onClose, editPost }: SocialPostModalProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [media, setMedia] = useState<MediaSelection | null>(null);
  const [contentHtml, setContentHtml] = useState("");

  const isEdit = !!editPost;

  const existingMedia = useMemo(() => {
    if (!editPost) return null;
    if (editPost.image_url) {
      return { kind: "image" as const, url: editPost.image_url, name: "Current image" };
    }
    if (editPost.attachment_url) {
      return {
        kind: "file" as const,
        url: editPost.attachment_url,
        name: editPost.attachment_name || "Current attachment",
      };
    }
    return null;
  }, [editPost]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      title: editPost?.title || "",
      is_company_wide: editPost?.is_company_wide ?? true,
    });
    setContentHtml(editPost?.content || "");
    setMedia(null);
  }, [open, editPost, form]);

  useEffect(() => {
    return () => {
      if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl);
    };
  }, [media]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["social-feed"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: SocialPostCreate) => socialFeedApi.create(data),
    onSuccess: () => {
      message.success("Post created successfully!");
      handleClose();
      refresh();
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.detail || e?.response?.data?.message || "Failed to create post");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SocialPostCreate>) => socialFeedApi.update(editPost!.id, data),
    onSuccess: () => {
      message.success("Post updated successfully!");
      handleClose();
      refresh();
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.detail || e?.response?.data?.message || "Failed to update post");
    },
  });

  const handleMediaSelect = (file: File) => {
    const kind: MediaKind = file.type.startsWith("image/") ? "image" : "file";
    const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;
    setMedia((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, kind, previewUrl };
    });
    return false;
  };

  const clearMedia = () => {
    setMedia((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const handleSubmit = (values: { title: string; is_company_wide?: boolean }) => {
    const payload: SocialPostCreate = {
      title: values.title,
      content: contentHtml,
      is_company_wide: values.is_company_wide ?? true,
      image: media?.kind === "image" ? media.file : null,
      attachment: media?.kind === "file" ? media.file : null,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleClose = () => {
    form.resetFields();
    clearMedia();
    setContentHtml("");
    onClose();
  };

  const showExisting = !media && existingMedia;
  const showNewImage = media?.kind === "image";
  const showNewFile = media?.kind === "file";

  return (
    <Modal
      title={null}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={680}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ padding: "20px 24px 8px", borderBottom: "1px solid var(--bms-border, #eef2f6)" }}>
        <Text strong style={{ fontSize: 18 }}>
          {isEdit ? "Edit Post" : "Create New Post"}
        </Text>
        <div style={{ fontSize: 12, color: "var(--bms-text-3, #94a3b8)", marginTop: 4 }}>
          Share updates with bullets, colors, and one photo or file attachment.
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ padding: "16px 24px 20px" }}
        requiredMark="optional"
      >
        <Form.Item
          name="title"
          label="Post Title"
          rules={[{ required: true, message: "Please enter a title" }]}
          style={{ marginBottom: 14 }}
        >
          <Input placeholder="What's on your mind?" size="large" style={{ borderRadius: 10 }} />
        </Form.Item>

        <Form.Item label="Description" style={{ marginBottom: 14 }}>
          <RichTextEditor
            value={contentHtml}
            onChange={setContentHtml}
            placeholder="Write your message — use bullets, bold, and colors..."
            minHeight={140}
            showColors
          />
        </Form.Item>

        <Form.Item label="Photo or Attachment" style={{ marginBottom: 14 }}>
          <Text type="secondary" style={{ display: "block", fontSize: 11, marginBottom: 8 }}>
            One file only — image (JPG, PNG, GIF) or document (PDF, DOC, etc.)
          </Text>

          {(showExisting || showNewImage || showNewFile) ? (
            <div style={{
              border: "1px solid var(--bms-border, #e5e7eb)",
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--bms-surface-2, #f8fafc)",
            }}>
              {showExisting?.kind === "image" && (
                <img
                  src={showExisting.url}
                  alt=""
                  style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }}
                />
              )}
              {showNewImage && media.previewUrl && (
                <img
                  src={media.previewUrl}
                  alt=""
                  style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }}
                />
              )}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
              }}>
                {showExisting?.kind === "file" || showNewFile ? (
                  <PaperClipOutlined style={{ fontSize: 18, color: "var(--bms-primary)" }} />
                ) : (
                  <PictureOutlined style={{ fontSize: 18, color: "var(--bms-primary)" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 13, display: "block" }} ellipsis>
                    {media?.file.name || existingMedia?.name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {media
                      ? `${media.kind === "image" ? "Image" : "File"} · ${formatFileSize(media.file.size)}`
                      : existingMedia?.kind === "image" ? "Current image" : "Current attachment"}
                  </Text>
                </div>
                {media && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={clearMedia}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {!media && (
          <Upload.Dragger
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            showUploadList={false}
            beforeUpload={handleMediaSelect}
            multiple={false}
            style={{
              marginTop: showExisting || media ? 10 : 0,
              borderRadius: 12,
              background: "var(--bms-surface, #fff)",
            }}
          >
            <div style={{ padding: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 8 }}>
                <PictureOutlined style={{ fontSize: 22, color: "var(--bms-primary)" }} />
                <PaperClipOutlined style={{ fontSize: 22, color: "var(--bms-text-3)" }} />
              </div>
              <Text style={{ fontSize: 13 }}>
                Click or drag <strong>one image</strong> or <strong>one file</strong>
              </Text>
              <div style={{ fontSize: 11, color: "var(--bms-text-3)", marginTop: 4 }}>
                JPG, PNG, GIF · PDF, DOC, XLS, PPT, ZIP
              </div>
            </div>
          </Upload.Dragger>
          )}
        </Form.Item>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingTop: 8,
          borderTop: "1px solid var(--bms-border, #eef2f6)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <GlobalOutlined style={{ color: "var(--bms-primary)" }} />
            <Text style={{ fontSize: 13 }}>Company wide</Text>
            <Form.Item name="is_company_wide" valuePropName="checked" noStyle>
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={handleClose} style={{ borderRadius: 8 }}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              style={{ borderRadius: 8, minWidth: 110 }}
            >
              {isEdit ? "Update Post" : "Create Post"}
            </Button>
          </div>
        </div>
      </Form>
    </Modal>
  );
}
