import React from "react";
import {
  Avatar,
  Typography,
  Button,
  Tooltip,
  Dropdown,
  Tag,
  Space,
} from "antd";
import {
  PhoneOutlined,
  VideoCameraOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  PushpinOutlined,
  PushpinFilled,
  ExportOutlined,
  ClearOutlined,
  EyeInvisibleOutlined,
  MoreOutlined,
  ProjectOutlined,
  TeamOutlined,
  UserOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { ConversationListItem, getOtherParticipant } from "@/services/chat";
import { useAuthStore } from "@/store/auth";

const { Title, Text } = Typography;

interface ChatHeaderProps {
  conversation: ConversationListItem | null;
  currentUserId?: string;
  isOnline?: boolean;
  typingUsers?: string[];
  isPinned?: boolean;
  pinnedCount?: number;
  onInitiateCall: (conversationId: string, type: "VOICE" | "VIDEO") => void;
  onTogglePinChat: (conversationId: string) => void;
  onOpenCallHistory: () => void;
  onToggleSearch: () => void;
  onOpenInfo: () => void;
  onExportChat: () => void;
  onClearChat: () => void;
  onClearFromFeed: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  currentUserId,
  isOnline,
  typingUsers = [],
  isPinned,
  pinnedCount = 0,
  onInitiateCall,
  onTogglePinChat,
  onOpenCallHistory,
  onToggleSearch,
  onOpenInfo,
  onExportChat,
  onClearChat,
  onClearFromFeed,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  if (!conversation) return null;

  const isDirect = conversation.type === "DIRECT";
  const isAI = conversation.id === "ai_bot" || (conversation as any).is_ai;
  const isProject = conversation.name?.toLowerCase().includes("project") || (conversation as any).is_project;

  const otherParticipant = isDirect
    ? getOtherParticipant(conversation.participants, currentUser)
    : null;

  const title = conversation.id === "ai_bot"
    ? "Nexus AI Assistant"
    : isDirect
    ? otherParticipant?.employee?.full_name || conversation.name || "Direct Discussion"
    : conversation.name || (isProject ? "Project Discussion" : "Team Group");

  const avatarUrl = conversation.avatar_url || otherParticipant?.employee?.profile_picture_url || null;

  return (
    <div
      style={{
        height: 64,
        padding: "0 24px",
        background: "var(--bms-surface, #ffffff)",
        borderBottom: "1px solid var(--bms-border, rgba(0, 0, 0, 0.08))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
        zIndex: 5,
      }}
    >
      {/* Left: Avatar, Title, Status & Category */}
      <div
        onClick={onOpenInfo}
        style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
      >
        <div style={{ position: "relative" }}>
          <Avatar
            size={42}
            src={avatarUrl}
            style={{
              backgroundColor: isProject
                ? "#722ed1"
                : isDirect
                ? "var(--bms-primary, #1677ff)"
                : "#fa8c16",
              fontWeight: 700,
              fontSize: 16,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            }}
          >
            {title.charAt(0).toUpperCase()}
          </Avatar>
          {isDirect && !isAI && (
            <span
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: isOnline ? "#52c41a" : "#bfbfbf",
                border: "2px solid #ffffff",
              }}
            />
          )}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Title level={5} style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>
              {title}
            </Title>
            <Tag
              color={isAI ? "purple" : isProject ? "purple" : isDirect ? "blue" : "orange"}
              style={{
                margin: 0,
                borderRadius: 6,
                fontSize: 10,
                padding: "0 6px",
                fontWeight: 600,
              }}
            >
              {isAI ? (
                <>
                  <UserOutlined style={{ marginRight: 3 }} /> AI Assistant
                </>
              ) : isProject ? (
                <>
                  <ProjectOutlined style={{ marginRight: 3 }} /> Project
                </>
              ) : isDirect ? (
                <>
                  <UserOutlined style={{ marginRight: 3 }} /> Direct
                </>
              ) : (
                <>
                  <TeamOutlined style={{ marginRight: 3 }} /> Group
                </>
              )}
            </Tag>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            {typingUsers.length > 0 ? (
              <Text style={{ fontSize: 12, color: "var(--bms-primary)", fontStyle: "italic" }}>
                typing...
              </Text>
            ) : isAI ? null : isDirect ? (
              <Text style={{ fontSize: 12, color: isOnline ? "#52c41a" : "var(--bms-text-3)" }}>
                {isOnline ? "Active now" : "Offline"}
              </Text>
            ) : (
              <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
                {conversation.participants?.length || 0} members
              </Text>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions (Voice Call, Video Call, Pinned, Search, History, Options) */}
      <Space size={6}>
        {!isAI && (
          <>
            <Tooltip title="Start Voice Call">
              <Button
                type="text"
                shape="circle"
                icon={<PhoneOutlined style={{ fontSize: 16, color: "var(--bms-primary)" }} />}
                onClick={() => onInitiateCall(conversation.id, "VOICE")}
              />
            </Tooltip>

            <Tooltip title="Start Video Call">
              <Button
                type="text"
                shape="circle"
                icon={<VideoCameraOutlined style={{ fontSize: 16, color: "#722ed1" }} />}
                onClick={() => onInitiateCall(conversation.id, "VIDEO")}
              />
            </Tooltip>
          </>
        )}

        <Tooltip title="Call History">
          <Button
            type="text"
            shape="circle"
            icon={<HistoryOutlined style={{ fontSize: 16 }} />}
            onClick={onOpenCallHistory}
          />
        </Tooltip>

        <Tooltip title="Search in Discussion">
          <Button
            type="text"
            shape="circle"
            icon={<SearchOutlined style={{ fontSize: 16 }} />}
            onClick={onToggleSearch}
          />
        </Tooltip>

        <Tooltip title="Channel Info & Files">
          <Button
            type="text"
            shape="circle"
            icon={<InfoCircleOutlined style={{ fontSize: 16 }} />}
            onClick={onOpenInfo}
          />
        </Tooltip>

        <Dropdown
          menu={{
            items: [
              {
                key: "pin_chat",
                label: isPinned ? "Unpin Discussion" : "Pin Discussion",
                icon: isPinned ? <PushpinFilled style={{ color: "#fa8c16" }} /> : <PushpinOutlined />,
                onClick: () => onTogglePinChat(conversation.id),
              },
              {
                key: "export",
                label: "Export Conversation Log",
                icon: <ExportOutlined />,
                onClick: onExportChat,
              },
              {
                type: "divider",
              },
              {
                key: "clear_feed",
                label: "Clear Chat from Feed",
                icon: <EyeInvisibleOutlined />,
                onClick: onClearFromFeed,
              },
              {
                key: "clear_messages",
                label: "Clear All Messages",
                icon: <ClearOutlined />,
                danger: true,
                onClick: onClearChat,
              },
            ],
          }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Button type="text" shape="circle" icon={<MoreOutlined style={{ fontSize: 18 }} />} />
        </Dropdown>
      </Space>
    </div>
  );
};

export default ChatHeader;
