import React, { useState } from "react";
import {
  Drawer,
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
  FileImageOutlined,
  DownloadOutlined,
  SearchOutlined,
  ExportOutlined,
  ClearOutlined,
  PushpinOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ConversationListItem, ChatMessage, getOtherParticipant } from "@/services/chat";
import { useAuthStore } from "@/store/auth";

const { Title, Text, Paragraph } = Typography;

interface ConversationInfoDrawerProps {
  open: boolean;
  onClose: () => void;
  conversation: ConversationListItem | null;
  currentUserId?: string;
  messages: ChatMessage[];
  pinnedMessage?: ChatMessage | null;
  onUnpinMessage?: () => void;
  onJumpToMessage?: (msgId: string) => void;
  onAddMembers?: () => void;
}

export const ConversationInfoDrawer: React.FC<ConversationInfoDrawerProps> = ({
  open,
  onClose,
  conversation,
  currentUserId,
  messages,
  pinnedMessage,
  onUnpinMessage,
  onJumpToMessage,
  onAddMembers,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [fileSearchQuery, setFileSearchQuery] = useState("");

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
    ? otherParticipant?.employee?.full_name || conversation.name || "Direct Message"
    : conversation.name || (isProject ? "Project Discussion" : "Team Channel");

  // Collect all media and document attachments from messages
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
    (d.original_filename || "document").toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  // Collect pinned messages
  const pinnedMessages = messages.filter((m) => m.is_important);

  return (
    <Drawer
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <Text style={{ fontWeight: 700, fontSize: 15 }}>Channel Details</Text>
        </div>
      }
      placement="right"
      width={380}
      onClose={onClose}
      open={open}
      closeIcon={<CloseOutlined />}
      styles={{
        body: { padding: "16px 20px", background: "var(--bms-bg, #f8fafc)" },
        header: { borderBottom: "1px solid var(--bms-border, rgba(0,0,0,0.08))" },
      }}
    >
      {/* Channel Header Profile */}
      <div
        style={{
          background: "var(--bms-surface, #ffffff)",
          borderRadius: 14,
          padding: "20px 16px",
          textAlign: "center",
          border: "1px solid var(--bms-border, rgba(0,0,0,0.06))",
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <Avatar
          size={64}
          src={conversation.avatar_url || otherParticipant?.employee?.profile_picture_url}
          style={{
            backgroundColor: isProject ? "#722ed1" : isDirect ? "var(--bms-primary, #1677ff)" : "#fa8c16",
            fontWeight: 700,
            fontSize: 22,
            marginBottom: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          {title.charAt(0).toUpperCase()}
        </Avatar>

        <Title level={4} style={{ margin: "0 0 4px 0", fontWeight: 700 }}>
          {title}
        </Title>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          <Tag
            color={isProject ? "purple" : isDirect ? "blue" : "orange"}
            style={{ borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}
          >
            {isProject ? (
              <>
                <ProjectOutlined style={{ marginRight: 4 }} /> Project Channel
              </>
            ) : isDirect ? (
              <>
                <UserOutlined style={{ marginRight: 4 }} /> Direct Discussion
              </>
            ) : (
              <>
                <TeamOutlined style={{ marginRight: 4 }} /> Team Group
              </>
            )}
          </Tag>
          {!isDirect && (
            <Tag style={{ borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>
              {conversation.participants?.length || 0} members
            </Tag>
          )}
        </div>

        {/* Action Shortcuts */}
        {!isAI && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 12 }}>
            <Tooltip title="Voice Call">
              <Button
                shape="round"
                icon={<PhoneOutlined />}
                onClick={() => onInitiateCall(conversation.id, "VOICE")}
                style={{ fontWeight: 600 }}
              >
                Audio
              </Button>
            </Tooltip>
            <Tooltip title="Video Call">
              <Button
                type="primary"
                shape="round"
                icon={<VideoCameraOutlined />}
                onClick={() => onInitiateCall(conversation.id, "VIDEO")}
                style={{ fontWeight: 600 }}
              >
                Video
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Tabs for Overview, Files, Pinned */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "overview",
            label: "Members",
            children: (
              <div
                style={{
                  background: "var(--bms-surface, #ffffff)",
                  borderRadius: 12,
                  padding: 12,
                  border: "1px solid var(--bms-border, rgba(0,0,0,0.06))",
                }}
              >
                <Text style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 8 }}>
                  Participants ({conversation.participants?.length || 0})
                </Text>
                <List
                  dataSource={conversation.participants || []}
                  renderItem={(p) => (
                    <List.Item style={{ padding: "8px 4px" }}>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            src={p.employee?.profile_picture_url}
                            style={{ backgroundColor: "var(--bms-primary, #1677ff)" }}
                          >
                            {p.employee?.full_name?.charAt(0) || "U"}
                          </Avatar>
                        }
                        title={
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ fontWeight: 600, fontSize: 13 }}>
                              {p.employee?.full_name || "Employee"}
                              {p.employee?.id === currentUserId && " (You)"}
                            </Text>
                            {p.role === "ADMIN" && (
                              <Tag color="gold" style={{ fontSize: 10, padding: "0 4px", borderRadius: 4 }}>
                                Admin
                              </Tag>
                            )}
                          </div>
                        }
                        description={
                          <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
                            {p.employee?.email || "No email"}
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            ),
          },
          {
            key: "files",
            label: `Files (${allAttachments.length})`,
            children: (
              <div>
                <Input
                  prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
                  placeholder="Search shared files..."
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  style={{ marginBottom: 12, borderRadius: 8 }}
                />

                {imageAttachments.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 6 }}>
                      Photos & Images ({imageAttachments.length})
                    </Text>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                      {imageAttachments.slice(0, 9).map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => img.download_url && window.open(img.download_url, "_blank")}
                          style={{
                            aspectRatio: "1/1",
                            borderRadius: 8,
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
                  <Text style={{ fontWeight: 600, fontSize: 12, display: "block", marginBottom: 6 }}>
                    Documents ({filteredDocs.length})
                  </Text>
                  {filteredDocs.length === 0 ? (
                    <Text style={{ fontSize: 12, color: "var(--bms-text-3)", display: "block", padding: "10px 0" }}>
                      No documents shared yet.
                    </Text>
                  ) : (
                    <List
                      dataSource={filteredDocs}
                      renderItem={(doc) => (
                        <div
                          style={{
                            background: "var(--bms-surface)",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--bms-border)",
                            marginBottom: 6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                            <FileTextOutlined style={{ fontSize: 16, color: "var(--bms-primary)" }} />
                            <div style={{ overflow: "hidden" }}>
                              <Text
                                ellipsis
                                style={{ fontWeight: 600, fontSize: 12, display: "block" }}
                              >
                                {doc.original_filename}
                              </Text>
                              <Text style={{ fontSize: 10, color: "var(--bms-text-3)" }}>
                                {dayjs(doc.createdAt).format("MMM D, YYYY")}
                              </Text>
                            </div>
                          </div>
                          {doc.download_url && (
                            <Button
                              type="text"
                              shape="circle"
                              size="small"
                              icon={<DownloadOutlined />}
                              onClick={() => window.open(doc.download_url || "", "_blank")}
                            />
                          )}
                        </div>
                      )}
                    />
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
                  <div style={{ textAlign: "center", padding: "30px 0" }}>
                    <PushpinOutlined style={{ fontSize: 24, color: "var(--bms-text-3)", marginBottom: 8 }} />
                    <Text style={{ fontSize: 12, color: "var(--bms-text-3)", display: "block" }}>
                      No pinned messages in this channel.
                    </Text>
                  </div>
                ) : (
                  <List
                    dataSource={pinnedMessages}
                    renderItem={(pin) => (
                      <div
                        onClick={() => onJumpToMessage(pin.id)}
                        style={{
                          background: "var(--bms-surface)",
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--bms-border)",
                          marginBottom: 8,
                          cursor: "pointer",
                          transition: "border-color 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <PushpinOutlined style={{ color: "#fa8c16", fontSize: 12 }} />
                          <Text style={{ fontWeight: 600, fontSize: 12 }}>
                            {pin.sender?.full_name || "Unknown"}
                          </Text>
                          <Text style={{ fontSize: 10, color: "var(--bms-text-3)", marginLeft: "auto" }}>
                            {dayjs(pin.created_at).format("MMM D, h:mm A")}
                          </Text>
                        </div>
                        <Text style={{ fontSize: 13, color: "var(--bms-text)" }} ellipsis>
                          {pin.body || "(Attachment)"}
                        </Text>
                      </div>
                    )}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      <Divider style={{ margin: "16px 0" }} />

      {/* Danger / Utility Actions */}
      <Space direction="vertical" style={{ width: "100%" }}>
        <Button
          block
          icon={<ExportOutlined />}
          onClick={onExportChat}
          style={{ fontWeight: 600, borderRadius: 8 }}
        >
          Export Conversation Log
        </Button>

        <Popconfirm
          title="Clear all messages?"
          description="Are you sure you want to wipe chat messages in this conversation?"
          onConfirm={onClearChat}
          okText="Yes, Clear"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button
            block
            danger
            icon={<ClearOutlined />}
            style={{ fontWeight: 600, borderRadius: 8 }}
          >
            Clear Chat Messages
          </Button>
        </Popconfirm>
      </Space>
    </Drawer>
  );
};
