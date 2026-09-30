import React, { useState } from "react";
import { Progress, Tag, Modal, Avatar, Button, Tooltip } from "antd";
import { BarChartOutlined, CheckCircleFilled, UserOutlined, TeamOutlined, EyeOutlined } from "@ant-design/icons";

export interface PollOption {
  id?: string;
  text: string;
  voters?: string[];
  votes?: string[];
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
}

interface PollWidgetProps {
  poll?: PollData;
  pollData?: PollData;
  messageId?: string;
  currentUserId?: string;
  participants?: any[];
  onVote?: (pollId: string, optionId: string, optionIndex: number) => void;
  isSentByMe?: boolean;
}

export const PollWidget: React.FC<PollWidgetProps> = ({
  poll,
  pollData,
  currentUserId,
  participants,
  onVote,
  isSentByMe = false,
}) => {
  const [showVotersModal, setShowVotersModal] = useState(false);
  const activePoll: PollData | null = poll || pollData || null;

  if (!activePoll || !activePoll.options) {
    return null;
  }

  const getVoters = (opt: PollOption): string[] => {
    if (Array.isArray(opt?.voters)) return opt.voters;
    if (Array.isArray(opt?.votes)) return opt.votes;
    return [];
  };

  const resolveVoterInfo = (uid: string): { name: string; isMe: boolean; avatar?: string } => {
    const isMe = Boolean(currentUserId && String(uid).toLowerCase() === String(currentUserId).toLowerCase());
    const found = (participants || []).find(
      (p) =>
        String(p?.employee?.id).toLowerCase() === String(uid).toLowerCase() ||
        String(p?.employee_id).toLowerCase() === String(uid).toLowerCase()
    );

    if (isMe) {
      return {
        name: found?.employee?.full_name ? `${found.employee.full_name} (You)` : "You",
        isMe: true,
        avatar: found?.employee?.profile_picture_url || undefined,
      };
    }

    if (found) {
      const name =
        found.employee?.full_name ||
        `${found.employee?.first_name || ""} ${found.employee?.last_name || ""}`.trim() ||
        found.employee?.username ||
        "Colleague";
      return {
        name,
        isMe: false,
        avatar: found.employee?.profile_picture_url || undefined,
      };
    }

    return { name: "Participant", isMe: false };
  };

  const totalVotes = activePoll.options.reduce((acc, opt) => acc + getVoters(opt).length, 0);

  return (
    <>
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 14,
          background: "var(--bms-surface, #ffffff)",
          border: "1.5px solid var(--bms-border, rgba(0, 0, 0, 0.1))",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.05)",
          minWidth: 280,
          maxWidth: 440,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "rgba(22, 119, 255, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <BarChartOutlined style={{ fontSize: 18, color: "#1677ff" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4
              style={{
                margin: 0,
                fontSize: 14.5,
                fontWeight: 700,
                color: "var(--bms-text, #0f172a)",
                lineHeight: 1.4,
              }}
            >
              {activePoll.question}
            </h4>
            {activePoll.allowMultiple && (
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--bms-text-3, #64748b)",
                  display: "block",
                  marginTop: 2,
                  fontWeight: 500,
                }}
              >
                Multiple choices allowed
              </span>
            )}
          </div>
        </div>

        {/* Options List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {activePoll.options.map((opt, idx) => {
            const voterList = getVoters(opt);
            const hasVoted = currentUserId
              ? voterList.some((uid) => String(uid).toLowerCase() === String(currentUserId).toLowerCase())
              : false;
            const pct = totalVotes > 0 ? Math.round((voterList.length / totalVotes) * 100) : 0;
            const optKey = opt.id || `opt_${idx}`;

            return (
              <div
                key={optKey}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onVote) {
                    onVote(activePoll.id, optKey, idx);
                  }
                }}
                style={{
                  cursor: "pointer",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: hasVoted ? "rgba(22, 119, 255, 0.09)" : "var(--bms-bg, #f8fafc)",
                  border: `1.5px solid ${
                    hasVoted ? "#1677ff" : "var(--bms-border, rgba(0, 0, 0, 0.09))"
                  }`,
                  transition: "all 0.15s ease",
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: hasVoted ? 700 : 600,
                      color: hasVoted ? "#1677ff" : "var(--bms-text, #1e293b)",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    {opt.text}
                    {hasVoted && <CheckCircleFilled style={{ color: "#1677ff", fontSize: 15 }} />}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: hasVoted ? "#1677ff" : "var(--bms-text-3, #64748b)",
                      fontWeight: 700,
                    }}
                  >
                    {voterList.length} ({pct}%)
                  </span>
                </div>

                <Progress
                  percent={pct}
                  showInfo={false}
                  strokeColor="#1677ff"
                  trailColor="rgba(0, 0, 0, 0.06)"
                  size="small"
                  style={{ margin: 0 }}
                />

                {/* Voted Persons preview badges */}
                {voterList.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 8,
                      flexWrap: "wrap",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVotersModal(true);
                    }}
                  >
                    <span style={{ fontSize: 11, color: "var(--bms-text-3, #64748b)", fontWeight: 500, marginRight: 2 }}>
                      Voted by:
                    </span>
                    {voterList.map((uid, vIdx) => {
                      const info = resolveVoterInfo(uid);
                      return (
                        <span
                          key={`${uid}_${vIdx}`}
                          style={{
                            fontSize: 10.5,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: info.isMe ? "rgba(22, 119, 255, 0.15)" : "rgba(0, 0, 0, 0.05)",
                            color: info.isMe ? "#1677ff" : "var(--bms-text, #334155)",
                            fontWeight: 600,
                            border: `1px solid ${info.isMe ? "rgba(22,119,255,0.3)" : "rgba(0,0,0,0.08)"}`,
                          }}
                        >
                          {info.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer with View Votes Action */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: "1px solid var(--bms-border, rgba(0,0,0,0.06))",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--bms-text-3, #64748b)",
          }}
        >
          <span>Click option to vote</span>

          <Button
            type="text"
            size="small"
            icon={<TeamOutlined style={{ color: "#1677ff" }} />}
            onClick={(e) => {
              e.stopPropagation();
              setShowVotersModal(true);
            }}
            style={{
              color: "#1677ff",
              fontWeight: 700,
              fontSize: 12,
              padding: "0 6px",
              height: 24,
            }}
          >
            View Votes ({totalVotes})
          </Button>
        </div>
      </div>

      {/* Detailed Poll Voters Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TeamOutlined style={{ color: "#1677ff", fontSize: 18 }} />
            <span style={{ fontWeight: 700 }}>Poll Results & Voters</span>
          </div>
        }
        open={showVotersModal}
        onCancel={() => setShowVotersModal(false)}
        footer={null}
        width={480}
      >
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(22, 119, 255, 0.06)",
              border: "1px solid rgba(22, 119, 255, 0.15)",
              marginBottom: 16,
              fontWeight: 700,
              fontSize: 14,
              color: "var(--bms-text, #0f172a)",
            }}
          >
            {activePoll.question}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {activePoll.options.map((opt, idx) => {
              const voterList = getVoters(opt);
              const pct = totalVotes > 0 ? Math.round((voterList.length / totalVotes) * 100) : 0;

              return (
                <div
                  key={opt.id || idx}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "var(--bms-bg, #f8fafc)",
                    border: "1px solid var(--bms-border, rgba(0,0,0,0.08))",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--bms-text, #1e293b)" }}>
                      {opt.text}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 12.5, color: "#1677ff" }}>
                      {voterList.length} {voterList.length === 1 ? "vote" : "votes"} ({pct}%)
                    </span>
                  </div>

                  <Progress percent={pct} showInfo={false} strokeColor="#1677ff" size="small" />

                  {/* Voter List */}
                  <div style={{ marginTop: 10 }}>
                    {voterList.length === 0 ? (
                      <span style={{ fontSize: 12, color: "var(--bms-text-3, #94a3b8)", fontStyle: "italic" }}>
                        No votes for this option yet
                      </span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                        {voterList.map((uid, vIdx) => {
                          const info = resolveVoterInfo(uid);
                          return (
                            <div
                              key={`${uid}_${vIdx}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 8px",
                                borderRadius: 6,
                                background: info.isMe ? "rgba(22, 119, 255, 0.08)" : "#ffffff",
                                border: "1px solid rgba(0,0,0,0.06)",
                              }}
                            >
                              <Avatar
                                size={22}
                                style={{
                                  background: info.isMe ? "#1677ff" : "#64748b",
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {info.name.charAt(0).toUpperCase()}
                              </Avatar>
                              <span
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: info.isMe ? 700 : 500,
                                  color: info.isMe ? "#1677ff" : "var(--bms-text, #1e293b)",
                                }}
                              >
                                {info.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default PollWidget;


