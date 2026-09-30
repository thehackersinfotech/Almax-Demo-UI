import { useState, useEffect } from "react";
import { Drawer, Button, Tag, Space, Typography, Divider, Popconfirm, Popover, message } from "antd";
import {
  EditOutlined, DeleteOutlined, CheckOutlined, ClockCircleOutlined, UserOutlined,
  MessageOutlined, SmileOutlined
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);

import { TodoItem, TODO_PRIORITIES, todoApi } from "@/services/todos";
import PastelTag, { OverdueTag } from "@/components/common/PastelTag";
import { formatTimeRange } from "@/pages/followups/followupCalendarUtils";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";
import { useAuthorPhotoMap } from "@/hooks/useAuthorPhotoMap";
import { extractCustomColor } from "./workspaceCalendarTheme";
import { apiErrorMsg } from "@/utils/apiError";

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

const { Text, Title, Paragraph } = Typography;

/* ── Helpers ────────────────────────────────────────────────── */

function parseComments(raw: string): { author: string; date: string; body: string }[] {
  if (!raw || !raw.trim()) return [];
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

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "#c7d2fe", "#a5b4fc", "#93c5fd", "#6ee7b7", "#fca5a5",
  "#fcd34d", "#f9a8d4", "#d8b4fe",
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
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


export default function TodoDetailDrawer({
  item, open, onClose, onEdit, onDone, onDelete,
  canUpdate, canDelete, canTransition,
}: {
  item: TodoItem | null;
  open: boolean;
  onClose: () => void;
  onEdit: (item: TodoItem) => void;
  onDone: (item: TodoItem) => void;
  onDelete: (id: string) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canTransition: boolean;
}) {
  const [localItem, setLocalItem] = useState<TodoItem | null>(null);

  useEffect(() => { setLocalItem(item); }, [item]);

  const { data: remoteItem } = useQuery({
    queryKey: ["todo-detail", item?.id],
    queryFn: () => (item?.id ? todoApi.get(item.id) : null),
    enabled: open && !!item?.id,
    refetchInterval: 3000,
  });

  const activeItem = remoteItem || localItem || item;
  const authorPhotoMap = useAuthorPhotoMap(activeItem?.assignees);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const addCommentMutation = useMutation({
    mutationFn: (newComment: string) => {
      if (!activeItem) throw new Error("No item selected");
      const { color, cleanText } = extractCustomColor(activeItem.comments || "");
      const formattedTime = dayjs().format("DD MMM YYYY, hh:mm A");
      const authorName = user?.full_name || user?.username || "Unknown User";
      const commentHeader = `${authorName} (${formattedTime}):`;
      const newThread = cleanText
        ? `${cleanText}

${commentHeader}
${newComment}`
        : `${commentHeader}
${newComment}`;
      const finalComments = newThread + (color ? ` <!--color:${color}-->` : "");
      return todoApi.update(activeItem.id, { comments: finalComments });
    },
    onSuccess: (data) => {
      setCommentText("");
      message.success("Comment added");
      setLocalItem((prev) => prev ? { ...prev, comments: data.comments } : null);
      qc.invalidateQueries({ queryKey: ["todo-detail", activeItem?.id] });
      qc.invalidateQueries({ queryKey: ["todos-board"] });
      qc.invalidateQueries({ queryKey: ["todos-list"] });
      qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
      qc.invalidateQueries({ queryKey: ["workspace-calendar"] });
    },
    onError: (err: unknown) => { message.error(apiErrorMsg(err, "Failed to add comment")); },
  });

  if (!activeItem) return null;

  const isFinal = activeItem.workflow_state_slug === "done" || activeItem.workflow_state_slug === "cancelled";
  const pri = TODO_PRIORITIES.find((p) => p.value === activeItem.priority) ?? TODO_PRIORITIES[1];
  const timeRange = formatTimeRange(activeItem.start_time, activeItem.end_time);

  return (
    <Drawer
      title="To-do details"
      open={open}
      onClose={onClose}
      width={400}
      styles={{ body: { paddingTop: 8 } }}
      footer={
        <Space wrap>
          {canUpdate && (
            <Button icon={<EditOutlined />} onClick={() => { onEdit(activeItem); onClose(); }}>
              Edit
            </Button>
          )}
          {canTransition && !isFinal && activeItem.can_transition && (
            <Button type="primary" icon={<CheckOutlined />} onClick={() => { onDone(activeItem); onClose(); }}>
              Mark done
            </Button>
          )}
          {canDelete && (
            <Popconfirm title="Delete this to-do?" onConfirm={() => { onDelete(activeItem.id); onClose(); }}>
              <Button danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
        </Space>
      }
    >
      <Title level={4} style={{ marginTop: 0, marginBottom: 12 }}>{activeItem.title}</Title>

      <Space wrap size={[6, 6]} style={{ marginBottom: 16 }}>
        <PastelTag tone={pri}>{activeItem.priority_label || pri.label}</PastelTag>
        <Tag color={activeItem.workflow_state_color}>{activeItem.workflow_state_name}</Tag>
        {activeItem.is_overdue && <OverdueTag />}
      </Space>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <ClockCircleOutlined style={{ color: "#6b7280", marginTop: 2 }} />
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>When</Text>
            <Text>
              {activeItem.start_date ? (
                <>
                  {dayjs(activeItem.start_date).format("dddd, D MMMM YYYY")}
                  {activeItem.due_date && activeItem.due_date !== activeItem.start_date && (
                    <span style={{ color: "var(--bms-text-2)" }}> – {dayjs(activeItem.due_date).format("D MMMM YYYY")}</span>
                  )}
                </>
              ) : activeItem.due_date ? (
                dayjs(activeItem.due_date).format("dddd, D MMMM YYYY")
              ) : (
                "No date set"
              )}
              {timeRange && <span style={{ color: "var(--bms-text-2)" }}> · {timeRange}</span>}
            </Text>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <UserOutlined style={{ color: "#6b7280", marginTop: 2 }} />
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>People</Text>
            <Text>Assignees: {(activeItem.assignees_data || []).map(a => a.full_name).join(", ") || "Unassigned"}</Text>
            {activeItem.reporter_name && (
              <div style={{ color: "var(--bms-text-2)", fontSize: 12 }}>Created by {activeItem.reporter_name}</div>
            )}
          </div>
        </div>
      </div>


      {activeItem.description && extractCustomColor(activeItem.description).cleanText && (
        <>
          <Divider style={{ margin: "16px 0 12px" }} />
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Description</Text>
          <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{extractCustomColor(activeItem.description).cleanText}</Paragraph>
        </>
      )}

      {activeItem.content && extractCustomColor(activeItem.content).cleanText && (
        <>
          <Divider style={{ margin: "16px 0 12px" }} />
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>Content</Text>
          <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{extractCustomColor(activeItem.content).cleanText}</Paragraph>
        </>
      )}

      <Section icon={<MessageOutlined />} label="Comments">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {parseComments(extractCustomColor(activeItem.comments || "").cleanText).map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <AssigneeAvatar name={c.author} src={authorPhotoMap[c.author.toLowerCase()]} size={32} />
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>{c.author}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }} title={c.date}>{formatCommentDate(c.date)}</span>
                </div>
                <div style={{
                  fontSize: 13, color: "#4b5563", lineHeight: 1.5,
                  background: "#f3f4f6", padding: "8px 12px",
                  borderRadius: "0 12px 12px 12px", whiteSpace: "pre-wrap",
                  display: "inline-block",
                }}>
                  {c.body}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20 }}>
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
                        fontSize: 19, cursor: "pointer", textAlign: "center",
                        padding: "4px 2px", borderRadius: 4, userSelect: "none",
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
      </Section>

    </Drawer>
  );
}
