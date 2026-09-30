import React, { useState } from "react";
import {
  Avatar,
  Typography,
  Tooltip,
  Dropdown,
  Button,
  Tag,
  Popconfirm,
  Space,
  message as antMessage,
} from "antd";
import {
  PushpinOutlined,
  PushpinFilled,
  DeleteOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  RollbackOutlined,
  SmileOutlined,
  FileTextOutlined,
  DownloadOutlined,
  CheckCircleFilled,
  EyeOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ChatMessage, MessageAttachment } from "@/services/chat";
import AudioPlayer from "./AudioPlayer";
import PollWidget from "./PollWidget";
import LocationWidget from "./LocationWidget";

const { Text, Paragraph } = Typography;

interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  isImportant?: boolean;
  replyToMessage?: ChatMessage | null;
  onReply: (msg: ChatMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onToggleImportant: (msgId: string) => void;
  onDeleteForMe: (msgId: string) => void;
  onDeleteForEveryone?: (msgId: string) => void;
  onShowInfo: (msg: ChatMessage) => void;
  onJumpToReply?: (replyId: string) => void;
  myId?: string;
  isDirectChat?: boolean;
  otherParticipantName?: string;
  isReadByRecipient?: boolean | number;
}

const COMMON_EMOJIS = ["👍", "❤️", "🔥", "🎉", "👏", "🚀", "💡", "✅"];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
  isImportant,
  replyToMessage,
  onReply,
  onReact,
  onToggleImportant,
  onDeleteForMe,
  onDeleteForEveryone,
  onShowInfo,
  onJumpToReply,
  myId,
  isDirectChat,
  otherParticipantName,
  isReadByRecipient,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  if (message.is_deleted) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: isMine ? "flex-end" : "flex-start",
          margin: "8px 24px",
        }}
      >
        <div
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: "var(--bms-bg, rgba(0, 0, 0, 0.03))",
            border: "1px dashed var(--bms-border, rgba(0, 0, 0, 0.12))",
            color: "var(--bms-text-3, #8c8c8c)",
            fontStyle: "italic",
            fontSize: 13,
          }}
        >
          <DeleteOutlined style={{ marginRight: 6 }} /> This message was deleted.
        </div>
      </div>
    );
  }

  // Parse special widgets encoded in message body
  let pollData = null;
  let locationData = null;
  let voiceData = null;
  let bodyAttachments: MessageAttachment[] = [];
  let cleanBody = message.body || "";

  if (cleanBody.startsWith("[POLL]:")) {
    try {
      pollData = JSON.parse(cleanBody.replace("[POLL]:", ""));
      cleanBody = "";
    } catch (e) {}
  } else if (cleanBody.startsWith("[LOCATION]:")) {
    try {
      locationData = JSON.parse(cleanBody.replace("[LOCATION]:", ""));
      cleanBody = "";
    } catch (e) {}
  } else if (cleanBody.startsWith("[VOICE]:")) {
    try {
      voiceData = JSON.parse(cleanBody.replace("[VOICE]:", ""));
      cleanBody = "";
    } catch (e) {}
  } else if (cleanBody.includes("[ATTACHMENTS]:")) {
    try {
      const parts = cleanBody.split("[ATTACHMENTS]:");
      const textBefore = parts[0] || "";
      const jsonAndText = parts[1] || "";
      const newlineIdx = jsonAndText.indexOf("\n");
      let jsonStr = jsonAndText;
      let textAfter = "";
      if (newlineIdx !== -1) {
        jsonStr = jsonAndText.substring(0, newlineIdx);
        textAfter = jsonAndText.substring(newlineIdx + 1);
      }
      bodyAttachments = JSON.parse(jsonStr);
      cleanBody = (textBefore + (textAfter ? " " + textAfter : "")).trim();
    } catch (e) {}
  }

  const allAttachments: MessageAttachment[] = [
    ...(message.attachments || []),
    ...bodyAttachments,
  ];

  // Group reactions
  const reactions = message.reaction_summary || {};
  const hasReactions = Object.keys(reactions).length > 0;

  const senderName = isMine ? "You" : message.sender?.full_name || "Employee";
  const senderInitial = message.sender?.full_name?.charAt(0)?.toUpperCase() || "E";
  const senderAvatar = message.sender?.profile_picture_url || null;

  const handleCopyFullImage = async (e: React.MouseEvent, imageUrl: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();

      let pngBlob = blob;
      if (blob.type !== "image/png") {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);

        pngBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b || blob), "image/png");
        });
      }

      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            "image/png": pngBlob,
          }),
        ]);
        antMessage.success("Image copied to clipboard! (Ready to paste)");
        return;
      }
    } catch (err) {
      console.warn("Clipboard full image copy failed:", err);
    }

    try {
      await navigator.clipboard.writeText(imageUrl);
      antMessage.success("Image link copied!");
    } catch {}
  };

  const handleDownloadFile = (e: React.MouseEvent, url: string, filename: string) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        margin: "12px 28px",
        position: "relative",
      }}
    >
      {/* Enterprise Message Container */}
      <div
        style={{
          display: "flex",
          flexDirection: isMine ? "row-reverse" : "row",
          alignItems: "flex-start",
          gap: 12,
          maxWidth: "75%",
          minWidth: 260,
        }}
      >
        {/* User Avatar */}
        <Avatar
          src={senderAvatar}
          size={36}
          style={{
            backgroundColor: isMine ? "var(--bms-primary, #1677ff)" : "#722ed1",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          }}
        >
          {senderInitial}
        </Avatar>

        {/* Message Content Block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header Info: Author + Role Tag + Timestamp */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              justifyContent: isMine ? "flex-end" : "flex-start",
            }}
          >
            <Text style={{ fontWeight: 700, fontSize: 13, color: "var(--bms-text, #1e293b)" }}>
              {senderName}
            </Text>
            {isImportant && (
              <Tag color="warning" style={{ margin: 0, padding: "0 6px", fontSize: 10, borderRadius: 4 }}>
                <PushpinFilled style={{ marginRight: 3 }} /> Pinned
              </Tag>
            )}
            <Text style={{ fontSize: 11, color: "var(--bms-text-3, #94a3b8)" }}>
              {dayjs(message.created_at).format("h:mm A")}
            </Text>
          </div>

          {/* Message Card Body */}
          <div
            style={{
              background: isMine
                ? "var(--bms-primary-light, #e6f4ff)"
                : "var(--bms-surface, #ffffff)",
              border: isMine
                ? "1px solid rgba(22, 119, 255, 0.25)"
                : "1px solid var(--bms-border, rgba(0,0,0,0.08))",
              borderRadius: isMine ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
              padding: "12px 16px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              position: "relative",
              transition: "box-shadow 0.15s ease",
            }}
          >
            {/* Reply Quote Banner */}
            {replyToMessage && (
              <div
                onClick={() => onJumpToReply && onJumpToReply(replyToMessage.id)}
                style={{
                  background: isMine ? "rgba(22, 119, 255, 0.1)" : "var(--bms-bg, rgba(0, 0, 0, 0.04))",
                  borderLeft: "3px solid var(--bms-primary, #1677ff)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <Text style={{ fontWeight: 600, fontSize: 11, color: "var(--bms-primary)" }}>
                  {replyToMessage.sender?.full_name || "Reply to message"}
                </Text>
                <Paragraph
                  ellipsis={{ rows: 1 }}
                  style={{ margin: 0, fontSize: 12, color: "var(--bms-text-2, #64748b)" }}
                >
                  {replyToMessage.body || "(Attachment)"}
                </Paragraph>
              </div>
            )}

            {/* Poll Widget */}
            {pollData && (
              <PollWidget
                pollData={pollData}
                messageId={message.id}
                currentUserId={myId}
                onVote={(optIndex) => {
                  // Handle poll vote action
                }}
              />
            )}

            {/* Location Widget */}
            {locationData && <LocationWidget locationData={locationData} />}

            {/* Voice Waveform Player */}
            {voiceData && (
              <AudioPlayer
                audioUrl={voiceData.audioUrl || ""}
                duration={voiceData.duration || 0}
                isMine={isMine}
              />
            )}

            {/* Plain Text Body (Omitted if body is purely redundant filename of an attachment) */}
            {!pollData &&
              !locationData &&
              !voiceData &&
              cleanBody &&
              !allAttachments.some((att) => att.original_filename === cleanBody) && (
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: isMine ? "#0958d9" : "var(--bms-text, #1e293b)",
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {cleanBody}
                </div>
              )}

            {/* File & Image Attachments */}
            {allAttachments.length > 0 && (
              <div style={{ marginTop: cleanBody ? 8 : 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {allAttachments.map((att: MessageAttachment) => {
                  const isExplicitDoc = (att as any).kind === "DOCUMENT";
                  const isImg =
                    !isExplicitDoc &&
                    (att.content_type?.startsWith("image/") ||
                      att.original_filename?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i));

                  if (isImg && att.download_url) {
                    return (
                      <div
                        key={att.id}
                        style={{
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "1px solid var(--bms-border, rgba(0,0,0,0.1))",
                          background: "#0f172a",
                          position: "relative",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                          maxWidth: 360,
                        }}
                      >
                        <img
                          src={att.download_url}
                          alt={att.original_filename}
                          style={{
                            width: "100%",
                            maxHeight: 320,
                            objectFit: "cover",
                            display: "block",
                            cursor: "pointer",
                          }}
                          onClick={() => window.open(att.download_url || "", "_blank")}
                        />

                        {/* Floating Action Controls Overlay for Image */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: 8,
                            right: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "rgba(0, 0, 0, 0.65)",
                            backdropFilter: "blur(8px)",
                            padding: "4px 8px",
                            borderRadius: 20,
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                          }}
                        >
                          <Tooltip title="Copy Full Image (Paste anywhere)">
                            <Button
                              type="text"
                              size="small"
                              shape="circle"
                              icon={<CopyOutlined style={{ color: "#ffffff", fontSize: 12 }} />}
                              onClick={(e) => handleCopyFullImage(e, att.download_url || "")}
                              style={{ width: 24, height: 24, minWidth: 24 }}
                            />
                          </Tooltip>

                          <Tooltip title="Download Image">
                            <Button
                              type="text"
                              size="small"
                              shape="circle"
                              icon={<DownloadOutlined style={{ color: "#ffffff", fontSize: 12 }} />}
                              onClick={(e) => handleDownloadFile(e, att.download_url || "", att.original_filename)}
                              style={{ width: 24, height: 24, minWidth: 24 }}
                            />
                          </Tooltip>

                          <Tooltip title="Open Fullscreen">
                            <Button
                              type="text"
                              size="small"
                              shape="circle"
                              icon={<EyeOutlined style={{ color: "#ffffff", fontSize: 12 }} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(att.download_url || "", "_blank");
                              }}
                              style={{ width: 24, height: 24, minWidth: 24 }}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    );
                  }

                  // Document / Generic File Card
                  return (
                    <div
                      key={att.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: isMine ? "rgba(255,255,255,0.85)" : "var(--bms-bg, #f8fafc)",
                        border: "1px solid var(--bms-border, rgba(0,0,0,0.08))",
                        gap: 12,
                        maxWidth: 360,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: "rgba(250, 140, 22, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <FileTextOutlined style={{ fontSize: 18, color: "#fa8c16" }} />
                        </div>
                        <div style={{ overflow: "hidden" }}>
                          <Text
                            ellipsis
                            style={{
                              fontWeight: 600,
                              fontSize: 13,
                              display: "block",
                              color: "var(--bms-text, #1e293b)",
                            }}
                            title={att.original_filename}
                          >
                            {att.original_filename}
                          </Text>
                          <Text style={{ fontSize: 11, color: "var(--bms-text-3, #64748b)" }}>
                            {att.size_bytes ? `${(att.size_bytes / 1024).toFixed(1)} KB` : "Document"}
                          </Text>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <Tooltip title="Copy File Link">
                          <Button
                            type="text"
                            shape="circle"
                            size="small"
                            icon={<CopyOutlined style={{ fontSize: 13 }} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (att.download_url && navigator.clipboard) {
                                navigator.clipboard.writeText(att.download_url);
                                antMessage.success("File link copied!");
                              }
                            }}
                          />
                        </Tooltip>

                        {att.download_url && (
                          <Tooltip title="Download File">
                            <Button
                              type="primary"
                              ghost
                              shape="circle"
                              size="small"
                              icon={<DownloadOutlined style={{ fontSize: 13 }} />}
                              onClick={(e) => handleDownloadFile(e, att.download_url!, att.original_filename)}
                            />
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Read / Seen Receipt Pill for My Messages */}
            {isMine && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                  marginTop: 6,
                }}
              >
                <Tooltip
                  title={
                    isReadByRecipient === true
                      ? `Read by ${otherParticipantName || "recipient"}`
                      : typeof isReadByRecipient === "number"
                      ? `Read by ${isReadByRecipient} team member(s)`
                      : `Sent (Not yet read by ${otherParticipantName || "recipient"})`
                  }
                >
                  <Tag
                    bordered={false}
                    color={isReadByRecipient ? "blue" : "default"}
                    style={{
                      margin: 0,
                      padding: "0 6px",
                      fontSize: 10,
                      borderRadius: 10,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      cursor: "pointer",
                      background: isReadByRecipient ? "rgba(22, 119, 255, 0.12)" : "rgba(0, 0, 0, 0.04)",
                      color: isReadByRecipient ? "#1677ff" : "#8c8c8c",
                    }}
                    onClick={() => onShowInfo(message)}
                  >
                    <CheckCircleFilled style={{ fontSize: 10 }} />
                    <span>
                      {isReadByRecipient === true
                        ? "Read"
                        : typeof isReadByRecipient === "number"
                        ? `Read (${isReadByRecipient})`
                        : "Sent"}
                    </span>
                  </Tag>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Reactions Pill Display */}
          {hasReactions && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {Object.entries(reactions).map(([emoji, users]) => {
                const reactedByMe = myId ? users.includes(myId) : false;
                return (
                  <Tooltip key={emoji} title={`Reacted by: ${users.length} member(s)`}>
                    <button
                      onClick={() => onReact(message.id, emoji)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: reactedByMe
                          ? "rgba(22, 119, 255, 0.15)"
                          : "var(--bms-surface, #ffffff)",
                        border: reactedByMe
                          ? "1px solid var(--bms-primary, #1677ff)"
                          : "1px solid var(--bms-border, rgba(0,0,0,0.1))",
                        cursor: "pointer",
                        fontSize: 12,
                        lineHeight: 1.2,
                        fontWeight: 600,
                        color: reactedByMe ? "var(--bms-primary)" : "var(--bms-text)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{emoji}</span>
                      <span>{users.length}</span>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Enterprise Action Bar (on Hover) */}
      {isHovered && (
        <div
          style={{
            position: "absolute",
            top: -14,
            [isMine ? "right" : "left"]: 48,
            background: "var(--bms-surface, #ffffff)",
            border: "1px solid var(--bms-border, rgba(0,0,0,0.12))",
            borderRadius: 20,
            padding: "2px 6px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 2,
            zIndex: 10,
          }}
        >
          {/* Quick Reactions */}
          {COMMON_EMOJIS.slice(0, 4).map((emoji) => (
            <Button
              key={emoji}
              type="text"
              size="small"
              shape="circle"
              onClick={() => onReact(message.id, emoji)}
              style={{ fontSize: 13, padding: 0, width: 26, height: 26 }}
            >
              {emoji}
            </Button>
          ))}

          {/* Reply */}
          <Tooltip title="Reply / Quote">
            <Button
              type="text"
              size="small"
              shape="circle"
              icon={<RollbackOutlined style={{ fontSize: 13 }} />}
              onClick={() => onReply(message)}
              style={{ width: 26, height: 26 }}
            />
          </Tooltip>

          {/* Pin */}
          <Tooltip title={isImportant ? "Unpin Message" : "Pin Message"}>
            <Button
              type="text"
              size="small"
              shape="circle"
              icon={
                isImportant ? (
                  <PushpinFilled style={{ color: "#fa8c16", fontSize: 13 }} />
                ) : (
                  <PushpinOutlined style={{ fontSize: 13 }} />
                )
              }
              onClick={() => onToggleImportant(message.id)}
              style={{ width: 26, height: 26 }}
            />
          </Tooltip>

          {/* Seen Details */}
          <Tooltip title="Seen / Delivery Details">
            <Button
              type="text"
              size="small"
              shape="circle"
              icon={<InfoCircleOutlined style={{ fontSize: 13 }} />}
              onClick={() => onShowInfo(message)}
              style={{ width: 26, height: 26 }}
            />
          </Tooltip>

          {/* Dropdown Menu for Delete / Copy */}
          <Dropdown
            menu={{
              items: [
                {
                  key: "copy",
                  label: "Copy Text",
                  icon: <CopyOutlined />,
                  onClick: () => {
                    if (cleanBody) navigator.clipboard.writeText(cleanBody);
                  },
                },
                {
                  key: "delete_for_me",
                  label: "Delete for Me",
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => onDeleteForMe(message.id),
                },
                ...(isMine && onDeleteForEveryone
                  ? [
                      {
                        key: "delete_for_all",
                        label: "Delete for Everyone",
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => onDeleteForEveryone(message.id),
                      },
                    ]
                  : []),
              ],
            }}
            trigger={["click"]}
          >
            <Button
              type="text"
              size="small"
              shape="circle"
              icon={<MoreOutlined style={{ fontSize: 13 }} />}
              style={{ width: 26, height: 26 }}
            />
          </Dropdown>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
