import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Tabs, Table, Typography, Row, Col, Select, DatePicker,
  Statistic, Space, Tag, Progress,
} from "antd";
import dayjs from "dayjs";
import { reportsApi } from "@/services/dashboard";
import { get } from "@/services/api";
import { ENDPOINTS } from "@/constants/api";
import PercentChip from "@/components/common/PercentChip";
import AssigneeAvatar from "@/components/common/AssigneeAvatar";

const { Title } = Typography;

function PortfolioReport() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-portfolio"],
    queryFn: reportsApi.portfolio,
  });

  const rows = Array.isArray(data) ? data : [];

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "success", ON_HOLD: "warning", COMPLETED: "blue", DELAYED: "error", PLANNING: "cyan",
  };

  return (
    <Table
      dataSource={rows}
      loading={isLoading}
      rowKey="id"
      size="middle"
      columns={[
        { title: "Code", dataIndex: "code", key: "code" },
        { title: "Name", dataIndex: "name", key: "name" },
        { title: "Client", dataIndex: "client", key: "client", render: (v: any) => v ?? "—" },
        { title: "Status", dataIndex: "status", key: "status", render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
        { title: "Type", dataIndex: "business_type", key: "business_type" },
        { title: "Billing", dataIndex: "billing_type", key: "billing_type" },
        { title: "Estimated", dataIndex: "estimated_hours", key: "est", render: (v: number) => `${v}h` },
        { title: "Logged", dataIndex: "logged_hours", key: "logged", render: (v: number) => `${v}h` },
        { title: "Manager", dataIndex: "manager", key: "manager", render: (v: any) => v ?? "—" },
      ]}
    />
  );
}

function UtilizationReport() {
  const today = dayjs();
  const [year, setYear] = useState(today.year());
  const [month, setMonth] = useState(today.month() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["report-utilization", year, month],
    queryFn: () => reportsApi.utilization(year, month),
  });

  const rows = Array.isArray(data) ? data : [];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Select value={month} onChange={setMonth} style={{ width: 140 }}
          options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: dayjs().month(i).format("MMMM") }))} />
        <Select value={year} onChange={setYear} style={{ width: 100 }}
          options={[-1, 0, 1].map((d) => { const y = today.year() + d; return { value: y, label: String(y) }; })} />
      </Space>
      <Table
        dataSource={rows}
        loading={isLoading}
        rowKey="employee_id"
        size="middle"
        columns={[
          {
            title: "Employee",
            dataIndex: "employee_name",
            key: "employee_name",
            render: (name: string) => (
              <Space size={10}>
                <AssigneeAvatar name={name} size={28} />
                <span>{name}</span>
              </Space>
            ),
          },
          { title: "Working Days", dataIndex: "working_days", key: "working_days" },
          { title: "Capacity", dataIndex: "total_capacity_hours", key: "capacity", render: (v: number) => `${v}h` },
          { title: "Logged", dataIndex: "logged_hours", key: "logged", render: (v: number) => `${v}h` },
          { title: "Utilization", dataIndex: "utilization_percent", key: "util", align: "right" as const, width: 120, render: (v: number) => <PercentChip value={v} mode="utilization" decimals={1} /> },
          { title: "Billing Util.", dataIndex: "billing_utilization_percent", key: "bill", align: "right" as const, width: 120, render: (v: number) => <PercentChip value={v} mode="higher-better" decimals={1} /> },
          { title: "Alloc%", dataIndex: "allocation_percent", key: "alloc", align: "right" as const, width: 120, render: (v: number, r: any) => <PercentChip value={v} mode="allocation" overAllocated={r.is_over_allocated} label={r.is_over_allocated ? `Over · ${v}%` : undefined} /> },
          {
            title: "Status", key: "status",
            render: (_: any, r: any) => r.is_over_allocated
              ? <Tag color="error">Over-allocated</Tag>
              : <Tag color="success">Normal</Tag>,
          },
        ]}
      />
    </>
  );
}

function AllocationMatrix() {
  const { data, isLoading } = useQuery({
    queryKey: ["report-allocation-matrix"],
    queryFn: reportsApi.allocationMatrix,
  });
  const rows = Array.isArray(data) ? data : [];

  return (
    <Table
      dataSource={rows}
      loading={isLoading}
      rowKey="employee"
      size="middle"
      expandable={{
        expandedRowRender: (r: any) => (
          <Table
            dataSource={r.projects}
            rowKey="project"
            size="small"
            pagination={false}
            columns={[
              { title: "Project", dataIndex: "project", key: "project" },
              { title: "Allocation%", dataIndex: "allocation_pct", key: "alloc", align: "right" as const, width: 120, render: (v: number) => <PercentChip value={v} mode="allocation" /> },
              { title: "Daily Hours", dataIndex: "daily_hours", key: "daily", render: (v: number) => `${v}h` },
              { title: "Start", dataIndex: "start_date", key: "start" },
              { title: "End", dataIndex: "end_date", key: "end", render: (v: any) => v ?? "Ongoing" },
            ]}
          />
        ),
      }}
      columns={[
        { title: "Employee", dataIndex: "employee", key: "employee" },
        { title: "Projects", key: "projects", render: (_: any, r: any) => r.projects.length },
      ]}
    />
  );
}

export default function ReportsPage() {
  const tabItems = [
    { key: "portfolio", label: "Portfolio Overview", children: <PortfolioReport /> },
    { key: "utilization", label: "Utilization Report", children: <UtilizationReport /> },
    { key: "allocation-matrix", label: "Allocation Matrix", children: <AllocationMatrix /> },
  ];

  return (
    <div>
      <Title level={3}>Reports</Title>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}
