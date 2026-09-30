import React from "react";
import { PhoneOutlined, VideoCameraOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export interface InlineCallData {
  call_id?: string;
  call_type?: "VOICE" | "VIDEO" | string;
  status?: "started" | "COMPLETED" | "ENDED" | "MISSED" | "DECLINED" | string;
  duration_seconds?: number;
  caller_id?: string;
  recipient_id?: string;
  created_at?: string;
}

interface InlineCallCardProps {
  callData: InlineCallData;
  isMine: boolean;
  createdAt: string;
}

export const InlineCallCard: React.FC<InlineCallCardProps> = ({
  callData,
  isMine,
  createdAt,
}) => {
  const isVideo = callData.call_type?.toUpperCase() === "VIDEO";
  const stUpper = (callData.status || "").toUpperCase();
  const isStarted = stUpper === "STARTED" || stUpper === "RINGING";
  const isCompleted = stUpper === "COMPLETED" || stUpper === "ENDED";
  const isMissed = stUpper === "MISSED";
  const isDeclined = stUpper === "DECLINED";

  const durationSec = Number(callData.duration_seconds || 0);

  const formatDuration = (totalSec: number) => {
    if (totalSec <= 0) return "";
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  let title = isVideo ? "Video call" : "Audio call";
  let subtitle = "";
  let badgeBg = "#64748b"; // sleek neutral slate grey avatar like reference screenshot

  if (isStarted) {
    title = isVideo ? "Video call started" : "Audio call started";
    subtitle = "";
    badgeBg = "#64748b";
  } else if (isMissed) {
    title = isVideo ? "Missed video call" : "Missed audio call";
    subtitle = "No answer";
    badgeBg = "#ef4444";
  } else if (isDeclined) {
    title = isVideo ? "Declined video call" : "Declined audio call";
    subtitle = "No answer";
    badgeBg = "#ef4444";
  } else if (isCompleted) {
    title = isVideo ? "Video call ended" : "Audio call ended";
    const durStr = formatDuration(durationSec);
    subtitle = durStr ? `Duration: ${durStr}` : "";
    badgeBg = "#10b981";
  }

  const formattedTime = dayjs(createdAt || callData.created_at).format("h:mm A");

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderRadius: 16,
        background: "var(--bms-surface, #ffffff)",
        border: `1.5px solid ${isMissed || isDeclined ? "rgba(239, 68, 68, 0.3)" : isCompleted ? "rgba(16, 185, 129, 0.3)" : "var(--bms-border, rgba(0,0,0,0.12))"}`,
        marginTop: 4,
        marginBottom: 4,
        minWidth: 240,
        maxWidth: 320,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          backgroundColor: badgeBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {isVideo ? <VideoCameraOutlined /> : <PhoneOutlined />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--bms-text, #1e293b)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--bms-text-3, #64748b)",
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span>{subtitle}</span>
          <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>{formattedTime}</span>
        </div>
      </div>
    </div>
  );
};

export default InlineCallCard;
