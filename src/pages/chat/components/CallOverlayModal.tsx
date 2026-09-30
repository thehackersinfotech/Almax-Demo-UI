import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AudioMutedOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  PhoneOutlined,
  DesktopOutlined,
  LockOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from "@ant-design/icons";
import { message as toast } from "antd";
import { callSounds } from "@/utils/callSounds";

interface CallOverlayModalProps {
  open: boolean;
  onClose: (durationSecs?: number) => void;
  type: "VOICE" | "VIDEO";
  participantName: string;
  avatarUrl?: string | null;
  isCallAccepted?: boolean;
  acceptedAt?: string | null;
  currentUserId?: string;
  targetUserId?: string;
  activeCallId?: string;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.services.mozilla.com" },
  ],
};

export const CallOverlayModal: React.FC<CallOverlayModalProps> = ({
  open,
  onClose,
  type,
  participantName,
  avatarUrl,
  isCallAccepted = false,
  acceptedAt,
  currentUserId,
  targetUserId,
  activeCallId,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(type === "VIDEO");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [ringingTimeoutCount, setRingingTimeoutCount] = useState(45);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [streamTick, setStreamTick] = useState(0); // Stable version trigger for stream changes
  const [isAcceptedLocally, setIsAcceptedLocally] = useState(isCallAccepted || false);
  const effectiveIsAccepted = isCallAccepted || isAcceptedLocally;

  useEffect(() => {
    if (isCallAccepted) {
      setIsAcceptedLocally(true);
    }
  }, [isCallAccepted]);

  useEffect(() => {
    if (!open) {
      setIsAcceptedLocally(false);
    }
  }, [open]);

  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipCompactVideoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  // Safe stream attacher
  const safeAttachStream = useCallback((el: HTMLVideoElement | HTMLAudioElement | null, stream: MediaStream | null) => {
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    if (stream) {
      if (el instanceof HTMLAudioElement) {
        el.muted = false;
      }
      el.play().catch((err) => {
        console.warn("Media playback error:", err);
      });
    }
  }, []);

  // Initialize WebRTC Peer Connection
  const initializePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected" || pc.iceConnectionState === "connected") {
        setIsAcceptedLocally(true);
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.connectionState === "connected") {
        setIsAcceptedLocally(true);
      }
    };

    // Send ICE candidates to target peer
    pc.onicecandidate = (event) => {
      if (event.candidate && targetUserId) {
        window.dispatchEvent(
          new CustomEvent("chat:socket:send", {
            detail: {
              type: "webrtc:signal",
              target_user_id: targetUserId,
              call_id: activeCallId,
              signal: { type: "candidate", candidate: event.candidate },
            },
          })
        );
      }
    };

    // Receive Remote Streams
    pc.ontrack = (event) => {
      const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
      remoteStreamRef.current = stream;

      // Play audio from remote peer through dedicated audio element
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch((err) => console.warn("Remote audio play error:", err));
      }

      // Check if remote video track exists and is active
      const checkVideo = () => {
        const videoTracks = stream.getVideoTracks();
        const hasLiveVideo =
          videoTracks.length > 0 && videoTracks.some((t) => t.enabled && t.readyState === "live");
        setHasRemoteVideo(hasLiveVideo);
        setStreamTick((t) => t + 1);
      };

      checkVideo();
      stream.onaddtrack = checkVideo;
      stream.onremovetrack = checkVideo;
    };

    // Add local tracks to PC if already available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  }, [targetUserId, activeCallId, safeAttachStream]);

  // Acquire Local Media (Camera/Mic)
  const startLocalMedia = useCallback(
    async (withVideo: boolean) => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;

        // Stop existing local tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: withVideo
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user",
              }
            : false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        localStreamRef.current = stream;
        setStreamTick((t) => t + 1);

        // Update tracks in RTCPeerConnection if established
        if (pcRef.current) {
          const senders = pcRef.current.getSenders();
          stream.getTracks().forEach((newTrack) => {
            const sender = senders.find((s) => s.track?.kind === newTrack.kind);
            if (sender) {
              sender.replaceTrack(newTrack).catch(() => {});
            } else {
              pcRef.current?.addTrack(newTrack, stream);
            }
          });
        }
      } catch (err) {
        console.warn("Could not access camera / mic:", err);
      }
    },
    []
  );

  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidatesQueue.current = [];
    setHasRemoteVideo(false);
  }, []);

  // Main Call Lifecycle
  useEffect(() => {
    if (open) {
      const shouldVideoBeOn = type === "VIDEO";
      setIsVideoOn(shouldVideoBeOn);
      setIsMuted(false);
      setIsScreenSharing(false);
      setIsFullscreen(false);
      if (!effectiveIsAccepted) {
        setSeconds(0);
        setRingingTimeoutCount(45);
      }
      startLocalMedia(shouldVideoBeOn).then(() => {
        initializePeerConnection();
      });
    } else {
      setIsVideoOn(false);
      setIsMuted(false);
      setIsScreenSharing(false);
      setIsFullscreen(false);
      setSeconds(0);
      stopLocalMedia();
      callSounds.stopRingtone();
    }
  }, [open, type, effectiveIsAccepted, startLocalMedia, initializePeerConnection, stopLocalMedia]);

  // Initiate SDP Offer when Call is Accepted by the Caller
  useEffect(() => {
    if (open && effectiveIsAccepted && targetUserId && pcRef.current) {
      const pc = pcRef.current;
      if (pc.signalingState === "stable" && !pc.remoteDescription) {
        pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pc.localDescription) {
              window.dispatchEvent(
                new CustomEvent("chat:socket:send", {
                  detail: {
                    type: "webrtc:signal",
                    target_user_id: targetUserId,
                    call_id: activeCallId,
                    signal: { type: "offer", sdp: pc.localDescription },
                  },
                })
              );
            }
          })
          .catch((err) => console.warn("Error creating WebRTC offer:", err));
      }
    }
  }, [open, effectiveIsAccepted, targetUserId, activeCallId]);

  // Listen for Incoming WebRTC Signals
  useEffect(() => {
    const handleWebRTCSignal = async (e: any) => {
      const { signal, sender_id } = e.detail || {};
      if (!signal || !open) return;

      const pc = pcRef.current || initializePeerConnection();

      try {
        if (signal.type === "call_accepted" || signal.type === "answer") {
          setIsAcceptedLocally(true);
        }

        if (signal.type === "hangup" || signal.type === "bye") {
          callSounds.stopRingtone();
          callSounds.playCutSound();
          stopLocalMedia();
          setIsFullscreen(false);
          onClose();
          return;
        } else if (signal.type === "offer" && signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          while (iceCandidatesQueue.current.length > 0) {
            const cand = iceCandidatesQueue.current.shift();
            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          window.dispatchEvent(
            new CustomEvent("chat:socket:send", {
              detail: {
                type: "webrtc:signal",
                target_user_id: sender_id,
                call_id: activeCallId,
                signal: { type: "answer", sdp: pc.localDescription },
              },
            })
          );
        } else if (signal.type === "answer" && signal.sdp) {
          setIsAcceptedLocally(true);
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            while (iceCandidatesQueue.current.length > 0) {
              const cand = iceCandidatesQueue.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }
        } else if (signal.type === "candidate" && signal.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            iceCandidatesQueue.current.push(signal.candidate);
          }
        } else if (signal.type === "end" || signal.type === "reject" || signal.type === "decline") {
          callSounds.stopRingtone();
          callSounds.playCutSound();
          stopLocalMedia();
          setIsFullscreen(false);
          onClose(seconds);
        }
      } catch (err) {
        console.warn("WebRTC signal handling error:", err);
      }
    };

    window.addEventListener("chat:webrtc:signal", handleWebRTCSignal);
    return () => window.removeEventListener("chat:webrtc:signal", handleWebRTCSignal);
  }, [open, activeCallId, initializePeerConnection, stopLocalMedia, onClose]);

  // Listen for Server-Side Call Status Updates (e.g. Remote User Cut / Declined)
  useEffect(() => {
    const handleCallUpdate = (e: any) => {
      const callData = e.detail;
      if (!callData || !open) return;
      const status = callData.status || callData.call?.status || callData.message?.status;
      if (status === "ACCEPTED") {
        setIsAcceptedLocally(true);
      }
      const isTerminated = ["ENDED", "DECLINED", "MISSED", "CANCELLED"].includes(status);
      if (isTerminated) {
        callSounds.stopRingtone();
        callSounds.playCutSound();
        stopLocalMedia();
        setIsFullscreen(false);
        onClose(seconds);
      }
    };
    window.addEventListener("chat:call:update", handleCallUpdate);
    return () => window.removeEventListener("chat:call:update", handleCallUpdate);
  }, [open, seconds, stopLocalMedia, onClose]);

  // Ringing timeout (45s)
  useEffect(() => {
    if (open && !effectiveIsAccepted) {
      callSounds.playRingback();
      setRingingTimeoutCount(45);
      const ringInterval = setInterval(() => {
        setRingingTimeoutCount((prev) => {
          if (prev <= 1) {
            clearInterval(ringInterval);
            callSounds.stopRingtone();
            callSounds.playCutSound();
            toast.info(`No answer from ${participantName}`);
            onClose(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(ringInterval);
        callSounds.stopRingtone();
      };
    }
  }, [open, effectiveIsAccepted, participantName, onClose]);

  const callAcceptedStartTimeRef = useRef<number | null>(null);

  // Active call timer
  useEffect(() => {
    let timer: any;
    if (open && effectiveIsAccepted) {
      callSounds.stopRingtone();

      if (!callAcceptedStartTimeRef.current) {
        if (acceptedAt) {
          const parsed = new Date(acceptedAt).getTime();
          callAcceptedStartTimeRef.current = !isNaN(parsed) ? parsed : Date.now();
        } else {
          callAcceptedStartTimeRef.current = Date.now();
        }
        setSeconds(0);
      }

      const syncSeconds = () => {
        if (acceptedAt) {
          const parsed = new Date(acceptedAt).getTime();
          if (!isNaN(parsed)) {
            const elapsed = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
            setSeconds(elapsed);
            return;
          }
        }
        if (callAcceptedStartTimeRef.current) {
          const elapsed = Math.max(0, Math.floor((Date.now() - callAcceptedStartTimeRef.current) / 1000));
          setSeconds(elapsed);
        }
      };

      syncSeconds();
      timer = setInterval(syncSeconds, 1000);
    } else {
      callAcceptedStartTimeRef.current = null;
      if (!open) setSeconds(0);
    }
    return () => clearInterval(timer);
  }, [open, effectiveIsAccepted, acceptedAt]);

  // Resolve Active Video Stream for Display:
  // - If remote video exists: show remote stream
  // - Otherwise if local video/screen share is on: show local stream
  const activeVideoStream =
    hasRemoteVideo && remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0
      ? remoteStreamRef.current
      : isVideoOn || isScreenSharing
      ? localStreamRef.current
      : null;

  const isShowingRemote =
    hasRemoteVideo && remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0;

  // Dedicated stable stream attacher useEffect (Zero flickering / blinking)
  useEffect(() => {
    if (mainVideoRef.current && activeVideoStream) {
      safeAttachStream(mainVideoRef.current, activeVideoStream);
    }
    if (fullscreenVideoRef.current && activeVideoStream) {
      safeAttachStream(fullscreenVideoRef.current, activeVideoStream);
    }
    if (pipVideoRef.current && localStreamRef.current && isShowingRemote) {
      safeAttachStream(pipVideoRef.current, localStreamRef.current);
    }
    if (pipCompactVideoRef.current && localStreamRef.current && isShowingRemote) {
      safeAttachStream(pipCompactVideoRef.current, localStreamRef.current);
    }
  }, [activeVideoStream, streamTick, isFullscreen, isShowingRemote, safeAttachStream]);

  // Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      await startLocalMedia(isVideoOn);
    } else {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) return;
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { cursor: "always" },
          audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace track in WebRTC sender so remote sees screen immediately
        if (pcRef.current) {
          const videoSender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(screenTrack).catch(() => {});
          } else {
            pcRef.current.addTrack(screenTrack, screenStream);
          }
        }

        localStreamRef.current = screenStream;
        setIsScreenSharing(true);
        setStreamTick((t) => t + 1);

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          startLocalMedia(isVideoOn);
        };
      } catch (err) {
        console.warn("Screen share cancelled or failed:", err);
      }
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    if (isVideoOn) {
      setIsVideoOn(false);
      if (!isScreenSharing) {
        await startLocalMedia(false);
      }
    } else {
      setIsVideoOn(true);
      if (!isScreenSharing) {
        await startLocalMedia(true);
      }
    }
  };

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndCall = () => {
    if (targetUserId) {
      window.dispatchEvent(
        new CustomEvent("chat:socket:send", {
          detail: {
            type: "webrtc:signal",
            target_user_id: targetUserId,
            call_id: activeCallId,
            signal: { type: "end" },
          },
        })
      );
    }
    callSounds.stopRingtone();
    callSounds.playCutSound();
    stopLocalMedia();
    setIsFullscreen(false);

    if (targetUserId) {
      window.dispatchEvent(
        new CustomEvent("chat:socket:send", {
          detail: {
            type: "webrtc:signal",
            target_user_id: targetUserId,
            call_id: activeCallId,
            signal: { type: "hangup" },
          },
        })
      );
    }
    onClose(seconds);
  };

  if (!open) return null;

  const isMediaActive = Boolean(activeVideoStream);

  // ════════════════════════════════════════════════════════════════════════════
  // ── FULLSCREEN THEATRE MODE ──
  // ════════════════════════════════════════════════════════════════════════════
  if (isFullscreen && isMediaActive) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 99999,
          background: "#030712",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

        {/* Fullscreen Video Element */}
        <div style={{ flex: 1, width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
          <video
            ref={fullscreenVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: isScreenSharing ? "contain" : "cover",
              transform: isScreenSharing || isShowingRemote ? "none" : "scaleX(-1)",
              background: "#000000",
            }}
          />

          {/* Picture-in-Picture Local Preview (WhatsApp style floating video in top-right corner) */}
          {isShowingRemote && (isVideoOn || localStreamRef.current) && (
            <div
              style={{
                position: "absolute",
                top: 88,
                right: 28,
                width: 140,
                height: 190,
                borderRadius: 16,
                overflow: "hidden",
                border: "2px solid rgba(255, 255, 255, 0.4)",
                boxShadow: "0 12px 32px rgba(0, 0, 0, 0.75)",
                background: "#0f172a",
                zIndex: 25,
                transition: "all 0.2s ease",
              }}
            >
              <video
                ref={pipVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#ffffff",
                  background: "rgba(0, 0, 0, 0.65)",
                  backdropFilter: "blur(6px)",
                  padding: "2px 8px",
                  borderRadius: 6,
                  letterSpacing: "0.2px",
                }}
              >
                You
              </div>
            </div>
          )}

          {/* Top Floating Glass Header Bar */}
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 24,
              right: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 20,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(12, 19, 34, 0.85)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "8px 18px",
                borderRadius: 24,
                color: "#ffffff",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: effectiveIsAccepted ? "#10b981" : "#f59e0b",
                  boxShadow: effectiveIsAccepted
                    ? "0 0 12px rgba(16, 185, 129, 0.9)"
                    : "0 0 12px rgba(245, 158, 11, 0.9)",
                }}
              />
              <span style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: "0.4px" }}>
                {participantName} • {effectiveIsAccepted ? formatDuration(seconds) : "Ringing..."}
              </span>
              <span
                style={{
                  fontSize: 11,
                  background: "rgba(255, 255, 255, 0.1)",
                  padding: "2px 8px",
                  borderRadius: 12,
                  color: "#cbd5e1",
                  fontWeight: 600,
                }}
              >
                {isScreenSharing ? "Screen Sharing" : isShowingRemote ? "Remote Video" : "HD Camera"}
              </span>
            </div>

            <button
              onClick={() => setIsFullscreen(false)}
              title="Exit Full Screen"
              style={{
                background: "rgba(12, 19, 34, 0.85)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 24,
                padding: "8px 18px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                transition: "all 0.15s ease",
              }}
            >
              <FullscreenExitOutlined style={{ fontSize: 15 }} />
              <span>Exit Fullscreen</span>
            </button>
          </div>

          {/* Bottom Floating Control Dock */}
          <div
            style={{
              position: "absolute",
              bottom: 36,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: "rgba(12, 19, 34, 0.85)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              padding: "10px 24px",
              borderRadius: 36,
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
              zIndex: 20,
            }}
          >
            <button
              onClick={toggleMute}
              style={{
                height: 44,
                padding: "0 18px",
                borderRadius: 22,
                background: isMuted ? "#ef4444" : "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {isMuted ? <AudioMutedOutlined style={{ fontSize: 16 }} /> : <AudioOutlined style={{ fontSize: 16 }} />}
              <span>{isMuted ? "Unmute" : "Mute Mic"}</span>
            </button>

            <button
              onClick={toggleVideo}
              style={{
                height: 44,
                padding: "0 18px",
                borderRadius: 22,
                background: isVideoOn ? "#0284c7" : "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <VideoCameraOutlined style={{ fontSize: 16 }} />
              <span>{isVideoOn ? "Video Off" : "Video On"}</span>
            </button>

            <button
              onClick={toggleScreenShare}
              style={{
                height: 44,
                padding: "0 18px",
                borderRadius: 22,
                background: isScreenSharing ? "#10b981" : "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <DesktopOutlined style={{ fontSize: 16 }} />
              <span>{isScreenSharing ? "Stop Sharing" : "Share Screen"}</span>
            </button>

            <button
              onClick={handleEndCall}
              style={{
                height: 44,
                padding: "0 22px",
                borderRadius: 22,
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                border: "none",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13.5,
                fontWeight: 800,
                boxShadow: "0 4px 20px rgba(239, 68, 68, 0.5)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <PhoneOutlined style={{ fontSize: 16, transform: "rotate(135deg)" }} />
              <span>End Call</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── NORMAL RIGHT FLOATING ENTERPRISE WIDGET MODE ──
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        position: "fixed",
        top: 76,
        right: 20,
        zIndex: 9999,
        width: 340,
        maxHeight: "calc(100vh - 90px)",
        borderRadius: 20,
        background: "#0c1322",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        animation: "fadeInUp 0.2s ease-out",
      }}
    >
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      {/* ── TOP HEADER BAR ── */}
      <div
        style={{
          background: "linear-gradient(90deg, #134e5e 0%, #1b6270 100%)",
          color: "#ffffff",
          padding: "10px 14px",
          fontWeight: 800,
          fontSize: 12.5,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span>
          {effectiveIsAccepted ? "ACTIVE CALL:" : "CALLING:"} {participantName.toUpperCase()}{" "}
          {effectiveIsAccepted ? `[${formatDuration(seconds)}]` : "(Ringing...)"}
        </span>
      </div>

      {/* ── CARD BODY ── */}
      <div
        style={{
          padding: "14px 16px 18px 16px",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Profile Picture / Video Area (Compact & 16:9 proportional) */}
        <div
          style={{
            width: "100%",
            height: 160,
            borderRadius: 16,
            overflow: "hidden",
            background: "#030712",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 18px rgba(0, 0, 0, 0.4)",
            flexShrink: 0,
          }}
        >
          {isMediaActive ? (
            <div style={{ width: "100%", height: "100%", position: "relative" }}>
              <video
                ref={mainVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: isScreenSharing || isShowingRemote ? "none" : "scaleX(-1)",
                  background: "#000000",
                }}
              />
              {/* PiP Local Camera Preview in Compact Mode */}
              {isShowingRemote && (isVideoOn || localStreamRef.current) && (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 58,
                    height: 78,
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1.5px solid rgba(255, 255, 255, 0.4)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
                    background: "#0f172a",
                    zIndex: 5,
                  }}
                >
                  <video
                    ref={pipCompactVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: "scaleX(-1)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 2,
                      left: 3,
                      fontSize: 8,
                      fontWeight: 700,
                      color: "#ffffff",
                      background: "rgba(0, 0, 0, 0.6)",
                      padding: "1px 4px",
                      borderRadius: 4,
                    }}
                  >
                    You
                  </div>
                </div>
              )}

              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  background: "rgba(0, 0, 0, 0.65)",
                  backdropFilter: "blur(8px)",
                  padding: "3px 8px",
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#ffffff",
                  zIndex: 2,
                }}
              >
                {isScreenSharing ? "🖥️ Sharing Screen" : isShowingRemote ? `👤 ${participantName}` : "👤 HD Camera"}
              </div>

              {/* Fullscreen Button */}
              <button
                onClick={() => setIsFullscreen(true)}
                title="Full Screen"
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  background: "rgba(0, 0, 0, 0.65)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  borderRadius: 8,
                  width: 26,
                  height: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                  zIndex: 10,
                  transition: "all 0.15s ease",
                }}
              >
                <FullscreenOutlined />
              </button>
            </div>
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={participantName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(145deg, #1e3a8a 0%, #172554 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "2px solid rgba(255, 255, 255, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                {participantName.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Name and Type Metadata */}
        <div style={{ textAlign: "center", marginTop: 10, flexShrink: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.3px" }}>
              {participantName}
            </span>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#475569",
                color: "#ffffff",
                fontSize: 10.5,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {participantName.charAt(0).toUpperCase()}
            </span>
          </div>

          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: 500 }}>
            Enterprise {type === "VIDEO" || isMediaActive ? "HD Video Call" : "Voice Call"}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
            Audio: High Definition (G.722)
          </div>
        </div>

        {/* ── IN-CALL INFORMATION SECTION ── */}
        <div style={{ marginTop: 14, textAlign: "left", flexShrink: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#e2e8f0",
              marginBottom: 6,
              letterSpacing: "0.2px",
            }}
          >
            In-Call Information
          </div>

          {/* Metric 1: Audio Quality */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "2px 0",
              color: "#cbd5e1",
              fontSize: 11.5,
            }}
          >
            <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 12, width: 14 }}>
              <span style={{ width: 2.5, height: "40%", background: "#22c55e", borderRadius: 1 }} />
              <span style={{ width: 2.5, height: "65%", background: "#22c55e", borderRadius: 1 }} />
              <span style={{ width: 2.5, height: "85%", background: "#22c55e", borderRadius: 1 }} />
              <span style={{ width: 2.5, height: "100%", background: "#22c55e", borderRadius: 1 }} />
            </span>
            <span style={{ color: "#e2e8f0", fontWeight: 500 }}>Audio Quality</span>
          </div>

          {/* Metric 2: Security */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "2px 0",
              color: "#cbd5e1",
              fontSize: 11.5,
            }}
          >
            <LockOutlined style={{ color: "#94a3b8", fontSize: 12 }} />
            <span>Security: End-to-End Encrypted</span>
          </div>

          {/* Metric 3: Bandwidth */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "2px 0",
              color: "#cbd5e1",
              fontSize: 11.5,
            }}
          >
            <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>((•))</span>
            <span>Bandwidth: Good</span>
          </div>
        </div>

        {/* ── 2x2 ACTION BUTTON GRID ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 14,
            flexShrink: 0,
          }}
        >
          {/* Mute Mic */}
          <button
            onClick={toggleMute}
            style={{
              height: 38,
              borderRadius: 19,
              background: isMuted ? "#ef4444" : "rgba(255, 255, 255, 0.09)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {isMuted ? (
              <AudioMutedOutlined style={{ fontSize: 13 }} />
            ) : (
              <AudioOutlined style={{ fontSize: 13 }} />
            )}
            <span>{isMuted ? "Unmute" : "Mute Mic"}</span>
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            style={{
              height: 38,
              borderRadius: 19,
              background: isVideoOn ? "#0284c7" : "rgba(255, 255, 255, 0.09)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <VideoCameraOutlined style={{ fontSize: 13 }} />
            <span>{isVideoOn ? "Video Off" : "Video On"}</span>
          </button>

          {/* Share Screen */}
          <button
            onClick={toggleScreenShare}
            style={{
              height: 38,
              borderRadius: 19,
              background: isScreenSharing ? "#10b981" : "rgba(255, 255, 255, 0.09)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <DesktopOutlined style={{ fontSize: 13 }} />
            <span>{isScreenSharing ? "Stop" : "Share"}</span>
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            style={{
              height: 38,
              borderRadius: 19,
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              border: "none",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(239, 68, 68, 0.45)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <PhoneOutlined style={{ fontSize: 13, transform: "rotate(135deg)" }} />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallOverlayModal;
