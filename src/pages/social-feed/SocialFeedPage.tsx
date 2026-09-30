import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Typography, Button, Tabs, Empty, Spin, message, Space, Pagination,
  App,
} from "antd";
import {
  PlusOutlined, TeamOutlined, UserOutlined, CheckCircleOutlined,
  CloseCircleOutlined, SendOutlined,
} from "@ant-design/icons";
import { socialFeedApi, type SocialPostItem, SOCIAL_POST_WORKFLOW_LABELS, SOCIAL_POST_WORKFLOW_COLORS } from "@/services/socialFeed";
import SocialPostCard from "./components/SocialPostCard";
import SocialPostModal from "./components/SocialPostModal";
import { useAuthStore } from "@/store/auth";

const { Title, Text } = Typography;

const TRANSITION_ACTIONS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  submit_for_approval: { label: "Submit for Approval", icon: <SendOutlined />, color: "#F59E0B" },
  approve: { label: "Approve", icon: <CheckCircleOutlined />, color: "#10B981" },
  reject: { label: "Reject", icon: <CloseCircleOutlined />, color: "#EF4444" },
  publish: { label: "Publish", icon: <CheckCircleOutlined />, color: "#3B82F6" },
  unpublish: { label: "Unpublish", icon: <CloseCircleOutlined />, color: "#6B7280" },
  revise: { label: "Revise & Resubmit", icon: <SendOutlined />, color: "#F59E0B" },
  publish_directly: { label: "Publish Directly", icon: <SendOutlined />, color: "#3B82F6" },
  approve_and_publish: { label: "Approve & Publish", icon: <CheckCircleOutlined />, color: "#10B981" },
};

const WORKFLOW_ACTION_MAP: Record<string, string> = {
  pending_approval: "submit_for_approval",
  approved: "approve",
  rejected: "reject",
  published: "publish",
  unpublish: "unpublish",
  draft: "revise",
  publish_directly: "publish_directly",
  approve_and_publish: "approve_and_publish",
};

function getActionForSlug(slug: string) {
  return TRANSITION_ACTIONS[slug] || { label: slug, icon: null, color: "#6B7280" };
}

export default function SocialFeedPage() {
  const navigate = useNavigate();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editPost, setEditPost] = useState<SocialPostItem | null>(null);
  const [activeTab, setActiveTab] = useState("feed");
  const [feedPage, setFeedPage] = useState(1);
  const permissions = useAuthStore((s) => s.permissions);

  const hasManage = permissions.includes("bms.social_feed.manage" as never);
  const hasCreate = permissions.includes("bms.social_feed.create" as never);

  // ── Published feed ─────────────────────────────────────────────────────────
  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ["social-feed", "feed", feedPage],
    queryFn: () => socialFeedApi.feed({ page: feedPage, page_size: 10 }),
    staleTime: 10_000,
  });
  const feedPosts = feedData?.results;

  // ── My posts ───────────────────────────────────────────────────────────────
  const { data: myPosts, isLoading: myPostsLoading } = useQuery({
    queryKey: ["social-feed", "my-posts"],
    queryFn: () => socialFeedApi.myPosts(),
    staleTime: 10_000,
    enabled: hasCreate,
  });

  // ── All posts (manage view) ────────────────────────────────────────────────
  const { data: allPosts, isLoading: allLoading } = useQuery({
    queryKey: ["social-feed", "all"],
    queryFn: () => socialFeedApi.list(),
    staleTime: 10_000,
    enabled: hasManage,
  });

  // ── Transition mutation ────────────────────────────────────────────────────
  const transitionMutation = useMutation({
    mutationFn: ({ postId, destination }: { postId: string; destination: string }) =>
      socialFeedApi.transition(postId, destination),
    onSuccess: () => {
      message.success("Status updated!");
      // Invalidate all queries
    },
    onError: (e: any) => message.error(e?.response?.data?.error || "Failed to update status"),
  });

  const handleTransition = (postId: string, slug: string) => {
    transitionMutation.mutate({ postId, destination: slug });
  };

  const renderPostWithActions = (post: SocialPostItem) => {
    const allowedSlugs = post.allowed_destination_slugs || [];
    return (
      <div key={post.id} style={{ position: "relative" }}>
        <SocialPostCard
          post={post}
          onEdit={(p) => setEditPost(p)}
        />
        {allowedSlugs.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: -12,
              marginBottom: 16,
              paddingLeft: 20,
            }}
          >
            {allowedSlugs.map((slug) => {
              const action = TRANSITION_ACTIONS[slug] || getActionForSlug(slug);
              return (
                <Button
                  key={slug}
                  size="small"
                  icon={action.icon}
                  loading={transitionMutation.isPending}
                  onClick={() => handleTransition(post.id, slug)}
                  style={{
                    borderRadius: 20,
                    fontSize: 11,
                    color: action.color,
                    borderColor: action.color,
                    background: `${action.color}10`,
                  }}
                >
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderFeed = (posts: SocialPostItem[] | undefined, loading: boolean, showActions = true) => {
    if (loading) {
      return (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin size="large" />
        </div>
      );
    }
    if (!posts || posts.length === 0) {
      return (
        <Empty
          description="No posts yet. Be the first to share something!"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ paddingTop: 40 }}
        >
          {hasCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Create Post
            </Button>
          )}
        </Empty>
      );
    }
    return (
      <div>
        {posts.map((post) =>
          showActions ? renderPostWithActions(post) : (
            <SocialPostCard key={post.id} post={post} />
          )
        )}
      </div>
    );
  };

  const tabItems = [
    {
      key: "feed",
      label: (
        <span>
          <TeamOutlined style={{ marginRight: 6 }} />
          Feed
        </span>
      ),
      children: (
        <>
          {renderFeed(feedPosts, feedLoading, false)}
          {(feedData?.count ?? 0) > 10 && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <Pagination
                current={feedPage}
                pageSize={10}
                total={feedData?.count ?? 0}
                onChange={setFeedPage}
                size="small"
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      ),
    },
    ...(hasCreate
      ? [{
          key: "my-posts",
          label: (
            <span>
              <UserOutlined style={{ marginRight: 6 }} />
              My Posts
            </span>
          ),
          children: renderFeed(myPosts, myPostsLoading, true),
        }]
      : []),
    ...(hasManage
      ? [{
          key: "manage",
          label: (
            <span>
              <CheckCircleOutlined style={{ marginRight: 6 }} />
              Manage
            </span>
          ),
          children: (
            <div>
              {allPosts && allPosts.length > 0 && (
                <div style={{ marginBottom: 16, padding: "12px 16px", background: "var(--bms-surface-2)", borderRadius: 8, border: "1px solid var(--bms-border)" }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {allPosts.filter((p) => p.workflow_state_slug === "pending_approval").length} pending approval ·{" "}
                    {allPosts.filter((p) => p.workflow_state_slug === "draft").length} drafts ·{" "}
                    {allPosts.filter((p) => p.workflow_state_slug === "published").length} published
                  </Text>
                </div>
              )}
              {renderFeed(allPosts, allLoading, true)}
            </div>
          ),
        }]
      : []),
  ];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>
            Social Feed
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Company announcements and posts
          </Text>
        </div>
        {hasCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditPost(null);
              setCreateModalOpen(true);
            }}
            style={{ borderRadius: 8, height: 38 }}
          >
            New Post
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ marginBottom: 0 }}
      />

      {/* Create / Edit Modal */}
      <SocialPostModal
        open={createModalOpen || !!editPost}
        onClose={() => {
          setCreateModalOpen(false);
          setEditPost(null);
        }}
        editPost={editPost}
      />
    </div>
  );
}
