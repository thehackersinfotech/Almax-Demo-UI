import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table, Card, Typography, Spin, Alert, Tag, Progress, Input, Row, Col,
  Statistic,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { paymentReportsApi, ClientReceivable } from "@/services/payment";
import PercentChip from "@/components/common/PercentChip";

const { Title, Text } = Typography;

function fmtCurrency(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function ClientReceivableSection({ showTitle = true }: { showTitle?: boolean }) {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["payment-client-receivable"],
    queryFn: paymentReportsApi.clientReceivable,
    staleTime: 30_000,
  });

  if (isLoading) return <Spin style={{ display: "block", margin: "24px auto" }} />;
  if (error) return <Alert type="error" message="Failed to load client receivables" />;

  const rows: ClientReceivable[] = ((data as any)?.results ?? []).filter(
    (r: ClientReceivable) =>
      !search || r.client_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalInvoiced = rows.reduce((s, r) => s + r.total_invoiced, 0);
  const totalReceived = rows.reduce((s, r) => s + r.total_received, 0);
  const totalPending  = rows.reduce((s, r) => s + r.total_pending,  0);
  const totalOverdue  = rows.reduce((s, r) => s + r.overdue_amount, 0);

  const columns: ColumnsType<ClientReceivable> = [
    {
      title: "Client",
      dataIndex: "client_name",
      sorter: (a, b) => a.client_name.localeCompare(b.client_name),
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: "Total Invoiced",
      dataIndex: "total_invoiced",
      align: "right",
      sorter: (a, b) => a.total_invoiced - b.total_invoiced,
      render: (v) => fmtCurrency(v),
    },
    {
      title: "Total Received",
      dataIndex: "total_received",
      align: "right",
      sorter: (a, b) => a.total_received - b.total_received,
      render: (v) => <Text style={{ color: "#52c41a" }}>{fmtCurrency(v)}</Text>,
    },
    {
      title: "Pending",
      dataIndex: "total_pending",
      align: "right",
      sorter: (a, b) => a.total_pending - b.total_pending,
      render: (v) => <Text style={{ color: v > 0 ? "#ff4d4f" : "#52c41a" }}><strong>{fmtCurrency(v)}</strong></Text>,
    },
    {
      title: "Overdue",
      dataIndex: "overdue_amount",
      align: "right",
      sorter: (a, b) => a.overdue_amount - b.overdue_amount,
      render: (v) => v > 0 ? <Tag color="error">{fmtCurrency(v)}</Tag> : <Tag color="success">None</Tag>,
    },
    {
      title: "Invoices",
      dataIndex: "invoice_count",
      align: "center",
    },
    {
      title: "Collection %",
      dataIndex: "collection_pct",
      sorter: (a, b) => a.collection_pct - b.collection_pct,
      align: "right" as const,
      width: 120,
      render: (v) => <PercentChip value={v} mode="higher-better" decimals={0} />,
    },
    {
      title: "Avg Collection Days",
      dataIndex: "avg_collection_days",
      align: "center",
      render: (v) => v != null ? <Tag color={v <= 30 ? "green" : v <= 60 ? "orange" : "red"}>{v} days</Tag> : "—",
    },
  ];

  return (
    <div>
      {showTitle && <Title level={4} style={{ marginBottom: 16 }}>Client Receivable Summary</Title>}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Total Invoiced" value={fmtCurrency(totalInvoiced)} valueStyle={{ color: "#722ed1", fontSize: 16 }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Total Received" value={fmtCurrency(totalReceived)} valueStyle={{ color: "#52c41a", fontSize: 16 }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Total Pending" value={fmtCurrency(totalPending)} valueStyle={{ color: "#1677ff", fontSize: 16 }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Total Overdue" value={fmtCurrency(totalOverdue)} valueStyle={{ color: "#ff4d4f", fontSize: 16 }} /></Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
          allowClear
        />
      </Card>

      <Table
        rowKey="client_id"
        columns={columns}
        dataSource={rows}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true }}
        summary={() => (
          <Table.Summary.Row style={{ background: "var(--bms-surface-2)" }}>
            <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right"><Text strong>{fmtCurrency(totalInvoiced)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right"><Text strong style={{ color: "#52c41a" }}>{fmtCurrency(totalReceived)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: "#ff4d4f" }}>{fmtCurrency(totalPending)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><Text strong style={{ color: "#ff4d4f" }}>{fmtCurrency(totalOverdue)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="center"><Text strong>{rows.reduce((s, r) => s + r.invoice_count, 0)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={6} />
            <Table.Summary.Cell index={7} />
          </Table.Summary.Row>
        )}
      />
    </div>
  );
}
