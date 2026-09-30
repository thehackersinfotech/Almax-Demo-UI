import React, { useEffect, useState } from "react";
import {
  CloseOutlined,
  CheckOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { CallRecord } from "@/services/chat";
import { callSounds } from "@/utils/callSounds";

interface IncomingCallModalProps {
  call: CallRecord | null;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  call,
  onAccept,
  onDecline,
}) => {
  const [countdown, setCountdown] = useState(45);

  useEffect(() => {
    if (call && call.status === "RINGING") {
      callSounds.playIncomingRingtone();
      setCountdown(45);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            callSounds.stopRingtone();
            callSounds.playCutSound();
            onDecline();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(timer);
        callSounds.stopRingtone();
      };
    } else {
      callSounds.stopRingtone();
    }
  }, [call?._id, call?.status]);

  if (!call || call.status !== "RINGING") return null;

  const callerName = call.caller?.full_name || "Unknown User";
  const avatarUrl = call.caller?.profile_picture_url;
  const isVideo = call.call_type === "VIDEO";

  return (
    <div
      style={{
        position: "fixed",
        top: 76,
        right: 20,
        zIndex: 9999,
        width: 340,
        maxHeight: "calc(100vh - 90px)",
        borderRadius: 20,
        background: "#0c1322",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        animation: "fadeInUp 0.2s ease-out",
      }}
    >
      {/* ── TOP HEADER BAR ── */}
      <div
        style={{
          background: "linear-gradient(90deg, #134e5e 0%, #1b6270 100%)",
          color: "#ffffff",
          padding: "10px 14px",
          fontWeight: 800,
          fontSize: 12.5,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span>
          INCOMING {isVideo ? "VIDEO" : "VOICE"} CALL
        </span>
      </div>

      {/* ── CARD BODY ── */}
      <div
        style={{
          padding: "14px 16px 18px 16px",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Large Profile Picture */}
        <div
          style={{
            width: "100%",
            height: 160,
            borderRadius: 16,
            overflow: "hidden",
            background: "#1e293b",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 18px rgba(0, 0, 0, 0.4)",
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={callerName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(145deg, #1e3a8a 0%, #172554 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "2px solid rgba(255, 255, 255, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                {callerName.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Name and Type Metadata */}
        <div style={{ textAlign: "center", marginTop: 10, flexShrink: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.3px" }}>
              {callerName}
            </span>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#475569",
                color: "#ffffff",
                fontSize: 10.5,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {callerName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>
            Enterprise {isVideo ? "HD Video Call" : "Voice Call"}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
            Audio: High Definition (G.722)
          </div>
        </div>

        {/* ── IN-CALL INFORMATION SECTION ── */}
        <div style={{ marginTop: 14, textAlign: "left", flexShrink: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#e2e8f0",
              marginBottom: 6,
              letterSpacing: "0.2px",
            }}
          >
            In-Call Information
          </div>

          {/* Metric 1: Audio Quality */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "2px 0",
              color: "#cbd5e1",
              fontSize: 11.5,
            }}
          >
            <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 12, width: 14 }}>
              <span style={{ width: 2.5, height: "40%", background: "#22c55e", borderRadius: 1 }} />
              <span style={{ width: 2.5, height: "65%", background: "#22c55e", borderRadius: 1 }} />
              <span style={{ width: 2.5, height: "85%", background: "#22c55e", borderRadius: 1 }} />
              <span style={{ width: 2.5, height: "100%", background: "#22c55e", borderRadius: 1 }} />
            </span>
            <span style={{ color: "#e2e8f0", fontWeight: 500 }}>Audio Quality</span>
          </div>

          {/* Metric 2: Security */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "2px 0",
              color: "#cbd5e1",
              fontSize: 11.5,
            }}
          >
            <LockOutlined style={{ color: "#94a3b8", fontSize: 12 }} />
            <span>Security: End-to-End Encrypted</span>
          </div>

          {/* Metric 3: Bandwidth */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "2px 0",
              color: "#cbd5e1",
              fontSize: 11.5,
            }}
          >
            <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>((•))</span>
            <span>Bandwidth: Good</span>
          </div>
        </div>

        {/* ── ACTION BUTTONS: DECLINE / ACCEPT ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 16,
            flexShrink: 0,
          }}
        >
          {/* Decline Button */}
          <button
            onClick={() => {
              callSounds.stopRingtone();
              callSounds.playCutSound();
              onDecline();
            }}
            style={{
              height: 40,
              borderRadius: 20,
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              border: "none",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(239, 68, 68, 0.45)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <CloseOutlined style={{ fontSize: 14 }} />
            <span>Decline</span>
          </button>

          {/* Accept Button */}
          <button
            onClick={() => {
              callSounds.stopRingtone();
              onAccept();
            }}
            style={{
              height: 40,
              borderRadius: 20,
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.45)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <CheckOutlined style={{ fontSize: 15 }} />
            <span>Accept Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
