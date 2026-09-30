import React, { useState } from "react";
import {
  Typography,
  Avatar,
  Tag,
  Button,
  Tabs,
  List,
  Space,
  Divider,
  Popconfirm,
  Input,
  Tooltip,
} from "antd";
import {
  CloseOutlined,
  UserOutlined,
  TeamOutlined,
  ProjectOutlined,
  PhoneOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  DownloadOutlined,
  SearchOutlined,
  ExportOutlined,
  ClearOutlined,
  PushpinOutlined,
  DeleteOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ConversationListItem, ChatMessage, getOtherParticipant } from "@/services/chat";
import { useAuthStore } from "@/store/auth";
import { AIAvatarIcon } from "./AIAvatarIcon";

const { Title, Text, Paragraph } = Typography;

interface WorkspaceRightDeskProps {
  conversation: ConversationListItem | null;
  currentUserId?: string;
  messages: ChatMessage[];
  pinnedMessage?: ChatMessage | null;
  onClose: () => void;
  onInitiateCall: (conversationId: string, type: "VOICE" | "VIDEO") => void;
  onOpenCallHistory?: () => void;
  onExportChat: () => void;
  onClearChat: () => void;
  onJumpToMessage: (msgId: string) => void;
}

export const WorkspaceRightDesk: React.FC<WorkspaceRightDeskProps> = ({
  conversation,
  currentUserId,
  messages,
  pinnedMessage,
  onClose,
  onInitiateCall,
  onOpenCallHistory,
  onExportChat,
  onClearChat,
  onJumpToMessage,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<string>("members");
  const [fileQuery, setFileQuery] = useState("");

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
    : conversation.name || (isProject ? "Project Room" : "Team Channel");

  // Collect attachments from both structured attachments array and body payloads
  const allAttachments = messages.flatMap((m) => {
    const list: any[] = [...(m.attachments || [])];
    if (m.body && m.body.startsWith("[ATTACHMENTS]:")) {
      try {
        const parsed = JSON.parse(m.body.substring(14).trim());
        if (Array.isArray(parsed)) {
          parsed.forEach((p) => {
            if (p && !list.some((existing) => existing.id === p.id || (existing.download_url && existing.download_url === p.download_url))) {
              list.push(p);
            }
          });
        }
      } catch {}
    }
    return list.map((att) => ({
      ...att,
      messageId: m.id,
      senderName: typeof m.sender === "string" ? m.sender : m.sender?.full_name || "Unknown",
      createdAt: m.created_at,
    }));
  });

  const imageAttachments = allAttachments.filter(
    (a) => a.content_type?.startsWith("image/") || a.original_filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || (a.download_url && a.download_url.startsWith("data:image/"))
  );

  const docAttachments = allAttachments.filter(
    (a) => !a.content_type?.startsWith("image/") && !a.original_filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !(a.download_url && a.download_url.startsWith("data:image/"))
  );

  const filteredDocs = docAttachments.filter((d) =>
    (d.original_filename || "document").toLowerCase().includes(fileQuery.toLowerCase())
  );

  const pinnedMessages = messages.filter((m) => m.is_important);

  return (
    <div
      style={{
        width: 270,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bms-surface, #ffffff)",
        borderLeft: "1px solid var(--bms-border, rgba(0, 0, 0, 0.08))",
        overflow: "hidden",
      }}
    >
      {/* Right Desk Header */}
      <div
        style={{
          padding: "16px 14px 12px 14px",
          borderBottom: "1px solid var(--bms-border, rgba(0, 0, 0, 0.06))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontWeight: 700, fontSize: 14 }}>Channel Workspace</Text>
        {onClose && (
          <Button type="text" size="small" shape="circle" icon={<CloseOutlined />} onClick={onClose} />
        )}
      </div>

      {/* Desk Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px" }}>
        {/* Profile Card */}
        <div
          style={{
            background: "var(--bms-bg, #f8fafc)",
            borderRadius: 12,
            padding: "16px 12px",
            textAlign: "center",
            marginBottom: 14,
            border: "1px solid var(--bms-border, rgba(0,0,0,0.06))",
          }}
        >
          {conversation.id === "ai_bot" ? (
            <AIAvatarIcon size={52} style={{ margin: "0 auto 8px auto" }} />
          ) : (
            <Avatar
              size={52}
              src={conversation.avatar_url || otherParticipant?.employee?.profile_picture_url}
              style={{
                backgroundColor: isProject ? "#722ed1" : isDirect ? "var(--bms-primary, #1677ff)" : "#fa8c16",
                fontWeight: 700,
                fontSize: 18,
                marginBottom: 8,
              }}
            >
              {title.charAt(0).toUpperCase()}
            </Avatar>
          )}
          <Title level={5} style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
            {title}
          </Title>
          <Text style={{ fontSize: 11, color: "var(--bms-text-3)", display: "block", marginTop: 2 }}>
            {isDirect ? "Direct 1-on-1 Workspace" : `${conversation.participants?.length || 0} Team Participants`}
          </Text>

          {/* Quick Call Action Buttons */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
            {!isAI && (
              <>
                <Button
                  size="small"
                  icon={<PhoneOutlined style={{ color: "var(--bms-primary)" }} />}
                  onClick={() => onInitiateCall(conversation.id, "VOICE")}
                  style={{ fontWeight: 600, fontSize: 12 }}
                >
                  Voice
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<VideoCameraOutlined />}
                  onClick={() => onInitiateCall(conversation.id, "VIDEO")}
                  style={{ fontWeight: 600, fontSize: 12 }}
                >
                  Video
                </Button>
              </>
            )}
            <Tooltip title="Call History">
              <Button
                size="small"
                icon={<HistoryOutlined />}
                onClick={onOpenCallHistory}
                style={{ fontSize: 12 }}
              />
            </Tooltip>
          </div>
        </div>

        {/* Tabs for Members, Assets, Pinned */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          items={[
            {
              key: "members",
              label: "Team",
              children: (
                <List
                  dataSource={conversation.participants || []}
                  renderItem={(p) => (
                    <List.Item style={{ padding: "6px 0" }}>
                      <List.Item.Meta
                        avatar={
                          <Avatar size={30} src={p.employee?.profile_picture_url}>
                            {p.employee?.full_name?.charAt(0) || "U"}
                          </Avatar>
                        }
                        title={
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 12, fontWeight: 600 }}>
                              {p.employee?.full_name || "Member"}
                              {p.employee?.id === currentUserId && " (You)"}
                            </Text>
                            {p.role === "ADMIN" && (
                              <Tag color="gold" style={{ fontSize: 9, padding: "0 3px", lineHeight: "14px" }}>
                                Admin
                              </Tag>
                            )}
                          </div>
                        }
                        description={<Text style={{ fontSize: 10, color: "var(--bms-text-3)" }}>{p.employee?.email}</Text>}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: "files",
              label: `Files (${allAttachments.length})`,
              children: (
                <div>
                  <Input
                    prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
                    placeholder="Search files..."
                    value={fileQuery}
                    onChange={(e) => setFileQuery(e.target.value)}
                    size="small"
                    style={{ marginBottom: 8, borderRadius: 6 }}
                  />

                  {imageAttachments.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <Text style={{ fontWeight: 600, fontSize: 11, display: "block", marginBottom: 4 }}>
                        Photos ({imageAttachments.length})
                      </Text>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                        {imageAttachments.slice(0, 6).map((img, idx) => (
                          <div
                            key={idx}
                            onClick={() => img.download_url && window.open(img.download_url, "_blank")}
                            style={{
                              aspectRatio: "1/1",
                              borderRadius: 6,
                              overflow: "hidden",
                              border: "1px solid var(--bms-border)",
                              cursor: "pointer",
                              background: "#000",
                            }}
                          >
                            <img
                              src={img.download_url || ""}
                              alt={img.original_filename}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Text style={{ fontWeight: 600, fontSize: 11, display: "block", marginBottom: 4 }}>
                      Documents ({filteredDocs.length})
                    </Text>
                    {filteredDocs.length === 0 ? (
                      <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>No documents found</Text>
                    ) : (
                      filteredDocs.map((doc, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "6px 8px",
                            background: "var(--bms-bg, #f8fafc)",
                            borderRadius: 6,
                            border: "1px solid var(--bms-border, rgba(0,0,0,0.06))",
                            marginBottom: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                            <FileTextOutlined style={{ fontSize: 14, color: "var(--bms-primary)" }} />
                            <Text ellipsis style={{ fontSize: 11.5, fontWeight: 600 }}>
                              {doc.original_filename}
                            </Text>
                          </div>
                          {doc.download_url && (
                            <Button
                              type="text"
                              size="small"
                              shape="circle"
                              icon={<DownloadOutlined style={{ fontSize: 12 }} />}
                              onClick={() => window.open(doc.download_url || "", "_blank")}
                            />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "pinned",
              label: `Pinned (${pinnedMessages.length})`,
              children: (
                <div>
                  {pinnedMessages.length === 0 ? (
                    <Text style={{ fontSize: 11, color: "var(--bms-text-3)", display: "block", textAlign: "center", padding: "16px 0" }}>
                      No pinned notes
                    </Text>
                  ) : (
                    pinnedMessages.map((pin) => (
                      <div
                        key={pin.id}
                        onClick={() => onJumpToMessage(pin.id)}
                        style={{
                          padding: "8px 10px",
                          background: "var(--bms-bg, #f8fafc)",
                          borderRadius: 8,
                          border: "1px solid var(--bms-border)",
                          marginBottom: 6,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                          <PushpinOutlined style={{ color: "#fa8c16", fontSize: 11 }} />
                          <Text style={{ fontSize: 11, fontWeight: 700 }}>{pin.sender?.full_name || "Staff"}</Text>
                        </div>
                        <Text ellipsis style={{ fontSize: 12, color: "var(--bms-text)" }}>
                          {pin.body || "(Attachment)"}
                        </Text>
                      </div>
                    ))
                  )}
                </div>
              ),
            },
          ]}
        />

        <Divider style={{ margin: "14px 0" }} />

        {/* Administration Tools */}
        <Space direction="vertical" style={{ width: "100%" }} size={6}>
          <Button block size="small" icon={<ExportOutlined />} onClick={onExportChat} style={{ fontSize: 12 }}>
            Export Conversation Log
          </Button>

          <Popconfirm
            title="Clear all messages?"
            description="Are you sure you want to wipe chat messages in this channel?"
            onConfirm={onClearChat}
            okText="Yes, Clear"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button block danger size="small" icon={<ClearOutlined />} style={{ fontSize: 12 }}>
              Clear Channel Messages
            </Button>
          </Popconfirm>
        </Space>
      </div>
    </div>
  );
};

export default WorkspaceRightDesk;
