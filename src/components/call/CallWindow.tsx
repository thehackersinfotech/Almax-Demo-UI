import React from "react";
import { Modal } from "antd";
import { useWebRTC, CallSession } from "@/hooks/useWebRTC";
import { VideoGrid } from "./VideoGrid";
import { CallControls } from "./CallControls";

interface CallWindowProps {
  open: boolean;
  session: CallSession | null;
  onClose: () => void;
}

export const CallWindow: React.FC<CallWindowProps> = ({ open, session, onClose }) => {
  const {
    callState,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    durationSeconds,
    endCall,
    toggleMute,
    toggleCamera,
  } = useWebRTC(session, onClose);

  if (!open || !session) return null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      centered
      width={800}
      modalRender={() => (
        <div
          style={{
            position: "relative",
            width: 800,
            height: 520,
            backgroundColor: "#090d16",
            borderRadius: 24,
            overflow: "hidden",
            border: "1px solid #1e293b",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top Status Bar */}
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 24,
              right: 24,
              zIndex: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(8px)",
                padding: "6px 16px",
                borderRadius: 20,
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 600,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {session.peerName}
            </div>

            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(8px)",
                padding: "6px 16px",
                borderRadius: 20,
                color: callState === "CONNECTED" ? "#34d399" : "#fbbf24",
                fontSize: 13,
                fontWeight: 700,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {callState === "CONNECTED" ? formatTimer(durationSeconds) : callState}
            </div>
          </div>

          {/* Center Video/Audio Grid */}
          <div style={{ flex: 1, padding: 12 }}>
            <VideoGrid
              localStream={localStream}
              remoteStream={remoteStream}
              isVideoCall={session.callType === "VIDEO"}
              peerName={session.peerName}
              peerAvatar={session.peerAvatar}
              isCameraOff={isCameraOff}
            />
          </div>

          {/* Bottom Floating Call Controls */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 0,
              right: 0,
              zIndex: 10,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <CallControls
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isVideoCall={session.callType === "VIDEO"}
              onToggleMute={toggleMute}
              onToggleCamera={toggleCamera}
              onEndCall={endCall}
            />
          </div>
        </div>
      )}
    />
  );
};
