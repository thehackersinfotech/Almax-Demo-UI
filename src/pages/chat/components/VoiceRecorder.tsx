import React, { useState, useRef, useEffect } from "react";
import { Button, Tooltip, Typography, message as toast } from "antd";
import {
  DeleteOutlined,
  SendOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
} from "@ant-design/icons";

const { Text } = Typography;

interface VoiceRecorderProps {
  onFinishRecording?: (audioBlob: Blob, durationSeconds: number) => void;
  onSendVoiceNote?: (audioBlob: Blob, durationSeconds: number) => void;
  onCancelRecording?: () => void;
  onCancel?: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onFinishRecording,
  onSendVoiceNote,
  onCancelRecording,
  onCancel,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [waveLevels, setWaveLevels] = useState<number[]>(new Array(32).fill(4));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const accumulatedMsRef = useRef<number>(0);
  const lastResumeTimeRef = useRef<number>(0);
  const isFinishedRef = useRef(false);

  const callbacksRef = useRef({
    onFinishRecording,
    onSendVoiceNote,
    onCancelRecording,
    onCancel,
  });

  useEffect(() => {
    callbacksRef.current = {
      onFinishRecording,
      onSendVoiceNote,
      onCancelRecording,
      onCancel,
    };
  });

  const handleCancel = () => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.ondataavailable = null;
      if (mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      try {
        audioCtxRef.current.close();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    if (callbacksRef.current.onCancelRecording) callbacksRef.current.onCancelRecording();
    else if (callbacksRef.current.onCancel) callbacksRef.current.onCancel();
  };

  const handleSendCallback = (blob: Blob, duration: number) => {
    if (callbacksRef.current.onFinishRecording) callbacksRef.current.onFinishRecording(blob, duration);
    else if (callbacksRef.current.onSendVoiceNote) callbacksRef.current.onSendVoiceNote(blob, duration);
  };

  // Initialize Microphone on mount with 0ms delay
  useEffect(() => {
    let mounted = true;
    isFinishedRef.current = false;

    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (!mounted || isFinishedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Set up Web Audio API for sound wave visualization
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          try {
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.75;
            source.connect(analyser);
            analyserRef.current = analyser;
          } catch {}
        }

        // Setup MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start(100);
        setIsRecording(true);
        setIsPaused(false);
        lastResumeTimeRef.current = Date.now();
        accumulatedMsRef.current = 0;

        // Timer interval
        timerRef.current = setInterval(() => {
          if (lastResumeTimeRef.current > 0) {
            const currentRun = Date.now() - lastResumeTimeRef.current;
            const totalSecs = Math.floor((accumulatedMsRef.current + currentRun) / 1000);
            setSeconds(totalSecs);
          }
        }, 150);

        // Waveform visualizer loop
        const dataArray = new Uint8Array(32);
        const updateWaveform = () => {
          if (!mounted) return;
          if (analyserRef.current && mediaRecorderRef.current?.state === "recording") {
            analyserRef.current.getByteFrequencyData(dataArray);
            const numBars = 32;
            const step = Math.max(1, Math.floor(dataArray.length / numBars));
            const newLevels = Array.from({ length: numBars }).map((_, i) => {
              const val = dataArray[i * step] || 0;
              const scaled = Math.max(4, Math.min(28, (val / 255) * 28));
              return Math.round(scaled);
            });
            setWaveLevels(newLevels);
          }
          animFrameRef.current = requestAnimationFrame(updateWaveform);
        };

        animFrameRef.current = requestAnimationFrame(updateWaveform);
      } catch (err) {
        toast.error("Microphone access is required to record voice notes.");
        handleCancel();
      }
    };

    initAudio();

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.ondataavailable = null;
        if (mediaRecorderRef.current.state !== "inactive") {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        try {
          audioCtxRef.current.close();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Pause / Resume Logic
  const handleTogglePause = () => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      accumulatedMsRef.current += Date.now() - lastResumeTimeRef.current;
      lastResumeTimeRef.current = 0;
      setIsPaused(true);
      setWaveLevels(new Array(32).fill(4));
    } else if (mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      lastResumeTimeRef.current = Date.now();
      setIsPaused(false);
    }
  };

  const handleFinishAndSend = () => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const totalDuration = Math.max(
      1,
      Math.floor(
        (accumulatedMsRef.current +
          (lastResumeTimeRef.current > 0 ? Date.now() - lastResumeTimeRef.current : 0)) /
          1000
      )
    );

    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") {
      const mimeType = mr?.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      if (blob.size > 0) {
        handleSendCallback(blob, totalDuration);
      } else {
        handleCancel();
      }
      return;
    }

    // Flush any pending data from the recorder buffer before stopping
    try {
      if (mr.state === "recording") {
        mr.requestData();
      }
    } catch {}

    mr.onstop = () => {
      if (mr) mr.onstop = null;
      const mimeType = mr?.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      if (blob.size > 0) {
        handleSendCallback(blob, totalDuration);
      } else {
        toast.warning("Recording was empty.");
        handleCancel();
      }
    };

    try {
      mr.stop();
    } catch {}
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "8px 14px",
        background: "var(--bms-surface, #ffffff)",
        border: "1px solid var(--bms-border, rgba(0, 0, 0, 0.12))",
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        gap: 12,
      }}
    >
      {/* Left: Recording Status Badge & Timer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 6,
            background: isPaused
              ? "rgba(250, 140, 22, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${isPaused ? "rgba(250, 140, 22, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isPaused ? "#fa8c16" : "#ef4444",
              display: "inline-block",
              boxShadow: isPaused ? "none" : "0 0 6px rgba(239, 68, 68, 0.8)",
            }}
          />
          <Text
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: isPaused ? "#fa8c16" : "#ef4444",
              textTransform: "uppercase",
            }}
          >
            {isPaused ? "Paused" : "Rec"}
          </Text>
        </div>

        <Text
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--bms-text, #1e293b)",
            minWidth: 42,
          }}
        >
          {formatTimer(seconds)}
        </Text>
      </div>

      {/* Middle: Real-Time Dynamic Sound Waveform */}
      <div
        style={{
          flex: 1,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          padding: "0 8px",
          overflow: "hidden",
        }}
      >
        {waveLevels.map((lvl, idx) => (
          <div
            key={idx}
            style={{
              width: 3,
              height: lvl,
              borderRadius: 3,
              background: isPaused
                ? "var(--bms-border, #cbd5e1)"
                : "var(--bms-primary, #1677ff)",
              transition: "height 0.08s ease",
            }}
          />
        ))}
      </div>

      {/* Right: Audio Action Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {/* Delete / Cancel Button */}
        <Tooltip title="Discard Recording">
          <Button
            type="text"
            shape="circle"
            size="middle"
            icon={<DeleteOutlined style={{ fontSize: 16, color: "#94a3b8" }} />}
            onClick={handleCancel}
          />
        </Tooltip>

        {/* Pause / Resume Button */}
        <Tooltip title={isPaused ? "Continue Recording" : "Pause Recording"}>
          <Button
            type="text"
            shape="circle"
            size="middle"
            icon={
              isPaused ? (
                <PlayCircleFilled style={{ fontSize: 22, color: "var(--bms-primary, #1677ff)" }} />
              ) : (
                <PauseCircleFilled style={{ fontSize: 22, color: "#fa8c16" }} />
              )
            }
            onClick={handleTogglePause}
          />
        </Tooltip>

        {/* Send Button */}
        <Button
          type="primary"
          shape="round"
          size="middle"
          icon={<SendOutlined style={{ fontSize: 13 }} />}
          onClick={handleFinishAndSend}
          style={{
            fontWeight: 600,
            background: "var(--bms-primary, #1677ff)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
};

export default VoiceRecorder;
