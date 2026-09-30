import React, { useEffect, useState } from "react";
import {
  Card,
  Typography,
  Button,
  Form,
  Input,
  DatePicker,
  Alert,
  Tag,
  Divider,
  Descriptions,
  message,
  Timeline,
  Select,
  Table,
  Modal,
  Space,
  Upload,
} from "antd";
import {
  FileTextOutlined,
  UserOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  BookOutlined,
  PlusOutlined,
  LockOutlined,
  SendOutlined,
  DownloadOutlined,
  UploadOutlined,
  LinkOutlined,
  FilePdfOutlined,
  MailOutlined,
  FileImageOutlined,
  PictureOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuthStore } from "@/store/auth";
import { offboardingStore } from "@/store/offboardingStore";
import { employeeApi, type SimpleDropdownEmployee } from "@/services/employees";
import { OffboardingLifecycleBar, LIFECYCLE_STEPS } from "@/components/offboarding/OffboardingLifecycleBar";
import { offboardingApi, type OffboardingRequest } from "@/services/offboarding";
import { openAndPrintDocument } from "@/utils/offboardingDocumentGenerator";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function MyOffboardingPortalPage() {
  const user = useAuthStore((s) => s.user);
  const empId = user?.employee_code || user?.id || "EMP-1001";
  const empName = user?.full_name || user?.username || "Employee";

  const [req, setReq] = useState<OffboardingRequest | undefined>(undefined);
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [employeesList, setEmployeesList] = useState<SimpleDropdownEmployee[]>([]);
  const [form] = Form.useForm();
  const [ktForm] = Form.useForm();
  const [exitForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [ktModalVisible, setKtModalVisible] = useState(false);
  const [ktFileList, setKtFileList] = useState<any[]>([]);
  const [noticeDays, setNoticeDays] = useState<number>(offboardingStore.getNoticeDays());
  const [gmailModalOpen, setGmailModalOpen] = useState(false);
  const [hrEmail, setHrEmail] = useState("hr@hackersinfotech.com");
  const [resignationProofUrl, setResignationProofUrl] = useState<string>("");
  const [proofFileList, setProofFileList] = useState<any[]>([]);
  const [uploadProofModalOpen, setUploadProofModalOpen] = useState(false);
  const [previewProofModalOpen, setPreviewProofModalOpen] = useState(false);

  const reloadData = () => {
    const existing = offboardingStore.getRequestByEmployeeId(empId);
    setReq(existing);
    setNoticeDays(offboardingStore.getNoticeDays());
    if (existing) {
      setSelectedStep(existing.current_step);
    }
  };

  useEffect(() => {
    // Directly fetch latest Notice Period Policy from Master backend
    offboardingApi.getNoticePeriodPolicy().then((pol) => {
      if (pol && pol.notice_period_days) {
        const daysNum = Number(pol.notice_period_days);
        setNoticeDays(daysNum);
        offboardingStore.setNoticeDays(daysNum);
        const currentResDate = form.getFieldValue("resignation_date") || dayjs();
        form.setFieldsValue({
          resignation_date: currentResDate,
          proposed_lwd: currentResDate.add(daysNum, "day"),
        });
      }
    }).catch(() => {});

    if (user) {
      offboardingStore.syncWithBackend();
    }
    reloadData();
    window.addEventListener("nexus-notice-period-updated", reloadData);
    const unsub = offboardingStore.subscribe(reloadData);
    return () => {
      window.removeEventListener("nexus-notice-period-updated", reloadData);
      unsub();
    };
  }, [empId]);

  useEffect(() => {
    const currentResDate = form.getFieldValue("resignation_date") || dayjs();
    form.setFieldsValue({
      resignation_date: currentResDate,
      proposed_lwd: currentResDate.add(noticeDays, "day"),
    });
  }, [noticeDays]);

  // Load real employee data for KT handover recipient dropdown
  useEffect(() => {
    employeeApi.simpleDropdown()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setEmployeesList(list);
        } else {
          employeeApi.list().then((res: any) => {
            const rawList = Array.isArray(res) ? res : res?.results || [];
            setEmployeesList(rawList.map((e: any) => ({
              id: String(e.id),
              keycloak_id: e.keycloak_id || null,
              email: e.email || "",
              full_name: e.full_name || `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.username,
              employee_code: e.employee_code || e.id,
              designation_name: e.designation || null,
            })));
          });
        }
      })
      .catch(() => {
        // Fallback
        setEmployeesList([
          { id: "EMP-2001", keycloak_id: null, email: "karthick@example.com", full_name: "Karthick Sankaran", employee_code: "EMP-2001", designation_name: "Lead Engineer" },
          { id: "EMP-2002", keycloak_id: null, email: "anand@example.com", full_name: "Anand Kumar", employee_code: "EMP-2002", designation_name: "Senior Developer" },
          { id: "EMP-2003", keycloak_id: null, email: "priya@example.com", full_name: "Priya Sharma", employee_code: "EMP-2003", designation_name: "QA Lead" },
        ]);
      });
  }, []);

  const defaultResignationDate = dayjs();
  const defaultProposedLwd = dayjs().add(noticeDays, "day");

  const handleResignationDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      const calculatedLwd = date.add(noticeDays, "day");
      form.setFieldsValue({ proposed_lwd: calculatedLwd });
    }
  };

  const handleSubmitResignation = async (values: any) => {
    setSubmitting(true);
    try {
      const resDate = values.resignation_date.format("YYYY-MM-DD");
      const lwdDate = values.proposed_lwd ? values.proposed_lwd.format("YYYY-MM-DD") : dayjs(resDate).add(noticeDays, "day").format("YYYY-MM-DD");

      const created = await offboardingStore.submitResignation({
        employee_id: String(empId),
        employee_name: empName,
        employee_code: user?.employee_code || empId,
        department: user?.department || "Engineering",
        designation: user?.designation || "Software Engineer",
        joining_date: user?.joining_date || "2023-01-15",
        reporting_manager_id: "PM-101",
        reporting_manager_name: "Project Manager",
        resignation_date: resDate,
        proposed_lwd: lwdDate,
        reason: values.reason,
        resignation_proof_url: resignationProofUrl,
      });

      message.success("Resignation request submitted successfully! Sent to Project Manager for review.");
      setReq(created);
      setSelectedStep(created.current_step);
    } catch (e: any) {
      message.error(e.message || "Failed to submit resignation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddKt = async (values: any) => {
    if (!req) return;
    setSubmitting(true);
    try {
      const selectedEmp = employeesList.find((e) => e.id === values.submitted_to_id || e.full_name === values.submitted_to_name);
      const recipientName = selectedEmp ? `${selectedEmp.full_name} (${selectedEmp.employee_code})` : (values.submitted_to_name || "Team Member");
      const recipientId = selectedEmp ? selectedEmp.id : (values.submitted_to_id || "EMP-2002");

      let fileName = "";
      let fileUrl = "";
      if (ktFileList.length > 0) {
        const file = ktFileList[0];
        fileName = file.name;
        fileUrl = URL.createObjectURL(file);
      }

      await offboardingStore.submitKt(
        req.id,
        values.topic,
        values.details,
        recipientId,
        recipientName,
        values.git_links,
        fileName,
        fileUrl
      );
      message.success("Knowledge Transfer topic submitted successfully!");
      setKtModalVisible(false);
      setKtFileList([]);
      ktForm.resetFields();
      reloadData();
    } catch (e: any) {
      message.error(e.message || "Failed to submit KT item.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitExitAnswers = async (values: any) => {
    if (!req || !req.exit_questions) return;
    setSubmitting(true);
    try {
      const answersPayload = req.exit_questions.map((q) => ({
        question_id: q.id,
        answer_text: values[`q_${q.id}`] || "",
      }));
      await offboardingStore.submitExitAnswers(req.id, answersPayload);
      message.success("Exit interview answers submitted successfully to HR!");
      reloadData();
    } catch (e: any) {
      message.error(e.message || "Failed to submit exit interview answers.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 4 }}>
          My Offboarding Portal
        </Title>
        <Text type="secondary">
          Track your resignation lifecycle, notice period, handover tasks, and exit clearance status.
        </Text>
      </div>

      {/* Employee Details & Notice Period Banner */}
      <Card
        style={{
          borderRadius: 12,
          marginBottom: 24,
          border: "1px solid var(--bms-border, #e5e7eb)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0284c7, #0369a1)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              <UserOutlined />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--bms-text, #111827)" }}>
                {empName} <Tag color="blue">{user?.employee_code || empId}</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {user?.designation || "Software Engineer"} • {user?.department || "Engineering"}
              </Text>
            </div>
          </div>

          <Alert
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            message={
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                Company Master Notice Period Policy: <Tag color="gold" style={{ fontSize: 13, padding: "2px 8px" }}>{noticeDays} Days</Tag>
              </span>
            }
            description="Proposed Last Working Day (LWD) is automatically calculated by adding the notice period days to your resignation date."
            style={{ borderRadius: 8, maxWidth: 480 }}
          />
        </div>
      </Card>

      {/* If No Resignation Submitted Yet -> Show Resignation Submission Form */}
      {!req ? (
        <Card
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileTextOutlined style={{ color: "#0284c7", fontSize: 20 }} />
              <span style={{ fontSize: 16, fontWeight: 700 }}>Submit Resignation Notice</span>
            </div>
          }
          style={{
            borderRadius: 12,
            border: "1px solid var(--bms-border, #e5e7eb)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}
        >
          <div
            style={{
              padding: "12px 18px",
              background: "var(--bms-surface-2)",
              border: "1px solid var(--bms-border)",
              borderRadius: 8,
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--bms-text-3)" }}>
                Mandatory Notice Period Calculation
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--bms-text)", marginTop: 2 }}>
                Notice Period Required: {noticeDays} Days
              </div>
            </div>
            <Tag color="blue" style={{ fontSize: 12, padding: "4px 10px" }}>
              Standard Policy Rule
            </Tag>
          </div>

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              resignation_date: defaultResignationDate,
              proposed_lwd: defaultProposedLwd,
            }}
            onFinish={handleSubmitResignation}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Form.Item
                name="resignation_date"
                label={
                  <span style={{ fontWeight: 600 }}>
                    Resignation Date <Text type="secondary" style={{ fontSize: 11 }}>(Today's Date - Non Editable)</Text>
                  </span>
                }
                rules={[{ required: true, message: "Resignation date" }]}
              >
                <DatePicker
                  disabled
                  style={{ width: "100%" }}
                  size="large"
                  format="YYYY-MM-DD"
                />
              </Form.Item>

              <Form.Item
                name="proposed_lwd"
                label={
                  <span style={{ fontWeight: 600 }}>
                    Proposed Last Working Day (LWD) <Text type="secondary" style={{ fontSize: 11 }}>(+{noticeDays} days auto-calculated)</Text>
                  </span>
                }
                rules={[{ required: true, message: "Please select proposed last working day" }]}
              >
                <DatePicker style={{ width: "100%" }} size="large" format="YYYY-MM-DD" />
              </Form.Item>
            </div>

            <Form.Item
              name="reason"
              label={<span style={{ fontWeight: 600 }}>Reason for Resignation</span>}
              rules={[{ required: true, message: "Please state your reason for resignation" }]}
            >
              <TextArea
                rows={4}
                placeholder="Please describe your reason for resignation (e.g. career growth, personal reasons, higher studies)..."
                size="large"
              />
            </Form.Item>

            <Form.Item
              label={
                <span style={{ fontWeight: 600 }}>
                  <PictureOutlined style={{ color: "#0284c7", marginRight: 6 }} />
                  Attach Gmail Resignation Email Screenshot / Proof <Text type="secondary" style={{ fontSize: 11 }}>(Visible to Project Manager & HR)</Text>
                </span>
              }
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Upload
                  accept="image/*,.pdf"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const res = e.target?.result as string;
                      if (res) {
                        setResignationProofUrl(res);
                        message.success(`Uploaded ${file.name} as resignation email screenshot proof!`);
                      }
                    };
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>Upload Screenshot Image</Button>
                </Upload>
                <Input
                  placeholder="Or paste image URL / proof link..."
                  value={resignationProofUrl.startsWith("data:") ? "Image Screenshot File Attached" : resignationProofUrl}
                  onChange={(e) => setResignationProofUrl(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                />
                {resignationProofUrl && (
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewProofModalOpen(true)}
                    type="dashed"
                  >
                    Preview Screenshot
                  </Button>
                )}
              </div>
            </Form.Item>

            <Divider style={{ margin: "16px 0" }} />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <Button
                icon={<MailOutlined style={{ color: "#ea4335" }} />}
                size="large"
                onClick={() => setGmailModalOpen(true)}
                style={{
                  height: 44,
                  borderRadius: 8,
                  fontWeight: 600,
                  borderColor: "#ea4335",
                  color: "#ea4335",
                }}
              >
                Send via Gmail
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={submitting}
                icon={<FileTextOutlined />}
                style={{
                  height: 44,
                  padding: "0 28px",
                  borderRadius: 8,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #0284c7, #0369a1)",
                }}
              >
                Submit Resignation
              </Button>
            </div>
          </Form>
        </Card>
      ) : (
        /* If Resignation Request Exists -> Render 10-Step Interactive Lifecycle & Step Details */
        <div>
          {/* Interactive 10-Step Progress Bar */}
          <OffboardingLifecycleBar
            currentStep={req.current_step}
            selectedStep={selectedStep}
            onSelectStep={(stepNum) => setSelectedStep(stepNum)}
          />

          {/* Details of Selected Step */}
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>
                    Step {selectedStep}: {LIFECYCLE_STEPS[selectedStep - 1]?.name}
                  </span>
                </div>
                <Tag
                  color={
                    selectedStep < req.current_step
                      ? "success"
                      : selectedStep === req.current_step
                      ? "processing"
                      : "default"
                  }
                  style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px" }}
                >
                  {selectedStep < req.current_step
                    ? "✓ COMPLETED"
                    : selectedStep === req.current_step
                    ? "⏳ CURRENT ACTIVE STEP"
                    : "🔒 LOCKED"}
                </Tag>
              </div>
            }
            style={{
              borderRadius: 12,
              border: "1px solid var(--bms-border, #e5e7eb)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <Paragraph style={{ color: "var(--bms-text-secondary, #6b7280)", fontSize: 13, marginBottom: 20 }}>
              {LIFECYCLE_STEPS[selectedStep - 1]?.description}
            </Paragraph>

            {/* Step 1: Resignation Particulars */}
            {selectedStep === 1 && (
              <div>
                <Descriptions title="Resignation Particulars" bordered column={2} size="middle">
                  <Descriptions.Item label="Employee Name">{req.employee_name}</Descriptions.Item>
                  <Descriptions.Item label="Employee Code">{req.employee_code || empId}</Descriptions.Item>
                  <Descriptions.Item label="Resignation Date">{req.resignation_date}</Descriptions.Item>
                  <Descriptions.Item label="Notice Period">{req.notice_period_days} Days</Descriptions.Item>
                  <Descriptions.Item label="Proposed LWD">
                    <Tag color="blue" style={{ fontSize: 13, fontWeight: 700 }}>{req.proposed_lwd}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="PM Approved LWD">
                    {req.pm_approved_lwd ? <Tag color="gold">{req.pm_approved_lwd}</Tag> : <Text type="secondary">Pending PM Review</Text>}
                  </Descriptions.Item>
                  <Descriptions.Item label="HR Approved LWD">
                    {req.hr_approved_lwd ? <Tag color="green" style={{ fontWeight: 700 }}>{req.hr_approved_lwd}</Tag> : <Text type="secondary">Pending HR Approval</Text>}
                  </Descriptions.Item>
                  <Descriptions.Item label="HR Status">
                    {req.hr_approved ? <Tag color="success">✓ APPROVED BY HR</Tag> : <Tag color="warning">⏳ PENDING HR APPROVAL</Tag>}
                  </Descriptions.Item>
                </Descriptions>

                <div style={{ marginTop: 20, padding: 16, background: "var(--bms-surface-2)", borderRadius: 8, border: "1px solid var(--bms-border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text strong style={{ color: "var(--bms-text)" }}>Reason for Resignation:</Text>
                    <Button
                      size="small"
                      icon={<MailOutlined style={{ color: "#ea4335" }} />}
                      onClick={() => setGmailModalOpen(true)}
                    >
                      Send Resignation via Gmail
                    </Button>
                  </div>
                  <Text style={{ whiteSpace: "pre-wrap", color: "var(--bms-text)" }}>{req.reason}</Text>
                </div>

                {/* Resignation Email Screenshot Proof Section */}
                <div style={{ marginTop: 16, padding: 16, background: "var(--bms-surface-2)", borderRadius: 8, border: "1px solid var(--bms-border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PictureOutlined style={{ color: "#0284c7", fontSize: 18 }} />
                      <Text strong style={{ fontSize: 14, color: "var(--bms-text)" }}>Resignation Gmail Submission Proof / Screenshot:</Text>
                    </div>
                    <Button
                      size="small"
                      type="primary"
                      icon={<UploadOutlined />}
                      onClick={() => setUploadProofModalOpen(true)}
                    >
                      {req.resignation_proof_url ? "Update Screenshot" : "Attach Screenshot Proof"}
                    </Button>
                  </div>

                  {req.resignation_proof_url ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <Tag color="cyan" style={{ fontSize: 12, padding: "4px 10px", fontWeight: 600 }}>
                        ✓ Email Screenshot Attached & Visible to PM & HR
                      </Tag>
                      <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => setPreviewProofModalOpen(true)}
                        style={{ fontWeight: 700, padding: 0 }}
                      >
                        Inspect Resignation Email Proof
                      </Button>
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      No resignation email screenshot attached yet. Click "Attach Screenshot Proof" to upload your Gmail sent screenshot so your PM and HR can inspect.
                    </Text>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Project Manager Review */}
            {selectedStep === 2 && (
              <div>
                <Alert
                  type="info"
                  showIcon
                  message="Project Manager Review in Progress"
                  description="Your Project Manager is reviewing your handover plan, proposed Last Working Day (LWD), and project impact."
                  style={{ marginBottom: 16 }}
                />
              </div>
            )}

            {/* Step 3: HR Review */}
            {selectedStep === 3 && (
              <div>
                <Alert
                  type="warning"
                  showIcon
                  message="HR Exit Review & Final LWD Approval"
                  description="HR is reviewing your resignation details and PM's LWD recommendation."
                />
              </div>
            )}

            {/* Step 4: Task Setups */}
            {selectedStep === 4 && (
              <div>
                <Alert
                  type="info"
                  showIcon
                  message="Task Setup & Handover Reassignment"
                  description="HR & Project Manager are setting up task reassignment and finance clearance flags."
                />
              </div>
            )}

            {/* Step 5: Knowledge Transfer (KT) - WITH HR APPROVAL GUARD & REAL EMPLOYEE DROPDOWN */}
            {selectedStep === 5 && (
              <div>
                {!req.hr_approved ? (
                  /* KT GUARD: If HR has NOT approved resignation yet, show warning message! */
                  <Alert
                    type="warning"
                    showIcon
                    icon={<LockOutlined style={{ fontSize: 20 }} />}
                    message={<span style={{ fontWeight: 700, fontSize: 14 }}>Waiting for HR Approval</span>}
                    description="Waiting for HR approval of resignation request before Knowledge Transfer can proceed. Once HR approves your resignation request, Knowledge Transfer submission will be unlocked."
                    style={{ borderRadius: 8, padding: 16 }}
                  />
                ) : (
                  /* Once HR approves -> Render KT Submission Interface */
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <Text strong style={{ fontSize: 15 }}>Knowledge Transfer Handover Topics</Text>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setKtModalVisible(true)}
                        style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
                      >
                        Add KT Topic
                      </Button>
                    </div>

                    <Table
                      dataSource={req.kt_items || []}
                      rowKey="id"
                      columns={[
                        { title: "Topic", dataIndex: "topic", key: "topic", render: (t) => <span style={{ fontWeight: 700 }}>{t}</span> },
                        { title: "Handover Details", dataIndex: "details", key: "details" },
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
                        { title: "Submitted To", dataIndex: "submitted_to_name", key: "submitted_to_name", render: (name) => <Tag color="blue">{name || "Team Member"}</Tag> },
                        { title: "Status", dataIndex: "status", key: "status", render: () => <Tag color="success">SUBMITTED</Tag> },
                      ]}
                      locale={{ emptyText: "No Knowledge Transfer topics added yet. Click 'Add KT Topic' above to begin documentation." }}
                    />

                    <div style={{ marginTop: 20, padding: 16, background: "var(--bms-bg-elevated, rgba(16, 185, 129, 0.08))", border: "1px solid var(--bms-border, rgba(16, 185, 129, 0.2))", borderRadius: 8 }}>
                      <div style={{ fontWeight: 700, color: "var(--bms-text-primary, #047857)" }}>
                        KT Acknowledgment Workflow Status:
                      </div>
                      <div style={{ marginTop: 6, fontSize: 13 }}>
                        Project Manager Acknowledgment: {req.pm_kt_acknowledged ? <Tag color="success">✓ ACKNOWLEDGED BY PM</Tag> : <Tag color="warning">⏳ PENDING PM ACKNOWLEDGMENT</Tag>}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 13 }}>
                        HR Final Acknowledgment: {req.hr_kt_acknowledged ? <Tag color="success">✓ ACKNOWLEDGED BY HR</Tag> : <Tag color="warning">⏳ PENDING HR FINAL ACKNOWLEDGMENT</Tag>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Exit Interview */}
            {selectedStep === 6 && (
              <div>
                {!req.exit_interview_sent ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Waiting for HR to Send Exit Questionnaire"
                    description="HR is preparing your exit interview questions. You will receive a notification once the questionnaire is ready for you to answer."
                  />
                ) : req.exit_interview_completed ? (
                  <Alert
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined />}
                    message="Exit Interview Answers Submitted"
                    description="Thank you! Your exit interview answers have been submitted to HR for final review."
                  />
                ) : (
                  <div>
                    <Alert
                      type="warning"
                      showIcon
                      message="Please Complete Exit Interview Questionnaire"
                      description="Please answer the questions below sent by HR to complete your exit interview."
                      style={{ marginBottom: 20 }}
                    />

                    <Form form={exitForm} layout="vertical" onFinish={handleSubmitExitAnswers}>
                      <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 8, marginBottom: 16 }}>
                        {(req.exit_questions || []).map((q, idx) => (
                          <Form.Item
                            key={q.id}
                            name={`q_${q.id}`}
                            label={<span style={{ fontWeight: 700 }}>Q{idx + 1}: {q.question_text}</span>}
                            rules={[{ required: true, message: "Please provide your answer" }]}
                          >
                            <TextArea rows={3} placeholder="Write your response here..." />
                          </Form.Item>
                        ))}
                      </div>

                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={submitting}
                        icon={<SendOutlined />}
                        size="large"
                        style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
                      >
                        Submit Exit Interview
                      </Button>
                    </Form>
                  </div>
                )}
              </div>
            )}

            {/* Step 7: IT Assets & Facilities */}
            {selectedStep === 7 && (
              <div>
                <Alert
                  type="info"
                  showIcon
                  message="IT Assets & Facilities Return & Clearance"
                  description={req.it_assets_revoked ? "IT Assets & Facilities have been confirmed returned by IT Admin." : "IT Asset Return process is in progress. Please hand over your hardware, laptops, access cards, and facilities items."}
                  style={{ marginBottom: 16 }}
                />
                {req.it_assets_revoked && (
                  <Tag color="success" style={{ padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>
                    ✓ IT ASSETS & FACILITIES CONFIRMED RETURNED BY IT ADMIN
                  </Tag>
                )}
              </div>
            )}

            {/* Step 8: Documents Issued */}
            {selectedStep === 8 && (
              <div>
                <Alert
                  type={req.documents_issued ? "success" : "info"}
                  showIcon
                  message={req.documents_issued ? "Offboarding Documents Issued" : "Preparing Offboarding Documents"}
                  description={req.documents_issued ? "Your Relieving Letter, Service Certificate, No Dues Certificate, and Final Payslip are issued and available for view & download below." : "HR is preparing your official Relieving Letter and Service Certificate."}
                  style={{ marginBottom: 20 }}
                />

                {req.documents_issued && (
                  <Card size="small" title="Issued Clearance Documents & Payslip">
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-surface-2)", borderRadius: 6, border: "1px solid var(--bms-border)" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--bms-text)" }}>📄 Official Relieving Letter</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Relieving confirmation for {req.employee_name} (LWD: {req.approved_lwd || req.proposed_lwd}).</Text>
                        </div>
                        <Button type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("relieving", req, "Relieving Letter - " + req.employee_name)}>
                          Download Relieving Letter
                        </Button>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-surface-2)", borderRadius: 6, border: "1px solid var(--bms-border)" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--bms-text)" }}>📜 Service Certificate & Experience Letter</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Experience certificate verifying tenure and position in {req.department}.</Text>
                        </div>
                        <Button type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("experience", req, "Service Certificate - " + req.employee_name)}>
                          Download Service Certificate
                        </Button>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-surface-2)", borderRadius: 6, border: "1px solid var(--bms-border)" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--bms-text)" }}>🧾 No Dues Clearance Certificate</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Consolidated clearance certificate confirming zero dues across all departments.</Text>
                        </div>
                        <Button type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("nodues", req, "No Dues Certificate - " + req.employee_name)}>
                          Download No Dues Certificate
                        </Button>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-surface-2)", borderRadius: 6, border: "1px solid var(--bms-border)" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--bms-text)" }}>💰 Final Payslip & F&F Settlement Statement</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Final monthly payslip breakdown including leave encashments & net payout.</Text>
                        </div>
                        <Button type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("payslip", req, "Final Payslip - " + req.employee_name)}>
                          Download Final Payslip
                        </Button>
                      </div>
                    </Space>
                  </Card>
                )}
              </div>
            )}

            {/* Step 9: Finance Clearance */}
            {selectedStep === 9 && (
              <div>
                <Alert
                  type="info"
                  showIcon
                  message="Finance Clearance & Full & Final Settlement"
                  description="Finance team is finalizing your Full & Final settlement, pending dues, and encashments."
                  style={{ marginBottom: 20 }}
                />
                {req.finance_cleared && (
                  <Card size="small" title="Finance Full & Final Settlement Details" style={{ marginBottom: 20 }}>
                    <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
                      <Descriptions.Item label="Base Monthly Salary">₹{Number(req.finance_base_salary || 65000).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Descriptions.Item>
                      <Descriptions.Item label="Leave Encashment & Additions">₹{Number(req.finance_additions || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Descriptions.Item>
                      <Descriptions.Item label="Deductions">₹{Number(req.finance_deductions || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Descriptions.Item>
                      <Descriptions.Item label="Net Settlement Amount"><span style={{ fontWeight: 800, color: "#16a34a", fontSize: 16 }}>₹{Number(req.finance_net_amount || (Number(req.finance_base_salary || 65000) + Number(req.finance_additions || 0) - Number(req.finance_deductions || 0))).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></Descriptions.Item>
                    </Descriptions>

                    <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--bms-border, #f0f0f0)" }}>
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => openAndPrintDocument("payslip", req, "Final Payslip & F&F Settlement - " + req.employee_name)}
                        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                      >
                        Download Final Payslip & Settlement Statement
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Step 10: Completed */}
            {selectedStep === 10 && (
              <div>
                <Alert
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  message="Offboarding Process 100% Completed"
                  description="Your offboarding process and exit clearance have been fully completed. Thank you for your service and we wish you all the best!"
                  style={{ marginBottom: 20 }}
                />
                <Card size="small" title="Completed Clearance Documents & Payslips Available">
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-bg-elevated, #f8fafc)", borderRadius: 6, border: "1px solid var(--bms-border, #e2e8f0)" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>📄 Official Relieving Letter</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Relieving confirmation PDF</Text>
                      </div>
                      <Button type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("relieving", req, "Relieving Letter - " + req.employee_name)}>
                        Download Relieving Letter
                      </Button>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-bg-elevated, #f8fafc)", borderRadius: 6, border: "1px solid var(--bms-border, #e2e8f0)" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>📜 Service Certificate & Experience Letter</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Experience certificate PDF</Text>
                      </div>
                      <Button type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("experience", req, "Service Certificate - " + req.employee_name)}>
                        Download Service Certificate
                      </Button>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-bg-elevated, #f8fafc)", borderRadius: 6, border: "1px solid var(--bms-border, #e2e8f0)" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>🧾 No Dues Clearance Certificate</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Consolidated clearance certificate PDF</Text>
                      </div>
                      <Button type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("nodues", req, "No Dues Certificate - " + req.employee_name)}>
                        Download No Dues Certificate
                      </Button>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bms-bg-elevated, #f8fafc)", borderRadius: 6, border: "1px solid var(--bms-border, #e2e8f0)" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>💰 Final Payslip & F&F Statement</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Final monthly payslip PDF</Text>
                      </div>
                      <Button type="primary" ghost icon={<DownloadOutlined />} onClick={() => openAndPrintDocument("payslip", req, "Final Payslip - " + req.employee_name)}>
                        Download Final Payslip
                      </Button>
                    </div>
                  </Space>
                </Card>
              </div>
            )}

          </Card>
        </div>
      )}

      {/* Modal for Adding KT Topic with REAL EMPLOYEE DATA Dropdown */}
      <Modal
        title="Add Knowledge Transfer Topic"
        open={ktModalVisible}
        onCancel={() => {
          setKtModalVisible(false);
          setKtFileList([]);
        }}
        footer={null}
      >
        <Form form={ktForm} layout="vertical" onFinish={handleAddKt}>
          <Form.Item
            name="topic"
            label="KT Topic / Module Name"
            rules={[{ required: true, message: "Please enter topic name" }]}
          >
            <Input placeholder="e.g. AlMax Backend Offboarding Architecture & Microservices" />
          </Form.Item>

          <Form.Item name="details" label="Handover Documentation / Notes">
            <TextArea rows={2} placeholder="Enter documentation notes, technical architecture notes, or system instructions..." />
          </Form.Item>

          <Form.Item name="git_links" label="Git Repository / Drive / External Documentation Links">
            <Input prefix={<LinkOutlined />} placeholder="e.g. https://github.com/my-org/repo or https://drive.google.com/folder/..." />
          </Form.Item>

          <Form.Item label="Upload Files / Folders / PDFs (Browser Selection)">
            <Upload
              beforeUpload={(file) => {
                setKtFileList([file]);
                return false;
              }}
              fileList={ktFileList}
              onRemove={() => setKtFileList([])}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Select Local File / PDF / Folder from Browser</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name="submitted_to_name"
            label="Handover Recipient Employee (Real Company Employee Data)"
            rules={[{ required: true, message: "Please select recipient employee" }]}
          >
            <Select
              showSearch
              placeholder="Search and select real employee..."
              optionFilterProp="children"
              options={employeesList.map((emp) => ({
                label: `${emp.full_name} (${emp.employee_code}) ${emp.designation_name ? `- ${emp.designation_name}` : ""}`,
                value: emp.full_name,
              }))}
            />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button onClick={() => { setKtModalVisible(false); setKtFileList([]); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>Submit KT</Button>
          </div>
        </Form>
      </Modal>

      {/* Send Resignation via Gmail Modal */}
      <Modal
        title={
          <Space>
            <MailOutlined style={{ color: "#ea4335", fontSize: 20 }} />
            <span>Send Resignation Notice via Gmail</span>
          </Space>
        }
        open={gmailModalOpen}
        onCancel={() => setGmailModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setGmailModalOpen(false)}>
            Close
          </Button>,
          <Button
            key="gmail"
            type="primary"
            icon={<SendOutlined />}
            style={{ background: "#ea4335", borderColor: "#ea4335" }}
            onClick={() => {
              const fromEmail = user?.email || `${empName.toLowerCase().replace(/\s+/g, ".")}@company.com`;
              const subject = `Resignation Letter - ${empName} (${user?.employee_code || empId})`;
              const resDateStr = form.getFieldValue("resignation_date")
                ? dayjs(form.getFieldValue("resignation_date")).format("DD MMM YYYY")
                : (req?.resignation_date || dayjs().format("DD MMM YYYY"));
              const lwdStr = form.getFieldValue("proposed_lwd")
                ? dayjs(form.getFieldValue("proposed_lwd")).format("DD MMM YYYY")
                : (req?.proposed_lwd || dayjs().add(noticeDays, "day").format("DD MMM YYYY"));
              const reasonStr = form.getFieldValue("reason") || req?.reason || "Personal reasons";

              const body = `Dear HR Team,

Please accept this email as formal notification that I am submitting my resignation from my position as ${user?.designation || "Software Engineer"} in ${user?.department || "Engineering"}.

Resignation Details:
----------------------------------------
Employee Name: ${empName}
Employee Code: ${user?.employee_code || empId}
From Email (My Email): ${fromEmail}
To Email (HR Email): ${hrEmail}
Resignation Date: ${resDateStr}
Notice Period Duration: ${noticeDays} Days
Proposed Last Working Day (LWD): ${lwdStr}

Reason for Resignation:
${reasonStr}

Thank you for your guidance and support.

Sincerely,
${empName}
${user?.designation || ""}
Email: ${fromEmail}`;

              const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(hrEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              window.open(gmailUrl, "_blank");
              message.success("Opened Gmail compose window with pre-filled resignation details!");
              setGmailModalOpen(false);
            }}
          >
            Open in Gmail (Auto-filled)
          </Button>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          message="Auto-filled Gmail Resignation Draft"
          description="Clicking 'Open in Gmail' will launch a pre-filled Gmail compose window showing your From/To email addresses, Subject, and formatted resignation letter."
          style={{ marginBottom: 16 }}
        />
        <Form layout="vertical">
          <Form.Item label="From Email (Employee)">
            <Input value={user?.email || `${empName.toLowerCase().replace(/\s+/g, ".")}@company.com`} disabled prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item label="To Email (HR Department)" required help="Target HR email address for receiving your resignation notice">
            <Input value={hrEmail} onChange={(e) => setHrEmail(e.target.value)} prefix={<MailOutlined />} />
          </Form.Item>
          <Form.Item label="Email Subject">
            <Input value={`Resignation Letter - ${empName} (${user?.employee_code || empId})`} disabled />
          </Form.Item>
        </Form>
      </Modal>

      {/* Upload/Update Resignation Proof Modal */}
      <Modal
        title={
          <Space>
            <PictureOutlined style={{ color: "#0284c7", fontSize: 20 }} />
            <span>Attach Resignation Gmail Email Screenshot / Proof</span>
          </Space>
        }
        open={uploadProofModalOpen}
        onCancel={() => setUploadProofModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          message="Resignation Email Verification"
          description="Upload an image/screenshot of your sent Gmail resignation email so your Project Manager and HR Manager can inspect and confirm your email submission."
          style={{ marginBottom: 16 }}
        />
        <Form
          layout="vertical"
          onFinish={async (values) => {
            if (!req?.id) {
              message.success("Screenshot saved locally. It will be attached when you submit your resignation.");
              setUploadProofModalOpen(false);
              return;
            }
            try {
              setSubmitting(true);
              const updated = await offboardingStore.updateResignationProof(req.id, resignationProofUrl);
              setReq(updated);
              message.success("Resignation email screenshot proof uploaded & saved successfully!");
              setUploadProofModalOpen(false);
            } catch (e: any) {
              message.error(e.message || "Failed to update screenshot proof.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Form.Item label="Upload Image Screenshot File">
            <Upload
              accept="image/*,.pdf"
              showUploadList={false}
              beforeUpload={(file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const res = e.target?.result as string;
                  if (res) {
                    setResignationProofUrl(res);
                    message.success(`Uploaded ${file.name}!`);
                  }
                };
                reader.readAsDataURL(file);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>Select Image File from Device</Button>
            </Upload>
          </Form.Item>

          <Form.Item label="Or Paste Image Screenshot URL">
            <Input
              placeholder="https://..."
              value={resignationProofUrl.startsWith("data:") ? "Image Screenshot File Attached" : resignationProofUrl}
              onChange={(e) => setResignationProofUrl(e.target.value)}
            />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
            <Button onClick={() => setUploadProofModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Save Screenshot Proof
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Inspect/Preview Resignation Proof Screenshot Modal */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: "#0284c7", fontSize: 20 }} />
            <span>Inspect Resignation Gmail Email Screenshot</span>
          </Space>
        }
        open={previewProofModalOpen}
        onCancel={() => setPreviewProofModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setPreviewProofModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={720}
      >
        <div style={{ textAlign: "center", padding: 16 }}>
          {resignationProofUrl || req?.resignation_proof_url ? (
            (resignationProofUrl || req?.resignation_proof_url)!.startsWith("data:application/pdf") ? (
              <iframe
                src={resignationProofUrl || req?.resignation_proof_url}
                style={{ width: "100%", height: 500, border: "none" }}
                title="Resignation Proof PDF"
              />
            ) : (
              <img
                src={resignationProofUrl || req?.resignation_proof_url}
                alt="Resignation Email Screenshot Proof"
                style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
              />
            )
          ) : (
            <Text type="secondary">No screenshot image available to display.</Text>
          )}
        </div>
      </Modal>
    </div>
  );
}
