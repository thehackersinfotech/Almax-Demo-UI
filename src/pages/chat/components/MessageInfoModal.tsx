import React from "react";
import { Drawer, Avatar, Typography, Tag } from "antd";
import { CheckOutlined, ClockCircleOutlined, EyeOutlined, FileTextOutlined, PictureOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ChatMessage, ConversationParticipant } from "@/services/chat";
import { useThemeStore } from "@/store/theme";

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

interface MessageInfoModalProps {
  open: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  participants: ConversationParticipant[];
  myId?: string;
}

export const MessageInfoModal: React.FC<MessageInfoModalProps> = ({
  open,
  onClose,
  message,
  participants,
  myId,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  if (!message) return null;

  const sentTime = dayjs(message.created_at).format("D MMM YYYY, h:mm A");
  const otherParticipants = (participants || []).filter((p) => p?.employee?.id !== myId);

  // Parse message preview body cleanly
  const renderMessageContent = () => {
    let rawBody = (message.body || "").trim();
    if (!rawBody) return <span>[Empty Message]</span>;

    if (rawBody.includes("IMAGE_ATTACHMENT")) {
      try {
        const jsonStart = rawBody.indexOf("{");
        if (jsonStart !== -1) {
          const parsed = JSON.parse(rawBody.substring(jsonStart));
          if (parsed.type === "IMAGE_ATTACHMENT") {
            const filename = parsed.filename || "Photo.png";
            const imageUrl = parsed.file_url || null;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                  <PictureOutlined />
                  <span>Photo: {filename}</span>
                </div>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={filename}
                    style={{ maxHeight: 160, borderRadius: 8, objectFit: "cover", width: "100%" }}
                  />
                )}
              </div>
            );
          }
        }
      } catch (e) {}
    }

    if (rawBody.includes("FILE_ATTACHMENT")) {
      try {
        const jsonStart = rawBody.indexOf("{");
        if (jsonStart !== -1) {
          const parsed = JSON.parse(rawBody.substring(jsonStart));
          if (parsed.type === "FILE_ATTACHMENT") {
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                <FileTextOutlined />
                <span>Document: {parsed.filename || "File"}</span>
              </div>
            );
          }
        }
      } catch (e) {}
    }

    if (rawBody.includes("POLL")) {
      try {
        const jsonStart = rawBody.indexOf("{");
        if (jsonStart !== -1) {
          const parsed = JSON.parse(rawBody.substring(jsonStart));
          return <span>📊 Poll: {parsed.poll?.question || "Poll"}</span>;
        }
      } catch (e) {}
      return <span>📊 Poll</span>;
    }

    if (rawBody.includes("VOICE_NOTE")) return <span>🎙️ Voice Message</span>;
    if (rawBody.includes("LOCATION")) return <span>📍 Shared Location</span>;

    return <span>{rawBody}</span>;
  };

  return (
    <Drawer
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: isDark ? "#e9edef" : "#1f1f1f" }}>
          <EyeOutlined style={{ color: "#1890ff" }} />
          <span>Message Info</span>
        </div>
      }
      placement="right"
      width={360}
      onClose={onClose}
      open={open}
      style={{
        background: isDark ? "#111b21" : "#ffffff",
        color: isDark ? "#e9edef" : "#1f1f1f",
      }}
      headerStyle={{
        background: isDark ? "#202c33" : "#ffffff",
        borderBottom: isDark ? "1px solid #222d34" : "1px solid #f0f0f0",
      }}
      bodyStyle={{
        background: isDark ? "#111b21" : "#ffffff",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Message Card Preview */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: isDark ? "#005c4b" : "#2563eb",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ fontSize: 14 }}>{renderMessageContent()}</div>
          <div style={{ textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 6 }}>
            {dayjs(message.created_at).format("h:mm A")}
          </div>
        </div>

        <div>
          <Title level={5} style={{ fontSize: 13, textTransform: "uppercase", color: isDark ? "#8696a0" : "#8c8c8c", letterSpacing: 0.5 }}>
            Message Sent
          </Title>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: isDark ? "#e9edef" : "#1f1f1f" }}>
            <ClockCircleOutlined style={{ color: isDark ? "#8696a0" : "#8c8c8c" }} />
            <span>{sentTime} ({dayjs(message.created_at).fromNow()})</span>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: isDark ? "1px solid #222d34" : "1px solid #f0f0f0", margin: 0 }} />

        {/* Read / Seen Receipts */}
        <div>
          <Title level={5} style={{ fontSize: 13, textTransform: "uppercase", color: isDark ? "#8696a0" : "#8c8c8c", letterSpacing: 0.5, marginBottom: 12 }}>
            Seen By ({otherParticipants.length})
          </Title>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {otherParticipants.map((p) => {
              const lastRead = p.last_read_at;
              const isRead = lastRead && dayjs(lastRead).isAfter(dayjs(message.created_at));
              const seenFormatted = isRead
                ? `Seen ${dayjs(lastRead).fromNow()}`
                : "Delivered";

              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar src={p.employee?.profile_picture_url}>
                      {p.employee?.full_name?.charAt(0) || "U"}
                    </Avatar>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: isDark ? "#e9edef" : "#1f1f1f" }}>
                        {p.employee?.full_name}
                      </div>
                      <div style={{ fontSize: 11, color: isRead ? "#52c41a" : isDark ? "#8696a0" : "#8c8c8c" }}>
                        {seenFormatted}
                      </div>
                    </div>
                  </div>

                  <Tag color={isRead ? "blue" : "default"} icon={<CheckOutlined />}>
                    {isRead ? "Seen" : "Delivered"}
                  </Tag>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default MessageInfoModal;
