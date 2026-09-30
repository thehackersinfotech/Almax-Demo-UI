import { useState, useEffect, useRef, useCallback } from "react";
import { get } from "@/services/api";
import { CallSignalingClient } from "@/services/signaling";
import { WebRTCManager } from "@/services/webrtc";

export type CallState = "IDLE" | "RINGING" | "CONNECTING" | "CONNECTED" | "ENDED";

export interface CallSession {
  callId: string;
  callType: "AUDIO" | "VIDEO";
  peerName: string;
  peerAvatar?: string;
  isCaller: boolean;
}

export function useWebRTC(session: CallSession | null, onEnded?: () => void) {
  const [callState, setCallState] = useState<CallState>("IDLE");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);

  const rtcManagerRef = useRef<WebRTCManager | null>(null);
  const signalingRef = useRef<CallSignalingClient | null>(null);
  const timerRef = useRef<any>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDurationSeconds(0);
    timerRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopTimer();
    if (rtcManagerRef.current) {
      rtcManagerRef.current.close();
      rtcManagerRef.current = null;
    }
    if (signalingRef.current) {
      signalingRef.current.disconnect();
      signalingRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState("ENDED");
    if (onEnded) onEnded();
  }, [stopTimer, onEnded]);

  const initCall = useCallback(async () => {
    if (!session) return;
    try {
      setCallState(session.isCaller ? "RINGING" : "CONNECTING");

      // Fetch STUN/TURN credentials from backend API
      const creds = await get<{ ice_servers: RTCIceServer[] }>("/calls/turn-credentials/");
      const iceServers = creds?.ice_servers || [{ urls: ["stun:stun.l.google.com:19302"] }];

      const rtc = new WebRTCManager({ iceServers });
      rtcManagerRef.current = rtc;

      const signaling = new CallSignalingClient(session.callId);
      signalingRef.current = signaling;

      rtc.setCallbacks(
        (candidate) => {
          signaling.send("webrtc.ice_candidate", candidate);
        },
        (stream) => {
          setRemoteStream(stream);
        }
      );

      const stream = await rtc.acquireLocalMedia(session.callType === "VIDEO", true);
      setLocalStream(stream);

      const handleSignal = async (type: string, payload: any) => {
        const sigType = String(type).toLowerCase();
        if (sigType === "call.accept" || sigType === "call_accepted" || sigType === "accept") {
          setCallState("CONNECTED");
          startTimer();
          if (session.isCaller && rtcManagerRef.current) {
            const offer = await rtcManagerRef.current.createOffer();
            signaling.send("webrtc.offer", offer);
          }
        } else if (sigType === "call.reject" || sigType === "call.end" || sigType === "decline" || sigType === "reject" || sigType === "end") {
          cleanup();
        } else if (sigType === "webrtc.offer" || sigType === "offer") {
          if (rtcManagerRef.current) {
            const answer = await rtcManagerRef.current.handleOfferAndCreateAnswer(payload);
            signaling.send("webrtc.answer", answer);
            setCallState("CONNECTED");
            startTimer();
          }
        } else if (sigType === "webrtc.answer" || sigType === "answer") {
          if (rtcManagerRef.current) {
            await rtcManagerRef.current.handleAnswer(payload);
          }
        } else if (sigType === "webrtc.ice_candidate" || sigType === "ice_candidate" || sigType === "candidate") {
          if (rtcManagerRef.current) {
            await rtcManagerRef.current.addIceCandidate(payload);
          }
        }
      };

      await signaling.connect(async (type, payload) => {
        await handleSignal(type, payload);
      });

      const handleWindowSignal = (e: any) => {
        const detail = e.detail;
        if (!detail) return;
        const callId = detail.call_id || detail.call?._id || detail.call?.id;
        if (callId && session && callId !== session.callId) return;

        let sigType = detail.type || detail.signal?.type;
        let sigPayload = detail.payload !== undefined ? detail.payload : detail.signal?.payload || detail.signal;
        if (sigType) {
          handleSignal(sigType, sigPayload);
        }
      };

      window.addEventListener("chat:webrtc:signal", handleWindowSignal);
    } catch (e) {
      console.error("WebRTC call initialization failed:", e);
      cleanup();
    }
  }, [session, startTimer, cleanup]);

  useEffect(() => {
    if (session) {
      initCall();
    }
    return () => {
      stopTimer();
    };
  }, [session, initCall, stopTimer]);

  const acceptCall = useCallback(() => {
    if (signalingRef.current) {
      signalingRef.current.send("call.accept");
      setCallState("CONNECTED");
      startTimer();
    }
  }, [startTimer]);

  const rejectCall = useCallback(() => {
    if (signalingRef.current) {
      signalingRef.current.send("call.reject");
    }
    cleanup();
  }, [cleanup]);

  const endCall = useCallback(() => {
    if (signalingRef.current) {
      signalingRef.current.send("call.end");
    }
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (rtcManagerRef.current) {
      const nextMuted = !isMuted;
      rtcManagerRef.current.toggleMute(nextMuted);
      setIsMuted(nextMuted);
    }
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    if (rtcManagerRef.current) {
      const nextCam = !isCameraOff;
      rtcManagerRef.current.toggleCamera(!nextCam);
      setIsCameraOff(nextCam);
    }
  }, [isCameraOff]);

  return {
    callState,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    durationSeconds,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
