import React, { useMemo, useState } from "react";
import {
  Avatar,
  Typography,
  Input,
  Button,
  Badge,
  Tooltip,
  Dropdown,
  Tag,
  Segmented,
  Empty,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  PhoneOutlined,
  PushpinFilled,
  PushpinOutlined,
  EyeInvisibleOutlined,
  ClearOutlined,
  MoreOutlined,
  UserOutlined,
  TeamOutlined,
  ProjectOutlined,
  CheckOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ConversationListItem, getOtherParticipant } from "@/services/chat";
import { useAuthStore } from "@/store/auth";

const { Title, Text } = Typography;

interface ChatSidebarProps {
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  currentUserId?: string;
  onlineEmployeeIds: Set<string>;
  pinnedConversationIds: string[];
  hiddenConversationIds: string[];
  onSelectConversation: (id: string) => void;
  onOpenNewChat: () => void;
  onOpenCallHistory: () => void;
  onTogglePin: (id: string) => void;
  onClearFromFeed: (id: string) => void;
  onClearChat: (id: string) => void;
}

type FilterTab = "ALL" | "UNREAD" | "DIRECT" | "GROUP" | "PROJECT";

function formatPreview(raw?: string | null): string {
  if (!raw) return "No messages yet";
  const str = raw.trim();
  if (str.startsWith("[ATTACHMENTS]:")) {
    try {
      const parts = str.split("[ATTACHMENTS]:");
      const jsonAndText = parts[1] || "";
      const newlineIdx = jsonAndText.indexOf("\n");
      let jsonStr = jsonAndText;
      let textAfter = "";
      if (newlineIdx !== -1) {
        jsonStr = jsonAndText.substring(0, newlineIdx);
        textAfter = jsonAndText.substring(newlineIdx + 1).trim();
      }
      const atts = JSON.parse(jsonStr);
      if (textAfter) {
        return textAfter.length > 45 ? `${textAfter.substring(0, 45)}...` : textAfter;
      }
      const hasImg = atts.some(
        (a: any) =>
          a.kind === "IMAGE" ||
          a.content_type?.startsWith("image/") ||
          a.original_filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );
      return hasImg ? "📷 Photo" : "📎 Document";
    } catch (e) {
      return "📷 Photo";
    }
  }
  if (str.startsWith("data:image/")) return "📷 Photo";
  if (str.startsWith("[POLL]:") || str.includes('"type":"POLL"')) return "📊 Poll";
  if (str.startsWith("[VOICE]:") || str.includes('"type":"VOICE_NOTE"')) return "🎙️ Voice Note";
  if (str.startsWith("[LOCATION]:") || str.includes('"type":"LOCATION"')) return "📍 Location";
  if (str.includes('"type":"IMAGE_ATTACHMENT"') || str.startsWith("[IMAGE]:")) return "📷 Photo";
  if (str.includes('"type":"FILE_ATTACHMENT"') || str.startsWith("[FILE]:")) return "📄 Document";
  if (str.startsWith("{")) {
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "IMAGE_ATTACHMENT" || parsed.file_url?.startsWith("data:image/"))
        return `📷 ${parsed.filename || "Photo"}`;
      if (parsed.type === "FILE_ATTACHMENT") return `📄 ${parsed.filename || "Document"}`;
      if (parsed.type === "VOICE_NOTE") return "🎙️ Voice Note";
      if (parsed.type === "POLL") return `📊 ${parsed.poll?.question || "Poll"}`;
      if (parsed.type === "LOCATION") return `📍 ${parsed.location?.title || "Location"}`;
    } catch (e) {}
  }
  if (str.length > 80 && !str.includes(" ")) {
    if (str.includes("base64") || str.startsWith("iVBOR") || str.startsWith("/9j/")) {
      return "📷 Photo";
    }
  }
  return str.length > 45 ? `${str.substring(0, 45)}...` : str;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  currentUserId,
  onlineEmployeeIds,
  pinnedConversationIds,
  hiddenConversationIds,
  onSelectConversation,
  onOpenNewChat,
  onOpenCallHistory,
  onTogglePin,
  onClearFromFeed,
  onClearChat,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");

  // Filter out conversations hidden from feed
  const visibleConversations = useMemo(() => {
    return conversations.filter((c) => !hiddenConversationIds.includes(c.id));
  }, [conversations, hiddenConversationIds]);

  // Apply search query and filter tabs
  const filteredConversations = useMemo(() => {
    return visibleConversations.filter((c) => {
      const isDirect = c.type === "DIRECT";
      const isProject =
        c.name?.toLowerCase().includes("project") || (c as any).is_project;

      // Filter by type
      if (activeFilter === "UNREAD" && (!c.unread_count || c.unread_count <= 0)) {
        return false;
      }
      if (activeFilter === "DIRECT" && !isDirect) {
        return false;
      }
      if (activeFilter === "GROUP" && (isDirect || isProject)) {
        return false;
      }
      if (activeFilter === "PROJECT" && !isProject) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const otherParticipant = isDirect
          ? getOtherParticipant(c.participants, currentUser)
          : null;
        const name = (c.id === "ai_bot" ? "Nexus AI Assistant" : isDirect ? otherParticipant?.employee?.full_name : c.name) || "";
        const lastMsg = c.last_message_preview?.body || "";
        return name.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
      }

      return true;
    });
  }, [visibleConversations, activeFilter, searchQuery, currentUser]);

  // Separate pinned vs standard conversations
  const pinnedList = useMemo(() => {
    return filteredConversations.filter((c) => pinnedConversationIds.includes(c.id));
  }, [filteredConversations, pinnedConversationIds]);

  const directList = useMemo(() => {
    return filteredConversations.filter(
      (c) => !pinnedConversationIds.includes(c.id) && c.type === "DIRECT"
    );
  }, [filteredConversations, pinnedConversationIds]);

  const groupAndProjectList = useMemo(() => {
    return filteredConversations.filter(
      (c) => !pinnedConversationIds.includes(c.id) && c.type !== "DIRECT"
    );
  }, [filteredConversations, pinnedConversationIds]);

  const renderConversationItem = (c: ConversationListItem) => {
    const isDirect = c.type === "DIRECT";
    const isProject =
      c.name?.toLowerCase().includes("project") || (c as any).is_project;
    const isActive = c.id === activeConversationId;
    const isPinned = pinnedConversationIds.includes(c.id);

    const otherParticipant = isDirect
      ? getOtherParticipant(c.participants, currentUser)
      : null;

    const displayName = c.id === "ai_bot"
      ? "Nexus AI Assistant"
      : isDirect
      ? otherParticipant?.employee?.full_name || c.name || "Direct Message"
      : c.name || (isProject ? "Project Channel" : "Team Group");

    const avatarUrl =
      c.avatar_url || otherParticipant?.employee?.profile_picture_url || null;

    const emp = otherParticipant?.employee;
    const isOnline = emp
      ? Boolean(
          (emp as any).is_online ||
          (emp.id && onlineEmployeeIds.has(emp.id)) ||
          ((emp as any).user_id && onlineEmployeeIds.has((emp as any).user_id)) ||
          ((emp as any).employee_code && onlineEmployeeIds.has((emp as any).employee_code))
        )
      : false;

    return (
      <div
        key={c.id}
        onClick={() => onSelectConversation(c.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          margin: "3px 8px",
          borderRadius: 10,
          background: isActive
            ? "var(--bms-primary-light, rgba(22, 119, 255, 0.08))"
            : "transparent",
          border: isActive
            ? "1px solid rgba(22, 119, 255, 0.25)"
            : "1px solid transparent",
          cursor: "pointer",
          transition: "all 0.15s ease",
          position: "relative",
        }}
        className="bms-channel-item"
      >
        {/* Avatar with Status indicator */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar
            size={40}
            src={avatarUrl}
            style={{
              backgroundColor: isProject
                ? "#722ed1"
                : isDirect
                ? "var(--bms-primary, #1677ff)"
                : "#fa8c16",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          {isDirect && c.id !== "ai_bot" && !((c as any).is_ai) && (
            <span
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: isOnline ? "#52c41a" : "#bfbfbf",
                border: "2px solid var(--bms-surface, #ffffff)",
              }}
            />
          )}
        </div>

        {/* Name, Preview, and Metadata */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 2,
            }}
          >
            <Text
              ellipsis
              style={{
                fontWeight: isActive ? 700 : 600,
                fontSize: 13.5,
                color: isActive ? "var(--bms-primary)" : "var(--bms-text)",
              }}
            >
              {displayName}
            </Text>
            {c.last_message_at && (
              <Text
                style={{
                  fontSize: 11,
                  color: "var(--bms-text-3)",
                  flexShrink: 0,
                  marginLeft: 6,
                }}
              >
                {dayjs(c.last_message_at).format("h:mm A")}
              </Text>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              ellipsis
              style={{
                fontSize: 12,
                color: c.unread_count > 0 ? "var(--bms-text)" : "var(--bms-text-3)",
                fontWeight: c.unread_count > 0 ? 600 : 400,
              }}
            >
              {formatPreview(c.last_message_preview?.body)}
            </Text>

            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {isPinned && (
                <PushpinFilled style={{ color: "#fa8c16", fontSize: 11 }} />
              )}
              {c.unread_count > 0 && (
                <Badge
                  count={c.unread_count}
                  style={{
                    backgroundColor: "var(--bms-primary, #1677ff)",
                    boxShadow: "none",
                    fontWeight: 700,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* 3-Dots Context Menu */}
        <Dropdown
          menu={{
            items: [
              {
                key: "pin",
                label: isPinned ? "Unpin Discussion" : "Pin to Top",
                icon: isPinned ? (
                  <PushpinFilled style={{ color: "#fa8c16" }} />
                ) : (
                  <PushpinOutlined />
                ),
                onClick: (e) => {
                  e.domEvent.stopPropagation();
                  onTogglePin(c.id);
                },
              },
              {
                key: "hide_feed",
                label: "Clear Chat from Feed",
                icon: <EyeInvisibleOutlined />,
                onClick: (e) => {
                  e.domEvent.stopPropagation();
                  onClearFromFeed(c.id);
                },
              },
              {
                key: "clear_chat",
                label: "Clear Chat Messages",
                icon: <ClearOutlined />,
                danger: true,
                onClick: (e) => {
                  e.domEvent.stopPropagation();
                  onClearChat(c.id);
                },
              },
            ],
          }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Button
            type="text"
            size="small"
            shape="circle"
            icon={<MoreOutlined style={{ fontSize: 13, color: "var(--bms-text-3)" }} />}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 22, height: 22, flexShrink: 0 }}
          />
        </Dropdown>
      </div>
    );
  };

  return (
    <div
      style={{
        width: 320,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bms-surface, #ffffff)",
        borderRight: "1px solid var(--bms-border, rgba(0, 0, 0, 0.08))",
        overflow: "hidden",
      }}
    >
      {/* Sidebar Header */}
      <div style={{ padding: "18px 16px 12px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Title level={4} style={{ margin: 0, fontWeight: 800, letterSpacing: -0.3 }}>
              Discussions
            </Title>
            <Tag
              bordered={false}
              color="blue"
              style={{
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                padding: "0 6px",
              }}
            >
              {conversations.length}
            </Tag>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <Tooltip title="Call History">
              <Button
                type="text"
                shape="circle"
                icon={<HistoryOutlined style={{ fontSize: 16 }} />}
                onClick={onOpenCallHistory}
              />
            </Tooltip>
            <Tooltip title="Start New Discussion / Channel">
              <Button
                type="primary"
                shape="circle"
                icon={<PlusOutlined style={{ fontSize: 14 }} />}
                onClick={onOpenNewChat}
                style={{
                  boxShadow: "0 2px 8px rgba(22, 119, 255, 0.25)",
                }}
              />
            </Tooltip>
          </div>
        </div>

        {/* Search Input */}
        <Input
          prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
          placeholder="Search team, projects & messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          style={{
            borderRadius: 8,
            marginBottom: 10,
            background: "var(--bms-bg, #f8fafc)",
          }}
        />

        {/* Segmented Filter Bar */}
        <Segmented
          block
          size="small"
          value={activeFilter}
          onChange={(val) => setActiveFilter(val as FilterTab)}
          options={[
            { label: "All", value: "ALL" },
            { label: "Unread", value: "UNREAD" },
            { label: "Direct", value: "DIRECT" },
            { label: "Groups", value: "GROUP" },
            { label: "Projects", value: "PROJECT" },
          ]}
        />
      </div>

      {/* Conversations Scroll Area */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 16 }}>
        {filteredConversations.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
                No discussions found
              </Text>
            }
            style={{ marginTop: 40 }}
          />
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedList.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    padding: "4px 16px 2px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <PushpinFilled style={{ color: "#fa8c16", fontSize: 11 }} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--bms-text-3)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Pinned ({pinnedList.length})
                  </Text>
                </div>
                {pinnedList.map(renderConversationItem)}
              </div>
            )}

            {/* Direct Messages Section */}
            {directList.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    padding: "4px 16px 2px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <UserOutlined style={{ fontSize: 11, color: "var(--bms-primary)" }} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--bms-text-3)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Direct Messages ({directList.length})
                  </Text>
                </div>
                {directList.map(renderConversationItem)}
              </div>
            )}

            {/* Channels & Groups Section */}
            {groupAndProjectList.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    padding: "4px 16px 2px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <TeamOutlined style={{ fontSize: 11, color: "#fa8c16" }} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--bms-text-3)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Groups & Projects ({groupAndProjectList.length})
                  </Text>
                </div>
                {groupAndProjectList.map(renderConversationItem)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
