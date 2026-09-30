import React, { useState } from "react";
import {
  Drawer, Button, Input, Space, Typography, Avatar,
  Tag, Tooltip, Popconfirm, Empty, Spin, Badge, Divider,
  message as antdMessage,
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

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── Permission helpers ──────────────────────────────────────────────────────
function useCanComment() {
  const user = useAuthStore((s) => s.user);
  // CEO, admin, or project manager can post comments
  return !!(user?.is_pmo || user?.is_manager || user?.is_superuser);
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
        background: comment.is_pinned ? "var(--bms-primary-light)" : "var(--bms-surface-2)",
        border: `1px solid ${comment.is_pinned ? "var(--bms-primary)" : "var(--bms-border)"}`,
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 12,
        position: "relative",
        transition: "box-shadow 0.2s",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Space size={8}>
          <Avatar size={28} icon={<UserOutlined />} style={{ background: "var(--bms-primary)" }} />
          <div>
            <Text strong style={{ fontSize: 13 }}>{comment.created_by_name}</Text>
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
              {dayjs(comment.created_at).fromNow()}
            </Text>
          </div>
          {comment.is_pinned && (
            <Tag icon={<PushpinFilled />} color="blue" style={{ fontSize: 10, padding: "0 5px" }}>
              Pinned
            </Tag>
          )}
        </Space>

        <Space size={4}>
          {/* Acknowledge button — for non-managers (employees) */}
          {!canManage && (
            <Tooltip title={comment.current_user_acked ? "Acknowledged (click to undo)" : "Acknowledge this comment"}>
              <Button
                type="text"
                size="small"
                icon={comment.current_user_acked
                  ? <CheckCircleFilled style={{ color: "#188038", fontSize: 16 }} />
                  : <CheckCircleOutlined style={{ color: "#9ca3af", fontSize: 16 }} />
                }
                loading={ackMut.isPending}
                onClick={() => ackMut.mutate()}
                style={{ padding: "0 4px" }}
              />
            </Tooltip>
          )}

          {/* Managers can also acknowledge */}
          {canManage && (
            <Tooltip title={comment.current_user_acked ? "Acknowledged (click to undo)" : "Acknowledge"}>
              <Button
                type="text"
                size="small"
                icon={comment.current_user_acked
                  ? <CheckCircleFilled style={{ color: "#188038", fontSize: 14 }} />
                  : <CheckCircleOutlined style={{ color: "#9ca3af", fontSize: 14 }} />
                }
                loading={ackMut.isPending}
                onClick={() => ackMut.mutate()}
                style={{ padding: "0 4px" }}
              />
            </Tooltip>
          )}

          {/* Edit / Delete — only for authors or managers */}
          {(canManage || isAuthor) && (
            <>
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ fontSize: 13 }} />}
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
                    icon={<DeleteOutlined style={{ fontSize: 13 }} />}
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
        <div>
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
        <Paragraph style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>
          {comment.body}
        </Paragraph>
      )}

      {/* Acknowledgements */}
      {comment.acknowledgements.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Divider style={{ margin: "8px 0" }} />
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Acknowledged by
          </Text>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {comment.acknowledgements.map((ack) => (
              <Tooltip key={ack.id} title={dayjs(ack.acknowledged_at).format("DD MMM YYYY HH:mm")}>
                <Tag
                  icon={<CheckCircleFilled style={{ color: "#188038" }} />}
                  style={{
                    fontSize: 11,
                    background: "rgba(24,128,56,0.08)",
                    border: "1px solid rgba(24,128,56,0.2)",
                    color: "#188038",
                    borderRadius: 20,
                    padding: "1px 8px",
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

// ─── Main Drawer ─────────────────────────────────────────────────────────────
interface ProjectCommentsDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  projectCode: string;
}

export default function ProjectCommentsDrawer({
  open,
  onClose,
  projectId,
  projectName,
  projectCode,
}: ProjectCommentsDrawerProps) {
  const qc = useQueryClient();
  const canComment = useCanComment();
  const [newBody, setNewBody] = useState("");
  const [pinNew, setPinNew] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["project-comments", projectId],
    queryFn: () => projectCommentsApi.list(projectId),
    enabled: open && !!projectId,
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

  const pendingAcks = comments.filter((c) => !c.current_user_acked).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CommentOutlined style={{ color: "var(--bms-primary)", fontSize: 18 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              Project Comments
            </div>
            <div style={{ fontSize: 11, color: "var(--bms-text-2)", fontWeight: 400 }}>
              <code style={{ color: "var(--bms-primary)", background: "var(--bms-primary-light)", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>
                {projectCode}
              </code>
              {" "}{projectName}
            </div>
          </div>
          {pendingAcks > 0 && (
            <Badge count={pendingAcks} style={{ marginLeft: "auto" }} title={`${pendingAcks} unacknowledged`} />
          )}
        </div>
      }
      width={480}
      styles={{
        body: { padding: "16px", display: "flex", flexDirection: "column", height: "100%" },
      }}
      footer={
        canComment ? (
          <div style={{ padding: "12px 0 0" }}>
            <TextArea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Write a comment for the team…"
              autoSize={{ minRows: 3, maxRows: 6 }}
              style={{ marginBottom: 8 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Tooltip title={pinNew ? "Unpin" : "Pin to top"}>
                <Button
                  type="text"
                  size="small"
                  icon={pinNew ? <PushpinFilled style={{ color: "var(--bms-primary)" }} /> : <PushpinOutlined />}
                  onClick={() => setPinNew((v) => !v)}
                >
                  {pinNew ? "Pinned" : "Pin"}
                </Button>
              </Tooltip>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={createMut.isPending}
                disabled={!newBody.trim()}
                onClick={handleSubmit}
              >
                Post Comment
              </Button>
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>Ctrl+Enter to post</Text>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : comments.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              No comments yet.
              {canComment ? " Add the first comment below." : " No comments from your manager yet."}
            </span>
          }
          style={{ margin: "40px auto" }}
        />
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              projectId={projectId}
              canManage={canComment}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}
