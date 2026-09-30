import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ACCESS_TOKEN_KEY, useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import { chatApi, type ChatMessage, type ConversationListItem, type PaginatedResponse } from "@/services/chat";
import { callSounds } from "@/utils/callSounds";

type ServerEvent =
  | { type: "message:new" | "chat.message.created" | "message:updated" | "chat.message.updated" | "message:deleted"; message: ChatMessage }
  | { type: "typing:update"; conversation_id: string; employee_id: string; is_typing: boolean }
  | { type: "presence:update"; employee_id: string; status: "online" | "offline"; last_seen_at?: string }
  | { type: "chat.read.update"; read_info: { conversation_id: string; employee_id: string; read_at: string } }
  | { type: "notification:push"; notification: unknown }
  | { type: "chat.call.update"; call: any }
  | { type: "webrtc:signal"; sender_id: string; signal: any; call_id?: string };

const MAX_BACKOFF_MS = 10_000;

function wsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const token = localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
  const prefix = window.location.pathname.startsWith("/bms") ? "bms" : "pmt";
  const tenantSlug = localStorage.getItem("bms_tenant_slug") || (window.location.hostname.split(".")[0] !== "localhost" ? window.location.hostname.split(".")[0] : "hit");
  return `${proto}//${window.location.host}/${prefix}/ws/chat/?token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenantSlug)}`;
}

export function useChatSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const setConnectionStatus = useChatStore((s) => s.setConnectionStatus);
  const setTyping = useChatStore((s) => s.setTyping);
  const setPresence = useChatStore((s) => s.setPresence);
  const setOnlineSnapshot = useChatStore((s) => s.setOnlineSnapshot);

  const upsertMessageInCache = useCallback(
    (message: ChatMessage) => {
      if (!message || !message.conversation) return;
      const convId = message.conversation;

      queryClient.setQueryData<PaginatedResponse<ChatMessage> | ChatMessage[]>(
        ["chat", "messages", convId],
        (old) => {
          if (!old) return [message];
          if (Array.isArray(old)) {
            const idx = old.findIndex((m) => m.id === message.id);
            return idx === -1 ? [...old, message] : old.map((m) => (m.id === message.id ? { ...m, ...message } : m));
          }
          if ((old as any).results && Array.isArray((old as any).results)) {
            const results = (old as any).results;
            const idx = results.findIndex((m: ChatMessage) => m.id === message.id);
            const newResults = idx === -1 ? [...results, message] : results.map((m: ChatMessage) => (m.id === message.id ? { ...m, ...message } : m));
            return { ...old, results: newResults };
          }
          return old;
        }
      );
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
    },
    [queryClient]
  );

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case "message:new":
        case "chat.message.created": {
          upsertMessageInCache(event.message);
          window.dispatchEvent(new CustomEvent("chat:message:created", { detail: event.message }));
          const activeId = useChatStore.getState().activeConversationId;
          const user = useAuthStore.getState().user;
          const senderId = typeof event.message.sender === "string" ? event.message.sender : event.message.sender?.id;
          const isFromMe = Boolean(
            user &&
              senderId &&
              (String(senderId).toLowerCase() === String(user.id).toLowerCase() ||
                (user.employee_id && String(senderId).toLowerCase() === String(user.employee_id).toLowerCase()) ||
                (user.employee_code && String(senderId).toLowerCase() === String(user.employee_code).toLowerCase()) ||
                (user.email && String(senderId).toLowerCase() === String(user.email).toLowerCase()))
          );

          // Auto-unhide conversation from feed
          if (user?.id && event.message?.conversation) {
            const storageKey = `pmt_${user.id}_hidden_from_feed`;
            try {
              const hidden = JSON.parse(localStorage.getItem(storageKey) || "[]");
              if (Array.isArray(hidden) && hidden.includes(event.message.conversation)) {
                const next = hidden.filter((id: string) => id !== event.message.conversation);
                localStorage.setItem(storageKey, JSON.stringify(next));
              }
            } catch {}
            window.dispatchEvent(
              new CustomEvent("chat:unhide", { detail: { conversationId: event.message.conversation } })
            );
          }

          if (!isFromMe) {
            callSounds.playMessageNotificationSound();
          }

          if (activeId && activeId === event.message.conversation && !isFromMe) {
            chatApi.markRead(event.message.conversation).catch(() => {});
          }
          break;
        }
        case "message:updated":
        case "chat.message.updated":
        case "message:deleted":
          upsertMessageInCache(event.message);
          break;
        case "typing:update":
          setTyping(event.conversation_id, event.employee_id, event.is_typing);
          break;
        case "presence:update":
          setPresence(event.employee_id, event.status, event.last_seen_at);
          break;
        case "presence:snapshot":
          if (Array.isArray((event as any).online_ids)) {
            setOnlineSnapshot((event as any).online_ids);
          }
          break;
        case "chat.read.update": {
          const { conversation_id, employee_id, read_at } = event.read_info || {};
          if (conversation_id && employee_id) {
            queryClient.setQueriesData<ConversationListItem[] | PaginatedResponse<ConversationListItem>>(
              { queryKey: ["chat", "conversations"] },
              (old) => {
                if (!old) return old;
                const updateConv = (c: ConversationListItem) => {
                  if (String(c.id) !== String(conversation_id)) return c;
                  const nextParticipants = (c.participants || []).map((p) =>
                    String(p.employee?.id || (p as any).id).toLowerCase() === String(employee_id).toLowerCase()
                      ? { ...p, last_read_at: read_at || new Date().toISOString() }
                      : p
                  );
                  return { ...c, participants: nextParticipants };
                };
                if (Array.isArray(old)) return old.map(updateConv);
                if (Array.isArray((old as any).results)) {
                  return { ...old, results: (old as any).results.map(updateConv) };
                }
                return old;
              }
            );
            window.dispatchEvent(new CustomEvent("chat:read:update", { detail: event.read_info }));
          }
          break;
        }
        case "notification:push":
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          break;
        case "chat.call.update": {
          const callData = event.call;
          console.log("[Call Signal 4/5] Callee WebSocket received chat.call.update signal:", callData?.status, callData);
          const isTerminated = !callData || ["ENDED", "DECLINED", "MISSED"].includes(callData.status);
          queryClient.setQueryData(["chat", "activeCall"], isTerminated ? null : callData);
          queryClient.invalidateQueries({ queryKey: ["chat", "callHistory"] });
          queryClient.invalidateQueries({ queryKey: ["chat", "messages"] });
          queryClient.refetchQueries({ queryKey: ["chat", "messages"] });
          window.dispatchEvent(new CustomEvent("chat:call:update", { detail: callData }));
          window.dispatchEvent(new CustomEvent("chat:webrtc:signal", { detail: event }));
          break;
        }
        case "webrtc:signal":
          console.log("[Call Signal 4/5] Callee WebSocket received webrtc:signal:", event.signal?.type || event.signal, event);
          window.dispatchEvent(new CustomEvent("chat:webrtc:signal", { detail: event }));
          break;
      }
    },
    [upsertMessageInCache, setTyping, setPresence, queryClient]
  );

  const send = useCallback((payload: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    const handleSocketSend = (e: any) => {
      if (e.detail) {
        send(e.detail);
      }
    };
    window.addEventListener("chat:socket:send", handleSocketSend);
    return () => window.removeEventListener("chat:socket:send", handleSocketSend);
  }, [send]);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token || token.includes("mock")) {
        setConnectionStatus("connected");
        return;
      }
      setConnectionStatus("connecting");
      const url = wsUrl();
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch (err) {
        setConnectionStatus("disconnected");
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, MAX_BACKOFF_MS);
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
        return;
      }
      socketRef.current = socket;
      let pingInterval: any = null;

      socket.onopen = () => {
        reconnectAttempt.current = 0;
        setConnectionStatus("connected");
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "presence:ping" }));
        }
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "presence:ping" }));
          }
        }, 10000);
      };

      socket.onmessage = (evt) => {
        try {
          handleEvent(JSON.parse(evt.data));
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        setConnectionStatus("disconnected");
        if (cancelled) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, MAX_BACKOFF_MS);
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        if (pingInterval) clearInterval(pingInterval);
        socket.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
    };
  }, [handleEvent, setConnectionStatus]);

  const startTyping = useCallback((conversationId: string) => send({ type: "typing:start", conversation: conversationId }), [send]);
  const stopTyping = useCallback((conversationId: string) => send({ type: "typing:stop", conversation: conversationId }), [send]);
  const markRead = useCallback((conversationId: string) => send({ type: "message:read", conversation: conversationId }), [send]);
  const joinConversation = useCallback((conversationId: string) => send({ type: "chat:join", conversation: conversationId }), [send]);
  const leaveConversation = useCallback((conversationId: string) => send({ type: "chat:leave", conversation: conversationId }), [send]);
  const sendMessage = useCallback((conversationId: string, body: string, extra?: { reply_to?: string | null; mention_employee_ids?: string[] }) => {
    send({
      type: "message:send",
      conversation: conversationId,
      body,
      ...(extra || {}),
    });
  }, [send]);

  const activeConversationId = useChatStore((s) => s.activeConversationId);
  useEffect(() => {
    if (activeConversationId) {
      joinConversation(activeConversationId);
    }
  }, [activeConversationId, joinConversation]);

  return { startTyping, stopTyping, markRead, joinConversation, leaveConversation, sendMessage, send };
}
