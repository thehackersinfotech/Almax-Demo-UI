import React, { useState } from "react";
import { Drawer, Typography, List, Avatar, Tag, Button, Empty, Tooltip, Segmented, Popconfirm } from "antd";
import {
  PhoneOutlined,
  VideoCameraOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  PhoneFilled,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export interface CallLogItem {
  id: string;
  conversationId: string;
  callerName: string;
  callerAvatar?: string | null;
  type: "VOICE" | "VIDEO";
  direction: "INCOMING" | "OUTGOING" | "MISSED";
  isCaller?: boolean;
  status?: string;
  durationSeconds?: number;
  timestamp: string;
}

interface CallHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  calls: CallLogItem[];
  onInitiateCall: (conversationId: string, type: "VOICE" | "VIDEO") => void;
  onClearHistory?: () => void;
}

export const CallHistoryDrawer: React.FC<CallHistoryDrawerProps> = ({
  open,
  onClose,
  calls,
  onInitiateCall,
  onClearHistory,
}) => {
  const [filter, setFilter] = useState<"ALL" | "MISSED">("ALL");

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return "0s";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const filteredCalls = calls.filter((c) => {
    if (filter === "MISSED") return c.direction === "MISSED";
    return true;
  });

  const missedCount = calls.filter((c) => c.direction === "MISSED").length;

  return (
    <Drawer
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingRight: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "var(--bms-primary, #1677ff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 16,
              }}
            >
              <PhoneOutlined />
            </div>
            <div>
              <Title level={5} style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                Call History
              </Title>
              <Text style={{ fontSize: 12, color: "var(--bms-text-3, #8c8c8c)" }}>
                Recent audio and video sessions
              </Text>
            </div>
          </div>

          {onClearHistory && calls.length > 0 && (
            <Popconfirm
              title="Clear call history?"
              description="Are you sure you want to clear all call records?"
              onConfirm={onClearHistory}
              okText="Clear"
              cancelText="Cancel"
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                Clear
              </Button>
            </Popconfirm>
          )}
        </div>
      }
      placement="right"
      width={430}
      onClose={onClose}
      open={open}
      closeIcon={<CloseOutlined />}
      styles={{
        body: { padding: 16, background: "var(--bms-bg, #f8fafc)" },
        header: { borderBottom: "1px solid var(--bms-border, rgba(0,0,0,0.08))" },
      }}
    >
      {calls.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Segmented
            block
            value={filter}
            onChange={(val) => setFilter(val as any)}
            options={[
              { label: `All Calls (${calls.length})`, value: "ALL" },
              {
                label: (
                  <span style={{ color: missedCount > 0 ? "#ff4d4f" : "inherit", fontWeight: missedCount > 0 ? 600 : 400 }}>
                    Missed ({missedCount})
                  </span>
                ),
                value: "MISSED",
              },
            ]}
          />
        </div>
      )}

      {filteredCalls.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text style={{ color: "var(--bms-text-3)" }}>{filter === "MISSED" ? "No missed calls" : "No recent call activity"}</Text>}
          style={{ marginTop: 60 }}
        />
      ) : (
        <List
          dataSource={filteredCalls}
          renderItem={(item) => {
            const isMissed = item.direction === "MISSED" && !item.isCaller;
            const isCancelled = item.isCaller && (item.status === "MISSED" || item.direction === "MISSED" || item.status === "DECLINED");
            const isOutgoing = item.direction === "OUTGOING" || item.isCaller;

            return (
              <div
                key={item.id}
                style={{
                  background: isMissed ? "#fff1f0" : "var(--bms-surface, #ffffff)",
                  borderRadius: 12,
                  border: isMissed
                    ? "1px solid rgba(255, 77, 79, 0.3)"
                    : "1px solid var(--bms-border, rgba(0,0,0,0.06))",
                  padding: "12px 14px",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: isMissed
                    ? "0 2px 6px rgba(255, 77, 79, 0.08)"
                    : "0 1px 3px rgba(0,0,0,0.02)",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
                  <Avatar
                    src={item.callerAvatar}
                    style={{
                      backgroundColor: isMissed
                        ? "#ff4d4f"
                        : item.callerName?.startsWith("Project")
                        ? "#722ed1"
                        : "var(--bms-primary, #1677ff)",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                    size={42}
                  >
                    {item.callerName?.charAt(0)?.toUpperCase() || "U"}
                  </Avatar>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Text
                        ellipsis
                        style={{
                          fontWeight: 700,
                          fontSize: 13.5,
                          color: isMissed ? "#cf1322" : "var(--bms-text, #1e293b)",
                        }}
                      >
                        {item.callerName}
                      </Text>
                      {item.type === "VIDEO" ? (
                        <VideoCameraOutlined style={{ color: isMissed ? "#cf1322" : "#722ed1", fontSize: 13 }} />
                      ) : (
                        <PhoneFilled style={{ color: isMissed ? "#cf1322" : "var(--bms-primary)", fontSize: 12 }} />
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <Tag
                        bordered={false}
                        color={isMissed ? "error" : isCancelled ? "default" : isOutgoing ? "processing" : "success"}
                        style={{
                          fontSize: 10.5,
                          padding: "0 6px",
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontWeight: 600,
                          lineHeight: "18px",
                        }}
                      >
                        {isMissed ? (
                          <>
                            <ArrowDownOutlined style={{ transform: "rotate(45deg)", color: "#ff4d4f" }} /> Missed Call
                          </>
                        ) : isCancelled ? (
                          <>
                            <ArrowUpOutlined style={{ transform: "rotate(45deg)", color: "#8c8c8c" }} /> Cancelled Call
                          </>
                        ) : isOutgoing ? (
                          <>
                            <ArrowUpOutlined style={{ transform: "rotate(45deg)" }} /> Outgoing Call
                          </>
                        ) : (
                          <>
                            <ArrowDownOutlined /> Incoming Call
                          </>
                        )}
                      </Tag>

                      {item.durationSeconds && item.durationSeconds > 0 ? (
                        <Text style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
                          <ClockCircleOutlined style={{ marginRight: 3 }} />
                          {formatDuration(item.durationSeconds)}
                        </Text>
                      ) : null}
                    </div>

                    <Text style={{ fontSize: 11, color: "var(--bms-text-3)", display: "block", marginTop: 3 }}>
                      {dayjs(item.timestamp).format("MMM D, YYYY · h:mm A")}
                    </Text>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                  <Tooltip title="Voice Call">
                    <Button
                      type={isMissed ? "primary" : "text"}
                      danger={isMissed}
                      shape="circle"
                      size="middle"
                      icon={<PhoneOutlined />}
                      onClick={() => onInitiateCall(item.conversationId, "VOICE")}
                    />
                  </Tooltip>
                  <Tooltip title="Video Call">
                    <Button
                      type="text"
                      shape="circle"
                      size="middle"
                      icon={<VideoCameraOutlined style={{ color: "#722ed1" }} />}
                      onClick={() => onInitiateCall(item.conversationId, "VIDEO")}
                    />
                  </Tooltip>
                </div>
              </div>
            );
          }}
        />
      )}
    </Drawer>
  );
};
