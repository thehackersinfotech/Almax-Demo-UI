import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Avatar, Modal, Tag, Divider, Typography, Spin } from "antd";
import {
  SearchOutlined, UserOutlined, MailOutlined, PhoneOutlined,
  EnvironmentOutlined, CalendarOutlined, IdcardOutlined,
  TeamOutlined, ClockCircleOutlined, BankOutlined,
} from "@ant-design/icons";
import { get } from "@/services/api";
import { avatarPastel, initialsFromName } from "@/utils/avatarColors";

const { Text, Title } = Typography;

// ── Types ─────────────────────────────────────────────────────────────────────
interface EmpResult {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  email: string;
  username: string;
  status: string;
  designation_name: string | null;
  department_name: string | null;
  location_name: string | null;
  employment_type_name: string | null;
  shift_category_name: string | null;
  joining_date: string | null;
  total_experience: number | null;
  prior_experience: number | null;
  shift_applicable: boolean;
  phone_number: string;
  is_pmo: boolean;
  is_manager: boolean;
  is_staff: boolean;
  keycloak_group: string;
  manager_name: string | null;
  company: string;
  gender: string;
  date_of_birth: string | null;
  bio: string;
  profile_picture_url: string | null;
}

// ── Avatar initials ────────────────────────────────────────────────────────────
function initials(name: string) {
  return initialsFromName(name);
}

// ── Info row used inside the preview modal ────────────────────────────────────
function InfoRow({ label, value, accent = false }: { label: string; value?: string | null; accent?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
      <Text style={{ fontSize: 12, color: "#6b7280", minWidth: 130, flexShrink: 0 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: accent ? "#1677ff" : "#111827", textAlign: "right", fontWeight: accent ? 600 : 400 }}>{value}</Text>
    </div>
  );
}

// ── Employee preview modal ────────────────────────────────────────────────────
function EmployeePreviewModal({ emp, onClose }: { emp: EmpResult; onClose: () => void }) {
  const statusColors: Record<string, { bg: string; color: string }> = {
    ACTIVE:      { bg: "#f0fdf4", color: "#059669" },
    INACTIVE:    { bg: "#fff1f2", color: "#e11d48" },
    ON_LEAVE:    { bg: "#faf5ff", color: "#7c3aed" },
    TERMINATED:  { bg: "#fff7ed", color: "#ea580c" },
  };
  const st = statusColors[emp.status] ?? { bg: "#f9fafb", color: "#6b7280" };
  const av = avatarPastel(emp.full_name);
  const roles = [emp.is_pmo && "PMO", emp.is_manager && "Manager", emp.is_staff && "Admin"].filter(Boolean) as string[];

  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width={720}
      title={null}
      styles={{ body: { padding: 0 } }}
      destroyOnHidden
    >
      {/* ── Hero header ── */}
      <div style={{
        background: "linear-gradient(135deg, #0d1b2e 0%, #1a3557 100%)",
        borderRadius: "8px 8px 0 0", padding: "24px 28px 20px",
        position: "relative", overflow: "hidden",
      }}>
        {/* decorative circles */}
        <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", right: 40, bottom: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
          {emp.profile_picture_url ? (
            <Avatar size={72} src={emp.profile_picture_url} style={{ border: "3px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
          ) : (
            <Avatar size={72} style={{
              background: av.bg, color: av.text, fontSize: 24, fontWeight: 600,
              border: `3px solid ${av.border}`, flexShrink: 0,
            }}>
              {initials(emp.full_name)}
            </Avatar>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <Title level={4} style={{ margin: 0, color: "#fff", fontWeight: 700 }}>{emp.full_name}</Title>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: st.bg, color: st.color }}>
                {emp.status}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 12, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)", padding: "1px 8px", borderRadius: 4, fontFamily: "monospace" }}>
                {emp.employee_code}
              </span>
              {emp.designation_name && (
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                  {emp.designation_name}
                </Text>
              )}
              {emp.department_name && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
                  <Tag color="blue" style={{ margin: 0, fontSize: 11, borderRadius: 20 }}>{emp.department_name}</Tag>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {roles.map((r) => (
                <Tag key={r} style={{ margin: 0, fontSize: 10, borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
                  {r}
                </Tag>
              ))}
            </div>
          </div>
        </div>

        {/* quick meta row */}
        <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
          {[
            emp.email       && { icon: <MailOutlined />,        val: emp.email },
            emp.phone_number && { icon: <PhoneOutlined />,       val: emp.phone_number },
            emp.location_name && { icon: <EnvironmentOutlined />, val: emp.location_name },
            emp.joining_date  && { icon: <CalendarOutlined />,    val: `Joined ${emp.joining_date}` },
          ].filter(Boolean).map((item: any, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.45)" }}>{item.icon}</span>
              {item.val}
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        {/* Employment column */}
        <div style={{ padding: "20px 24px", borderRight: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <IdcardOutlined style={{ color: "#1677ff", fontSize: 14 }} />
            <Text style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Employment</Text>
          </div>
          <InfoRow label="Employee Code"    value={emp.employee_code} accent />
          <InfoRow label="Designation"      value={emp.designation_name} />
          <InfoRow label="Department"       value={emp.department_name} />
          <InfoRow label="Location"         value={emp.location_name} />
          <InfoRow label="Employment Type"  value={emp.employment_type_name} />
          <InfoRow label="Date of Joining"  value={emp.joining_date ?? undefined} />
          <InfoRow label="Total Experience" value={emp.total_experience != null ? `${emp.total_experience} yrs` : null} />
          <InfoRow label="Prior Experience" value={emp.prior_experience != null ? `${emp.prior_experience} yrs` : null} />
          <InfoRow label="Shift Applicable" value={emp.shift_applicable ? "Yes" : "No"} />
          <InfoRow label="Shift"            value={emp.shift_category_name} />
          <InfoRow label="Manager"          value={emp.manager_name} />
          <InfoRow label="Group"            value={emp.keycloak_group} />
        </div>

        {/* Profile column */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <UserOutlined style={{ color: "#7c3aed", fontSize: 14 }} />
            <Text style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Profile</Text>
          </div>
          <InfoRow label="First Name"    value={emp.first_name} />
          <InfoRow label="Last Name"     value={emp.last_name} />
          <InfoRow label="Email"         value={emp.email} />
          <InfoRow label="Username"      value={emp.username} />
          <InfoRow label="Gender"        value={emp.gender} />
          <InfoRow label="Date of Birth" value={emp.date_of_birth ?? undefined} />
          <InfoRow label="Phone"         value={emp.phone_number} />
          <InfoRow label="Company"       value={emp.company} />
          {emp.bio && (
            <div style={{ paddingTop: 8 }}>
              <Text style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>Bio</Text>
              <Text style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{emp.bio}</Text>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Main GlobalSearch component ───────────────────────────────────────────────
export default function GlobalSearch() {
  const location = useLocation();
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<EmpResult[]>([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [preview, setPreview]     = useState<EmpResult | null>(null);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef                   = useRef<HTMLDivElement>(null);
  const routerLocation = useLocation();

  useEffect(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
  }, [routerLocation.pathname]);

  // Clear search on route change
  useEffect(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [location.pathname]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await get<EmpResult[]>(`/employees/search/?q=${encodeURIComponent(q)}`);
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleClear = () => {
    setQuery(""); setResults([]); setOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <>
      <div ref={wrapRef} className="bms-global-search">
        <div
          className="bms-global-search-input-wrap"
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
        >
          <SearchOutlined style={{ color: "var(--bms-text-3)", fontSize: 14, flexShrink: 0 }} />
          <input
            className="bms-global-search-input"
            value={query}
            onChange={handleChange}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
            placeholder="Search employees by name or code"
            aria-label="Search employees"
            type="search"
            autoComplete="off"
          />
          {loading && <Spin size="small" />}
          {query && !loading && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              style={{
                cursor: "pointer",
                color: "var(--bms-text-3)",
                fontSize: 12,
                flexShrink: 0,
                lineHeight: 1,
                border: "none",
                background: "transparent",
                padding: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {open && query.trim().length >= 2 && (
          <div className="bms-global-search-dropdown">
            {results.length === 0 && !loading ? (
              <div className="bms-global-search-empty">
                No employees found for &ldquo;{query.trim()}&rdquo;
              </div>
            ) : (
              <>
                <div style={{ padding: "8px 12px 4px", borderBottom: "1px solid var(--bms-border)" }}>
                  <Text style={{ fontSize: 11, color: "var(--bms-text-3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Employees · {results.length} result{results.length !== 1 ? "s" : ""}
                  </Text>
                </div>
                {results.map((emp) => {
                  const av = avatarPastel(emp.full_name);
                  const isActive = emp.status === "ACTIVE";
                  const meta = [emp.designation_name, emp.department_name].filter(Boolean).join(" · ");
                  return (
                    <div
                      key={emp.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setPreview(emp);
                        setOpen(false);
                        setQuery("");
                        setResults([]);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setPreview(emp);
                          setOpen(false);
                          setQuery("");
                          setResults([]);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        cursor: "pointer",
                        borderBottom: "1px solid var(--bms-border)",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bms-surface-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {emp.profile_picture_url ? (
                        <Avatar size={36} src={emp.profile_picture_url} style={{ flexShrink: 0 }} />
                      ) : (
                        <Avatar size={36} style={{
                          background: av.bg, color: av.text, fontWeight: 600, fontSize: 12,
                          border: `1px solid ${av.border}`, flexShrink: 0,
                        }}>
                          {initials(emp.full_name)}
                        </Avatar>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          marginBottom: 3,
                        }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--bms-text)",
                            lineHeight: 1.3,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                          }}>
                            {emp.full_name}
                          </span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 20,
                            flexShrink: 0,
                            lineHeight: "16px",
                            background: isActive ? "#f0fdf4" : "#fff1f2",
                            color: isActive ? "#059669" : "#e11d48",
                            border: `1px solid ${isActive ? "#bbf7d0" : "#fecdd3"}`,
                          }}>
                            {emp.status}
                          </span>
                        </div>

                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          minWidth: 0,
                          overflow: "hidden",
                        }}>
                          <span style={{
                            fontSize: 10,
                            fontFamily: "monospace",
                            color: "var(--bms-text-2)",
                            background: "var(--bms-surface-2)",
                            padding: "1px 6px",
                            borderRadius: 4,
                            flexShrink: 0,
                            lineHeight: "16px",
                          }}>
                            {emp.employee_code}
                          </span>
                          {meta && (
                            <>
                              <span style={{ color: "var(--bms-text-3)", flexShrink: 0, lineHeight: 1 }}>·</span>
                              <span style={{
                                fontSize: 11,
                                color: "var(--bms-text-3)",
                                lineHeight: 1.3,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {meta}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {preview && (
        <EmployeePreviewModal
          emp={preview}
          onClose={() => {
            setPreview(null);
            setQuery("");
            setResults([]);
          }}
        />
      )}
    </>
  );
}
