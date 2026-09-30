import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, Progress, Typography, Tabs, Button, Table, Tag, Card, Select, DatePicker, Row, Col, Space, Statistic, Empty, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Column, Pie } from "@ant-design/charts";
import {
  FileTextOutlined, DollarOutlined, WarningOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, ArrowRightOutlined, FilterOutlined, ClearOutlined,
  AccountBookOutlined, ShoppingCartOutlined, WalletOutlined, TagOutlined,
} from "@ant-design/icons";
import {
  DashboardShell,
  DashboardHeader,
  DashboardGrid,
  DashboardPanel,
  AttentionQueue,
  QuickActionBar,
  ActionMetric,
  HealthRing,
  TrendPanel,
  DashboardPageSkeleton,
  type AttentionItem,
  type QuickAction,
} from "@/components/dashboard";
import { paymentReportsApi, type ClientReceivable, type ProjectReceivable, type MonthlyTrend } from "@/services/payment";
import { expenseApi } from "@/services/expenses";
import { departmentApi } from "@/services/master";
import PercentChip from "@/components/common/PercentChip";
import { useThemeStore } from "@/store/theme";
import dayjs from "dayjs";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const EXPENSE_CATEGORIES = [
  { value: "TRAVEL", label: "Travel & Transport" },
  { value: "MEALS", label: "Meals & Entertainment" },
  { value: "OFFICE", label: "Office Supplies" },
  { value: "SOFTWARE", label: "Software & Subscriptions" },
  { value: "MARKETING", label: "Marketing & Advertising" },
  { value: "UTILITIES", label: "Utilities & Internet" },
  { value: "EQUIPMENT", label: "Equipment & Hardware" },
  { value: "RENT", label: "Rent & Facilities" },
  { value: "OTHER", label: "Other" },
];

const EXPENSE_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "REIMBURSED", label: "Reimbursed" },
];

function fmt(n: number) {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(2)}L`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function fmtCurrency(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function PaymentDashboardPage() {
  const navigate = useNavigate();
  const [receivableTab, setReceivableTab] = useState<"client" | "project">("client");
  const isDark = useThemeStore((s) => s.isDark);

  const { data, isLoading, error } = useQuery({
    queryKey: ["payment-dashboard"],
    queryFn: paymentReportsApi.dashboard,
    staleTime: 30_000,
  });

  const { data: clientData } = useQuery({
    queryKey: ["payment-client-receivable"],
    queryFn: paymentReportsApi.clientReceivable,
    staleTime: 60_000,
  });

  const { data: projectData } = useQuery({
    queryKey: ["payment-project-receivable"],
    queryFn: paymentReportsApi.projectReceivable,
    staleTime: 60_000,
  });

  const kpi = data?.kpi;
  const trend: MonthlyTrend[] = data?.monthly_trend ?? [];
  const clients: ClientReceivable[] = clientData?.results ?? [];
  const projects: ProjectReceivable[] = projectData?.results ?? [];

  const attentionItems = useMemo((): AttentionItem[] => {
    if (!kpi) return [];
    const items: AttentionItem[] = [];
    if (kpi.overdue_count > 0) {
      items.push({
        key: "overdue",
        severity: "error",
        title: "Overdue invoices",
        count: kpi.overdue_count,
        detail: `${fmt(kpi.overdue_amount)} past due — chase collections`,
        path: "/payment/invoices",
      });
    }
    if (kpi.partial_count > 0) {
      items.push({
        key: "partial",
        severity: "warning",
        title: "Partial payments",
        count: kpi.partial_count,
        detail: "Invoices with outstanding balance after partial collection",
        path: "/payment/invoices",
      });
    }
    if (kpi.collection_pct < 80 && kpi.total_invoiced > 0) {
      items.push({
        key: "collection",
        severity: "warning",
        title: "Collection rate low",
        count: Math.round(kpi.collection_pct),
        detail: `Only ${kpi.collection_pct.toFixed(1)}% of invoiced amount collected`,
        path: "/payment/receivables",
      });
    }
    if (kpi.total_receivable > 0) {
      items.push({
        key: "outstanding",
        severity: "info",
        title: "Outstanding AR",
        count: Math.round(kpi.total_receivable / 1000),
        detail: `${fmt(kpi.total_receivable)} total receivable across clients`,
        path: "/payment/receivables",
      });
    }
    return items;
  }, [kpi]);

  const clientRows = useMemo(
    () => [...clients].sort((a, b) => b.total_pending - a.total_pending || b.overdue_amount - a.overdue_amount),
    [clients],
  );

  const projectRows = useMemo(
    () => [...projects].sort((a, b) => b.total_pending - a.total_pending || b.overdue_amount - a.overdue_amount),
    [projects],
  );

  const clientColumns: ColumnsType<ClientReceivable> = useMemo(() => [
    { title: "Client", dataIndex: "client_name", render: (v) => <Text strong>{v}</Text> },
    { title: "Invoiced", dataIndex: "total_invoiced", align: "right", render: (v) => fmtCurrency(v) },
    { title: "Received", dataIndex: "total_received", align: "right", render: (v) => <Text style={{ color: "var(--bms-success)" }}>{fmtCurrency(v)}</Text> },
    {
      title: "Pending", dataIndex: "total_pending", align: "right",
      render: (v) => <Text strong style={{ color: v > 0 ? "var(--bms-danger)" : "var(--bms-success)" }}>{fmtCurrency(v)}</Text>,
    },
    {
      title: "Status", key: "status", width: 100,
      render: (_, r) => (
        <Tag color={r.overdue_amount > 0 ? "error" : r.total_pending > 0 ? "warning" : "success"} style={{ margin: 0 }}>
          {r.overdue_amount > 0 ? "Overdue" : r.total_pending > 0 ? "Pending" : "Clear"}
        </Tag>
      ),
    },
    { title: "Invoices", dataIndex: "invoice_count", align: "center", width: 80 },
    {
      title: "Collection %", dataIndex: "collection_pct", width: 120, align: "right" as const,
      render: (v) => <PercentChip value={v} mode="higher-better" decimals={0} />,
    },
  ], []);

  const projectColumns: ColumnsType<ProjectReceivable> = useMemo(() => [
    {
      title: "Project", key: "project",
      render: (_, r) => (
        <div>
          <Tag color="blue" style={{ marginRight: 6 }}>{r.project_code}</Tag>
          <Text>{r.project_name}</Text>
        </div>
      ),
    },
    { title: "Client", dataIndex: "client_name" },
    { title: "Invoiced", dataIndex: "total_invoiced", align: "right", render: (v) => fmtCurrency(v) },
    { title: "Received", dataIndex: "total_received", align: "right", render: (v) => <Text style={{ color: "var(--bms-success)" }}>{fmtCurrency(v)}</Text> },
    {
      title: "Outstanding", dataIndex: "total_pending", align: "right",
      render: (v) => <Text strong style={{ color: v > 0 ? "var(--bms-danger)" : "var(--bms-success)" }}>{fmtCurrency(v)}</Text>,
    },
    {
      title: "Status", key: "status", width: 100,
      render: (_, r) => (
        <Tag color={r.overdue_amount > 0 ? "error" : r.total_pending > 0 ? "warning" : "success"} style={{ margin: 0 }}>
          {r.overdue_amount > 0 ? "Overdue" : r.total_pending > 0 ? "Pending" : "Clear"}
        </Tag>
      ),
    },
    { title: "Invoices", dataIndex: "invoice_count", align: "center", width: 80 },
    {
      title: "Collection %", dataIndex: "collection_pct", width: 120, align: "right" as const,
      render: (v) => <PercentChip value={v} mode="higher-better" decimals={0} />,
    },
  ], []);

  const quickActions = useMemo((): QuickAction[] => [
    { key: "invoices", label: "Invoices", icon: <FileTextOutlined />, onClick: () => navigate("/payment/invoices"), primary: true },
    { key: "payments", label: "Record payment", icon: <DollarOutlined />, onClick: () => navigate("/payment/payments") },
    { key: "receivables", label: "Receivable summary", icon: <WarningOutlined />, onClick: () => navigate("/payment/receivables") },
    { key: "milestones", label: "Milestones", icon: <CheckCircleOutlined />, onClick: () => navigate("/payment/milestones") },
  ], [navigate]);

  // Determine chart colors based on theme
  const chartColors = isDark
    ? ['#52c41a', '#faad14'] // Brighter colors for dark mode
    : ['#059669', '#6366f1'];

  const trendData = useMemo(
    () => trend.flatMap((m) => [
      { month: m.label, type: "Collected", value: m.collected },
      { month: m.label, type: "Invoiced", value: m.invoiced },
    ]),
    [trend],
  );

  // Expense filters state
  const [expenseDateRange, setExpenseDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [expenseDeptFilter, setExpenseDeptFilter] = useState<string | null>(null);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string | null>(null);
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<string | null>(null);

  const { data: deptsData } = useQuery({
    queryKey: ["dd", "departments"],
    queryFn: () => departmentApi.dropdown(),
    staleTime: 60_000,
  });

  const expenseParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (expenseDateRange?.[0]) params.date_from = expenseDateRange[0].format("YYYY-MM-DD");
    if (expenseDateRange?.[1]) params.date_to = expenseDateRange[1].format("YYYY-MM-DD");
    if (expenseDeptFilter) params.department = expenseDeptFilter;
    if (expenseCategoryFilter) params.category = expenseCategoryFilter;
    if (expenseStatusFilter) params.status = expenseStatusFilter;
    return params;
  }, [expenseDateRange, expenseDeptFilter, expenseCategoryFilter, expenseStatusFilter]);

  const { data: expenseSummaryData, isLoading: isExpenseSummaryLoading } = useQuery({
    queryKey: ["expense-dashboard-summary", expenseParams],
    queryFn: () => expenseApi.summary(expenseParams),
    staleTime: 30_000,
  });

  const { data: expenseListData, isLoading: isExpenseListLoading } = useQuery({
    queryKey: ["expense-dashboard-list", expenseParams],
    queryFn: () => expenseApi.list({ ...expenseParams, limit: "5" }),
    staleTime: 30_000,
  });

  const expenseCategoryChartData = useMemo(() => {
    return (expenseSummaryData?.by_category ?? []).map((item) => ({
      type: EXPENSE_CATEGORIES.find((c) => c.value === item.category)?.label || item.category,
      value: item.amount,
    }));
  }, [expenseSummaryData]);

  const expenseDepartmentChartData = useMemo(() => {
    return (expenseSummaryData?.by_department ?? []).map((item) => ({
      type: item.department_name,
      value: item.amount,
    }));
  }, [expenseSummaryData]);

  const collected = kpi?.total_received ?? 0;
  const overdue = kpi?.overdue_amount ?? 0;
  const outstanding = Math.max(0, (kpi?.total_receivable ?? 0) - overdue);

  if (isLoading) {
    return (
      <DashboardShell>
        <DashboardPageSkeleton />
      </DashboardShell>
    );
  }

  if (error || !kpi) {
    return (
      <DashboardShell>
        <Alert type="error" message="Failed to load finance dashboard" showIcon />
      </DashboardShell>
    );
  }

  const hasExpenseFilters = Boolean(
    expenseDateRange || expenseDeptFilter || expenseCategoryFilter || expenseStatusFilter
  );

  return (
    <DashboardShell>
      <DashboardHeader
        title="Finance Command Center"
        subtitle="Receivables, collections, company expenses, and cash flow — last 12 months"
        actions={<QuickActionBar actions={quickActions} />}
      />

      <AttentionQueue
        items={attentionItems}
        onItemClick={(item) => item.path && navigate(item.path)}
        emptyMessage="Receivables are healthy — no collection issues flagged."
      />

      <div className="dash-metrics">
        <ActionMetric
          label="Outstanding AR"
          value={fmt(kpi.total_receivable)}
          sub={`${kpi.overdue_count} overdue invoice${kpi.overdue_count !== 1 ? "s" : ""}`}
          accent={kpi.overdue_count > 0 ? "danger" : "primary"}
          icon={<DollarOutlined />}
          actions={[{ label: "Receivable summary", onClick: () => navigate("/payment/receivables") }]}
        />
        <ActionMetric
          label="Collected"
          value={fmt(kpi.total_received)}
          sub={`${kpi.collection_pct.toFixed(1)}% of invoiced`}
          accent={kpi.collection_pct >= 80 ? "success" : "warning"}
          icon={<CheckCircleOutlined />}
          progress={Math.min(100, Math.round(kpi.collection_pct))}
          actions={[{ label: "Payments", onClick: () => navigate("/payment/payments") }]}
        />
        <ActionMetric
          label="Total invoiced"
          value={fmt(kpi.total_invoiced)}
          sub={`${kpi.partial_count} partial collection${kpi.partial_count !== 1 ? "s" : ""}`}
          accent="purple"
          icon={<FileTextOutlined />}
          actions={[{ label: "Invoices", onClick: () => navigate("/payment/invoices") }]}
        />
        <ActionMetric
          label="Total Expenses"
          value={fmt(expenseSummaryData?.total_all_time ?? 0)}
          sub={expenseSummaryData?.pending_approval?.count ? `${expenseSummaryData.pending_approval.count} pending approval` : "Overall company spend"}
          accent="warning"
          icon={<AccountBookOutlined />}
          actions={[{ label: "Expense manager", onClick: () => navigate("/expenses") }]}
        />
      </div>

      <DashboardGrid
        primary={
          <DashboardPanel title="Invoice vs collection (12 months)">
            <TrendPanel>
              {trendData.length > 0 ? (
                <Column
                  data={trendData}
                  xField="month"
                  yField="value"
                  seriesField="type"
                  isGroup
                  color={chartColors}
                  xAxis={{ label: { autoHide: true, autoRotate: false, style: { fill: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)', fontSize: 12 } } }}
                  yAxis={{ label: { formatter: (v: string) => fmt(Number(v)), style: { fill: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' } } }}
                  legend={{ position: "top-right" }}
                  height={280}
                  columnWidthRatio={0.45}
                  theme={isDark ? 'dark' : 'light'}
                />
              ) : (
                <div style={{ minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Text type="secondary">No billing data yet — invoices and payments will appear here</Text>
                </div>
              )}
            </TrendPanel>
          </DashboardPanel>
        }
        secondary={
          <DashboardPanel title="Receivable mix">
            <HealthRing
              centerLabel="Invoiced"
              centerValue={fmt(kpi.total_invoiced)}
              segments={[
                { key: "on_track", label: "Collected", value: collected, color: "#059669" },
                { key: "at_risk", label: "Outstanding", value: outstanding, color: "#6366f1" },
                { key: "delayed", label: "Overdue", value: overdue, color: "var(--bms-danger-accent)" },
              ]}
            />
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Collection rate</Text>
                <Text strong style={{ fontSize: 12 }}>{kpi.collection_pct.toFixed(1)}%</Text>
              </div>
              <Progress
                percent={Math.min(100, Math.round(kpi.collection_pct))}
                strokeColor={
                  kpi.collection_pct >= 80 ? "var(--bms-success)"
                    : kpi.collection_pct >= 50 ? "var(--bms-warning)"
                      : "var(--bms-danger)"
                }
                showInfo={false}
                size="small"
              />
            </div>
          </DashboardPanel>
        }
      />

      {/* Company Expense Analytics & Summary Section */}
      <div className="exec-dash-section" style={{ marginTop: 24 }}>
        <DashboardPanel
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AccountBookOutlined style={{ color: "#f59e0b" }} />
              <span>Company Expense Summary & Analytics</span>
            </div>
          }
          extra={
            <Button
              type="link"
              size="small"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate("/expenses")}
            >
              Expense Manager
            </Button>
          }
        >
          {/* Filters Bar */}
          <div style={{ padding: "12px 16px", background: "var(--bms-surface-2)", borderRadius: 8, marginBottom: 16, border: "1px solid var(--bms-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <Space wrap size={12}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13, color: "var(--bms-text-2)" }}>
                  <FilterOutlined style={{ color: "#1677ff" }} /> Expense Filters:
                </div>
                <RangePicker
                  size="small"
                  value={expenseDateRange}
                  onChange={(dates) => setExpenseDateRange(dates as any)}
                  format="DD MMM YYYY"
                  style={{ width: 230 }}
                />
                <Select
                  size="small"
                  allowClear
                  showSearch
                  placeholder="Department"
                  style={{ width: 160 }}
                  value={expenseDeptFilter}
                  onChange={(v) => setExpenseDeptFilter(v ?? null)}
                  options={(deptsData as any[] ?? []).map((d) => ({ value: d.id, label: d.name }))}
                  filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                />
                <Select
                  size="small"
                  allowClear
                  placeholder="Category"
                  style={{ width: 170 }}
                  value={expenseCategoryFilter}
                  onChange={(v) => setExpenseCategoryFilter(v ?? null)}
                  options={EXPENSE_CATEGORIES}
                />
                <Select
                  size="small"
                  allowClear
                  placeholder="Status"
                  style={{ width: 130 }}
                  value={expenseStatusFilter}
                  onChange={(v) => setExpenseStatusFilter(v ?? null)}
                  options={EXPENSE_STATUSES}
                />
              </Space>
              {hasExpenseFilters && (
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<ClearOutlined />}
                  onClick={() => {
                    setExpenseDateRange(null);
                    setExpenseDeptFilter(null);
                    setExpenseCategoryFilter(null);
                    setExpenseStatusFilter(null);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Expense KPI Cards */}
          {isExpenseSummaryLoading ? (
            <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
          ) : (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" style={{ borderRadius: 10, background: "var(--bms-surface)" }}>
                    <Statistic
                      title={<span style={{ fontSize: 12, color: "var(--bms-text-3)" }}>Total Filtered Spend</span>}
                      value={expenseSummaryData?.total_all_time ?? 0}
                      formatter={(v) => fmtCurrency(Number(v))}
                      valueStyle={{ color: "var(--bms-text)", fontWeight: 700, fontSize: 20 }}
                      prefix={<WalletOutlined style={{ color: "#3b82f6", fontSize: 16 }} />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" style={{ borderRadius: 10, background: "var(--bms-surface)" }}>
                    <Statistic
                      title={<span style={{ fontSize: 12, color: "var(--bms-text-3)" }}>Current Month Spend</span>}
                      value={expenseSummaryData?.total_this_month ?? 0}
                      formatter={(v) => fmtCurrency(Number(v))}
                      valueStyle={{ color: "#059669", fontWeight: 700, fontSize: 20 }}
                      prefix={<ShoppingCartOutlined style={{ color: "#10b981", fontSize: 16 }} />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" style={{ borderRadius: 10, background: "var(--bms-surface)" }}>
                    <Statistic
                      title={<span style={{ fontSize: 12, color: "var(--bms-text-3)" }}>Pending Approval</span>}
                      value={expenseSummaryData?.pending_approval?.amount ?? 0}
                      formatter={(v) => fmtCurrency(Number(v))}
                      valueStyle={{ color: "#d97706", fontWeight: 700, fontSize: 20 }}
                      prefix={<ExclamationCircleOutlined style={{ color: "#f59e0b", fontSize: 16 }} />}
                      suffix={<span style={{ fontSize: 11, fontWeight: 400, color: "var(--bms-text-3)" }}>({expenseSummaryData?.pending_approval?.count ?? 0})</span>}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" style={{ borderRadius: 10, background: "var(--bms-surface)" }}>
                    <Statistic
                      title={<span style={{ fontSize: 12, color: "var(--bms-text-3)" }}>Approved & Reimbursed</span>}
                      value={expenseSummaryData?.approved_reimbursed?.amount ?? 0}
                      formatter={(v) => fmtCurrency(Number(v))}
                      valueStyle={{ color: "#8b5cf6", fontWeight: 700, fontSize: 20 }}
                      prefix={<CheckCircleOutlined style={{ color: "#8b5cf6", fontSize: 16 }} />}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Expense Charts & Recent Expenses Table */}
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card size="small" title={<span style={{ fontSize: 13, fontWeight: 600 }}><TagOutlined /> Spend by Category</span>} style={{ borderRadius: 10 }}>
                    {expenseCategoryChartData.length > 0 ? (
                      <Pie
                        data={expenseCategoryChartData}
                        angleField="value"
                        colorField="type"
                        radius={0.8}
                        innerRadius={0.5}
                        label={false}
                        legend={{ position: 'bottom' }}
                        height={240}
                        theme={isDark ? 'dark' : 'light'}
                      />
                    ) : (
                      <Empty description="No category breakdown available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card size="small" title={<span style={{ fontSize: 13, fontWeight: 600 }}><AccountBookOutlined /> Spend by Department</span>} style={{ borderRadius: 10 }}>
                    {expenseDepartmentChartData.length > 0 ? (
                      <Column
                        data={expenseDepartmentChartData}
                        xField="type"
                        yField="value"
                        color="#6366f1"
                        xAxis={{ label: { autoHide: true, autoRotate: false } }}
                        yAxis={{ label: { formatter: (v: string) => fmt(Number(v)) } }}
                        height={240}
                        columnWidthRatio={0.4}
                        theme={isDark ? 'dark' : 'light'}
                      />
                    ) : (
                      <Empty description="No department breakdown available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </Card>
                </Col>
              </Row>

              {/* Recent Expenses List */}
              <div style={{ marginTop: 16 }}>
                <Table
                  loading={isExpenseListLoading}
                  rowKey="id"
                  dataSource={expenseListData?.results ?? []}
                  size="small"
                  pagination={false}
                  columns={[
                    { title: "Expense #", dataIndex: "expense_number", render: (v) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
                    { title: "Date", dataIndex: "date", render: (v) => dayjs(v).format("DD MMM YYYY") },
                    { title: "Category", dataIndex: "category_label", render: (v) => <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag> },
                    { title: "Description", dataIndex: "description", ellipsis: true },
                    { title: "Paid By", dataIndex: "paid_by_name" },
                    { title: "Amount", dataIndex: "amount", align: "right", render: (v) => <Text strong>{fmtCurrency(v)}</Text> },
                    {
                      title: "Status", dataIndex: "status", width: 110,
                      render: (v, r) => (
                        <Tag color={v === "APPROVED" || v === "REIMBURSED" ? "success" : v === "SUBMITTED" ? "warning" : v === "REJECTED" ? "error" : "default"}>
                          {r.status_label || v}
                        </Tag>
                      ),
                    },
                  ]}
                  locale={{ emptyText: "No expense records match the current filters" }}
                />
              </div>
            </>
          )}
        </DashboardPanel>
      </div>

      <div className="exec-dash-section">
        <DashboardPanel
          title="Receivables overview"
          flush
          extra={
            <Button
              type="link"
              size="small"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate(
                receivableTab === "project"
                  ? "/payment/receivables?tab=project"
                  : "/payment/receivables",
              )}
            >
              Full summary
            </Button>
          }
        >
          <Tabs
            activeKey={receivableTab}
            onChange={(key) => setReceivableTab(key as "client" | "project")}
            size="small"
            style={{ padding: "0 12px" }}
            tabBarExtraContent={
              <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                {receivableTab === "client"
                  ? `${clients.length} client${clients.length !== 1 ? "s" : ""}`
                  : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
              </Text>
            }
            items={[
              {
                key: "client",
                label: "Client-wise",
                children: (
                  <Table
                    rowKey="client_id"
                    columns={clientColumns}
                    dataSource={clientRows}
                    size="small"
                    pagination={clientRows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                    onRow={() => ({ onClick: () => navigate("/payment/receivables"), style: { cursor: "pointer" } })}
                    locale={{ emptyText: "No client receivables yet" }}
                  />
                ),
              },
              {
                key: "project",
                label: "Project-wise",
                children: (
                  <Table
                    rowKey="project_id"
                    columns={projectColumns}
                    dataSource={projectRows}
                    size="small"
                    pagination={projectRows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                    onRow={() => ({ onClick: () => navigate("/payment/receivables?tab=project"), style: { cursor: "pointer" } })}
                    locale={{ emptyText: "No project receivables yet" }}
                  />
                ),
              },
            ]}
          />
        </DashboardPanel>
      </div>
    </DashboardShell>
  );
}
