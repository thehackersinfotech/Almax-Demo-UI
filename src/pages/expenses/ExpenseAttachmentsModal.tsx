import React from "react";
import { Modal, Upload, Button, List, message, Tooltip } from "antd";
import { UploadOutlined, DeleteOutlined, PaperClipOutlined, DownloadOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expenseApi } from "@/services/expenses";

interface Props {
  open: boolean;
  expenseId: string | null;
  onClose: () => void;
}

export default function ExpenseAttachmentsModal({ open, expenseId, onClose }: Props) {
  const qc = useQueryClient();

  const { data: expenseDetail, isLoading } = useQuery({
    queryKey: ["expense", expenseId],
    queryFn: () => expenseApi.retrieve(expenseId!),
    enabled: !!expenseId && open,
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return expenseApi.uploadAttachment(expenseId!, formData);
    },
    onSuccess: () => {
      message.success("Attachment uploaded");
      qc.invalidateQueries({ queryKey: ["expense", expenseId] });
    },
    onError: () => message.error("Failed to upload attachment"),
  });

  const deleteMut = useMutation({
    mutationFn: (attachmentId: string) => expenseApi.deleteAttachment(expenseId!, attachmentId),
    onSuccess: () => {
      message.success("Attachment deleted");
      qc.invalidateQueries({ queryKey: ["expense", expenseId] });
    },
    onError: () => message.error("Failed to delete attachment"),
  });

  const attachments = expenseDetail?.attachments || [];

  return (
    <Modal
      open={open}
      title={<><PaperClipOutlined style={{ marginRight: 8 }} />Attachments</>}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <Upload
        beforeUpload={(file) => {
          const isLt10M = file.size / 1024 / 1024 < 10;
          if (!isLt10M) {
            message.error("File must be smaller than 10MB");
            return Upload.LIST_IGNORE;
          }
          uploadMut.mutate(file);
          return false;
        }}
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />} loading={uploadMut.isPending} style={{ marginBottom: 16 }}>
          Upload New Attachment
        </Button>
      </Upload>

      <List
        loading={isLoading}
        dataSource={attachments}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Tooltip title="Download" key="download">
                <Button type="text" icon={<DownloadOutlined />} href={item.file} target="_blank" />
              </Tooltip>,
              <Tooltip title="Delete" key="delete">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => deleteMut.mutate(item.id)}
                  loading={deleteMut.isPending}
                />
              </Tooltip>,
            ]}
          >
            <List.Item.Meta
              title={
                <a href={item.file} target="_blank" rel="noreferrer">
                  {item.original_name}
                </a>
              }
              description={`${(item.file_size / 1024).toFixed(1)} KB • Uploaded by ${item.uploaded_by_name || "Unknown"}`}
            />
          </List.Item>
        )}
      />
    </Modal>
  );
}
