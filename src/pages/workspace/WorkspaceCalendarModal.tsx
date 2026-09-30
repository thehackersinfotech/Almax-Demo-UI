import { Modal, Button } from "antd";
import { CalendarOutlined, ExpandOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import WorkspaceCalendarPage from "./WorkspaceCalendarPage";

export default function WorkspaceCalendarModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="96vw"
      centered={false}
      style={{ top: 12, maxWidth: 1400, paddingBottom: 0 }}
      styles={{
        content: {
          height: "calc(100vh - 24px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
        body: {
          padding: "8px 12px 12px",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        },
      }}
      title={(
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingRight: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarOutlined style={{ color: "#1a73e8" }} />
            <span>Workspace Calendar</span>
          </div>
          <Button
            type="link"
            size="small"
            icon={<ExpandOutlined />}
            onClick={() => {
              onClose();
              navigate("/workspace/calendar");
            }}
            style={{ padding: 0, height: "auto" }}
          >
            Open full page
          </Button>
        </div>
      )}
      destroyOnHidden
    >
      <WorkspaceCalendarPage embedded onEmbeddedClose={onClose} />
    </Modal>
  );
}
