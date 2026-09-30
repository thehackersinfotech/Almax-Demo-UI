import { theme, Divider, Typography } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import AttendanceCalendar from "@/components/common/AttendanceCalendar";
import { useAuthStore } from "@/store/auth";
import { MyRegularizationRequests } from "./AttendanceRegularizationPanel";

const { useToken } = theme;
const { Title } = Typography;

export default function MyAttendanceTab() {
  const { token } = useToken();
  const user = useAuthStore((s) => s.user);

  return (
    <div style={{ background: token.colorBgLayout }}>
      <div className="bms-att-matrix-card att-tracker-page__card">
        {user?.id ? (
          <AttendanceCalendar
            employeeId={user.id}
            allowFutureRequests
          />
        ) : null}
      </div>

      {/* ── Regularization Requests Section ─────────────────────────────── */}
      <Divider style={{ margin: "24px 0 16px" }} />
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <ClockCircleOutlined style={{ color: "var(--bms-primary)", fontSize: 16 }} />
        <Title level={5} style={{ margin: 0 }}>Attendance Regularization</Title>
      </div>
      <MyRegularizationRequests />
    </div>
  );
}
