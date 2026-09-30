import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Typography, Card, Tabs, Row, Col, Button, Modal, Table, Alert, Descriptions,
  Form, Input, InputNumber, Select, Tag, Space, Badge, message, Empty,
  Popconfirm, Progress, Avatar, notification,
} from "antd";
import {
  DesktopOutlined, AppstoreOutlined, TeamOutlined, InboxOutlined,
  PlusOutlined, ReloadOutlined, CheckOutlined, CloseOutlined,
  ExclamationCircleOutlined, ThunderboltOutlined,
  BoxPlotOutlined, HomeOutlined, SearchOutlined, BarChartOutlined,
  RightOutlined, DownOutlined, CheckCircleOutlined, UsergroupDeleteOutlined, WarningOutlined, EyeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { employeeApi } from "@/services/employees";
import { useAuthStore } from "@/store/auth";
import { offboardingStore } from "@/store/offboardingStore";
import type { OffboardingRequest } from "@/services/offboarding";
import {
  itAssetStore,
  type InventoryItem, type AssetRequest, type EmployeeAsset, type RequestStatus,
} from "@/store/itAssets";

const { Title, Text, Paragraph } = Typography;

// ─── helpers ──────────────────────────────────────────────────────────────────
const KIND_COLOR = { asset: "#3b82f6", facility: "#8b5cf6", digital: "#10b981" } as const;
const STATUS_COLOR: Record<RequestStatus, string> = {
  pending: "orange", approved: "blue", fulfilled: "green", rejected: "red", refill_needed: "volcano",
};
const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending", approved: "Approved", fulfilled: "Fulfilled", rejected: "Rejected", refill_needed: "Refill Needed",
};
const COND_COLOR: Record<string, string> = { Excellent: "#10b981", Good: "#3b82f6", Fair: "#f59e0b" };

function stockColor(available: number, total: number): string {
  if (total === 0 || total >= 999) return "#34d399";
  const pct = (available / total) * 100;
  if (pct === 0) return "#f87171";
  if (pct < 25) return "#fbbf24";
  return "#34d399";
}

function StockBadge({ available, total }: { available: number; total: number }) {
  if (total >= 999) return <Tag color="green">Unlimited</Tag>;
  const color = stockColor(available, total);
  const pct = Math.round((available / Math.max(total, 1)) * 100);
  return (
    <Space size={4}>
      <span style={{ fontWeight: 700, color }}>{available}</span>
      <Text type="secondary" style={{ fontSize: 11 }}>/ {total}</Text>
      <Progress
        percent={pct} showInfo={false} size="small"
        strokeColor={color}
        style={{ width: 60, marginBottom: 0 }}
      />
    </Space>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ title, value, icon, color, subtitle, onClick, active }: {
  title: string; value: number | string; icon: React.ReactNode;
  color: string; subtitle?: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <Card
      onClick={onClick}
      style={{
        borderRadius: 12,
        border: active ? `2px solid ${color}` : "1px solid var(--bms-border)",
        background: active ? `${color}10` : "var(--bms-surface)",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.18s",
        boxShadow: active ? `0 0 0 3px ${color}22` : undefined,
      }}
      bodyStyle={{ padding: "20px 24px" }}
      hoverable={!!onClick}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <Text style={{ fontSize: 12, color: "var(--bms-text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {title}
          </Text>
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--bms-text)", lineHeight: 1.2, marginTop: 6 }}>
            {value}
          </div>
          {subtitle && (
            <Text style={{ fontSize: 12, color: "var(--bms-text-3)", marginTop: 4, display: "block" }}>
              {subtitle}
            </Text>
          )}
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${color}20`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, color,
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Item Checklist Modal ─────────────────────────────────────────────────────
function ItemChecklistModal({ item, open, onClose, empAssets }: {
  item: InventoryItem | null;
  open: boolean;
  onClose: () => void;
  empAssets: EmployeeAsset[];
}) {
  if (!item) return null;
  const assigned = empAssets.filter((ea) => ea.inventoryItemId === item.id);
  const kindColor = item.kind === "asset" ? "#3b82f6" : "#8b5cf6";
  const units = item.units || [];

  return (
    <Modal
      title={
        <Space>
          {item.kind === "asset" ? <DesktopOutlined style={{ color: "#3b82f6" }} /> : <HomeOutlined style={{ color: "#8b5cf6" }} />}
          <span>{item.name} — Individual Unit IDs</span>
          <Tag color="blue" style={{ fontSize: 10, fontWeight: 600 }}>ID: {item.itemCode}</Tag>
          <Tag color={kindColor} style={{ fontSize: 10 }}>{item.kind === "asset" ? "IT Asset" : "Facility"}</Tag>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ textAlign: "center", padding: "10px", borderRadius: 8, background: `${kindColor}10`, border: `1px solid ${kindColor}30` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: kindColor }}>{item.assignedCount}</div>
              <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Assigned Units</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: "center", padding: "10px", borderRadius: 8, background: "#10b98110", border: "1px solid #10b98130" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>{item.totalStock >= 999 ? "∞" : item.availableStock}</div>
              <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Available Units</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: "center", padding: "10px", borderRadius: 8, background: "#f59e0b10", border: "1px solid #f59e0b30" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{item.totalStock >= 999 ? "∞" : item.totalStock}</div>
              <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Total Stock</div>
            </div>
          </Col>
        </Row>
      </div>

      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--bms-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          <CheckCircleOutlined style={{ marginRight: 5, color: "#10b981" }} />All {units.length} Individual Unit IDs
        </div>
        {units.length === 0 ? (
          <Empty description="No individual units created" />
        ) : (
          units.map((unit) => {
            const isAssigned = unit.status === "assigned";
            const assignedEa = assigned.find((ea) => ea.assetCode === unit.unitCode);
            const employeeName = unit.assignedToEmployeeName || assignedEa?.employeeName;

            return (
              <div
                key={unit.unitCode}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  marginBottom: 6,
                  borderRadius: 8,
                  background: "var(--bms-surface-2)",
                  border: "1px solid var(--bms-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <code style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", background: "#3b82f615", padding: "2px 8px", borderRadius: 4 }}>
                    {unit.unitCode}
                  </code>
                  {isAssigned && employeeName && (
                    <Text style={{ fontSize: 12, color: "var(--bms-text)" }}>
                      Assigned to: <strong>{employeeName}</strong>
                    </Text>
                  )}
                </div>
                <Tag color={isAssigned ? "blue" : "green"} style={{ fontSize: 11, margin: 0 }}>
                  {isAssigned ? "Assigned" : "Available"}
                </Tag>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}

// ─── Add Inventory Modal ───────────────────────────────────────────────────────
function AddInventoryModal({ open, kind, onClose }: { open: boolean; kind: "asset" | "facility" | "digital"; onClose: () => void }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const code = itAssetStore.generateNextCode(kind);
      form.setFieldsValue({ itemCode: code });
    }
  }, [open, kind, form]);

  const assetCategories = [
    { value: "laptop", label: "Laptop" }, { value: "mouse", label: "Mouse" },
    { value: "keyboard", label: "Keyboard" }, { value: "monitor", label: "Monitor" },
    { value: "headset", label: "Headset" }, { value: "webcam", label: "Webcam" },
    { value: "printer", label: "Printer" }, { value: "other", label: "Other" },
  ];
  const facilityCategories = [
    { value: "parking", label: "Parking Slot" }, { value: "locker", label: "Locker" },
    { value: "desk", label: "Workstation / Desk" }, { value: "cafeteria", label: "Cafeteria Access" },
    { value: "gym", label: "Gym Membership" }, { value: "other", label: "Other" },
  ];
  const digitalCategories = [
    { value: "subscription", label: "Software / SaaS Subscription (Figma, Adobe, Office 365)" },
    { value: "account", label: "System / Email / Cloud Account" },
    { value: "wifi", label: "Wi-Fi / VPN Access Pass" },
    { value: "biometric", label: "Biometric / Gate Security Access" },
    { value: "other_digital", label: "Other Digital Asset" },
  ];

  const handleOk = async () => {
    try {
      const vals = await form.validateFields();
      setLoading(true);
      itAssetStore.addInventoryItem({ ...vals, kind, assignedCount: 0 });
      const label = kind === "asset" ? "IT Asset" : kind === "facility" ? "Facility" : "Digital Asset";
      message.success(`${label} (${vals.itemCode}) added to inventory`);
      form.resetFields();
      onClose();
    } catch { /* validation failed */ }
    finally { setLoading(false); }
  };

  const titleText = kind === "asset" ? "Add Asset to Inventory" : kind === "facility" ? "Add Facility to Inventory" : "Add Digital Asset to Inventory";
  const namePlaceholder = kind === "asset" ? "e.g. Laptop, Monitor" : kind === "facility" ? "e.g. Parking Slot, Locker" : "e.g. Figma Subscription, Office 365, Wi-Fi Pass, Biometric Access";
  const categoryOptions = kind === "asset" ? assetCategories : kind === "facility" ? facilityCategories : digitalCategories;

  return (
    <Modal
      title={<Space><PlusOutlined />{titleText}</Space>}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose(); }}
      confirmLoading={loading}
      okText="Add to Inventory"
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="itemCode"
          label="Unique ID Number"
          rules={[{ required: true, message: "Enter unique ID number" }]}
          extra="Auto-generated unique identifier code for this asset"
        >
          <Input placeholder={kind === "asset" ? "e.g. AST-1001" : kind === "facility" ? "e.g. FAC-1001" : "e.g. DIG-1001"} />
        </Form.Item>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: "Enter a name" }]}>
          <Input placeholder={namePlaceholder} />
        </Form.Item>
        <Form.Item name="category" label="Category" rules={[{ required: true }]}>
          <Select options={categoryOptions} placeholder="Select category" />
        </Form.Item>
        <Form.Item name="totalStock" label="Initial Stock" rules={[{ required: true }]}>
          <InputNumber min={0} max={9999} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="availableStock" label="Available Stock" rules={[{ required: true }]} extra="Must be ≤ total stock">
          <InputNumber min={0} max={9999} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} placeholder="Optional notes..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Refill Modal ─────────────────────────────────────────────────────────────
function RefillModal({ item, open, onClose }: { item: InventoryItem | null; open: boolean; onClose: () => void }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const { qty } = await form.validateFields();
      setLoading(true);
      itAssetStore.refillStock(item!.id, qty);
      message.success(`Stock refilled by ${qty} units`);
      form.resetFields();
      onClose();
    } catch { /* validation failed */ }
    finally { setLoading(false); }
  };

  return (
    <Modal
      title={<Space><ReloadOutlined />Refill Stock — {item?.name}</Space>}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose(); }}
      confirmLoading={loading}
      okText="Refill"
      width={380}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <div style={{
          padding: "12px 16px", borderRadius: 8, background: "var(--bms-surface-2)",
          marginBottom: 16, border: "1px solid var(--bms-border)",
        }}>
          <Row gutter={24}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Current Stock</Text>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--bms-text)" }}>{item?.availableStock ?? 0}</div>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Total</Text>
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--bms-text)" }}>{item?.totalStock ?? 0}</div>
            </Col>
          </Row>
        </div>
        <Form.Item name="qty" label="Quantity to Add" rules={[{ required: true, message: "Enter quantity" }]}>
          <InputNumber min={1} max={9999} style={{ width: "100%" }} placeholder="e.g. 10" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Inventory Tab ─────────────────────────────────────────────────────────────
function InventoryTab({ defaultKind }: { defaultKind?: "asset" | "facility" | "digital" }) {
  const [kind, setKind] = useState<"asset" | "facility" | "digital">(defaultKind ?? "asset");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [empAssets, setEmpAssets] = useState<EmployeeAsset[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [refillItem, setRefillItem] = useState<InventoryItem | null>(null);
  const [checklistItem, setChecklistItem] = useState<InventoryItem | null>(null);

  const reload = useCallback(() => {
    setInventory(itAssetStore.getInventory().filter((i) => i.kind === kind));
    setEmpAssets(itAssetStore.getEmployeeAssets());
  }, [kind]);

  useEffect(() => {
    reload();
    return itAssetStore.subscribe(reload);
  }, [reload]);

  return (
    <div>
      {/* Kind toggle buttons */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <Space>
          <Button
            type={kind === "asset" ? "primary" : "default"}
            icon={<DesktopOutlined />}
            onClick={() => setKind("asset")}
            style={kind === "asset" ? { background: "#3b82f6", borderColor: "#3b82f6" } : {}}
          >
            IT Assets
          </Button>
          <Button
            type={kind === "facility" ? "primary" : "default"}
            icon={<HomeOutlined />}
            onClick={() => setKind("facility")}
            style={kind === "facility" ? { background: "#8b5cf6", borderColor: "#8b5cf6" } : {}}
          >
            Facilities
          </Button>
          <Button
            type={kind === "digital" ? "primary" : "default"}
            icon={<ThunderboltOutlined />}
            onClick={() => setKind("digital")}
            style={kind === "digital" ? { background: "#10b981", borderColor: "#10b981" } : {}}
          >
            Digital Assets
          </Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          Add {kind === "asset" ? "IT Asset" : kind === "facility" ? "Facility" : "Digital Asset"}
        </Button>
      </div>

      {inventory.length === 0 ? (
        <Empty description={`No ${kind === "asset" ? "assets" : "facilities"} in inventory`} />
      ) : (
        <Row gutter={[16, 16]}>
          {inventory.map((item) => {
            const pct = item.totalStock >= 999 ? 100 : Math.round((item.availableStock / Math.max(item.totalStock, 1)) * 100);
            const color = stockColor(item.availableStock, item.totalStock);
            const kindColor = item.kind === "asset" ? "#3b82f6" : "#8b5cf6";
            const assignedToEmployees = empAssets.filter((ea) => ea.inventoryItemId === item.id);
            return (
              <Col xs={24} md={12} xl={8} key={item.id}>
                <Card
                  bodyStyle={{ padding: "16px 18px" }}
                  style={{ borderRadius: 10, border: "1px solid var(--bms-border)", background: "var(--bms-surface)", cursor: "pointer" }}
                  hoverable
                  onClick={() => setChecklistItem(item)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--bms-text)" }}>{item.name}</div>
                      <Space size={4} style={{ marginTop: 4 }}>
                        <Tag color="blue" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>ID: {item.itemCode}</Tag>
                        <Tag color={kindColor} style={{ fontSize: 10, margin: 0 }}>{item.category}</Tag>
                        {item.availableStock === 0 && item.totalStock < 999 && (
                          <Tag color="red" style={{ fontSize: 10, margin: 0 }}>Out of Stock</Tag>
                        )}
                      </Space>
                    </div>
                    <Button size="small" icon={<ReloadOutlined />} onClick={(e) => { e.stopPropagation(); setRefillItem(item); }} disabled={item.totalStock >= 999}>
                      Refill
                    </Button>
                  </div>
                  {item.description && (
                    <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 8 }}>{item.description}</Text>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
                      {item.totalStock >= 999 ? "Unlimited" : `${item.availableStock} / ${item.totalStock} available`}
                    </Text>
                    <Text style={{ fontSize: 12, color: kindColor }}>{item.assignedCount} assigned</Text>
                  </div>
                  <Progress percent={pct} showInfo={false} strokeColor={color} size="small" style={{ margin: 0 }} />
                  {assignedToEmployees.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--bms-border)" }}>
                      <div style={{ fontSize: 11, color: "var(--bms-text-3)", marginBottom: 6 }}>
                        <CheckCircleOutlined style={{ color: "#10b981", marginRight: 4 }} />
                        {assignedToEmployees.length} employee{assignedToEmployees.length !== 1 ? "s" : ""} — click to view checklist
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {assignedToEmployees.slice(0, 4).map((ea) => (
                          <Avatar key={ea.id} size={22} style={{ background: kindColor, fontSize: 9, fontWeight: 700 }}>
                            {ea.employeeName.charAt(0).toUpperCase()}
                          </Avatar>
                        ))}
                        {assignedToEmployees.length > 4 && (
                          <Avatar size={22} style={{ background: "var(--bms-surface-2)", fontSize: 9, color: "var(--bms-text-2)", border: "1px solid var(--bms-border)" }}>
                            +{assignedToEmployees.length - 4}
                          </Avatar>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <AddInventoryModal open={addOpen} kind={kind} onClose={() => { setAddOpen(false); reload(); }} />
      <RefillModal item={refillItem} open={!!refillItem} onClose={() => { setRefillItem(null); reload(); }} />
      <ItemChecklistModal item={checklistItem} open={!!checklistItem} onClose={() => setChecklistItem(null)} empAssets={empAssets} />
    </div>
  );
}

// ─── Employee Assets Tab ───────────────────────────────────────────────────────
function EmployeeAssetsTab() {
  const [assets, setAssets] = useState<EmployeeAsset[]>([]);
  const [kindFilter, setKindFilter] = useState<"all" | "asset" | "facility">("all");
  const [searchText, setSearchText] = useState("");
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  const reload = useCallback(() => setAssets(itAssetStore.getEmployeeAssets()), []);
  useEffect(() => { reload(); return itAssetStore.subscribe(reload); }, [reload]);

  const { data } = useQuery({ queryKey: ["employees-list-all"], queryFn: () => employeeApi.list({ page: 1, page_size: 999 }), staleTime: 60000 });
  const employees = (data as any)?.results ?? [];

  // Group assets by employee
  const byEmployee = useMemo(() => {
    const map = new Map<string, { empId: string; empName: string; empCode: string; items: EmployeeAsset[] }>();
    assets.forEach((a) => {
      if (!map.has(a.employeeId)) {
        const emp = employees.find((e: any) => e.id === a.employeeId);
        map.set(a.employeeId, {
          empId: a.employeeId,
          empName: a.employeeName,
          empCode: emp?.employee_code ?? "",
          items: [],
        });
      }
      map.get(a.employeeId)!.items.push(a);
    });
    return [...map.values()];
  }, [assets, employees]);

  const filtered = useMemo(() => {
    return byEmployee
      .map((grp) => ({
        ...grp,
        items: grp.items.filter((a) => kindFilter === "all" || a.kind === kindFilter),
      }))
      .filter((grp) => {
        if (grp.items.length === 0) return false;
        const q = searchText.toLowerCase();
        return !q || grp.empName.toLowerCase().includes(q) || grp.empCode.toLowerCase().includes(q);
      });
  }, [byEmployee, kindFilter, searchText]);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Input
          prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
          placeholder="Search employees..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ maxWidth: 280 }}
        />
        <Space>
          <Button
            size="small"
            type={kindFilter === "all" ? "primary" : "default"}
            onClick={() => setKindFilter("all")}
          >All</Button>
          <Button
            size="small"
            type={kindFilter === "asset" ? "primary" : "default"}
            icon={<DesktopOutlined />}
            onClick={() => setKindFilter("asset")}
            style={kindFilter === "asset" ? { background: "#3b82f6", borderColor: "#3b82f6" } : {}}
          >IT Assets</Button>
          <Button
            size="small"
            type={kindFilter === "facility" ? "primary" : "default"}
            icon={<HomeOutlined />}
            onClick={() => setKindFilter("facility")}
            style={kindFilter === "facility" ? { background: "#8b5cf6", borderColor: "#8b5cf6" } : {}}
          >Facilities</Button>
          <Button
            size="small"
            type={kindFilter === "digital" ? "primary" : "default"}
            icon={<ThunderboltOutlined />}
            onClick={() => setKindFilter("digital")}
            style={kindFilter === "digital" ? { background: "#10b981", borderColor: "#10b981" } : {}}
          >Digital Assets</Button>
        </Space>
      </div>

      {filtered.length === 0 ? (
        <Empty description="No assets assigned to employees yet" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((grp) => {
            const initials = grp.empName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            const isExpanded = expandedEmpId === grp.empId;
            const assetCount = grp.items.filter((i) => i.kind === "asset").length;
            const facilityCount = grp.items.filter((i) => i.kind === "facility").length;
            const digitalCount = grp.items.filter((i) => i.kind === "digital").length;

            return (
              <Card
                key={grp.empId}
                bodyStyle={{ padding: 0 }}
                style={{ borderRadius: 10, border: "1px solid var(--bms-border)", overflow: "hidden" }}
              >
                {/* Employee row — click to expand */}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
                    cursor: "pointer", background: isExpanded ? "var(--bms-surface-2)" : "var(--bms-surface)",
                    transition: "background 0.15s",
                  }}
                  onClick={() => setExpandedEmpId(isExpanded ? null : grp.empId)}
                >
                  <Avatar size={38} style={{ background: "#3b82f6", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {initials}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--bms-text)" }}>{grp.empName}</div>
                    <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>{grp.empCode}</div>
                  </div>
                  <Space size={6}>
                    {assetCount > 0 && <Tag color="#3b82f6" style={{ fontSize: 11 }}>{assetCount} asset{assetCount !== 1 ? "s" : ""}</Tag>}
                    {facilityCount > 0 && <Tag color="#8b5cf6" style={{ fontSize: 11 }}>{facilityCount} facilit{facilityCount !== 1 ? "ies" : "y"}</Tag>}
                    {digitalCount > 0 && <Tag color="#10b981" style={{ fontSize: 11 }}>{digitalCount} digital</Tag>}
                    {isExpanded ? <DownOutlined style={{ color: "var(--bms-text-3)", fontSize: 12 }} /> : <RightOutlined style={{ color: "var(--bms-text-3)", fontSize: 12 }} />}
                  </Space>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: "12px 18px 16px", borderTop: "1px solid var(--bms-border)" }}>
                    {/* IT Assets section */}
                    {grp.items.filter((i) => i.kind === "asset").length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                          <DesktopOutlined style={{ marginRight: 5 }} />IT Assets
                        </div>
                        {grp.items.filter((i) => i.kind === "asset").map((item) => (
                          <div key={item.id} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                            background: "var(--bms-surface)", border: "1px solid var(--bms-border)",
                          }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#3b82f620", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", fontSize: 16 }}>
                                <DesktopOutlined />
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{item.itemName}</div>
                                <Space size={6} style={{ marginTop: 2 }}>
                                  <Text style={{ fontSize: 11 }} type="secondary">{item.category}</Text>
                                  <code style={{ fontSize: 10, color: "var(--bms-text-2)", background: "var(--bms-surface-2)", padding: "1px 5px", borderRadius: 3 }}>{item.assetCode}</code>
                                  <Text type="secondary" style={{ fontSize: 11 }}>Since {item.assignedDate}</Text>
                                </Space>
                              </div>
                            </div>
                            <Space>
                              <div style={{ textAlign: "right" }}>
                                <Tag color={COND_COLOR[item.condition] ?? "default"} style={{ fontSize: 11 }}>{item.condition}</Tag>
                                <div style={{ fontSize: 10, color: "var(--bms-text-3)", marginTop: 2 }}>Condition</div>
                              </div>
                              <Popconfirm title="Revoke this asset?" onConfirm={() => { itAssetStore.revokeAsset(item.id); message.success("Asset revoked"); }}>
                                <Button size="small" danger>Revoke</Button>
                              </Popconfirm>
                            </Space>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Facilities section */}
                    {grp.items.filter((i) => i.kind === "facility").length > 0 && (
                      <div style={{ marginBottom: grp.items.filter((i) => i.kind === "digital").length > 0 ? 12 : 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                          <HomeOutlined style={{ marginRight: 5 }} />Facilities
                        </div>
                        {grp.items.filter((i) => i.kind === "facility").map((item) => (
                          <div key={item.id} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                            background: "var(--bms-surface)", border: "1px solid var(--bms-border)",
                          }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#8b5cf620", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6", fontSize: 16 }}>
                                <HomeOutlined />
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{item.itemName}</div>
                                <Space size={6} style={{ marginTop: 2 }}>
                                  <Text style={{ fontSize: 11 }} type="secondary">{item.category}</Text>
                                  <code style={{ fontSize: 10, color: "var(--bms-text-2)", background: "var(--bms-surface-2)", padding: "1px 5px", borderRadius: 3 }}>{item.assetCode}</code>
                                  <Text type="secondary" style={{ fontSize: 11 }}>Since {item.assignedDate}</Text>
                                </Space>
                              </div>
                            </div>
                            <Space>
                              <div style={{ textAlign: "right" }}>
                                <Tag color={COND_COLOR[item.condition] ?? "default"} style={{ fontSize: 11 }}>{item.condition}</Tag>
                                <div style={{ fontSize: 10, color: "var(--bms-text-3)", marginTop: 2 }}>Condition</div>
                              </div>
                              <Popconfirm title="Revoke this facility?" onConfirm={() => { itAssetStore.revokeAsset(item.id); message.success("Facility revoked"); }}>
                                <Button size="small" danger>Revoke</Button>
                              </Popconfirm>
                            </Space>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Digital Assets section */}
                    {grp.items.filter((i) => i.kind === "digital").length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                          <ThunderboltOutlined style={{ marginRight: 5 }} />Digital Assets
                        </div>
                        {grp.items.filter((i) => i.kind === "digital").map((item) => (
                          <div key={item.id} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                            background: "var(--bms-surface)", border: "1px solid var(--bms-border)",
                          }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#10b98120", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", fontSize: 16 }}>
                                <ThunderboltOutlined />
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{item.itemName}</div>
                                <Space size={6} style={{ marginTop: 2 }}>
                                  <Text style={{ fontSize: 11 }} type="secondary">{item.category}</Text>
                                  <code style={{ fontSize: 10, color: "var(--bms-text-2)", background: "var(--bms-surface-2)", padding: "1px 5px", borderRadius: 3 }}>{item.assetCode}</code>
                                  <Text type="secondary" style={{ fontSize: 11 }}>Since {item.assignedDate}</Text>
                                </Space>
                              </div>
                            </div>
                            <Space>
                              <div style={{ textAlign: "right" }}>
                                <Tag color={COND_COLOR[item.condition] ?? "default"} style={{ fontSize: 11 }}>{item.condition}</Tag>
                                <div style={{ fontSize: 10, color: "var(--bms-text-3)", marginTop: 2 }}>Condition</div>
                              </div>
                              <Popconfirm title="Revoke this digital asset?" onConfirm={() => { itAssetStore.revokeAsset(item.id); message.success("Digital asset revoked"); }}>
                                <Button size="small" danger>Revoke</Button>
                              </Popconfirm>
                            </Space>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Requests Tab ─────────────────────────────────────────────────────────────
function RequestsTab() {
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("all");
  const [refillTargetReq, setRefillTargetReq] = useState<AssetRequest | null>(null);
  const [refillQtyForm] = Form.useForm();

  const reload = useCallback(() => setRequests(itAssetStore.getRequests()), []);
  useEffect(() => { reload(); return itAssetStore.subscribe(reload); }, [reload]);

  const inventory = itAssetStore.getInventory();

  const filtered = [...requests]
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    .filter((r) => statusFilter === "all" || r.status === statusFilter);

  const handleFulfill = (req: AssetRequest) => {
    const inv = inventory.find((i) => i.id === req.inventoryItemId);
    if (!inv || inv.availableStock === 0) {
      message.warning("No stock available. Refill inventory first.");
      setRefillTargetReq(req);
      return;
    }
    itAssetStore.updateRequestStatus(req.id, "fulfilled");
    message.success(`Request fulfilled for ${req.employeeName}`);
    // Notification for HR
    notification.success({
      message: "Request Fulfilled",
      description: `${req.itemName} has been fulfilled for ${req.employeeName}.`,
      placement: "topRight",
      duration: 6,
    });
  };

  const handleReject = (req: AssetRequest) => {
    itAssetStore.updateRequestStatus(req.id, "rejected");
    message.info("Request rejected");
  };

  const handleRefillAndFulfill = async () => {
    const req = refillTargetReq;
    if (!req) return;
    try {
      const { qty } = await refillQtyForm.validateFields();
      itAssetStore.refillStock(req.inventoryItemId, qty);
      itAssetStore.updateRequestStatus(req.id, "fulfilled");
      message.success(`Refilled ${qty} units & fulfilled request`);
      notification.success({
        message: "Request Fulfilled",
        description: `${req.itemName} has been refilled and fulfilled for ${req.employeeName}.`,
        placement: "topRight",
        duration: 6,
      });
      setRefillTargetReq(null);
      refillQtyForm.resetFields();
    } catch { /* validation failed */ }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <Space>
          <Text style={{ fontWeight: 600 }}>Filter:</Text>
          {(["all", "pending", "fulfilled", "rejected", "refill_needed"] as const).map((s) => (
            <Button
              key={s}
              size="small"
              type={statusFilter === s ? "primary" : "default"}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : STATUS_LABEL[s as RequestStatus]}
              {s !== "all" && (
                <Badge count={requests.filter((r) => r.status === s).length} size="small" style={{ marginLeft: 4 }} />
              )}
            </Button>
          ))}
        </Space>
        <Badge count={requests.filter((r) => r.status === "pending").length} offset={[-4, 4]}>
          <Tag color="orange" icon={<ExclamationCircleOutlined />} style={{ fontSize: 12 }}>
            {requests.filter((r) => r.status === "pending").length} Pending
          </Tag>
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <Empty description="No requests found" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((req) => {
            const inv = inventory.find((i) => i.id === req.inventoryItemId);
            const outOfStock = !inv || inv.availableStock === 0;
            const isDone = req.status === "fulfilled" || req.status === "rejected";
            return (
              <Card
                key={req.id}
                bodyStyle={{ padding: "14px 18px" }}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${req.status === "fulfilled" ? "#10b98140" : req.status === "rejected" ? "#ef444440" : "var(--bms-border)"}`,
                  background: req.status === "fulfilled" ? "#f0fdf4" : req.status === "rejected" ? "#fff1f0" : "var(--bms-surface)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Avatar size={36} style={{ background: KIND_COLOR[req.kind], fontSize: 14, flexShrink: 0 }}>
                    {req.employeeName.charAt(0).toUpperCase()}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--bms-text)" }}>{req.employeeName}</div>
                    <Space size={6} style={{ marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{req.employeeCode}</Text>
                      <Tag color={KIND_COLOR[req.kind]} style={{ fontSize: 10, margin: 0 }}>{req.kind}</Tag>
                      <Text style={{ fontSize: 12, fontWeight: 600 }}>{req.itemName}</Text>
                    </Space>
                    {req.notes && <div style={{ fontSize: 11, color: "var(--bms-text-3)", marginTop: 4 }}>Note: {req.notes}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ marginBottom: 6 }}>
                      <Tag color={STATUS_COLOR[req.status]}>{STATUS_LABEL[req.status]}</Tag>
                      {inv && !isDone && <StockBadge available={inv.availableStock} total={inv.totalStock} />}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(req.requestedAt).format("DD MMM YYYY, hh:mm A")}</Text>
                  </div>
                  {!isDone && (
                    <Space size={6} style={{ flexShrink: 0 }}>
                      {outOfStock && (
                        <Button size="small" icon={<ReloadOutlined />} onClick={() => setRefillTargetReq(req)} style={{ color: "#f59e0b", borderColor: "#f59e0b" }}>
                          Refill
                        </Button>
                      )}
                      <Button size="small" type="primary" icon={<CheckOutlined />} disabled={outOfStock} onClick={() => handleFulfill(req)}>
                        Fulfill
                      </Button>
                      <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(req)}>
                        Reject
                      </Button>
                    </Space>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Refill & Fulfill Modal */}
      <Modal
        title={<Space><ReloadOutlined />Refill Stock & Fulfill Request</Space>}
        open={!!refillTargetReq}
        onOk={handleRefillAndFulfill}
        onCancel={() => { setRefillTargetReq(null); refillQtyForm.resetFields(); }}
        okText="Refill & Fulfill"
        width={420}
      >
        {refillTargetReq && (
          <>
            <div style={{
              padding: "12px 16px", borderRadius: 8, background: "var(--bms-surface-2)",
              marginBottom: 16, border: "1px solid var(--bms-border)",
            }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Request from</Text>
              <div style={{ fontWeight: 600 }}>{refillTargetReq.employeeName} — {refillTargetReq.itemName}</div>
              <Tag color="red" style={{ marginTop: 4 }}>Out of Stock</Tag>
            </div>
            <Form form={refillQtyForm} layout="vertical">
              <Form.Item name="qty" label="Quantity to Refill" rules={[{ required: true }]}>
                <InputNumber min={1} max={9999} style={{ width: "100%" }} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────
function DonutChart({ segments, size = 120, label }: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  label?: string;
}) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  const strokeWidth = 22;
  const r = (size - 20) / 2 - strokeWidth / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.filter(s => s.value > 0).map((seg) => {
    const dash = (seg.value / total) * circumference;
    const startOffset = offset;
    offset += dash;
    return { ...seg, dash, startOffset, pct: Math.round((seg.value / total) * 100) };
  });

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bms-surface-2)" strokeWidth={strokeWidth} />
          {arcs.map((arc, i) => (
            <circle
              key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={arc.color} strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              strokeDashoffset={-arc.startOffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        {label && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--bms-text)", lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 9, color: "var(--bms-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
          </div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        {arcs.map((seg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Space size={6}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: seg.color }} />
              <Text style={{ fontSize: 12 }}>{seg.label}</Text>
            </Space>
            <Text style={{ fontSize: 12, fontWeight: 600 }}>{seg.value} <Text type="secondary" style={{ fontSize: 10 }}>({seg.pct}%)</Text></Text>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [empAssets, setEmpAssets] = useState<EmployeeAsset[]>([]);

  const reload = useCallback(() => {
    setInventory(itAssetStore.getInventory());
    setRequests(itAssetStore.getRequests());
    setEmpAssets(itAssetStore.getEmployeeAssets());
  }, []);
  useEffect(() => { reload(); return itAssetStore.subscribe(reload); }, [reload]);

  const stockData = inventory.filter(i => i.totalStock < 999).map(i => ({
    name: i.name, kind: i.kind,
    available: i.availableStock,
    assigned: i.assignedCount,
    total: i.totalStock,
  }));

  const statusCounts = {
    pending: requests.filter(r => r.status === "pending").length,
    fulfilled: requests.filter(r => r.status === "fulfilled").length,
    rejected: requests.filter(r => r.status === "rejected").length,
    refill_needed: requests.filter(r => r.status === "refill_needed").length,
  };
  const totalRequests = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const assetCount = empAssets.filter(a => a.kind === "asset").length;
  const facilityCount = empAssets.filter(a => a.kind === "facility").length;

  // Category distribution
  const categoryMap: Record<string, { asset: number; facility: number }> = {};
  inventory.forEach(item => {
    if (!categoryMap[item.category]) categoryMap[item.category] = { asset: 0, facility: 0 };
    categoryMap[item.category][item.kind] += item.assignedCount;
  });
  const categoryData = Object.entries(categoryMap)
    .map(([cat, v]) => ({ cat, total: v.asset + v.facility, asset: v.asset, facility: v.facility }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const maxCat = Math.max(...categoryData.map(d => d.total), 1);

  return (
    <div>
      <Row gutter={[20, 20]}>
        {/* Stock Utilization Bar Chart */}
        <Col xs={24} lg={14}>
          <Card
            title={<Space><BarChartOutlined style={{ color: "#3b82f6" }} />Stock Utilization</Space>}
            bodyStyle={{ padding: "20px 24px" }}
            style={{ borderRadius: 12, border: "1px solid var(--bms-border)" }}
          >
            {stockData.length === 0 ? <Empty description="No data" /> : (
              <div>
                {stockData.map((item) => {
                  const color = item.kind === "asset" ? "#3b82f6" : "#8b5cf6";
                  const usedPct = Math.round((item.assigned / Math.max(item.total, 1)) * 100);
                  const availPct = Math.round((item.available / Math.max(item.total, 1)) * 100);
                  return (
                    <div key={item.name} style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <Space size={6}>
                          <Tag color={color} style={{ fontSize: 10, margin: 0 }}>{item.kind}</Tag>
                          <Text style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</Text>
                        </Space>
                        <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
                          {item.assigned} assigned · {item.available} available · {item.total} total
                        </Text>
                      </div>
                      {/* Stacked animated bar */}
                      <div style={{ height: 20, borderRadius: 8, background: "var(--bms-surface-2)", overflow: "hidden", display: "flex", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)" }}>
                        <div style={{
                          width: `${usedPct}%`,
                          background: `linear-gradient(90deg, ${color}bb, ${color})`,
                          transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                          borderRadius: "8px 0 0 8px",
                          display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4,
                        }}>
                          {usedPct > 15 && <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{usedPct}%</span>}
                        </div>
                        <div style={{ width: `${availPct}%`, background: `${color}33`, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color }}>■ Assigned ({usedPct}%)</span>
                        <span style={{ fontSize: 10, color: `${color}88` }}>■ Available ({availPct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Right column */}
        <Col xs={24} lg={10}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Request Status Donut */}
            <Card
              title={<Space><InboxOutlined style={{ color: "#f59e0b" }} />Request Status</Space>}
              bodyStyle={{ padding: "20px 24px" }}
              style={{ borderRadius: 12, border: "1px solid var(--bms-border)" }}
            >
              {totalRequests === 0 ? <Empty description="No requests" /> : (
                <DonutChart
                  size={120}
                  label="Total"
                  segments={[
                    { label: "Fulfilled", value: statusCounts.fulfilled, color: "#10b981" },
                    { label: "Pending", value: statusCounts.pending, color: "#f59e0b" },
                    { label: "Rejected", value: statusCounts.rejected, color: "#ef4444" },
                    { label: "Refill Needed", value: statusCounts.refill_needed, color: "#f97316" },
                  ]}
                />
              )}
            </Card>

            {/* Assignment Split Donut */}
            <Card
              title={<Space><AppstoreOutlined style={{ color: "#8b5cf6" }} />Assignment Split</Space>}
              bodyStyle={{ padding: "20px 24px" }}
              style={{ borderRadius: 12, border: "1px solid var(--bms-border)" }}
            >
              {(assetCount + facilityCount) === 0 ? <Empty description="No assignments" /> : (
                <DonutChart
                  size={120}
                  label="Assigned"
                  segments={[
                    { label: "IT Assets", value: assetCount, color: "#3b82f6" },
                    { label: "Facilities", value: facilityCount, color: "#8b5cf6" },
                  ]}
                />
              )}
            </Card>
          </div>
        </Col>

        {/* Category distribution bar chart */}
        {categoryData.length > 0 && (
          <Col xs={24}>
            <Card
              title={<Space><BarChartOutlined style={{ color: "#10b981" }} />Assignments by Category</Space>}
              bodyStyle={{ padding: "20px 24px" }}
              style={{ borderRadius: 12, border: "1px solid var(--bms-border)" }}
            >
              <Row gutter={[16, 0]}>
                {categoryData.map((item) => {
                  const color = item.asset >= item.facility ? "#3b82f6" : "#8b5cf6";
                  const pct = maxCat > 0 ? Math.round((item.total / maxCat) * 100) : 0;
                  return (
                    <Col xs={24} sm={12} md={6} key={item.cat} style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 12, fontWeight: 600 }}>{item.cat.charAt(0).toUpperCase() + item.cat.slice(1)}</Text>
                        <Text style={{ fontSize: 13, fontWeight: 700, color }}>{item.total}</Text>
                      </div>
                      <div style={{ height: 10, borderRadius: 5, background: "var(--bms-surface-2)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: `linear-gradient(90deg, ${color}bb, ${color})`,
                          borderRadius: 5, transition: "width 0.5s",
                        }} />
                      </div>
                      <Text type="secondary" style={{ fontSize: 10 }}>{item.asset}A · {item.facility}F</Text>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}



// ─── Dashboard Overview Tab ────────────────────────────────────────────────────
function DashboardOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [empAssets, setEmpAssets] = useState<EmployeeAsset[]>([]);
  const [refillItem, setRefillItem] = useState<InventoryItem | null>(null);
  const [activeSection, setActiveSection] = useState<"assets" | "facilities" | "digital" | null>(null);

  const reload = useCallback(() => {
    setInventory(itAssetStore.getInventory());
    setRequests(itAssetStore.getRequests());
    setEmpAssets(itAssetStore.getEmployeeAssets());
  }, []);
  useEffect(() => { reload(); return itAssetStore.subscribe(reload); }, [reload]);

  const assetsInventory = inventory.filter(i => i.kind === "asset");
  const totalAssetStock = assetsInventory.filter(i => i.totalStock < 999).reduce((s, i) => s + i.totalStock, 0);
  const availableAssetStock = assetsInventory.filter(i => i.totalStock < 999).reduce((s, i) => s + i.availableStock, 0);
  const assignedAssetCount = empAssets.filter(ea => ea.kind === "asset").length;
  const outOfStockAssets = assetsInventory.filter(i => i.availableStock === 0 && i.totalStock < 999).length;

  const facilitiesInventory = inventory.filter(i => i.kind === "facility");
  const totalFacilityStock = facilitiesInventory.filter(i => i.totalStock < 999).reduce((s, i) => s + i.totalStock, 0);
  const availableFacilityStock = facilitiesInventory.filter(i => i.totalStock < 999).reduce((s, i) => s + i.availableStock, 0);
  const assignedFacilityCount = empAssets.filter(ea => ea.kind === "facility").length;
  const outOfStockFacilities = facilitiesInventory.filter(i => i.availableStock === 0 && i.totalStock < 999).length;

  const digitalInventory = inventory.filter(i => i.kind === "digital");
  const totalDigitalStock = digitalInventory.filter(i => i.totalStock < 999).reduce((s, i) => s + i.totalStock, 0);
  const availableDigitalStock = digitalInventory.filter(i => i.totalStock < 999).reduce((s, i) => s + i.availableStock, 0);
  const assignedDigitalCount = empAssets.filter(ea => ea.kind === "digital").length;
  const outOfStockDigital = digitalInventory.filter(i => i.availableStock === 0 && i.totalStock < 999).length;

  const lowStockItems = inventory.filter((i) => {
    if (i.totalStock >= 999 || i.totalStock === 0) return false;
    return (i.availableStock / i.totalStock) < 0.25;
  });

  const displayInventory = activeSection === "assets" ? assetsInventory : activeSection === "facilities" ? facilitiesInventory : activeSection === "digital" ? digitalInventory : [];

  return (
    <div>
      {/* ── Top overview toggle buttons ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <Button
          type={activeSection === "assets" ? "primary" : "default"}
          icon={<DesktopOutlined />}
          size="large"
          onClick={() => setActiveSection(activeSection === "assets" ? null : "assets")}
          style={activeSection === "assets" ? {
            background: "#3b82f6", borderColor: "#3b82f6",
            boxShadow: "0 0 0 3px #3b82f622",
          } : { borderColor: "#3b82f6", color: "#3b82f6" }}
        >
          IT Asset Overview
        </Button>
        <Button
          type={activeSection === "facilities" ? "primary" : "default"}
          icon={<HomeOutlined />}
          size="large"
          onClick={() => setActiveSection(activeSection === "facilities" ? null : "facilities")}
          style={activeSection === "facilities" ? {
            background: "#8b5cf6", borderColor: "#8b5cf6",
            boxShadow: "0 0 0 3px #8b5cf622",
          } : { borderColor: "#8b5cf6", color: "#8b5cf6" }}
        >
          Facilities Overview
        </Button>
        <Button
          type={activeSection === "digital" ? "primary" : "default"}
          icon={<ThunderboltOutlined />}
          size="large"
          onClick={() => setActiveSection(activeSection === "digital" ? null : "digital")}
          style={activeSection === "digital" ? {
            background: "#10b981", borderColor: "#10b981",
            boxShadow: "0 0 0 3px #10b98122",
          } : { borderColor: "#10b981", color: "#10b981" }}
        >
          Digital Asset Overview
        </Button>
      </div>

      {/* IT Assets stat cards (shown when IT Asset Overview is active) */}
      {activeSection === "assets" && (
        <div style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Asset Catalog" value={assetsInventory.length} icon={<AppstoreOutlined />} color="#3b82f6" subtitle="Registered assets" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Available Stock" value={availableAssetStock} icon={<InboxOutlined />} color="#10b981" subtitle={`of ${totalAssetStock} total`} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Assigned Assets" value={assignedAssetCount} icon={<TeamOutlined />} color="#8b5cf6" subtitle="Active assignments"
                onClick={() => onNavigate("employee-assets")} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Out of Stock" value={outOfStockAssets} icon={<ExclamationCircleOutlined />}
                color={outOfStockAssets > 0 ? "#ef4444" : "#10b981"}
                subtitle={outOfStockAssets > 0 ? "Requires refill" : "Stock available"} />
            </Col>
          </Row>
        </div>
      )}

      {/* Facilities stat cards (shown when Facilities Overview is active) */}
      {activeSection === "facilities" && (
        <div style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Facility Catalog" value={facilitiesInventory.length} icon={<AppstoreOutlined />} color="#8b5cf6" subtitle="Registered facilities" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Available Slots" value={availableFacilityStock} icon={<InboxOutlined />} color="#10b981" subtitle={`of ${totalFacilityStock} total`} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Assigned Slots" value={assignedFacilityCount} icon={<TeamOutlined />} color="#3b82f6" subtitle="Active assignments"
                onClick={() => onNavigate("employee-assets")} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Out of Stock" value={outOfStockFacilities} icon={<ExclamationCircleOutlined />}
                color={outOfStockFacilities > 0 ? "#ef4444" : "#10b981"}
                subtitle={outOfStockFacilities > 0 ? "Requires refill" : "Stock available"} />
            </Col>
          </Row>
        </div>
      )}

      {/* Digital Assets stat cards (shown when Digital Asset Overview is active) */}
      {activeSection === "digital" && (
        <div style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Digital Catalog" value={digitalInventory.length} icon={<AppstoreOutlined />} color="#10b981" subtitle="Registered digital assets" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Available Accounts" value={availableDigitalStock} icon={<InboxOutlined />} color="#10b981" subtitle={`of ${totalDigitalStock} total`} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Assigned Accounts" value={assignedDigitalCount} icon={<TeamOutlined />} color="#3b82f6" subtitle="Active assignments"
                onClick={() => onNavigate("employee-assets")} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Out of Stock" value={outOfStockDigital} icon={<ExclamationCircleOutlined />}
                color={outOfStockDigital > 0 ? "#ef4444" : "#10b981"}
                subtitle={outOfStockDigital > 0 ? "Requires refill" : "Stock available"} />
            </Col>
          </Row>
        </div>
      )}

      {/* No selection placeholder */}
      {!activeSection && (
        <div style={{
          padding: "32px 24px", borderRadius: 12,
          border: "2px dashed var(--bms-border)",
          background: "var(--bms-surface-2)", textAlign: "center", marginBottom: 24,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <Text style={{ fontSize: 14, color: "var(--bms-text-3)" }}>
            Click <strong>IT Asset Overview</strong>, <strong>Facilities Overview</strong>, or <strong>Digital Asset Overview</strong> above to see stat cards and inventory details
          </Text>
        </div>
      )}

      {/* Expandable inventory detail section when a category is active */}
      {activeSection && (
        <Card
          bodyStyle={{ padding: "16px 20px" }}
          style={{ borderRadius: 12, border: `2px solid ${activeSection === "assets" ? "#3b82f6" : activeSection === "facility" ? "#8b5cf6" : "#10b981"}33`, marginBottom: 24 }}
          title={
            <Space>
              {activeSection === "assets" ? <DesktopOutlined style={{ color: "#3b82f6" }} /> : activeSection === "facilities" ? <HomeOutlined style={{ color: "#8b5cf6" }} /> : <ThunderboltOutlined style={{ color: "#10b981" }} />}
              <Text style={{ fontWeight: 700 }}>{activeSection === "assets" ? "IT Assets Inventory" : activeSection === "facilities" ? "Facilities Inventory" : "Digital Assets Inventory"}</Text>
            </Space>
          }
          extra={
            <Button type="link" size="small" onClick={() => setActiveSection(null)}>
              <CloseOutlined /> Close
            </Button>
          }
        >
          {displayInventory.length === 0 ? <Empty /> : (
            <Row gutter={[16, 12]}>
              {displayInventory.map((item) => {
                const pct = item.totalStock >= 999 ? 100 : Math.round((item.availableStock / Math.max(item.totalStock, 1)) * 100);
                const color = stockColor(item.availableStock, item.totalStock);
                return (
                  <Col xs={24} md={12} key={item.id}>
                    <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <Space>
                          <Text style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</Text>
                          <Tag style={{ fontSize: 10, margin: 0 }}>{item.category}</Tag>
                        </Space>
                        <Space>
                          <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
                            {item.totalStock >= 999 ? "Unlimited" : `${item.availableStock} / ${item.totalStock}`}
                          </Text>
                          <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => setRefillItem(item)} style={{ padding: "0 4px" }}>
                            Refill
                          </Button>
                        </Space>
                      </div>
                      <Progress percent={pct} showInfo={false} strokeColor={color} size="small" />
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}
        </Card>
      )}

      <Row gutter={[16, 16]}>
        {/* Low Stock Alerts */}
        <Col xs={24} md={12}>
          <Card
            title={<Space><ExclamationCircleOutlined style={{ color: "#f59e0b" }} />Low Stock Alerts</Space>}
            style={{ borderRadius: 12, border: "1px solid var(--bms-border)", height: "100%" }}
            bodyStyle={{ padding: "12px 16px" }}
          >
            {lowStockItems.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>✓ All items have adequate stock</Text>
            ) : (
              lowStockItems.map((item) => (
                <div key={item.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: "1px solid var(--bms-border)",
                }}>
                  <div>
                    <Space size={6}>
                      <Tag color={KIND_COLOR[item.kind]} style={{ fontSize: 10, margin: 0 }}>{item.kind}</Tag>
                      <Text style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</Text>
                    </Space>
                    <div style={{ fontSize: 11, color: item.availableStock === 0 ? "#f87171" : "#fbbf24", marginTop: 2 }}>
                      {item.availableStock === 0 ? "Out of stock" : `Only ${item.availableStock} left`}
                    </div>
                  </div>
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => setRefillItem(item)}>
                    Refill
                  </Button>
                </div>
              ))
            )}
          </Card>
        </Col>

        {/* Recent Requests */}
        <Col xs={24} md={12}>
          <Card
            title={<Space><ThunderboltOutlined style={{ color: "#3b82f6" }} />Recent Requests</Space>}
            style={{ borderRadius: 12, border: "1px solid var(--bms-border)", height: "100%" }}
            bodyStyle={{ padding: "12px 16px" }}
          >
            {requests.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>No requests yet</Text>
            ) : (
              [...requests]
                .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
                .slice(0, 5)
                .map((req) => (
                  <div key={req.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "1px solid var(--bms-border)",
                  }}>
                    <div>
                      <Text style={{ fontWeight: 500, fontSize: 13 }}>{req.employeeName}</Text>
                      <div style={{ fontSize: 11, color: "var(--bms-text-3)", marginTop: 2 }}>{req.itemName}</div>
                    </div>
                    <Tag color={STATUS_COLOR[req.status]} style={{ fontSize: 11 }}>{STATUS_LABEL[req.status]}</Tag>
                  </div>
                ))
            )}
          </Card>
        </Col>
      </Row>

      <RefillModal item={refillItem} open={!!refillItem} onClose={() => { setRefillItem(null); reload(); }} />
    </div>
  );
}

// ─── Offboarding Revoke Requests Modal for IT Asset Admin ──────────────────────
function OffboardingRevokeModal({
  open,
  onClose,
  currentUser,
}: {
  open: boolean;
  onClose: () => void;
  currentUser: any;
}) {
  const [requests, setRequests] = useState<OffboardingRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Per-employee asset detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEmpReq, setSelectedEmpReq] = useState<OffboardingRequest | null>(null);
  const [empAssetsList, setEmpAssetsList] = useState<EmployeeAsset[]>([]);

  // Per-asset issue modal state
  const [assetIssueModalOpen, setAssetIssueModalOpen] = useState(false);
  const [targetAsset, setTargetAsset] = useState<EmployeeAsset | null>(null);
  const [assetIssueNotes, setAssetIssueNotes] = useState("");

  const reload = useCallback(() => {
    const list = offboardingStore.getRequests();
    setRequests(list.filter((r) => r.it_assets_revoke_requested));
    if (selectedEmpReq) {
      setEmpAssetsList(
        itAssetStore.ensureEmployeeAssets(
          selectedEmpReq.employee_id,
          selectedEmpReq.employee_name,
          selectedEmpReq.employee_code,
          selectedEmpReq.joining_date
        )
      );
    }
  }, [selectedEmpReq]);

  useEffect(() => {
    if (open) reload();
    return offboardingStore.subscribe(reload);
  }, [open, reload]);

  const handleOpenEmpAssetsDetail = (req: OffboardingRequest) => {
    setSelectedEmpReq(req);
    const assets = itAssetStore.ensureEmployeeAssets(
      req.employee_id,
      req.employee_name,
      req.employee_code,
      req.joining_date
    );
    setEmpAssetsList(assets);
    setDetailModalOpen(true);
  };

  const handleRevokeSingleAssetClean = async (asset: EmployeeAsset) => {
    itAssetStore.updateEmployeeAssetRevocation(asset.id, "revoked", "Returned in good condition.");
    message.success(`Asset ${asset.itemName} (${asset.assetCode}) marked as Revoked!`);
    if (selectedEmpReq) {
      await offboardingStore.confirmAssetRevoke(
        selectedEmpReq.id,
        currentUser?.full_name || "IT Asset Admin",
        `Revoked item: ${asset.itemName}`
      );
      setSelectedEmpReq({ ...selectedEmpReq, it_assets_revoked: true, current_step: 8 });
      setEmpAssetsList(itAssetStore.getEmployeeAssets(selectedEmpReq.employee_id));
      reload();
    }
  };

  const handleRevokeSingleAssetWithIssues = async () => {
    if (!targetAsset || !selectedEmpReq) return;
    if (!assetIssueNotes.trim()) {
      message.error("Please enter the damage / missing issue details.");
      return;
    }
    itAssetStore.updateEmployeeAssetRevocation(
      targetAsset.id,
      "revoked_with_issues",
      `Issue Reported: ${assetIssueNotes}`
    );
    message.warning(`Asset ${targetAsset.itemName} marked Revoked with Issues!`);
    await offboardingStore.confirmAssetRevoke(
      selectedEmpReq.id,
      currentUser?.full_name || "IT Asset Admin",
      `Revoked with Issues (${targetAsset.itemName}): ${assetIssueNotes}`
    );
    setSelectedEmpReq({ ...selectedEmpReq, it_assets_revoked: true, current_step: 8 });
    setAssetIssueModalOpen(false);
    setTargetAsset(null);
    setAssetIssueNotes("");
    setEmpAssetsList(itAssetStore.getEmployeeAssets(selectedEmpReq.employee_id));
    reload();
  };

  const handleFinalizeEmployeeRevocation = async () => {
    if (!selectedEmpReq) return;
    setLoading(true);
    try {
      const issueSummary = empAssetsList
        .filter((a) => a.status === "revoked_with_issues" && a.notes)
        .map((a) => `${a.itemName}: ${a.notes}`)
        .join("; ");

      const notes = issueSummary
        ? `Assets Revoked with Issues: ${issueSummary}`
        : "All assets & facilities confirmed revoked cleanly.";

      await offboardingStore.confirmAssetRevoke(
        selectedEmpReq.id,
        currentUser?.full_name || "IT Asset Admin",
        notes
      );

      message.success(`Revocation confirmed for ${selectedEmpReq.employee_name}! Status bar line moved to Step 8: Documents Issued.`);
      setDetailModalOpen(false);
      setSelectedEmpReq(null);
      reload();
    } catch (e: any) {
      message.error(e.message || "Failed to confirm revocation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Outer Modal: Employee List ── */}
      <Modal
        title={
          <Space>
            <UsergroupDeleteOutlined style={{ color: "#0284c7" }} />
            <span>Offboarding Asset Return Requests — Select Employee</span>
          </Space>
        }
        open={open}
        onCancel={onClose}
        footer={<Button onClick={onClose}>Close</Button>}
        width={700}
      >
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
          Click on an employee name below to view their assigned assets and confirm their return individually.
        </Paragraph>

        {requests.length === 0 ? (
          <Alert type="info" showIcon message="No pending offboarding asset return requests." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {requests.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  border: r.it_assets_revoked ? "1.5px solid #86efac" : "1.5px solid #93c5fd",
                  borderRadius: 10,
                  background: r.it_assets_revoked ? "var(--bms-bg-elevated, #f0fdf4)" : "var(--bms-bg-elevated, #f0f9ff)",
                  cursor: r.it_assets_revoked ? "default" : "pointer",
                  transition: "box-shadow 0.2s",
                }}
                onClick={() => !r.it_assets_revoked && handleOpenEmpAssetsDetail(r)}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.employee_name}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {r.employee_code || r.employee_id} · {r.department} · LWD: {r.approved_lwd || r.proposed_lwd}
                  </Text>
                </div>
                <Space>
                  {r.it_assets_revoked ? (
                    <Tag color="success" style={{ padding: "4px 10px", fontWeight: 700 }}>✓ RETURNED</Tag>
                  ) : (
                    <>
                      <Tag color="warning" style={{ padding: "4px 10px" }}>⏳ PENDING RETURN</Tag>
                      <Button
                        type="primary"
                        icon={<EyeOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleOpenEmpAssetsDetail(r); }}
                        size="small"
                        style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
                      >
                        View & Return
                      </Button>
                    </>
                  )}
                </Space>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Detail Modal: Per-Asset Return Controls for Selected Employee */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: "#0284c7" }} />
            <span>Assigned Assets & Facilities to Return — {selectedEmpReq?.employee_name}</span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
          </div>
        }
        width={850}
      >
        {selectedEmpReq && (
          <div>
            <Descriptions title="Employee Information" bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Employee">{selectedEmpReq.employee_name} ({selectedEmpReq.employee_code})</Descriptions.Item>
              <Descriptions.Item label="Department">{selectedEmpReq.department} - {selectedEmpReq.designation}</Descriptions.Item>
              <Descriptions.Item label="Approved LWD">{selectedEmpReq.approved_lwd || selectedEmpReq.proposed_lwd}</Descriptions.Item>
              <Descriptions.Item label="Overall Status">
                <Tag color={selectedEmpReq.it_assets_revoked ? "success" : "warning"}>
                  {selectedEmpReq.it_assets_revoked ? "RETURNED" : "PENDING RETURN"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="Assigned Hardware & Facilities Items (Action Per Asset)" style={{ marginBottom: 16 }}>
              <Table
                dataSource={empAssetsList}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: "Asset Code", dataIndex: "assetCode", key: "assetCode", render: (c) => <Tag color="blue">{c}</Tag> },
                  { title: "Item Name", dataIndex: "itemName", key: "itemName" },
                  { title: "Category", dataIndex: "category", key: "category" },
                  {
                    title: "Asset Status",
                    key: "asset_status",
                    render: (_: any, a: EmployeeAsset) => (
                      <div>
                        {a.status === "revoked" ? (
                          <Tag color="success">✓ RETURNED</Tag>
                        ) : a.status === "revoked_with_issues" ? (
                          <div>
                            <Tag color="error">⚠️ RETURNED WITH ISSUES</Tag>
                            {a.notes && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>{a.notes}</div>}
                          </div>
                        ) : (
                          <Tag color="warning">ASSIGNED</Tag>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: "Return Action for this Asset",
                    key: "action",
                    render: (_: any, a: EmployeeAsset) => (
                      <Space>
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckCircleOutlined />}
                          disabled={a.status === "revoked"}
                          onClick={() => handleRevokeSingleAssetClean(a)}
                          style={{ background: a.status === "revoked" ? undefined : "linear-gradient(135deg, #16a34a, #15803d)" }}
                        >
                          Return
                        </Button>
                        <Button
                          type="primary"
                          danger
                          size="small"
                          icon={<ExclamationCircleOutlined />}
                          disabled={a.status === "revoked_with_issues"}
                          onClick={() => {
                            setTargetAsset(a);
                            setAssetIssueModalOpen(true);
                          }}
                        >
                          Return with Issues
                        </Button>
                      </Space>
                    ),
                  },
                ]}
                locale={{ emptyText: "No specific items assigned to this employee." }}
              />
            </Card>
          </div>
        )}
      </Modal>

      {/* Modal to specify issue details for a SPECIFIC item */}
      <Modal
        title={`Report Issue for Asset — ${targetAsset?.itemName} (${targetAsset?.assetCode})`}
        open={assetIssueModalOpen}
        onCancel={() => setAssetIssueModalOpen(false)}
        onOk={handleRevokeSingleAssetWithIssues}
        okText="Confirm Item Returned with Issues"
        okButtonProps={{ danger: true }}
      >
        <Alert
          type="warning"
          showIcon
          message="Report Hardware Damage / Missing Accessories"
          description={`Specify the damage or missing issue details for ${targetAsset?.itemName}. This will be logged into the clearance record.`}
          style={{ marginBottom: 16 }}
        />
        <Form layout="vertical">
          <Form.Item label="Damage / Issue Details" required>
            <Input.TextArea
              rows={3}
              value={assetIssueNotes}
              onChange={(e) => setAssetIssueNotes(e.target.value)}
              placeholder="e.g. Laptop screen cracked; Charger missing; Key not returned."
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ITAssetDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const [pendingCount, setPendingCount] = useState(0);
  const [offboardingRevokeModalOpen, setOffboardingRevokeModalOpen] = useState(false);
  const [pendingOffboardingRevokeCount, setPendingOffboardingRevokeCount] = useState(0);

  // Any user accessing Facilities & Assets page has permission to view/action Revoke Requests
  const isITAdmin = true;

  const reload = useCallback(() => {
    setPendingCount(itAssetStore.getRequests().filter((r) => r.status === "pending").length);
    const offList = offboardingStore.getRequests();
    setPendingOffboardingRevokeCount(
      offList.filter((r) => r.it_assets_revoke_requested && !r.it_assets_revoked).length
    );
  }, []);

  useEffect(() => {
    if (user) offboardingStore.syncWithBackend();
    reload();
    const u1 = itAssetStore.subscribe(reload);
    const u2 = offboardingStore.subscribe(reload);
    return () => { u1(); u2(); };
  }, [user, reload]);

  const navigate = (tab: string) => setSearchParams(tab === "overview" ? {} : { tab });

  const tabItems = [
    {
      key: "overview",
      label: (<Space><HomeOutlined />Dashboard</Space>),
      children: <DashboardOverview onNavigate={navigate} />,
    },
    {
      key: "inventory",
      label: (<Space><BoxPlotOutlined />Inventory</Space>),
      children: <InventoryTab />,
    },
    {
      key: "employee-assets",
      label: (<Space><TeamOutlined />Employee Assets</Space>),
      children: <EmployeeAssetsTab />,
    },
    {
      key: "requests",
      label: (
        <Space>
          <Badge count={pendingCount} size="small"><InboxOutlined /></Badge>
          Requests
        </Space>
      ),
      children: <RequestsTab />,
    },
    {
      key: "reports",
      label: (<Space><BarChartOutlined />Reports</Space>),
      children: <ReportsTab />,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff",
          }}>
            <DesktopOutlined />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, color: "var(--bms-text)" }}>IT Asset Management</Title>
            <Text style={{ color: "var(--bms-text-3)", fontSize: 13 }}>
              Manage office facilities, IT assets, stock levels, and employee asset requests
            </Text>
          </div>
        </div>

        {/* Top Right Offboarding Revoke Requests Button (VISIBLE ONLY FOR IT ASSET ADMIN) */}
        {isITAdmin && (
          <Badge count={pendingOffboardingRevokeCount} overflowCount={99}>
            <Button
              type="primary"
              icon={<UsergroupDeleteOutlined />}
              size="large"
              onClick={() => setOffboardingRevokeModalOpen(true)}
              style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)", borderRadius: 8 }}
            >
              Asset Return Requests
            </Button>
          </Badge>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={navigate}
        items={tabItems}
        size="large"
        style={{ background: "transparent" }}
      />

      <OffboardingRevokeModal
        open={offboardingRevokeModalOpen}
        onClose={() => setOffboardingRevokeModalOpen(false)}
        currentUser={user}
      />
    </div>
  );
}

