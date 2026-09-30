import React, { useState, useRef } from "react";
import {
  Avatar,
  Typography,
  Tooltip,
  Dropdown,
  Button,
  Tag,
  Popconfirm,
  Space,
  Popover,
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
import { AIAvatarIcon } from "./AIAvatarIcon";
import InlineCallCard from "./InlineCallCard";

const { Text, Paragraph } = Typography;

interface DiscussionCardProps {
  message: ChatMessage;
  isMine: boolean;
  isImportant?: boolean;
  replyToMessage?: ChatMessage | null;
  onReply: (msg: ChatMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onVotePoll?: (messageId: string, pollId: string, optionId: string, optionIndex: number) => void;
  onToggleImportant: (msgId: string) => void;
  onDeleteForMe: (msgId: string) => void;
  onDeleteForEveryone?: (msgId: string) => void;
  onShowInfo: (msg: ChatMessage) => void;
  onJumpToReply?: (replyId: string) => void;
  myId?: string;
  isDirectChat?: boolean;
  isAIChat?: boolean;
  isReadByRecipient?: boolean | number;
  otherParticipantName?: string;
  participants?: any[];
}

const COMMON_EMOJIS = ["👍", "❤️", "🔥", "🎉", "👏", "🚀", "💡", "✅"];

interface ParsedContent {
  text: string | null;
  pollData: any | null;
  locationData: any | null;
  voiceData: any | null;
  callData: any | null;
  attachments: MessageAttachment[];
}

function parseMessageContent(rawBody?: string | null): ParsedContent {
  if (!rawBody) return { text: null, pollData: null, locationData: null, voiceData: null, callData: null, attachments: [] };
  const str = rawBody.trim();

  if (str.startsWith("[POLL]:")) {
    try {
      return { text: null, pollData: JSON.parse(str.replace("[POLL]:", "")), locationData: null, voiceData: null, callData: null, attachments: [] };
    } catch (e) {}
  }

  if (str.startsWith("[LOCATION]:")) {
    try {
      return { text: null, pollData: null, locationData: JSON.parse(str.replace("[LOCATION]:", "")), voiceData: null, callData: null, attachments: [] };
    } catch (e) {}
  }

  if (str.startsWith("[CALL]:")) {
    try {
      return { text: null, pollData: null, locationData: null, voiceData: null, callData: JSON.parse(str.replace("[CALL]:", "")), attachments: [] };
    } catch (e) {}
  }

  if (str.startsWith("[VOICE]:")) {
    try {
      const v = JSON.parse(str.replace("[VOICE]:", ""));
      return {
        text: null,
        pollData: null,
        locationData: null,
        voiceData: {
          audioUrl: v.audioUrl || v.url || v.file_url || v.audio_url || (typeof v === "string" ? v : ""),
          duration: v.duration || v.durationSeconds || 0,
        },
        callData: null,
        attachments: [],
      };
    } catch (e) {
      const rest = str.replace("[VOICE]:", "").trim();
      return {
        text: null,
        pollData: null,
        locationData: null,
        voiceData: { audioUrl: rest, duration: 0 },
        callData: null,
        attachments: [],
      };
    }
  }

  if (str.includes("[ATTACHMENTS]:")) {
    try {
      const parts = str.split("[ATTACHMENTS]:");
      const textBefore = parts[0] || "";
      const jsonAndText = parts[1] || "";
      const newlineIdx = jsonAndText.indexOf("\n");
      let jsonStr = jsonAndText;
      let textAfter = "";
      if (newlineIdx !== -1) {
        jsonStr = jsonAndText.substring(0, newlineIdx);
        textAfter = jsonAndText.substring(newlineIdx + 1);
      }
      const atts: MessageAttachment[] = JSON.parse(jsonStr);
      const remainingText = (textBefore + (textAfter ? " " + textAfter : "")).trim();
      return {
        text: remainingText || null,
        pollData: null,
        locationData: null,
        voiceData: null,
        callData: null,
        attachments: atts,
      };
    } catch (e) {}
  }

  if (str.startsWith("data:image/")) {
    return {
      text: null,
      pollData: null,
      locationData: null,
      voiceData: null,
      callData: null,
      attachments: [
        {
          id: `att_${Date.now()}`,
          original_filename: "Photo",
          content_type: "image/png",
          size_bytes: 0,
          scan_status: "CLEAN",
          scanned_at: new Date().toISOString(),
          download_url: str,
          kind: "IMAGE",
        } as any,
      ],
    };
  }

  return { text: str, pollData: null, locationData: null, voiceData: null, callData: null, attachments: [] };
}

function formatSafePreview(raw?: string | null): string {
  if (!raw) return "(Attachment)";
  const parsed = parseMessageContent(raw);
  if (parsed.attachments && parsed.attachments.length > 0) {
    const hasImg = parsed.attachments.some(
      (a: any) =>
        a.kind === "IMAGE" ||
        a.content_type?.startsWith("image/") ||
        a.original_filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );
    return hasImg ? "📷 Photo" : "📎 Document";
  }
  if (parsed.voiceData) return "🎙️ Voice Note";
  if (parsed.pollData) return "📊 Poll";
  if (parsed.locationData) return "📍 Location";
  if (parsed.text) return parsed.text.length > 80 ? `${parsed.text.substring(0, 80)}...` : parsed.text;
  return "(Attachment)";
}

export const DiscussionCard: React.FC<DiscussionCardProps> = ({
  message,
  isMine,
  isImportant,
  replyToMessage,
  onReply,
  onReact,
  onVotePoll,
  onToggleImportant,
  onDeleteForMe,
  onDeleteForEveryone,
  onShowInfo,
  onJumpToReply,
  myId,
  isDirectChat,
  isAIChat,
  isReadByRecipient: propIsReadByRecipient,
  otherParticipantName,
  participants,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isHoveringWidget, setIsHoveringWidget] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<{ left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(true);
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const maxLeft = Math.max(50, rect.width - 340);
      const targetLeft = Math.min(Math.max(50, clickX - 100), maxLeft);
      setHoverPosition({ left: targetLeft });
    }
  };

  // Logical Read status calculation
  const isReadByRecipient = React.useMemo(() => {
    if (propIsReadByRecipient !== undefined) return propIsReadByRecipient;
    if (!isMine || !participants || participants.length === 0 || isAIChat) return false;
    const msgTime = new Date(message.created_at).getTime();
    if (isNaN(msgTime)) return false;

    const myIdStr = myId != null ? String(myId).toLowerCase() : "";

    if (isDirectChat) {
      const other = participants.find((p) => {
        const empId = p.employee?.id != null ? String(p.employee.id).toLowerCase() : (p.id != null ? String(p.id).toLowerCase() : "");
        return empId !== "" && empId !== myIdStr;
      });
      if (!other || !other.last_read_at) return false;
      const readTime = new Date(other.last_read_at).getTime();
      return !isNaN(readTime) && readTime >= msgTime;
    } else {
      const others = participants.filter((p) => {
        const empId = p.employee?.id != null ? String(p.employee.id).toLowerCase() : (p.id != null ? String(p.id).toLowerCase() : "");
        return empId !== "" && empId !== myIdStr;
      });
      if (others.length === 0) return false;
      const readers = others.filter((p) => {
        if (!p.last_read_at) return false;
        const readTime = new Date(p.last_read_at).getTime();
        return !isNaN(readTime) && readTime >= msgTime;
      });
      return readers.length > 0 ? readers.length : false;
    }
  }, [propIsReadByRecipient, isMine, isDirectChat, isAIChat, participants, myId, message.created_at]);

  if (message.is_deleted) {
    return (
      <div style={{ padding: "8px 24px" }}>
        <div
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            background: "var(--bms-bg, rgba(0, 0, 0, 0.02))",
            border: "1px dashed var(--bms-border, rgba(0, 0, 0, 0.12))",
            color: "var(--bms-text-3, #8c8c8c)",
            fontStyle: "italic",
            fontSize: 12.5,
          }}
        >
          <DeleteOutlined style={{ marginRight: 6 }} /> This discussion message was deleted.
        </div>
      </div>
    );
  }

  const { text: cleanText, pollData, locationData, voiceData, callData, attachments: bodyAttachments } = parseMessageContent(message.body);

  const allAttachments = React.useMemo(() => {
    const rawList = [...(message.attachments || []), ...(bodyAttachments || [])];
    const seen = new Set<string>();
    return rawList.filter((att) => {
      if (!att) return false;
      const key = att.id || att.download_url || att.original_filename || JSON.stringify(att);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [message.attachments, bodyAttachments]);

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
        alertToast("Image copied to clipboard! (Ready to paste)");
        return;
      }
    } catch (err) {
      console.warn("Clipboard full image copy failed:", err);
    }

    try {
      await navigator.clipboard.writeText(imageUrl);
      alertToast("Image link copied!");
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

  const alertToast = (msg: string) => {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.position = "fixed";
    el.style.bottom = "30px";
    el.style.left = "50%";
    el.style.transform = "translateX(-50%)";
    el.style.background = "#1e293b";
    el.style.color = "#ffffff";
    el.style.padding = "8px 16px";
    el.style.borderRadius = "20px";
    el.style.fontSize = "13px";
    el.style.zIndex = "99999";
    el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    document.body.appendChild(el);
    setTimeout(() => {
      document.body.removeChild(el);
    }, 2500);
  };

  const reactions = message.reaction_summary || {};
  const hasReactions = Object.keys(reactions).length > 0;

  const isAI = message.sender?.id === "ai_bot" || message.sender?.full_name?.toLowerCase().includes("ai assistant");
  const isAIMode = isAI || isAIChat || message.conversation === "ai_bot";
  const senderName = isMine ? "You" : isAI ? "Nexus AI Assistant" : message.sender?.full_name || "Employee";
  const senderInitial = isAI ? "✨" : message.sender?.full_name?.charAt(0)?.toUpperCase() || "E";
  const senderAvatar = isAI ? null : message.sender?.profile_picture_url || null;

  return (
    <div
      ref={cardRef}
      style={{
        padding: "6px 24px",
        background: "transparent",
        position: "relative",
        display: "flex",
        flexDirection: isMine ? "row-reverse" : "row",
        gap: 12,
        alignItems: "flex-start",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* 1. Author Avatar */}
      {isAI ? (
        <AIAvatarIcon size={36} style={{ marginTop: 2, flexShrink: 0 }} />
      ) : (
        <Avatar
          src={senderAvatar}
          size={36}
          style={{
            background: isMine ? "var(--bms-primary, #1677ff)" : "#722ed1",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 13.5,
            flexShrink: 0,
            marginTop: 2,
            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          }}
        >
          {senderInitial}
        </Avatar>
      )}

      {/* 2. Main Discussion Content Block */}
      <div
        style={{
          maxWidth: "75%",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: isMine ? "flex-end" : "flex-start",
        }}
      >
        {/* Author Stamp + Role Badge + Timestamp + Seen Micro-Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
            flexDirection: isMine ? "row-reverse" : "row",
          }}
        >
          <Text style={{ fontWeight: 700, fontSize: 13, color: isAI ? "#6366f1" : "var(--bms-text, #1e293b)" }}>
            {senderName}
          </Text>

          {!isAI && (senderName !== "You" || !isMine) && (
            <Tag
              bordered={false}
              color={isMine ? "blue" : "default"}
              style={{
                margin: 0,
                fontSize: 10,
                padding: "0 6px",
                borderRadius: 4,
                fontWeight: 600,
                lineHeight: "16px",
              }}
            >
              {isMine ? "You" : "Staff"}
            </Tag>
          )}

          <Text style={{ fontSize: 11, color: "var(--bms-text-3, #94a3b8)" }}>
            {dayjs(message.created_at).format("h:mm A")}
          </Text>

          {isImportant && (
            <Tag color="warning" style={{ margin: 0, padding: "0 6px", fontSize: 10, borderRadius: 4 }}>
              <PushpinFilled style={{ marginRight: 3 }} /> Pinned
            </Tag>
          )}

          {/* Logical Read / Sent Status Pill */}
          {isMine && (
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
                color={isReadByRecipient ? "success" : "default"}
                style={{
                  margin: 0,
                  padding: "0 6px",
                  fontSize: 10,
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  cursor: "pointer",
                  lineHeight: "16px",
                  background: isReadByRecipient
                    ? "rgba(82, 196, 26, 0.12)"
                    : "rgba(0, 0, 0, 0.04)",
                  color: isReadByRecipient ? "#389e0d" : "#8c8c8c",
                }}
                onClick={() => onShowInfo(message)}
              >
                <CheckCircleFilled style={{ fontSize: 9 }} />
                <span>
                  {isReadByRecipient === true
                    ? "Read"
                    : typeof isReadByRecipient === "number"
                    ? `Read (${isReadByRecipient})`
                    : "Sent"}
                </span>
              </Tag>
            </Tooltip>
          )}
        </div>

        {/* Message Bubble Card */}
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            position: "relative",
            background: isMine
              ? "rgba(22, 119, 255, 0.07)"
              : isAI
              ? "rgba(99, 102, 241, 0.04)"
              : "var(--bms-surface, #ffffff)",
            border: isMine
              ? "1px solid rgba(22, 119, 255, 0.18)"
              : isAI
              ? "1px solid rgba(99, 102, 241, 0.18)"
              : "1px solid var(--bms-border, rgba(0, 0, 0, 0.08))",
            borderRadius: isMine ? "14px 2px 14px 14px" : "2px 14px 14px 14px",
            padding: "10px 14px",
            boxShadow: isMine ? "0 1px 3px rgba(22, 119, 255, 0.04)" : "0 1px 3px rgba(0, 0, 0, 0.03)",
            maxWidth: "100%",
            boxSizing: "border-box",
            textAlign: "left",
            width: "fit-content",
          }}
        >
          {/* Floating Card Actions */}
          {isHovered && !isHoveringWidget && !isAIMode && (
            <div
              style={{
                position: "absolute",
                top: -24,
                [isMine ? "right" : "left"]: 0,
                background: "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(12px)",
                border: "1px solid var(--bms-border, rgba(0, 0, 0, 0.12))",
                borderRadius: 12,
                padding: "3px 6px",
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)",
                display: "flex",
                alignItems: "center",
                gap: 2,
                zIndex: 30,
                animation: "fadeIn 0.15s ease-out",
                whiteSpace: "nowrap",
              }}
            >
              {COMMON_EMOJIS.slice(0, 4).map((emoji) => (
                <Tooltip key={emoji} title={emoji}>
                  <Button
                    type="text"
                    size="middle"
                    shape="circle"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReact(message.id, emoji);
                    }}
                    style={{
                      fontSize: 15,
                      padding: 0,
                      width: 28,
                      height: 28,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {emoji}
                  </Button>
                </Tooltip>
              ))}

              <div
                style={{
                  width: 1,
                  height: 18,
                  background: "var(--bms-border, rgba(0, 0, 0, 0.12))",
                  margin: "0 3px",
                }}
              />

              <Tooltip title="Reply / Quote">
                <Button
                  type="text"
                  size="middle"
                  shape="circle"
                  icon={<RollbackOutlined style={{ fontSize: 13, color: "var(--bms-text, #475569)" }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply(message);
                  }}
                  style={{ width: 28, height: 28 }}
                />
              </Tooltip>

              <Tooltip title={isImportant ? "Unpin Message" : "Pin Message"}>
                <Button
                  type="text"
                  size="middle"
                  shape="circle"
                  icon={
                    isImportant ? (
                      <PushpinFilled style={{ color: "#fa8c16", fontSize: 13 }} />
                    ) : (
                      <PushpinOutlined style={{ fontSize: 13, color: "var(--bms-text, #475569)" }} />
                    )
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleImportant(message.id);
                  }}
                  style={{ width: 28, height: 28 }}
                />
              </Tooltip>

              <Tooltip title="Seen Details">
                <Button
                  type="text"
                  size="middle"
                  shape="circle"
                  icon={<InfoCircleOutlined style={{ fontSize: 13, color: "var(--bms-text, #475569)" }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowInfo(message);
                  }}
                  style={{ width: 28, height: 28 }}
                />
              </Tooltip>

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
                      key: "del_me",
                      label: "Delete for Me",
                      icon: <DeleteOutlined />,
                      danger: true,
                      onClick: () => onDeleteForMe(message.id),
                    },
                    ...(isMine && onDeleteForEveryone
                      ? [
                          {
                            key: "del_all",
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
                  size="middle"
                  shape="circle"
                  icon={<MoreOutlined style={{ fontSize: 14, color: "var(--bms-text, #475569)" }} />}
                  style={{ width: 28, height: 28 }}
                />
              </Dropdown>
            </div>
          )}
          {/* Reply Reference Card */}
          {replyToMessage && (
            <div
              onClick={() => onJumpToReply && onJumpToReply(replyToMessage.id)}
              style={{
                background: "var(--bms-bg, rgba(0, 0, 0, 0.03))",
                borderLeft: "3px solid var(--bms-primary, #1677ff)",
                borderRadius: 6,
                padding: "5px 10px",
                marginBottom: 6,
                cursor: "pointer",
                maxWidth: 500,
              }}
            >
              <Text style={{ fontWeight: 600, fontSize: 11, color: "var(--bms-primary)" }}>
                Replying to {replyToMessage.sender?.full_name || "Message"}
              </Text>
              <Paragraph
                ellipsis={{ rows: 1 }}
                style={{ margin: 0, fontSize: 12, color: "var(--bms-text-2, #64748b)" }}
              >
                {formatSafePreview(replyToMessage.body)}
              </Paragraph>
            </div>
          )}

          {/* Message Text Content */}
          {cleanText && !allAttachments.some((att) => att.original_filename === cleanText) && (
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "var(--bms-text, #1e293b)",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {cleanText}
            </div>
          )}

        {/* Embedded Interactive Poll */}
        {pollData && (
          <div
            style={{ marginTop: 6, maxWidth: 440 }}
            onMouseEnter={() => setIsHoveringWidget(true)}
            onMouseLeave={() => setIsHoveringWidget(false)}
          >
            <PollWidget
              poll={pollData}
              messageId={message.id}
              currentUserId={myId}
              isSentByMe={isMine}
              participants={participants}
              onVote={(pollId, optionId, optionIndex) =>
                onVotePoll?.(message.id, pollId, optionId, optionIndex)
              }
            />
          </div>
        )}

        {/* Embedded Location Card */}
        {locationData && (
          <div
            style={{ marginTop: 6, maxWidth: 420 }}
            onMouseEnter={() => setIsHoveringWidget(true)}
            onMouseLeave={() => setIsHoveringWidget(false)}
          >
            <LocationWidget
              location={locationData}
              isSentByMe={isMine}
            />
          </div>
        )}

        {/* Embedded Voice Waveform */}
        {voiceData && (
          <div
            style={{ marginTop: 6, maxWidth: 360 }}
            onMouseEnter={() => setIsHoveringWidget(true)}
            onMouseLeave={() => setIsHoveringWidget(false)}
          >
            <AudioPlayer audioUrl={voiceData.audioUrl || ""} duration={voiceData.duration || 0} isMine={isMine} />
          </div>
        )}

        {/* Embedded Inline Call Event Card */}
        {callData && (
          <div
            style={{ marginTop: 4 }}
            onMouseEnter={() => setIsHoveringWidget(true)}
            onMouseLeave={() => setIsHoveringWidget(false)}
          >
            <InlineCallCard callData={callData} isMine={isMine} createdAt={message.created_at} />
          </div>
        )}

        {/* File & Image Attachments */}
        {allAttachments.length > 0 && (
          <div style={{ marginTop: cleanText ? 8 : 4, display: "flex", flexDirection: "column", gap: 8 }}>
            {allAttachments.map((att: MessageAttachment) => {
              const isExplicitDoc = (att as any).kind === "DOCUMENT";
              const isImg =
                !isExplicitDoc &&
                (att.content_type?.startsWith("image/") ||
                  att.original_filename?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i));
              const isAudio =
                att.content_type?.startsWith("audio/") ||
                att.original_filename?.match(/\.(webm|mp3|wav|ogg|m4a|aac)$/i);

              if (isAudio && att.download_url) {
                if (voiceData) return null;
                return (
                  <div
                    key={att.id}
                    style={{ marginTop: 4 }}
                    onMouseEnter={() => setIsHoveringWidget(true)}
                    onMouseLeave={() => setIsHoveringWidget(false)}
                  >
                    <AudioPlayer audioUrl={att.download_url} isMine={isMine} />
                  </div>
                );
              }

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
                            alertToast("File link copied!");
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
        </div>

        {/* Reaction Badges */}
        {!isAIMode && hasReactions && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginTop: 4,
              justifyContent: isMine ? "flex-end" : "flex-start",
            }}
          >
            {Object.entries(reactions).map(([emoji, users]) => {
              const userIds = Array.isArray(users) ? users : [];
              const reactedByMe = myId ? userIds.includes(myId) : false;
              const otherUserIds = userIds.filter((id) => id !== myId);

              const getEmployeeName = (id: string) => {
                const p = participants?.find(
                  (part) =>
                    String(part.employee?.id || part.id).toLowerCase() === String(id).toLowerCase()
                );
                if (p?.employee?.full_name) return p.employee.full_name;
                if (otherParticipantName && (!myId || String(id).toLowerCase() !== String(myId).toLowerCase())) {
                  return otherParticipantName;
                }
                return "Colleague";
              };

              let tooltipText = "";
              if (reactedByMe && otherUserIds.length === 0) {
                tooltipText = "Tap to remove";
              } else if (reactedByMe && otherUserIds.length > 0) {
                const otherNames = otherUserIds.map(getEmployeeName).join(", ");
                return (
                  <Tooltip key={emoji} title={`You and ${otherNames} (Tap to remove)`}>
                    <button
                      onClick={() => onReact(message.id, emoji)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: "rgba(22, 119, 255, 0.12)",
                        border: "1px solid var(--bms-primary, #1677ff)",
                        cursor: "pointer",
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "var(--bms-primary)",
                      }}
                    >
                      <span>{emoji}</span>
                      <span>{userIds.length}</span>
                    </button>
                  </Tooltip>
                );
              } else {
                const names = userIds.map(getEmployeeName).join(", ");
                tooltipText = `Reacted by ${names}`;
              }

              return (
                <Tooltip key={emoji} title={tooltipText}>
                  <button
                    onClick={() => {
                      if (reactedByMe) {
                        onReact(message.id, emoji);
                      }
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: reactedByMe
                        ? "rgba(22, 119, 255, 0.12)"
                        : "var(--bms-surface, #ffffff)",
                      border: reactedByMe
                        ? "1px solid var(--bms-primary, #1677ff)"
                        : "1px solid var(--bms-border, rgba(0,0,0,0.1))",
                      cursor: reactedByMe ? "pointer" : "default",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: reactedByMe ? "var(--bms-primary)" : "var(--bms-text)",
                    }}
                  >
                    <span>{emoji}</span>
                    <span>{userIds.length}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscussionCard;
