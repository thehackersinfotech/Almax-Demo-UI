import React from "react";
import { Modal, Button, Avatar, Space } from "antd";
import { PhoneOutlined, UserOutlined, VideoCameraOutlined } from "@ant-design/icons";

interface IncomingCallModalProps {
  open: boolean;
  callerName: string;
  callerAvatar?: string;
  callType: "AUDIO" | "VIDEO";
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  open,
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onReject,
}) => {
  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      centered
      width={380}
      modalRender={(node) => (
        <div
          style={{
            background: "#121824",
            borderRadius: 24,
            padding: 32,
            textAlign: "center",
            border: "1px solid #1e293b",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <Avatar
              size={90}
              src={callerAvatar}
              icon={<UserOutlined />}
              style={{
                backgroundColor: "#0084ff",
                boxShadow: "0 0 25px rgba(0, 132, 255, 0.4)",
              }}
            />
          </div>

          <div style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>
            {callerName}
          </div>

          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {callType === "VIDEO" ? <VideoCameraOutlined style={{ color: "#38bdf8" }} /> : <PhoneOutlined style={{ color: "#34d399" }} />}
            Incoming {callType.toLowerCase()} call...
          </div>

          <Space size={32} style={{ justifyContent: "center", width: "100%" }}>
            <Button
              shape="circle"
              size="large"
              icon={<PhoneOutlined style={{ transform: "rotate(135deg)" }} />}
              onClick={onReject}
              style={{
                width: 60,
                height: 60,
                backgroundColor: "#ef4444",
                color: "#ffffff",
                border: "none",
                fontSize: 24,
                boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
              }}
            />

            <Button
              shape="circle"
              size="large"
              icon={<PhoneOutlined />}
              onClick={onAccept}
              style={{
                width: 60,
                height: 60,
                backgroundColor: "#22c55e",
                color: "#ffffff",
                border: "none",
                fontSize: 24,
                boxShadow: "0 4px 15px rgba(34, 197, 94, 0.4)",
              }}
            />
          </Space>
        </div>
      )}
    />
  );
};
