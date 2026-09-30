import React, { useState, useRef } from "react";
import {
  SendOutlined,
  SmileOutlined,
  AudioOutlined,
  PictureOutlined,
  FileTextOutlined,
  BarChartOutlined,
  EnvironmentOutlined,
  CameraOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import {
  Input as AntInput,
  Button as AntButton,
  Tooltip as AntTooltip,
  Typography as AntTypography,
  Popover as AntPopover,
} from "antd";
import { ChatMessage } from "@/services/chat";
import VoiceRecorder from "./VoiceRecorder";
import PollModal from "./PollModal";
import LocationModal from "./LocationModal";
import CameraModal from "./CameraModal";

const { TextArea } = AntInput;
const { Text } = AntTypography;

export interface ComposerAttachment {
  file: File;
  kind: "IMAGE" | "DOCUMENT";
}

interface WorkspaceComposerProps {
  onSendMessage: (text: string, attachments?: ComposerAttachment[]) => void;
  onSendVoiceMessage: (audioBlob: Blob, duration: number) => void;
  onSendPoll: (question: string, options: string[], allowMultiple?: boolean) => void;
  onSendLocation: (loc: any) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  disabled?: boolean;
  isCompact?: boolean;
}

const EMOJIS = [
  "👍", "👏", "🔥", "🎉", "✨", "💯", "❤️", "🚀", "💡", "✅",
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "😉", "😍", "🥰", "😎", "🤩", "🥳", "🤔", "🧐", "🙏"
];

export const WorkspaceComposer: React.FC<WorkspaceComposerProps> = ({
  onSendMessage,
  onSendVoiceMessage,
  onSendPoll,
  onSendLocation,
  onTypingStart,
  onTypingStop,
  replyingTo,
  onCancelReply,
  disabled,
  isCompact,
}) => {
  const [text, setText] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<ComposerAttachment[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (onTypingStart) {
      onTypingStart();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (onTypingStop) onTypingStop();
      }, 2000);
    }
  };

  const handleSend = () => {
    const hasText = Boolean(text.trim());
    const hasAttachments = selectedAttachments.length > 0;
    if ((!hasText && !hasAttachments) || disabled) return;

    onSendMessage(text.trim(), hasAttachments ? selectedAttachments : undefined);
    setText("");
    setSelectedAttachments([]);
    if (onTypingStop) onTypingStop();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Media (Photo/Video) picker -> Tagged explicitly as IMAGE
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems: ComposerAttachment[] = Array.from(e.target.files).map((file) => ({
        file,
        kind: "IMAGE",
      }));
      setSelectedAttachments((prev) => [...prev, ...newItems]);
      e.target.value = "";
    }
  };

  // File (Document) picker -> Tagged explicitly as DOCUMENT (even if it is an image file)
  const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems: ComposerAttachment[] = Array.from(e.target.files).map((file) => ({
        file,
        kind: "DOCUMENT",
      }));
      setSelectedAttachments((prev) => [...prev, ...newItems]);
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setSelectedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setEmojiOpen(false);
  };

  const canSend = Boolean(text.trim()) || selectedAttachments.length > 0;

  return (
    <div
      style={{
        background: "var(--bms-surface, #ffffff)",
        borderTop: "1px solid var(--bms-border, rgba(0, 0, 0, 0.08))",
        padding: "12px 20px 14px 20px",
      }}
    >
      <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleDocFileSelect} multiple />
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={handleMediaSelect}
        multiple
      />

      {/* Reply Quote Banner */}
      {replyingTo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 12px",
            background: "var(--bms-bg, rgba(22, 119, 255, 0.06))",
            borderLeft: "3px solid var(--bms-primary, #1677ff)",
            borderRadius: 6,
            marginBottom: 8,
          }}
        >
          <div>
            <Text style={{ fontWeight: 600, fontSize: 11, color: "var(--bms-primary)" }}>
              Replying to {replyingTo.sender?.full_name || "Message"}
            </Text>
            <Text ellipsis style={{ fontSize: 12, color: "var(--bms-text-2)", display: "block" }}>
              {replyingTo.body || "(Attachment)"}
            </Text>
          </div>
          <AntButton
            type="text"
            size="small"
            shape="circle"
            icon={<CloseOutlined style={{ fontSize: 11 }} />}
            onClick={onCancelReply}
          />
        </div>
      )}

      {/* Voice Recorder Mode */}
      {isRecordingVoice ? (
        <VoiceRecorder
          onFinishRecording={(blob, duration) => {
            onSendVoiceMessage(blob, duration);
            setIsRecordingVoice(false);
          }}
          onCancelRecording={() => setIsRecordingVoice(false)}
        />
      ) : (
        /* Workspace Studio Box */
        <div
          style={{
            border: "1px solid var(--bms-border, rgba(0, 0, 0, 0.12))",
            borderRadius: 12,
            background: "var(--bms-bg, #f8fafc)",
            overflow: "hidden",
            transition: "border-color 0.15s ease",
          }}
        >
          {/* Studio Action Toolbar */}
          <div
            style={{
              padding: isCompact ? "4px 8px" : "6px 10px",
              borderBottom: "1px solid var(--bms-border, rgba(0, 0, 0, 0.06))",
              display: "flex",
              alignItems: "center",
              gap: isCompact ? 2 : 4,
              background: "var(--bms-surface, #ffffff)",
              overflowX: "auto",
            }}
          >
            <AntTooltip title="Attach Image / Photo (Sent as Image)">
              <AntButton
                type="text"
                size="small"
                shape={isCompact ? "circle" : "default"}
                icon={<PictureOutlined style={{ fontSize: 15, color: disabled ? "#94a3b8" : "var(--bms-primary, #1677ff)" }} />}
                onClick={() => !disabled && imageInputRef.current?.click()}
                disabled={disabled}
                style={isCompact ? { width: 28, height: 28 } : undefined}
              >
                {!isCompact && "Media"}
              </AntButton>
            </AntTooltip>

            <AntTooltip title="Attach Document / File (Sent as Document File)">
              <AntButton
                type="text"
                size="small"
                shape={isCompact ? "circle" : "default"}
                icon={<FileTextOutlined style={{ fontSize: 15, color: disabled ? "#94a3b8" : "#fa8c16" }} />}
                onClick={() => !disabled && fileInputRef.current?.click()}
                disabled={disabled}
                style={isCompact ? { width: 28, height: 28 } : undefined}
              >
                {!isCompact && "File"}
              </AntButton>
            </AntTooltip>

            <AntTooltip title="Create Team Poll">
              <AntButton
                type="text"
                size="small"
                shape={isCompact ? "circle" : "default"}
                icon={<BarChartOutlined style={{ fontSize: 15, color: disabled ? "#94a3b8" : "#52c41a" }} />}
                onClick={() => !disabled && setPollModalOpen(true)}
                disabled={disabled}
                style={isCompact ? { width: 28, height: 28 } : undefined}
              >
                {!isCompact && "Poll"}
              </AntButton>
            </AntTooltip>

            <AntTooltip title="Share GPS Location">
              <AntButton
                type="text"
                size="small"
                shape={isCompact ? "circle" : "default"}
                icon={<EnvironmentOutlined style={{ fontSize: 15, color: disabled ? "#94a3b8" : "#eb2f96" }} />}
                onClick={() => !disabled && setLocationModalOpen(true)}
                disabled={disabled}
                style={isCompact ? { width: 28, height: 28 } : undefined}
              >
                {!isCompact && "Location"}
              </AntButton>
            </AntTooltip>

            <AntTooltip title="Take Camera Snapshot">
              <AntButton
                type="text"
                size="small"
                shape={isCompact ? "circle" : "default"}
                icon={<CameraOutlined style={{ fontSize: 15, color: disabled ? "#94a3b8" : "#722ed1" }} />}
                onClick={() => !disabled && setCameraModalOpen(true)}
                disabled={disabled}
                style={isCompact ? { width: 28, height: 28 } : undefined}
              >
                {!isCompact && "Camera"}
              </AntButton>
            </AntTooltip>

            <AntPopover
              content={
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, padding: 4 }}>
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => addEmoji(e)}
                      style={{
                        background: "transparent",
                        border: "none",
                        fontSize: 18,
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              }
              trigger="click"
              open={!disabled && emojiOpen}
              onOpenChange={(v) => !disabled && setEmojiOpen(v)}
            >
              <AntTooltip title="Add Emoji">
                <AntButton
                  type="text"
                  size="small"
                  shape={isCompact ? "circle" : "default"}
                  icon={<SmileOutlined style={{ fontSize: 15, color: disabled ? "#94a3b8" : "#faad14" }} />}
                  disabled={disabled}
                  style={isCompact ? { width: 28, height: 28 } : undefined}
                >
                  {!isCompact && "Emoji"}
                </AntButton>
              </AntTooltip>
            </AntPopover>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
              <AntTooltip title="Record Voice Note">
                <AntButton
                  type="text"
                  size="small"
                  shape={isCompact ? "circle" : "default"}
                  icon={<AudioOutlined style={{ fontSize: 15, color: disabled ? "#94a3b8" : "var(--bms-primary, #1677ff)" }} />}
                  onClick={() => !disabled && setIsRecordingVoice(true)}
                  disabled={disabled}
                  style={isCompact ? { width: 28, height: 28 } : undefined}
                >
                  {!isCompact && "Voice"}
                </AntButton>
              </AntTooltip>
            </div>
          </div>

          {/* Selected Attachments Preview Queue */}
          {selectedAttachments.length > 0 && (
            <div
              style={{
                padding: "8px 12px",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                background: "var(--bms-bg, rgba(0, 0, 0, 0.02))",
                borderBottom: "1px solid var(--bms-border, rgba(0, 0, 0, 0.06))",
              }}
            >
              {selectedAttachments.map((item, idx) => {
                const { file, kind } = item;
                const isImgKind = kind === "IMAGE";
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 8px 4px 6px",
                      borderRadius: 8,
                      background: "var(--bms-surface, #ffffff)",
                      border: "1px solid var(--bms-border, rgba(0, 0, 0, 0.12))",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                      maxWidth: 240,
                    }}
                  >
                    {isImgKind ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }}
                      />
                    ) : (
                      <FileTextOutlined style={{ fontSize: 18, color: "#fa8c16" }} />
                    )}
                    <div style={{ overflow: "hidden", flex: 1 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                          color: "var(--bms-text, #1e293b)",
                        }}
                        title={file.name}
                      >
                        {file.name}
                      </span>
                      <span style={{ fontSize: 10, color: isImgKind ? "var(--bms-primary)" : "#fa8c16" }}>
                        {isImgKind ? "Image" : "Document"}
                      </span>
                    </div>
                    <AntButton
                      type="text"
                      size="small"
                      shape="circle"
                      icon={<CloseOutlined style={{ fontSize: 10 }} />}
                      onClick={() => removeAttachment(idx)}
                      style={{ width: 20, height: 20, flexShrink: 0 }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Text Area + Send Bar */}
          <div style={{ padding: "8px 12px 8px 12px", display: "flex", alignItems: "flex-end", gap: 10 }}>
            <TextArea
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? "Nexus AI is generating a response, please wait..." : "Type your message, discussion note, or paste links... (Enter to send, Shift+Enter for new line)"}
              autoSize={{ minRows: 2, maxRows: 6 }}
              disabled={disabled}
              variant="borderless"
              style={{ padding: 0, resize: "none", fontSize: 13.5, color: "var(--bms-text)" }}
            />

            <AntButton
              type="primary"
              shape="round"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!canSend || disabled}
              style={{
                fontWeight: 600,
                boxShadow: canSend ? "0 2px 6px rgba(22, 119, 255, 0.25)" : "none",
                flexShrink: 0,
              }}
            >
              Send
            </AntButton>
          </div>
        </div>
      )}

      {/* Modals for Poll, Location, Camera */}
      <PollModal
        open={pollModalOpen}
        onClose={() => setPollModalOpen(false)}
        onSubmit={(q, opts, allowMultiple) => {
          onSendPoll(q, opts, allowMultiple);
          setPollModalOpen(false);
        }}
      />
      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSubmit={(loc) => {
          onSendLocation(loc);
          setLocationModalOpen(false);
        }}
      />
      <CameraModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapturePhoto={(f) => {
          setSelectedAttachments((prev) => [...prev, { file: f, kind: "IMAGE" }]);
          setCameraModalOpen(false);
        }}
      />
    </div>
  );
};

export default WorkspaceComposer;
