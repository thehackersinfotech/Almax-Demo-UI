import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DatePicker, Button, Input, Popover, Modal, Divider,
  Tag, Typography, Space, Alert, Card, Statistic, message,
} from "antd";
import {
  DownloadOutlined, SearchOutlined, FilterOutlined,
  SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FileTextOutlined, TeamOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { get, post } from "@/services/api";
import { PERMS } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";
import { hasPermission } from "@/utils/access";
import EmployeeAttendanceDrawer from "./EmployeeAttendanceDrawer";
import AttendanceMatrixGrid, { AttendanceLegend, buildMatrixRows } from "./AttendanceMatrixGrid";
import {
  AttendanceRow, downloadAttendanceExport, monthRange,
} from "./attendanceConstants";

const { Text } = Typography;
const { TextArea } = Input;

interface TeamMeta {
  has_team: boolean;
  direct_count: number;
  indirect_count: number;
}

interface MonthlyReport {
  id: string;
  year: number;
  month: number;
  month_label: string;
  status: "PENDING" | "APPROVED_BY_CEO" | "REJECTED_BY_CEO";
  status_label: string;
  ceo_remarks: string;
  summary_data: {
    total_team: number;
    present: number;
    absent: number;
    wfh: number;
    half_day: number;
    on_leave: number;
    manager_name?: string;
  };
  reporting_manager: string | null;
  reviewed_by: string | null;
  created_at: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:          "orange",
  APPROVED_BY_CEO:  "green",
  REJECTED_BY_CEO:  "red",
};

export default function TeamAttendanceTab() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const qc = useQueryClient();

  const canHrAttendance = useMemo(
    () => hasPermission(user, permissions, PERMS.HRMS_ATTENDANCE_VIEW),
    [user, permissions],
  );

  const { data: teamMeta } = useQuery<TeamMeta>({
    queryKey: ["leave-team-meta"],
    queryFn: () => get("/leave/team/meta/"),
  });

  const isPM  = !!user?.is_manager || !!teamMeta?.has_team || canHrAttendance;
  const isCEO = !!user?.is_superuser;

  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerEmpId, setDrawerEmpId] = useState("");
  const [drawerDate, setDrawerDate] = useState<Dayjs>(dayjs());

  // Review modal (CEO)
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [ceoRemarks, setCeoRemarks] = useState("");
  const [reviewReportId, setReviewReportId] = useState<string | null>(null);

  const [rangeStart, rangeEnd] = monthRange(month);

  const listParams = useMemo(() => ({
    page_size: "5000",
    date_from: rangeStart.format("YYYY-MM-DD"),
    date_to: rangeEnd.format("YYYY-MM-DD"),
    ...(canHrAttendance ? {} : { scope: "team" }),
  }), [rangeStart, rangeEnd, canHrAttendance]);

  const { data: rawRows = [], isLoading: matrixLoading } = useQuery<AttendanceRow[]>({
    queryKey: ["attendance-list", listParams],
    queryFn: () => get("/attendance/list/", listParams).then((d: any) => d.results ?? d),
    staleTime: 30_000,
  });

  // Monthly reports for the selected month (PM gets only their own; CEO gets all)
  const { data: monthlyReports = [] } = useQuery<MonthlyReport[]>({
    queryKey: ["attendance-monthly-reports", month.year(), month.month() + 1, user?.id],
    queryFn: () => get("/attendance/monthly-report/list/", {
      year: month.year(),
      month: month.month() + 1,
    }).then((d: any) => d ?? []),
    enabled: isPM || isCEO,
    staleTime: 30_000,
  });

  const monthlyReport = monthlyReports.length > 0 ? monthlyReports[0] : null;

  // PM submits their team attendance to CEO
  const submitMutation = useMutation({
    mutationFn: () => post("/attendance/monthly-report/", {
      year: month.year(),
      month: month.month() + 1,
    }),
    onSuccess: () => {
      message.success(`Team attendance report for ${month.format("MMMM YYYY")} sent to the CEO (Chandra Prakash) for approval.`);
      qc.invalidateQueries({ queryKey: ["attendance-monthly-reports"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Failed to submit report.");
    },
  });

  // CEO approves or rejects
  const reviewMutation = useMutation({
    mutationFn: ({ id, action, remarks }: { id: string; action: string; remarks: string }) =>
      post(`/attendance/monthly-report/${id}/review/`, { action, ceo_remarks: remarks }),
    onSuccess: (_data, vars) => {
      const approved = vars.action === "APPROVE";
      const report = monthlyReports.find(r => r.id === vars.id);
      const managerName = report?.reporting_manager || "The reporting manager";
      message.success(
        approved
          ? `Report approved. ${managerName} has been notified.`
          : `Report rejected. ${managerName} has been notified with your remarks.`,
      );
      setReviewOpen(false);
      setCeoRemarks("");
      qc.invalidateQueries({ queryKey: ["attendance-monthly-reports"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Action failed.");
    },
  });

  const matrixRows = useMemo(() => {
    const built = buildMatrixRows(rawRows);
    const q = search.trim().toLowerCase();
    if (!q) return built;
    return built.filter(
      (e) =>
        e.employee_name.toLowerCase().includes(q)
        || e.employee_code.toLowerCase().includes(q),
    );
  }, [rawRows, search]);

  const openCell = (employeeId: string, date: string) => {
    setDrawerEmpId(employeeId);
    setDrawerDate(dayjs(date));
    setDrawerOpen(true);
  };

  // PM can submit if: isPM, not CEO, and no report yet OR report was rejected
  const canSubmit = isPM && !isCEO && (!monthlyReport || monthlyReport.status === "REJECTED_BY_CEO");
  const isApproved = monthlyReport?.status === "APPROVED_BY_CEO";

  const selectedReviewReport = monthlyReports.find(r => r.id === reviewReportId);
  const reviewManagerName = selectedReviewReport?.reporting_manager || "the reporting manager";

  return (
    <>
      {/* ── PM: Report Status Banner ─────────────────────────────────────── */}
      {!isCEO && monthlyReport && (
        <Alert
          style={{ marginBottom: 12, borderRadius: 8 }}
          type={monthlyReport.status === "APPROVED_BY_CEO" ? "success" : monthlyReport.status === "REJECTED_BY_CEO" ? "error" : "warning"}
          showIcon
          icon={<FileTextOutlined />}
          message={
            <span style={{ fontWeight: 600 }}>
              {month.format("MMMM YYYY")} Team Attendance Report:{" "}
              <Tag color={STATUS_COLOR[monthlyReport.status]}>{monthlyReport.status_label}</Tag>
            </span>
          }
          description={
            <div style={{ marginTop: 4, fontSize: 12 }}>
              {monthlyReport.reporting_manager && (
                <span>Submitted by <strong>{monthlyReport.reporting_manager}</strong>. </span>
              )}
              {monthlyReport.reviewed_by && (
                <span>Reviewed by <strong>{monthlyReport.reviewed_by}</strong>. </span>
              )}

              {/* CEO rejection reason shown to PM */}
              {monthlyReport.status === "REJECTED_BY_CEO" && monthlyReport.ceo_remarks && (
                <div style={{ marginTop: 6, padding: "6px 10px", background: "var(--bms-danger-bg)", borderRadius: 6 }}>
                  <strong>CEO Remarks:</strong> {monthlyReport.ceo_remarks}
                </div>
              )}
            </div>
          }
        />
      )}

      {/* ── CEO: Attendance Reports list ─────────────────────────────────── */}
      {isCEO && monthlyReports.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
          {monthlyReports.map((report) => {
            const reportApproved = report.status === "APPROVED_BY_CEO";
            const reportRejected = report.status === "REJECTED_BY_CEO";
            const reportPending = report.status === "PENDING";
            return (
              <Alert
                key={report.id}
                style={{ borderRadius: 8 }}
                type={reportApproved ? "success" : reportRejected ? "error" : "warning"}
                showIcon
                icon={<FileTextOutlined />}
                message={
                  <span style={{ fontWeight: 600 }}>
                    {month.format("MMMM YYYY")} Attendance Report from <strong>{report.reporting_manager}</strong>:{" "}
                    <Tag color={STATUS_COLOR[report.status]}>{report.status_label}</Tag>
                  </span>
                }
                description={
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    <div>
                      Team Size: <strong>{report.summary_data.total_team}</strong> · 
                      Present: <strong style={{ color: "#22c55e" }}>{report.summary_data.present}</strong> · 
                      Absent: <strong style={{ color: "#ef4444" }}>{report.summary_data.absent}</strong> · 
                      WFH: <strong style={{ color: "#3b82f6" }}>{report.summary_data.wfh}</strong> · 
                      Leave: <strong style={{ color: "#7c3aed" }}>{report.summary_data.on_leave}</strong>
                    </div>
                    
                    {report.reviewed_by && (
                      <div style={{ marginTop: 2 }}>Reviewed by <strong>{report.reviewed_by}</strong>.</div>
                    )}
                    {reportRejected && report.ceo_remarks && (
                      <div style={{ marginTop: 6, padding: "6px 10px", background: "var(--bms-danger-bg)", borderRadius: 6 }}>
                        <strong>Rejection Reason:</strong> {report.ceo_remarks}
                      </div>
                    )}
                    {reportApproved && report.ceo_remarks && (
                      <div style={{ marginTop: 6, padding: "6px 10px", background: "var(--bms-success-bg)", borderRadius: 6 }}>
                        <strong>Remarks:</strong> {report.ceo_remarks}
                      </div>
                    )}

                    {reportPending && (
                      <Space style={{ marginTop: 8 }}>
                        <Button
                          size="small"
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          onClick={() => {
                            setReviewReportId(report.id);
                            setReviewAction("APPROVE");
                            setReviewOpen(true);
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<CloseCircleOutlined />}
                          onClick={() => {
                            setReviewReportId(report.id);
                            setReviewAction("REJECT");
                            setReviewOpen(true);
                          }}
                        >
                          Reject
                        </Button>
                      </Space>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {/* ── CEO: Approved Summary Cards ──────────────────────────────────── */}
      {isCEO && monthlyReports.filter(r => r.status === "APPROVED_BY_CEO").map(report => (
        <Card
          key={report.id}
          size="small"
          style={{ marginBottom: 12, borderRadius: 8, border: "1px solid var(--bms-border)" }}
          title={
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              <FileTextOutlined style={{ marginRight: 6, color: "var(--bms-primary)" }} />
              {month.format("MMMM YYYY")} — Approved Attendance Summary
              {report.summary_data.manager_name && (
                <span style={{ fontWeight: 400, color: "var(--bms-text-2)", marginLeft: 8 }}>
                  · {report.summary_data.manager_name}'s Team
                </span>
              )}
            </span>
          }
        >
          <Space size={24} wrap>
            <Statistic title="Team Size"   value={report.summary_data.total_team}  />
            <Statistic title="Present"     value={report.summary_data.present}      valueStyle={{ color: "#22c55e" }} />
            <Statistic title="Absent"      value={report.summary_data.absent}       valueStyle={{ color: "#ef4444" }} />
            <Statistic title="WFH"         value={report.summary_data.wfh}          valueStyle={{ color: "#3b82f6" }} />
            <Statistic title="Half Day"    value={report.summary_data.half_day}     valueStyle={{ color: "#f59e0b" }} />
            <Statistic title="On Leave"    value={report.summary_data.on_leave}     valueStyle={{ color: "#7c3aed" }} />
          </Space>
        </Card>
      ))}

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        flexWrap: "wrap",
        gap: 12,
      }}>
        <span style={{ fontSize: 13, color: "var(--bms-text-2)" }}>
          {canHrAttendance
            ? "All employees — monthly attendance matrix."
            : `Your reporting line (${teamMeta?.direct_count ?? 0} direct, ${teamMeta?.indirect_count ?? 0} indirect).`}
        </span>
        <Space>
          {/* PM: Submit team attendance to CEO */}
          {canSubmit && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={submitMutation.isPending}
              onClick={() => {
                Modal.confirm({
                  title: `Submit ${month.format("MMMM YYYY")} Team Attendance to CEO?`,
                  icon: <TeamOutlined style={{ color: "var(--bms-primary)" }} />,
                  content: (
                    <div>
                      <p>
                        You are submitting the <strong>{month.format("MMMM YYYY")}</strong> attendance
                        report for your team to the <strong>CEO (Chandra Prakash)</strong> for approval.
                      </p>
                      <p style={{ color: "var(--bms-text-2)", fontSize: 12 }}>
                        The CEO will be notified and can approve or reject. You will be informed of the decision.
                      </p>
                    </div>
                  ),
                  okText: "Submit to CEO",
                  onOk: () => submitMutation.mutateAsync(),
                });
              }}
            >
              Submit to CEO
            </Button>
          )}
          <Button
            icon={<DownloadOutlined />}
            onClick={() => downloadAttendanceExport(month.year(), month.month() + 1)}
          >
            Export CSV
          </Button>
        </Space>
      </div>

      <div className="bms-att-matrix-card">
        <div className="bms-att-matrix-toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 280 }}>
            <Input
              prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
              placeholder="Enter Emp. Name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ maxWidth: 320, borderRadius: 8 }}
            />
            <Button type="text" icon={<FilterOutlined />} aria-label="Filter" disabled title="Use search to filter employees" />
            <DatePicker
              picker="month"
              value={month}
              onChange={(d) => d && setMonth(d)}
              format="MMM YYYY"
              allowClear={false}
              style={{ width: 130 }}
            />
          </div>
          <Popover content={<AttendanceLegend />} title="Legends" trigger="click" placement="bottomRight">
            <Button type="link" style={{ fontWeight: 500, padding: 0 }}>
              Legends
            </Button>
          </Popover>
        </div>

        <AttendanceMatrixGrid
          month={month}
          rows={matrixRows}
          loading={matrixLoading}
          onCellClick={openCell}
        />
      </div>

      <EmployeeAttendanceDrawer
        open={drawerOpen}
        empId={drawerEmpId}
        selDate={drawerDate}
        onClose={() => setDrawerOpen(false)}
      />

      {/* ── CEO Review Modal ─────────────────────────────────────────────── */}
      <Modal
        open={reviewOpen}
        title={
          reviewAction === "APPROVE"
            ? <><CheckCircleOutlined style={{ color: "#22c55e" }} /> Approve Attendance Report</>
            : <><CloseCircleOutlined style={{ color: "#ef4444" }} /> Reject Attendance Report</>
        }
        onCancel={() => { setReviewOpen(false); setCeoRemarks(""); }}
        onOk={() => {
          if (!reviewReportId) return;
          reviewMutation.mutate({ id: reviewReportId, action: reviewAction, remarks: ceoRemarks });
        }}
        okText={reviewAction === "APPROVE" ? "Approve" : "Reject & Notify Manager"}
        okButtonProps={{
          loading: reviewMutation.isPending,
          danger: reviewAction === "REJECT",
        }}
        centered
        width={480}
      >
        {reviewAction === "APPROVE" ? (
          <Alert
            type="success"
            showIcon
            message={`Approving this report will notify the Reporting Manager (${reviewManagerName}).`}
            style={{ marginBottom: 12, borderRadius: 8 }}
          />
        ) : (
          <Alert
            type="error"
            showIcon
            message={`The reporting manager (${reviewManagerName}) will be notified of the rejection and your remarks.`}
            style={{ marginBottom: 12, borderRadius: 8 }}
          />
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          {reviewAction === "APPROVE" ? "Remarks (optional)" : "Rejection Reason (shown to the manager)"}
        </Text>
        <TextArea
          rows={3}
          value={ceoRemarks}
          onChange={(e) => setCeoRemarks(e.target.value)}
          placeholder={reviewAction === "APPROVE" ? "Any notes..." : "Please explain the reason for rejection..."}
          style={{ marginTop: 6, borderRadius: 8 }}
        />
      </Modal>
    </>
  );
}
