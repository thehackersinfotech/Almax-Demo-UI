import { useState, useRef, useEffect, useCallback } from "react";
import {
  Table, Button, Tag, Space, Input, Modal, Form, Typography,
  Tooltip, Popconfirm, Select, Collapse, Divider, message,
} from "antd";
import {
  PlusOutlined, SearchOutlined, FilterOutlined, EditOutlined,
  DeleteOutlined, ReloadOutlined, EnvironmentOutlined,
  SafetyCertificateOutlined, BankOutlined, DownOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { get, post, patch, del } from "@/services/api";
import dayjs from "dayjs";
import "leaflet/dist/leaflet.css";
import { usePermission, useAnyPermission } from "@/hooks/usePermission";
import { PERMS } from "@/constants/permissions";
import PhoneInput from "@/components/common/PhoneInput";
import { phoneFormRules } from "@/utils/phone";
import ActiveStatusSwitch from "@/components/common/ActiveStatusSwitch";

// Fix default leaflet marker icons (bundler strips them)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const { Text } = Typography;
const { Panel } = Collapse;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Client {
  id: string; name: string; code: string;
  contact_email: string; contact_person: string; contact_designation: string;
  phone: string; address: string; is_active: boolean;
  pan_number: string; gst_number: string;
  category: string | null; category_name: string;
  latitude: string | null; longitude: string | null;
  formatted_address: string; country: string; created_at: string;
}

interface GeoResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

function parseCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function toLatLng(lat: unknown, lng: unknown): [number, number] | null {
  const la = parseCoord(lat);
  const lo = parseCoord(lng);
  if (la == null || lo == null) return null;
  return [la, lo];
}

function isValidPosition(pos: [number, number] | null): pos is [number, number] {
  return pos !== null && Number.isFinite(pos[0]) && Number.isFinite(pos[1]);
}

// ── Map click handler ─────────────────────────────────────────────────────────
function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ── Fly to location when markerPos changes ────────────────────────────────────
// The map may still be mid-layout (e.g. inside a Collapse panel that just became
// active, or a Modal that just opened) when this runs, in which case Leaflet's
// cached container size is 0×0 and flyTo()'s pixel math produces NaN. Force a
// size resync immediately before flying, and retry briefly if the container
// still measures as zero rather than calling flyTo into a broken state.
function FlyToLocation({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!isValidPosition(position)) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const attempt = () => {
      if (cancelled) return;
      map.invalidateSize();
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) {
        retry = setTimeout(attempt, 50);
        return;
      }
      map.flyTo(position, 15, { duration: 1.2 });
    };
    attempt();

    return () => { cancelled = true; if (retry) clearTimeout(retry); };
  }, [position, map]);
  return null;
}

// ── Re-sync Leaflet's cached size once the (possibly collapsed) panel becomes visible ──
// Without this, a map mounted inside a collapsed Collapse panel inits with a 0×0
// container; Leaflet then throws "Invalid LatLng object: (NaN, NaN)" the first time
// flyTo()/panTo() runs after the panel is expanded.
function InvalidateOnShow({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  }, [active, map]);
  return null;
}

// ── Geo search + map picker ───────────────────────────────────────────────────
function GeoPickerField({
  form,
  clientKey,
  active,
}: {
  form: ReturnType<typeof Form.useForm>[0];
  clientKey: string;
  active: boolean;
}) {
  const latitude         = Form.useWatch("latitude", form);
  const longitude        = Form.useWatch("longitude", form);
  const formattedAddress = Form.useWatch("formatted_address", form);

  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync map pin and search box when editing an existing client
  useEffect(() => {
    const pos = toLatLng(latitude, longitude);
    if (pos) {
      setMarkerPos(pos);
      setQuery(formattedAddress || `${pos[0].toFixed(6)}, ${pos[1].toFixed(6)}`);
    } else {
      setMarkerPos(null);
      setQuery(formattedAddress || "");
    }
    setResults([]);
  }, [clientKey, latitude, longitude, formattedAddress]);

  const applyLocation = useCallback((lat: number, lng: number, label?: string) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const pos: [number, number] = [lat, lng];
    setMarkerPos(pos);
    form.setFieldsValue({
      latitude:          lat.toFixed(6),
      longitude:         lng.toFixed(6),
      formatted_address: label ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
    setResults([]);
    if (label) setQuery(label);
  }, [form]);

  const searchNominatim = useCallback((q: string) => {
    if (q.trim().length < 3) { setResults([]); return; }
    setSearching(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data: GeoResult[]) => setResults(data))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchNominatim(val), 500);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <div>
      {/* Search box */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Input
          prefix={<EnvironmentOutlined style={{ color: "var(--bms-text-3)" }} />}
          placeholder="Search address or place…"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          allowClear
          onClear={() => { setQuery(""); setResults([]); }}
        />
        {results.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 9999,
            background: "var(--bms-surface)",
            border: "1px solid var(--bms-border)",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            maxHeight: 200, overflowY: "auto",
          }}>
            {results.map((r) => (
              <div
                key={r.place_id}
                onClick={() => applyLocation(parseFloat(r.lat), parseFloat(r.lon), r.display_name)}
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: 13,
                  color: "var(--bms-text)",
                  borderBottom: "1px solid var(--bms-border)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bms-surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bms-surface)")}
              >
                <EnvironmentOutlined style={{ color: "#1677ff", marginRight: 6 }} />
                {r.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leaflet map */}
      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--bms-border)", height: 220 }}>
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <InvalidateOnShow active={active} />
          <FlyToLocation position={markerPos} />
          <MapClickHandler onPick={(lat, lng) => {
            applyLocation(lat, lng);
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
              .then((r) => r.json())
              .then((d) => applyLocation(lat, lng, d.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`))
              .catch(() => {});
          }} />
          {isValidPosition(markerPos) && <Marker position={markerPos} />}
        </MapContainer>
      </div>

      <Text style={{ fontSize: 11, color: "var(--bms-text-3)", marginTop: 4, display: "block" }}>
        Search above or click the map to pin the location
      </Text>
    </div>
  );
}

// ── Uppercase input wrapper ───────────────────────────────────────────────────
function UpperInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      onChange={(e) => {
        const up = e.target.value.toUpperCase();
        const synth = Object.create(e);
        synth.target = { ...e.target, value: up };
        props.onChange?.(synth);
      }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientPage() {
  const canCreate = useAnyPermission([PERMS.PROJECT_CLIENT_CREATE, PERMS.FINANCE_DOCUMENT_CREATE]);
  const canUpdate = usePermission(PERMS.PROJECT_CLIENT_UPDATE);
  const canDelete = usePermission(PERMS.PROJECT_CLIENT_DELETE);
  const [search, setSearch]   = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [contactFilter, setContactFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [modalOpen, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [collapseKeys, setCollapseKeys] = useState<string[]>([]);
  const [form]                = Form.useForm();
  const qc                    = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["clients", search, categoryFilter, contactFilter],
    queryFn:  () => {
      const params: Record<string, string> = { search };
      if (categoryFilter) params.category = categoryFilter;
      if (contactFilter) params.contact_person = contactFilter;
      const queryStr = new URLSearchParams(params).toString();
      return get<any>(`/clients/?${queryStr}`);
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["client-categories"],
    queryFn:  () => get<Array<{ id: string; name: string }>>("/master/dropdown/client-categories/"),
    staleTime: Infinity,
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) =>
      editing ? patch(`/clients/${editing.id}/`, values) : post("/clients/", values),
    onSuccess: () => {
      message.success(editing ? "Client updated" : "Client created");
      qc.invalidateQueries({ queryKey: ["clients"] });
      closeModal();
    },
    onError: (e: any) => {
      const errs = e?.response?.data;
      if (errs && typeof errs === "object") {
        const first = Object.values(errs).flat()[0] as string;
        message.error(first || "Save failed");
      } else {
        message.error("Save failed");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`/clients/${id}/`),
    onSuccess:  () => { message.success("Client deleted"); qc.invalidateQueries({ queryKey: ["clients"] }); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      patch(`/clients/${id}/`, { is_active }),
    onSuccess: () => {
      message.success("Status updated");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => message.error("Failed to update status"),
  });

  const populateForm = useCallback((client: Client | null) => {
    if (!client) {
      form.resetFields();
      setCollapseKeys([]);
      return;
    }
    const lat = parseCoord(client.latitude);
    const lng = parseCoord(client.longitude);
    form.setFieldsValue({
      name:              client.name,
      code:              client.code,
      category:          client.category ?? undefined,
      contact_person:    client.contact_person,
      contact_designation: client.contact_designation,
      contact_email:     client.contact_email,
      phone:             client.phone,
      pan_number:        client.pan_number || undefined,
      gst_number:        client.gst_number || undefined,
      address:           client.address || undefined,
      latitude:          lat != null ? lat.toFixed(6) : undefined,
      longitude:         lng != null ? lng.toFixed(6) : undefined,
      formatted_address: client.formatted_address || undefined,
      country:           client.country || "India",
    });
    const keys: string[] = [];
    if (client.pan_number || client.gst_number || client.address) keys.push("business");
    if ((lat != null && lng != null) || client.formatted_address) keys.push("location");
    setCollapseKeys(keys);
  }, [form]);

  const openCreate = () => {
    setEditing(null);
    populateForm(null);
    setModal(true);
  };

  const openEdit = (r: Client) => {
    populateForm(r);
    setEditing(r);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditing(null);
    form.resetFields();
    setCollapseKeys([]);
  };

  // Apply values after modal mounts (destroyOnHidden remounts the form)
  useEffect(() => {
    if (modalOpen && editing) {
      populateForm(editing);
    }
  }, [modalOpen, editing, populateForm]);

  const rows: Client[] = data?.results ?? [];

  const columns = [
    {
      title: "Name", dataIndex: "name", key: "name",
      render: (v: string) => <Text strong style={{ color: "var(--bms-text)" }}>{v}</Text>,
    },
    {
      title: "Code", dataIndex: "code", key: "code",
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Category", dataIndex: "category_name", key: "category_name",
      render: (v: string) => v
        ? <Tag color="geekblue">{v}</Tag>
        : <Text style={{ color: "var(--bms-text-3)" }}>—</Text>,
    },
    {
      title: "Contact", dataIndex: "contact_person", key: "contact_person",
      render: (v: string) => <span style={{ color: "var(--bms-text)" }}>{v || "—"}</span>,
    },
    {
      title: "Email", dataIndex: "contact_email", key: "contact_email",
      render: (v: string) => <span style={{ color: "var(--bms-text-2)" }}>{v || "—"}</span>,
    },
    {
      title: "PAN", dataIndex: "pan_number", key: "pan_number",
      render: (v: string) => v
        ? <Text style={{ fontFamily: "monospace", fontSize: 12, color: "var(--bms-text)" }}>{v}</Text>
        : <Text style={{ color: "var(--bms-text-3)" }}>—</Text>,
    },
    {
      title: "Status", dataIndex: "is_active", key: "is_active", width: 90,
      render: (_: boolean, record: Client) => (
        <ActiveStatusSwitch
          checked={record.is_active}
          disabled={!canUpdate}
          loading={statusMutation.isPending && statusMutation.variables?.id === record.id}
          onChange={(checked) => statusMutation.mutate({ id: record.id, is_active: checked })}
        />
      ),
    },
    {
      title: "Created", dataIndex: "created_at", key: "created_at",
      render: (v: string) => (
        <span style={{ color: "var(--bms-text-2)" }}>{dayjs(v).format("DD-MM-YYYY")}</span>
      ),
    },
    ...(canUpdate || canDelete ? [{
      title: "Actions", key: "actions", width: 100,
      render: (_: any, record: Client) => (
        <Space>
          {canUpdate && (
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete this client?"
              onConfirm={() => deleteMutation.mutate(record.id)}
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Manage Clients</h1>
          <p className="page-subtitle">Client Management</p>
        </div>
        {canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            style={{ borderRadius: 8, fontWeight: 500 }}
          >
            Add Client
          </Button>
        )}
      </div>

      {/* Table card */}
      <div style={{
        background: "var(--bms-surface)",
        borderRadius: 12,
        border: "1px solid var(--bms-border)",
        boxShadow: "var(--shadow-sm)",
      }}>
        <div className="table-toolbar">
          <Text className="table-toolbar-title">Client List ({data?.count ?? 0})</Text>
          <Space wrap>
            <Input
              prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, borderRadius: 8 }}
              allowClear
            />
            <Button
              icon={<FilterOutlined />}
              type={showFilters ? "primary" : "default"}
              onClick={() => setShowFilters(!showFilters)}
              style={{ borderRadius: 8 }}
            >
              Filter
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => qc.invalidateQueries({ queryKey: ["clients"] })}
            />
          </Space>
        </div>
        {showFilters && (
          <div style={{
            padding: "12px 16px",
            background: "var(--bms-surface-2, #f8fafc)",
            borderBottom: "1px solid var(--bms-border)",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--bms-text-2)", fontWeight: 500 }}>Category:</span>
              <Select
                placeholder="All Categories"
                value={categoryFilter || undefined}
                onChange={(val) => setCategoryFilter(val || "")}
                style={{ width: 180 }}
                allowClear
              >
                {(categories ?? []).map((c) => (
                  <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                ))}
              </Select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--bms-text-2)", fontWeight: 500 }}>Contact Person:</span>
              <Input
                placeholder="Search contact person…"
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
            </div>

            {(categoryFilter || contactFilter) && (
              <Button
                type="link"
                danger
                size="small"
                onClick={() => {
                  setCategoryFilter("");
                  setContactFilter("");
                }}
                style={{ marginLeft: "auto" }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            showTotal: (t, r) => `Showing ${r[0]}-${r[1]} of ${t}`,
            pageSize: 10,
          }}
          style={{ borderRadius: 0 }}
          scroll={{ x: 900 }}
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BankOutlined style={{ color: "#1677ff" }} />
            <span>{editing ? "Edit Client" : "Add Client"}</span>
          </div>
        }
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText={editing ? "Save Changes" : "Create"}
        width={580}
        styles={{ body: { maxHeight: "75vh", overflowY: "auto", paddingRight: 4 } }}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => saveMutation.mutate(v)}
          requiredMark="optional"
          initialValues={{ country: "India" }}
        >
          {/* Basic Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item
              name="name"
              label="Client Name"
              rules={[{ required: true, message: "Client name is required" }]}
              style={{ gridColumn: "1 / -1" }}
            >
              <Input placeholder="e.g. Acme Corporation" />
            </Form.Item>

            <Form.Item
              name="code"
              label="Short Code"
              rules={[{ required: true, message: "Short code is required" }]}
            >
              <Input placeholder="e.g. ACME" />
            </Form.Item>

            <Form.Item name="category" label="Category">
              <Select placeholder="Select category" allowClear>
                {(categories ?? []).map((c) => (
                  <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="contact_person" label="Contact Person">
              <Input placeholder="Primary contact name" />
            </Form.Item>

            <Form.Item name="contact_designation" label="Designation" tooltip="Contact person's role or designation">
              <Input placeholder="e.g. Manager" />
            </Form.Item>

            <Form.Item
              name="contact_email"
              label="Contact Email"
              rules={[{ type: "email", message: "Enter a valid email" }]}
            >
              <Input placeholder="contact@acme.com" />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Phone"
              style={{ gridColumn: "1 / -1" }}
              rules={phoneFormRules({ label: "Phone number" })}
            >
              <PhoneInput />
            </Form.Item>
          </div>

          <Collapse
            ghost
            activeKey={collapseKeys}
            onChange={(keys) => setCollapseKeys(keys as string[])}
            expandIcon={({ isActive }) => (
              <DownOutlined rotate={isActive ? 180 : 0} style={{ fontSize: 11 }} />
            )}
            style={{
              marginBottom: 12,
              border: "1px solid var(--bms-border)",
              borderRadius: 8,
            }}
          >
            {/* Business Details */}
            <Panel
              key="business"
              header={
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <SafetyCertificateOutlined style={{ color: "#7c3aed", fontSize: 14 }} />
                  <span style={{ fontWeight: 500, fontSize: 13, color: "var(--bms-text)" }}>
                    Business Details
                  </span>
                  <span style={{ fontSize: 11, color: "var(--bms-text-3)", marginLeft: 4 }}>
                    PAN · GST
                  </span>
                </div>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Form.Item
                  name="pan_number"
                  label="PAN Number"
                  normalize={(v: string) => v?.toUpperCase()}
                  rules={[{
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value.toUpperCase()))
                        return Promise.resolve();
                      return Promise.reject("Invalid PAN. Format: ABCDE1234F");
                    },
                  }]}
                >
                  <UpperInput placeholder="ABCDE1234F" maxLength={10} />
                </Form.Item>

                <Form.Item
                  name="gst_number"
                  label="GST Number"
                  normalize={(v: string) => v?.toUpperCase()}
                  rules={[{
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      if (/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value.toUpperCase()))
                        return Promise.resolve();
                      return Promise.reject("Invalid GSTIN. Format: 22ABCDE1234F1Z5");
                    },
                  }]}
                >
                  <UpperInput placeholder="22ABCDE1234F1Z5" maxLength={15} />
                </Form.Item>
              </div>

              <Form.Item name="address" label="Office Address">
                <Input.TextArea rows={2} placeholder="Registered office address" />
              </Form.Item>
            </Panel>

            {/* Location */}
            <Panel
              key="location"
              header={
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <EnvironmentOutlined style={{ color: "#059669", fontSize: 14 }} />
                  <span style={{ fontWeight: 500, fontSize: 13, color: "var(--bms-text)" }}>
                    Location
                  </span>
                  <span style={{ fontSize: 11, color: "var(--bms-text-3)", marginLeft: 4 }}>
                    Map pin · Lat/Lng
                  </span>
                </div>
              }
            >
              <GeoPickerField form={form} clientKey={editing?.id ?? "new"} active={collapseKeys.includes("location")} />
              <Divider style={{ margin: "10px 0" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Form.Item name="latitude" label="Latitude">
                  <Input placeholder="Auto-filled from map" readOnly />
                </Form.Item>
                <Form.Item name="longitude" label="Longitude">
                  <Input placeholder="Auto-filled from map" readOnly />
                </Form.Item>
              </div>
              <Form.Item name="formatted_address" label="Formatted Address">
                <Input placeholder="Auto-filled from map" />
              </Form.Item>
              <Form.Item name="country" label="Country">
                <Input placeholder="e.g. India" />
              </Form.Item>
            </Panel>
          </Collapse>
        </Form>
      </Modal>
    </div>
  );
}