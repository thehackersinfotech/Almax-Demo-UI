import React, { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/auth";
import { chatApi, CallRecord } from "@/services/chat";
import { IncomingCallModal as StyledIncomingCallModal } from "@/pages/chat/components/IncomingCallModal";
import { CallOverlayModal } from "@/pages/chat/components/CallOverlayModal";
import { useChatSocket } from "@/hooks/useChatSocket";
import { callSounds } from "@/utils/callSounds";

export const GlobalCallListener: React.FC = () => {
  // Connect persistent WebSocket connection app-wide for incoming calls & presence
  useChatSocket();

  const user = useAuthStore((s) => s.user);
  const myId = user?.id;

  const [incomingCall, setIncomingCall] = useState<CallRecord | null>(null);
  const [activeCallRecord, setActiveCallRecord] = useState<CallRecord | null>(null);

  const isMe = useCallback(
    (idCheck?: string | number | null) => {
      if (!idCheck || !user) return false;
      const str = String(idCheck).toLowerCase().trim();
      return (
        (user.id && str === String(user.id).toLowerCase().trim()) ||
        (user.employee_id && str === String(user.employee_id).toLowerCase().trim()) ||
        (user.employee_code && str === String(user.employee_code).toLowerCase().trim()) ||
        (user.username && str === String(user.username).toLowerCase().trim())
      );
    },
    [user]
  );

  useEffect(() => {
    if (!user) return;

    const handleCallSignal = (e: any) => {
      const detail = e.detail;
      if (!detail) return;

      const eventType = e.type;
      const signalType = detail.type || detail.signal?.type;
      const callData: CallRecord | null =
        detail.call || detail.payload || (detail.status ? detail : null);

      const recipientId =
        callData?.recipient_id ||
        (callData as any)?.recipient?.id ||
        (callData as any)?.receiver_id ||
        (callData as any)?.receiver?.id ||
        detail.target_user_id ||
        detail.signal?.target_user_id;

      const callerId =
        callData?.caller_id ||
        (callData as any)?.caller?.id ||
        (callData as any)?.caller?.employee_id ||
        detail.sender_id ||
        detail.signal?.caller_id;

      const isMeRecipient =
        isMe(callData?.recipient_id) ||
        isMe((callData as any)?.recipient?.id) ||
        isMe((callData as any)?.recipient?.user_id) ||
        isMe((callData as any)?.recipient?.employee_code) ||
        isMe((callData as any)?.recipient?.username) ||
        isMe(detail.target_user_id) ||
        isMe(detail.signal?.target_user_id) ||
        isMe(recipientId);

      const isMeCaller =
        isMe(callData?.caller_id) ||
        isMe((callData as any)?.caller?.id) ||
        isMe((callData as any)?.caller?.user_id) ||
        isMe((callData as any)?.caller?.employee_code) ||
        isMe((callData as any)?.caller?.username) ||
        isMe(detail.sender_id) ||
        isMe(detail.signal?.caller_id) ||
        isMe(callerId);

      const statusStr = String(callData?.status || "").toUpperCase();
      const isRinging =
        statusStr === "RINGING" || signalType === "call_ring" || signalType === "call.initiate";

      console.log(
        "[Call Signal 5/5] GlobalCallListener processing signal: eventType=",
        eventType,
        "signalType=",
        signalType,
        "isMeRecipient=",
        isMeRecipient,
        "isMeCaller=",
        isMeCaller,
        "status=",
        callData?.status
      );

      // Incoming call signal
      if (
        (eventType === "chat:call:update" ||
          eventType === "call:incoming" ||
          signalType === "call_ring" ||
          signalType === "call.initiate") &&
        callData &&
        isRinging
      ) {
        if (isMeRecipient && !isMeCaller) {
          console.log(
            "[Call Signal 5/5] Callee UI rendering incoming call modal for call_id:",
            callData._id || (callData as any).id,
            "from caller:",
            callerId
          );
          setIncomingCall(callData);
          callSounds.playIncomingRingtone();
        }
      }

      // Termination check
      const status = callData?.status;
      const isTerminated =
        ["ENDED", "DECLINED", "CANCELLED", "MISSED"].includes(status as string) ||
        ["hangup", "bye", "end", "reject", "decline"].includes(signalType);

      if (isTerminated) {
        setIncomingCall(null);
        setActiveCallRecord(null);
        callSounds.stopRingtone();
      } else if (status === "ACCEPTED" || signalType === "call_accepted" || signalType === "answer") {
        setIncomingCall(null);
      }
    };

    window.addEventListener("chat:webrtc:signal", handleCallSignal);
    window.addEventListener("chat:call:update", handleCallSignal as EventListener);
    window.addEventListener("call:incoming", handleCallSignal as EventListener);

    return () => {
      window.removeEventListener("chat:webrtc:signal", handleCallSignal);
      window.removeEventListener("chat:call:update", handleCallSignal as EventListener);
      window.removeEventListener("call:incoming", handleCallSignal as EventListener);
    };
  }, [user, isMe]);

  const handleAccept = () => {
    if (!incomingCall) return;

    const callId = incomingCall._id || (incomingCall as any).id;
    const callerId =
      incomingCall.caller_id ||
      (incomingCall.caller as any)?.id ||
      (incomingCall.caller as any)?.employee_id;

    const nowIso = new Date().toISOString();

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

    setActiveCallRecord({
      ...incomingCall,
      status: "ACCEPTED",
      accepted_at: nowIso,
    });

    setIncomingCall(null);
  };

  const handleDecline = () => {
    if (!incomingCall) return;

    const callId = incomingCall._id || (incomingCall as any).id;
    const callerId =
      incomingCall.caller_id ||
      (incomingCall.caller as any)?.id ||
      (incomingCall.caller as any)?.employee_id;

    if (callerId) {
      window.dispatchEvent(
        new CustomEvent("chat:socket:send", {
          detail: {
            type: "webrtc:signal",
            target_user_id: callerId,
            call_id: callId,
            signal: { type: "decline" },
          },
        })
      );
    }

    chatApi.respondToCall({ call_id: callId, action: "DECLINE" }).catch(() => {});

    setIncomingCall(null);
  };

  return (
    <>
      {incomingCall && (
        <StyledIncomingCallModal
          call={incomingCall}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}

      {activeCallRecord && (
        <CallOverlayModal
          open={!!activeCallRecord}
          onClose={(durationSecs) => {
            const callId = activeCallRecord._id || (activeCallRecord as any).id;
            if (callId) {
              chatApi.endCall({ call_id: callId, duration_seconds: durationSecs || 0 }).catch(() => {});
            }
            setActiveCallRecord(null);
          }}
          type={activeCallRecord.call_type === "VIDEO" ? "VIDEO" : "VOICE"}
          participantName={activeCallRecord.caller?.full_name || "Caller"}
          avatarUrl={activeCallRecord.caller?.profile_picture_url}
          isCallAccepted={true}
          acceptedAt={activeCallRecord.accepted_at}
          currentUserId={myId}
          targetUserId={activeCallRecord.caller_id}
          activeCallId={activeCallRecord._id || (activeCallRecord as any).id}
        />
      )}
    </>
  );
};
