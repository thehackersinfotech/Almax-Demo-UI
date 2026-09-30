import { useState, useEffect } from "react";
import { Modal, Tag, Typography, Button, Input, message } from "antd";
import {
  FireOutlined,
  HeartOutlined,
  HeartFilled,
  CommentOutlined,
  PaperClipOutlined,
  SendOutlined,
  DownloadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { socialFeedApi, SOCIAL_POST_WORKFLOW_COLORS, SOCIAL_POST_WORKFLOW_LABELS, type SocialPostItem } from "@/services/socialFeed";
import { PostContent } from "@/components/common/RichTextContent";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const { Text } = Typography;

interface SocialPostViewModalProps {
  open: boolean;
  post: SocialPostItem | null;
  onClose: () => void;
  onPostUpdated?: (post: SocialPostItem) => void;
}

export default function SocialPostViewModal({ open, post, onClose, onPostUpdated }: SocialPostViewModalProps) {
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && post?.id) {
      const fetchDetails = async () => {
        try {
          const fresh = await socialFeedApi.retrieve(post.id);
          onPostUpdated?.(fresh);
        } catch { /* silent */ }
      };
      fetchDetails();
    }
  }, [open, post?.id]);

  const refreshPost = async () => {
    if (!post) return;
    try {
      const fresh = await socialFeedApi.retrieve(post.id);
      onPostUpdated?.(fresh);
    } catch { /* silent */ }
    queryClient.invalidateQueries({ queryKey: ["social-feed"] });
  };

  const likeMutation = useMutation({
    mutationFn: (id: string) => socialFeedApi.like(id),
    onSuccess: () => refreshPost(),
  });

  const commentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      socialFeedApi.comment(id, content),
    onSuccess: () => {
      setCommentText("");
      refreshPost();
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.error || "Failed to add comment");
    },
  });

  if (!post) return null;

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FireOutlined style={{ color: "#dc2626" }} />
          <span>{post.title}</span>
          <Tag
            color={SOCIAL_POST_WORKFLOW_COLORS[post.workflow_state_slug] || "#6B7280"}
            style={{ fontSize: 10, borderRadius: 20, margin: 0, flexShrink: 0, lineHeight: "18px" }}
          >
            {post.workflow_state_name || SOCIAL_POST_WORKFLOW_LABELS[post.workflow_state_slug] || post.workflow_state_slug}
          </Tag>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={580}
    >
      <div>
        {/* Author info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: post.created_by_avatar ? "transparent" : "var(--bms-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {post.created_by_avatar ? (
              <img src={post.created_by_avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <UserOutlined />
            )}
          </div>
          <div>
            <Text strong style={{ fontSize: 13 }}>{post.created_by_name}</Text>
            <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
              {dayjs(post.created_at).fromNow()}
            </div>
          </div>
        </div>

        {/* Content */}
        {post.content && (
          <div style={{
            background: "var(--bms-surface-2)",
            border: "1px solid var(--bms-border)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 14,
          }}>
            <PostContent content={post.content} />
          </div>
        )}

        {/* Image */}
        {post.image_url && (
          <div style={{ marginBottom: 14, borderRadius: 8, overflow: "hidden", border: "1px solid var(--bms-border)" }}>
            <img
              src={post.image_url}
              alt={post.title}
              style={{ width: "100%", maxHeight: 300, objectFit: "contain", display: "block", background: "#f8f8f8" }}
            />
          </div>
        )}

        {/* Attachment */}
        {post.attachment_url && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            marginBottom: 14,
            borderRadius: 8,
            border: "1px solid var(--bms-border)",
            background: "var(--bms-surface-2)",
          }}>
            <PaperClipOutlined style={{ fontSize: 18, color: "var(--bms-primary)" }} />
            <Text style={{ flex: 1, fontSize: 13 }} ellipsis>
              {post.attachment_name || "Attachment"}
            </Text>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => window.open(post.attachment_url!, "_blank")}
              style={{ borderRadius: 6 }}
            >
              Open
            </Button>
          </div>
        )}

        {/* Like & comment stats */}
        <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 12, color: "var(--bms-text-3)" }}>
          <span>❤ {post.like_count}</span>
          <span>💬 {post.comment_count}</span>
        </div>

        {/* Like button */}
        <div style={{ borderTop: "1px solid var(--bms-border)", paddingTop: 12, marginBottom: 12 }}>
          <Button
            type="text"
            icon={post.is_liked_by_me ? <HeartFilled style={{ color: "#dc2626" }} /> : <HeartOutlined />}
            loading={likeMutation.isPending}
            onClick={() => likeMutation.mutate(post.id)}
            style={{ borderRadius: 20, fontSize: 13 }}
          >
            {post.is_liked_by_me ? "Liked" : "Like"}
          </Button>
        </div>

        {/* Comments section */}
        <div style={{ borderTop: "1px solid var(--bms-border)", paddingTop: 12 }}>
          <Text strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>
            Comments ({post.comment_count})
          </Text>

          {/* Comment input */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Input
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onPressEnter={() => {
                if (commentText.trim()) {
                  commentMutation.mutate({ id: post.id, content: commentText.trim() });
                }
              }}
              style={{ borderRadius: 20, flex: 1 }}
              suffix={
                <SendOutlined
                  style={{ color: commentText.trim() ? "var(--bms-primary)" : "var(--bms-text-3)", cursor: commentText.trim() ? "pointer" : "not-allowed" }}
                  onClick={() => {
                    if (commentText.trim()) {
                      commentMutation.mutate({ id: post.id, content: commentText.trim() });
                    }
                  }}
                />
              }
            />
          </div>

          {/* Comments list */}
          {post.comments && post.comments.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {post.comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "var(--bms-surface-2)",
                    border: "1px solid var(--bms-border)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--bms-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {(c as any).created_by_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Text strong style={{ fontSize: 11 }}>{(c as any).created_by_name || "Unknown"}</Text>
                      <Text style={{ fontSize: 10, color: "var(--bms-text-3)" }}>
                        {dayjs(c.created_at).fromNow()}
                      </Text>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--bms-text)", whiteSpace: "pre-wrap" }}>
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0", fontSize: 12, color: "var(--bms-text-3)" }}>
              No comments yet. Be the first to comment!
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
