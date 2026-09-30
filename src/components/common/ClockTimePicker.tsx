import { useState, useEffect, useRef, useMemo } from "react";
import { Popover, Button, Space } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface ClockTimePickerProps {
  value?: dayjs.Dayjs | null;
  onChange?: (value: dayjs.Dayjs | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ClockTimePicker({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
}: ClockTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<"hour" | "minute">("hour");

  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");

  const clockFaceRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize time state from value prop when popover opens or value changes
  useEffect(() => {
    if (value && value.isValid()) {
      let h = value.hour();
      const m = value.minute();
      const ampmVal = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      setHour(h);
      setMinute(m);
      setAmpm(ampmVal);
    } else {
      // Default to current time, but clear minutes to 5-min increments
      const now = dayjs();
      let h = now.hour();
      const m = Math.round(now.minute() / 5) * 5 % 60;
      const ampmVal = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      setHour(h);
      setMinute(m);
      setAmpm(ampmVal);
    }
  }, [value, open]);

  // Convert current state to dayjs and notify parent
  const handleSave = () => {
    let finalHour = hour % 12;
    if (ampm === "PM") {
      finalHour += 12;
    }
    const finalDate = (value && value.isValid() ? value : dayjs())
      .hour(finalHour)
      .minute(minute)
      .second(0)
      .millisecond(0);
    onChange?.(finalDate);
    setOpen(false);
  };

  const handleClear = () => {
    onChange?.(null);
    setOpen(false);
  };

  // Helper to compute time value from angle
  const updateTimeFromCoordinates = (clientX: number, clientY: number) => {
    if (!clockFaceRef.current) return;
    const rect = clockFaceRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    // Angle relative to 12 o'clock (top)
    let angleRad = Math.atan2(dy, dx);
    let angleDeg = (angleRad * 180) / Math.PI + 90;
    if (angleDeg < 0) angleDeg += 360;

    if (activeMode === "hour") {
      let h = Math.round(angleDeg / 30);
      if (h === 0) h = 12;
      setHour(h);
    } else {
      const m = Math.round(angleDeg / 6) % 60;
      setMinute(m);
    }
  };

  // Event handlers for dragging the clock needle
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    updateTimeFromCoordinates(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateTimeFromCoordinates(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // Auto-switch to minutes mode after selecting hour
      if (activeMode === "hour") {
        setTimeout(() => setActiveMode("minute"), 200);
      }
    }
  };

  // Mobile touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    if (e.touches[0]) {
      updateTimeFromCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (e.touches[0]) {
      updateTimeFromCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Listen to mouseup globally to stop dragging if user releases mouse outside clock face
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (activeMode === "hour") {
          setTimeout(() => setActiveMode("minute"), 200);
        }
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging, activeMode]);

  // Compute positions of clock numbers
  const clockNumbers = useMemo(() => {
    const r = 70; // radius of number centers
    const items = [];
    if (activeMode === "hour") {
      for (let i = 1; i <= 12; i++) {
        const angle = (i * 30 * Math.PI) / 180;
        const x = 100 + r * Math.sin(angle);
        const y = 100 - r * Math.cos(angle);
        items.push({ value: i, label: String(i), x, y });
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const val = i * 5;
        const angle = (val * 6 * Math.PI) / 180;
        const x = 100 + r * Math.sin(angle);
        const y = 100 - r * Math.cos(angle);
        items.push({ value: val, label: val === 0 ? "00" : String(val), x, y });
      }
    }
    return items;
  }, [activeMode]);

  // Selected angle for dial hand
  const currentAngle = useMemo(() => {
    if (activeMode === "hour") {
      return hour * 30;
    } else {
      return minute * 6;
    }
  }, [activeMode, hour, minute]);

  const displayString = value && value.isValid() ? value.format("h:mm A") : "";

  const popoverContent = (
    <div style={{ width: 240, padding: 4, userSelect: "none", fontFamily: "inherit" }}>
      {/* Time display header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "var(--bms-surface-2, #F8FAFC)",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          {/* Hour display */}
          <span
            onClick={() => setActiveMode("hour")}
            style={{
              fontSize: 28,
              fontWeight: 700,
              cursor: "pointer",
              color: activeMode === "hour" ? "var(--bms-primary, #4F6EF7)" : "var(--bms-text-3, #94A3B8)",
              transition: "color 0.2s",
            }}
          >
            {hour}
          </span>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--bms-text-3, #94A3B8)" }}>:</span>
          {/* Minute display */}
          <span
            onClick={() => setActiveMode("minute")}
            style={{
              fontSize: 28,
              fontWeight: 700,
              cursor: "pointer",
              color: activeMode === "minute" ? "var(--bms-primary, #4F6EF7)" : "var(--bms-text-3, #94A3B8)",
              transition: "color 0.2s",
            }}
          >
            {minute < 10 ? `0${minute}` : minute}
          </span>
        </div>

        {/* AM/PM toggle buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            onClick={() => setAmpm("AM")}
            style={{
              border: "none",
              background: ampm === "AM" ? "var(--bms-primary, #4F6EF7)" : "transparent",
              color: ampm === "AM" ? "#fff" : "var(--bms-text-2, #475569)",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => setAmpm("PM")}
            style={{
              border: "none",
              background: ampm === "PM" ? "var(--bms-primary, #4F6EF7)" : "transparent",
              color: ampm === "PM" ? "#fff" : "var(--bms-text-2, #475569)",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            PM
          </button>
        </div>
      </div>

      {/* Clock Face Circle */}
      <div
        ref={clockFaceRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        style={{
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "var(--bms-board-column, var(--bms-surface-2, #EEF2F6))",
          margin: "0 auto 16px",
          position: "relative",
          cursor: "pointer",
          touchAction: "none",
        }}
      >
        {/* Central Pivot Dot */}
        <div
          style={{
            position: "absolute",
            left: 97,
            top: 97,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--bms-primary, #4F6EF7)",
            zIndex: 3,
          }}
        />

        {/* Dial Hand Line */}
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 100,
            width: 2,
            height: 70,
            background: "var(--bms-primary, #4F6EF7)",
            transformOrigin: "top center",
            transform: `rotate(${currentAngle + 180}deg)`,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* Outer selected tip circle */}
        <div
          style={{
            position: "absolute",
            left: 100 + 70 * Math.sin((currentAngle * Math.PI) / 180) - 15,
            top: 100 - 70 * Math.cos((currentAngle * Math.PI) / 180) - 15,
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "var(--bms-primary-light, rgba(79, 110, 247, 0.25))",
            border: "2px solid var(--bms-primary, #4F6EF7)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* Clock Numbers */}
        {clockNumbers.map((num) => {
          const isSelected =
            activeMode === "hour"
              ? hour === num.value
              : minute === num.value;
          return (
            <div
              key={num.value}
              style={{
                position: "absolute",
                left: num.x - 12,
                top: num.y - 12,
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: isSelected ? 800 : 500,
                color: isSelected ? "var(--bms-primary, #4F6EF7)" : "var(--bms-text, #1E293B)",
                zIndex: 2,
                pointerEvents: "none",
                transition: "color 0.15s, font-weight 0.15s",
              }}
            >
              {num.label}
            </div>
          );
        })}
      </div>

      {/* Popover Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <Button size="small" onClick={handleClear} danger type="text">
          Clear
        </Button>
        <Space size={6}>
          <Button size="small" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="small" type="primary" onClick={handleSave}>
            OK
          </Button>
        </Space>
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={(v) => !disabled && setOpen(v)}
      placement="bottomLeft"
      overlayClassName="clock-time-picker-popover"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          border: "1px solid var(--bms-border, #CBD5E1)",
          borderRadius: 8,
          background: disabled ? "var(--bms-surface-2, #F8FAFC)" : "var(--bms-surface, #fff)",
          color: displayString ? "var(--bms-text, #1E293B)" : "var(--bms-text-3, #94A3B8)",
          cursor: disabled ? "not-allowed" : "pointer",
          minHeight: 38,
          fontSize: 14,
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        <span>{displayString || placeholder}</span>
        <ClockCircleOutlined style={{ color: "var(--bms-text-3, #94A3B8)", fontSize: 14 }} />
      </div>
    </Popover>
  );
}

export default ClockTimePicker;
