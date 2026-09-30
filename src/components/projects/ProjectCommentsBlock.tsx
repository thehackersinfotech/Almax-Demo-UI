import React, { useState } from "react";
import {
  Button, Input, Space, Typography, Avatar, Card,
  Tag, Tooltip, Popconfirm, Empty, Spin, Divider,
  Checkbox, message as antdMessage,
} from "antd";
import {
  PushpinOutlined, PushpinFilled, DeleteOutlined, EditOutlined,
  CheckCircleFilled, CheckCircleOutlined, SendOutlined,
  CommentOutlined, UserOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { projectCommentsApi, type ProjectComment } from "@/services/projectComments";
import { useAuthStore } from "@/store/auth";

dayjs.extend(relativeTime);

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

// ─── Permission helpers ──────────────────────────────────────────────────────
function useCanManageComments() {
  const user = useAuthStore((s) => s.user);
  
  const isCeo = !!(
    user?.designation?.toLowerCase().includes("ceo") ||
    user?.keycloak_group?.toLowerCase().includes("ceo")
  );
  
  const isAdmin = !!(
    user?.is_superuser ||
    user?.is_staff ||
    user?.keycloak_group?.toLowerCase().includes("admin")
  );
  
  const isPm = !!(
    user?.is_manager ||
    user?.is_pmo ||
    user?.keycloak_group?.toLowerCase().includes("pm") ||
    user?.keycloak_group?.toLowerCase().includes("manager")
  );
  
  return isCeo || isAdmin || isPm;
}

// ─── Single Comment Card ─────────────────────────────────────────────────────
function CommentCard({
  comment,
  projectId,
  canManage,
}: {
  comment: ProjectComment;
  projectId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["project-comments", projectId] });

  const updateMut = useMutation({
    mutationFn: (body: string) => projectCommentsApi.update(comment.id, body),
    onSuccess: () => { antdMessage.success("Comment updated"); setEditing(false); invalidate(); },
    onError: () => antdMessage.error("Failed to update comment"),
  });

  const deleteMut = useMutation({
    mutationFn: () => projectCommentsApi.delete(comment.id),
    onSuccess: () => { antdMessage.success("Comment deleted"); invalidate(); },
    onError: () => antdMessage.error("Failed to delete comment"),
  });

  const ackMut = useMutation({
    mutationFn: () =>
      comment.current_user_acked
        ? projectCommentsApi.unacknowledge(comment.id)
        : projectCommentsApi.acknowledge(comment.id),
    onSuccess: () => invalidate(),
    onError: () => antdMessage.error("Action failed"),
  });

  const isAuthor = comment.created_by_name === user?.full_name || comment.created_by_name === user?.username;

  return (
    <div
      style={{
        background: comment.is_pinned ? "var(--bms-primary-light)" : "var(--bms-surface)",
        border: `1px solid ${comment.is_pinned ? "var(--bms-primary)" : "var(--bms-border)"}`,
        borderRadius: 12,
        padding: "16px",
        marginBottom: 16,
        position: "relative",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Space size={8}>
          <Avatar size={32} icon={<UserOutlined />} style={{ background: "var(--bms-primary)" }} />
          <div>
            <Text strong style={{ fontSize: 13, display: "block", lineHeight: 1.2 }}>{comment.created_by_name}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {dayjs(comment.created_at).fromNow()}
            </Text>
          </div>
          {comment.is_pinned && (
            <Tag icon={<PushpinFilled />} color="blue" style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, marginLeft: 8 }}>
              Pinned Notice
            </Tag>
          )}
        </Space>

        <Space size={6}>
          {/* Acknowledge button */}
          <Tooltip title={comment.current_user_acked ? "Acknowledged (click to undo)" : "Acknowledge this comment"}>
            <Button
              type={comment.current_user_acked ? "primary" : "default"}
              size="small"
              icon={comment.current_user_acked
                ? <CheckCircleFilled />
                : <CheckCircleOutlined />
              }
              loading={ackMut.isPending}
              onClick={() => ackMut.mutate()}
              style={{
                borderRadius: 6,
                fontSize: 12,
                ...(comment.current_user_acked ? { background: "#188038", borderColor: "#188038" } : {})
              }}
            >
              {comment.current_user_acked ? "Acknowledged" : "Acknowledge"}
            </Button>
          </Tooltip>

          {/* Edit / Delete — only for authors or managers */}
          {(canManage || isAuthor) && (
            <>
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => { setEditBody(comment.body); setEditing(true); }}
                />
              </Tooltip>
              <Popconfirm
                title="Delete this comment?"
                onConfirm={() => deleteMut.mutate()}
                okText="Delete"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteMut.isPending}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      </div>

      {/* Body */}
      {editing ? (
        <div style={{ marginTop: 8 }}>
          <TextArea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            autoSize={{ minRows: 2 }}
            style={{ marginBottom: 8 }}
          />
          <Space>
            <Button
              size="small"
              type="primary"
              loading={updateMut.isPending}
              onClick={() => updateMut.mutate(editBody)}
            >
              Save
            </Button>
            <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
          </Space>
        </div>
      ) : (
        <Paragraph style={{ margin: 0, fontSize: 13.5, whiteSpace: "pre-wrap", color: "var(--bms-text)", lineHeight: 1.5 }}>
          {comment.body}
        </Paragraph>
      )}

      {/* Acknowledgements */}
      {comment.acknowledgements.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Divider style={{ margin: "10px 0 8px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Acknowledged by ({comment.acknowledgements.length})
            </Text>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {comment.acknowledgements.map((ack) => (
              <Tooltip key={ack.id} title={dayjs(ack.acknowledged_at).format("DD MMM YYYY, hh:mm A")}>
                <Tag
                  icon={<CheckCircleFilled style={{ color: "#188038", fontSize: 10 }} />}
                  style={{
                    fontSize: 11,
                    background: "rgba(24,128,56,0.06)",
                    border: "1px solid rgba(24,128,56,0.15)",
                    color: "#188038",
                    borderRadius: 20,
                    padding: "2px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {ack.acknowledged_by_name}
                </Tag>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Inline Comments Block ──────────────────────────────────────────────
interface ProjectCommentsBlockProps {
  projectId: string;
  projectName: string;
  projectCode: string;
}

export default function ProjectCommentsBlock({
  projectId,
  projectName,
  projectCode,
}: ProjectCommentsBlockProps) {
  const qc = useQueryClient();
  const canManage = useCanManageComments();
  const [newBody, setNewBody] = useState("");
  const [pinNew, setPinNew] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["project-comments", projectId],
    queryFn: () => projectCommentsApi.list(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () => projectCommentsApi.create({ project: projectId, body: newBody.trim(), is_pinned: pinNew }),
    onSuccess: () => {
      antdMessage.success("Comment posted");
      setNewBody("");
      setPinNew(false);
      qc.invalidateQueries({ queryKey: ["project-comments", projectId] });
    },
    onError: () => antdMessage.error("Failed to post comment"),
  });

  const handleSubmit = () => {
    if (!newBody.trim()) return;
    createMut.mutate();
  };

  return (
    <Card
      style={{ borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}
      styles={{
        header: { borderBottom: "1px solid var(--bms-border)", padding: "16px 20px" },
        body: { padding: "20px" }
      }}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CommentOutlined style={{ color: "var(--bms-primary)", fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>Project Notices & Comments</span>
          <span style={{
            fontSize: 11,
            color: "var(--bms-text-3)",
            fontWeight: 400,
            background: "var(--bms-surface-2)",
            padding: "2px 8px",
            borderRadius: 12,
            marginLeft: 8,
          }}>
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </span>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Comment Entry Form (for everyone) */}
        <div style={{
          background: "var(--bms-surface-2)",
          borderRadius: 12,
          padding: "16px",
          border: "1px dashed var(--bms-border)",
        }}>
          <Text strong style={{ display: "block", marginBottom: 8, fontSize: 13 }}>
            Post a new project announcement / comment:
          </Text>
          <TextArea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Post updates, announcements or requests for this project..."
            autoSize={{ minRows: 3, maxRows: 6 }}
            style={{ marginBottom: 12, borderRadius: 8 }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            {canManage ? (
              <Checkbox
                checked={pinNew}
                onChange={(e) => setPinNew(e.target.checked)}
                style={{ fontSize: 13 }}
              >
                <PushpinOutlined style={{ marginRight: 4 }} /> Pin announcement to top
              </Checkbox>
            ) : (
              <div />
            )}
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={createMut.isPending}
              disabled={!newBody.trim()}
              onClick={handleSubmit}
              style={{ borderRadius: 8 }}
            >
              Post Comment
            </Button>
          </div>
        </div>

        {/* Comment Thread List */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Spin size="large" />
          </div>
        ) : comments.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: "var(--bms-text-3)", fontSize: 13 }}>
                No comments or notices have been posted on this project yet.
              </span>
            }
            style={{ margin: "20px auto" }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {comments.map((c) => (
              <CommentCard
                key={c.id}
                comment={c}
                projectId={projectId}
                canManage={canManage}
              />
            ))}
          </div>
        )}

      </div>
    </Card>
  );
}
