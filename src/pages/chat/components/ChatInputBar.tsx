import React, { useState, useRef, useEffect } from "react";
import {
  Input,
  Button,
  Tooltip,
  Dropdown,
  Typography,
  Popover,
  Space,
} from "antd";
import {
  SendOutlined,
  PaperClipOutlined,
  SmileOutlined,
  AudioOutlined,
  PictureOutlined,
  FileTextOutlined,
  BarChartOutlined,
  EnvironmentOutlined,
  CameraOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { ChatMessage } from "@/services/chat";
import VoiceRecorder from "./VoiceRecorder";
import PollModal from "./PollModal";
import LocationModal from "./LocationModal";
import CameraModal from "./CameraModal";

const { TextArea } = Input;
const { Text } = Typography;

interface ChatInputBarProps {
  onSendMessage: (text: string, attachmentFiles?: File[]) => void;
  onSendVoiceMessage: (audioBlob: Blob, duration: number) => void;
  onSendPoll: (question: string, options: string[]) => void;
  onSendLocation: (location: { latitude: number; longitude: number; name: string; address?: string }) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  disabled?: boolean;
}

const EMOJI_LIST = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
  "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣",
  "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬",
  "👍", "👎", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🚀",
  "🔥", "🎉", "✨", "💯", "❤️", "🧡", "💛", "💚", "💙", "💜",
  "✅", "❌", "⚠️", "💡", "📌", "💼", "📊", "🎯", "⚡", "🕒"
];

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  onSendVoiceMessage,
  onSendPoll,
  onSendLocation,
  onTypingStart,
  onTypingStop,
  replyingTo,
  onCancelReply,
  disabled,
}) => {
  const [text, setText] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Trigger typing state
    if (onTypingStart) {
      onTypingStart();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (onTypingStop) onTypingStop();
      }, 2000);
    }
  };

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText("");
    if (onTypingStop) onTypingStop();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onSendMessage("", files);
      e.target.value = "";
    }
  };

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setEmojiPopoverOpen(false);
  };

  return (
    <div
      style={{
        padding: "12px 24px 16px 24px",
        background: "var(--bms-surface, #ffffff)",
        borderTop: "1px solid var(--bms-border, rgba(0, 0, 0, 0.08))",
      }}
    >
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelect}
        multiple
      />
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={handleFileSelect}
        multiple
      />

      {/* Reply Quote Banner */}
      {replyingTo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            background: "var(--bms-bg, rgba(22, 119, 255, 0.06))",
            borderLeft: "3px solid var(--bms-primary, #1677ff)",
            borderRadius: 8,
            marginBottom: 10,
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <Text style={{ fontWeight: 600, fontSize: 12, color: "var(--bms-primary)" }}>
              Replying to {replyingTo.sender?.full_name || "Message"}
            </Text>
            <Text
              ellipsis
              style={{ fontSize: 12, color: "var(--bms-text-2)", display: "block" }}
            >
              {replyingTo.body || "(Attachment)"}
            </Text>
          </div>
          <Button
            type="text"
            size="small"
            shape="circle"
            icon={<CloseOutlined style={{ fontSize: 12 }} />}
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
        /* Standard Enterprise Composer */
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            background: "var(--bms-bg, #f8fafc)",
            border: "1px solid var(--bms-border, rgba(0, 0, 0, 0.1))",
            borderRadius: 14,
            padding: "6px 12px",
            transition: "border-color 0.15s ease",
          }}
        >
          {/* Attachments Dropdown Menu */}
          <Dropdown
            menu={{
              items: [
                {
                  key: "photo",
                  label: "Photos & Media",
                  icon: <PictureOutlined style={{ color: "var(--bms-primary)" }} />,
                  onClick: () => imageInputRef.current?.click(),
                },
                {
                  key: "doc",
                  label: "Document File",
                  icon: <FileTextOutlined style={{ color: "#fa8c16" }} />,
                  onClick: () => fileInputRef.current?.click(),
                },
                {
                  key: "poll",
                  label: "Team Poll",
                  icon: <BarChartOutlined style={{ color: "#52c41a" }} />,
                  onClick: () => setPollModalOpen(true),
                },
                {
                  key: "location",
                  label: "Share Location",
                  icon: <EnvironmentOutlined style={{ color: "#eb2f96" }} />,
                  onClick: () => setLocationModalOpen(true),
                },
                {
                  key: "camera",
                  label: "Camera Photo",
                  icon: <CameraOutlined style={{ color: "#722ed1" }} />,
                  onClick: () => setCameraModalOpen(true),
                },
              ],
            }}
            trigger={["click"]}
            placement="topLeft"
          >
            <Button
              type="text"
              shape="circle"
              icon={<PaperClipOutlined style={{ fontSize: 18, color: "var(--bms-text-3)" }} />}
              style={{ marginBottom: 4 }}
            />
          </Dropdown>

          {/* Emoji Picker Popover */}
          <Popover
            content={
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(10, 1fr)",
                  gap: 4,
                  maxWidth: 320,
                  maxHeight: 220,
                  overflowY: "auto",
                  padding: 4,
                }}
              >
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => addEmoji(emoji)}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: 18,
                      cursor: "pointer",
                      padding: 4,
                      borderRadius: 4,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            }
            trigger="click"
            open={emojiPopoverOpen}
            onOpenChange={setEmojiPopoverOpen}
            placement="topLeft"
          >
            <Button
              type="text"
              shape="circle"
              icon={<SmileOutlined style={{ fontSize: 18, color: "var(--bms-text-3)" }} />}
              style={{ marginBottom: 4 }}
            />
          </Popover>

          {/* Text Area */}
          <TextArea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a message... (Enter to send, Shift+Enter for new line)"
            autoSize={{ minRows: 1, maxRows: 5 }}
            disabled={disabled}
            variant="borderless"
            style={{
              padding: "6px 4px",
              resize: "none",
              fontSize: 14,
              color: "var(--bms-text)",
            }}
          />

          {/* Voice Record / Send Button */}
          {text.trim().length === 0 ? (
            <Tooltip title="Hold or click to record voice note">
              <Button
                type="text"
                shape="circle"
                icon={<AudioOutlined style={{ fontSize: 18, color: "var(--bms-primary)" }} />}
                onClick={() => setIsRecordingVoice(true)}
                style={{ marginBottom: 4 }}
              />
            </Tooltip>
          ) : (
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined style={{ fontSize: 15 }} />}
              onClick={handleSend}
              disabled={disabled}
              style={{
                marginBottom: 4,
                boxShadow: "0 2px 6px rgba(22, 119, 255, 0.3)",
              }}
            />
          )}
        </div>
      )}

      {/* Modals for Poll, Location, Camera */}
      <PollModal
        open={pollModalOpen}
        onClose={() => setPollModalOpen(false)}
        onSubmit={(question, options) => {
          onSendPoll(question, options);
          setPollModalOpen(false);
        }}
      />

      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSubmit={(loc) => {
          onSendLocation(loc as any);
          setLocationModalOpen(false);
        }}
      />

      <CameraModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={(file) => {
          onSendMessage("", [file]);
          setCameraModalOpen(false);
        }}
        onCapturePhoto={(file) => {
          onSendMessage("", [file]);
          setCameraModalOpen(false);
        }}
      />
    </div>
  );
};

export default ChatInputBar;
