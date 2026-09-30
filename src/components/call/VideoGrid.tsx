import React, { useEffect, useRef } from "react";
import { Avatar } from "antd";
import { UserOutlined } from "@ant-design/icons";

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoCall: boolean;
  peerName: string;
  peerAvatar?: string;
  isCameraOff: boolean;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  localStream,
  remoteStream,
  isVideoCall,
  peerName,
  peerAvatar,
  isCameraOff,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#0b0f19",
        borderRadius: 20,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Remote Video / Audio Fallback Main Screen */}
      {isVideoCall && remoteStream && remoteStream.getVideoTracks().length > 0 ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Avatar
            size={120}
            src={peerAvatar}
            icon={<UserOutlined />}
            style={{
              backgroundColor: "#3b82f6",
              boxShadow: "0 0 30px rgba(59, 130, 246, 0.4)",
            }}
          />
          <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 700 }}>
            {peerName}
          </div>
        </div>
      )}

      {/* Hidden audio element for remote stream if audio call */}
      {!isVideoCall && remoteStream && (
        <audio
          ref={(el) => {
            if (el && remoteStream) el.srcObject = remoteStream;
          }}
          autoPlay
        />
      )}

      {/* Local Video Picture-in-Picture PIP */}
      {isVideoCall && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            width: 160,
            height: 110,
            borderRadius: 14,
            overflow: "hidden",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            backgroundColor: "#1e293b",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
          }}
        >
          {!isCameraOff && localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "#94a3b8",
                fontSize: 12,
              }}
            >
              Camera Off
            </div>
          )}
        </div>
      )}
    </div>
  );
};
