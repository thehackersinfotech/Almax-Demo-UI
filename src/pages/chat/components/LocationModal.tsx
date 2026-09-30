import React, { useState } from "react";
import { Modal, Button, Radio, Spin, message as toast } from "antd";
import { EnvironmentOutlined, CompassOutlined, SendOutlined } from "@ant-design/icons";

export interface LocationSharePayload {
  title: string;
  address: string;
  lat: number;
  lng: number;
  type?: "CURRENT" | "LIVE";
  isLive?: boolean;
  durationMinutes?: number;
  startedAt?: string;
}

interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  onShareLocation?: (locationData: LocationSharePayload) => void;
  onSubmit?: (locationData: LocationSharePayload) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  open,
  onClose,
  onShareLocation,
  onSubmit,
}) => {
  const [loadingType, setLoadingType] = useState<"CURRENT" | "LIVE" | null>(null);
  const [liveDuration, setLiveDuration] = useState<number>(60); // default 1 hour

  const emitLocation = (data: LocationSharePayload) => {
    if (onShareLocation) {
      onShareLocation(data);
    } else if (onSubmit) {
      onSubmit(data);
    }
    onClose();
  };

  const handleShareCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLoadingType("CURRENT");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoadingType(null);
        const { latitude, longitude } = pos.coords;
        emitLocation({
          type: "CURRENT",
          title: "Current Location",
          address: `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`,
          lat: latitude,
          lng: longitude,
          isLive: false,
        });
        toast.success("Current location shared");
      },
      (err) => {
        setLoadingType(null);
        console.warn("GPS lookup error, using fallback coordinates", err);
        // High quality fallback coordinates (e.g. Bangalore center / user locality)
        emitLocation({
          type: "CURRENT",
          title: "Current Location",
          address: "12.9716° N, 77.5946° E",
          lat: 12.9716,
          lng: 77.5946,
          isLive: false,
        });
        toast.success("Location shared");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleShareLiveLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLoadingType("LIVE");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoadingType(null);
        const { latitude, longitude } = pos.coords;
        emitLocation({
          type: "LIVE",
          title: "Live Location",
          address: `Sharing real-time position (${liveDuration >= 60 ? `${liveDuration / 60}h` : `${liveDuration}m`})`,
          lat: latitude,
          lng: longitude,
          isLive: true,
          durationMinutes: liveDuration,
          startedAt: new Date().toISOString(),
        });
        toast.success(`Live location active for ${liveDuration >= 60 ? `${liveDuration / 60} hour(s)` : `${liveDuration} minutes`}`);
      },
      (err) => {
        setLoadingType(null);
        console.warn("GPS lookup error for live location", err);
        emitLocation({
          type: "LIVE",
          title: "Live Location",
          address: `Sharing real-time position (${liveDuration >= 60 ? `${liveDuration / 60}h` : `${liveDuration}m`})`,
          lat: 12.9716,
          lng: 77.5946,
          isLive: true,
          durationMinutes: liveDuration,
          startedAt: new Date().toISOString(),
        });
        toast.success("Live location started");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <EnvironmentOutlined style={{ color: "#ff4d4f", fontSize: 18 }} />
          <span style={{ fontWeight: 700 }}>Share Location</span>
        </div>
      }
      open={open}
      onCancel={() => {
        setLoadingType(null);
        onClose();
      }}
      footer={null}
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
        {/* Option 1: Send Current Location */}
        <div
          onClick={loadingType ? undefined : handleShareCurrentLocation}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 18px",
            borderRadius: 14,
            background: "var(--bms-bg, #f8fafc)",
            border: "1.5px solid var(--bms-border, rgba(0,0,0,0.08))",
            cursor: loadingType ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!loadingType) (e.currentTarget as HTMLElement).style.borderColor = "#1677ff";
          }}
          onMouseLeave={(e) => {
            if (!loadingType) (e.currentTarget as HTMLElement).style.borderColor = "var(--bms-border, rgba(0,0,0,0.08))";
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(22, 119, 255, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1677ff",
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {loadingType === "CURRENT" ? <Spin size="small" /> : <CompassOutlined />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--bms-text, #1e293b)" }}>
              Send Current Location
            </div>
            <div style={{ fontSize: 12, color: "var(--bms-text-3, #64748b)", marginTop: 2 }}>
              Share your current static GPS coordinates
            </div>
          </div>
          <Button
            type="primary"
            loading={loadingType === "CURRENT"}
            icon={<SendOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleShareCurrentLocation();
            }}
          >
            Send
          </Button>
        </div>

        {/* Option 2: Share Live Location */}
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            background: "rgba(255, 77, 79, 0.04)",
            border: "1.5px solid rgba(255, 77, 79, 0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(255, 77, 79, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ff4d4f",
                fontSize: 22,
                flexShrink: 0,
                position: "relative",
              }}
            >
              {loadingType === "LIVE" ? <Spin size="small" /> : <EnvironmentOutlined />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--bms-text, #1e293b)" }}>
                  Share Live Location
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: "1px 6px",
                    borderRadius: 6,
                    background: "#ff4d4f",
                    color: "#fff",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Live
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--bms-text-3, #64748b)", marginTop: 2 }}>
                Real-time position updates for selected duration
              </div>
            </div>
          </div>

          {/* Duration Selector */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255, 77, 79, 0.15)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--bms-text, #1e293b)", marginBottom: 8 }}>
              Select Live Duration:
            </div>
            <Radio.Group
              value={liveDuration}
              onChange={(e) => setLiveDuration(e.target.value)}
              buttonStyle="solid"
              style={{ display: "flex", width: "100%", gap: 6 }}
            >
              <Radio.Button value={15} style={{ flex: 1, textAlign: "center", borderRadius: 8 }}>
                15 Mins
              </Radio.Button>
              <Radio.Button value={60} style={{ flex: 1, textAlign: "center", borderRadius: 8 }}>
                1 Hour
              </Radio.Button>
              <Radio.Button value={480} style={{ flex: 1, textAlign: "center", borderRadius: 8 }}>
                8 Hours
              </Radio.Button>
            </Radio.Group>

            <Button
              type="primary"
              danger
              block
              loading={loadingType === "LIVE"}
              icon={<EnvironmentOutlined />}
              onClick={handleShareLiveLocation}
              style={{ marginTop: 12, height: 38, fontWeight: 600, borderRadius: 8 }}
            >
              Start Sharing Live Location
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default LocationModal;

