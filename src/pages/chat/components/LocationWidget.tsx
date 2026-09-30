import React from "react";
import { EnvironmentOutlined, CompassOutlined, GlobalOutlined, ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export interface LocationData {
  title: string;
  address: string;
  lat: number;
  lng: number;
  type?: "CURRENT" | "LIVE";
  isLive?: boolean;
  durationMinutes?: number;
  startedAt?: string;
}

interface LocationWidgetProps {
  location?: LocationData;
  locationData?: LocationData;
  isSentByMe?: boolean;
}

export const LocationWidget: React.FC<LocationWidgetProps> = ({
  location,
  locationData,
  isSentByMe = false,
}) => {
  const loc: LocationData | null = location || locationData || null;

  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    return null;
  }

  const isLive = Boolean(loc.isLive || loc.type === "LIVE");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;

  let liveExpiryText = "";
  if (isLive && loc.startedAt && loc.durationMinutes) {
    const expiresAt = dayjs(loc.startedAt).add(loc.durationMinutes, "minute");
    if (dayjs().isAfter(expiresAt)) {
      liveExpiryText = "Live location ended";
    } else {
      liveExpiryText = `Live until ${expiresAt.format("h:mm A")}`;
    }
  }

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--bms-surface, #ffffff)",
        border: `1.5px solid ${
          isLive ? "rgba(255, 77, 79, 0.4)" : "var(--bms-border, rgba(0, 0, 0, 0.12))"
        }`,
        boxShadow: "0 2px 10px rgba(0, 0, 0, 0.06)",
        width: 280,
      }}
    >
      <style>{`
        @keyframes liveRadarPulse {
          0% { transform: scale(0.95); opacity: 0.9; }
          50% { transform: scale(1.2); opacity: 0.35; }
          100% { transform: scale(0.95); opacity: 0.9; }
        }
      `}</style>

      {/* Map Header Preview */}
      <div
        style={{
          height: 110,
          background: isLive
            ? "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)"
            : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          position: "relative",
          userSelect: "none",
        }}
      >
        {/* Radar Icon */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isLive && (
            <div
              style={{
                position: "absolute",
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(255, 77, 79, 0.45)",
                animation: "liveRadarPulse 2s ease-in-out infinite",
              }}
            />
          )}
          {isLive ? (
            <EnvironmentOutlined style={{ fontSize: 34, color: "#ff4d4f", position: "relative", zIndex: 1 }} />
          ) : (
            <CompassOutlined style={{ fontSize: 34, color: "#38bdf8", position: "relative", zIndex: 1 }} />
          )}
        </div>

        {/* Top Badges */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {isLive ? (
            <span
              style={{
                fontSize: 10.5,
                background: "#ff4d4f",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: 10,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#fff",
                  display: "inline-block",
                }}
              />
              Live Location
            </span>
          ) : (
            <span
              style={{
                fontSize: 10.5,
                background: "rgba(0, 0, 0, 0.55)",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              Current Location
            </span>
          )}
        </div>

        {/* Coordinates snippet */}
        <span
          style={{
            position: "absolute",
            bottom: 6,
            right: 8,
            fontSize: 10.5,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "2px 6px",
            borderRadius: 4,
            fontFamily: "monospace",
          }}
        >
          {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
        </span>
      </div>

      {/* Body Info */}
      <div style={{ padding: "14px 16px" }}>
        <h4
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--bms-text, #0f172a)",
          }}
        >
          {loc.title || (isLive ? "Live Location" : "Current Location")}
        </h4>
        <p
          style={{
            margin: "4px 0 0 0",
            fontSize: 12,
            color: "var(--bms-text-3, #475569)",
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          {loc.address}
        </p>

        {liveExpiryText && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11.5,
              color: "#ff4d4f",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <ClockCircleOutlined /> {liveExpiryText}
          </div>
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#1677ff",
            color: "#ffffff",
            fontSize: 12.5,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            textDecoration: "none",
            boxShadow: "0 2px 6px rgba(22, 119, 255, 0.3)",
            transition: "all 0.15s ease",
          }}
        >
          <GlobalOutlined style={{ fontSize: 14 }} /> Open in Google Maps
        </a>
      </div>
    </div>
  );
};

export default LocationWidget;

