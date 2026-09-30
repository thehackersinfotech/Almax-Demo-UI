import { useState } from "react";
import {
  Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber,
  Tag, Space, message, Card, Statistic, Row, Col, Typography,
  Tooltip, Badge, Timeline, Drawer, Descriptions, Alert, Divider, Upload,
  Spin, Empty, Popover,
} from "antd";
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SendOutlined, DollarOutlined, EditOutlined, DeleteOutlined,
  ExclamationCircleOutlined, UploadOutlined, EyeOutlined,
  WarningOutlined, UserOutlined, InfoCircleOutlined, ThunderboltOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  reimbursementApi, type ReimbursementListItem, type ReimbursementDetail,
  type ReimbursementCreate, type WorkflowAllowedTransition,
} from "@/services/expenses";
import { get } from "@/services/api";
import { ENDPOINTS } from "@/constants/api";
import { useAuthStore } from "@/store/auth";
import type { UploadFile } from "antd/es/upload/interface";

const { Text, Title, Paragraph } = Typography;

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "TRAVEL",    label: "Travel & Transport" },
  { value: "MEALS",     label: "Meals & Entertainment" },
  { value: "OFFICE",    label: "Office Supplies" },
  { value: "SOFTWARE",  label: "Software & Subscriptions" },
  { value: "MARKETING", label: "Marketing & Advertising" },
  { value: "UTILITIES", label: "Utilities & Internet" },
  { value: "EQUIPMENT", label: "Equipment & Hardware" },
  { value: "RENT",      label: "Rent & Facilities" },
  { value: "OTHER",     label: "Other" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH",           label: "Cash" },
  { value: "CORPORATE_CARD", label: "Corporate Card" },
  { value: "PERSONAL_CARD",  label: "Personal Card" },
  { value: "UPI",            label: "UPI" },
  { value: "BANK_TRANSFER",  label: "Bank Transfer" },
  { value: "CHEQUE",         label: "Cheque" },
];

const STATUS_DISPLAY: Record<string, { color: string; label: string; icon?: React.ReactNode }> = {
  DRAFT:           { color: "default",    label: "Draft" },
  SUBMITTED:       { color: "processing", label: "Submitted" },
  INFO_REQUESTED:  { color: "purple",     label: "Info Requested" },
  APPROVED:        { color: "success",    label: "Approved",  icon: <CheckCircleOutlined /> },
  REJECTED:        { color: "error",      label: "Rejected",  icon: <CloseCircleOutlined /> },
  PAID:            { color: "cyan",       label: "Paid",      icon: <DollarOutlined /> },
};

function fmtCurrency(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusTag({ status }: { status: string }) {
  const s = STATUS_DISPLAY[status] ?? { color: "default", label: status };
  return <Tag color={s.color} icon={s.icon}>{s.label}</Tag>;
}

/** Renders a colored Tag for a custom workflow state. */
function WorkflowStateTag({ name, color, isFinal }: { name: string; color: string; isFinal?: boolean | null }) {
  return (
    <Tag
      style={{
        background: color,
        color: "#fff",
        border: "none",
        fontWeight: 600,
        fontSize: 11,
        borderRadius: 12,
        padding: "2px 10px",
      }}
    >
      {name}
      {isFinal && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.85 }}>(Final)</span>}
    </Tag>
  );
}

/** Dynamic workflow transition buttons loaded from the backend per-claim. */
function WorkflowTransitionButtons({
  claimId, onTransitionDone,
}: {
  claimId: string;
  onTransitionDone: () => void;
}) {
  const [commentModal, setCommentModal] = useState<{ open: boolean; slug: string; name: string; color: string } | null>(null);
  const [comment, setComment] = useState("");
  const qc = useQueryClient();

  const { data: transitions = [], isLoading } = useQuery<WorkflowAllowedTransition[]>({
    queryKey: ["reimbursement-allowed-transitions", claimId],
    queryFn: () => reimbursementApi.allowedTransitions(claimId),
    staleTime: 10_000,
  });

  const transitionMut = useMutation({
    mutationFn: ({ slug, comments }: { slug: string; comments: string }) =>
      reimbursementApi.workflowTransition(claimId, slug, comments),
    onSuccess: (data) => {
      if (data.workflow_state_is_final) {
        message.success(`Moved to "${data.workflow_state_name}" — Company Expense auto-created!`);
      } else {
        message.success(`State changed to "${data.workflow_state_name}"`);
      }
      qc.invalidateQueries({ queryKey: ["reimbursements"] });
      qc.invalidateQueries({ queryKey: ["reimbursement-detail", claimId] });
      qc.invalidateQueries({ queryKey: ["reimbursement-allowed-transitions", claimId] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setCommentModal(null);
      setComment("");
      onTransitionDone();
    },
    onError: () => message.error("Workflow transition failed"),
  });

  if (isLoading) return <Spin size="small" />;
  if (!transitions.length) return <Tag color="default" style={{ fontSize: 10 }}>No transitions available</Tag>;

  return (
    <>
      <Space size={4} wrap>
        {transitions.map((t) => (
          <Tooltip key={t.id} title={`Move to: ${t.destination_state_name}`}>
            <Button
              size="small"
              style={{
                background: t.destination_state_color,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                padding: "0 10px",
                height: 24,
              }}
              loading={transitionMut.isPending && commentModal?.slug === t.destination_state_slug}
              onClick={() => {
                setComment("");
                setCommentModal({
                  open: true,
                  slug: t.destination_state_slug,
                  name: t.destination_state_name,
                  color: t.destination_state_color,
                });
              }}
            >
              <ThunderboltOutlined style={{ marginRight: 4 }} />
              {t.label || t.destination_state_name}
            </Button>
          </Tooltip>
        ))}
      </Space>

      {commentModal && (
        <Modal
          title={
            <span>
              Move to{" "}
              <Tag
                style={{ background: commentModal.color, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600 }}
              >
                {commentModal.name}
              </Tag>
            </span>
          }
          open={commentModal.open}
          onCancel={() => { setCommentModal(null); setComment(""); }}
          onOk={() => transitionMut.mutate({ slug: commentModal.slug, comments: comment })}
          confirmLoading={transitionMut.isPending}
          okText="Confirm Transition"
          width={420}
        >
          <Input.TextArea
            rows={3}
            placeholder="Add a comment or reason for this transition (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </Modal>
      )}
    </>
  );
}

// ── Approver Context Banner ───────────────────────────────────────────────────
// Shows employees who will review their claim. Never asks them to choose.

function ApproverBanner({ approverName, isConfigured }: { approverName?: string | null; isConfigured?: boolean }) {
  if (isConfigured === false) {
    return (
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message="Approver Not Configured"
        description={
          <>
            No approver has been set up for reimbursements. Employees cannot submit claims until
            an administrator configures an approver in{" "}
            <strong>Master → Reimbursement Configuration</strong>.
          </>
        }
        style={{ marginBottom: 20 }}
      />
    );
  }
  if (approverName) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<UserOutlined />}
        message={
          <span>
            All reimbursement claims are reviewed and approved by{" "}
            <strong>{approverName}</strong>
          </span>
        }
        style={{ marginBottom: 20 }}
      />
    );
  }
  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReimbursementsTab() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // ── Fetch active config (source of truth for approver & access control) ──
  const { data: activeConfig } = useQuery({
    queryKey: ["reimbursements-active-config"],
    queryFn: () => get<any>(`${ENDPOINTS.CRM_REIMBURSEMENTS}active-config/`),
    staleTime: 60_000,
  });

  const isConfigured: boolean = activeConfig?.is_configured !== false;
  const approverName: string | null = activeConfig?.approver_name ?? null;

  // Privilege check: is the current user the configured approver, or superuser/staff?
  const isApprover: boolean = Boolean(
    user?.is_superuser ||
    user?.is_staff ||
    (activeConfig?.is_configured && activeConfig?.approver_id === user?.id)
  );

  // ── Filters ───────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter]     = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);
  const [dateRange, setDateRange]           = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [search, setSearch]                 = useState("");

  const listParams: Record<string, any> = {
    ...(statusFilter    ? { status:   statusFilter }                      : {}),
    ...(categoryFilter  ? { category: categoryFilter }                    : {}),
    ...(employeeFilter  ? { employee: employeeFilter }                    : {}),
    ...(dateRange?.[0]  ? { date_from: dateRange[0].format("YYYY-MM-DD") } : {}),
    ...(dateRange?.[1]  ? { date_to:   dateRange[1].format("YYYY-MM-DD") } : {}),
    ...(search          ? { search }                                      : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["reimbursements", listParams],
    queryFn: () => reimbursementApi.list(listParams),
  });

  const claims: ReimbursementListItem[] = data?.results ?? [];
  const summary = data?.summary;

  // ── Dropdowns ─────────────────────────────────────────────────────────────
  const { data: employees } = useQuery({
    queryKey: ["employees-dropdown"],
    queryFn: () => get<any[]>(ENDPOINTS.EMPLOYEES_DROPDOWN),
    staleTime: 60_000,
    enabled: isApprover,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-dropdown"],
    queryFn: () => get<any>(ENDPOINTS.PROJECT_DROPDOWN),
    staleTime: 60_000,
  });

  // ── Invalidation helper ───────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reimbursements"] });
    if (detailId) qc.invalidateQueries({ queryKey: ["reimbursement-detail", detailId] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["expense-dashboard-summary"] });
  };

  // ── UI State ──────────────────────────────────────────────────────────────
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<ReimbursementListItem | null>(null);
  const [fileList, setFileList]       = useState<UploadFile[]>([]);
  const [detailId, setDetailId]       = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    type: "approve" | "reject" | "request_info" | "mark_paid";
    claim: ReimbursementListItem | null;
  }>({ open: false, type: "approve", claim: null });
  const [actionComment, setActionComment] = useState("");

  // ── Detail query ──────────────────────────────────────────────────────────
  const { data: detailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ["reimbursement-detail", detailId],
    queryFn: () => reimbursementApi.retrieve(detailId!),
    enabled: Boolean(detailId),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: async (d: ReimbursementCreate) => {
      const res = await reimbursementApi.create(d);
      for (const f of fileList) {
        if (f.originFileObj) {
          const fd = new FormData();
          fd.append("file", f.originFileObj);
          await reimbursementApi.uploadAttachment(res.id, fd);
        }
      }
      return res;
    },
    onSuccess: () => {
      message.success("Claim saved as Draft");
      setFileList([]);
      setModalOpen(false);
      invalidate();
    },
    onError: () => message.error("Failed to create reimbursement claim"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }: { id: string; d: Partial<ReimbursementCreate> }) => {
      const res = await reimbursementApi.update(id, d);
      for (const f of fileList) {
        if (f.originFileObj) {
          const fd = new FormData();
          fd.append("file", f.originFileObj);
          await reimbursementApi.uploadAttachment(id, fd);
        }
      }
      return res;
    },
    onSuccess: () => {
      message.success("Claim updated");
      setFileList([]);
      setModalOpen(false);
      invalidate();
    },
    onError: () => message.error("Failed to update claim"),
  });

  const submitMut   = useMutation({
    mutationFn: (id: string) => reimbursementApi.submit(id),
    onSuccess: () => { message.success("Claim submitted for approval"); invalidate(); },
    onError:   () => message.error("Failed to submit claim"),
  });

  const approveMut  = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      reimbursementApi.approve(id, comments),
    onSuccess: () => { message.success("Claim approved — Company Expense created automatically"); invalidate(); closeActionModal(); },
    onError:   () => message.error("Failed to approve claim"),
  });

  const rejectMut   = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      reimbursementApi.reject(id, comments),
    onSuccess: () => { message.success("Claim rejected"); invalidate(); closeActionModal(); },
    onError:   () => message.error("Failed to reject claim"),
  });

  const requestInfoMut = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      reimbursementApi.review(id, "request_info", comments),
    onSuccess: () => { message.success("Additional information requested from employee"); invalidate(); closeActionModal(); },
    onError:   () => message.error("Failed to request information"),
  });

  const markPaidMut = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      reimbursementApi.markPaid(id, comments),
    onSuccess: () => { message.success("Claim marked as paid"); invalidate(); closeActionModal(); },
    onError:   () => message.error("Failed to mark claim as paid"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => reimbursementApi.delete(id),
    onSuccess: () => { message.success("Draft deleted"); invalidate(); },
    onError:   () => message.error("Failed to delete claim"),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    if (!isConfigured) {
      message.warning("No approver is configured. Contact your administrator.");
      return;
    }
    setEditing(null);
    form.resetFields();
    setFileList([]);
    setModalOpen(true);
  };

  const openEdit = (claim: ReimbursementListItem) => {
    setEditing(claim);
    form.setFieldsValue({
      title:          claim.title,
      category:       claim.category,
      description:    claim.description,
      expense_date:   dayjs(claim.expense_date),
      amount_claimed: Number(claim.amount_claimed),
      payment_method: claim.payment_method,
      project:        claim.project ?? undefined,
      additional_notes: (claim as any).additional_notes,
    });
    setFileList([]);
    setModalOpen(true);
  };

  const openActionModal = (
    claim: ReimbursementListItem,
    type: typeof actionModal["type"]
  ) => {
    setActionComment("");
    setActionModal({ open: true, type, claim });
  };

  const closeActionModal = () => {
    setActionModal({ open: false, type: "approve", claim: null });
    setActionComment("");
  };

  const onFinishForm = (vals: any) => {
    const payload: ReimbursementCreate = {
      title:          vals.title,
      category:       vals.category,
      description:    vals.description,
      expense_date:   vals.expense_date.format("YYYY-MM-DD"),
      amount_claimed: vals.amount_claimed,
      payment_method: vals.payment_method,
      project:        vals.project ?? null,
      additional_notes: vals.additional_notes ?? "",
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, d: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const onConfirmAction = () => {
    const { type, claim } = actionModal;
    if (!claim) return;

    if (type === "approve") {
      approveMut.mutate({ id: claim.id, comments: actionComment });
    } else if (type === "reject") {
      if (!actionComment.trim()) {
        message.warning("A rejection reason is required.");
        return;
      }
      rejectMut.mutate({ id: claim.id, comments: actionComment });
    } else if (type === "request_info") {
      if (!actionComment.trim()) {
        message.warning("Please describe what information is needed.");
        return;
      }
      requestInfoMut.mutate({ id: claim.id, comments: actionComment });
    } else if (type === "mark_paid") {
      markPaidMut.mutate({ id: claim.id, comments: actionComment });
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: "Claim #",
      dataIndex: "claim_number",
      key: "claim_number",
      width: 120,
      render: (v: string, r: ReimbursementListItem) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailId(r.id)}>
          {v}
        </Button>
      ),
    },
    ...(isApprover
      ? [{
          title: "Employee",
          key: "employee",
          width: 160,
          render: (_: any, r: ReimbursementListItem) => (
            <div>
              <Text strong style={{ fontSize: 13 }}>{r.employee_name}</Text>
              {r.department_name && (
                <Text type="secondary" style={{ fontSize: 11, display: "block" }}>{r.department_name}</Text>
              )}
            </div>
          ),
        }]
      : []),
    {
      title: "Title / Category",
      key: "title",
      render: (_: any, r: ReimbursementListItem) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
          <Tag style={{ marginLeft: 6, fontSize: 10 }}>{r.category_label}</Tag>
        </div>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount_claimed",
      key: "amount_claimed",
      width: 130,
      align: "right" as const,
      render: (v: number) => <Text strong style={{ color: "#1890ff" }}>{fmtCurrency(v)}</Text>,
    },
    {
      title: "Date",
      dataIndex: "expense_date",
      key: "expense_date",
      width: 110,
      render: (v: string) => <Text>{dayjs(v).format("DD MMM YYYY")}</Text>,
    },
    {
      title: "Status",
      key: "status",
      width: 160,
      render: (_: any, r: ReimbursementListItem) => (
        <Space direction="vertical" size={2}>
          {/* Custom workflow state — rendered when the workflow engine is active */}
          {r.workflow_state_name && r.workflow_state_color
            ? <WorkflowStateTag name={r.workflow_state_name} color={r.workflow_state_color} isFinal={r.workflow_state_is_final} />
            : <StatusTag status={r.status} />
          }
        </Space>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_: any, r: ReimbursementListItem) => {
        const isOwner = r.employee === user?.id;
        const hasWorkflow = Boolean(r.workflow_state);
        return (
          <Space size={4} wrap>
            <Tooltip title="View Details">
              <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)} />
            </Tooltip>

            {/* Employee actions — available regardless of workflow mode */}
            {isOwner && r.status === "DRAFT" && (
              <>
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                </Tooltip>
                <Tooltip title="Submit for approval">
                  <Button
                    type="text" size="small" icon={<SendOutlined />}
                    style={{ color: "#1890ff" }}
                    onClick={() => submitMut.mutate(r.id)}
                  />
                </Tooltip>
                <Tooltip title="Delete draft">
                  <Button
                    type="text" size="small" danger icon={<DeleteOutlined />}
                    onClick={() => {
                      Modal.confirm({
                        title: "Delete this draft?",
                        content: "This action cannot be undone.",
                        okText: "Delete",
                        okType: "danger",
                        onOk: () => deleteMut.mutate(r.id),
                      });
                    }}
                  />
                </Tooltip>
              </>
            )}

            {isOwner && r.status === "INFO_REQUESTED" && (
              <>
                <Tooltip title="Edit and re-submit">
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                </Tooltip>
                <Tooltip title="Re-submit">
                  <Button
                    type="text" size="small" icon={<SendOutlined />} style={{ color: "#722ed1" }}
                    onClick={() => submitMut.mutate(r.id)}
                  />
                </Tooltip>
              </>
            )}

            {/* ── Custom Workflow Engine Transitions (when workflow_state is assigned) ── */}
            {hasWorkflow && r.status !== "DRAFT" && (
              <WorkflowTransitionButtons
                claimId={r.id}
                onTransitionDone={() => {
                  qc.invalidateQueries({ queryKey: ["reimbursements"] });
                  if (detailId) qc.invalidateQueries({ queryKey: ["reimbursement-detail", detailId] });
                }}
              />
            )}

            {/* ── Legacy fixed action buttons (when no custom workflow is configured) ── */}
            {!hasWorkflow && (
              <>
                {isApprover && r.status === "SUBMITTED" && (
                  <>
                    <Tooltip title="Approve">
                      <Button
                        type="text" size="small" icon={<CheckCircleOutlined />} style={{ color: "#52c41a" }}
                        onClick={() => openActionModal(r, "approve")}
                      />
                    </Tooltip>
                    <Tooltip title="Request more info">
                      <Button
                        type="text" size="small" icon={<ExclamationCircleOutlined />} style={{ color: "#722ed1" }}
                        onClick={() => openActionModal(r, "request_info")}
                      />
                    </Tooltip>
                    <Tooltip title="Reject">
                      <Button
                        type="text" size="small" danger icon={<CloseCircleOutlined />}
                        onClick={() => openActionModal(r, "reject")}
                      />
                    </Tooltip>
                  </>
                )}
                {isApprover && r.status === "APPROVED" && (
                  <Tooltip title="Mark as Paid">
                    <Button
                      type="text" size="small" icon={<DollarOutlined />} style={{ color: "#06b6d4" }}
                      onClick={() => openActionModal(r, "mark_paid")}
                    />
                  </Tooltip>
                )}
              </>
            )}
          </Space>
        );
      },
    },
  ];

  // ── Summary Stats ──────────────────────────────────────────────────────────
  const statsByStatus = summary?.by_status ?? {};
  const pendingCount  = statsByStatus["SUBMITTED"]?.count ?? 0;
  const pendingAmount = statsByStatus["SUBMITTED"]?.amount ?? 0;
  const approvedAmt   = statsByStatus["APPROVED"]?.amount ?? 0;
  const paidAmt       = statsByStatus["PAID"]?.amount ?? 0;

  // ── Action Modal Config ────────────────────────────────────────────────────
  const actionConfig = {
    approve:      { title: "Approve Claim",            requiresComment: false, okText: "Approve",           okDanger: false, placeholder: "Optional comments…" },
    reject:       { title: "Reject Claim",             requiresComment: true,  okText: "Reject",            okDanger: true,  placeholder: "Reason for rejection (required)…" },
    request_info: { title: "Request More Information", requiresComment: true,  okText: "Request Info",      okDanger: false, placeholder: "Describe what information is needed (required)…" },
    mark_paid:    { title: "Mark as Paid",             requiresComment: false, okText: "Mark Paid",         okDanger: false, placeholder: "Payment reference or notes…" },
  };
  const currAction = actionConfig[actionModal.type];
  const isActionPending =
    approveMut.isPending || rejectMut.isPending ||
    requestInfoMut.isPending || markPaidMut.isPending;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Approver context banner */}
      <ApproverBanner approverName={approverName} isConfigured={isConfigured} />

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card variant="outlined" style={{ borderRadius: 10 }}>
            <Statistic
              title="Total Claims"
              value={summary?.total_count ?? 0}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="outlined" style={{ borderRadius: 10 }}>
            <Statistic
              title="Pending Approval"
              value={pendingCount}
              suffix={pendingAmount > 0 ? <span style={{ fontSize: 12, color: "#888" }}>{fmtCurrency(pendingAmount)}</span> : undefined}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="outlined" style={{ borderRadius: 10 }}>
            <Statistic
              title="Approved"
              value={fmtCurrency(approvedAmt)}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="outlined" style={{ borderRadius: 10 }}>
            <Statistic
              title="Paid Out"
              value={fmtCurrency(paidAmt)}
              valueStyle={{ color: "#06b6d4" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <Input.Search
          placeholder="Search by claim #, title, employee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
        <Select
          placeholder="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
          style={{ width: 160 }}
          options={Object.entries(STATUS_DISPLAY).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <Select
          placeholder="Category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          allowClear
          style={{ width: 180 }}
          options={CATEGORY_OPTIONS}
        />
        {isApprover && Array.isArray(employees) && (
          <Select
            placeholder="Employee"
            value={employeeFilter}
            onChange={setEmployeeFilter}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 200 }}
            options={(employees as any[]).map((e: any) => ({
              value: e.id,
              label: e.full_name || e.username,
            }))}
          />
        )}
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(v) => setDateRange(v as any)}
          style={{ width: 240 }}
          format="DD/MM/YYYY"
        />
        <div style={{ marginLeft: "auto" }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            disabled={!isConfigured}
          >
            New Claim
          </Button>
        </div>
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={claims}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (t) => `${t} claims` }}
        scroll={{ x: 900 }}
        locale={{
          emptyText: (
            <Empty
              description={
                statusFilter || search
                  ? "No claims match the current filters"
                  : isApprover
                  ? "No reimbursement claims have been submitted yet"
                  : "You haven't submitted any reimbursement claims yet"
              }
            />
          ),
        }}
      />

      {/* ── Create / Edit Modal ───────────────────────────────────────────── */}
      <Modal
        title={editing ? "Edit Reimbursement Claim" : "New Reimbursement Claim"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); setFileList([]); }}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText={editing ? "Save Changes" : "Save as Draft"}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinishForm}>
          <Form.Item name="title" label="Expense Title" rules={[{ required: true, message: "Title is required" }]}>
            <Input placeholder="e.g. Client visit travel expenses" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true, message: "Select a category" }]}>
                <Select options={CATEGORY_OPTIONS} placeholder="Select category" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_method" label="Payment Method" rules={[{ required: true }]}>
                <Select options={PAYMENT_METHOD_OPTIONS} placeholder="How did you pay?" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="expense_date" label="Expense Date" rules={[{ required: true, message: "Date is required" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" disabledDate={(d) => d.isAfter(dayjs())} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount_claimed"
                label="Amount Claimed (₹)"
                rules={[
                  { required: true, message: "Amount is required" },
                  { type: "number", min: 1, message: "Amount must be greater than 0" },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1}
                  precision={2}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Purpose / Description" rules={[{ required: true, message: "Description is required" }]}>
            <Input.TextArea rows={3} placeholder="Briefly explain the purpose of this expense" />
          </Form.Item>

          <Form.Item name="project" label="Related Project (optional)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Link to a project"
              options={(Array.isArray(projects) ? projects : projects?.results ?? []).map((p: any) => ({
                value: p.id,
                label: `${p.name}${p.code ? ` (${p.code})` : ""}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="additional_notes" label="Additional Notes (optional)">
            <Input.TextArea rows={2} placeholder="Any other context…" />
          </Form.Item>

          <Form.Item label="Supporting Documents">
            <Upload
              fileList={fileList}
              onChange={({ fileList: fl }) => setFileList(fl)}
              beforeUpload={() => false}
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
            >
              <Button icon={<UploadOutlined />}>Attach Files</Button>
            </Upload>
            <Text type="secondary" style={{ fontSize: 11 }}>
              PDF, images, Word, Excel · Max 10MB each
            </Text>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Approver Action Modal ─────────────────────────────────────────── */}
      <Modal
        title={currAction.title}
        open={actionModal.open}
        onCancel={closeActionModal}
        onOk={onConfirmAction}
        okText={currAction.okText}
        okButtonProps={{ danger: currAction.okDanger }}
        confirmLoading={isActionPending}
        width={440}
        destroyOnHidden
      >
        {actionModal.claim && (
          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Claim #">{actionModal.claim.claim_number}</Descriptions.Item>
            <Descriptions.Item label="Employee">{actionModal.claim.employee_name}</Descriptions.Item>
            <Descriptions.Item label="Amount">{fmtCurrency(Number(actionModal.claim.amount_claimed))}</Descriptions.Item>
          </Descriptions>
        )}
        {actionModal.type === "approve" && (
          <Alert
            type="success"
            message="Approving this claim will automatically create a Company Expense record."
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}
        <Input.TextArea
          value={actionComment}
          onChange={(e) => setActionComment(e.target.value)}
          rows={3}
          placeholder={currAction.placeholder}
        />
        {currAction.requiresComment && !actionComment.trim() && (
          <Text type="danger" style={{ fontSize: 12 }}>This field is required.</Text>
        )}
      </Modal>

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      <Drawer
        title={
          detailData ? (
            <span>
              {detailData.claim_number}{" "}
              {detailData.workflow_state_name && detailData.workflow_state_color
                ? <WorkflowStateTag name={detailData.workflow_state_name} color={detailData.workflow_state_color} isFinal={detailData.workflow_state_is_final} />
                : <StatusTag status={detailData.status} />
              }
            </span>
          ) : "Claim Details"
        }
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        width={560}
        extra={
          detailData && (
            <Text strong style={{ fontSize: 18, color: "#1890ff" }}>
              {fmtCurrency(Number(detailData.amount_claimed))}
            </Text>
          )
        }
      >
        {isDetailLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
        ) : detailData ? (
          <div>
            {/* Info Requested Banner */}
            {detailData.status === "INFO_REQUESTED" && detailData.review_comments && (
              <Alert
                type="warning"
                showIcon
                message="Additional Information Required"
                description={detailData.review_comments}
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Rejection Banner */}
            {detailData.status === "REJECTED" && detailData.review_comments && (
              <Alert
                type="error"
                showIcon
                message="Claim Rejected"
                description={detailData.review_comments}
                style={{ marginBottom: 16 }}
              />
            )}

            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Title" span={2}>{detailData.title}</Descriptions.Item>
              <Descriptions.Item label="Category">{detailData.category_label}</Descriptions.Item>
              <Descriptions.Item label="Date">{dayjs(detailData.expense_date).format("DD MMM YYYY")}</Descriptions.Item>
              <Descriptions.Item label="Payment Method">{detailData.payment_method_label}</Descriptions.Item>
              <Descriptions.Item label="Amount">{fmtCurrency(Number(detailData.amount_claimed))}</Descriptions.Item>
              {detailData.workflow_state_name && (
                <Descriptions.Item label="Workflow State" span={2}>
                  <WorkflowStateTag
                    name={detailData.workflow_state_name}
                    color={detailData.workflow_state_color ?? "#6b7280"}
                    isFinal={detailData.workflow_state_is_final}
                  />
                </Descriptions.Item>
              )}
              {detailData.project_name && (
                <Descriptions.Item label="Project" span={2}>{detailData.project_name}</Descriptions.Item>
              )}
              <Descriptions.Item label="Description" span={2}>{detailData.description}</Descriptions.Item>
              {(detailData as any).additional_notes && (
                <Descriptions.Item label="Notes" span={2}>{(detailData as any).additional_notes}</Descriptions.Item>
              )}
            </Descriptions>

            {/* Linked Expense */}
            {detailData.linked_expense && (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message={`Company Expense created automatically on approval`}
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Attachments */}
            {detailData.attachments && detailData.attachments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>Supporting Documents</Text>
                {detailData.attachments.map((a) => (
                  <div key={a.id} style={{ marginBottom: 4 }}>
                    <a href={a.file} target="_blank" rel="noopener noreferrer">
                      {a.original_name}
                    </a>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>
                      {(a.file_size / 1024).toFixed(0)} KB
                    </Text>
                  </div>
                ))}
              </div>
            )}

            <Divider orientation="left" style={{ fontSize: 13 }}>Audit Trail</Divider>
            <Timeline
              items={(detailData.audit_logs ?? []).map((log) => ({
                color:
                  log.to_status === "APPROVED" ? "green"
                  : log.to_status === "REJECTED" ? "red"
                  : log.to_status === "PAID"     ? "cyan"
                  : "blue",
                children: (
                  <div>
                    <Text strong style={{ fontSize: 13 }}>
                      {STATUS_DISPLAY[log.to_status]?.label ?? log.to_status}
                    </Text>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      by {log.performed_by_name ?? "System"}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(log.created_at).format("DD MMM YYYY HH:mm")}
                    </Text>
                    {log.comments && (
                      <Paragraph
                        style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}
                        type="secondary"
                      >
                        {log.comments}
                      </Paragraph>
                    )}
                  </div>
                ),
              }))}
            />
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
