import React, { useState, useRef, useEffect, useCallback } from "react";
import { Form, Input, Button, Select, Collapse, message, Divider, Space, Card, Typography } from "antd";
import { DownOutlined, SafetyCertificateOutlined, EnvironmentOutlined, ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { post, get } from "@/services/api";
import PhoneInput from "@/components/common/PhoneInput";
import { phoneFormRules } from "@/utils/phone";

// Fix default leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const { Title, Text } = Typography;
const { Panel } = Collapse;

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



export default function ClientFormPage() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [collapseKeys, setCollapseKeys] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [searchParams] = useSearchParams();

  const { data: categories } = useQuery({
    queryKey: ["client-categories"],
    queryFn:  () => get<Array<{ id: string; name: string }>>("/master/dropdown/client-categories/"),
  });

  const saveMutation = useMutation({
    mutationFn: (d: any) => post("/clients/", d),
    onSuccess: () => {
      message.success("Client created successfully");
      queryClient.invalidateQueries();
      if (searchParams.get("add_client") === "true") {
        window.history.back();
      } else {
        setIsSuccess(true);
      }
    },
    onError: () => message.error("Failed to create client"),
  });

  const onFinish = (values: any) => {
    saveMutation.mutate(values);
  };

  if (isSuccess) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", padding: 24, textAlign: "center" }}>
        <Card style={{ borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: "#52c41a", marginBottom: 24 }} />
          <Title level={3}>Client Created Successfully</Title>
          <Text style={{ color: "var(--bms-text-2)" }}>
            The client has been created. You can now go back to your original page.
          </Text>
          <div style={{ marginTop: 32 }}>
            <Button size="large" onClick={() => window.history.back()}>Go Back</Button>
            <Button size="large" type="primary" style={{ marginLeft: 16 }} onClick={() => { setIsSuccess(false); form.resetFields(); }}>
              Create Another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: "16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <Space align="center" size={16}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => window.history.back()} />
          <Title level={4} style={{ margin: 0 }}>Create New Client</Title>
        </Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saveMutation.isPending}
          onClick={() => form.submit()}
        >
          Save Client
        </Button>
      </div>

      <Card style={{ borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark="optional"
          initialValues={{ country: "India" }}
        >
          {/* Basic Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Form.Item
              name="name"
              label="Client Name"
              rules={[{ required: true, message: "Client name is required" }]}
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
                {(categories ?? []).map((c: any) => (
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
              <GeoPickerField form={form} clientKey={"new"} active={collapseKeys.includes("location")} />
              <Divider style={{ margin: "10px 0" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Form.Item name="latitude" label="Latitude">
                  <Input placeholder="Auto-filled from map" readOnly />
                </Form.Item>
                <Form.Item name="longitude" label="Longitude">
                  <Input placeholder="Auto-filled from map" readOnly />
                </Form.Item>
                <Form.Item name="formatted_address" label="Formatted Address">
                  <Input placeholder="Auto-filled from map" />
                </Form.Item>
                <Form.Item name="country" label="Country">
                  <Input placeholder="e.g. India" />
                </Form.Item>
              </div>
            </Panel>
          </Collapse>
        </Form>
      </Card>
    </div>
  );
}
