import { get, post, patch, del } from "@/services/api";

export type ConversationType = "DIRECT" | "GROUP";
export type ParticipantRole = "MEMBER" | "ADMIN";
export type ScanStatus = "PENDING" | "CLEAN" | "INFECTED" | "ERROR";

export interface ChatEmployee {
  id: string;
  full_name: string;
  email: string;
  profile_picture_url: string | null;
}

export interface ConversationParticipant {
  id: string;
  employee: ChatEmployee;
  role: ParticipantRole;
  is_favorite: boolean;
  muted: boolean;
  last_read_at: string | null;
}

export interface ConversationListItem {
  id: string;
  type: ConversationType;
  name: string;
  /** Presigned URL for the group photo, or null if none set (DIRECT
   * conversations never have one — the frontend derives their identity from
   * the other participant instead). */
  avatar_url: string | null;
  is_archived: boolean;
  last_message_at: string | null;
  participants: ConversationParticipant[];
  unread_count: number;
  is_favorite: boolean;
  last_message_preview: { body: string; sender_id: string | null; created_at: string } | null;
}

export interface MessageAttachment {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  scan_status: ScanStatus;
  scanned_at: string | null;
  download_url: string | null;
}

export interface ChatMessage {
  id: string;
  conversation: string;
  sender: ChatEmployee | null;
  body: string;
  reply_to: string | null;
  is_edited: boolean;
  edited_at: string | null;
  is_important: boolean;
  is_deleted: boolean;
  mentioned_employee_ids: string[];
  attachments: MessageAttachment[];
  is_starred_by_me: boolean;
  reaction_summary: Record<string, string[]>;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SearchResults {
  messages: ChatMessage[];
  files: MessageAttachment[];
}

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB, mirrors settings.CHAT_MAX_ATTACHMENT_SIZE

export const chatApi = {
  listConversations: () => get<PaginatedResponse<ConversationListItem> | ConversationListItem[]>("/chat/conversations/"),

  createConversation: (data: { type: ConversationType; name?: string; participant_ids: string[] }) =>
    post<ConversationListItem>("/chat/conversations/", data),

  /** Rename a group / set its photo (avatar = object_key from
   * presignAttachment, reused here — same presigned-upload flow as message
   * attachments) — admin-only, enforced server-side. */
  updateConversation: (id: string, data: { name?: string; avatar?: string }) =>
    patch<ConversationListItem>(`/chat/conversations/${id}/`, data),

  favoriteConversation: (id: string) =>
    post<{ is_favorite: boolean }>(`/chat/conversations/${id}/favorite/`),

  markRead: (id: string) =>
    post<{ last_read_at: string }>(`/chat/conversations/${id}/read/`),

  clearConversation: (id: string) =>
    post<{ status: string }>(`/chat/conversations/${id}/clear/`),

  addMembers: (id: string, employeeIds: string[]) =>
    post<ConversationListItem>(`/chat/conversations/${id}/members/`, { employee_ids: employeeIds }),

  removeMember: (id: string, employeeId: string) =>
    del(`/chat/conversations/${id}/members/${employeeId}/`),

  listMessages: (conversationId: string, params?: Record<string, unknown>) =>
    get<PaginatedResponse<ChatMessage>>("/chat/messages/", { conversation: conversationId, ...params }),

  sendMessage: (data: {
    conversation: string;
    body: string;
    reply_to?: string | null;
    is_important?: boolean;
    mention_employee_ids?: string[];
    attachments?: Array<{ object_key: string; original_filename: string; content_type: string; size_bytes: number }>;
  }) => post<ChatMessage>("/chat/messages/", data),

  editMessage: (id: string, body: string) =>
    patch<ChatMessage>(`/chat/messages/${id}/`, { body }),

  deleteMessage: (id: string) => del(`/chat/messages/${id}/`),

  starMessage: (id: string) =>
    post<{ is_starred_by_me: boolean }>(`/chat/messages/${id}/star/`),

  markImportant: (id: string) =>
    post<{ is_important: boolean }>(`/chat/messages/${id}/important/`),

  toggleReaction: (id: string, emoji: string) =>
    post<ChatMessage>(`/chat/messages/${id}/reaction/`, { emoji }),

  votePoll: (id: string, optionIndex: number) =>
    post<ChatMessage>(`/chat/messages/${id}/vote-poll/`, { option_index: optionIndex }),

  myMentions: () => get<PaginatedResponse<ChatMessage>>("/chat/messages/mentions/"),

  starredMessages: () => get<PaginatedResponse<ChatMessage>>("/chat/messages/starred/"),

  search: (q: string, conversationId?: string) =>
    get<SearchResults>("/chat/search/", conversationId ? { q, conversation: conversationId } : { q }),

  presignAttachment: (conversationId: string, filename: string, contentType: string, sizeBytes: number) =>
    post<{ upload_url: string; object_key: string }>(
      `/chat/conversations/${conversationId}/attachments/presign/`,
      { filename, content_type: contentType, size_bytes: sizeBytes },
    ),

  uploadToPresignedUrl: (uploadUrl: string, file: File) =>
    fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } }),

  initiateCall: (data: { recipient_id: string; call_type: "VOICE" | "VIDEO"; conversation_id?: string }) =>
    post<CallRecord>("/chat/calls/initiate/", data),

  getActiveCall: () => get<CallRecord | null>("/chat/calls/active/"),

  respondToCall: (data: { call_id: string; action: "ACCEPT" | "DECLINE" }) =>
    post<CallRecord>("/chat/calls/respond/", data),

  endCall: (data: { call_id: string; duration_seconds?: number }) =>
    post<CallRecord>("/chat/calls/end/", data),

  listCallHistory: () => get<CallRecord[]>("/chat/calls/history/"),

  getPresence: (employeeIds?: string[]) =>
    get<{ presence: Record<string, "online" | "offline"> }>("/chat/presence/", employeeIds?.length ? { employee_ids: employeeIds } : undefined),

  touchPresence: () => post<{ status: string }>("/chat/presence/"),

  askAI: (data: { prompt: string; conversation_id?: string; history?: any[]; attachments?: any[] }) =>
    post<{ reply: string; conversation_id: string; model: string; timestamp: string }>("/chat/ai/", data),
};

export interface CallRecord {
  _id: string;
  caller_id: string;
  recipient_id: string;
  call_type: "VOICE" | "VIDEO";
  conversation_id: string | null;
  status: "RINGING" | "ACCEPTED" | "DECLINED" | "ENDED" | "MISSED";
  created_at: string;
  accepted_at?: string | null;
  ended_at: string | null;
  duration_seconds: number;
  caller?: ChatEmployee | null;
  recipient?: ChatEmployee | null;
}

export function isUserMe(
  emp?: { id?: string | null; user_id?: string | null; employee_code?: string | null; username?: string | null; email?: string | null } | string | null,
  user?: { id?: string | null; employee_id?: string | null; employee_code?: string | null; username?: string | null; email?: string | null } | null
): boolean {
  if (!emp || !user) return false;
  if (typeof emp === "string") {
    const target = emp.toLowerCase().trim();
    return Boolean(
      (user.id && target === String(user.id).toLowerCase().trim()) ||
      (user.employee_id && target === String(user.employee_id).toLowerCase().trim()) ||
      (user.employee_code && target === String(user.employee_code).toLowerCase().trim()) ||
      (user.username && target === String(user.username).toLowerCase().trim()) ||
      (user.email && target === String(user.email).toLowerCase().trim())
    );
  }
  const empId = emp.id ? String(emp.id).toLowerCase().trim() : null;
  const empUserId = (emp as any).user_id ? String((emp as any).user_id).toLowerCase().trim() : null;
  const empCode = (emp as any).employee_code ? String((emp as any).employee_code).toLowerCase().trim() : null;
  const empUser = (emp as any).username ? String((emp as any).username).toLowerCase().trim() : null;
  const empEmail = emp.email ? String(emp.email).toLowerCase().trim() : null;

  return Boolean(
    (empId && isUserMe(empId, user)) ||
    (empUserId && isUserMe(empUserId, user)) ||
    (empCode && isUserMe(empCode, user)) ||
    (empUser && isUserMe(empUser, user)) ||
    (empEmail && isUserMe(empEmail, user))
  );
}

export function getOtherParticipant<T extends { employee?: any }>(
  participants?: T[] | null,
  currentUser?: { id?: string | null; employee_id?: string | null; employee_code?: string | null; username?: string | null; email?: string | null } | null
): T | null {
  if (!participants || participants.length === 0) return null;
  const other = participants.find((p) => p && p.employee && !isUserMe(p.employee, currentUser));
  return other || participants[0] || null;
}

