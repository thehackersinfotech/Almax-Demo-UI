import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { message as toast } from "antd";
import { MessageOutlined, TeamOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import { useChatSocket } from "@/hooks/useChatSocket";
import { chatApi, ChatMessage, MessageAttachment, ConversationListItem, PaginatedResponse, getOtherParticipant } from "@/services/chat";

import WorkspaceSidebar from "./components/WorkspaceSidebar";
import WorkspaceHeader from "./components/WorkspaceHeader";
import DiscussionCard from "./components/DiscussionCard";
import WorkspaceComposer from "./components/WorkspaceComposer";
import WorkspaceRightDesk from "./components/WorkspaceRightDesk";
import PinnedMessageBanner from "./components/PinnedMessageBanner";
import NewChatModal from "./components/NewChatModal";
import MessageInfoModal from "./components/MessageInfoModal";
import { CallOverlayModal } from "./components/CallOverlayModal";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { CallHistoryDrawer, CallLogItem } from "./components/CallHistoryDrawer";
import { AIAvatarIcon } from "./components/AIAvatarIcon";
import { callSounds } from "@/utils/callSounds";
import { useThemeStore } from "@/store/theme";

dayjs.extend(relativeTime);

const AI_BOT_CONVERSATION: ConversationListItem = {
  id: "ai_bot",
  type: "DIRECT",
  name: "Nexus AI Assistant",
  avatar_url: null,
  is_archived: false,
  last_message_at: new Date().toISOString(),
  unread_count: 0,
  is_favorite: true,
  last_message_preview: {
    body: "✨ AI Assistant active & ready",
    sender_id: "ai_bot",
    created_at: new Date().toISOString(),
  },
  participants: [
    {
      id: "part_ai",
      employee: {
        id: "ai_bot",
        full_name: "Nexus AI Assistant",
        email: "ai@nexus.internal",
        profile_picture_url: null,
      },
      role: "ADMIN",
      is_favorite: true,
      muted: false,
      last_read_at: new Date().toISOString(),
    },
  ],
};

const INITIAL_AI_MESSAGE: ChatMessage = {
  id: "ai_welcome",
  conversation: "ai_bot",
  sender: {
    id: "ai_bot",
    full_name: "Nexus AI Assistant",
    email: "ai@nexus.internal",
    profile_picture_url: null,
  },
  body: "👋 **Hello! I'm your Nexus AI Assistant.**\n\nI can help you with:\n- 📊 **Project & Task Management**: Structuring sprints, requirements, and tickets\n- 📄 **Document & Photo Analysis**: Upload any screenshot, spreadsheet, or doc for review\n- ✍️ **Professional Writing**: Drafting client emails, memos, or meeting summaries\n- 💻 **Technical & Coding Support**: Debugging, architecture questions, and script writing\n\n*How can I assist you today?*",
  reply_to: null,
  is_edited: false,
  edited_at: null,
  is_important: false,
  is_deleted: false,
  mentioned_employee_ids: [],
  attachments: [],
  is_starred_by_me: false,
  reaction_summary: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const ChatPage: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const user = useAuthStore((s) => s.user);
  const myId = user?.id;
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { startTyping, stopTyping } = useChatSocket();

  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId);
  const onlineEmployeeIds = useChatStore((s) => s.onlineEmployeeIds);

  const getUserStorageKey = (key: string) => `pmt_${myId || "anon"}_${key}`;

  const isMe = useCallback(
    (uid?: string | null) => {
      if (!uid || !myId) return false;
      const target = String(uid).toLowerCase().trim();
      return (
        target === String(myId).toLowerCase().trim() ||
        Boolean(user?.employee_id && target === String(user.employee_id).toLowerCase().trim()) ||
        Boolean(user?.employee_code && target === user.employee_code.toLowerCase().trim()) ||
        Boolean(user?.username && target === user.username.toLowerCase().trim()) ||
        Boolean(user?.email && target === user.email.toLowerCase().trim())
      );
    },
    [myId, user]
  );

  // Initialize online presence from server
  useEffect(() => {
    chatApi.getPresence().then((res) => {
      if (res && res.presence) {
        Object.entries(res.presence).forEach(([eid, status]) => {
          useChatStore.getState().setPresence(eid, status as "online" | "offline");
        });
      }
    }).catch(() => {});
  }, []);

  // Local conversations with persistence
  const [localConversations, setLocalConversations] = useState<ConversationListItem[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(getUserStorageKey("custom_conversations")) || "[]");
      return Array.isArray(parsed) ? parsed.filter((c) => c && typeof c === "object" && c.id) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!myId) return;
    try {
      localStorage.setItem(getUserStorageKey("custom_conversations"), JSON.stringify(localConversations));
    } catch (e) {}
  }, [localConversations, myId]);

  // Local messages map
  const [localMessagesMap, setLocalMessagesMap] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(getUserStorageKey("local_messages")) || "{}");
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!myId) return;
    try {
      localStorage.setItem(getUserStorageKey("local_messages"), JSON.stringify(localMessagesMap));
    } catch (e) {}
  }, [localMessagesMap, myId]);

  // Lock body & html scrolling
  useEffect(() => {
    const origBody = document.body.style.overflow;
    const origHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = origBody;
      document.documentElement.style.overflow = origHtml;
    };
  }, []);

  // UI state
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [newChatDefaultType, setNewChatDefaultType] = useState<"DIRECT" | "GROUP" | "PROJECT">("DIRECT");
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callType, setCallType] = useState<"VOICE" | "VIDEO">("VOICE");
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);
  const [rightDeskOpen, setRightDeskOpen] = useState(false);
  const [messageInfoOpen, setMessageInfoOpen] = useState(false);
  const [selectedMessageInfo, setSelectedMessageInfo] = useState<ChatMessage | null>(null);
  const [isAITyping, setIsAITyping] = useState(false);

  // Search inside thread
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [searchInChatQuery, setSearchInChatQuery] = useState("");

  // Pinned chats and messages
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(getUserStorageKey("pinned_chats")) || "[]");
    } catch {
      return [];
    }
  });

  const [pinnedMessagesByConv, setPinnedMessagesByConv] = useState<Record<string, ChatMessage>>(() => {
    try {
      return JSON.parse(localStorage.getItem(getUserStorageKey("pinned_messages")) || "{}");
    } catch {
      return {};
    }
  });

  const [clearedConvTimestamps, setClearedConvTimestamps] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(getUserStorageKey("cleared_timestamps")) || "{}");
    } catch {
      return {};
    }
  });

  const [deletedForMeIds, setDeletedForMeIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(getUserStorageKey("deleted_for_me")) || "[]");
    } catch {
      return [];
    }
  });

  const [hiddenFeedConvIds, setHiddenFeedConvIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(getUserStorageKey("hidden_from_feed")) || "[]");
    } catch {
      return [];
    }
  });

  const [callLogs, setCallLogs] = useState<CallLogItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(getUserStorageKey("call_logs")) || "[]");
    } catch {
      return [];
    }
  });

  const [lastViewedCallHistory, setLastViewedCallHistory] = useState<string>(() => {
    try {
      return localStorage.getItem(getUserStorageKey("call_history_last_viewed")) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (!myId) return;
    try {
      localStorage.setItem(getUserStorageKey("call_logs"), JSON.stringify(callLogs));
    } catch (e) {}
  }, [callLogs, myId]);

  // Unhide listener
  useEffect(() => {
    const handleUnhide = (e: any) => {
      const convId = e.detail?.conversationId;
      if (convId) {
        setHiddenFeedConvIds((prev) => {
          const next = prev.filter((id) => id !== convId);
          if (myId) localStorage.setItem(getUserStorageKey("hidden_from_feed"), JSON.stringify(next));
          return next;
        });
      }
    };
    window.addEventListener("chat:unhide", handleUnhide);
    return () => window.removeEventListener("chat:unhide", handleUnhide);
  }, [myId, getUserStorageKey]);

  const [replyingMessage, setReplyingMessage] = useState<ChatMessage | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);

  // Queries
  const conversationsQuery = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => chatApi.listConversations().catch(() => []),
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchInterval: false,
  });

  const activeCallQuery = useQuery({
    queryKey: ["chat", "activeCall"],
    queryFn: () => chatApi.getActiveCall().catch(() => null),
    staleTime: 0,
    refetchInterval: 1500,
  });

  const callHistoryQuery = useQuery({
    queryKey: ["chat", "callHistory"],
    queryFn: () => chatApi.listCallHistory().catch(() => []),
    staleTime: 0,
    refetchInterval: 3000,
  });

  const activeCall = activeCallQuery.data;

  // Merge server list + local conversations + deduplicate DIRECT chats per recipient
  const conversations: ConversationListItem[] = useMemo(() => {
    const rawData = conversationsQuery.data;
    const serverList: ConversationListItem[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as any)?.results)
      ? (rawData as any).results
      : [];

    const map = new Map<string, ConversationListItem>();
    if (Array.isArray(serverList)) {
      serverList.forEach((c) => {
        if (c && c.id && c.id !== "ai_bot") map.set(c.id, { ...c });
      });
    }
    if (Array.isArray(localConversations)) {
      localConversations.forEach((c) => {
        if (c && c.id && c.id !== "ai_bot") {
          const existing = map.get(c.id);
          map.set(c.id, { ...existing, ...c });
        }
      });
    }

    const directSeenRecipients = new Map<string, ConversationListItem>();
    const nonDirectConvs: ConversationListItem[] = [];

    Array.from(map.values()).forEach((c) => {
      if (c.type === "DIRECT") {
        const other = c.participants?.find(
          (p) => !isMe(p?.employee?.id) && !isMe((p as any)?.employee_id)
        ) || c.participants?.[0];
        const recipKey =
          other?.employee?.id ||
          (other?.employee as any)?.employee_code ||
          (other as any)?.employee_id ||
          c.id;

        if (directSeenRecipients.has(recipKey)) {
          const existing = directSeenRecipients.get(recipKey)!;
          const isCurrentSynthetic = c.id.startsWith("direct_");
          const isExistingSynthetic = existing.id.startsWith("direct_");

          let keepObj = existing;
          if (isExistingSynthetic && !isCurrentSynthetic) {
            keepObj = c;
          } else if (!isCurrentSynthetic && !isExistingSynthetic) {
            const timeCurrent = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
            const timeExisting = existing.last_message_at ? new Date(existing.last_message_at).getTime() : 0;
            if (timeCurrent > timeExisting) {
              keepObj = c;
            }
          }

          keepObj = {
            ...keepObj,
            unread_count: (existing.unread_count || 0) + (c.unread_count || 0),
          };
          directSeenRecipients.set(recipKey, keepObj);
        } else {
          directSeenRecipients.set(recipKey, c);
        }
      } else {
        nonDirectConvs.push(c);
      }
    });

    const uniqueDirectConvs = Array.from(directSeenRecipients.values());
    const otherConvs = [...uniqueDirectConvs, ...nonDirectConvs].filter((c) => {
      if (c.unread_count > 0) return true;
      return !hiddenFeedConvIds.includes(c.id);
    });

    const mergedList = [AI_BOT_CONVERSATION, ...otherConvs].map((c) =>
      c.id === activeConversationId ? { ...c, unread_count: 0 } : c
    );

    return mergedList;
  }, [conversationsQuery.data, localConversations, hiddenFeedConvIds, activeConversationId, isMe]);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId, setActiveConversationId]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  const isDirectActiveCall = useMemo(() => {
    if (!activeCall || !activeConversation) return false;
    if (activeCall.conversation_id && activeCall.conversation_id === activeConversation.id) return true;
    if (activeConversation.type === "DIRECT") {
      const otherId = activeConversation.participants?.find(
        (p) => !isMe(p?.employee?.id) && !isMe((p as any)?.employee_id)
      )?.employee?.id;
      return isMe(activeCall.caller_id)
        ? String(activeCall.recipient_id) === String(otherId)
        : String(activeCall.caller_id) === String(otherId);
    }
    return false;
  }, [activeCall, activeConversation, isMe]);

  // Synthetic direct conversation resolver
  useEffect(() => {
    if (activeConversationId && activeConversationId.startsWith("direct_")) {
      const empIdOrCode = activeConversationId.replace("direct_", "");
      const matchingServerConv = conversations.find(
        (c) =>
          c.type === "DIRECT" &&
          !c.id.startsWith("direct_") &&
          c.participants?.some(
            (p) =>
              p.employee?.id === empIdOrCode ||
              ((p.employee as any)?.employee_code &&
                (p.employee as any).employee_code.toLowerCase() === empIdOrCode.toLowerCase())
          )
      );
      if (matchingServerConv && matchingServerConv.id) {
        const syntheticId = activeConversationId;
        const realId = matchingServerConv.id;
        setLocalMessagesMap((prev) => {
          const syntheticMsgs = prev[syntheticId] || [];
          if (syntheticMsgs.length > 0) {
            const realMsgs = prev[realId] || [];
            return {
              ...prev,
              [realId]: [...realMsgs, ...syntheticMsgs],
            };
          }
          return prev;
        });
        setActiveConversationId(realId);
      }
    }
  }, [activeConversationId, conversations, setActiveConversationId]);

  useEffect(() => {
    if (activeConversationId && activeConversationId !== "ai_bot" && !activeConversationId.startsWith("direct_")) {
      chatApi.markRead(activeConversationId).catch(() => {});
      window.dispatchEvent(
        new CustomEvent("chat:socket:send", {
          detail: { type: "message:read", conversation: activeConversationId },
        })
      );
    }
  }, [activeConversationId]);

  // Enriched Call Logs Memoization
  const enrichedCallLogs = useMemo(() => {
    const serverHistory: CallLogItem[] = Array.isArray(callHistoryQuery.data)
      ? (callHistoryQuery.data as any[]).map((rec) => {
          const isCaller = isMe(rec.caller_id) || isMe(rec.caller?.id) || isMe(rec.caller?.employee_code);
          const isMissed =
            !isCaller &&
            (rec.status === "MISSED" ||
              rec.status === "DECLINED" ||
              !rec.accepted_at ||
              (rec.status === "ENDED" && (!rec.duration_seconds || rec.duration_seconds === 0)));

          const direction = isMissed
            ? "MISSED"
            : isCaller
            ? "OUTGOING"
            : "INCOMING";

          const otherPerson = isCaller ? rec.recipient : rec.caller;
          const otherName = otherPerson?.full_name || (isCaller ? "Recipient" : "Caller");
          const otherAvatar = otherPerson?.profile_picture_url || null;

          return {
            id: rec._id || rec.id,
            conversationId: rec.conversation_id || "",
            callerName: otherName,
            callerAvatar: otherAvatar,
            type: rec.call_type || "VOICE",
            direction: direction as any,
            isCaller,
            status: rec.status,
            durationSeconds: rec.duration_seconds || 0,
            timestamp: rec.created_at || new Date().toISOString(),
            callerId: rec.caller_id || rec.caller?.id,
            recipientId: rec.recipient_id || rec.recipient?.id,
          } as any;
        })
      : [];

    const map = new Map<string, CallLogItem>();
    callLogs.forEach((c) => map.set(c.id, c));
    serverHistory.forEach((c) => map.set(c.id, c));

    return Array.from(map.values())
      .map((log) => {
        let resolvedName = log.callerName;
        let resolvedAvatar = log.callerAvatar;

        if (
          !resolvedName ||
          resolvedName === "Colleague" ||
          resolvedName === "Staff Member" ||
          resolvedName === "Voice Call" ||
          resolvedName === "Direct Message" ||
          resolvedName === "Recipient" ||
          resolvedName === "Caller"
        ) {
          const matchingConv = conversations.find((c) => c.id === log.conversationId);
          if (matchingConv) {
            if (matchingConv.type === "DIRECT") {
              const other =
                matchingConv.participants?.find(
                  (p) => !isMe(p.employee?.id) && !isMe((p as any).employee_id)
                ) || matchingConv.participants?.[0];
              if (other?.employee?.full_name) {
                resolvedName = other.employee.full_name;
                resolvedAvatar = other.employee.profile_picture_url || resolvedAvatar;
              }
            } else if (matchingConv.name) {
              resolvedName = matchingConv.name;
              resolvedAvatar = matchingConv.avatar_url || resolvedAvatar;
            }
          }
        }

        return {
          ...log,
          callerName: resolvedName || "Colleague",
          callerAvatar: resolvedAvatar,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [callHistoryQuery.data, callLogs, conversations, isMe]);

  // Fetch messages
  const messagesQuery = useQuery({
    queryKey: ["chat", "messages", activeConversationId],
    queryFn: () => {
      if (!activeConversationId || activeConversationId === "ai_bot") return [];
      return chatApi.listMessages(activeConversationId).catch(() => []);
    },
    enabled: !!activeConversationId && activeConversationId !== "ai_bot",
    staleTime: 0,
    refetchInterval: 1500,
  });

  const rawServerMessages: ChatMessage[] = useMemo(() => {
    if (!messagesQuery.data) return [];
    if (Array.isArray(messagesQuery.data)) return messagesQuery.data;
    if (Array.isArray((messagesQuery.data as any).results)) return (messagesQuery.data as any).results;
    return [];
  }, [messagesQuery.data]);

  useEffect(() => {
    if (activeConversationId && rawServerMessages.length > 0) {
      setLocalMessagesMap((prev) => {
        const existing = prev[activeConversationId] || [];
        const existingMap = new Map(existing.map((m) => [m.id, m]));
        let changed = false;

        rawServerMessages.forEach((sm) => {
          if (sm && sm.id) {
            const cur = existingMap.get(sm.id);
            if (!cur) {
              existingMap.set(sm.id, sm);
              changed = true;
            } else if (
              cur.body !== sm.body ||
              cur.updated_at !== sm.updated_at ||
              JSON.stringify(cur.reaction_summary) !== JSON.stringify(sm.reaction_summary)
            ) {
              existingMap.set(sm.id, {
                ...cur,
                ...sm,
              });
              changed = true;
            }
          }
        });

        if (!changed) return prev;
        return {
          ...prev,
          [activeConversationId]: Array.from(existingMap.values()),
        };
      });
    }
  }, [activeConversationId, rawServerMessages]);

  useEffect(() => {
    const handleNewMessageEvent = (e: any) => {
      const msg: ChatMessage = e.detail;
      if (!msg || !msg.id || !msg.conversation) return;

      const msgSenderId = msg.sender?.id || (msg.sender as any)?.employee_id;
      const msgSenderCode = (msg.sender as any)?.employee_code;
      const isFromMe = isMe(msgSenderId);
      const targetConvId = msg.conversation;

      setLocalMessagesMap((prev) => {
        const keysToUpdate = new Set<string>([targetConvId]);

        if (activeConversationId) {
          if (activeConversationId === targetConvId) {
            keysToUpdate.add(activeConversationId);
          } else if (activeConversationId.startsWith("direct_")) {
            const activeEmpTarget = activeConversationId.replace("direct_", "").toLowerCase();
            const sId = String(msgSenderId || "").toLowerCase();
            const sCode = String(msgSenderCode || "").toLowerCase();

            const isMatchingDirectParticipant =
              sId === activeEmpTarget ||
              sCode === activeEmpTarget ||
              isFromMe ||
              conversations.some(
                (c) =>
                  c.id === targetConvId &&
                  c.participants?.some(
                    (p) =>
                      p.employee?.id?.toLowerCase() === activeEmpTarget ||
                      (p.employee as any)?.employee_code?.toLowerCase() === activeEmpTarget
                  )
              );

            if (isMatchingDirectParticipant) {
              keysToUpdate.add(activeConversationId);
            }
          }
        }

        if (msgSenderId && prev[`direct_${msgSenderId}`]) {
          keysToUpdate.add(`direct_${msgSenderId}`);
        }
        if (msgSenderCode && prev[`direct_${msgSenderCode}`]) {
          keysToUpdate.add(`direct_${msgSenderCode}`);
        }

        const nextMap = { ...prev };
        keysToUpdate.forEach((k) => {
          const list = nextMap[k] || [];
          const idx = list.findIndex((m) => m.id === msg.id);
          if (idx === -1) {
            nextMap[k] = [...list, msg];
          } else {
            nextMap[k] = list.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
          }
        });
        return nextMap;
      });

      const isActive = targetConvId === activeConversationId || (
        Boolean(activeConversationId?.startsWith("direct_")) &&
        (
          (msgSenderId && activeConversationId === `direct_${msgSenderId}`) ||
          (msgSenderCode && activeConversationId === `direct_${msgSenderCode}`) ||
          conversations.some((c) => c.id === targetConvId && (c as any).participants?.some((p: any) => activeConversationId.includes(p.employee?.id || "")))
        )
      );

      if (!isFromMe && !isActive) {
        callSounds.playMessageNotificationSound();
      }

      setLocalConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === targetConvId);
        let updatedConv: ConversationListItem;

        if (existingIdx !== -1) {
          const existing = prev[existingIdx];
          updatedConv = {
            ...existing,
            last_message: {
              content: msg.content,
              sender: msg.sender,
              created_at: msg.created_at,
            },
            last_message_at: msg.created_at,
            unread_count: (!isFromMe && !isActive) ? (existing.unread_count || 0) + 1 : (isActive ? 0 : existing.unread_count || 0),
          };
        } else {
          const foundInList = conversations.find((c) => c.id === targetConvId);
          updatedConv = {
            id: targetConvId,
            type: foundInList?.type || "DIRECT",
            title: foundInList?.title || msg.sender?.full_name || "Chat",
            participants: foundInList?.participants || [],
            last_message: {
              content: msg.content,
              sender: msg.sender,
              created_at: msg.created_at,
            },
            last_message_at: msg.created_at,
            unread_count: (!isFromMe && !isActive) ? 1 : 0,
          };
        }

        const filtered = prev.filter((c) => c.id !== targetConvId);
        return [updatedConv, ...filtered];
      });

      queryClient.setQueriesData<PaginatedResponse<ConversationListItem> | ConversationListItem[]>(
        { queryKey: ["chat", "conversations"] },
        (old) => {
          if (!old) return old;
          const updateItem = (c: ConversationListItem) => {
            if (c.id !== targetConvId) return c;
            return {
              ...c,
              last_message: {
                content: msg.content,
                sender: msg.sender,
                created_at: msg.created_at,
              },
              last_message_at: msg.created_at,
              unread_count: (!isFromMe && !isActive) ? (c.unread_count || 0) + 1 : (isActive ? 0 : c.unread_count || 0),
            };
          };

          if (Array.isArray(old)) {
            const item = old.find((c) => c.id === targetConvId);
            const rest = old.filter((c) => c.id !== targetConvId);
            return item ? [updateItem(item), ...rest] : old;
          }
          if ((old as any).results && Array.isArray((old as any).results)) {
            const list: ConversationListItem[] = (old as any).results;
            const item = list.find((c) => c.id === targetConvId);
            const rest = list.filter((c) => c.id !== targetConvId);
            return {
              ...old,
              results: item ? [updateItem(item), ...rest] : list,
            };
          }
          return old;
        }
      );

      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    };

    window.addEventListener("chat:message:created", handleNewMessageEvent);
    return () => window.removeEventListener("chat:message:created", handleNewMessageEvent);
  }, [activeConversationId, conversations, isMe, queryClient]);

  const messages: ChatMessage[] = useMemo(() => {
    if (!activeConversationId) return [];

    const syntheticMsgs = localMessagesMap[activeConversationId] || [];
    let realConvId = activeConversationId;
    if (activeConversationId.startsWith("direct_")) {
      const empIdOrCode = activeConversationId.replace("direct_", "");
      const matchingServerConv = conversations.find(
        (c) =>
          c.type === "DIRECT" &&
          !c.id.startsWith("direct_") &&
          c.participants?.some(
            (p) =>
              p.employee?.id === empIdOrCode ||
              ((p.employee as any)?.employee_code &&
                (p.employee as any).employee_code.toLowerCase() === empIdOrCode.toLowerCase())
          )
      );
      if (matchingServerConv) {
        realConvId = matchingServerConv.id;
      }
    }
    const realMsgs = realConvId !== activeConversationId ? (localMessagesMap[realConvId] || []) : [];
    const localMsgs = Array.from(new Set([...syntheticMsgs, ...realMsgs]));
    const clearedTime = clearedConvTimestamps[activeConversationId] || clearedConvTimestamps[realConvId];

    const map = new Map<string, ChatMessage>();
    rawServerMessages.forEach((m) => {
      if (m && m.id) map.set(m.id, { ...m });
    });

    localMsgs.forEach((lm) => {
      if (!lm || !lm.id) return;
      if (map.has(lm.id)) {
        const existing = map.get(lm.id)!;
        map.set(lm.id, {
          ...existing,
          ...lm,
          reaction_summary: lm.reaction_summary !== undefined ? lm.reaction_summary : existing.reaction_summary,
        });
      } else {
        const isTempLocalMsg = String(lm.id).startsWith("temp_") || String(lm.id).startsWith("local_");
        let isAlreadyOnServer = false;

        if (isTempLocalMsg) {
          isAlreadyOnServer = rawServerMessages.some((sm) => {
            if (!sm) return false;
            if (sm.id === lm.id) return true;

            const smSenderId = typeof sm.sender === "string" ? sm.sender : sm.sender?.id;
            const lmSenderId = typeof lm.sender === "string" ? lm.sender : lm.sender?.id;
            const sameSender =
              Boolean(
                smSenderId &&
                  lmSenderId &&
                  (String(smSenderId).toLowerCase() === String(lmSenderId).toLowerCase() ||
                    (isMe(smSenderId) && isMe(lmSenderId)))
              );

            if (!sameSender) return false;

            const smBody = (sm.body || "").trim();
            const lmBody = (lm.body || "").trim();

            // Special deduplication for voice notes
            if (smBody.startsWith("[VOICE]:") && lmBody.startsWith("[VOICE]:")) {
              const smTime = new Date(sm.created_at).getTime();
              const lmTime = new Date(lm.created_at).getTime();
              return Math.abs(smTime - lmTime) < 10000;
            }

            // Special deduplication for attachments / images
            if (smBody.startsWith("[ATTACHMENTS]:") && lmBody.startsWith("[ATTACHMENTS]:")) {
              const smTime = new Date(sm.created_at).getTime();
              const lmTime = new Date(lm.created_at).getTime();
              return Math.abs(smTime - lmTime) < 10000;
            }

            const lmClean = lmBody.replace(/^>\s*/, "");
            const smClean = smBody.replace(/^>\s*/, "");
            const sameBody =
              smClean === lmClean ||
              (smClean.length > 5 && (smClean.includes(lmClean) || lmClean.includes(smClean)));

            return sameBody;
          });
        }

        if (!isAlreadyOnServer) {
          map.set(lm.id, lm);
        }
      }
    });

    // ── Inject Call History Items into the Chat Stream for Active Conversation ──
    if (activeConversation) {
      const otherParticipant = activeConversation.participants?.find(
        (p) => !isMe(p.employee?.id) && !isMe((p as any).employee_id)
      );
      const otherEmpId = otherParticipant?.employee?.id || (otherParticipant as any)?.employee_id;
      const otherEmpCode = (otherParticipant?.employee as any)?.employee_code;

      const existingCallIds = new Set<string>();
      map.forEach((m) => {
        if (m.body && m.body.includes("[CALL]:")) {
          try {
            const payloadStr = m.body.split("[CALL]:")[1];
            const payload = JSON.parse(payloadStr);
            if (payload.call_id) existingCallIds.add(String(payload.call_id));
          } catch (e) {}
        }
      });

      enrichedCallLogs.forEach((cl: any) => {
        const cCallId = String(cl.id);
        if (existingCallIds.has(cCallId)) return;

        const cConvId = cl.conversationId;
        const cCaller = String(cl.callerId || "");
        const cRecip = String(cl.recipientId || "");

        const matchesConv =
          cConvId === activeConversationId ||
          cConvId === realConvId ||
          (otherEmpId && (cConvId === `direct_${otherEmpId}` || cCaller === String(otherEmpId) || cRecip === String(otherEmpId))) ||
          (otherEmpCode && (cConvId === `direct_${otherEmpCode.toLowerCase()}` || cCaller.toLowerCase() === String(otherEmpCode).toLowerCase() || cRecip.toLowerCase() === String(otherEmpCode).toLowerCase()));

        if (matchesConv) {
          existingCallIds.add(cCallId);

          const isOutgoing = cl.direction === "OUTGOING";
          const evtStatus = cl.direction === "MISSED" ? "MISSED" : (cl.durationSeconds && cl.durationSeconds > 0) ? "COMPLETED" : "ENDED";

          const callPayload = {
            call_id: cCallId,
            call_type: cl.type || "VOICE",
            status: evtStatus,
            duration_seconds: cl.durationSeconds || 0,
            caller_id: isOutgoing ? myId : (otherEmpId || "other"),
            recipient_id: isOutgoing ? (otherEmpId || "other") : myId,
            created_at: cl.timestamp,
          };

          const synMsg: ChatMessage = {
            id: `call_evt_injected_${cCallId}`,
            conversation: activeConversationId,
            sender: isOutgoing
              ? user
              : (otherParticipant?.employee || {
                  id: otherEmpId || "other",
                  full_name: cl.callerName || "Colleague",
                  profile_picture_url: cl.callerAvatar || null,
                  email: "",
                }),
            body: `[CALL]:${JSON.stringify(callPayload)}`,
            reply_to: null,
            is_edited: false,
            edited_at: null,
            is_important: false,
            is_deleted: false,
            mentioned_employee_ids: [],
            attachments: [],
            is_starred_by_me: false,
            reaction_summary: {},
            created_at: cl.timestamp,
            updated_at: cl.timestamp,
          };

          map.set(synMsg.id, synMsg);
        }
      });
    }

    const clearedMs = clearedTime ? new Date(clearedTime).getTime() : 0;

    let combined = Array.from(map.values())
      .filter((m) => {
        if (!m || !m.id) return false;
        if (m.is_deleted) return false;
        if (deletedForMeIds.includes(m.id)) return false;
        if (clearedMs > 0) {
          const msgMs = new Date(m.created_at).getTime();
          if (!isNaN(msgMs) && msgMs <= clearedMs + 2000) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Final deduplication layer for consecutive voice notes and identical payload bodies
    const deduped: ChatMessage[] = [];
    for (let i = 0; i < combined.length; i++) {
      const curr = combined[i];
      const prev = deduped[deduped.length - 1];
      if (prev) {
        const prevSender = typeof prev.sender === "string" ? prev.sender : prev.sender?.id;
        const currSender = typeof curr.sender === "string" ? curr.sender : curr.sender?.id;
        const isSameSender = !prevSender || !currSender || String(prevSender) === String(currSender);
        const timeDiff = Math.abs(new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime());

        if (isSameSender && timeDiff < 6000) {
          // If both are voice notes, skip the duplicate
          if (curr.body?.startsWith("[VOICE]:") && prev.body?.startsWith("[VOICE]:")) {
            continue;
          }
          // If both have identical body, skip the duplicate
          if (curr.body && prev.body && curr.body.trim() === prev.body.trim()) {
            continue;
          }
        }
      }
      deduped.push(curr);
    }
    combined = deduped;

    if (searchInChatQuery.trim()) {
      combined = combined.filter((m) =>
        m.body?.toLowerCase().includes(searchInChatQuery.toLowerCase())
      );
    }
    if (activeConversationId === "ai_bot" && combined.length === 0) {
      combined = [INITIAL_AI_MESSAGE];
    }
    return combined;
  }, [
    rawServerMessages,
    localMessagesMap,
    clearedConvTimestamps,
    deletedForMeIds,
    activeConversationId,
    searchInChatQuery,
    conversations,
  ]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottomInstant = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, []);

  useLayoutEffect(() => {
    if (!activeConversationId || messages.length === 0) return;
    scrollToBottomInstant();
    const raf = requestAnimationFrame(scrollToBottomInstant);
    return () => cancelAnimationFrame(raf);
  }, [activeConversationId, messages.length, scrollToBottomInstant]);

  // Mark read
  useEffect(() => {
    const triggerMarkRead = () => {
      if (
        activeConversationId &&
        activeConversationId !== "ai_bot" &&
        !activeConversationId.startsWith("direct_") &&
        !activeConversationId.startsWith("group_") &&
        !activeConversationId.startsWith("project_")
      ) {
        chatApi.markRead(activeConversationId).catch(() => {});
        window.dispatchEvent(
          new CustomEvent("chat:socket:send", {
            detail: { type: "message:read", conversation: activeConversationId },
          })
        );
      }
    };

    triggerMarkRead();

    window.addEventListener("focus", triggerMarkRead);
    return () => window.removeEventListener("focus", triggerMarkRead);
  }, [activeConversationId]);

  useEffect(() => {
    if (activeConversationId) {
      queryClient.setQueriesData<PaginatedResponse<ConversationListItem> | ConversationListItem[]>(
        { queryKey: ["chat", "conversations"] },
        (old) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((c) => (c.id === activeConversationId ? { ...c, unread_count: 0 } : c));
          }
          if ((old as any).results && Array.isArray((old as any).results)) {
            return {
              ...old,
              results: (old as any).results.map((c: ConversationListItem) =>
                c.id === activeConversationId ? { ...c, unread_count: 0 } : c
              ),
            };
          }
          return old;
        }
      );
      setLocalConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, unread_count: 0 } : c))
      );
    }
  }, [activeConversationId, queryClient]);

  // Listen to real-time read updates from socket to update local conversation participants
  useEffect(() => {
    const handleReadUpdate = (e: any) => {
      const { conversation_id, employee_id, read_at } = e.detail || {};
      if (!conversation_id || !employee_id) return;
      const readTimestamp = read_at || new Date().toISOString();
      setLocalConversations((prev) =>
        prev.map((c) => {
          if (String(c.id) !== String(conversation_id)) return c;
          const nextParticipants = (c.participants || []).map((p) =>
            String(p.employee?.id || (p as any).id).toLowerCase() === String(employee_id).toLowerCase()
              ? { ...p, last_read_at: readTimestamp }
              : p
          );
          return { ...c, participants: nextParticipants };
        })
      );
    };

    window.addEventListener("chat:read:update", handleReadUpdate);
    return () => window.removeEventListener("chat:read:update", handleReadUpdate);
  }, []);

  const handleSelectOrCreateConversation = (conv: ConversationListItem) => {
    setHiddenFeedConvIds((prev) => {
      const next = prev.filter((id) => id !== conv.id);
      if (myId) localStorage.setItem(getUserStorageKey("hidden_from_feed"), JSON.stringify(next));
      return next;
    });
    setLocalConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== conv.id);
      return [{ ...conv, unread_count: 0 }, ...filtered];
    });
    setActiveConversationId(conv.id);
  };

  const handleRemoveFromFeed = (convIdToRemove: string) => {
    if (!convIdToRemove) return;
    setHiddenFeedConvIds((prev) => {
      const next = Array.from(new Set([...prev, convIdToRemove]));
      if (myId) localStorage.setItem(getUserStorageKey("hidden_from_feed"), JSON.stringify(next));
      return next;
    });
    setLocalConversations((prev) => prev.filter((c) => c.id !== convIdToRemove));
    if (activeConversationId === convIdToRemove) {
      const remaining = conversations.filter((c) => c.id !== convIdToRemove);
      setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
    }
    toast.success("Discussion hidden from feed");
  };

  // Central message sender
  const handleAddMessageToState = (
    bodyText: string,
    attachments: any[] = [],
    replyToId: string | null = null
  ) => {
    if (!activeConversationId) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversation: activeConversationId,
      sender: user
        ? {
            id: user.employee_id || user.id,
            user_id: user.id,
            employee_code: user.employee_code || "",
            full_name: user.full_name || user.username || "Staff Member",
            email: user.email || "",
            profile_picture_url: user.profile_picture_url || null,
          }
        : {
            id: "me",
            full_name: "Staff Member",
            email: "",
            profile_picture_url: null,
          },
      body: bodyText,
      reply_to: replyToId,
      is_edited: false,
      edited_at: null,
      is_important: false,
      is_deleted: false,
      mentioned_employee_ids: [],
      attachments: attachments,
      is_starred_by_me: false,
      reaction_summary: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLocalMessagesMap((prev) => {
      const currentList = prev[activeConversationId] || [];
      // Deduplicate voice notes if a voice note was just added in the last 4 seconds
      if (bodyText.startsWith("[VOICE]:")) {
        const lastMsg = currentList[currentList.length - 1];
        if (lastMsg && lastMsg.body?.startsWith("[VOICE]:")) {
          const lastTime = new Date(lastMsg.created_at).getTime();
          const nowTime = new Date(newMsg.created_at).getTime();
          if (Math.abs(nowTime - lastTime) < 4000) {
            return prev;
          }
        }
      }
      return {
        ...prev,
        [activeConversationId]: [...currentList, newMsg],
      };
    });

    let previewText = bodyText;
    if (previewText.startsWith("[VOICE]:")) previewText = "🎙️ Voice Message";
    else if (previewText.startsWith("[POLL]:")) previewText = "📊 Team Poll";
    else if (previewText.startsWith("[LOCATION]:")) previewText = "📍 Location Shared";
    else if (previewText.startsWith("[ATTACHMENTS]:")) {
      const hasImg = attachments.some(
        (a) => a.content_type?.startsWith("image/") || a.original_filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );
      previewText = hasImg ? "📷 Photo" : "📎 Document";
    }

    setLocalConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              unread_count: 0,
              last_message_at: new Date().toISOString(),
              last_message_preview: {
                body: previewText,
                sender_id: myId || null,
                created_at: new Date().toISOString(),
              },
            }
          : c
      )
    );

    // AI Bot / @AI Mention Handler
    const isAIMention =
      activeConversationId === "ai_bot" ||
      bodyText.toLowerCase().includes("@ai") ||
      bodyText.toLowerCase().includes("@gemini");

    if (isAIMention) {
      const targetConvId = activeConversationId;
      let cleanPrompt = bodyText;
      if (cleanPrompt.startsWith("[ATTACHMENTS]:")) {
        const newlineIdx = cleanPrompt.indexOf("\n");
        cleanPrompt = newlineIdx !== -1 ? cleanPrompt.substring(newlineIdx + 1) : "";
      } else if (cleanPrompt.startsWith("[VOICE]:")) {
        cleanPrompt = "Please listen to the attached voice message, understand the spoken request, and reply directly.";
      }
      cleanPrompt = cleanPrompt.replace(/@ai/gi, "").replace(/@gemini/gi, "").trim();

      const prevMsgs = localMessagesMap[targetConvId] || (targetConvId === "ai_bot" ? [INITIAL_AI_MESSAGE] : []);
      const historyPayload = prevMsgs.slice(-6).map((m) => {
        let textBody = m.body || "";
        if (textBody.startsWith("[ATTACHMENTS]:")) {
          const newlineIdx = textBody.indexOf("\n");
          textBody = newlineIdx !== -1 ? textBody.substring(newlineIdx + 1) : "(Attached file/image)";
        } else if (textBody.startsWith("[VOICE]:")) {
          textBody = "Spoke a voice message";
        }
        return {
          is_user: m.sender?.id !== "ai_bot",
          text: textBody,
        };
      });

      setIsAITyping(true);

      chatApi
        .askAI({
          prompt: cleanPrompt || (attachments.length > 0 ? "Please analyze the attached content in detail." : "Hello!"),
          conversation_id: targetConvId,
          history: historyPayload,
          attachments: attachments,
        })
        .then((res) => {
          setIsAITyping(false);
          if (res && res.reply) {
            const aiMsg: ChatMessage = {
              id: `ai_${Date.now()}`,
              conversation: targetConvId,
              sender: {
                id: "ai_bot",
                full_name: "Nexus AI Assistant",
                email: "ai@nexus.internal",
                profile_picture_url: null,
              },
              body: res.reply,
              reply_to: null,
              is_edited: false,
              edited_at: null,
              is_important: false,
              is_deleted: false,
              mentioned_employee_ids: [],
              attachments: [],
              is_starred_by_me: false,
              reaction_summary: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            setLocalMessagesMap((prev) => {
              const cur = prev[targetConvId] || (targetConvId === "ai_bot" ? [INITIAL_AI_MESSAGE] : []);
              return {
                ...prev,
                [targetConvId]: [...cur, aiMsg],
              };
            });

            setLocalConversations((prev) =>
              prev.map((c) =>
                c.id === targetConvId
                  ? {
                      ...c,
                      last_message_at: new Date().toISOString(),
                      last_message_preview: {
                        body: res.reply.length > 50 ? `${res.reply.substring(0, 50)}...` : res.reply,
                        sender_id: "ai_bot",
                        created_at: new Date().toISOString(),
                      },
                    }
                  : c
              )
            );
          }
        })
        .catch((err) => {
          setIsAITyping(false);
          console.error("Google Gemini AI error", err);
        });

      if (targetConvId === "ai_bot") {
        return; // Direct AI chat does not need to send to backend chat message queue
      }
    }

    chatApi
      .sendMessage({
        conversation: activeConversationId,
        body: bodyText,
        reply_to: replyToId,
      })
      .then((createdMsg) => {
        if (createdMsg?.id) {
          const targetId = (createdMsg.conversation && createdMsg.conversation !== activeConversationId)
            ? createdMsg.conversation
            : activeConversationId;

          setLocalMessagesMap((prev) => {
            const list = prev[activeConversationId] || [];
            const filtered = list.filter((m) => m.id !== newMsg.id && m.id !== createdMsg.id);
            return {
              ...prev,
              [targetId]: [...filtered, createdMsg],
            };
          });

          if (createdMsg.conversation && createdMsg.conversation !== activeConversationId) {
            setActiveConversationId(createdMsg.conversation);
          }
        }
        queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
        queryClient.invalidateQueries({ queryKey: ["chat", "messages", activeConversationId] });
      })
      .catch((err) => console.warn("Send message sync error", err));
  };

  const handleSendMessage = (text: string, attachmentsList?: (File | any)[]) => {
    if (isAITyping && activeConversationId === "ai_bot") {
      toast.warning("Nexus AI is currently replying. Please wait a moment.");
      return;
    }
    const replyId = replyingMessage?.id || null;

    if (attachmentsList && attachmentsList.length > 0) {
      const promises = attachmentsList.map((item) => {
        const file = (item as any).file ? (item as any).file : (item as File);
        const itemKind = (item as any).kind || (file.type.startsWith("image/") ? "IMAGE" : "DOCUMENT");

        return new Promise<MessageAttachment>((resolve) => {
          const isImg = itemKind === "IMAGE";
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            resolve({
              id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              original_filename: file.name,
              content_type: file.type || (isImg ? "image/png" : "application/octet-stream"),
              size_bytes: file.size,
              scan_status: "CLEAN",
              scanned_at: new Date().toISOString(),
              download_url: dataUrl || URL.createObjectURL(file),
              kind: itemKind,
            } as any);
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(promises).then((attachments) => {
        const payload = `[ATTACHMENTS]:${JSON.stringify(attachments)}${text.trim() ? "\n" + text.trim() : ""}`;
        handleAddMessageToState(payload, attachments, replyId);
      });
    } else if (text.trim()) {
      handleAddMessageToState(text.trim(), [], replyId);
    }
    setReplyingMessage(null);
  };

  const handleSendVoiceMessage = (audioBlob: Blob, duration: number) => {
    if (isAITyping && activeConversationId === "ai_bot") {
      toast.warning("Nexus AI is currently replying. Please wait a moment.");
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const payload = `[VOICE]:${JSON.stringify({ audioUrl: base64data, duration })}`;
      const voiceAttachment = {
        id: `att_voice_${Date.now()}`,
        original_filename: "voice_message.webm",
        content_type: audioBlob.type || "audio/webm",
        size_bytes: audioBlob.size,
        scan_status: "CLEAN",
        scanned_at: new Date().toISOString(),
        download_url: base64data,
        kind: "AUDIO",
      };
      handleAddMessageToState(payload, [voiceAttachment]);
    };
  };

  const handleSendPoll = (question: string, options: string[], allowMultiple: boolean = false) => {
    if (isAITyping && activeConversationId === "ai_bot") {
      toast.warning("Nexus AI is currently replying. Please wait a moment.");
      return;
    }
    const pollObj = {
      id: `poll_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      question,
      options: options.map((opt, i) => ({ id: `opt_${i}`, text: opt, votes: [] })),
      allowMultiple: Boolean(allowMultiple),
    };
    handleAddMessageToState(`[POLL]:${JSON.stringify(pollObj)}`);
  };

  const handleSendLocation = (loc: any) => {
    if (isAITyping && activeConversationId === "ai_bot") {
      toast.warning("Nexus AI is currently replying. Please wait a moment.");
      return;
    }
    const isLive = Boolean(loc.isLive || loc.type === "LIVE");
    const locObj = {
      type: loc.type || (isLive ? "LIVE" : "CURRENT"),
      title: loc.title || (isLive ? "Live Location" : "Current Location"),
      address: loc.address || `${loc.lat ? loc.lat.toFixed(4) : "12.9716"}° N, ${loc.lng ? loc.lng.toFixed(4) : "77.5946"}° E`,
      lat: typeof loc.lat === "number" ? loc.lat : loc.latitude || 12.9716,
      lng: typeof loc.lng === "number" ? loc.lng : loc.longitude || 77.5946,
      isLive,
      durationMinutes: loc.durationMinutes || 60,
      startedAt: loc.startedAt || new Date().toISOString(),
    };
    handleAddMessageToState(`[LOCATION]:${JSON.stringify(locObj)}`);
  };

  const handleVotePoll = (messageId: string, pollId: string, optionId: string, optionIndex: number) => {
    if (!myId || !activeConversationId) return;

    let updatedBody = "";

    const updatePollInList = (msgList: ChatMessage[]): ChatMessage[] => {
      return msgList.map((m) => {
        if (m.id !== messageId) return m;
        try {
          const bodyStr = m.body || "";
          if (!bodyStr.startsWith("[POLL]:")) return m;
          const pollData = JSON.parse(bodyStr.replace("[POLL]:", ""));
          const allowMultiple = Boolean(pollData.allowMultiple);

          const newOptions = (pollData.options || []).map((opt: any, idx: number) => {
            const optKey = opt.id || `opt_${idx}`;
            const isTarget = optKey === optionId || idx === optionIndex;
            let voters: string[] = Array.isArray(opt.voters)
              ? opt.voters
              : Array.isArray(opt.votes)
              ? opt.votes
              : [];

            const userHasVoted = voters.some((u) => String(u).toLowerCase() === String(myId).toLowerCase());

            if (!allowMultiple) {
              voters = voters.filter((u) => String(u).toLowerCase() !== String(myId).toLowerCase());
            }

            if (isTarget) {
              if (userHasVoted) {
                voters = voters.filter((u) => String(u).toLowerCase() !== String(myId).toLowerCase());
              } else {
                voters = [...voters, myId];
              }
            }

            return {
              ...opt,
              voters,
              votes: voters,
            };
          });

          const newPollData = {
            ...pollData,
            options: newOptions,
          };
          updatedBody = `[POLL]:${JSON.stringify(newPollData)}`;
          return {
            ...m,
            body: updatedBody,
          };
        } catch (e) {
          console.warn("Poll vote parse error", e);
          return m;
        }
      });
    };

    // 1. Optimistic update query cache
    queryClient.setQueriesData({ queryKey: ["chat", "messages", activeConversationId] }, (old: any) => {
      if (!old) return old;
      const list = Array.isArray(old) ? old : Array.isArray(old.results) ? old.results : [];
      const updated = updatePollInList(list);
      return Array.isArray(old) ? updated : { ...old, results: updated };
    });

    // 2. Optimistic update local messages map
    setLocalMessagesMap((prev) => {
      const list = prev[activeConversationId] || rawServerMessages;
      return { ...prev, [activeConversationId]: updatePollInList(list) };
    });

    // 3. Sync with backend API
    chatApi
      .votePoll(messageId, optionIndex)
      .then((updatedMsg: any) => {
        if (updatedMsg && updatedMsg.id) {
          queryClient.setQueriesData({ queryKey: ["chat", "messages", activeConversationId] }, (old: any) => {
            if (!old) return old;
            const list = Array.isArray(old) ? old : Array.isArray(old.results) ? old.results : [];
            const updated = list.map((m: ChatMessage) => (m.id === messageId ? { ...m, ...updatedMsg } : m));
            return Array.isArray(old) ? updated : { ...old, results: updated };
          });
          setLocalMessagesMap((prev) => {
            const list = prev[activeConversationId] || rawServerMessages;
            return {
              ...prev,
              [activeConversationId]: list.map((m) => (m.id === messageId ? { ...m, ...updatedMsg } : m)),
            };
          });
        }
      })
      .catch(() => {
        if (updatedBody) {
          chatApi.editMessage(messageId, updatedBody).catch(() => {});
        }
      });
  };

  const handleReact = (msgId: string, emoji: string) => {
    if (!myId || !activeConversationId) return;

    const computeNextReactions = (rec: Record<string, string[]>) => {
      const nextRec: Record<string, string[]> = {};
      const hadThisEmoji = rec[emoji]?.includes(myId);

      // Remove myId from all emojis
      Object.entries(rec).forEach(([em, users]) => {
        const filtered = users.filter((u) => u !== myId);
        if (filtered.length > 0) {
          nextRec[em] = filtered;
        }
      });

      // If user did not already have this emoji, set it as the single active reaction
      if (!hadThisEmoji) {
        nextRec[emoji] = [...(nextRec[emoji] || []), myId];
      }

      return nextRec;
    };

    // 1. Optimistically update TanStack query cache for instant reactivity
    queryClient.setQueriesData({ queryKey: ["chat", "messages", activeConversationId] }, (old: any) => {
      if (!old) return old;
      const list = Array.isArray(old) ? old : Array.isArray(old.results) ? old.results : [];
      const updated = list.map((m: ChatMessage) => {
        if (m.id === msgId) {
          return { ...m, reaction_summary: computeNextReactions(m.reaction_summary || {}) };
        }
        return m;
      });
      return Array.isArray(old) ? updated : { ...old, results: updated };
    });

    // 2. Optimistically update local message store
    setLocalMessagesMap((prev) => {
      const list = prev[activeConversationId] || rawServerMessages;
      const updated = list.map((m) => {
        if (m.id === msgId) {
          return { ...m, reaction_summary: computeNextReactions(m.reaction_summary || {}) };
        }
        return m;
      });
      return { ...prev, [activeConversationId]: updated };
    });

    // 3. Sync with backend API
    chatApi
      .toggleReaction(msgId, emoji)
      .then((updatedMsg: any) => {
        if (updatedMsg && updatedMsg.id) {
          queryClient.setQueriesData({ queryKey: ["chat", "messages", activeConversationId] }, (old: any) => {
            if (!old) return old;
            const list = Array.isArray(old) ? old : Array.isArray(old.results) ? old.results : [];
            const updated = list.map((m: ChatMessage) => (m.id === msgId ? { ...m, ...updatedMsg } : m));
            return Array.isArray(old) ? updated : { ...old, results: updated };
          });
          setLocalMessagesMap((prev) => {
            const list = prev[activeConversationId] || rawServerMessages;
            return {
              ...prev,
              [activeConversationId]: list.map((m) => (m.id === msgId ? { ...m, ...updatedMsg } : m)),
            };
          });
        }
      })
      .catch(() => {});
  };

  const handleToggleImportant = (msgId: string) => {
    if (!activeConversationId) return;
    const currentPinned = pinnedMessagesByConv[activeConversationId];
    let nextMap = { ...pinnedMessagesByConv };

    if (currentPinned && currentPinned.id === msgId) {
      delete nextMap[activeConversationId];
      toast.info("Message unpinned");
    } else {
      const target = messages.find((m) => m.id === msgId);
      if (target) {
        nextMap[activeConversationId] = target;
        toast.success("Message pinned to discussion");
      }
    }
    setPinnedMessagesByConv(nextMap);
    if (myId) localStorage.setItem(getUserStorageKey("pinned_messages"), JSON.stringify(nextMap));
  };

  const handleDeleteForMe = (msgId: string) => {
    setDeletedForMeIds((prev) => {
      const next = Array.from(new Set([...prev, msgId]));
      if (myId) localStorage.setItem(getUserStorageKey("deleted_for_me"), JSON.stringify(next));
      return next;
    });
    toast.success("Message deleted for you");
  };

  const handleDeleteForEveryone = (msgId: string) => {
    chatApi
      .deleteMessage(msgId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["chat", "messages", activeConversationId] });
        toast.success("Message deleted for everyone");
      })
      .catch(() => toast.error("Could not delete message for everyone"));
  };

  const handleTogglePinChat = (convId: string) => {
    let next: string[];
    if (pinnedConversationIds.includes(convId)) {
      next = pinnedConversationIds.filter((id) => id !== convId);
      toast.info("Discussion unpinned");
    } else {
      next = [...pinnedConversationIds, convId];
      toast.success("Discussion pinned to top");
    }
    setPinnedConversationIds(next);
    if (myId) localStorage.setItem(getUserStorageKey("pinned_chats"), JSON.stringify(next));
  };

  const handleClearChat = (convId?: string) => {
    const targetId = convId || activeConversationId;
    if (!targetId) return;

    setClearedConvTimestamps((prev) => {
      const next = { ...prev, [targetId]: new Date().toISOString() };
      if (myId) localStorage.setItem(getUserStorageKey("cleared_timestamps"), JSON.stringify(next));
      return next;
    });

    setLocalMessagesMap((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });

    chatApi.clearConversation(targetId).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["chat", "messages", targetId] });
    toast.success("Discussion messages cleared");
  };

  const handleExportChat = () => {
    if (!activeConversation || messages.length === 0) {
      toast.info("No messages to export");
      return;
    }
    const lines = messages.map(
      (m) =>
        `[${dayjs(m.created_at).format("YYYY-MM-DD HH:mm:ss")}] ${m.sender?.full_name || "User"}: ${
          m.body || "[Attachment]"
        }`
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bms_workspace_chat_${activeConversation.name || "discussion"}_${dayjs().format(
      "YYYYMMDD_HHmmss"
    )}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Conversation history exported");
  };

  // Auto-terminate call overlay if active call status becomes ENDED or DECLINED
  useEffect(() => {
    if (!activeCall || !callModalOpen) return;
    const activeId = activeCall._id || (activeCall as any).id;
    if (currentCallId && activeId && activeId !== currentCallId) return;

    if (activeCall.status === "ENDED" || activeCall.status === "DECLINED") {
      callSounds.stopRingtone();
      callSounds.playCutSound();
      setCallModalOpen(false);
      setCurrentCallId(null);
      toast.info(activeCall.status === "DECLINED" ? "Call was declined" : "Call ended");
    }
  }, [activeCall, callModalOpen, currentCallId]);

  // Calling Handlers
  const handleInitiateCall = (conversationId: string, type: "VOICE" | "VIDEO") => {
    queryClient.setQueryData(["chat", "activeCall"], null);
    const initialCallId = `call_${Date.now()}`;
    setCurrentCallId(initialCallId);
    setCallType(type);
    setCallModalOpen(true);

    const targetConv = conversations.find((c) => c.id === conversationId);
    let otherParticipant =
      targetConv?.type === "DIRECT"
        ? getOtherParticipant(targetConv.participants, user)
        : null;

    if (!otherParticipant && targetConv?.participants && targetConv.participants.length > 0) {
      otherParticipant = getOtherParticipant(targetConv.participants, user);
    }

    const recipientId =
      otherParticipant?.employee?.id ||
      (otherParticipant as any)?.employee_id ||
      (conversationId.startsWith("direct_") ? conversationId.replace("direct_", "") : null) ||
      (targetConv?.type === "DIRECT" ? targetConv.id : null);

    if (recipientId) {
      console.log(
        "[Call Signal 1/5] Caller initiating call request via API/Socket to recipient:",
        recipientId,
        "callType:",
        type,
        "conversationId:",
        conversationId
      );

      window.dispatchEvent(
        new CustomEvent("chat:socket:send", {
          detail: {
            type: "webrtc:signal",
            target_user_id: recipientId,
            call_id: initialCallId,
            signal: { type: "call_ring", call_type: type, caller_id: myId },
          },
        })
      );

      chatApi
        .initiateCall({
          recipient_id: recipientId,
          conversation_id: conversationId,
          call_type: type,
        })
        .then((callRes) => {
          const callId = (callRes as any)?._id || (callRes as any)?.id || initialCallId;
          setCurrentCallId(callId);
          queryClient.setQueryData(["chat", "activeCall"], callRes);
          queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
          queryClient.refetchQueries({ queryKey: ["chat", "messages"] });
        })
        .catch((err) => {
          console.warn("Call initiate server error, activating local active call:", err);
          queryClient.setQueryData(["chat", "activeCall"], {
            _id: initialCallId,
            caller_id: myId,
            recipient_id: recipientId,
            call_type: type,
            conversation_id: conversationId,
            status: "RINGING",
            created_at: new Date().toISOString(),
          });
        });
    } else {
      queryClient.setQueryData(["chat", "activeCall"], {
        _id: initialCallId,
        caller_id: myId,
        recipient_id: "group",
        call_type: type,
        conversation_id: conversationId,
        status: "RINGING",
        created_at: new Date().toISOString(),
      });
    }
  };

  const handleAcceptCall = () => {
    if (!activeCall) return;
    const callId = activeCall._id || (activeCall as any).id;
    const callerId = activeCall.caller_id || (activeCall.caller as any)?.id || (activeCall.caller as any)?.employee_id;
    const nowIso = new Date().toISOString();

    callSounds.stopRingtone();
    setCallType(activeCall.call_type || "VOICE");
    setCallModalOpen(true);
    setCurrentCallId(callId);

    if (callerId) {
      window.dispatchEvent(
        new CustomEvent("chat:socket:send", {
          detail: {
            type: "webrtc:signal",
            target_user_id: callerId,
            call_id: callId,
            signal: { type: "call_accepted", accepted_at: nowIso },
          },
        })
      );
    }

    chatApi.respondToCall({ call_id: callId, action: "ACCEPT" }).catch(() => {});
    queryClient.setQueryData(["chat", "activeCall"], {
      ...activeCall,
      status: "ACCEPTED",
      accepted_at: activeCall.accepted_at || nowIso,
    });
  };

  const handleOpenCallHistory = useCallback(() => {
    setCallHistoryOpen(true);
    const nowIso = new Date().toISOString();
    setLastViewedCallHistory(nowIso);
    if (myId) {
      try {
        localStorage.setItem(getUserStorageKey("call_history_last_viewed"), nowIso);
      } catch (e) {}
    }
    queryClient.invalidateQueries({ queryKey: ["chat", "callHistory"] });
  }, [myId, queryClient, getUserStorageKey]);

  const missedCallsCount = useMemo(() => {
    return enrichedCallLogs.filter((c) => {
      if (c.direction !== "MISSED") return false;
      if (!lastViewedCallHistory) return true;
      return new Date(c.timestamp).getTime() > new Date(lastViewedCallHistory).getTime();
    }).length;
  }, [enrichedCallLogs, lastViewedCallHistory]);

  // Real-time listener for incoming call status changes (e.g. Remote User Cut / Declined / Ended)
  useEffect(() => {
    const handleCallUpdateEvent = (e: any) => {
      const detail = e.detail;
      if (!detail) return;

      const callData = detail.call || detail.payload || detail;
      const signalType = detail.signal?.type || detail.type;
      const status = callData?.status || callData?.call?.status || callData?.message?.status;

      const isTerminated =
        ["ENDED", "DECLINED", "MISSED", "CANCELLED"].includes(status) ||
        ["hangup", "bye", "end", "reject", "decline"].includes(signalType);

      if (signalType === "call_accepted" || status === "ACCEPTED") {
        const acceptedAt = detail.signal?.accepted_at || callData?.accepted_at || new Date().toISOString();
        queryClient.setQueryData(["chat", "activeCall"], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            status: "ACCEPTED",
            accepted_at: old.accepted_at || acceptedAt,
          };
        });
      }

      if (isTerminated) {
        callSounds.stopRingtone();
        callSounds.playCutSound();
        setCallModalOpen(false);
        setCurrentCallId(null);
        queryClient.setQueryData(["chat", "activeCall"], null);
        queryClient.invalidateQueries({ queryKey: ["chat", "callHistory"] });
        queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
        queryClient.refetchQueries({ queryKey: ["chat", "messages"] });

        if (status === "DECLINED" || signalType === "decline" || signalType === "reject") {
          toast.info("Call was declined");
        } else if (status === "ENDED" || signalType === "hangup" || signalType === "bye") {
          toast.info("Call ended");
        } else if (status === "MISSED") {
          toast.info("Call missed");
        }
      }
    };

    window.addEventListener("chat:call:update", handleCallUpdateEvent);
    window.addEventListener("chat:webrtc:signal", handleCallUpdateEvent);
    return () => {
      window.removeEventListener("chat:call:update", handleCallUpdateEvent);
      window.removeEventListener("chat:webrtc:signal", handleCallUpdateEvent);
    };
  }, [queryClient]);

  const handleDeclineCall = () => {
    if (!activeCall) return;
    const callId = activeCall._id || (activeCall as any).id;
    const callerId = activeCall.caller_id || (activeCall.caller as any)?.id;
    callSounds.stopRingtone();
    callSounds.playCutSound();

    if (callerId) {
      window.dispatchEvent(
        new CustomEvent("chat:socket:send", {
          detail: {
            type: "webrtc:signal",
            target_user_id: callerId,
            call_id: callId,
            signal: { type: "hangup" },
          },
        })
      );
    }

    const callerName = activeCall.caller?.full_name || "Colleague";
    const callerAvatar = activeCall.caller?.profile_picture_url || null;
    const convId = activeCall.conversation_id || activeConversationId || "";

    const missedLog: CallLogItem = {
      id: `call_${Date.now()}`,
      conversationId: convId,
      callerName: callerName,
      callerAvatar: callerAvatar,
      type: activeCall.call_type || "VOICE",
      direction: "MISSED",
      durationSeconds: 0,
      timestamp: new Date().toISOString(),
    };
    setCallLogs((prev) => [missedLog, ...prev]);

    chatApi.respondToCall({ call_id: callId, action: "DECLINE" }).catch(() => {});
    queryClient.setQueryData(["chat", "activeCall"], null);
    queryClient.invalidateQueries({ queryKey: ["chat", "callHistory"] });
    queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
    queryClient.refetchQueries({ queryKey: ["chat", "messages"] });
  };

  const handleEndCall = (durationSecs?: number) => {
    const callId = currentCallId || activeCall?._id || (activeCall as any)?.id;
    const targetPeerId =
      activeCall?.caller_id === myId ? activeCall?.recipient_id : activeCall?.caller_id;

    setCallModalOpen(false);
    callSounds.stopRingtone();
    callSounds.playCutSound();

    if (targetPeerId) {
      window.dispatchEvent(
        new CustomEvent("chat:socket:send", {
          detail: {
            type: "webrtc:signal",
            target_user_id: targetPeerId,
            call_id: callId,
            signal: { type: "hangup" },
          },
        })
      );
    }

    const targetConv = conversations.find(
      (c) => c.id === (activeConversation?.id || (activeCall as any)?.conversation_id)
    );
    let targetName = targetConv?.name;
    let targetAvatar = targetConv?.avatar_url;
    if (targetConv?.type === "DIRECT") {
      const other = getOtherParticipant(targetConv.participants, user);
      if (other?.employee?.full_name) {
        targetName = other.employee.full_name;
        targetAvatar = other.employee.profile_picture_url || targetAvatar;
      }
    } else if (!targetName && activeCall?.caller?.full_name) {
      targetName = activeCall.caller.full_name;
      targetAvatar = activeCall.caller.profile_picture_url;
    }

    const isIncoming = activeCall && isMe(activeCall.recipient_id);
    const wasAccepted = Boolean(activeCall?.accepted_at || (durationSecs && durationSecs > 0));
    const direction = isIncoming ? (wasAccepted ? "INCOMING" : "MISSED") : "OUTGOING";

    if (targetConv || targetName) {
      const newLog: CallLogItem = {
        id: `call_${Date.now()}`,
        conversationId: targetConv?.id || activeCall?.conversation_id || "",
        callerName: targetName || "Colleague",
        callerAvatar: targetAvatar,
        type: callType,
        direction: direction,
        durationSeconds: durationSecs || 0,
        timestamp: new Date().toISOString(),
      };
      setCallLogs((prev) => [newLog, ...prev]);
    }

    if (callId) {
      chatApi
        .endCall({ call_id: callId, duration_seconds: durationSecs || 0 })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
          queryClient.refetchQueries({ queryKey: ["chat", "messages"] });
        })
        .catch(() => {});
      setCurrentCallId(null);
    }
    queryClient.setQueryData(["chat", "activeCall"], null);
    queryClient.invalidateQueries({ queryKey: ["chat", "callHistory"] });
    queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
    queryClient.refetchQueries({ queryKey: ["chat", "messages"] });
  };

  const currentPinnedMessage = activeConversationId
    ? pinnedMessagesByConv[activeConversationId] || null
    : null;

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── PANEL 1: WORKSPACE CHANNELS & MATRIX ── */}
      <WorkspaceSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        currentUserId={myId}
        onlineEmployeeIds={onlineEmployeeIds}
        pinnedConversationIds={pinnedConversationIds}
        hiddenConversationIds={hiddenFeedConvIds}
        missedCallsCount={missedCallsCount}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onOpenNewChat={(defType) => {
          setNewChatDefaultType(defType || "DIRECT");
          setNewChatModalOpen(true);
        }}
        onOpenCallHistory={handleOpenCallHistory}
        onTogglePin={handleTogglePinChat}
        onClearFromFeed={handleRemoveFromFeed}
        onClearChat={handleClearChat}
      />

      {/* ── PANEL 2: ENTERPRISE CONVERSATION BOARD ── */}
      {activeConversation ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
            background: "var(--bms-surface, #ffffff)",
          }}
        >
          {/* Header */}
          <WorkspaceHeader
            conversation={activeConversation}
            currentUserId={myId}
            isOnline={
              activeConversation.type === "DIRECT"
                ? (() => {
                    const other = activeConversation.participants?.find(
                      (p) => !isMe(p?.employee?.id) && !isMe((p as any)?.employee_id)
                    );
                    if (!other?.employee) return false;
                    const emp = other.employee;
                    if ((emp as any).is_online) return true;
                    return Boolean(
                      (emp.id && onlineEmployeeIds.has(emp.id)) ||
                      ((emp as any).user_id && onlineEmployeeIds.has((emp as any).user_id)) ||
                      ((emp as any).employee_code && onlineEmployeeIds.has((emp as any).employee_code))
                    );
                  })()
                : false
            }
            isPinned={pinnedConversationIds.includes(activeConversation.id)}
            rightDeskOpen={rightDeskOpen}
            onToggleRightDesk={() => setRightDeskOpen(!rightDeskOpen)}
            onInitiateCall={(cId, type) => handleInitiateCall(cId, type)}
            onTogglePinChat={handleTogglePinChat}
            onOpenCallHistory={handleOpenCallHistory}
            onToggleSearch={() => setShowSearchInChat(!showSearchInChat)}
            onExportChat={handleExportChat}
            onClearChat={() => handleClearChat(activeConversation.id)}
            onClearFromFeed={() => handleRemoveFromFeed(activeConversation.id)}
          />

          {/* Live Call Bar Banner */}
          {activeCall && (activeCall.status === "RINGING" || activeCall.status === "ACCEPTED") && isDirectActiveCall && (
            <div
              style={{
                padding: "8px 16px",
                background: "linear-gradient(90deg, #134e5e 0%, #1b6270 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                zIndex: 10,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 13 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "#10b981",
                    boxShadow: "0 0 8px #10b981",
                  }}
                />
                <span>
                  {activeCall.status === "ACCEPTED" ? "Live Call Connected" : "Calling..."} ({activeCall.call_type || "VOICE"})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!callModalOpen && (
                  <button
                    onClick={() => setCallModalOpen(true)}
                    style={{
                      background: "#ffffff",
                      color: "#134e5e",
                      border: "none",
                      borderRadius: 14,
                      padding: "4px 12px",
                      fontWeight: 800,
                      fontSize: 11.5,
                      cursor: "pointer",
                    }}
                  >
                    Open Call Overlay
                  </button>
                )}
                <button
                  onClick={() => handleEndCall()}
                  style={{
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 14,
                    padding: "4px 12px",
                    fontWeight: 800,
                    fontSize: 11.5,
                    cursor: "pointer",
                  }}
                >
                  End Call
                </button>
              </div>
            </div>
          )}

          {/* Search inside thread */}
          {showSearchInChat && (
            <div
              style={{
                padding: "8px 20px",
                background: "var(--bms-bg, #f8fafc)",
                borderBottom: "1px solid var(--bms-border, rgba(0,0,0,0.06))",
              }}
            >
              <input
                type="text"
                placeholder="Find in discussion..."
                value={searchInChatQuery}
                onChange={(e) => setSearchInChatQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--bms-border, rgba(0,0,0,0.12))",
                  fontSize: 13,
                  outline: "none",
                }}
                autoFocus
              />
            </div>
          )}

          {/* Pinned announcement banner */}
          <PinnedMessageBanner
            message={currentPinnedMessage}
            onUnpin={() => {
              if (activeConversationId) {
                const next = { ...pinnedMessagesByConv };
                delete next[activeConversationId];
                setPinnedMessagesByConv(next);
                if (myId) localStorage.setItem(getUserStorageKey("pinned_messages"), JSON.stringify(next));
              }
            }}
            onJumpToMessage={(msgId) => {
              const el = document.getElementById(`msg-${msgId}`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />

          {/* Message Stream */}
          <div
            ref={scrollContainerRef}
            style={{
              flex: 1,
              overflowY: messages.length === 0 ? "hidden" : "auto",
              padding: messages.length === 0 ? 0 : "16px 0",
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  boxSizing: "border-box",
                  userSelect: "none",
                }}
              >
                <div style={{ position: "relative", width: 140, height: 140, marginBottom: 14 }}>
                  <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Outer octagon network lines */}
                    <polygon
                      points="70,14 112,30 128,70 112,110 70,126 28,110 12,70 28,30"
                      stroke="#94a3b8"
                      strokeWidth="1.2"
                      strokeOpacity="0.55"
                      fill="none"
                    />
                    {/* Inner connecting web lines */}
                    <line x1="70" y1="14" x2="70" y2="126" stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />
                    <line x1="12" y1="70" x2="128" y2="70" stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />
                    <line x1="28" y1="30" x2="112" y2="110" stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />
                    <line x1="112" y1="30" x2="28" y2="110" stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />
                    <line x1="70" y1="14" x2="128" y2="70" stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />
                    <line x1="128" y1="70" x2="70" y2="126" stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />
                    <line x1="70" y1="126" x2="12" y2="70" stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />
                    <line x1="12" y1="70" x2="70" y2="14" stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />

                    {/* Outer node dots */}
                    <circle cx="70" cy="14" r="5" fill="#ffffff" stroke="#38bdf8" strokeWidth="2.5" />
                    <circle cx="112" cy="30" r="3.5" fill="#94a3b8" />
                    <circle cx="128" cy="70" r="5" fill="#ffffff" stroke="#38bdf8" strokeWidth="2.5" />
                    <circle cx="112" cy="110" r="5" fill="#ffffff" stroke="#38bdf8" strokeWidth="2.5" />
                    <circle cx="70" cy="126" r="5" fill="#ffffff" stroke="#38bdf8" strokeWidth="2.5" />
                    <circle cx="28" cy="110" r="3.5" fill="#94a3b8" />
                    <circle cx="12" cy="70" r="3.5" fill="#94a3b8" />
                    <circle cx="28" cy="30" r="3.5" fill="#94a3b8" />

                    {/* Mid interconnected node dots */}
                    <circle cx="48" cy="48" r="3" fill="#cbd5e1" />
                    <circle cx="92" cy="48" r="3" fill="#cbd5e1" />
                    <circle cx="92" cy="92" r="3" fill="#cbd5e1" />
                    <circle cx="48" cy="92" r="3" fill="#cbd5e1" />

                    {/* Central Soft Glow Circle */}
                    <circle cx="70" cy="70" r="27" fill="#e0f2fe" />

                    {/* Chat Bubble Icon */}
                    <path
                      d="M58 64C58 59.0294 62.0294 55 67 55H73C77.9706 55 82 59.0294 82 64V68C82 72.9706 77.9706 77 73 77H65.5L61 81.5V76.5C59.2 75.3 58 73.2 58 68V64Z"
                      fill="#ffffff"
                      stroke="#0284c7"
                      strokeWidth="2.2"
                      strokeLinejoin="round"
                    />
                    {/* 3 Dots inside chat bubble */}
                    <circle cx="65.5" cy="65.5" r="1.5" fill="#0284c7" />
                    <circle cx="70" cy="65.5" r="1.5" fill="#0284c7" />
                    <circle cx="74.5" cy="65.5" r="1.5" fill="#0284c7" />
                  </svg>
                </div>

                <h3
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: 16.5,
                    fontWeight: 700,
                    color: "var(--bms-text, #1e293b)",
                    letterSpacing: -0.2,
                  }}
                >
                  No messages yet
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--bms-text-3, #64748b)" }}>
                  Send a message to start chatting!
                </p>
              </div>
            ) : (
              (() => {
                let lastDateKey = "";
                return messages.map((msg) => {
                  const msgDate = dayjs(msg.created_at || new Date());
                  const dateKey = msgDate.format("YYYY-MM-DD");
                  let datePillLabel = "";

                  if (dateKey !== lastDateKey) {
                    lastDateKey = dateKey;
                    const now = dayjs();
                    if (msgDate.isSame(now, "day")) {
                      datePillLabel = "Today";
                    } else if (msgDate.isSame(now.subtract(1, "day"), "day")) {
                      datePillLabel = "Yesterday";
                    } else {
                      datePillLabel = msgDate.format("MMMM D, YYYY");
                    }
                  }

                  const isMine = Boolean(
                    (myId && msg.sender?.id && String(msg.sender.id).toLowerCase() === String(myId).toLowerCase()) ||
                    (typeof msg.sender === "string" && myId && msg.sender.toLowerCase() === String(myId).toLowerCase()) ||
                    (user?.email && msg.sender?.email && msg.sender.email.toLowerCase() === user.email.toLowerCase())
                  );

                  return (
                    <div key={msg.id} id={`msg-${msg.id}`}>
                      {datePillLabel && (
                        <div style={{ textAlign: "center", margin: "16px 0 8px 0" }}>
                          <span
                            style={{
                              background: "var(--bms-bg, #f8fafc)",
                              border: "1px solid var(--bms-border, rgba(0,0,0,0.08))",
                              padding: "2px 10px",
                              borderRadius: 10,
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: "var(--bms-text-3)",
                              letterSpacing: 0.3,
                              textTransform: "uppercase",
                            }}
                          >
                            {datePillLabel}
                          </span>
                        </div>
                      )}
                      <DiscussionCard
                        message={msg}
                        isMine={isMine}
                        isImportant={currentPinnedMessage?.id === msg.id}
                        replyToMessage={
                          msg.reply_to ? messages.find((m) => m.id === msg.reply_to) || null : null
                        }
                        onReply={(m) => setReplyingMessage(m)}
                        onReact={handleReact}
                        onVotePoll={handleVotePoll}
                        onToggleImportant={handleToggleImportant}
                        onDeleteForMe={handleDeleteForMe}
                        onDeleteForEveryone={handleDeleteForEveryone}
                        onShowInfo={(m) => {
                          setSelectedMessageInfo(m);
                          setMessageInfoOpen(true);
                        }}
                        onJumpToReply={(rId) => {
                          const el = document.getElementById(`msg-${rId}`);
                          el?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        myId={myId}
                        isDirectChat={activeConversation.type === "DIRECT"}
                        isAIChat={activeConversation.id === "ai_bot"}
                        isReadByRecipient={(() => {
                          if (!isMine || activeConversation.id === "ai_bot") return undefined;
                          const msgTime = new Date(msg.created_at).getTime();
                          if (isNaN(msgTime)) return false;
                          const myIdStr = myId != null ? String(myId).toLowerCase() : "";
                          if (activeConversation.type === "DIRECT") {
                            const otherP = activeConversation.participants?.find((p) => {
                              const empId = p?.employee?.id != null ? String(p.employee.id).toLowerCase() : (p?.id != null ? String(p.id).toLowerCase() : "");
                              return empId !== "" && empId !== myIdStr;
                            });
                            if (otherP?.last_read_at) {
                              const readTime = new Date(otherP.last_read_at).getTime();
                              return !isNaN(readTime) && readTime >= msgTime;
                            }
                            return false;
                          } else {
                            const otherReaders = (activeConversation.participants || []).filter((p) => {
                              const empId = p?.employee?.id != null ? String(p.employee.id).toLowerCase() : (p?.id != null ? String(p.id).toLowerCase() : "");
                              return empId !== "" && empId !== myIdStr && p?.last_read_at && new Date(p.last_read_at).getTime() >= msgTime;
                            });
                            return otherReaders.length > 0 ? otherReaders.length : false;
                          }
                        })()}
                        otherParticipantName={
                          activeConversation.id === "ai_bot"
                            ? "Nexus AI Assistant"
                            : activeConversation.participants?.find((p) => {
                                const empId = p?.employee?.id != null ? String(p.employee.id).toLowerCase() : (p?.id != null ? String(p.id).toLowerCase() : "");
                                return empId !== "" && empId !== (myId != null ? String(myId).toLowerCase() : "");
                              })?.employee?.full_name
                        }
                        participants={activeConversation.participants || []}
                      />
                    </div>
                  );
                });
              })()
            )}
            {isAITyping && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 24px",
                  margin: "8px 0",
                }}
              >
                <AIAvatarIcon size={34} />
                <div
                  style={{
                    padding: "8px 16px",
                    borderRadius: 16,
                    background: "rgba(99, 102, 241, 0.08)",
                    border: "1px solid rgba(99, 102, 241, 0.15)",
                    fontSize: 13,
                    color: "#6366f1",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Studio Composer */}
          <WorkspaceComposer
            onSendMessage={handleSendMessage}
            onSendVoiceMessage={handleSendVoiceMessage}
            onSendPoll={handleSendPoll}
            onSendLocation={handleSendLocation}
            onTypingStart={() => {
              if (activeConversationId) startTyping(activeConversationId);
            }}
            onTypingStop={() => {
              if (activeConversationId) stopTyping(activeConversationId);
            }}
            replyingTo={replyingMessage}
            onCancelReply={() => setReplyingMessage(null)}
            isCompact={rightDeskOpen}
            disabled={isAITyping && activeConversationId === "ai_bot"}
          />
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bms-surface, #ffffff)",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: "var(--bms-bg, #f8fafc)",
                border: "1px solid var(--bms-border, rgba(0,0,0,0.08))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <TeamOutlined style={{ fontSize: 26, color: "var(--bms-primary, #1677ff)" }} />
            </div>
            <h3 style={{ margin: "0 0 6px 0", fontWeight: 700 }}>Select a Channel</h3>
            <p style={{ color: "var(--bms-text-3)", fontSize: 13 }}>
              Choose a project channel, department room, or team member to start collaborating.
            </p>
          </div>
        </div>
      )}

      {/* ── PANEL 3: WORKSPACE DESK & COLLABORATION INSPECTOR ── */}
      {activeConversation && rightDeskOpen && (
        <WorkspaceRightDesk
          conversation={activeConversation}
          currentUserId={myId}
          messages={messages}
          onClose={() => setRightDeskOpen(false)}
          onInitiateCall={(cId, type) => handleInitiateCall(cId, type)}
          onOpenCallHistory={() => setCallHistoryOpen(true)}
          onExportChat={handleExportChat}
          onClearChat={() => handleClearChat(activeConversation.id)}
          onJumpToMessage={(msgId) => {
            const el = document.getElementById(`msg-${msgId}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}

      {/* Feature Modals & Drawers */}
      <NewChatModal
        open={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        onSelectOrCreateConversation={handleSelectOrCreateConversation}
        myId={myId}
        existingConversations={conversations}
      />

      <CallHistoryDrawer
        open={callHistoryOpen}
        onClose={() => setCallHistoryOpen(false)}
        calls={enrichedCallLogs}
        onClearHistory={() => {
          setCallLogs([]);
          if (myId) localStorage.removeItem(getUserStorageKey("call_logs"));
          toast.success("Call history cleared");
        }}
        onInitiateCall={(convId, type) => {
          setCallHistoryOpen(false);
          handleInitiateCall(convId, type);
        }}
      />

      {/* GlobalCallListener handles IncomingCallModal across all pages */}

      <CallOverlayModal
        open={callModalOpen}
        onClose={handleEndCall}
        type={callType}
        currentUserId={myId}
        targetUserId={
          activeCall
            ? activeCall.caller_id === myId
              ? activeCall.recipient_id
              : activeCall.caller_id
            : activeConversation && activeConversation.type === "DIRECT"
            ? getOtherParticipant(activeConversation.participants, user)?.employee?.id
            : undefined
        }
        activeCallId={activeCall?._id || (activeCall as any)?.id || currentCallId || undefined}
        isCallAccepted={activeCall?.status === "ACCEPTED"}
        acceptedAt={activeCall?.accepted_at}
        participantName={
          activeConversation
            ? activeConversation.id === "ai_bot"
              ? "Nexus AI Assistant"
              : activeConversation.type === "GROUP"
              ? activeConversation.name
              : getOtherParticipant(activeConversation.participants, user)?.employee?.full_name || "Colleague"
            : activeCall?.caller?.full_name || "Voice Call"
        }
        avatarUrl={
          activeConversation && activeConversation.type === "DIRECT"
            ? (Array.isArray(activeConversation.participants)
                ? activeConversation.participants.find((p) => p?.employee?.id !== myId)?.employee
                    ?.profile_picture_url
                : null)
            : activeConversation?.avatar_url || activeCall?.caller?.profile_picture_url
        }
      />

      {activeConversation && (
        <MessageInfoModal
          open={messageInfoOpen}
          onClose={() => setMessageInfoOpen(false)}
          message={selectedMessageInfo}
          participants={activeConversation.participants || []}
          myId={myId}
        />
      )}
    </div>
  );
};

class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ChatPage caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", background: "#ffffff", height: "100%" }}>
          <h3 style={{ fontSize: 18, color: "#1e293b", fontWeight: 700 }}>Chat Workspace Initializing</h3>
          <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
            {String(this.state.error?.message || this.state.error || "An unexpected error occurred.")}
          </p>
          <button
            onClick={() => {
              try {
                Object.keys(localStorage).forEach((k) => {
                  if (k.includes("custom_conversations") || k.includes("local_messages") || k.includes("pinned_chats")) {
                    localStorage.removeItem(k);
                  }
                });
              } catch (e) {}
              window.location.reload();
            }}
            style={{
              padding: "8px 20px",
              background: "#1677ff",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear Stale Cache & Reload Chat
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function WrappedChatPage() {
  return (
    <ChatErrorBoundary>
      <ChatPage />
    </ChatErrorBoundary>
  );
}
