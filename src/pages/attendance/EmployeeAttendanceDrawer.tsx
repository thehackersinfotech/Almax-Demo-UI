import React, { useEffect, useState, Component } from "react";
import {
  Drawer, Spin, Empty, Tag, Row, Col, Card, Divider, Typography, Button, Modal, Form,
  Select, Input, TimePicker, message,
} from "antd";
import {
  LoginOutlined, LogoutOutlined, CoffeeOutlined, ClockCircleOutlined,
  EnvironmentOutlined, PlusOutlined, PauseCircleOutlined, PlayCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs, { Dayjs } from "dayjs";
import { get, post } from "@/services/api";
import { usePermission } from "@/hooks/usePermission";
import { PERMS } from "@/constants/permissions";
import { STATUS_STYLE } from "./attendanceConstants";

const { Text } = Typography;
const LeafletMap = React.lazy(() => import("./LeafletMap"));

interface TrackerEvent {
  type: string;
  time: string;
  label: string;
  lat?: number | null;
  lng?: number | null;
  duration_minutes?: number;
}

interface TrackerRecord {
  status: string;
  leave_duration?: string | null;
  half_day_period?: string | null;
  leave_type_name?: string | null;
  check_in: string | null;
  check_out: string | null;
  working_hours: number;
  total_break_minutes: number;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
}

interface TrackerResponse {
  employee: { id: string; full_name: string; employee_code: string };
  date: string;
  record: TrackerRecord | null;
  events: TrackerEvent[];
}

const EVENT_META: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  CHECK_IN:    { color: "var(--bms-success)", bg: "rgba(22, 163, 74, 0.15)", icon: <LoginOutlined />       },
  CHECK_OUT:   { color: "var(--bms-danger)", bg: "var(--bms-danger-bg)", icon: <LogoutOutlined />      },
  BREAK_START: { color: "var(--bms-warning)", bg: "rgba(245, 158, 11, 0.15)", icon: <PauseCircleOutlined /> },
  BREAK_END:   { color: "var(--bms-primary)", bg: "rgba(59, 130, 246, 0.15)", icon: <PlayCircleOutlined />  },
};

class MapErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function AddAttendanceModal({ open, empId, date, onClose, onSaved }: {
  open: boolean; empId: string; date: Dayjs; onClose: () => void; onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) form.resetFields(); }, [open, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await post("/attendance/tracker/", {
        employee: empId,
        date: date.format("YYYY-MM-DD"),
        status: values.status,
        check_in: values.check_in ? dayjs(values.check_in).format("HH:mm") : null,
        check_out: values.check_out ? dayjs(values.check_out).format("HH:mm") : null,
        notes: values.notes ?? "",
      });
      message.success("Attendance record saved");
      onSaved();
      onClose();
    } catch {
      message.error("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Attendance Record" open={open} onOk={handleOk} onCancel={onClose}
      confirmLoading={saving} okText="Save" destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="status" label="Status" initialValue="PRESENT" rules={[{ required: true }]}>
          <Select options={[
            { value: "PRESENT", label: "Present" },
            { value: "WFH", label: "Work From Home" },
            { value: "HALF_DAY", label: "Half Day" },
            { value: "ON_LEAVE", label: "On Leave" },
            { value: "HOLIDAY", label: "Holiday" },
            { value: "WEEKEND", label: "Weekend" },
            { value: "ABSENT", label: "Absent" },
          ]} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="check_in" label="Check In"><TimePicker format="HH:mm" style={{ width: "100%" }} /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="check_out" label="Check Out"><TimePicker format="HH:mm" style={{ width: "100%" }} /></Form.Item>
          </Col>
        </Row>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Optional notes" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function EmployeeAttendanceDrawer({ open, empId, selDate, onClose }: {
  open: boolean;
  empId: string;
  selDate: Dayjs;
  onClose: () => void;
}) {
  const canManageAttendance = usePermission(PERMS.HRMS_LEAVE_MANAGE);
  const [addOpen, setAddOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<TrackerResponse>({
    queryKey: ["attendance-tracker", empId, selDate.format("YYYY-MM-DD")],
    queryFn: () => get(`/attendance/tracker/?employee=${empId}&date=${selDate.format("YYYY-MM-DD")}`),
    enabled: open && !!empId,
    staleTime: 0,
  });

  const rec = data?.record ?? null;
  const mapPoints: Array<{ lat: number; lng: number; label: string; time: string; color: string }> = [];
  if (rec?.check_in_lat != null && rec.check_in_lng != null) {
    mapPoints.push({ lat: rec.check_in_lat, lng: rec.check_in_lng, label: "Start", time: rec.check_in ?? "", color: "#059669" });
  }
  if (rec?.check_out_lat != null && rec.check_out_lng != null) {
    mapPoints.push({ lat: rec.check_out_lat, lng: rec.check_out_lng, label: "End", time: rec.check_out ?? "", color: "#dc2626" });
  }

  const drawerTitle = data ? (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", background: "var(--bms-primary)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        fontSize: 15, fontWeight: 700, flexShrink: 0,
      }}>
        {data.employee.full_name.slice(0, 1).toUpperCase()}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{data.employee.full_name}</div>
        <div style={{ fontSize: 12, color: "var(--bms-text-3)", fontFamily: "monospace" }}>{data.employee.employee_code}</div>
      </div>
      <Tag style={{ marginLeft: "auto", marginRight: 0 }}>{selDate.format("DD MMM YYYY")}</Tag>
    </div>
  ) : "Attendance Detail";

  return (
    <>
      <Drawer open={open} onClose={onClose} width={520} title={drawerTitle} destroyOnHidden styles={{ body: { padding: 20 } }}>
        {isLoading && <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>}
        {!isLoading && data && (
          <>
            {rec && (() => {
              const ss = STATUS_STYLE[rec.status] ?? STATUS_STYLE.ABSENT;
              let label = ss.label;
              if (rec.status === "HALF_DAY") {
                const isSecondHalf = rec.half_day_period === "SECOND_HALF" || (rec.check_in && parseInt(rec.check_in.split(":")[0]) >= 12);
                label = isSecondHalf ? "Half Day (SH)" : "Half Day (FH)";
              }
              return (
                <div style={{ marginBottom: 16 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: ss.color, background: ss.bg,
                    border: `1px solid ${ss.color}33`, borderRadius: 20, padding: "4px 16px",
                  }}>
                    {label}
                  </span>
                </div>
              );
            })()}
            {!rec && (
              <Empty description="No attendance record for this date" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }}>
                {canManageAttendance && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Add Attendance</Button>
                )}
              </Empty>
            )}
            {rec && (
              <>
                <Row gutter={10} style={{ marginBottom: 16 }}>
                  {[
                    { label: "Check In", value: rec.check_in ?? "—", color: "#059669", icon: <LoginOutlined /> },
                    { label: "Check Out", value: rec.check_out ?? "—", color: "#dc2626", icon: <LogoutOutlined /> },
                    { label: "Working", value: `${rec.working_hours}h`, color: "var(--bms-primary)", icon: <ClockCircleOutlined /> },
                    { label: "Break", value: `${rec.total_break_minutes}m`, color: "#f59e0b", icon: <CoffeeOutlined /> },
                  ].map(({ label, value, color, icon }) => (
                    <Col span={6} key={label}>
                      <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
                        <div style={{ color, fontSize: 16, marginBottom: 2 }}>{icon}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                        <div style={{ fontSize: 10, color: "var(--bms-text-3)" }}>{label}</div>
                      </Card>
                    </Col>
                  ))}
                </Row>
                <Divider style={{ margin: "12px 0" }} />
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Day Timeline</div>
                {data.events.length === 0 ? (
                  <Empty description="No events recorded" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div style={{ position: "relative", paddingLeft: 28 }}>
                    <div style={{ position: "absolute", left: 9, top: 8, bottom: 8, width: 2, background: "var(--bms-border)" }} />
                    {data.events.map((ev, idx) => {
                      const meta = EVENT_META[ev.type] ?? EVENT_META.CHECK_IN;
                      return (
                        <div key={idx} style={{ position: "relative", marginBottom: 14 }}>
                          <div style={{
                            position: "absolute", left: -23, top: 2, width: 18, height: 18, borderRadius: "50%",
                            background: meta.color, display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 9, border: "2px solid #fff",
                          }}>
                            {meta.icon}
                          </div>
                          <div style={{ background: meta.bg, borderRadius: 8, padding: "7px 11px", border: `1px solid ${meta.color}22` }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <Text strong style={{ fontSize: 12, color: meta.color }}>{ev.label}</Text>
                              <Text style={{ fontSize: 11, color: "var(--bms-text-3)", fontFamily: "monospace" }}>{ev.time}</Text>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {mapPoints.length > 0 && (
                  <>
                    <Divider style={{ margin: "12px 0" }} />
                    <MapErrorBoundary>
                      <React.Suspense fallback={<Spin />}>
                        <LeafletMap points={mapPoints} />
                      </React.Suspense>
                    </MapErrorBoundary>
                  </>
                )}
              </>
            )}
          </>
        )}
      </Drawer>
      <AddAttendanceModal
        open={addOpen}
        empId={empId}
        date={selDate}
        onClose={() => setAddOpen(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["attendance-tracker", empId, selDate.format("YYYY-MM-DD")] })}
      />
    </>
  );
}
