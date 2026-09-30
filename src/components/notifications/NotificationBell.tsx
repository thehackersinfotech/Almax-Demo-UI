import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Badge, Button, Empty, Modal, Popover, Space, Spin, Tag, Tooltip, Typography, message, notification } from "antd";
import {
  BellOutlined,
  CheckOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  ProjectOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
  WalletOutlined,
  DownOutlined,
  RightOutlined,
  FireOutlined,
  CloseCircleOutlined,
  SendOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/services/notifications";
import { playNotificationSound } from "@/utils/sound";
import { PostContent } from "@/components/common/RichTextContent";
import { socialFeedApi, SOCIAL_POST_WORKFLOW_COLORS, type SocialPostItem } from "@/services/socialFeed";

const { Text } = Typography;

const PREVIEW_LIMIT = 3;

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  info: <InfoCircleOutlined style={{ color: "#1677ff", fontSize: 13 }} />,
  warning: <WarningOutlined style={{ color: "#faad14", fontSize: 13 }} />,
  urgent: <ExclamationCircleOutlined style={{ color: "#ff4d4f", fontSize: 13 }} />,
};

const CATEGORIES = [
  { key: "chat", label: "Chat", prefix: "chat.", icon: <MessageOutlined /> },
  { key: "followup", label: "Follow-ups", prefix: "followup.", icon: <CalendarOutlined /> },
  { key: "todo", label: "To-Dos", prefix: "todo.", icon: <CheckOutlined /> },
  { key: "ticket", label: "Tickets", prefix: "ticket.", icon: <FileTextOutlined /> },
  { key: "project", label: "Projects", prefix: "project.", icon: <ProjectOutlined /> },
  { key: "timesheet", label: "Timesheets", prefix: "timesheet.", icon: <ClockCircleOutlined /> },
  { key: "hr", label: "HR & People", prefixes: ["employee.", "leave.", "payroll."], icon: <TeamOutlined /> },
  { key: "finance", label: "Finance", prefixes: ["invoice.", "milestone.", "payment."], icon: <WalletOutlined /> },
  { key: "social_feed", label: "Social Feed", prefix: "social_post.", icon: <FireOutlined /> },
] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/**
 * Parses a Python-dict-style string like:
 *   {'conversationid': 'abc', 'sendername': 'Alice', 'bodypreview': 'Hello!'}
 * into a plain JS object. Returns null if it doesn't look like a chat dict.
 */
function parseChatMeta(raw: string): { conversationid?: string; sendername?: string; bodypreview?: string } | null {
  if (!raw || !raw.trim().startsWith("{")) return null;
  try {
    // Convert Python dict style to valid JSON:
    // single quotes -> double quotes, remove trailing comma before }
    const json = raw
      .replace(/'/g, '"')
      .replace(/,\s*}/g, "}");
    const parsed = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null && ("sendername" in parsed || "bodypreview" in parsed || "conversationid" in parsed)) {
      return parsed as { conversationid?: string; sendername?: string; bodypreview?: string };
    }
  } catch {
    // Try a regex fallback for edge cases
    const senderMatch = raw.match(/['"]?sendername['"]?\s*:\s*['"]([^'"]+)['"]/);
    const previewMatch = raw.match(/['"]?bodypreview['"]?\s*:\s*['"]([^'"]+)['"]/);
    const convMatch = raw.match(/['"]?conversationid['"]?\s*:\s*['"]([^'"]+)['"]/);
    if (senderMatch || previewMatch || convMatch) {
      return {
        sendername: senderMatch?.[1],
        bodypreview: previewMatch?.[1],
        conversationid: convMatch?.[1],
      };
    }
  }
  return null;
}

function matchCategory(eventType: string) {
  for (const cat of CATEGORIES) {
    if ("prefix" in cat && eventType.startsWith(cat.prefix)) return cat;
    if ("prefixes" in cat && cat.prefixes.some((p) => eventType.startsWith(p))) return cat;
  }
  return { key: "other", label: "Other", icon: <BellOutlined /> };
}

function compactTitle(notif: Notification): string {
  // ── Chat notifications ──
  if (notif.event_type === "chat.message.new") {
    const meta = notif.metadata ?? {};
    if (typeof meta.sendername === "string" && meta.sendername) {
      return `New message from ${meta.sendername}`;
    }
    const chatMeta = parseChatMeta(notif.title) ?? parseChatMeta(notif.message);
    if (chatMeta?.sendername) return `New message from ${chatMeta.sendername}`;
    return "New chat message";
  }

  // 1. Prioritize backend rendered title from NotificationRule title_template
  if (notif.title && notif.title.trim() && !notif.title.trim().startsWith("{")) {
    return notif.title.replace(/^\[SEED-PMO\]\s*/, "").trim();
  }

  const meta = notif.metadata ?? {};
  const rawTitle = typeof meta.title === "string" ? meta.title : "";
  if (rawTitle) return rawTitle.replace(/^\[SEED-PMO\]\s*/, "").trim();

  if (notif.event_type.startsWith("project.allocation") && typeof meta.project_name === "string") {
    return meta.project_name;
  }

  return notif.title || notif.event_type;
}

function compactSubtitle(notif: Notification): string | null {
  // 1. If notification message is present, display it as subtitle
  if (notif.message && notif.message.trim() && !notif.message.trim().startsWith("{")) {
    const cleanMsg = cleanTooltipMessage(notif.message);
    if (cleanMsg && cleanMsg !== notif.title) {
      return cleanMsg;
    }
  }

  if (notif.event_type === "followup.due_today") return "Due today";
  if (notif.event_type === "followup.overdue") {
    const days = notif.metadata?.days_overdue;
    return typeof days === "number" ? `${days}d overdue` : "Overdue";
  }
  if (notif.event_type === "project.allocation") return "New allocation";
  if (notif.event_type === "timesheet.submitted") return "Submitted";
  if (notif.event_type === "timesheet.approved") return "Approved";
  if (notif.event_type === "timesheet.rejected") return "Rejected";
  if (notif.event_type === "ticket.due_today") return "Due today";
  if (notif.event_type === "ticket.assigned") return "Assigned";
  if (notif.event_type === "ticket.mention") return "Mentioned in comment";
  if (notif.event_type === "leave.pending_ack") return "Acknowledge leave";
  if (notif.event_type === "leave.pending_approval") return "Team leave";
  if (notif.event_type === "leave.requested") return "Leave request";
  if (notif.event_type === "leave.approved") return "Approved";
  if (notif.event_type === "leave.rejected") return "Rejected";
  if (notif.event_type === "todo.assigned") return "Assigned";
  if (notif.event_type === "todo.transitioned") {
    const status = notif.metadata?.status;
    return status ? `Moved to ${status}` : "Updated";
  }
  if (notif.event_type === "social_post.pending_approval") return "Pending approval";
  if (notif.event_type === "social_post.published") return "Published";
  if (notif.event_type === "chat.message.new") return "New message";
  return null;
}

function cleanTooltipMessage(msg: string): string {
  if (!msg) return "";
  let clean = msg.trim();

  // Format special chat markers
  if (clean.startsWith("[ATTACHMENTS]:")) {
    try {
      const data = JSON.parse(clean.substring(14).trim());
      if (Array.isArray(data) && data.length > 0) {
        const names = data.map((d: any) => d.original_filename).filter(Boolean);
        return names.length > 0 ? `📎 Attached: ${names.slice(0, 2).join(", ")}` : "📎 Sent an attachment";
      }
    } catch {}
    return "📎 Sent an attachment";
  }
  if (clean.startsWith("[VOICE]:")) return "🎤 Voice message";
  if (clean.startsWith("[LOCATION]:")) {
    try {
      const data = JSON.parse(clean.substring(10).trim());
      const addr = data.address || data.title || "Shared location";
      return `📍 Location: ${addr}`;
    } catch {}
    return "📍 Shared location";
  }
  if (clean.startsWith("[POLL]:")) {
    try {
      const data = JSON.parse(clean.substring(7).trim());
      const q = data.question || data.poll?.question;
      return q ? `📊 Poll: ${q}` : "📊 Created a poll";
    } catch {}
    return "📊 Created a poll";
  }
  
  // Hide malformed python dictionary strings like "{'title': '...'}"
  if (/^\{.*['"]title['"]\s*:.*\}$/i.test(clean)) {
    return "";
  }

  // Strip [SEED-PMO] prefix
  clean = clean.replace(/^\[SEED-PMO\]\s*/, "");
  // Strip HTML tags
  clean = clean.replace(/<\/?[^>]+(>|$)/g, "");
  // Strip markdown bold/italic/underline/strikethrough
  clean = clean.replace(/[\*_~]+/g, "");
  // Strip markdown links [text](url) -> text
  clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
  return clean.trim();
}

function getFullDescription(notif: Notification): string {
  // ── Chat notifications: extract body preview from raw dict ──
  if (notif.event_type === "chat.message.new") {
    const meta = notif.metadata ?? {};
    // 1. Structured metadata (newer backend)
    if (typeof meta.bodypreview === "string" && meta.bodypreview) return cleanTooltipMessage(meta.bodypreview);
    if (typeof meta.body_preview === "string" && meta.body_preview) return cleanTooltipMessage(meta.body_preview);
    // 2. Parse raw dict string from message or title
    const chatMeta = parseChatMeta(notif.message) ?? parseChatMeta(notif.title);
    if (chatMeta?.bodypreview) return cleanTooltipMessage(chatMeta.bodypreview);
    if (notif.message) return cleanTooltipMessage(notif.message);
    return "Tap to open the conversation";
  }

  let desc = cleanTooltipMessage(notif.message);
  if (!desc) {
    if (notif.event_type === "todo.assigned") {
      return `"${compactTitle(notif)}" To-Do has been assigned to you.`;
    }
    if (notif.event_type === "todo.transitioned") {
      const status = notif.metadata?.status;
      return `"${compactTitle(notif)}" To-Do was moved to ${status || "a new stage"}.`;
    }
    return compactSubtitle(notif) || "No additional information";
  }
  return desc;
}

interface NotificationBellProps {
  iconColor?: string;
}

export default function NotificationBell({ iconColor = "inherit" }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null | undefined>(undefined);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [socialPostNotif, setSocialPostNotif] = useState<Notification | null>(null);
  const [socialPostData, setSocialPostData] = useState<SocialPostItem | null>(null);
  const [socialPostLoading, setSocialPostLoading] = useState(false);
  const [socialPostActioning, setSocialPostActioning] = useState<string | null>(null);
  const navigate = useNavigate();
  const shownIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
  const [api, contextHolder] = notification.useNotification();

  const [customCategoryLabels, setCustomCategoryLabels] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("bms_notification_category_labels");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem("bms_notification_category_labels");
        if (saved) setCustomCategoryLabels(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener("bms_category_labels_updated", handleUpdate);
    return () => window.removeEventListener("bms_category_labels_updated", handleUpdate);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (window.Notification.permission === "default") {
        window.Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  const triggerDesktopPopup = useCallback((n: Notification) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const titleStr = compactTitle(n);
    const bodyStr = getFullDescription(n);

    const fire = () => {
      try {
        const notif = new window.Notification(titleStr, {
          body: bodyStr,
          icon: "/favicon.ico",
          tag: n.id,
        });
        notif.onclick = () => {
          window.focus();
          handleClick(n);
        };
      } catch {}
    };

    if (window.Notification.permission === "granted") {
      fire();
    } else if (window.Notification.permission === "default") {
      window.Notification.requestPermission().then((p) => {
        if (p === "granted") fire();
      }).catch(() => {});
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [list, countRes] = await Promise.all([
        fetchNotifications(true, 50),
        fetchUnreadCount(),
      ]);

      const isFirst = isInitialLoadRef.current;
      isInitialLoadRef.current = false;

      const unshownList = list.filter((n) => !shownIdsRef.current.has(n.id));

      if (unshownList.length > 0) {
        if (!isFirst) {
          playNotificationSound();
        }

        unshownList.forEach((n) => {
          shownIdsRef.current.add(n.id);

          // 1. In-app toast for new arrivals after page load
          if (!isFirst) {
            api.open({
              key: n.id,
              message: <Text strong style={{ fontSize: 15 }}>{compactTitle(n)}</Text>,
              description: getFullDescription(n),
              placement: "topRight",
              duration: 6,
              icon: SEVERITY_ICON[n.severity] || SEVERITY_ICON.info,
              style: { 
                border: "1px solid var(--bms-border, #e2e8f0)", 
                boxShadow: "var(--shadow-md, 0 4px 12px rgba(0,0,0,0.1))",
                cursor: "pointer",
              },
              onClick: () => {
                api.destroy(n.id);
                handleClick(n);
              },
            });
          }

          // 2. Native OS Desktop Popup Notification (for all newly unshown notifications)
          triggerDesktopPopup(n);
        });
      }

      setItems(list);
      setUnreadCount(countRes.unread_count);
    } catch {
      /* silent */
    }
  }, [triggerDesktopPopup]);

  useEffect(() => {
    load();
    window.addEventListener("local-notifications-updated", load);
    const interval = setInterval(load, 10_000); // Poll every 10 seconds for dynamic updates
    return () => {
      window.removeEventListener("local-notifications-updated", load);
      clearInterval(interval);
    };
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, { cat: typeof CATEGORIES[number] | { key: string; label: string; icon: React.ReactNode }; items: Notification[] }>();

    for (const notif of items) {
      const cat = matchCategory(notif.event_type);
      const key = cat.key;
      if (!map.has(key)) map.set(key, { cat, items: [] });
      map.get(key)!.items.push(notif);
    }

    const groups = Array.from(map.values());
    groups.sort((a, b) => {
      const timeA = new Date(a.items[0]?.created_at || 0).getTime();
      const timeB = new Date(b.items[0]?.created_at || 0).getTime();
      return timeB - timeA; // Category with newest notification appears first
    });

    return groups;
  }, [items]);

  useEffect(() => {
    if (grouped.length > 0 && openCategoryKey === undefined) {
      setOpenCategoryKey(grouped[0].cat.key);
    }
  }, [grouped, openCategoryKey]);

  const handleOpenChange = (visible: boolean) => {
    setOpen(visible);
    if (visible) {
      setOpenCategoryKey(undefined);
      setLoading(true);
      load().finally(() => setLoading(false));
    }
  };

  const handleClick = async (notif: Notification) => {
    // Social feed pending approval — show action modal
    if (notif.event_type === "social_post.pending_approval") {
      try {
        await markNotificationRead(notif.id);
        setItems((prev) => prev.filter((n) => n.id !== notif.id));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch { /* proceed */ }
      setOpen(false);
      // Fetch post data and show modal
      setSocialPostNotif(notif);
      setSocialPostLoading(true);
      setSocialPostData(null);
      try {
        const data = await socialFeedApi.retrieve(notif.reference_id);
        setSocialPostData(data);
      } catch { /* silent */ }
      setSocialPostLoading(false);
      return;
    }

    // Social feed published — just mark read, no navigation (page was removed)
    if (notif.event_type === "social_post.published") {
      try {
        await markNotificationRead(notif.id);
        setItems((prev) => prev.filter((n) => n.id !== notif.id));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch { /* proceed */ }
      setOpen(false);
      return;
    }

    try {
      await markNotificationRead(notif.id);
      setItems((prev) => prev.filter((n) => n.id !== notif.id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* proceed */
    }
    setOpen(false);
    let targetUrl = notif.action_url;
    if (notif.event_type.startsWith("followup.")) {
      targetUrl = notif.reference_id ? `/workspace/followups?id=${notif.reference_id}` : "/workspace/followups";
    } else if (notif.event_type.startsWith("todo.")) {
      targetUrl = notif.reference_id ? `/workspace/todos?id=${notif.reference_id}` : "/workspace/todos";
    } else if (notif.event_type.startsWith("ticket.")) {
      targetUrl = notif.reference_id ? `/tickets/${notif.reference_id}` : (notif.action_url || "/tickets");
    }
    if (targetUrl) navigate(targetUrl);
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setItems([]);
    setUnreadCount(0);
  };

  const toggleCategory = (key: string) => {
    setOpenCategoryKey((prevKey) => (prevKey === key ? null : key));
  };

  const toggleShowAll = (key: string) => {
    setExpandedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const content = (
    <div style={{ width: "min(340px, calc(100vw - 32px))", maxHeight: "min(440px, 75vh)", display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "2px 2px 10px",
        borderBottom: "1px solid var(--bms-border, #e8edf2)",
      }}>
        <Text strong style={{ fontSize: 14 }}>Notifications</Text>
        <Space size={4}>
          {typeof window !== "undefined" && "Notification" in window && window.Notification.permission !== "granted" && (
            <Tooltip title="Enable Desktop Browser Popups">
              <Button
                type="link"
                size="small"
                icon={<BellOutlined style={{ color: "#fa8c16" }} />}
                onClick={() => {
                  window.Notification.requestPermission().then((p) => {
                    if (p === "granted") message.success("Browser Desktop Notifications enabled!");
                    else message.warning("Browser notifications blocked. Enable in browser site settings.");
                  });
                }}
                style={{ fontSize: 12, padding: "0 4px" }}
              >
                Enable Desktop Popups
              </Button>
            </Tooltip>
          )}
          {items.length > 0 && (
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAll} style={{ fontSize: 12 }}>
              Mark all read
            </Button>
          )}
        </Space>
      </div>

      {typeof window !== "undefined" && "Notification" in window && window.Notification.permission !== "granted" && (
        <div style={{
          padding: "6px 10px",
          marginTop: 6,
          background: "#fffbe6",
          border: "1px solid #ffe58f",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
        }}>
          <span style={{ color: "#d48806", fontWeight: 600 }}>
            🔔 Desktop popups blocked
          </span>
          <Button
            size="small"
            type="primary"
            style={{ background: "#fa8c16", borderColor: "#fa8c16", fontSize: 10, borderRadius: 4, height: 22, padding: "0 8px" }}
            onClick={() => {
              window.Notification.requestPermission().then((p) => {
                if (p === "granted") {
                  message.success("Desktop notifications enabled!");
                  load();
                } else {
                  message.warning("Notifications blocked in browser site settings.");
                }
              });
            }}
          >
            Allow Popups
          </Button>
        </div>
      )}

      <div style={{ overflowY: "auto", flex: 1, marginTop: 6 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 28 }}><Spin size="small" /></div>
        ) : items.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No unread notifications"
            style={{ padding: "20px 0" }}
          />
        ) : (
          grouped.map(({ cat, items: catItems }) => {
            const isCollapsed = openCategoryKey !== cat.key;
            const showAll = expandedItems[cat.key];
            const visible = showAll ? catItems : catItems.slice(0, PREVIEW_LIMIT);
            const hiddenCount = catItems.length - visible.length;

            return (
              <div key={cat.key} style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    border: "none",
                    background: "var(--bms-surface-2, #f8fafc)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                    marginBottom: isCollapsed ? 0 : 4,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--bms-text-2, #64748b)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    <span style={{ fontSize: 12, display: "inline-flex" }}>{cat.icon}</span>
                    {customCategoryLabels[cat.key] || cat.label}
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: "var(--bms-surface, #fff)",
                      border: "1px solid var(--bms-border, #e2e8f0)",
                      borderRadius: 10,
                      padding: "0 6px",
                      lineHeight: "18px",
                    }}>
                      {catItems.length}
                    </span>
                  </span>
                  {isCollapsed ? <RightOutlined style={{ fontSize: 10, color: "#94a3b8" }} /> : <DownOutlined style={{ fontSize: 10, color: "#94a3b8" }} />}
                </button>

                {!isCollapsed && visible.map((notif) => {
                  const subtitle = compactSubtitle(notif);
                  return (
                    <Tooltip key={notif.id} title={getFullDescription(notif)} placement="left">
                      <div
                        onClick={() => handleClick(notif)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 8px",
                          marginBottom: 2,
                          cursor: "pointer",
                          borderRadius: 6,
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "var(--bms-hover, rgba(22,119,255,0.06))";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                        }}
                      >
                        <span style={{ flexShrink: 0, width: 16, display: "flex", justifyContent: "center" }}>
                          {SEVERITY_ICON[notif.severity] || SEVERITY_ICON.info}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                            <Text strong style={{
                              fontSize: 12,
                              lineHeight: 1.3,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                            }}>
                              {compactTitle(notif)}
                            </Text>
                            <Text style={{ fontSize: 10, color: "var(--bms-text-3, #94a3b8)", flexShrink: 0 }}>
                              {timeAgo(notif.created_at)}
                            </Text>
                          </div>
                          {subtitle && (
                            <Text style={{ fontSize: 10, color: "var(--bms-text-3, #94a3b8)", lineHeight: 1.2 }}>
                              {subtitle}
                            </Text>
                          )}
                        </div>
                      </div>
                    </Tooltip>
                  );
                })}

                {!isCollapsed && hiddenCount > 0 && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => toggleShowAll(cat.key)}
                    style={{ fontSize: 11, padding: "0 8px", height: 24 }}
                  >
                    {showAll ? "Show less" : `Show ${hiddenCount} more`}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ── Social Feed Action Modal ────────────────────────────────────────────────
  const handleSocialPostAction = async (destination: string) => {
    if (!socialPostData) return;
    setSocialPostActioning(destination);
    try {
      await socialFeedApi.transition(socialPostData.id, destination);
      message.success(`Post ${destination === "published" ? "published" : destination === "approved" ? "approved" : "rejected"} successfully`);
      setSocialPostNotif(null);
      setSocialPostData(null);
      // Reload notifications
      load();
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.response?.data?.message || "Action failed";
      message.error(detail);
    }
    setSocialPostActioning(null);
  };

  const socialPostModal = (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FireOutlined style={{ color: "#dc2626" }} />
          <span>Social Post — Review</span>
        </div>
      }
      open={!!socialPostNotif}
      onCancel={() => { setSocialPostNotif(null); setSocialPostData(null); }}
      footer={null}
      width={500}
    >
      {socialPostLoading ? (
        <div style={{ textAlign: "center", padding: 40 }}><Spin size="large" /></div>
      ) : socialPostData ? (
        <div>
          {/* Post info */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Text strong style={{ fontSize: 16 }}>{socialPostData.title}</Text>
              <Tag
                color={SOCIAL_POST_WORKFLOW_COLORS[socialPostData.workflow_state_slug] || "#6B7280"}
                style={{ fontSize: 10, borderRadius: 20, margin: 0, flexShrink: 0 }}
              >
                {socialPostData.workflow_state_name || socialPostData.workflow_state_slug}
              </Tag>
            </div>
            <Text style={{ fontSize: 12, color: "var(--bms-text-2)" }}>
              By {socialPostData.created_by_name}
            </Text>
          </div>

          {/* Content */}
          {socialPostData.content && (
            <div style={{
              background: "var(--bms-surface-2)",
              border: "1px solid var(--bms-border)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 16,
              maxHeight: 200,
              overflowY: "auto",
            }}>
              <PostContent content={socialPostData.content} style={{ fontSize: 13 }} />
            </div>
          )}

          {/* Image preview */}
          {socialPostData.image_url && (
            <div style={{ marginBottom: 16 }}>
              <img
                src={socialPostData.image_url}
                alt={socialPostData.title}
                style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8 }}
              />
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 12, color: "var(--bms-text-3)" }}>
            <span>❤ {socialPostData.like_count}</span>
            <span>💬 {socialPostData.comment_count}</span>
          </div>

          {/* Action buttons */}
          {socialPostData.allowed_destination_slugs && socialPostData.allowed_destination_slugs.length > 0 ? (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--bms-border)", paddingTop: 14 }}>
              {socialPostData.allowed_destination_slugs.includes("approved") && (
                <Button
                  icon={<CheckOutlined />}
                  loading={socialPostActioning === "approved"}
                  onClick={() => handleSocialPostAction("approved")}
                  style={{ borderRadius: 8, borderColor: "#10B981", color: "#10B981" }}
                >
                  Approve
                </Button>
              )}
              {socialPostData.allowed_destination_slugs.includes("published") && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={socialPostActioning === "published"}
                  onClick={() => handleSocialPostAction("published")}
                  style={{ borderRadius: 8, background: "#3B82F6" }}
                >
                  Publish
                </Button>
              )}
              {socialPostData.allowed_destination_slugs.includes("rejected") && (
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={socialPostActioning === "rejected"}
                  onClick={() => handleSocialPostAction("rejected")}
                  style={{ borderRadius: 8 }}
                >
                  Reject
                </Button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "10px 0", fontSize: 12, color: "var(--bms-text-3)" }}>
              No actions available for this post in its current state.
            </div>
          )}
        </div>
      ) : socialPostNotif ? (
        <div style={{ textAlign: "center", padding: 20 }}>
          <Empty description="Could not load post details" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--bms-text-3)" }}>
            <Text>Title: {String(socialPostNotif.metadata?.title ?? "")}</Text>
            <br />
            <Text>From: {String(socialPostNotif.metadata?.created_by_name ?? "")}</Text>
          </div>
        </div>
      ) : null}
    </Modal>
  );

  return (
    <>
      {contextHolder}
      {socialPostModal}
      <Popover
        content={content}
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottomRight"
        overlayClassName="pmt-notification-popover"
        styles={{ body: { padding: 12, maxWidth: "calc(100vw - 16px)" } }}
      >
      <button
        type="button"
        className="bms-header-icon-btn"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        style={{ position: "relative" }}
      >
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <BellOutlined style={{ fontSize: 16, color: iconColor }} />
        </Badge>
      </button>
    </Popover>
    </>
  );
}
