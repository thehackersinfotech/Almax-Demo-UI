import React from "react";
import { Button, Tooltip } from "antd";
import { PushpinOutlined, CloseOutlined } from "@ant-design/icons";
import { ChatMessage } from "@/services/chat";

interface PinnedMessageBannerProps {
  message: ChatMessage | null;
  onUnpin: () => void;
  onJumpToMessage: (messageId: string) => void;
}

export const PinnedMessageBanner: React.FC<PinnedMessageBannerProps> = ({
  message,
  onUnpin,
  onJumpToMessage,
}) => {
  if (!message) return null;

  const handleJump = () => {
    onJumpToMessage(message.id);
    const el = document.getElementById(`msg-${message.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const innerBubble = el.querySelector(".message-bubble-container") as HTMLElement;
      if (innerBubble) {
        innerBubble.style.transition = "all 0.3s ease";
        const origBg = innerBubble.style.background;
        innerBubble.style.background = "#ffe58f";
        innerBubble.style.boxShadow = "0 0 12px #faad14";
        setTimeout(() => {
          innerBubble.style.background = origBg;
          innerBubble.style.boxShadow = "";
        }, 1800);
      }
    }
  };

  return (
    <div
      style={{
        padding: "8px 16px",
        background: "rgba(37, 99, 235, 0.08)",
        borderBottom: "1px solid rgba(37, 99, 235, 0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        zIndex: 4,
      }}
      onClick={handleJump}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, overflow: "hidden" }}>
        <PushpinOutlined style={{ color: "#2563eb", fontSize: 16 }} />
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", display: "block" }}>
            Pinned Message ({message.sender?.full_name || "User"})
          </span>
          <span style={{ fontSize: 12, color: "#595959" }}>
            {message.body?.startsWith("{") ? "[Special Content]" : message.body || "[Attachment]"}
          </span>
        </div>
      </div>

      <Tooltip title="Unpin Message">
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined style={{ fontSize: 12 }} />}
          onClick={(e) => {
            e.stopPropagation();
            onUnpin();
          }}
        />
      </Tooltip>
    </div>
  );
};

export default PinnedMessageBanner;
