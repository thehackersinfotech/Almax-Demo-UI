import React, { useState, useRef, useEffect, useCallback } from "react";
import { Modal, Button, Spin, Alert } from "antd";
import { CameraOutlined, RedoOutlined, SendOutlined, CloseOutlined, ReloadOutlined } from "@ant-design/icons";

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapturePhoto: (file: File) => void;
  onCapture?: (file: File) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  open,
  onClose,
  onCapturePhoto,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      setIsLoadingCamera(true);
      setCameraError(null);
      setCapturedImage(null);

      // Try preferred constraints first, fall back to basic video
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);
      setIsLoadingCamera(false);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((e) => console.warn("Video play error", e));
      }
    } catch (err: any) {
      setIsLoadingCamera(false);
      console.warn("Camera access failed", err);
      setCameraError(
        "Camera access was denied or no camera device was found. Please enable camera permission in your browser."
      );
    }
  };

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [open]);

  // Synchronize stream with video element whenever stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const bindVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  };

  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Mirror horizontally to match preview
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleSendPhoto = () => {
    if (canvasRef.current && capturedImage) {
      canvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `camera_photo_${Date.now()}.jpg`, { type: "image/jpeg" });
            if (onCapturePhoto) onCapturePhoto(file);
            if (onCapture) onCapture(file);
            onClose();
          }
        },
        "image/jpeg",
        0.92
      );
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CameraOutlined style={{ color: "#1677ff", fontSize: 17 }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Take Photo</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={500}
      styles={{
        body: {
          padding: "10px 16px 16px 16px",
          overflow: "hidden",
          maxHeight: "82vh",
        },
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {/* Camera Viewport Container (Fixed compact height, no scrolling) */}
        <div
          style={{
            width: "100%",
            height: 280,
            background: "#0f172a",
            borderRadius: 12,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
          }}
        >
          {isLoadingCamera && (
            <div
              style={{
                position: "absolute",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                color: "#fff",
              }}
            >
              <Spin size="large" />
              <span style={{ fontSize: 13, opacity: 0.85 }}>Connecting camera...</span>
            </div>
          )}

          {cameraError && !isLoadingCamera && (
            <div style={{ padding: 20, textAlign: "center", zIndex: 2 }}>
              <CameraOutlined style={{ fontSize: 36, color: "#94a3b8", marginBottom: 10, display: "block" }} />
              <Alert
                message="Camera Unavailable"
                description={cameraError}
                type="warning"
                showIcon
                style={{ textAlign: "left", fontSize: 12 }}
              />
              <Button icon={<ReloadOutlined />} onClick={startCamera} style={{ marginTop: 12 }} size="small">
                Retry Access
              </Button>
            </div>
          )}

          {/* Always-mounted video element to prevent ref detachment */}
          <video
            ref={bindVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)", // Mirror effect
              display: capturedImage || cameraError ? "none" : "block",
            }}
          />

          {capturedImage && (
            <img
              src={capturedImage}
              alt="Snapshot"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}

          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {/* Action Controls Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", marginTop: 4 }}>
          {!capturedImage ? (
            <>
              <Button size="middle" icon={<CloseOutlined />} onClick={onClose} style={{ borderRadius: 8 }}>
                Cancel
              </Button>
              <Button
                type="primary"
                size="middle"
                icon={<CameraOutlined />}
                disabled={Boolean(cameraError) || isLoadingCamera}
                onClick={takeSnapshot}
                style={{
                  height: 38,
                  padding: "0 22px",
                  fontWeight: 700,
                  borderRadius: 8,
                  background: "#1677ff",
                  boxShadow: "0 2px 8px rgba(22, 119, 255, 0.35)",
                }}
              >
                Capture Photo
              </Button>
            </>
          ) : (
            <>
              <Button
                size="middle"
                icon={<RedoOutlined />}
                onClick={() => {
                  setCapturedImage(null);
                  startCamera();
                }}
                style={{ borderRadius: 8, height: 38 }}
              >
                Retake
              </Button>
              <Button
                type="primary"
                size="middle"
                icon={<SendOutlined />}
                onClick={handleSendPhoto}
                style={{
                  borderRadius: 8,
                  height: 38,
                  padding: "0 22px",
                  fontWeight: 700,
                  background: "#1677ff",
                  boxShadow: "0 2px 8px rgba(22, 119, 255, 0.35)",
                }}
              >
                Send Photo
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CameraModal;


