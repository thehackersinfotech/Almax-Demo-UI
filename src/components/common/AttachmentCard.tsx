import { useState } from "react";
import { Button, Dropdown, Modal, Tag, Typography } from "antd";
import {
  DownloadOutlined, FileExcelOutlined, FileImageOutlined, FileOutlined,
  FilePdfOutlined, FilePptOutlined, FileTextOutlined, FileWordOutlined,
  FileZipOutlined, MoreOutlined, LinkOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

export interface AttachmentCardData {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  scan_status: "PENDING" | "CLEAN" | "INFECTED" | "ERROR";
  download_url: string | null;
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

function fileKind(filename: string, contentType: string): {
  icon: React.ReactNode; color: string; isImage: boolean; isPdf: boolean;
} {
  const ext = extOf(filename);
  if (contentType.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return { icon: <FileImageOutlined />, color: "#722ed1", isImage: true, isPdf: false };
  }
  if (contentType === "application/pdf" || ext === "pdf") {
    return { icon: <FilePdfOutlined />, color: "#f5222d", isImage: false, isPdf: true };
  }
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return { icon: <FileExcelOutlined />, color: "#389e0d", isImage: false, isPdf: false };
  }
  if (["doc", "docx"].includes(ext)) {
    return { icon: <FileWordOutlined />, color: "#1677ff", isImage: false, isPdf: false };
  }
  if (["ppt", "pptx"].includes(ext)) {
    return { icon: <FilePptOutlined />, color: "#d4380d", isImage: false, isPdf: false };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return { icon: <FileZipOutlined />, color: "#d48806", isImage: false, isPdf: false };
  }
  if (["txt", "md", "log"].includes(ext)) {
    return { icon: <FileTextOutlined />, color: "#595959", isImage: false, isPdf: false };
  }
  return { icon: <FileOutlined />, color: "#595959", isImage: false, isPdf: false };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A minimized, click-to-preview attachment card — matches the compact
 * "icon + filename" tile pattern from Teams/Slack-style chat apps, instead
 * of a raw filename+download link inline in the message text. */
export default function AttachmentCard({ attachment, mine }: { attachment: AttachmentCardData; mine?: boolean }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { original_filename, content_type, size_bytes, scan_status, download_url } = attachment;
  const { icon, color, isImage, isPdf } = fileKind(original_filename, content_type);
  const clean = scan_status === "CLEAN" && !!download_url;

  const openPreview = () => {
    if (clean) setPreviewOpen(true);
  };

  return (
    <>
      <div
        onClick={openPreview}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: 220, maxWidth: "100%", padding: "8px 8px 8px 10px",
          borderRadius: 8, cursor: clean ? "pointer" : "default",
          border: `1px solid ${mine ? "rgba(255,255,255,0.35)" : "var(--bms-border, #e5e7eb)"}`,
          background: mine ? "rgba(255,255,255,0.12)" : "var(--bms-surface, #fff)",
        }}
      >
        {isImage && clean ? (
          <img
            src={download_url ?? undefined}
            alt={original_filename}
            style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
          />
        ) : (
          <span style={{ fontSize: 22, color, flexShrink: 0 }}>{icon}</span>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden",
            textOverflow: "ellipsis", color: mine ? "#fff" : "var(--bms-text, #1f2937)",
          }}>
            {original_filename}
          </div>
          {clean ? (
            <Text style={{ fontSize: 11, color: mine ? "rgba(255,255,255,0.75)" : "#8c8c8c" }}>
              {formatSize(size_bytes)}
            </Text>
          ) : (
            <Tag
              style={{ marginTop: 2, fontSize: 10, lineHeight: "16px", padding: "0 4px" }}
              color={scan_status === "INFECTED" ? "red" : scan_status === "ERROR" ? "orange" : "default"}
            >
              {scan_status === "PENDING" ? "Scanning…" : scan_status.toLowerCase()}
            </Tag>
          )}
        </div>

        {clean && (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "download", label: "Download", icon: <DownloadOutlined /> },
                { key: "open", label: "Open in new tab", icon: <LinkOutlined /> },
              ],
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (!download_url) return;
                if (key === "download") {
                  const a = document.createElement("a");
                  a.href = download_url;
                  a.download = original_filename;
                  a.click();
                } else {
                  window.open(download_url, "_blank", "noopener,noreferrer");
                }
              },
            }}
          >
            <Button
              type="text" size="small" icon={<MoreOutlined style={{ color: mine ? "#fff" : undefined }} />}
              onClick={(e) => e.stopPropagation()}
              style={{ flexShrink: 0 }}
            />
          </Dropdown>
        )}
      </div>

      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={[
          <Button
            key="download" icon={<DownloadOutlined />}
            onClick={() => {
              if (!download_url) return;
              const a = document.createElement("a");
              a.href = download_url;
              a.download = original_filename;
              a.click();
            }}
          >
            Download
          </Button>,
        ]}
        title={original_filename}
        width={isImage || isPdf ? 760 : 420}
      >
        {isImage && download_url ? (
          <img src={download_url} alt={original_filename} style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} />
        ) : isPdf && download_url ? (
          <iframe src={download_url} title={original_filename} style={{ width: "100%", height: "75vh", border: "none" }} />
        ) : (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#8c8c8c" }}>
            <div style={{ fontSize: 40, color, marginBottom: 8 }}>{icon}</div>
            Preview isn't available for this file type — download it to view.
          </div>
        )}
      </Modal>
    </>
  );
}
