import { useState, useEffect } from "react";
import { Drawer, Button, Tag, Space, Typography, Divider, Popconfirm, message, Popover } from "antd";
import {
  EditOutlined, DeleteOutlined, CheckOutlined, ClockCircleOutlined,
  UserOutlined, PhoneOutlined, MailOutlined, CalendarOutlined,
  WhatsAppOutlined, EnvironmentOutlined, FileTextOutlined, MessageOutlined,
  SmileOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { FollowUpItem, FOLLOWUP_PRIORITIES, followUpApi } from "@/services/followups";
import { getTypeTagColor } from "./followupCalendarUtils";
import PastelTag, { OverdueTag } from "@/components/common/PastelTag";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import { useAuthStore } from "@/store/auth";
import { useAuthorPhotoMap } from "@/hooks/useAuthorPhotoMap";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { extractCustomColor } from "@/pages/workspace/workspaceCalendarTheme";
import { apiErrorMsg } from "@/utils/apiError";
import customParseFormat from "dayjs/plugin/customParseFormat";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);

function formatCommentDate(dateStr: string): string {
  const d = dayjs(dateStr, "DD MMM YYYY, hh:mm A", true);
  if (!d.isValid()) return dateStr;
  const diffMins = dayjs().diff(d, "minute");
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = dayjs().diff(d, "hour");
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.format("D MMM YYYY, h:mm A");
}

const { Text, Title } = Typography;

const TYPE_ICON: Record<string, React.ReactNode> = {
  EMAIL: <MailOutlined />, CALL: <PhoneOutlined />, 
  WHATSAPP: <WhatsAppOutlined />, SITE_VISIT: <EnvironmentOutlined />,
};

/* ── Helpers ────────────────────────────────────────────────── */

/** Parse the raw comment block into individual thread entries */
function parseComments(raw: string): { author: string; date: string; body: string }[] {
  if (!raw.trim()) return [];
  const lines = raw.split("\n");
  const entries: { author: string; date: string; body: string }[] = [];
  let current: { author: string; date: string; body: string } | null = null;

  const headerRe = /^(.+?) \((\d{2} \w+ \d{4}, \d{2}:\d{2} [AP]M)\):$/;

  for (const line of lines) {
    const m = line.match(headerRe);
    if (m) {
      if (current) entries.push(current);
      current = { author: m[1].trim(), date: m[2].trim(), body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) entries.push(current);
  return entries;
}

/** Generate initials from a name string */
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Deterministic pastel background from a string */
const AVATAR_COLORS = [
  "#c7d2fe", "#a5b4fc", "#93c5fd", "#6ee7b7", "#fca5a5",
  "#fcd34d", "#f9a8d4", "#d8b4fe",
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* ── Section wrapper ────────────────────────────────────────── */
function Section({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Divider style={{ margin: "14px 0" }} />
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ color: "#6b7280", fontSize: 18, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 14, display: "block", marginBottom: 6 }}>
            {label}
          </Text>
          {children}
        </div>
      </div>
    </>
  );
}

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😊", "🥹", "😍", "🥳", "😎", "👍", "👎", "👏", "🙌", "🤝",
  "🙏", "❤️", "🔥", "✨", "🚀", "💡", "🎯", "📌", "✅", "❌", "💬", "👀", "⚡", "💯",
];

/* ── Main component ─────────────────────────────────────────── */
export default function FollowUpDetailDrawer({
  item: propItem, open, onClose, onEdit, onDone, onDelete,
  canUpdate, canDelete, canTransition,
}: {
  item: FollowUpItem | null;
  open: boolean;
  onClose: () => void;
  onEdit: (item: FollowUpItem) => void;
  onDone: (item: FollowUpItem) => void;
  onDelete: (id: string) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canTransition: boolean;
}) {
  const [localItem, setLocalItem] = useState<FollowUpItem | null>(null);

  useEffect(() => { setLocalItem(propItem); }, [propItem]);

  const { data: remoteItem } = useQuery({
    queryKey: ["followup-detail", propItem?.id],
    queryFn: () => (propItem?.id ? followUpApi.get(propItem.id) : null),
    enabled: open && !!propItem?.id,
    refetchInterval: 3000,
  });

  const item = remoteItem || localItem || propItem;
  const authorPhotoMap = useAuthorPhotoMap(item?.assignees);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const addCommentMutation = useMutation({
    mutationFn: (newComment: string) => {
      if (!item) throw new Error("No item selected");
      const { color, cleanText } = extractCustomColor(item.comments);
      const formattedTime = dayjs().format("DD MMM YYYY, hh:mm A");
      const authorName = user?.full_name || user?.username || "Unknown User";
      const commentHeader = `${authorName} (${formattedTime}):`;
      const newThread = cleanText
        ? `${cleanText}\n\n${commentHeader}\n${newComment}`
        : `${commentHeader}\n${newComment}`;
      const finalComments = newThread + (color ? ` <!--color:${color}-->` : "");
      return followUpApi.update(item.id, { comments: finalComments });
    },
    onSuccess: (data) => {
      setCommentText("");
      message.success("Comment added");
      setLocalItem((prev) => prev ? { ...prev, comments: data.comments } : null);
      qc.invalidateQueries({ queryKey: ["followup-detail", item?.id] });
      qc.invalidateQueries({ queryKey: ["followups-board"] });
      qc.invalidateQueries({ queryKey: ["followups-list"] });
      qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
      qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
    },
    onError: (err: unknown) => { message.error(apiErrorMsg(err, "Failed to add comment")); },
  });

  if (!item) return null;

  const isFinal = item.workflow_state_slug === "completed" || item.workflow_state_slug === "cancelled";
  const pri = FOLLOWUP_PRIORITIES.find((p) => p.value === item.priority) ?? FOLLOWUP_PRIORITIES[2];
  const { color: _color, cleanText } = extractCustomColor(item.comments);
  const parsedComments = parseComments(cleanText || "");

  /* date/time formatting */
  const dateLabel = item.start_date ? dayjs(item.start_date).format("dddd, D MMMM YYYY") : "No date set";
  const timeRange = item.start_time
    ? item.end_time
      ? `${dayjs(`2000-01-01T${item.start_time}`).format("h:mm A")} – ${dayjs(`2000-01-01T${item.end_time}`).format("h:mm A")}`
      : dayjs(`2000-01-01T${item.start_time}`).format("h:mm A")
    : null;

  return (
    <Drawer
      title={<span style={{ fontWeight: 600, fontSize: 15 }}>Follow-up details</span>}
      open={open}
      onClose={onClose}
      width={420}
      styles={{
        body: { paddingTop: 12, paddingBottom: 80 },
        header: { borderBottom: "1px solid #f0f0f0" },
      }}
      footer={
        <Space wrap style={{ padding: "4px 0" }}>
          {canUpdate && (
            <Button
              icon={<EditOutlined />}
              onClick={() => { onEdit(item); onClose(); }}
              style={{ borderRadius: 8 }}
            >
              Edit
            </Button>
          )}
          {canTransition && !isFinal && item.can_transition && (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => { onDone(item); onClose(); }}
              style={{ borderRadius: 8 }}
            >
              Mark done
            </Button>
          )}
          {canDelete && (
            <Popconfirm title="Delete this follow-up?" onConfirm={() => { onDelete(item.id); onClose(); }}>
              <Button danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }}>Delete</Button>
            </Popconfirm>
          )}
        </Space>
      }
    >
      {/* ── Title ── */}
      <Title level={4} style={{ marginTop: 0, marginBottom: 14, fontWeight: 700, lineHeight: 1.3 }}>
        {item.title}
      </Title>

      {/* ── Tags ── */}
      <Space wrap size={[8, 8]} style={{ marginBottom: 4 }}>
        <PastelTag tone={pri}>{item.priority_label || pri.label}</PastelTag>
        <Tag
          icon={TYPE_ICON[item.type]}
          style={{
            background: getTypeTagColor(item.type), color: "#fff",
            border: "none", borderRadius: 20,
            padding: "2px 10px", fontWeight: 500, fontSize: 13,
          }}
        >
          {item.type_label}
        </Tag>
        <Tag
          style={{
            background: item.workflow_state_color || "#0d9488",
            color: "#fff", border: "none", borderRadius: 20,
            padding: "2px 10px", fontWeight: 500, fontSize: 13,
          }}
        >
          {item.workflow_state_name}
        </Tag>
        {item.is_overdue && <OverdueTag />}
      </Space>

      {/* ── When ── */}
      <Section icon={<ClockCircleOutlined />} label="When">
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0 6px", fontSize: 13, color: "#374151" }}>
          <span>{dateLabel}</span>
          {timeRange && (
            <>
              <span style={{ color: "#d1d5db", margin: "0 2px" }}>|</span>
              <ClockCircleOutlined style={{ fontSize: 12, color: "#9ca3af" }} />
              <span style={{ color: "#374151" }}>{timeRange}</span>
            </>
          )}
        </div>
      </Section>

      {/* ── People ── */}
      <Section icon={<UserOutlined />} label="People">
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
          <strong>Assignees:</strong>{" "}
          {(item.assignees_data || []).map((a) => a.full_name).join(", ") || "Unassigned"}
        </p>
        {item.reporter_name && (
          <Text type="secondary" style={{ fontSize: 12 }}>Created by {item.reporter_name}</Text>
        )}
      </Section>

      {/* ── Description ── */}
      {item.description && (
        <Section icon={<FileTextOutlined />} label="Description">
          <p style={{ margin: 0, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {item.description}
          </p>
        </Section>
      )}

      {/* ── Comments ── */}
      <Section icon={<MessageOutlined />} label="Comments">
        {parsedComments.length === 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>No comments yet.</Text>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {parsedComments.map((c, i) => {
            const authorPhoto = authorPhotoMap[c.author.toLowerCase()];
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {/* Profile Avatar / Photo */}
                <AssigneeAvatar name={c.author} src={authorPhoto} size={34} />
                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <Text strong style={{ fontSize: 13 }}>{c.author}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }} title={c.date}>{formatCommentDate(c.date)}</Text>
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>
                    {c.body.trim()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Add Comment ── */}
      <div style={{ marginTop: 20 }}>
        <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>Add Comment</Text>
        <div style={{ position: "relative" }}>
          <textarea
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            style={{
              width: "100%", boxSizing: "border-box",
              borderRadius: 10, border: "1px solid #e5e7eb",
              padding: "10px 40px 10px 12px", fontSize: 13,
              resize: "none", outline: "none",
              fontFamily: "inherit", color: "#374151",
              lineHeight: 1.5,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && commentText.trim()) {
                addCommentMutation.mutate(commentText.trim());
              }
            }}
          />
          <Popover
            content={
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, width: 250, padding: 4 }}>
                {EMOJIS.map((emoji) => (
                  <span
                    key={emoji}
                    onClick={() => {
                      setCommentText((prev) => prev + emoji);
                      setEmojiPickerOpen(false);
                    }}
                    style={{
                      fontSize: 19,
                      cursor: "pointer",
                      textAlign: "center",
                      padding: "4px 2px",
                      borderRadius: 4,
                      userSelect: "none",
                    }}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            }
            trigger="click"
            open={emojiPickerOpen}
            onOpenChange={setEmojiPickerOpen}
            placement="topRight"
          >
            <SmileOutlined style={{
              position: "absolute", right: 12, bottom: 12,
              color: emojiPickerOpen ? "#2563eb" : "#9ca3af", fontSize: 18, cursor: "pointer",
              transition: "color 0.15s",
            }} />
          </Popover>
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="primary"
            size="small"
            onClick={() => { if (commentText.trim()) addCommentMutation.mutate(commentText.trim()); }}
            loading={addCommentMutation.isPending}
            disabled={!commentText.trim()}
            style={{ borderRadius: 8 }}
          >
            Post Comment
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
