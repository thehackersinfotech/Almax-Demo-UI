import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Avatar, Typography, Button, Empty, Spin, Space, Modal, Tooltip, Pagination,
} from "antd";
import {
  TeamOutlined, PlusOutlined, HeartOutlined, CommentOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { socialFeedApi, type SocialPostItem } from "@/services/socialFeed";
import SocialPostModal from "./SocialPostModal";
import SocialPostViewModal from "./SocialPostViewModal";
import SocialPostCard from "./SocialPostCard";

import { useThemeStore } from "@/store/theme";

dayjs.extend(relativeTime);

const { Text } = Typography;

const MAX_PREVIEW = 4;

interface SocialFeedWidgetProps {
  /** Match EmployeeDashboardPage Widget card styling */
  iconColor?: string;
  bgColor?: string;
  borderColor?: string;
}

function widgetHeaderStyle(isDark: boolean, bgColor?: string, borderColor?: string) {
  return {
    hBg: isDark ? "var(--bms-surface-2)" : (bgColor ?? "var(--bms-surface-2)"),
    hBorder: isDark ? "var(--bms-border)" : (borderColor ?? "#eaecf0"),
  };
}

function PostPreviewRow({ post, onClick }: { post: SocialPostItem; onClick: () => void }) {
  const initials = post.created_by_name
    ? post.created_by_name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--bms-border)",
        background: "var(--bms-surface-2)",
        cursor: "pointer",
        textAlign: "left",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      <Avatar
        size={36}
        src={post.created_by_avatar}
        style={{ background: "#1677ff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}
      >
        {initials}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text strong style={{ fontSize: 13 }}>{post.created_by_name}</Text>
          <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>{dayjs(post.created_at).fromNow()}</Text>
        </div>
        <Text
          style={{
            fontSize: 13,
            color: "var(--bms-text)",
            display: "block",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {post.title}
        </Text>
        <Space size={12} style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <HeartOutlined /> {post.like_count}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <CommentOutlined /> {post.comment_count}
          </Text>
        </Space>
      </div>
    </button>
  );
}

export default function SocialFeedWidget({
  iconColor = "#7c3aed",
  bgColor = "#f5f3ff",
  borderColor = "#ddd6fe",
}: SocialFeedWidgetProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewAllPage, setViewAllPage] = useState(1);
  const [selectedPost, setSelectedPost] = useState<SocialPostItem | null>(null);

  const { data: previewData, isLoading } = useQuery({
    queryKey: ["social-feed", "dashboard", "preview"],
    queryFn: () => socialFeedApi.feed({ page: 1, page_size: MAX_PREVIEW }),
    staleTime: 30_000,
  });

  const { data: viewAllData, isLoading: viewAllLoading } = useQuery({
    queryKey: ["social-feed", "dashboard", "all", viewAllPage],
    queryFn: () => socialFeedApi.feed({ page: viewAllPage, page_size: 10 }),
    enabled: viewAllOpen,
    staleTime: 15_000,
  });

  const posts = previewData?.results ?? [];
  const totalCount = previewData?.count ?? 0;
  const viewAllPosts = viewAllData?.results ?? [];

  const isDark = useThemeStore((s) => s.isDark);
  const { hBg, hBorder } = widgetHeaderStyle(isDark, bgColor, borderColor);
  const previewPosts = posts;

  return (
    <>
      <Card
        size="small"
        title={(
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: iconColor }}><TeamOutlined /></span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Company Feed</span>
          </div>
        )}
        extra={(
          <Space size={4}>
            {totalCount > MAX_PREVIEW && (
              <Button type="link" size="small" onClick={() => { setViewAllPage(1); setViewAllOpen(true); }} style={{ padding: 0, fontSize: 12 }}>
                View all ({totalCount})
              </Button>
            )}
            <Tooltip title="Create post">
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} />
            </Tooltip>
          </Space>
        )}
        styles={{
          body: { padding: "14px 16px", background: "var(--bms-surface)", borderRadius: "0 0 12px 12px" },
          header: { background: hBg, borderBottom: `1px solid ${hBorder}` },
        }}
        style={{ borderRadius: 12, border: `1px solid ${hBorder}`, background: "var(--bms-surface)" }}
      >
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Spin /></div>
        ) : previewPosts.length === 0 ? (
          <Empty
            description="No posts yet — share an update with the team"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Create post
            </Button>
          </Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {previewPosts.map((post) => (
              <PostPreviewRow key={post.id} post={post} onClick={() => setSelectedPost(post)} />
            ))}
          </div>
        )}
      </Card>

      <SocialPostModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <SocialPostViewModal
        open={!!selectedPost}
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onPostUpdated={(p) => setSelectedPost(p)}
      />

      <Modal
        open={viewAllOpen}
        onCancel={() => setViewAllOpen(false)}
        footer={null}
        width={640}
        title={(
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TeamOutlined style={{ color: iconColor }} />
            <span>Company Feed</span>
          </div>
        )}
        styles={{ body: { maxHeight: "70vh", overflowY: "auto", padding: "12px 16px 16px" } }}
        destroyOnHidden
      >
        {viewAllLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Spin /></div>
        ) : viewAllPosts.length === 0 ? (
          <Empty description="No published posts" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            {viewAllPosts.map((post) => (
              <SocialPostCard
                key={post.id}
                post={post}
                compact
                onEdit={undefined}
              />
            ))}
            {(viewAllData?.count ?? 0) > 10 && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                <Pagination
                  current={viewAllPage}
                  pageSize={10}
                  total={viewAllData?.count ?? 0}
                  onChange={setViewAllPage}
                  size="small"
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
