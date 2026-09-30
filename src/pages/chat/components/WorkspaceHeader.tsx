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
  LayoutOutlined,
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
import { AIAvatarIcon } from "./AIAvatarIcon";

const { Title, Text } = Typography;

interface WorkspaceHeaderProps {
  conversation: ConversationListItem | null;
  currentUserId?: string;
  isOnline?: boolean;
  typingUsers?: string[];
  isPinned?: boolean;
  rightDeskOpen?: boolean;
  onToggleRightDesk?: () => void;
  onInitiateCall: (conversationId: string, type: "VOICE" | "VIDEO") => void;
  onTogglePinChat: (conversationId: string) => void;
  onOpenCallHistory: () => void;
  onToggleSearch: () => void;
  onExportChat: () => void;
  onClearChat: () => void;
  onClearFromFeed: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  conversation,
  currentUserId,
  isOnline,
  typingUsers = [],
  isPinned,
  rightDeskOpen,
  onToggleRightDesk,
  onInitiateCall,
  onTogglePinChat,
  onOpenCallHistory,
  onToggleSearch,
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
    : conversation.name || (isProject ? "Project Workspace" : "Team Channel");

  const avatarUrl = conversation.avatar_url || otherParticipant?.employee?.profile_picture_url || null;

  return (
    <div
      style={{
        height: 58,
        padding: "0 16px",
        background: "var(--bms-surface, #ffffff)",
        borderBottom: "1px solid var(--bms-border, rgba(0, 0, 0, 0.08))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
        zIndex: 5,
        gap: 12,
        overflow: "hidden",
      }}
    >
      {/* Left: Avatar & Meta (Safe flexbox with no wrapping) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1, overflow: "hidden" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {conversation.id === "ai_bot" ? (
            <AIAvatarIcon size={36} />
          ) : (
            <Avatar
              size={36}
              src={avatarUrl}
              style={{
                backgroundColor: isProject ? "#722ed1" : isDirect ? "var(--bms-primary, #1677ff)" : "#fa8c16",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {title.charAt(0).toUpperCase()}
            </Avatar>
          )}
          {isDirect && !isAI && (
            <span
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: isOnline ? "#52c41a" : "#bfbfbf",
                border: "2px solid #ffffff",
              }}
            />
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "var(--bms-text, #1e293b)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "inline-block",
                maxWidth: 220,
              }}
            >
              {title}
            </span>
            <Tag
              color={isAI ? "purple" : isProject ? "purple" : isDirect ? "blue" : "orange"}
              style={{
                margin: 0,
                borderRadius: 4,
                fontSize: 10,
                padding: "0 5px",
                fontWeight: 600,
                lineHeight: "16px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {isAI ? "AI Assistant" : isProject ? "Project" : isDirect ? "Direct" : "Group"}
            </Tag>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1, whiteSpace: "nowrap" }}>
            {typingUsers.length > 0 ? (
              <Text style={{ fontSize: 11, color: "var(--bms-primary)", fontStyle: "italic", whiteSpace: "nowrap" }}>
                typing...
              </Text>
            ) : isAI ? null : isDirect ? (
              <span
                style={{
                  fontSize: 11,
                  color: isOnline ? "#52c41a" : "var(--bms-text-3, #94a3b8)",
                  whiteSpace: "nowrap",
                  display: "inline-block",
                }}
              >
                {isOnline ? "Active now" : "Offline"}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: "var(--bms-text-3, #94a3b8)", whiteSpace: "nowrap" }}>
                {conversation.participants?.length || 0} participants
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Action Tools */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {!isAI && (
          <>
            <Tooltip title="Voice Call">
              <Button
                type="text"
                shape="circle"
                icon={<PhoneOutlined style={{ fontSize: 16, color: "var(--bms-primary, #1677ff)" }} />}
                onClick={() => onInitiateCall(conversation.id, "VOICE")}
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(22, 119, 255, 0.06)",
                  transition: "all 0.15s ease",
                }}
              />
            </Tooltip>

            <Tooltip title="HD Video Call">
              <Button
                type="text"
                shape="circle"
                icon={<VideoCameraOutlined style={{ fontSize: 16, color: "#722ed1" }} />}
                onClick={() => onInitiateCall(conversation.id, "VIDEO")}
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(114, 46, 209, 0.06)",
                  transition: "all 0.15s ease",
                }}
              />
            </Tooltip>
          </>
        )}

        <Tooltip title="Search in Discussion">
          <Button
            type="text"
            shape="circle"
            icon={<SearchOutlined style={{ fontSize: 16, color: "var(--bms-text, #475569)" }} />}
            onClick={onToggleSearch}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0, 0, 0, 0.03)",
              transition: "all 0.15s ease",
            }}
          />
        </Tooltip>

        {onToggleRightDesk && (
          <Tooltip title={rightDeskOpen ? "Hide Workspace Desk" : "Show Workspace Desk"}>
            <Button
              type={rightDeskOpen ? "primary" : "text"}
              shape="circle"
              icon={
                <LayoutOutlined
                  style={{
                    fontSize: 16,
                    color: rightDeskOpen ? "#ffffff" : "var(--bms-text, #475569)",
                  }}
                />
              }
              onClick={onToggleRightDesk}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: rightDeskOpen
                  ? "var(--bms-primary, #1677ff)"
                  : "rgba(0, 0, 0, 0.03)",
                transition: "all 0.15s ease",
              }}
            />
          </Tooltip>
        )}

        <Dropdown
          menu={{
            items: [
              {
                key: "pin",
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
              { type: "divider" },
              {
                key: "hide",
                label: "Clear from Feed",
                icon: <EyeInvisibleOutlined />,
                onClick: onClearFromFeed,
              },
              {
                key: "clear",
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
          <Button
            type="text"
            shape="circle"
            icon={<MoreOutlined style={{ fontSize: 18, color: "var(--bms-text, #475569)" }} />}
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0, 0, 0, 0.03)",
              transition: "all 0.15s ease",
            }}
          />
        </Dropdown>
      </div>
    </div>
  );
};

export default WorkspaceHeader;
