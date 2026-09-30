import React from "react";
import { Button, Tooltip, Space } from "antd";
import {
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
  PhoneOutlined,
} from "@ant-design/icons";

interface CallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isVideoCall: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isCameraOff,
  isVideoCall,
  onToggleMute,
  onToggleCamera,
  onEndCall,
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "16px 24px",
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(12px)",
        borderRadius: 24,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <Space size={20}>
        <Tooltip title={isMuted ? "Unmute Microphone" : "Mute Microphone"}>
          <Button
            shape="circle"
            size="large"
            icon={isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
            onClick={onToggleMute}
            style={{
              width: 52,
              height: 52,
              backgroundColor: isMuted ? "#ef4444" : "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              border: "none",
              fontSize: 20,
            }}
          />
        </Tooltip>

        {isVideoCall && (
          <Tooltip title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}>
            <Button
              shape="circle"
              size="large"
              icon={isCameraOff ? <VideoCameraAddOutlined /> : <VideoCameraOutlined />}
              onClick={onToggleCamera}
              style={{
                width: 52,
                height: 52,
                backgroundColor: isCameraOff ? "#ef4444" : "rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                border: "none",
                fontSize: 20,
              }}
            />
          </Tooltip>
        )}

        <Tooltip title="End Call">
          <Button
            shape="circle"
            size="large"
            icon={<PhoneOutlined style={{ transform: "rotate(135deg)" }} />}
            onClick={onEndCall}
            style={{
              width: 58,
              height: 58,
              backgroundColor: "#dc2626",
              color: "#ffffff",
              border: "none",
              fontSize: 22,
              boxShadow: "0 4px 14px rgba(220, 38, 38, 0.5)",
            }}
          />
        </Tooltip>
      </Space>
    </div>
  );
};
