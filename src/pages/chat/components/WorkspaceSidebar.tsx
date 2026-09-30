import React, { useMemo, useState } from "react";
import {
  Avatar,
  Typography,
  Input,
  Button,
  Badge,
  Tooltip,
  Dropdown,
  Tag,
  Empty,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  PushpinFilled,
  PushpinOutlined,
  EyeInvisibleOutlined,
  ClearOutlined,
  MoreOutlined,
  UserOutlined,
  TeamOutlined,
  HistoryOutlined,
  MessageOutlined,
  FolderOpenOutlined,
  AppstoreOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ConversationListItem, getOtherParticipant } from "@/services/chat";
import { useAuthStore } from "@/store/auth";
import { AIAvatarIcon } from "./AIAvatarIcon";

const { Text } = Typography;

interface WorkspaceSidebarProps {
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  currentUserId?: string;
  onlineEmployeeIds: Set<string>;
  pinnedConversationIds: string[];
  hiddenConversationIds: string[];
  missedCallsCount?: number;
  onSelectConversation: (id: string) => void;
  onOpenNewChat: (defaultType?: "DIRECT" | "GROUP" | "PROJECT") => void;
  onOpenCallHistory: () => void;
  onTogglePin: (id: string) => void;
  onClearFromFeed: (id: string) => void;
  onClearChat: (id: string) => void;
}

type NavCategory = "ALL" | "DIRECT" | "PROJECTS" | "GROUPS" | "PINNED";

function formatPreview(raw?: string | null): string {
  if (!raw) return "No messages yet";
  const str = raw.trim();
  if (str.startsWith("[ATTACHMENTS]:")) {
    try {
      const parts = str.split("[ATTACHMENTS]:");
      const jsonAndText = parts[1] || "";
      const newlineIdx = jsonAndText.indexOf("\n");
      let jsonStr = jsonAndText;
      let textAfter = "";
      if (newlineIdx !== -1) {
        jsonStr = jsonAndText.substring(0, newlineIdx);
        textAfter = jsonAndText.substring(newlineIdx + 1).trim();
      }
      const atts = JSON.parse(jsonStr);
      if (textAfter) {
        return textAfter.length > 45 ? `${textAfter.substring(0, 45)}...` : textAfter;
      }
      const hasImg = atts.some(
        (a: any) =>
          a.kind === "IMAGE" ||
          a.content_type?.startsWith("image/") ||
          a.original_filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );
      return hasImg ? "📷 Photo" : "📎 Document";
    } catch (e) {
      return "📷 Photo";
    }
  }
  if (str.startsWith("data:image/")) return "📷 Photo";
  if (str.startsWith("[POLL]:") || str.includes('"type":"POLL"')) return "📊 Poll";
  if (str.startsWith("[VOICE]:") || str.includes('"type":"VOICE_NOTE"')) return "🎙️ Voice Note";
  if (str.startsWith("[LOCATION]:") || str.includes('"type":"LOCATION"')) return "📍 Location";
  if (str.includes('"type":"IMAGE_ATTACHMENT"') || str.startsWith("[IMAGE]:")) return "📷 Photo";
  if (str.includes('"type":"FILE_ATTACHMENT"') || str.startsWith("[FILE]:")) return "📄 Document";
  if (str.startsWith("{")) {
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "IMAGE_ATTACHMENT" || parsed.file_url?.startsWith("data:image/"))
        return `📷 ${parsed.filename || "Photo"}`;
      if (parsed.type === "FILE_ATTACHMENT") return `📄 ${parsed.filename || "Document"}`;
      if (parsed.type === "VOICE_NOTE") return "🎙️ Voice Note";
      if (parsed.type === "POLL") return `📊 ${parsed.poll?.question || "Poll"}`;
      if (parsed.type === "LOCATION") return `📍 ${parsed.location?.title || "Location"}`;
    } catch (e) {}
  }
  if (str.length > 80 && !str.includes(" ")) {
    if (str.includes("base64") || str.startsWith("iVBOR") || str.startsWith("/9j/")) {
      return "📷 Photo";
    }
  }
  return str.length > 45 ? `${str.substring(0, 45)}...` : str;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  conversations,
  activeConversationId,
  currentUserId,
  onlineEmployeeIds,
  pinnedConversationIds,
  hiddenConversationIds,
  missedCallsCount = 0,
  onSelectConversation,
  onOpenNewChat,
  onOpenCallHistory,
  onTogglePin,
  onClearFromFeed,
  onClearChat,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const [selectedCategory, setSelectedCategory] = useState<NavCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const visibleList = useMemo(() => {
    return conversations.filter((c) => !hiddenConversationIds.includes(c.id));
  }, [conversations, hiddenConversationIds]);

  // Total counts for badges
  const counts = useMemo(() => {
    const unreadTotal = visibleList.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    const directTotal = visibleList.filter((c) => c.type === "DIRECT").length;
    const projectTotal = visibleList.filter(
      (c) => c.name?.toLowerCase().includes("project") || (c as any).is_project
    ).length;
    const groupTotal = visibleList.filter(
      (c) =>
        c.type !== "DIRECT" &&
        !c.name?.toLowerCase().includes("project") &&
        !(c as any).is_project
    ).length;
    const pinnedTotal = visibleList.filter((c) => pinnedConversationIds.includes(c.id)).length;

    return {
      all: visibleList.length,
      unread: unreadTotal,
      direct: directTotal,
      projects: projectTotal,
      groups: groupTotal,
      pinned: pinnedTotal,
    };
  }, [visibleList, pinnedConversationIds]);

  // Filter conversations for the active category
  const displayList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return visibleList.filter((c) => {
      const isDirect = c.type === "DIRECT";
      const isProject = c.name?.toLowerCase().includes("project") || (c as any).is_project;
      const isPinned = pinnedConversationIds.includes(c.id);

      if (selectedCategory === "PINNED" && !isPinned) return false;
      if (selectedCategory === "PROJECTS" && !isProject) return false;
      if (selectedCategory === "GROUPS" && (isDirect || isProject)) return false;
      if (selectedCategory === "DIRECT" && !isDirect) return false;

      if (q) {
        const other = isDirect
          ? getOtherParticipant(c.participants, currentUser)
          : null;
        const name = (c.id === "ai_bot" ? "Nexus AI Assistant" : isDirect ? other?.employee?.full_name : c.name) || "";
        const preview = c.last_message_preview?.body || "";
        return name.toLowerCase().includes(q) || preview.toLowerCase().includes(q);
      }

      return true;
    });
  }, [visibleList, selectedCategory, searchQuery, pinnedConversationIds, currentUser]);

  const navItems = [
    { key: "ALL" as NavCategory, icon: <MessageOutlined />, label: "All Discussions", count: counts.all },
    { key: "PROJECTS" as NavCategory, icon: <FolderOpenOutlined />, label: "Project Hubs", count: counts.projects },
    { key: "GROUPS" as NavCategory, icon: <TeamOutlined />, label: "Team Channels", count: counts.groups },
    { key: "DIRECT" as NavCategory, icon: <UserOutlined />, label: "Direct Messages", count: counts.direct },
    { key: "PINNED" as NavCategory, icon: <PushpinOutlined />, label: "Pinned Rooms", count: counts.pinned },
  ];

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: 320,
        flexShrink: 0,
        background: "var(--bms-surface, #ffffff)",
        borderRight: "1px solid var(--bms-border, rgba(0, 0, 0, 0.08))",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes aiFloatMotion {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-3px) scale(1.08); }
        }
        @keyframes aiGlowPulse {
          0%, 100% { box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4); }
          50% { box-shadow: 0 4px 16px rgba(168, 85, 247, 0.7), 0 0 10px rgba(236, 72, 153, 0.45); }
        }
        @keyframes sparkleRotate {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.15); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
      {/* ── TIER 1: ICON NAVIGATION RAIL (52px) ── */}
      <div
        style={{
          width: 52,
          flexShrink: 0,
          height: "100%",
          background: "var(--bms-bg, #f1f5f9)",
          borderRight: "1px solid var(--bms-border, rgba(0, 0, 0, 0.06))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "14px 0",
          gap: 10,
        }}
      >
        {/* Create New Channel / Chat Button at Top */}
        <Tooltip title="Create New Channel / Chat" placement="right">
          <button
            onClick={() => onOpenNewChat()}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "none",
              background: "var(--bms-primary, #1677ff)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              boxShadow: "0 2px 8px rgba(22, 119, 255, 0.35)",
              marginBottom: 4,
              transition: "all 0.15s ease",
            }}
          >
            <PlusOutlined />
          </button>
        </Tooltip>

        {/* Animated AI Assistant Quick Access Button */}
        <Tooltip title="Nexus AI Assistant" placement="right">
          <button
            onClick={() => onSelectConversation("ai_bot")}
            style={{
              padding: 0,
              borderRadius: 11,
              border: activeConversationId === "ai_bot" ? "2px solid #6366f1" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "aiFloatMotion 2.5s ease-in-out infinite, aiGlowPulse 2.5s ease-in-out infinite",
              marginBottom: 8,
              transition: "transform 0.2s ease",
            }}
          >
            <AIAvatarIcon size={38} />
          </button>
        </Tooltip>

        {/* Category Icons */}
        {navItems.map((item) => {
          const isSelected = selectedCategory === item.key;
          return (
            <Tooltip key={item.key} title={item.label} placement="right">
              <button
                onClick={() => setSelectedCategory(item.key)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: "none",
                  background: isSelected ? "var(--bms-surface, #ffffff)" : "transparent",
                  color: isSelected ? "var(--bms-primary, #1677ff)" : "var(--bms-text-2, #64748b)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 17,
                  position: "relative",
                  boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {item.icon}
                {item.count > 0 && item.key !== "ALL" && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: isSelected ? "var(--bms-primary)" : "#94a3b8",
                    }}
                  />
                )}
              </button>
            </Tooltip>
          );
        })}

        {/* Bottom Actions: Call History Logs with Phone Icon & Missed Calls Badge */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <Tooltip
            title={
              missedCallsCount > 0
                ? `${missedCallsCount} Missed Call${missedCallsCount > 1 ? "s" : ""}`
                : "Call History Logs"
            }
            placement="right"
          >
            <button
              onClick={onOpenCallHistory}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: "none",
                background: missedCallsCount > 0 ? "rgba(255, 77, 79, 0.12)" : "transparent",
                color: missedCallsCount > 0 ? "#ff4d4f" : "var(--bms-text-2, #64748b)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                position: "relative",
                transition: "all 0.15s ease",
              }}
            >
              <PhoneOutlined />
              {missedCallsCount > 0 && (
                <Badge
                  count={missedCallsCount}
                  overflowCount={99}
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: "#ff4d4f",
                    boxShadow: "0 0 0 2px var(--bms-bg, #f1f5f9)",
                    fontSize: 9,
                    fontWeight: 700,
                    height: 16,
                    lineHeight: "16px",
                    minWidth: 16,
                    padding: "0 3px",
                  }}
                />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ── TIER 2: CONVERSATIONS LIST ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Section Header & Search */}
        <div
          style={{
            padding: "16px 14px 12px 14px",
            borderBottom: "1px solid var(--bms-border, rgba(0,0,0,0.06))",
            background: "var(--bms-surface, #ffffff)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ fontWeight: 800, fontSize: 15, color: "var(--bms-text, #1e293b)" }}>
              {selectedCategory === "ALL" && "All Discussions"}
              {selectedCategory === "PROJECTS" && "Project Hubs"}
              {selectedCategory === "GROUPS" && "Team Channels"}
              {selectedCategory === "DIRECT" && "Direct Team"}
              {selectedCategory === "PINNED" && "Pinned Rooms"}
            </Text>
            <span
              style={{
                background: "rgba(22, 119, 255, 0.1)",
                color: "var(--bms-primary, #1677ff)",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
              }}
            >
              {displayList.length}
            </span>
          </div>

          <Input
            prefix={<SearchOutlined style={{ color: "var(--bms-text-3, #94a3b8)", fontSize: 13 }} />}
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            size="middle"
            style={{
              borderRadius: 8,
              background: "var(--bms-bg, #f8fafc)",
              border: "1px solid var(--bms-border, rgba(0,0,0,0.08))",
              fontSize: 12.5,
            }}
          />
        </div>

        {/* Directory List Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
          {displayList.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>No rooms found</Text>}
              style={{ marginTop: 40 }}
            />
          ) : (
            displayList.map((c) => {
              const isDirect = c.type === "DIRECT";
              const isProject = c.name?.toLowerCase().includes("project") || (c as any).is_project;
              const isActive = c.id === activeConversationId;
              const isPinned = pinnedConversationIds.includes(c.id);
              const unread = c.unread_count || 0;
              const isHovered = hoveredCardId === c.id;

              const other = isDirect
                ? getOtherParticipant(c.participants, currentUser)
                : null;
              const name = (c.id === "ai_bot" ? "Nexus AI Assistant" : isDirect ? other?.employee?.full_name : c.name) || "Channel";
              const avatarUrl = c.avatar_url || other?.employee?.profile_picture_url || null;
              const emp = other?.employee;
              const isOnline = emp
                ? Boolean(
                    (emp as any).is_online ||
                    (emp.id && onlineEmployeeIds.has(emp.id)) ||
                    ((emp as any).user_id && onlineEmployeeIds.has((emp as any).user_id)) ||
                    ((emp as any).employee_code && onlineEmployeeIds.has((emp as any).employee_code))
                  )
                : false;
              const preview = formatPreview(c.last_message_preview?.body);

              return (
                <div
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  onMouseEnter={() => setHoveredCardId(c.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    margin: "4px 0",
                    borderRadius: 12,
                    background: isActive
                      ? "rgba(22, 119, 255, 0.08)"
                      : isHovered
                      ? "rgba(0, 0, 0, 0.025)"
                      : "transparent",
                    border: isActive
                      ? "1px solid rgba(22, 119, 255, 0.2)"
                      : "1px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                >
                  {/* Left Active Accent Pill */}
                  {isActive && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 3.5,
                        height: 24,
                        borderRadius: "0 4px 4px 0",
                        background: "var(--bms-primary, #1677ff)",
                      }}
                    />
                  )}

                  {/* Avatar / Icon with Status Dot */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {c.id === "ai_bot" ? (
                      <AIAvatarIcon size={40} />
                    ) : (
                      <Avatar
                        size={40}
                        src={avatarUrl}
                        style={{
                          background: isProject
                            ? "#722ed1"
                            : isDirect
                            ? "var(--bms-primary, #1677ff)"
                            : "#f59e0b",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: 14,
                          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.06)",
                        }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </Avatar>
                    )}
                    {isDirect && c.id !== "ai_bot" && !((c as any).is_ai) && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: isOnline ? "#10b981" : "#94a3b8",
                          border: "2px solid var(--bms-surface, #ffffff)",
                        }}
                      />
                    )}
                  </div>

                  {/* Content Block */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Line 1: Name + Time / Actions */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 4,
                      }}
                    >
                      <Text
                        ellipsis
                        style={{
                          fontSize: 13.5,
                          fontWeight: isActive ? 700 : unread > 0 ? 600 : 500,
                          color: isActive ? "var(--bms-primary, #1677ff)" : "var(--bms-text, #1e293b)",
                          flex: 1,
                        }}
                      >
                        {name}
                      </Text>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        {c.last_message_at && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--bms-text-3, #94a3b8)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {dayjs(c.last_message_at).format("h:mm A")}
                          </span>
                        )}

                        {/* 3-Dots Menu Dropdown */}
                        <Dropdown
                          menu={{
                            items: [
                              {
                                key: "pin",
                                label: isPinned ? "Unpin Room" : "Pin Room",
                                icon: isPinned ? (
                                  <PushpinFilled style={{ color: "#fa8c16" }} />
                                ) : (
                                  <PushpinOutlined />
                                ),
                                onClick: (e) => {
                                  e.domEvent.stopPropagation();
                                  onTogglePin(c.id);
                                },
                              },
                              {
                                key: "hide",
                                label: "Clear from Feed",
                                icon: <EyeInvisibleOutlined />,
                                onClick: (e) => {
                                  e.domEvent.stopPropagation();
                                  onClearFromFeed(c.id);
                                },
                              },
                              {
                                key: "clear",
                                label: "Clear Messages",
                                icon: <ClearOutlined />,
                                danger: true,
                                onClick: (e) => {
                                  e.domEvent.stopPropagation();
                                  onClearChat(c.id);
                                },
                              },
                            ],
                          }}
                          trigger={["click"]}
                          placement="bottomRight"
                        >
                          <Button
                            type="text"
                            size="small"
                            shape="circle"
                            icon={<MoreOutlined style={{ fontSize: 13, color: "var(--bms-text-3, #94a3b8)" }} />}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: 20,
                              height: 20,
                              padding: 0,
                              opacity: isHovered || isActive ? 1 : 0,
                              transition: "opacity 0.15s ease",
                            }}
                          />
                        </Dropdown>
                      </div>
                    </div>

                    {/* Line 2: Message Preview + Badges */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        marginTop: 2,
                      }}
                    >
                      <Text
                        ellipsis
                        style={{
                          fontSize: 12,
                          color: unread > 0 ? "var(--bms-text, #1e293b)" : "var(--bms-text-3, #64748b)",
                          fontWeight: unread > 0 ? 600 : 400,
                          flex: 1,
                        }}
                      >
                        {preview}
                      </Text>

                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {isPinned && <PushpinFilled style={{ color: "#fa8c16", fontSize: 11 }} />}
                        {unread > 0 && (
                          <Badge
                            count={unread}
                            style={{
                              backgroundColor: "var(--bms-primary, #1677ff)",
                              fontSize: 10,
                              fontWeight: 700,
                              height: 17,
                              lineHeight: "17px",
                              minWidth: 17,
                              padding: "0 4px",
                              borderRadius: 9,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSidebar;
