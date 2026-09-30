import React, { useState, useRef, useEffect } from "react";
import { Button, Slider, Tooltip } from "antd";
import { PlayCircleFilled, PauseCircleFilled, AudioOutlined } from "@ant-design/icons";

interface AudioPlayerProps {
  src?: string;
  audioUrl?: string;
  duration?: number;
  durationText?: string;
  senderName?: string;
  isSentByMe?: boolean;
  isMine?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  audioUrl,
  duration: propDuration = 0,
  durationText,
  senderName,
  isSentByMe,
  isMine,
}) => {
  const audioSource = src || audioUrl || "";
  const isOutgoing = isMine ?? isSentByMe ?? false;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  useEffect(() => {
    if (propDuration && propDuration > 0) {
      setDuration(propDuration);
    }
  }, [propDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioSource]);

  const togglePlay = () => {
    if (!audioRef.current || !audioSource) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn("Audio play error", err));
    }
  };

  const handleSliderChange = (val: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleRate = () => {
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 12,
        background: isOutgoing
          ? "rgba(22, 119, 255, 0.08)"
          : "var(--bms-surface, #ffffff)",
        border: "1px solid var(--bms-border, rgba(0, 0, 0, 0.1))",
        minWidth: 260,
        maxWidth: 340,
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.03)",
      }}
    >
      <audio ref={audioRef} src={audioSource} preload="auto" />

      {/* Play/Pause Button */}
      <Tooltip title={isPlaying ? "Pause" : "Play Voice Note"}>
        <Button
          type="text"
          shape="circle"
          icon={
            isPlaying ? (
              <PauseCircleFilled style={{ fontSize: 32, color: "var(--bms-primary, #1677ff)" }} />
            ) : (
              <PlayCircleFilled style={{ fontSize: 32, color: "var(--bms-primary, #1677ff)" }} />
            )
          }
          onClick={togglePlay}
          style={{ padding: 0, width: 34, height: 34, flexShrink: 0 }}
        />
      </Tooltip>

      {/* Track info & Seek Slider */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: "var(--bms-text, #1e293b)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <AudioOutlined style={{ color: "var(--bms-primary)" }} /> Voice Message
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              color: "var(--bms-text-3, #94a3b8)",
              fontWeight: 500,
            }}
          >
            {formatTime(currentTime)} / {formatTime(duration || propDuration || 0)}
          </span>
        </div>

        <Slider
          min={0}
          max={duration || propDuration || 10}
          value={currentTime}
          onChange={handleSliderChange}
          tooltip={{ open: false }}
          style={{ margin: "4px 0" }}
        />
      </div>

      {/* Speed Multiplier Button */}
      <Tooltip title="Playback Speed">
        <Button
          size="small"
          type="text"
          onClick={toggleRate}
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            borderRadius: 8,
            padding: "0 6px",
            height: 22,
            background: "rgba(0, 0, 0, 0.05)",
            color: "var(--bms-text, #334155)",
            flexShrink: 0,
          }}
        >
          {playbackRate}x
        </Button>
      </Tooltip>
    </div>
  );
};

export default AudioPlayer;
