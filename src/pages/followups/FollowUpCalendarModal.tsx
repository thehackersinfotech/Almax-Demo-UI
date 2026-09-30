import { useState } from "react";
import { Modal, message } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import FollowUpCalendarView from "./FollowUpCalendarView";
import FollowUpDetailDrawer from "./FollowUpDetailDrawer";
import { followUpApi, FollowUpItem } from "@/services/followups";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";

export default function FollowUpCalendarModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const permissions = useAuthStore((s) => s.permissions);
  const canUpdate = permissions.includes(PERMS.CRM_FOLLOWUP_UPDATE as never);
  const canDelete = permissions.includes(PERMS.CRM_FOLLOWUP_DELETE as never);
  const canTransition = permissions.includes(PERMS.CRM_FOLLOWUP_TRANSITION as never);
  const [detailItem, setDetailItem] = useState<FollowUpItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["followups-list", userId, "calendar-modal"],
    queryFn: () => followUpApi.listAll(),
    enabled: open && Boolean(userId),
    staleTime: 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["followups-list"] });
    qc.invalidateQueries({ queryKey: ["followups-board"] });
    qc.invalidateQueries({ queryKey: ["employee-dashboard"] });
  };

  const doneMutation = useMutation({
    mutationFn: (id: string) => followUpApi.transition(id, "completed"),
    onSuccess: () => {
      message.success("Follow-up marked as done");
      invalidate();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg || "Could not update follow-up");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => followUpApi.delete(id),
    onSuccess: () => {
      message.success("Follow-up deleted");
      invalidate();
    },
    onError: () => message.error("Failed to delete follow-up"),
  });

  const handleClose = () => {
    setDetailItem(null);
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={handleClose}
        footer={null}
        width={960}
        centered
        title={(
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarOutlined style={{ color: "#1a73e8" }} />
            <span>Follow-up Calendar</span>
          </div>
        )}
        styles={{ body: { padding: "12px 16px 16px", maxHeight: "82vh", overflowY: "auto" } }}
        destroyOnHidden
      >
        <FollowUpCalendarView
          items={items}
          loading={isLoading}
          onSelect={setDetailItem}
        />
      </Modal>

      <FollowUpDetailDrawer
        item={detailItem}
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        onEdit={() => {
          setDetailItem(null);
          onClose();
          navigate("/workspace/followups");
        }}
        onDone={(item) => doneMutation.mutate(item.id)}
        onDelete={(id) => deleteMutation.mutate(id)}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canTransition={canTransition}
      />
    </>
  );
}
