import { Button, Input, InputNumber, Select, Table, Typography } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { DocumentLineItem } from "@/services/finance";

const { Option } = Select;
const { Text }   = Typography;

const GST_RATES = [0, 5, 12, 18, 28];

interface Props {
  items:     DocumentLineItem[];
  currency:  string;
  onChange:  (items: DocumentLineItem[]) => void;
  disabled?: boolean;
}

export default function LineItemsTable({ items, currency, onChange, disabled }: Props) {
  const add = () =>
    onChange([
      ...items,
      { description: "", quantity: 1, rate: 0, gst_percentage: 18, amount: 0 },
    ]);

  const remove = (idx: number) =>
    onChange(items.filter((_, i) => i !== idx));

  const update = (idx: number, field: keyof DocumentLineItem, value: unknown) => {
    const updated = items.map((item, i) => {
      if (i !== idx) return item;
      const next = { ...item, [field]: value };
      next.amount = parseFloat(
        ((next.quantity ?? 0) * (next.rate ?? 0)).toFixed(2)
      );
      return next;
    });
    onChange(updated);
  };

  const subtotal  = items.reduce((a, it) => a + (it.quantity ?? 0) * (it.rate ?? 0), 0);
  const gstAmount = items.reduce((a, it) => {
    const base = (it.quantity ?? 0) * (it.rate ?? 0);
    return a + parseFloat((base * (it.gst_percentage ?? 0) / 100).toFixed(2));
  }, 0);
  const total = subtotal + gstAmount;

  const columns = [
    {
      title: "#",
      key:   "idx",
      width: 40,
      render: (_: unknown, __: unknown, i: number) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text>
      ),
    },
    {
      title:     "Description",
      key:       "description",
      render: (_: unknown, item: DocumentLineItem, i: number) => (
        <Input
          value={item.description}
          placeholder="Item description…"
          disabled={disabled}
          onChange={e => update(i, "description", e.target.value)}
          style={{ minWidth: 200 }}
        />
      ),
    },
    {
      title: "Qty",
      key:   "quantity",
      width: 130,
      render: (_: unknown, item: DocumentLineItem, i: number) => (
        <InputNumber
          value={item.quantity}
          min={0}
          precision={2}
          disabled={disabled}
          onChange={v => update(i, "quantity", v ?? 0)}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: `Rate (${currency})`,
      key:   "rate",
      width: 130,
      render: (_: unknown, item: DocumentLineItem, i: number) => (
        <InputNumber
          value={item.rate}
          min={0}
          precision={2}
          disabled={disabled}
          onChange={v => update(i, "rate", v ?? 0)}
          style={{ width: "100%" }}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
        />
      ),
    },
    {
      title: "GST %",
      key:   "gst_percentage",
      width: 100,
      render: (_: unknown, item: DocumentLineItem, i: number) => (
        <Select
          value={item.gst_percentage}
          disabled={disabled}
          onChange={(v: number) => update(i, "gst_percentage", v)}
          style={{ width: "100%" }}
        >
          {GST_RATES.map(r => (
            <Option key={r} value={r}>{r}%</Option>
          ))}
        </Select>
      ),
    },
    {
      title:  `Amount (${currency})`,
      key:    "amount",
      width:  140,
      align:  "right" as const,
      render: (_: unknown, item: DocumentLineItem) => (
        <Text strong>
          {((item.quantity ?? 0) * (item.rate ?? 0)).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
          })}
        </Text>
      ),
    },
    {
      title:  "",
      key:    "action",
      width:  40,
      render: (_: unknown, __: unknown, i: number) =>
        !disabled ? (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => remove(i)}
          />
        ) : null,
    },
  ];

  return (
    <div>
      <Table
        rowKey={(_, i) => String(i)}
        columns={columns}
        dataSource={items}
        pagination={false}
        size="small"
        bordered
        style={{ marginBottom: 8 }}
      />

      {!disabled && (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={add}
          style={{ width: "100%", marginBottom: 16 }}
        >
          Add Line Item
        </Button>
      )}

      {/* ── Totals summary ── */}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: 4,
      }}>
        <table style={{ minWidth: 280, borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 16px", color: "#5a6a7e", textAlign: "right" }}>
                Subtotal
              </td>
              <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 500, minWidth: 110 }}>
                {currency} {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 16px", color: "#5a6a7e", textAlign: "right" }}>
                GST Amount
              </td>
              <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 500 }}>
                {currency} {gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
            </tr>
            <tr style={{ borderTop: "2px solid #1677ff" }}>
              <td style={{ padding: "8px 16px", textAlign: "right", fontWeight: 700, fontSize: 15, color: "#1677ff" }}>
                Total
              </td>
              <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, fontSize: 15, color: "#1677ff" }}>
                {currency} {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
