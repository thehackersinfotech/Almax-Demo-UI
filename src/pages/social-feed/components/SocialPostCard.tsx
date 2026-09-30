import { useState } from "react";
import { Card, Avatar, Typography, Button, Tag, Space, Tooltip, Input, message, Image } from "antd";
import {
  HeartOutlined, HeartFilled, CommentOutlined, SendOutlined,
  UploadOutlined, FileOutlined, DeleteOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { socialFeedApi, type SocialPostItem, SOCIAL_POST_WORKFLOW_COLORS, SOCIAL_POST_WORKFLOW_LABELS } from "@/services/socialFeed";
import { PostContent } from "@/components/common/RichTextContent";
import { useAuthStore } from "@/store/auth";

dayjs.extend(relativeTime);

const { Text } = Typography;

interface SocialPostCardProps {
  post: SocialPostItem;
  showActions?: boolean;
  onEdit?: (post: SocialPostItem) => void;
  compact?: boolean;
}

export default function SocialPostCard({ post, showActions = true, onEdit, compact = false }: SocialPostCardProps) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const permissions = useAuthStore((s) => s.permissions);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["social-feed"] });
  };

  const likeMutation = useMutation({
    mutationFn: () => socialFeedApi.like(post.id),
    onSuccess: (data) => {
      post.like_count = data.like_count;
      post.is_liked_by_me = data.liked;
      refresh();
    },
    onError: () => message.error("Failed to toggle like"),
  });

  const commentMutation = useMutation({
    mutationFn: () => socialFeedApi.comment(post.id, commentText),
    onSuccess: () => {
      setCommentText("");
      setCommentOpen(false);
      post.comment_count += 1;
      refresh();
      message.success("Comment added");
    },
    onError: () => message.error("Failed to add comment"),
  });

  const isOwner = post.created_by_id === currentUserId;
  const hasManagePerm = permissions.includes("bms.social_feed.manage" as never);

  const stateColor = SOCIAL_POST_WORKFLOW_COLORS[post.workflow_state_slug] || "#6B7280";
  const stateLabel = SOCIAL_POST_WORKFLOW_LABELS[post.workflow_state_slug] || post.workflow_state_name;

  const initials = post.created_by_name
    ? post.created_by_name.split(/\s+/).map((s: string) => s[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  return (
    <Card
      style={{
        borderRadius: 12,
        border: "1px solid var(--bms-border)",
        background: "var(--bms-surface)",
        marginBottom: 16,
      }}
      styles={{
        body: { padding: compact ? "14px 16px" : "18px 20px" },
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <Avatar
          size={compact ? 36 : 42}
          src={post.created_by_avatar}
          style={{
            background: "#1677ff",
            fontSize: compact ? 13 : 14,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text strong style={{ fontSize: compact ? 13 : 14 }}>
              {post.created_by_name}
            </Text>
            <Tag color={stateColor} style={{ fontSize: 10, borderRadius: 20, margin: 0, lineHeight: "18px" }}>
              {stateLabel}
            </Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {dayjs(post.created_at).fromNow()}
          </Text>
        </div>
        {showActions && isOwner && (
          <Space size={4}>
            {onEdit && post.workflow_state_slug !== "published" && (
              <Tooltip title="Edit">
                <Button type="text" size="small" icon={<FileOutlined />} onClick={() => onEdit(post)} />
              </Tooltip>
            )}
          </Space>
        )}
      </div>

      {/* Title & Content */}
      <div style={{ marginBottom: 10 }}>
        <Text strong style={{ fontSize: compact ? 14 : 16, display: "block", marginBottom: 6 }}>
          {post.title}
        </Text>
        {post.content && (
          <PostContent content={post.content} style={{ fontSize: compact ? 13 : 14, color: "var(--bms-text-2)" }} />
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <div style={{ marginBottom: 12, borderRadius: 8, overflow: "hidden" }}>
          <Image
            src={post.image_url}
            alt={post.title}
            style={{ maxWidth: "100%", maxHeight: 400, objectFit: "cover", borderRadius: 8 }}
            preview={{ mask: "View image" }}
          />
        </div>
      )}

      {/* Attachment */}
      {post.attachment_url && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "var(--bms-surface-2)",
            borderRadius: 8,
            border: "1px solid var(--bms-border)",
            marginBottom: 12,
          }}
        >
          <UploadOutlined style={{ color: "#1677ff" }} />
          <a href={post.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, flex: 1 }}>
            {post.attachment_name || "View attachment"}
          </a>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              paddingTop: 10,
              borderTop: "1px solid var(--bms-border)",
            }}
          >
            <Tooltip title={post.is_liked_by_me ? "Unlike" : "Like"}>
              <Button
                type="text"
                size="small"
                icon={post.is_liked_by_me ? <HeartFilled style={{ color: "#dc2626" }} /> : <HeartOutlined />}
                onClick={() => likeMutation.mutate()}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
              >
                <span>{post.like_count}</span>
              </Button>
            </Tooltip>
            <Tooltip title="Comment">
              <Button
                type="text"
                size="small"
                icon={<CommentOutlined />}
                onClick={() => setCommentOpen(!commentOpen)}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
              >
                <span>{post.comment_count}</span>
              </Button>
            </Tooltip>
          </div>

          {/* Comment input */}
          {commentOpen && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Input.TextArea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                style={{ fontSize: 13, borderRadius: 8 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={commentMutation.isPending}
                disabled={!commentText.trim()}
                onClick={() => commentMutation.mutate()}
                style={{ borderRadius: 8, alignSelf: "flex-end" }}
              />
            </div>
          )}

          {/* Comments preview */}
          {post.comments && post.comments.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {post.comments.slice(0, 3).map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Avatar size={24} style={{ background: "#6b7280", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                    {c.created_by_name?.split(/\s+/).map((s: string) => s[0]).join("").slice(0, 2).toUpperCase() || "?"}
                  </Avatar>
                  <div>
                    <Text strong style={{ fontSize: 12 }}>{c.created_by_name}</Text>
                    <Text style={{ fontSize: 12, color: "var(--bms-text-2)", marginLeft: 6 }}>
                      {c.content}
                    </Text>
                  </div>
                </div>
              ))}
              {post.comment_count > 3 && (
                <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}>
                  View all {post.comment_count} comments
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
