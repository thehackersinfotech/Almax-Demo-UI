import { useEffect, useRef, useState } from "react";
import { Button, Modal, Spin, Alert, Space } from "antd";
import { DownloadOutlined, PrinterOutlined, ReloadOutlined } from "@ant-design/icons";
import { financeApi } from "@/services/finance";
import client from "@/services/api";

interface Props {
  documentId: string;
  onClose:    () => void;
}

export default function PDFPreviewModal({ documentId, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl,  setBlobUrl]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    // Revoke previous blob URL to avoid memory leaks
    if (blobUrl) URL.revokeObjectURL(blobUrl);

    try {
      // Fetch the preview HTML with the existing authenticated axios instance
      const response = await client.get(
        `${financeApi.previewUrl(documentId).replace(/^.*\/bms\/api\/v1/, "")}`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "text/html; charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (e) {
      setError("Failed to load preview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const handleDownloadPdf = () => {
    window.open(financeApi.pdfUrl(documentId), "_blank");
  };

  return (
    <Modal
      open
      onCancel={onClose}
      width="85vw"
      style={{ top: 20 }}
      styles={{ body: { padding: 0, height: "82vh", display: "flex", flexDirection: "column" } }}
      title={
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", rowGap: 8, paddingRight: 40,
        }}>
          <span style={{ fontWeight: 600 }}>Document Preview</span>
          {!loading && !error && (
            <Space wrap size={8}>
              <Button size="small" icon={<ReloadOutlined />} onClick={load}>
                Refresh
              </Button>
              <Button size="small" icon={<PrinterOutlined />} onClick={handlePrint}>
                Print
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </Button>
            </Space>
          )}
        </div>
      }
      footer={null}
      destroyOnHidden
    >
      {loading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spin size="large" tip="Loading preview…" />
        </div>
      )}
      {error && (
        <div style={{ padding: 24 }}>
          <Alert
            type="error"
            message={error}
            action={<Button size="small" onClick={load}>Retry</Button>}
          />
        </div>
      )}
      {blobUrl && !loading && !error && (
        <iframe
          ref={iframeRef}
          src={blobUrl}
          style={{
            flex:    1,
            width:   "100%",
            border:  "none",
            background: "#fff",
          }}
          title="Document Preview"
        />
      )}
    </Modal>
  );
}
