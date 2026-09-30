import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Table,
  Typography,
  Button,
  Tag,
  Input,
  InputNumber,
  Select,
  Modal,
  Descriptions,
  Alert,
  message,
  Tabs,
  Form,
  DatePicker,
  Checkbox,
  Space,
  Divider,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  UsergroupDeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  EditOutlined,
  SendOutlined,
  LockOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  DownloadOutlined,
  DollarOutlined,
  TeamOutlined,
  LinkOutlined,
  FilePdfOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { get } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { usePermission } from "@/hooks/usePermission";
import { PERMS } from "@/constants/permissions";
import { offboardingStore } from "@/store/offboardingStore";
import { itAssetStore } from "@/store/itAssets";
import { OffboardingLifecycleBar, LIFECYCLE_STEPS } from "@/components/offboarding/OffboardingLifecycleBar";
import type { OffboardingRequest } from "@/services/offboarding";
import { openAndPrintDocument } from "@/utils/offboardingDocumentGenerator";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function OffboardingPage() {
  const user = useAuthStore((s) => s.user);
  // Use centralized permission constants — is_staff/is_superuser bypass is handled inside usePermission.
  const isHR           = usePermission(PERMS.HRMS_OFFBOARDING_MANAGE);
  const isFinanceAdmin = usePermission(PERMS.HRMS_OFFBOARDING_FINANCE);

  const [viewMode, setViewMode] = useState<"pm" | "hr" | "it_admin" | "finance">(
    isFinanceAdmin && !isHR ? "finance" : isHR ? "hr" : "pm"
  );
  const [requests, setRequests] = useState<OffboardingRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [selectedReq, setSelectedReq] = useState<OffboardingRequest | null>(null);
  const [viewStep, setViewStep] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>("hr_review");

  // IT Asset Admin Revoke Modal State
  const [itRevokeModalVisible, setItRevokeModalVisible] = useState(false);
  const [itRevokeTargetReq, setItRevokeTargetReq] = useState<OffboardingRequest | null>(null);

  // Task Setup Checkboxes
  const [taskSetupAssetRevoke, setTaskSetupAssetRevoke] = useState(true);
  const [taskSetupFinanceClearance, setTaskSetupFinanceClearance] = useState(true);

  // Finance Admin: F&F Settlement form state
  const [financeBaseSalary, setFinanceBaseSalary] = useState<number>(65000);
  const [financeAdditions, setFinanceAdditions] = useState<number>(12500);
  const [financeAdditionsReason, setFinanceAdditionsReason] = useState<string>("12 Days Unused Leave Encashment & Performance Bonus");
  const [financeDeductions, setFinanceDeductions] = useState<number>(0);
  const [financeDeductionsReason, setFinanceDeductionsReason] = useState<string>("Asset Damage / Shortage / Notice Buyout");
  const [financeNotes, setFinanceNotes] = useState<string>("");
  const [empPayroll, setEmpPayroll] = useState<any>(null);

  const fetchEmpPayroll = async (record: OffboardingRequest) => {
    try {
      const res: any = await get("/payroll/");
      const list = Array.isArray(res) ? res : res?.results || [];
      const match = list.find(
        (p: any) =>
          String(p.employee) === String(record.employee_id) ||
          (record.employee_code && String(p.employee_code) === String(record.employee_code)) ||
          (p.employee_name && record.employee_name && p.employee_name.toLowerCase().includes(record.employee_name.toLowerCase()))
      );
      if (match) {
        setEmpPayroll(match);
        const baseFromHrms = Number(match.basic_salary) || Number(match.net_salary) || Number(match.gross_total) || 65000;
        if (!record.finance_base_salary) {
          setFinanceBaseSalary(baseFromHrms);
        }
      } else {
        setEmpPayroll(null);
      }
    } catch (e) {
      console.warn("Could not fetch payroll for employee", e);
    }
  };

  // Modals & Forms
  const [pmModalVisible, setPmModalVisible] = useState(false);
  const [pmForm] = Form.useForm();
  const [hrForm] = Form.useForm();
  const [exitQuestionForm] = Form.useForm();
  const [customExitQuestions, setCustomExitQuestions] = useState<string[]>([]);
  const [customDocuments, setCustomDocuments] = useState<{ id: string; title: string; desc: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [proofModalUrl, setProofModalUrl] = useState("");

  const reloadData = () => {
    const list = offboardingStore.getRequests();
    setRequests(list);
    if (selectedReq) {
      const updated = list.find((r) => r.id === selectedReq.id);
      if (updated) setSelectedReq(updated);
    }
  };

  useEffect(() => {
    // Sync with backend only when authenticated (user exists)
    if (user) {
      offboardingStore.syncWithBackend();
    }
    reloadData();
    const unsub = offboardingStore.subscribe(reloadData);
    return unsub;
  }, []);

  const filteredRequests = requests.filter((r) => {
    const matchSearch =
      r.employee_name.toLowerCase().includes(search.toLowerCase()) ||
      r.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      r.department.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === "all" || r.status === statusFilter;

    if (viewMode === "pm") {
      return matchSearch && matchStatus;
    } else if (viewMode === "hr") {
      return matchSearch && matchStatus && r.status !== "submitted";
    } else if (viewMode === "it_admin") {
      return matchSearch && matchStatus && r.it_assets_revoke_requested;
    } else {
      // Finance Admin: show requests at finance_clearance step
      return matchSearch && matchStatus && (r.status === "finance_clearance" || r.finance_cleared === true);
    }
  });

  // Map step number → tab key for auto-selection
  const STEP_TO_TAB: Record<number, string> = {
    1: "pm_review",
    2: "pm_review",
    3: "hr_review",
    4: "task_setup",
    5: "kt",
    6: "exit_interview",
    7: "assets_return",
    8: "documents",
    9: "finance",
    10: "finance",
  };

  const handleConfirmAssetRevoke = async (req: OffboardingRequest) => {
    setLoading(true);
    try {
      const updated = await offboardingStore.confirmAssetRevoke(req.id, user?.full_name || "IT Asset Admin");
      message.success(`IT Assets & Facilities confirmed revoked for ${req.employee_name}! Status bar line moved to Step 8: Documents Issued.`);
      setItRevokeModalVisible(false);
      setItRevokeTargetReq(null);
      if (selectedReq && selectedReq.id === req.id) {
        setSelectedReq(updated);
        setViewStep(updated.current_step);
      }
    } catch (e: any) {
      message.error(e.message || "Failed to confirm asset revocation.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (record: OffboardingRequest) => {
    setSelectedReq(record);
    setViewStep(record.current_step);
    // Auto-select the tab matching the view mode or current step
    const tabKey = (viewMode as string) === "finance"
      ? "finance"
      : (viewMode as string) === "pm"
        ? (record.current_step >= 5 ? "kt" : "kt")  // PM sees only kt tab (lifecycle bar shows step context)
        : (STEP_TO_TAB[record.current_step] || "hr_review");
    setActiveTab(tabKey);
    hrForm.setFieldsValue({
      hr_approved_lwd: record.pm_approved_lwd ? dayjs(record.pm_approved_lwd) : dayjs(record.proposed_lwd),
      hr_notes: record.hr_notes || "",
    });
    // Pre-fill finance state
    setFinanceBaseSalary(Number(record.finance_base_salary) || 65000);
    setFinanceAdditions(Number(record.finance_additions) || 12500);
    setFinanceDeductions(Number(record.finance_deductions) || 0);
    if (record.finance_notes) setFinanceNotes(record.finance_notes);
    fetchEmpPayroll(record);
  };

  const handlePmSubmitLwd = async (values: any) => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      const lwdStr = values.lwd.format("YYYY-MM-DD");
      const updated = await offboardingStore.pmReviewLwd(
        selectedReq.id,
        lwdStr,
        values.notes,
        user?.full_name || "Project Manager"
      );
      message.success(`LWD reviewed & sent to HR for ${selectedReq.employee_name}! Workflow moved to Step 3: HR Review.`);
      setPmModalVisible(false);
      setSelectedReq(updated);
      setViewStep(updated.current_step);
    } catch (e: any) {
      message.error(e.message || "Failed to submit PM review.");
    } finally {
      setLoading(false);
    }
  };

  const handleHrApproveRequest = async (values: any) => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      const lwdStr = values.hr_approved_lwd.format("YYYY-MM-DD");
      const updated = await offboardingStore.hrApproveRequest(
        selectedReq.id,
        lwdStr,
        values.hr_notes,
        user?.full_name || "HR Manager"
      );
      message.success(`Resignation approved by HR! Workflow moved to Step 4: Task Setups.`);
      setSelectedReq(updated);
      setViewStep(updated.current_step);
      setActiveTab("task_setup");
    } catch (e: any) {
      message.error(e.message || "Failed to approve resignation.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTaskSetup = async (financeRequired: boolean, assetRevokeRequired: boolean) => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      const updated = await offboardingStore.confirmTaskSetup(
        selectedReq.id,
        financeRequired,
        assetRevokeRequired,
        user?.full_name || "HR Manager"
      );
      message.success(`Task Setup confirmed! Workflow moved to Step 5: Knowledge Transfer.`);
      setSelectedReq(updated);
      setViewStep(updated.current_step);
      setActiveTab("kt");
    } catch (e: any) {
      message.error(e.message || "Failed to confirm task setup.");
    } finally {
      setLoading(false);
    }
  };


  const handlePmAcknowledgeKt = async () => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      const updated = await offboardingStore.acknowledgeKtPm(selectedReq.id);
      message.success("Knowledge Transfer acknowledged by Project Manager! Sent to HR for final acknowledgment.");
      setSelectedReq(updated);
    } catch (e: any) {
      message.error(e.message || "Failed to acknowledge KT.");
    } finally {
      setLoading(false);
    }
  };

  const handleHrAcknowledgeKt = async () => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      const updated = await offboardingStore.acknowledgeKtHr(selectedReq.id);
      message.success("HR Final Knowledge Transfer acknowledged! Advanced to Step 6: Exit Interview.");
      setSelectedReq(updated);
      setViewStep(updated.current_step);
      setActiveTab("exit_interview");
    } catch (e: any) {
      message.error(e.message || "Failed to acknowledge KT.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendExitQuestions = async (values: any) => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      const defaultList = [values.q1, values.q2, values.q3].filter(Boolean);
      const customList = customExitQuestions
        .map((q, i) => (values[`custom_q_${i}`] !== undefined ? values[`custom_q_${i}`] : q))
        .filter(Boolean);
      const qList = [...defaultList, ...customList];
      const updated = await offboardingStore.sendExitQuestions(selectedReq.id, qList);
      message.success(`Exit interview questions (${qList.length} questions) sent to employee successfully!`);
      setSelectedReq(updated);
    } catch (e: any) {
      message.error(e.message || "Failed to send exit questions.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveExitInterview = async () => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      const updated = await offboardingStore.approveExitInterview(selectedReq.id);
      message.success("Exit interview approved! Advanced to Step 7: IT Assets & Facilities Return.");
      setSelectedReq(updated);
      setViewStep(updated.current_step);
    } catch (e: any) {
      message.error(e.message || "Failed to approve exit interview.");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Employee",
      key: "employee",
      render: (_: any, r: OffboardingRequest) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.employee_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.employee_code || r.employee_id}</Text>
        </div>
      ),
    },
    {
      title: "Department & Role",
      key: "dept",
      render: (_: any, r: OffboardingRequest) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{r.designation || "N/A"}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.department || "N/A"}</Text>
        </div>
      ),
    },
    {
      title: "Proposed LWD",
      dataIndex: "proposed_lwd",
      key: "proposed_lwd",
      render: (lwd: string) => <Tag color="blue">{lwd}</Tag>,
    },
    {
      title: "PM Approved LWD",
      dataIndex: "pm_approved_lwd",
      key: "pm_approved_lwd",
      render: (lwd: string) => lwd ? <Tag color="gold" style={{ fontWeight: 700 }}>{lwd}</Tag> : <Text type="secondary">Pending PM</Text>,
    },
    {
      title: "HR Approved LWD",
      dataIndex: "approved_lwd",
      key: "approved_lwd",
      render: (lwd: string) => lwd ? <Tag color="green" style={{ fontWeight: 700 }}>{lwd}</Tag> : <Text type="secondary">Pending HR</Text>,
    },
    {
      title: "Current Step",
      key: "current_step",
      render: (_: any, r: OffboardingRequest) => (
        <Tag color="processing" style={{ fontWeight: 600 }}>
          Step {r.current_step}: {LIFECYCLE_STEPS[r.current_step - 1]?.name}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, r: OffboardingRequest) => (
        <Space>
          {viewMode === "pm" && r.current_step === 2 && (
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedReq(r);
                pmForm.setFieldsValue({
                  lwd: dayjs(r.proposed_lwd),
                  notes: "",
                });
                setPmModalVisible(true);
              }}
              style={{ background: "linear-gradient(135deg, #d97706, #b45309)" }}
            >
              Review LWD & Send to HR
            </Button>
          )}

          {viewMode === "it_admin" && (
            <Button
              type="primary"
              danger={!r.it_assets_revoked}
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setItRevokeTargetReq(r);
                setItRevokeModalVisible(true);
              }}
            >
              {r.it_assets_revoked ? "Return Details" : "Return Assets Request"}
            </Button>
          )}

          <Button
            type="primary"
            ghost
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleOpenDetail(r)}
          >
            View Details
          </Button>
        </Space>
      ),
    },
  ];

  const assignedAssets = useMemo(() => {
    if (!selectedReq) return [];
    const byId = itAssetStore.getEmployeeAssets(selectedReq.employee_id);
    if (byId.length > 0) return byId;
    const all = itAssetStore.getEmployeeAssets();
    const byName = all.filter(
      (a) =>
        a.employeeName.toLowerCase().includes(selectedReq.employee_name.toLowerCase()) ||
        (selectedReq.employee_code && a.employeeId === selectedReq.employee_code)
    );
    if (byName.length > 0) return byName;
    return [];
  }, [selectedReq]);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            <UsergroupDeleteOutlined style={{ marginRight: 10, color: "#ef4444" }} />
            Offboarding Management
          </Title>
          <Text type="secondary">
            Role-based offboarding dashboard for Project Managers, HR Administrators, and IT Asset Admin.
          </Text>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card
        style={{
          borderRadius: 12,
          marginBottom: 24,
          border: "1px solid var(--bms-border, #e5e7eb)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 280 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search employee by name, ID, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="large"
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              size="large"
              style={{ width: 180 }}
              options={[
                { label: "All Statuses", value: "all" },
                { label: "PM Review", value: "pm_review" },
                { label: "HR Review", value: "hr_review" },
                { label: "Task Setup", value: "task_setup" },
                { label: "KT in Progress", value: "kt_in_progress" },
                { label: "Exit Interview", value: "exit_interview" },
                { label: "Completed", value: "completed" },
              ]}
            />
          </div>

          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text-secondary, #6b7280)" }}>
            Viewing Mode: <Tag color={viewMode === "pm" ? "gold" : "blue"}>{viewMode === "pm" ? "Project Manager Reporting Employees" : "HR Offboarding Requests (Sent by PM)"}</Tag>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card
        style={{
          borderRadius: 12,
          border: "1px solid var(--bms-border, #e5e7eb)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        }}
      >
        <Table
          columns={columns}
          dataSource={filteredRequests}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: viewMode === "pm" ? "No resignation requests from reporting employees." : "No offboarding requests sent to HR yet." }}
        />
      </Card>

      {/* PM LWD Review Modal (ONLY FOR PM VIEW) */}
      <Modal
        title={`Project Manager LWD Review - ${selectedReq?.employee_name}`}
        open={pmModalVisible}
        onCancel={() => setPmModalVisible(false)}
        footer={null}
      >
        <Form form={pmForm} layout="vertical" onFinish={handlePmSubmitLwd}>
          <Alert
            type="info"
            showIcon
            message="Proposed LWD Review"
            description={`Employee proposed LWD: ${selectedReq?.proposed_lwd}. You can edit the approved Last Working Day below.`}
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="lwd"
            label="PM Approved Last Working Day (LWD)"
            rules={[{ required: true, message: "Please select approved LWD" }]}
          >
            <DatePicker style={{ width: "100%" }} size="large" format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="notes" label="Handover & Project Notes">
            <TextArea rows={3} placeholder="Add project handover instructions or reasons for LWD adjustment..." />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button onClick={() => setPmModalVisible(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SendOutlined />}
              style={{ background: "linear-gradient(135deg, #d97706, #b45309)" }}
            >
              Send to HR
            </Button>
          </div>
        </Form>
      </Modal>

      {/* HR / PM Comprehensive Detail Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileTextOutlined style={{ color: "#0284c7" }} />
            <span>Offboarding Request - {selectedReq?.employee_name} ({selectedReq?.employee_code})</span>
          </div>
        }
        open={!!selectedReq && !pmModalVisible}
        onCancel={() => setSelectedReq(null)}
        width={980}
        footer={[
          <Button key="close" onClick={() => setSelectedReq(null)}>
            Close
          </Button>,
        ]}
      >
        {selectedReq && (
          <div>
            {/* Top Resignation Statement */}
            <Alert
              type="warning"
              showIcon
              message={<span style={{ fontWeight: 700 }}>Resignation Statement & Reason</span>}
              description={<div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{selectedReq.reason}</div>}
              style={{ marginBottom: 18, borderRadius: 8 }}
            />

            {/* 10-Step Interactive Lifecycle Bar */}
            <OffboardingLifecycleBar
              currentStep={selectedReq.current_step}
              selectedStep={viewStep}
              onSelectStep={(stepNum) => {
                setViewStep(stepNum);
                const tabKey = STEP_TO_TAB[stepNum];
                if (tabKey) {
                  setActiveTab(tabKey);
                }
              }}
            />

            {/* If PM View -> Show PM Review Actions & Employee Details */}
            {viewMode === "pm" && (
              <Card size="small" title="Project Manager Offboarding Review & Employee Details" style={{ marginBottom: 20, background: "var(--bms-bg-elevated, rgba(217, 119, 6, 0.08))", border: "1px solid var(--bms-border, rgba(217, 119, 6, 0.2))" }}>
                <Descriptions title="Employee & Resignation Summary" bordered column={2} size="small" style={{ marginBottom: 16 }}>
                  <Descriptions.Item label="Employee">{selectedReq.employee_name}</Descriptions.Item>
                  <Descriptions.Item label="Employee Code">{selectedReq.employee_code || selectedReq.employee_id}</Descriptions.Item>
                  <Descriptions.Item label="Department">{selectedReq.department}</Descriptions.Item>
                  <Descriptions.Item label="Designation">{selectedReq.designation || "Software Engineer"}</Descriptions.Item>
                  <Descriptions.Item label="Resignation Date">{selectedReq.resignation_date}</Descriptions.Item>
                  <Descriptions.Item label="Notice Period">{selectedReq.notice_period_days || 60} Days</Descriptions.Item>
                  <Descriptions.Item label="Proposed LWD"><Tag color="blue">{selectedReq.proposed_lwd}</Tag></Descriptions.Item>
                  <Descriptions.Item label="PM Approved LWD">
                    {selectedReq.pm_approved_lwd ? <Tag color="gold" style={{ fontWeight: 700 }}>{selectedReq.pm_approved_lwd}</Tag> : <Text type="secondary">Pending PM Review</Text>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Gmail Resignation Email Proof / Screenshot" span={2}>
                    {selectedReq.resignation_proof_url ? (
                      <Button
                        type="link"
                        icon={<PictureOutlined style={{ color: "#0284c7" }} />}
                        onClick={() => {
                          setProofModalUrl(selectedReq.resignation_proof_url!);
                          setProofModalVisible(true);
                        }}
                        style={{ padding: 0, fontWeight: 700 }}
                      >
                        📷 Inspect Employee Resignation Email Screenshot Proof
                      </Button>
                    ) : (
                      <Text type="secondary">No email screenshot attached by employee</Text>
                    )}
                  </Descriptions.Item>
                </Descriptions>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 8, borderTop: "1px solid var(--bms-border, rgba(217, 119, 6, 0.15))" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--bms-text-primary)" }}>
                      PM Status: Step {selectedReq.current_step} ({selectedReq.status})
                    </div>
                    <div style={{ fontSize: 13, color: "var(--bms-text-secondary)", marginTop: 4 }}>
                      Employee Proposed LWD: <Tag color="blue">{selectedReq.proposed_lwd || "Not Set"}</Tag>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--bms-text-secondary)", marginTop: 2 }}>
                      PM Approved LWD: {selectedReq.pm_approved_lwd ? <Tag color="gold">{selectedReq.pm_approved_lwd}</Tag> : <Text type="secondary">Pending PM Review</Text>}
                    </div>
                    {selectedReq.pm_notes && (
                      <div style={{ fontSize: 13, color: "var(--bms-text-secondary)", marginTop: 2 }}>
                        PM Notes: <Text italic>{selectedReq.pm_notes}</Text>
                      </div>
                    )}
                  </div>

                  {selectedReq.current_step === 2 && (
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => {
                        pmForm.setFieldsValue({ lwd: dayjs(selectedReq.proposed_lwd), notes: "" });
                        setPmModalVisible(true);
                      }}
                      style={{ background: "linear-gradient(135deg, #d97706, #b45309)" }}
                    >
                      Review LWD & Send to HR
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {/* Multi-Tab Container (Shown to HR, Finance, PM & IT Admin) */}
            {(viewMode === "hr" || viewMode === "finance" || viewMode === "pm" || viewMode === "it_admin") && (
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  // PM view sees ONLY: PM Review + KT tabs
                  // HR/Finance/IT Admin see ALL tabs
                  ...(viewMode === "pm" ? [] : [{
                    key: "hr_review",
                    label: "HR Review",
                    children: (
                      <div>
                        <Descriptions title="Resignation & PM Approval Summary" bordered column={2} size="small" style={{ marginBottom: 20 }}>
                          <Descriptions.Item label="Employee">{selectedReq.employee_name}</Descriptions.Item>
                          <Descriptions.Item label="Employee Code">{selectedReq.employee_code || selectedReq.employee_id}</Descriptions.Item>
                          <Descriptions.Item label="Department">{selectedReq.department}</Descriptions.Item>
                          <Descriptions.Item label="Designation">{selectedReq.designation}</Descriptions.Item>
                          <Descriptions.Item label="Resignation Date">{selectedReq.resignation_date}</Descriptions.Item>
                          <Descriptions.Item label="Notice Period">{selectedReq.notice_period_days} Days</Descriptions.Item>
                          <Descriptions.Item label="Proposed LWD">{selectedReq.proposed_lwd}</Descriptions.Item>
                          <Descriptions.Item label="PM Approved LWD">
                            {selectedReq.pm_approved_lwd ? <Tag color="gold" style={{ fontWeight: 700 }}>{selectedReq.pm_approved_lwd}</Tag> : <Text type="secondary">Pending PM</Text>}
                          </Descriptions.Item>
                          <Descriptions.Item label="Gmail Resignation Email Proof / Screenshot" span={2}>
                            {selectedReq.resignation_proof_url ? (
                              <Button
                                type="link"
                                icon={<PictureOutlined style={{ color: "#0284c7" }} />}
                                onClick={() => {
                                  setProofModalUrl(selectedReq.resignation_proof_url!);
                                  setProofModalVisible(true);
                                }}
                                style={{ padding: 0, fontWeight: 700 }}
                              >
                                📷 Inspect Employee Resignation Email Screenshot Proof
                              </Button>
                            ) : (
                              <Text type="secondary">No email screenshot attached by employee</Text>
                            )}
                          </Descriptions.Item>
                        </Descriptions>

                        {!selectedReq.hr_approved ? (
                          <Card size="small" title="HR Final LWD Approval & Resignation Sign-off" style={{ background: "var(--bms-bg-elevated, #f8fafc)" }}>
                            <Form form={hrForm} layout="vertical" onFinish={handleHrApproveRequest}>
                              <Form.Item
                                name="hr_approved_lwd"
                                label="HR Approved Last Working Day (LWD)"
                                rules={[{ required: true, message: "Please select approved LWD" }]}
                              >
                                <DatePicker style={{ width: 280 }} format="YYYY-MM-DD" />
                              </Form.Item>

                              <Form.Item name="hr_notes" label="HR Review Notes">
                                <TextArea rows={2} placeholder="Add exit clearance notes or buyout approval instructions..." />
                              </Form.Item>

                              <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<CheckCircleOutlined />}
                                style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
                              >
                                Approve Resignation Request & Move to Task Setup
                              </Button>
                            </Form>
                          </Card>
                        ) : (
                          <Alert
                            type="success"
                            showIcon
                            message="Resignation Approved by HR"
                            description={`Approved LWD: ${selectedReq.approved_lwd}. Resignation request is approved and moved to Task Setup.`}
                          />
                        )}
                      </div>
                    ),
                  }]),
                  // task_setup, exit_interview, assets_return, documents, finance: hidden from PM
                  ...(viewMode !== "pm" ? [{
                    key: "task_setup",
                    label: "Task Setup Details",
                    children: (
                      <div>
                        <Paragraph style={{ fontSize: 13, color: "var(--bms-text-secondary)", marginBottom: 16 }}>
                          Review employee's active IT Assets, Facilities, and Digital accounts. Choose return & clearance actions.
                        </Paragraph>

                        <Card size="small" title="Assigned Assets & Facilities Provided (from Onboarding)" style={{ marginBottom: 20 }}>
                          <Table
                            dataSource={assignedAssets}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            columns={[
                              { title: "Asset / Facility Code", dataIndex: "assetCode", key: "assetCode", render: (c) => <Tag color="blue">{c}</Tag> },
                              { title: "Item Name", dataIndex: "itemName", key: "itemName" },
                              { title: "Category", dataIndex: "category", key: "category" },
                              { title: "Assigned Date", dataIndex: "assignedDate", key: "assignedDate" },
                              { title: "Condition", dataIndex: "condition", key: "condition" },
                            ]}
                            locale={{ emptyText: "No assigned hardware or facilities recorded for this user." }}
                          />
                        </Card>

                        <div style={{ padding: 16, background: "var(--bms-surface-2)", borderRadius: 8, border: "1px solid var(--bms-border)", marginBottom: 20 }}>
                          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                            <Checkbox
                              checked={taskSetupAssetRevoke}
                              onChange={(e) => setTaskSetupAssetRevoke(e.target.checked)}
                              style={{ fontWeight: 700, color: "var(--bms-text)" }}
                            >
                              Send IT Assets & Facilities Return Request to IT Asset Admin
                            </Checkbox>
                            <Checkbox
                              checked={taskSetupFinanceClearance}
                              onChange={(e) => setTaskSetupFinanceClearance(e.target.checked)}
                              style={{ fontWeight: 700, color: "var(--bms-text)" }}
                            >
                              Require Finance Admin Clearance (F&F Settlement, Encashment, Deductions)
                            </Checkbox>
                          </Space>
                        </div>

                        {!selectedReq.task_setup_confirmed ? (
                          <Button
                            type="primary"
                            loading={loading}
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleConfirmTaskSetup(taskSetupFinanceClearance, taskSetupAssetRevoke)}
                            style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
                          >
                            Confirm Task Setup & Move to Knowledge Transfer
                          </Button>
                        ) : (
                          <Tag color="success" style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>
                            ✓ TASK SETUP CONFIRMED (IT Return: {selectedReq.it_assets_revoke_requested ? "Requested" : "None"})
                          </Tag>
                        )}
                      </div>
                    ),
                  }] : []),
                  // Knowledge Transfer tab: visible to BOTH PM and HR
                  {
                    key: "kt",
                    label: "Knowledge Transfer",
                    children: (
                      <div>
                        <Table
                          dataSource={selectedReq.kt_items || []}
                          rowKey="id"
                          columns={[
                            { title: "Topic", dataIndex: "topic", key: "topic", render: (t) => <span style={{ fontWeight: 700 }}>{t}</span> },
                            { title: "Details / Notes", dataIndex: "details", key: "details" },
                            {
                              title: "Git / Doc Links",
                              dataIndex: "git_links",
                              key: "git_links",
                              render: (link) =>
                                link ? (
                                  <a href={link.startsWith("http") ? link : `https://${link}`} target="_blank" rel="noopener noreferrer">
                                    <Button size="small" type="link" icon={<LinkOutlined />}>
                                      Repository / Link
                                    </Button>
                                  </a>
                                ) : (
                                  <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
                                ),
                            },
                            {
                              title: "Attached Files / PDFs",
                              key: "file",
                              render: (_, record) =>
                                record.file_name ? (
                                  <Tag
                                    color="purple"
                                    icon={<FilePdfOutlined />}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => {
                                      if (record.file_url) {
                                        window.open(record.file_url, "_blank");
                                      } else {
                                        message.info(`Viewing attached document: ${record.file_name}`);
                                      }
                                    }}
                                  >
                                    {record.file_name}
                                  </Tag>
                                ) : (
                                  <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
                                ),
                            },
                            { title: "Handover Recipient", dataIndex: "submitted_to_name", key: "submitted_to_name", render: (n) => <Tag color="blue">{n || "Team Member"}</Tag> },
                          ]}
                          locale={{ emptyText: "No Knowledge Transfer topics submitted by employee yet." }}
                          style={{ marginBottom: 20 }}
                        />

                        {(!selectedReq.kt_items || selectedReq.kt_items.length === 0) ? (
                          <div>
                            <Alert
                              type="warning"
                              showIcon
                              icon={<ClockCircleOutlined style={{ fontSize: 20 }} />}
                              message={<span style={{ fontWeight: 700, fontSize: 14 }}>Waiting for Employee KT Submission</span>}
                              description="The employee has not submitted Knowledge Transfer topics in My Offboarding yet. Project Manager & HR can acknowledge once employee submits KT."
                              style={{ borderRadius: 8, padding: 16, marginBottom: 16 }}
                            />
                            {!selectedReq.pm_kt_acknowledged && (
                              <Button
                                type="primary"
                                disabled={true}
                                icon={<CheckCircleOutlined />}
                              >
                                Acknowledge Knowledge Transfer (Project Manager)
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div>
                            {!selectedReq.pm_kt_acknowledged ? (
                              <Button
                                type="primary"
                                loading={loading}
                                icon={<CheckCircleOutlined />}
                                onClick={handlePmAcknowledgeKt}
                                style={{ background: "linear-gradient(135deg, #d97706, #b45309)" }}
                              >
                                Acknowledge Knowledge Transfer (Project Manager)
                              </Button>
                            ) : (
                              <div>
                                <div style={{ marginTop: 12, marginBottom: 16 }}>
                                  <Tag color="success" style={{ padding: "4px 10px", fontSize: 13 }}>
                                    ✓ ACKNOWLEDGED BY PROJECT MANAGER
                                  </Tag>
                                </div>

                                {!selectedReq.hr_kt_acknowledged ? (
                                  <Button
                                    type="primary"
                                    loading={loading}
                                    icon={<CheckCircleOutlined />}
                                    onClick={handleHrAcknowledgeKt}
                                    style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
                                  >
                                    Final HR Acknowledge & Proceed to Exit Interview
                                  </Button>
                                ) : (
                                  <Tag color="success" style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>
                                    ✓ FINAL HR KT ACKNOWLEDGED
                                  </Tag>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  // exit_interview, assets_return, documents, finance: hidden from PM view
                  ...(viewMode !== "pm" ? [{
                    key: "exit_interview",
                    label: "Exit Interview",
                    children: (
                      <div>
                        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Title level={5} style={{ margin: 0 }}>Exit Interview Questions & Responses</Title>
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              let inputVal = "";
                              Modal.confirm({
                                title: "Add Custom Exit Interview Question",
                                content: (
                                  <Input.TextArea
                                    rows={3}
                                    placeholder="Enter custom exit interview question..."
                                    onChange={(e) => { inputVal = e.target.value; }}
                                  />
                                ),
                                onOk: async () => {
                                  const qVal = inputVal.trim();
                                  if (qVal) {
                                    setCustomExitQuestions((prev) => [...prev, qVal]);
                                    if (selectedReq && selectedReq.exit_interview_sent) {
                                      const updated = await offboardingStore.addExitQuestion(selectedReq.id, qVal);
                                      setSelectedReq(updated);
                                    }
                                    message.success("New exit interview question added!");
                                  }
                                },
                              });
                            }}
                          >
                            Add New Question
                          </Button>
                        </div>

                        {!selectedReq.exit_interview_sent ? (
                          <Card size="small" title="Configure & Send Exit Interview Questions to Employee">
                            <Form form={exitQuestionForm} layout="vertical" onFinish={handleSendExitQuestions}>
                              <Form.Item
                                name="q1"
                                label="Question 1"
                                initialValue="What are your primary reasons for leaving the organization?"
                              >
                                <Input />
                              </Form.Item>
                              <Form.Item
                                name="q2"
                                label="Question 2"
                                initialValue="How would you rate management support and team culture during your tenure?"
                              >
                                <Input />
                              </Form.Item>
                              <Form.Item
                                name="q3"
                                label="Question 3"
                                initialValue="What suggestions do you have for improving our workplace environment?"
                              >
                                <Input />
                              </Form.Item>

                              {customExitQuestions.map((qText, idx) => (
                                <Form.Item
                                  key={`cq_${idx}`}
                                  name={`custom_q_${idx}`}
                                  label={`Question ${4 + idx}`}
                                  initialValue={qText}
                                >
                                  <Input
                                    onChange={(e) => {
                                      const updated = [...customExitQuestions];
                                      updated[idx] = e.target.value;
                                      setCustomExitQuestions(updated);
                                    }}
                                  />
                                </Form.Item>
                              ))}

                              <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<SendOutlined />}
                                style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)", marginTop: 12 }}
                              >
                                Send Exit Interview Questions to Employee ({3 + customExitQuestions.length} Questions)
                              </Button>
                            </Form>
                          </Card>
                        ) : (
                          <div>
                            <Alert
                              type="info"
                              showIcon
                              message="Exit Interview Questions Sent"
                              description={`Status: ${selectedReq.exit_interview_completed ? "✓ Employee Answered" : "⏳ Pending Employee Response"}`}
                              style={{ marginBottom: 16 }}
                            />

                            {selectedReq.exit_questions && selectedReq.exit_questions.length > 0 && (
                              <Card size="small" title="Employee Exit Interview Responses" style={{ marginBottom: 20 }}>
                                <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 6 }}>
                                  {selectedReq.exit_questions.map((q, idx) => (
                                    <div key={q.id} style={{ marginBottom: 16 }}>
                                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--bms-text)" }}>
                                        Q{idx + 1}: {q.question_text}
                                      </div>
                                      <div style={{ marginTop: 4, padding: "8px 12px", background: "var(--bms-surface-2)", borderRadius: 6, border: "1px solid var(--bms-border)", color: "var(--bms-text)" }}>
                                        {q.answers && q.answers.length > 0 ? (
                                          q.answers[0].answer_text
                                        ) : (
                                          <Text type="secondary" style={{ fontStyle: "italic" }}>No response submitted yet.</Text>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                            )}

                            {!selectedReq.exit_interview_approved ? (
                              <div>
                                {!selectedReq.exit_interview_completed && (
                                  <Alert
                                    type="warning"
                                    showIcon
                                    message="Waiting for Employee Exit Interview Answers"
                                    description="The employee has not submitted answers to the exit interview questions yet. HR approval will be enabled once answers are submitted."
                                    style={{ marginBottom: 16 }}
                                  />
                                )}
                                <Button
                                  type="primary"
                                  loading={loading}
                                  disabled={!selectedReq.exit_interview_completed}
                                  icon={<CheckCircleOutlined />}
                                  onClick={handleApproveExitInterview}
                                  style={{ background: selectedReq.exit_interview_completed ? "linear-gradient(135deg, #0284c7, #0369a1)" : undefined }}
                                >
                                  Approve Exit Interview & Move to IT Assets & Facilities Return
                                </Button>
                              </div>
                            ) : (
                              <Tag color="success" style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>
                                ✓ EXIT INTERVIEW APPROVED BY HR
                              </Tag>
                            )}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "assets_return",
                    label: "IT Assets & Facilities",
                    children: (
                      <div>
                        <Card size="small" title={`Assigned IT Assets & Facilities — ${selectedReq.employee_name}`} style={{ marginBottom: 20 }}>
                          <Table
                            dataSource={assignedAssets}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            columns={[
                              { title: "Asset Code", dataIndex: "assetCode", key: "assetCode", render: (c) => <Tag color="blue">{c}</Tag> },
                              { title: "Item Name", dataIndex: "itemName", key: "itemName" },
                              { title: "Category", dataIndex: "category", key: "category" },
                              { title: "Assigned Date", dataIndex: "assignedDate", key: "assignedDate" },
                              { title: "Status", key: "status", render: () => <Tag color={selectedReq.it_assets_revoked ? "success" : "warning"}>{selectedReq.it_assets_revoked ? "Returned" : "Pending IT Admin Return"}</Tag> },
                            ]}
                            locale={{ emptyText: "No active assets or facilities allocated." }}
                          />
                        </Card>

                        {!selectedReq.it_assets_revoked ? (
                          <Alert
                            type="warning"
                            showIcon
                            icon={<ClockCircleOutlined style={{ fontSize: 20 }} />}
                            message={<span style={{ fontWeight: 700, fontSize: 14 }}>Waiting for IT Asset Admin Return Confirmation</span>}
                            description="IT Assets & Facilities return request has been sent to IT Asset Admin. Once the IT Asset Admin confirms the return of hardware and facilities, the status will automatically update to Returned and the workflow line will advance to Documents Issued."
                            style={{ borderRadius: 8, padding: 16 }}
                          />
                        ) : (
                          <Alert
                            type="success"
                            showIcon
                            message="IT Assets & Facilities Confirmed Returned"
                            description="IT Asset Admin has confirmed return of all assigned hardware, facilities, and access. Workflow line advanced to Step 8: Documents Issued."
                          />
                        )}
                      </div>
                    ),
                  },

                  {
                    key: "documents",
                    label: "Documents Issued",
                    children: (
                      <div>
                        <Card
                          size="small"
                          title="Exit Clearance Documents to Issue"
                          extra={
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                let docTitle = "";
                                let docDesc = "";
                                Modal.confirm({
                                  title: "Add Custom Clearance Document to Issue",
                                  content: (
                                    <Form layout="vertical" style={{ marginTop: 12 }}>
                                      <Form.Item label="Document Title" required>
                                        <Input
                                          placeholder="e.g. Non-Disclosure Agreement Clearance / NDA Release"
                                          onChange={(e) => { docTitle = e.target.value; }}
                                        />
                                      </Form.Item>
                                      <Form.Item label="Document Description">
                                        <Input
                                          placeholder="e.g. Official confirmation of IP and NDA handover compliance."
                                          onChange={(e) => { docDesc = e.target.value; }}
                                        />
                                      </Form.Item>
                                    </Form>
                                  ),
                                  onOk: () => {
                                    if (docTitle.trim()) {
                                      setCustomDocuments((prev) => [
                                        ...prev,
                                        {
                                          id: `doc-${Date.now()}`,
                                          title: docTitle.trim(),
                                          desc: docDesc.trim() || "Clearance document issued by HR.",
                                        },
                                      ]);
                                      message.success(`Added document "${docTitle.trim()}" to issue list!`);
                                    }
                                  },
                                });
                              }}
                            >
                              Add New Document
                            </Button>
                          }
                          style={{ marginBottom: 20 }}
                        >
                          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-surface-2)", borderRadius: 6, border: "1px solid var(--bms-border)" }}>
                              <div>
                                <div style={{ fontWeight: 700, color: "var(--bms-text)" }}>📄 Relieving Letter</div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Official company relieving document with last working day confirmation.</Text>
                              </div>
                              <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("relieving", selectedReq, "Relieving Letter - " + selectedReq.employee_name)}>
                                Generate / Issue
                              </Button>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-surface-2)", borderRadius: 6, border: "1px solid var(--bms-border)" }}>
                              <div>
                                <div style={{ fontWeight: 700, color: "var(--bms-text)" }}>📜 Service Certificate & Experience Letter</div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Certificate verifying tenure, designation, and conduct.</Text>
                              </div>
                              <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("experience", selectedReq, "Service Certificate - " + selectedReq.employee_name)}>
                                Generate / Issue
                              </Button>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-surface-2)", borderRadius: 6, border: "1px solid var(--bms-border)" }}>
                              <div>
                                <div style={{ fontWeight: 700, color: "var(--bms-text)" }}>🧾 No Dues Clearance Certificate</div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Consolidated clearance certificate across IT, HR, and Operations.</Text>
                              </div>
                              <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("nodues", selectedReq, "No Dues Certificate - " + selectedReq.employee_name)}>
                                Generate / Issue
                              </Button>
                            </div>

                            {customDocuments.map((cd) => (
                              <div key={cd.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-surface-2)", borderRadius: 6, border: "1px solid var(--bms-border)" }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: "var(--bms-text)" }}>📑 {cd.title}</div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>{cd.desc}</Text>
                                </div>
                                <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("nodues", selectedReq, `${cd.title} - ${selectedReq.employee_name}`)}>
                                  Generate / Issue
                                </Button>
                              </div>
                            ))}
                          </Space>
                        </Card>

                        {!selectedReq.documents_issued ? (
                          <Button
                            type="primary"
                            loading={loading}
                            icon={<CheckCircleOutlined />}
                            onClick={async () => {
                              try {
                                setLoading(true);
                                const updated = await offboardingStore.issueDocuments(selectedReq.id, user?.full_name || "HR Manager");
                                message.success(`Documents issued! Moved to ${updated.finance_clearance_required ? "Step 9: Finance Clearance." : "Step 10: Completed!"}`);
                                setSelectedReq(updated);
                                setViewStep(updated.current_step);
                                if (updated.finance_clearance_required) setActiveTab("finance");
                              } catch (e: any) {
                                message.error(e.message || "Failed to issue documents.");
                              } finally {
                                setLoading(false);
                              }
                            }}
                            style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
                          >
                            Issue Documents
                          </Button>
) : (
                          <Tag color="success" style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>
                            ✓ RELIEVING LETTER & SERVICE CERTIFICATE ISSUED
                          </Tag>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "finance",
                    label: "Finance Clearance",
                    children: (
                      <div>
                        {/* ─── Employee Info ─── */}
                        <Descriptions title="Employee Information & Designation" bordered column={2} size="small" style={{ marginBottom: 16 }}>
                          <Descriptions.Item label="Employee Code & Name">{selectedReq.employee_name} ({selectedReq.employee_code || selectedReq.employee_id})</Descriptions.Item>
                          <Descriptions.Item label="Department & Role">{selectedReq.department} — {selectedReq.designation || "Software Engineer"}</Descriptions.Item>
                          <Descriptions.Item label="Resignation & Approved LWD">Resigned: {selectedReq.resignation_date} | LWD: {selectedReq.approved_lwd || selectedReq.proposed_lwd}</Descriptions.Item>
                          <Descriptions.Item label="Notice Period">{selectedReq.notice_period_days || 60} Days (Standard Policy)</Descriptions.Item>
                        </Descriptions>

                        {/* ─── HRMS Payroll Real Data Card ─── */}
                        <Card
                          size="small"
                          title={
                            <Space>
                              <DollarOutlined style={{ color: "#16a34a" }} />
                              <span style={{ fontWeight: 700 }}>HRMS Monthly Payroll Master Record — {selectedReq.employee_name}</span>
                            </Space>
                          }
                          style={{ marginBottom: 20, background: "var(--bms-bg-elevated, #f8fafc)", border: "1px solid var(--bms-border, #e2e8f0)" }}
                        >
                          {empPayroll ? (
                            <Descriptions bordered size="small" column={3}>
                              <Descriptions.Item label="Basic Salary">₹{Number(empPayroll.basic_salary || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Descriptions.Item>
                              <Descriptions.Item label="HRA">₹{Number(empPayroll.hra || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Descriptions.Item>
                              <Descriptions.Item label="Allowances">₹{Number(empPayroll.allowances || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Descriptions.Item>
                              <Descriptions.Item label="Gross Monthly Earnings">
                                <Text type="success" style={{ fontWeight: 700 }}>
                                  ₹{Number(empPayroll.gross_total || (Number(empPayroll.basic_salary) + Number(empPayroll.hra || 0) + Number(empPayroll.allowances || 0))).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </Text>
                              </Descriptions.Item>
                              <Descriptions.Item label="PF Deduction">₹{Number(empPayroll.pf || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Descriptions.Item>
                              <Descriptions.Item label="TDS / Tax Deduction">₹{Number(empPayroll.tds || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Descriptions.Item>
                              <Descriptions.Item label="Net Monthly Salary Credited">
                                <Text style={{ fontWeight: 800, color: "#0284c7" }}>
                                  ₹{Number(empPayroll.net_salary || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </Text>
                              </Descriptions.Item>
                              <Descriptions.Item label="Payroll Bank Account">{empPayroll.account_number ? `${empPayroll.account_number} (${empPayroll.bank_name || "Bank"})` : "Acc: ACC-99201 (HDFC Bank)"}</Descriptions.Item>
                              <Descriptions.Item label="Payment Mode"><Tag color="blue">{empPayroll.payment_mode || "Direct Bank Transfer"}</Tag></Descriptions.Item>
                            </Descriptions>
                          ) : (
                            <div>
                              <Alert
                                type="info"
                                showIcon
                                message="Default HRMS Payroll Record Selected"
                                description="Standard Monthly Base Salary pre-filled at ₹65,000.00. Finance Admin can customize the base, additions, and deductions below."
                                style={{ marginBottom: 12 }}
                              />
                              <Descriptions bordered size="small" column={3}>
                                <Descriptions.Item label="Basic Salary">₹50,000.00</Descriptions.Item>
                                <Descriptions.Item label="HRA & Allowances">₹15,000.00</Descriptions.Item>
                                <Descriptions.Item label="Gross Monthly Earnings">₹65,000.00</Descriptions.Item>
                                <Descriptions.Item label="PF Deduction">₹6,000.00</Descriptions.Item>
                                <Descriptions.Item label="TDS Deduction">₹2,500.00</Descriptions.Item>
                                <Descriptions.Item label="Net Monthly Salary Credited">₹56,500.00</Descriptions.Item>
                                <Descriptions.Item label="Payroll Bank Account">ACC-99201 (HDFC Bank)</Descriptions.Item>
                                <Descriptions.Item label="Payment Mode"><Tag color="blue">Direct Bank Transfer</Tag></Descriptions.Item>
                              </Descriptions>
                            </div>
                          )}
                        </Card>

                        {/* ─── Full & Final (F&F) Settlement Table with Real Salary, Additions/Deductions & Reasons ─── */}
                        <Card
                          size="small"
                          title={
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: 700, fontSize: 14 }}>
                                💰 Full & Final (F&F) Settlement Breakdown — {selectedReq.employee_name}
                              </span>
                              <Tag color="blue">Step 9: Finance Clearance</Tag>
                            </div>
                          }
                          style={{ marginBottom: 20, background: "var(--bms-bg-elevated, rgba(2, 132, 199, 0.08))", border: "1px solid var(--bms-border, rgba(2, 132, 199, 0.2))" }}
                        >
                          <Table
                            pagination={false}
                            size="small"
                            dataSource={[
                              {
                                key: "1",
                                component: "Real Monthly Salary Credited (HRMS Payroll)",
                                amount: empPayroll ? Number(empPayroll.net_salary || empPayroll.gross_total || 65000) : (financeBaseSalary || 65000),
                                reason: empPayroll
                                  ? `Credited via ${empPayroll.payment_mode || "Direct Transfer"} to ${empPayroll.account_number || "Acc: ACC-99201"} (${empPayroll.bank_name || "HDFC Bank"})`
                                  : "Standard Monthly Base Salary Credited from HRMS Payroll",
                                type: "base",
                              },
                              {
                                key: "2",
                                component: "Additions (Leave Encashment / Bonus / Claims)",
                                amount: financeAdditions,
                                reason: financeAdditionsReason || "12 Days Unused Leave Encashment & Performance Bonus",
                                type: "addition",
                              },
                              {
                                key: "3",
                                component: "Deductions (Asset Damage / Shortage / Notice Buyout)",
                                amount: financeDeductions,
                                reason: financeDeductionsReason || "Asset Damage / Notice Buyout Shortage",
                                type: "deduction",
                              },
                              {
                                key: "4",
                                component: "Calculated Net Final Settlement Amount",
                                amount: ((empPayroll ? Number(empPayroll.net_salary || empPayroll.gross_total || 65000) : financeBaseSalary) + financeAdditions - financeDeductions),
                                reason: "Final Net Amount Payable to Employee upon Exit Clearance",
                                type: "net",
                              },
                            ]}
                            columns={[
                              {
                                title: "Settlement Component",
                                dataIndex: "component",
                                key: "component",
                                render: (text, r: any) => (
                                  <span style={{ fontWeight: r.type === "net" ? 800 : 600, fontSize: r.type === "net" ? 14 : 13 }}>
                                    {text}
                                  </span>
                                ),
                              },
                              {
                                title: "Amount (₹)",
                                dataIndex: "amount",
                                key: "amount",
                                render: (amt: any, r: any) => (
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      fontSize: r.type === "net" ? 16 : 13,
                                      color: r.type === "addition" ? "#16a34a" : r.type === "deduction" ? "#dc2626" : r.type === "net" ? "#0284c7" : "#1e293b",
                                    }}
                                  >
                                    {r.type === "addition" ? "+ " : r.type === "deduction" ? "- " : ""}
                                    ₹{Number(amt || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </span>
                                ),
                              },
                              {
                                title: "Reason / Details",
                                dataIndex: "reason",
                                key: "reason",
                                render: (text) => <span style={{ color: "#475569" }}>{text}</span>,
                              },
                            ]}
                          />
                        </Card>

                        {/* ─── Finance Admin Editable Form ─── */}
                        {((viewMode as string) === "finance" || isFinanceAdmin) && (
                          <Card size="small" title="✏️ Finance Admin — Specify Additions/Deductions Reasons & Submit Clearance" style={{ marginBottom: 20 }}>
                            <Form layout="vertical">
                              <Row gutter={16}>
                                <Col span={8}>
                                  <Form.Item label={`Base Monthly Salary Credited (HRMS Basic: ₹${empPayroll ? Number(empPayroll.basic_salary || empPayroll.net_salary || 0).toLocaleString("en-IN") : "65,000"})`} required>
                                    <InputNumber
                                      style={{ width: "100%" }}
                                      value={financeBaseSalary}
                                      min={0}
                                      formatter={(v) => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                      parser={(v) => Number((v || "").replace(/₹\s?|(,*)/g, ""))}
                                      onChange={(v) => setFinanceBaseSalary(v ?? 65000)}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={8}>
                                  <Form.Item label="Additions / Leave Encashment (₹)">
                                    <InputNumber
                                      style={{ width: "100%" }}
                                      value={financeAdditions}
                                      min={0}
                                      formatter={(v) => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                      parser={(v) => Number((v || "").replace(/₹\s?|(,*)/g, ""))}
                                      onChange={(v) => setFinanceAdditions(v ?? 0)}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={8}>
                                  <Form.Item label="Additions Reason / Description">
                                    <Input
                                      value={financeAdditionsReason}
                                      onChange={(e) => setFinanceAdditionsReason(e.target.value)}
                                      placeholder="e.g. 12 days leave encashment + performance bonus"
                                    />
                                  </Form.Item>
                                </Col>
                              </Row>

                              <Row gutter={16}>
                                <Col span={8}>
                                  <Form.Item label="Deductions / Damaged Asset / Shortage (₹)">
                                    <InputNumber
                                      style={{ width: "100%" }}
                                      value={financeDeductions}
                                      min={0}
                                      formatter={(v) => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                      parser={(v) => Number((v || "").replace(/₹\s?|(,*)/g, ""))}
                                      onChange={(v) => setFinanceDeductions(v ?? 0)}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={16}>
                                  <Form.Item label="Deductions Reason / Description">
                                    <Input
                                      value={financeDeductionsReason}
                                      onChange={(e) => setFinanceDeductionsReason(e.target.value)}
                                      placeholder="e.g. Missing laptop charger & 3 days notice period buyout shortage"
                                    />
                                  </Form.Item>
                                </Col>
                              </Row>

                              <Form.Item label="Finance Clearance & Settlement Remarks">
                                <TextArea
                                  rows={2}
                                  value={financeNotes || selectedReq.finance_notes || ""}
                                  onChange={(e) => setFinanceNotes(e.target.value)}
                                  placeholder="e.g. Verified 12 days leave encashment; No pending expense claims."
                                />
                              </Form.Item>

                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0fdf4", padding: "12px 16px", borderRadius: 8, marginBottom: 16 }}>
                                <Text style={{ fontWeight: 700, fontSize: 14 }}>
                                  Net Final Settlement Payable: ₹{((empPayroll ? Number(empPayroll.net_salary || empPayroll.gross_total || 65000) : financeBaseSalary) + financeAdditions - financeDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </Text>
                                <Button
                                  type="primary"
                                  loading={loading}
                                  icon={<CheckCircleOutlined />}
                                  onClick={async () => {
                                    try {
                                      setLoading(true);
                                      const baseAmt = empPayroll ? Number(empPayroll.net_salary || empPayroll.gross_total || 65000) : financeBaseSalary;
                                      const net = baseAmt + financeAdditions - financeDeductions;
                                      const notesWithReasons = `Additions (${financeAdditionsReason || "Leave Encashment"}): ₹${financeAdditions}; Deductions (${financeDeductionsReason || "None"}): ₹${financeDeductions}. Notes: ${financeNotes}`;
                                      const updated = await offboardingStore.completeFinanceClearance(selectedReq.id, {
                                        actionBy: user?.full_name || "Finance Admin",
                                        notes: notesWithReasons,
                                        base_salary: baseAmt,
                                        additions: financeAdditions,
                                        deductions: financeDeductions,
                                        net_amount: net,
                                      });
                                      message.success("Finance clearance & F&F settlement submitted! Sent to HR Finance Clearance.");
                                      setSelectedReq(updated);
                                    } catch (e: any) {
                                      message.error(e.message || "Failed to submit finance clearance.");
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                  style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                                >
                                  Send Finance Clearance Done to HR
                                </Button>
                              </div>
                            </Form>
                          </Card>
                        )}

                        {/* HR / Admin Confirmation Controls (Only shown to HR) */}
                        {selectedReq.status !== "completed" ? (
                          ((viewMode as string) === "hr" || isHR) && (
                            <div>
                              {!selectedReq.finance_cleared ? (
                                <Alert
                                  type="warning"
                                  showIcon
                                  message="Waiting for Finance Admin Clearance"
                                  description="Finance Admin is calculating the Full & Final (F&F) salary settlement, encashment, and deductions. Once submitted by Finance Admin, HR can review and confirm."
                                  style={{ marginBottom: 16 }}
                                />
                              ) : (
                                <div>
                                  <Alert
                                    type="success"
                                    showIcon
                                    message="Finance Clearance Received from Finance Admin"
                                    description={
                                      <div>
                                        <div><strong>Base Salary Credited:</strong> ₹{Number(selectedReq.finance_base_salary || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} | <strong>Additions:</strong> ₹{Number(selectedReq.finance_additions || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} | <strong>Deductions:</strong> ₹{Number(selectedReq.finance_deductions || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                                        <div style={{ marginTop: 4 }}><strong>Calculated Net Final Settlement:</strong> <span style={{ color: "#0284c7", fontWeight: 700 }}>₹{Number(selectedReq.finance_net_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                                        <div style={{ marginTop: 4 }}><strong>Remarks & Reasons:</strong> {selectedReq.finance_notes || "All payroll checks verified."}</div>
                                      </div>
                                    }
                                    style={{ marginBottom: 16 }}
                                  />
                                  <Button
                                    type="primary"
                                    loading={loading}
                                    icon={<CheckCircleOutlined />}
                                    onClick={async () => {
                                      try {
                                        setLoading(true);
                                        const updated = await offboardingStore.hrConfirmFinance(selectedReq.id, user?.full_name || "HR Manager");
                                        message.success("Finance clearance confirmed by HR! Offboarding is 100% COMPLETED 🎉.");
                                        setSelectedReq(updated);
                                        setViewStep(10);
                                      } catch (e: any) {
                                        message.error(e.message || "Failed to confirm finance clearance.");
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                                  >
                                    Confirm Finance Clearance & Complete Offboarding
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <Alert
                            type="success"
                            showIcon
                            message="Offboarding 100% Completed"
                            description={`F&F Net Settlement Amount: ₹${Number(selectedReq.finance_net_amount || (financeBaseSalary + financeAdditions - financeDeductions)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`}
                          />
                        )}
                      </div>
                    ),
                  }] : []),
                ]}
              />
            )}

          </div>
        )}
      </Modal>

      {/* IT Asset Admin Return Confirmation Modal */}
      <Modal
        title={`IT Assets & Facilities Return Request — ${itRevokeTargetReq?.employee_name}`}
        open={itRevokeModalVisible}
        onCancel={() => setItRevokeModalVisible(false)}
        footer={null}
      >
        {itRevokeTargetReq && (
          <div>
            <Descriptions title="Employee Assets Return Details" bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Employee">{itRevokeTargetReq.employee_name} ({itRevokeTargetReq.employee_code})</Descriptions.Item>
              <Descriptions.Item label="Department & Role">{itRevokeTargetReq.department} - {itRevokeTargetReq.designation}</Descriptions.Item>
              <Descriptions.Item label="Approved LWD">{itRevokeTargetReq.approved_lwd || itRevokeTargetReq.proposed_lwd}</Descriptions.Item>
              <Descriptions.Item label="Return Status">
                <Tag color={itRevokeTargetReq.it_assets_revoked ? "success" : "warning"}>
                  {itRevokeTargetReq.it_assets_revoked ? "Returned" : "Pending IT Return"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Assigned Hardware & Facilities to Return (from Onboarding)" style={{ marginBottom: 20 }}>
              <Table
                dataSource={itAssetStore.getEmployeeAssets(itRevokeTargetReq.employee_id)}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: "Code", dataIndex: "assetCode", key: "assetCode", render: (c) => <Tag color="blue">{c}</Tag> },
                  { title: "Item Name", dataIndex: "itemName", key: "itemName" },
                  { title: "Category", dataIndex: "category", key: "category" },
                  { title: "Assigned Date", dataIndex: "assignedDate", key: "assignedDate" },
                ]}
                locale={{ emptyText: "Standard IT equipment and facilities access badge." }}
              />
            </Card>

            {!itRevokeTargetReq.it_assets_revoked ? (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button onClick={() => setItRevokeModalVisible(false)}>Cancel</Button>
                <Button
                  type="primary"
                  loading={loading}
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleConfirmAssetRevoke(itRevokeTargetReq)}
                  style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
                >
                  Confirm Return of All IT Assets & Facilities
                </Button>
              </div>
            ) : (
              <Alert
                type="success"
                showIcon
                message="Assets Returned"
                description="Hardware and facilities access has already been returned for this employee."
              />
            )}
          </div>
        )}
      </Modal>

      {/* Resignation Email Screenshot Preview Modal for PM & HR */}
      <Modal
        title={
          <Space>
            <PictureOutlined style={{ color: "#0284c7", fontSize: 20 }} />
            <span>Employee Resignation Gmail Screenshot / Proof</span>
          </Space>
        }
        open={proofModalVisible}
        onCancel={() => setProofModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setProofModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={720}
      >
        <div style={{ textAlign: "center", padding: 16 }}>
          {proofModalUrl ? (
            proofModalUrl.startsWith("data:application/pdf") ? (
              <iframe src={proofModalUrl} style={{ width: "100%", height: 500, border: "none" }} title="Resignation Proof PDF" />
            ) : (
              <img
                src={proofModalUrl}
                alt="Resignation Email Proof Screenshot"
                style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
              />
            )
          ) : (
            <Text type="secondary">No screenshot proof available to view.</Text>
          )}
        </div>
      </Modal>
    </div>
  );
}

