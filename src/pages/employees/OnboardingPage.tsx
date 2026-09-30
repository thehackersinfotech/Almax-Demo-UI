import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from "recharts";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Typography, Button, Table, Avatar, Tag, Badge, Tabs, Drawer, Form,
  Input, Select, DatePicker, Modal, Space, Spin, Empty, message,
  Row, Col, Divider, Tooltip, Card, Progress, Timeline, Upload,
  Statistic, InputNumber, Checkbox, TimePicker, Alert, Popconfirm,
} from "antd";
import { UserAddOutlined, BellOutlined, DesktopOutlined, BarChartOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
  FileTextOutlined, MailOutlined, PhoneOutlined, CalendarOutlined,
  PlusOutlined, SendOutlined, EyeOutlined, LaptopOutlined,
  SafetyCertificateOutlined, CheckOutlined, CloseOutlined,
  TeamOutlined, ClockCircleOutlined, BankOutlined, IdcardOutlined,
  ScheduleOutlined, OrderedListOutlined, UploadOutlined, EditOutlined,
  ApartmentOutlined, ToolOutlined, FileProtectOutlined, RightOutlined,
  InboxOutlined, HomeOutlined, DownloadOutlined, SaveOutlined, SearchOutlined, ThunderboltOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { employeeApi, type Employee } from "@/services/employees";
import {
  getStoredSelfOnboardingData,
  saveStoredSelfOnboardingData,
  getEmployeePolicyAckStore,
  getCustomDocRequirements,
  addCustomDocRequirement,
  getAllPolicyDocuments,
} from "@/pages/employees/EmployeeOnboardingPortalPage";
import { onboardingTaskScheduleStore } from "@/store/onboardingTaskScheduleStore";
import { avatarPastel, initialsFromName } from "@/utils/avatarColors";
import { useAuthStore } from "@/store/auth";
import { itAssetStore, type InventoryItem, type EmployeeAsset, type AssetRequest } from "@/store/itAssets";
import { addLocalNotification } from "@/services/notifications";
import { PERMS } from "@/constants/permissions";
import {
  departmentApi, designationApi, locationApi, employmentTypeApi, shiftCategoryApi,
} from "@/services/master";
import { employeeGroupApi } from "@/services/employees";
import { policyApi } from "@/services/compliance";
import { apiErrorMsg } from "@/utils/apiError";
import PhoneInput from "@/components/common/PhoneInput";
import { phoneFormRules } from "@/utils/phone";
import { resolveGroupFlags } from "@/constants/keycloakGroups";
import { hasFullAccess, hasAnyPermission } from "@/utils/access";

const { Text, Title, Paragraph } = Typography;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function initials(name: string) { return initialsFromName(name); }

function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str.trim().split(/\s+/).map((w) => {
    const c = w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (c === "it") return "IT";
    if (c === "hr" || c === "hrms") return c.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

// Derive onboarding status from real employee fields and self-onboarding store
function getOnboardingStatus(emp: Employee): {
  personalInfo: boolean;
  bankDetails: boolean;
  policyAck: boolean;
  docsVerified: boolean;
  status: "complete" | "in_progress" | "at_risk";
} {
  const stored = emp?.id ? getStoredSelfOnboardingData(emp.id) : null;
  const personalInfo = !!(emp.email && emp.first_name && emp.last_name && (emp.phone_number || stored?.phoneNumber) && (emp.gender || stored?.gender) && (emp.date_of_birth || stored?.dateOfBirth));
  const bankDetails = stored?.bankSubmitted || (emp.joining_date ? dayjs().diff(dayjs(emp.joining_date), "day") > 14 : false);
  const uploadedDocs = stored?.documents?.filter((d) => d.status === "uploaded" || d.status === "verified").length || 0;
  const docsVerified = uploadedDocs >= 3 || (emp.status === "ACTIVE" && (emp.joining_date ? dayjs().diff(dayjs(emp.joining_date), "day") > 30 : false));
  const policyAcks = emp ? getEmployeePolicyAckStore(emp) : {};
  const ackCount = Object.values(policyAcks).filter((a) => a.acknowledged).length;
  const policyAck = ackCount > 0;

  const completed = [personalInfo, bankDetails, policyAck, docsVerified].filter(Boolean).length;
  const status = completed === 4 ? "complete" : completed <= 1 ? "at_risk" : "in_progress";
  return { personalInfo, bankDetails, policyAck, docsVerified, status };
}

function isThisWeek(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = dayjs(dateStr);
  return d.isAfter(dayjs().startOf("week")) && d.isBefore(dayjs().endOf("week"));
}
function isThisMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dayjs(dateStr).month() === dayjs().month() && dayjs(dateStr).year() === dayjs().year();
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge renderer
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingStatusBadge({ status }: { status: "complete" | "in_progress" | "at_risk" }) {
  const cfg = {
    complete:    { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", label: "Complete" },
    in_progress: { color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "In Progress" },
    at_risk:     { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "At Risk" },
  }[status];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 10px",
      borderRadius: 20, background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

function CheckBadge({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircleOutlined style={{ color: "#059669", fontSize: 16 }} />
    : <CloseCircleOutlined style={{ color: "#dc2626", fontSize: 16 }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock document list per employee (derived from id deterministically)
// ─────────────────────────────────────────────────────────────────────────────
const DOC_TYPES = ["Aadhaar Card", "PAN Card", "Resume", "Degree Certificate", "Previous Offer Letter", "Bank Passbook", "Passport (if applicable)"];

function getMockDocs(empId: string) {
  const seed = empId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return DOC_TYPES.map((name, i) => ({
    id: `${empId}-doc-${i}`,
    name,
    status: (["verified", "pending", "rejected"] as const)[((seed + i) % 3)],
    uploadedAt: dayjs().subtract(seed % 30 + i * 3, "day").format("DD MMM YYYY"),
  }));
}

// Mock tasks per employee
const TASK_TYPES = ["Complete personal info form", "Submit bank details", "Acknowledge company policies", "Attend HR orientation", "Setup company email", "IT equipment collection", "Complete onboarding survey"];

function getMockTasks(empId: string) {
  const seed = empId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return TASK_TYPES.map((title, i) => ({
    id: `${empId}-task-${i}`,
    title,
    status: (["done", "pending", "in_progress"] as const)[((seed + i * 7) % 3)],
    dueDate: dayjs().add(i * 2 - 3, "day").format("DD MMM YYYY"),
    assignedTo: "HR",
  }));
}

// Mock schedule per employee
function getMockSchedules(empId: string) {
  const seed = empId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return [
    { id: `${empId}-sch-0`, title: "HR Orientation", date: dayjs().add(seed % 5, "day").format("DD MMM YYYY"), time: "10:00 AM", location: "HR Room", status: "scheduled" },
    { id: `${empId}-sch-1`, title: "IT Equipment Setup", date: dayjs().add((seed % 5) + 2, "day").format("DD MMM YYYY"), time: "2:00 PM", location: "IT Department", status: "scheduled" },
    { id: `${empId}-sch-2`, title: "Manager 1-on-1", date: dayjs().add((seed % 5) + 5, "day").format("DD MMM YYYY"), time: "11:00 AM", location: "Conference Room A", status: "pending" },
  ];
}

// Mock assets per employee
const ASSET_LIST = [
  { type: "Laptop", model: "Dell XPS 15", assetId: "IT-L-001" },
  { type: "Mouse", model: "Logitech MX Master", assetId: "IT-M-045" },
  { type: "Keyboard", model: "Keychron K2", assetId: "IT-K-012" },
  { type: "Monitor", model: 'LG 27" 4K', assetId: "IT-D-007" },
  { type: "Headset", model: "Sony WH-1000XM5", assetId: "IT-H-033" },
];

function getMockAssets(empId: string) {
  const seed = empId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const count = (seed % 4) + 1;
  return ASSET_LIST.slice(0, count).map((a, i) => ({
    ...a,
    assignedDate: dayjs().subtract(seed % 30 + i * 5, "day").format("DD MMM YYYY"),
    condition: (["Good", "Excellent", "Fair"] as const)[(seed + i) % 3],
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee Onboarding Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────
function EmployeeOnboardingDrawer({
  emp, open, onClose, onboardingStatus, allEmployees = [],
}: {
  emp: Employee | null;
  open: boolean;
  onClose: () => void;
  onboardingStatus: ReturnType<typeof getOnboardingStatus> | null;
  allEmployees?: Employee[];
}) {
  const [activeTab, setActiveTab] = useState("personal");
  const [addScheduleVisible, setAddScheduleVisible] = useState(false);
  const [addTaskVisible, setAddTaskVisible] = useState(false);
  const [schedForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [hrEditLoading, setHrEditLoading] = useState(false);
  const [hrPersonalForm] = Form.useForm();
  const [addDocModalOpen, setAddDocModalOpen] = useState(false);
  const [addDocForm] = Form.useForm();
  const qc = useQueryClient();
  const [, setScheduleTaskTick] = useState(0);

  useEffect(() => {
    if (open && emp?.id) {
      onboardingTaskScheduleStore.fetchForEmployee(emp.id).then(() => {
        setScheduleTaskTick((v) => v + 1);
      });
    }
  }, [open, emp?.id]);

  useEffect(() => {
    const unsub = onboardingTaskScheduleStore.subscribe(() => {
      setScheduleTaskTick((v) => v + 1);
    });
    return unsub;
  }, []);

  const { data: designations = [] } = useQuery({ queryKey: ["dd", "designations"], queryFn: () => designationApi.dropdown(), staleTime: 60_000 });
  const { data: departments = [] }  = useQuery({ queryKey: ["dd", "departments"],  queryFn: () => departmentApi.dropdown(),  staleTime: 60_000 });
  const { data: locations = [] }    = useQuery({ queryKey: ["dd", "locations"],    queryFn: () => locationApi.dropdown(),    staleTime: 60_000 });
  const { data: empTypes = [] }     = useQuery({ queryKey: ["dd", "emp-types"],    queryFn: () => employmentTypeApi.dropdown(), staleTime: 60_000 });
  const { data: realPolicies = [] } = useQuery({ queryKey: ["policy-documents"],   queryFn: () => policyApi.list(), staleTime: 30_000 });

  // Merge API + localStorage policies (no hardcoded defaults)
  const [localPoliciesVersion, setLocalPoliciesVersion] = useState(0);
  React.useEffect(() => {
    const handler = () => setLocalPoliciesVersion((v) => v + 1);
    window.addEventListener("nexus-policy-updated", handler);
    return () => window.removeEventListener("nexus-policy-updated", handler);
  }, []);
  const drawerPolicies = useMemo(
    () => getAllPolicyDocuments(realPolicies),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [realPolicies, localPoliciesVersion]
  );

  const [inventory, setInventory] = useState<any[]>([]);
  const [empAssets, setEmpAssets] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestItem, setRequestItem] = useState<any | null>(null);
  const [requestNote, setRequestNote] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [viewPolicyModal, setViewPolicyModal] = useState<{ policy: any; isAcked: boolean; ackDate?: string } | null>(null);

  React.useEffect(() => {
    setIsEditingPersonal(false);
    setHrEditLoading(false);
  }, [emp?.id, open]);

  const reloadAssets = React.useCallback(() => {
    setInventory(itAssetStore.getInventory());
    if (emp) {
      setEmpAssets(itAssetStore.getEmployeeAssets(emp.id));
      setRequests(itAssetStore.getRequests(emp.id));
    }
  }, [emp]);

  React.useEffect(() => {
    if (open) reloadAssets();
    return itAssetStore.subscribe(reloadAssets);
  }, [open, reloadAssets]);

  const handleRequest = () => {
    if (!requestItem || !emp) return;
    setRequestLoading(true);
    itAssetStore.createRequest({
      employeeId: emp.id,
      employeeName: emp.full_name || emp.username,
      employeeCode: emp.employee_code,
      inventoryItemId: requestItem.id,
      itemName: requestItem.name,
      category: requestItem.category,
      kind: requestItem.kind,
      notes: requestNote,
    });
    message.success(`Request sent for ${requestItem.name} — Status: Pending`);
    setRequestLoading(false);
    setRequestModalOpen(false);
    setRequestItem(null);
    setRequestNote("");
  };

  if (!emp || !onboardingStatus) return null;

  const docs = getMockDocs(emp.id);
  const tasks = getMockTasks(emp.id);
  const schedules = getMockSchedules(emp.id);
  const assets = getMockAssets(emp.id);
  const av = avatarPastel(emp.full_name || emp.username);

  const docStatusCfg = {
    verified: { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", label: "Verified" },
    pending:  { color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Pending" },
    rejected: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Rejected" },
  };
  const taskStatusCfg = {
    done:        { color: "#059669", label: "Done" },
    in_progress: { color: "#d97706", label: "In Progress" },
    pending:     { color: "#6b7280", label: "Pending" },
  };

  const infoRow = (label: string, value: string | null | undefined) => (
    <div style={{ display: "flex", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--bms-border)" }}>
      <Text style={{ minWidth: 160, color: "var(--bms-text-3)", fontSize: 13 }}>{label}</Text>
      <Text style={{ flex: 1, color: "var(--bms-text)", fontSize: 13, fontWeight: 500 }}>{value || "—"}</Text>
    </div>
  );

  const handleStartEdit = () => {
    if (!emp) return;
    const selfData = getStoredSelfOnboardingData(emp);
    hrPersonalForm.setFieldsValue({
      first_name: emp.first_name || "",
      last_name: emp.last_name || "",
      email: emp.email || "",
      phone_number: emp.phone_number || selfData?.phoneNumber || "",
      alternative_number: emp.alternative_number || selfData?.alternativeNumber || "",
      gender: emp.gender || selfData?.gender || "M",
      date_of_birth: emp.date_of_birth ? dayjs(emp.date_of_birth) : selfData?.dateOfBirth ? dayjs(selfData.dateOfBirth) : null,
      joining_date: emp.joining_date ? dayjs(emp.joining_date) : null,
      address: emp.address || selfData?.address || "",
      department_ref: emp.department_ref || null,
      designation_ref: emp.designation_ref || null,
      location: emp.location || null,
      employment_type: emp.employment_type || null,
      manager: emp.manager || null,
      emergencyContactName: selfData?.emergencyContactName || "",
      emergencyContactRelation: selfData?.emergencyContactRelation || "",
      emergencyContactPhone: selfData?.emergencyContactPhone || "",
      bio: emp.bio || selfData?.bio || "",
    });
    setIsEditingPersonal(true);
  };

  const handleSaveHRPersonal = async (values: any) => {
    if (!emp) return;
    setHrEditLoading(true);
    try {
      const validManager =
        values.manager && typeof values.manager === "string" && !values.manager.startsWith("emp-") && !values.manager.startsWith("mock-")
          ? values.manager
          : null;

      const payload: any = {
        first_name: values.first_name,
        last_name: values.last_name,
        phone_number: values.phone_number || "",
        alternative_number: values.alternative_number || "",
        address: values.address || "",
        gender: values.gender || "M",
        date_of_birth: values.date_of_birth ? dayjs(values.date_of_birth).format("YYYY-MM-DD") : null,
        joining_date: values.joining_date ? dayjs(values.joining_date).format("YYYY-MM-DD") : null,
        department_ref: values.department_ref || null,
        designation_ref: values.designation_ref || null,
        location: values.location || null,
        employment_type: values.employment_type || null,
        manager: validManager,
        bio: values.bio || "",
      };

      if (emp.id && typeof emp.id === "string" && !emp.id.startsWith("emp-") && !emp.id.startsWith("mock-")) {
        try {
          await employeeApi.update(emp.id, payload);
        } catch (err) {
          console.warn("Backend API update notice:", err);
        }
      }

      const assignedMgr = (allEmployees || []).find((e) => e.id === values.manager);

      emp.first_name = values.first_name;
      emp.last_name = values.last_name;
      emp.full_name = `${values.first_name || ""} ${values.last_name || ""}`.trim();
      if (values.email) emp.email = values.email;
      emp.phone_number = values.phone_number;
      emp.alternative_number = values.alternative_number;
      emp.address = values.address;
      emp.gender = values.gender;
      emp.date_of_birth = values.date_of_birth ? dayjs(values.date_of_birth).format("YYYY-MM-DD") : null;
      emp.joining_date = values.joining_date ? dayjs(values.joining_date).format("YYYY-MM-DD") : null;
      emp.department_ref = values.department_ref;
      emp.designation_ref = values.designation_ref;
      emp.location = values.location;
      emp.employment_type = values.employment_type;

      const deptObj = (departments as any[]).find((d) => d.id === values.department_ref);
      const desigObj = (designations as any[]).find((d) => d.id === values.designation_ref);
      const locObj = (locations as any[]).find((d) => d.id === values.location);
      const typeObj = (empTypes as any[]).find((d) => d.id === values.employment_type);

      if (deptObj) emp.department_name = deptObj.name;
      if (desigObj) emp.designation_name = desigObj.name;
      if (locObj) emp.location_name = locObj.name;
      if (typeObj) emp.employment_type_name = typeObj.name;

      if (assignedMgr) {
        emp.manager = assignedMgr.id;
        emp.manager_name = assignedMgr.full_name || assignedMgr.username;
      } else if (!values.manager) {
        emp.manager = null;
        emp.manager_name = undefined as any;
      }

      emp.bio = values.bio;

      const currentSelf = getStoredSelfOnboardingData(emp);
      const updatedSelf = {
        ...currentSelf,
        phoneNumber: values.phone_number || currentSelf.phoneNumber,
        alternativeNumber: values.alternative_number || currentSelf.alternativeNumber,
        emergencyContactName: values.emergencyContactName || currentSelf.emergencyContactName,
        emergencyContactRelation: values.emergencyContactRelation || currentSelf.emergencyContactRelation,
        emergencyContactPhone: values.emergencyContactPhone || currentSelf.emergencyContactPhone,
        address: values.address || currentSelf.address,
        gender: values.gender || currentSelf.gender,
        dateOfBirth: values.date_of_birth ? dayjs(values.date_of_birth).format("YYYY-MM-DD") : currentSelf.dateOfBirth,
        bio: values.bio || currentSelf.bio,
      };

      saveStoredSelfOnboardingData(emp.id, updatedSelf);
      if (emp.keycloak_id) saveStoredSelfOnboardingData(emp.keycloak_id, updatedSelf);
      if (emp.username) saveStoredSelfOnboardingData(emp.username, updatedSelf);

      if (assignedMgr) {
        addLocalNotification({
          event_type: "onboarding.manager_assigned",
          title: "Employee Onboarding Assigned",
          message: `Employee ${emp.full_name || emp.username} reporting manager has been updated to you.`,
          action_url: "/onboarding",
          targetUsername: assignedMgr.username,
        });
      }

      message.success("Employee information updated successfully!");
      setIsEditingPersonal(false);
      qc.invalidateQueries({ queryKey: ["employees"] });
    } catch (e: any) {
      console.error("Save personal info error:", e);
      message.error("Failed to update employee information");
    } finally {
      setHrEditLoading(false);
    }
  };

  const tabItems = [
    {
      key: "personal",
      label: <span><IdcardOutlined style={{ marginRight: 6 }} />Personal Info</span>,
      children: (() => {
        const selfData = emp ? getStoredSelfOnboardingData(emp) : null;
        return (
          <div style={{ paddingTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckBadge ok={onboardingStatus.personalInfo} />
                <Text style={{ fontSize: 13, color: onboardingStatus.personalInfo ? "#059669" : "#dc2626", fontWeight: 600 }}>
                  {onboardingStatus.personalInfo ? "Personal information complete" : "Personal information incomplete"}
                </Text>
              </div>
              {!isEditingPersonal ? (
                <Button size="small" type="primary" icon={<EditOutlined />} onClick={handleStartEdit}>
                  Edit Personal Info
                </Button>
              ) : (
                <Button size="small" onClick={() => setIsEditingPersonal(false)}>
                  Cancel Edit
                </Button>
              )}
            </div>

            {isEditingPersonal ? (
              <Form form={hrPersonalForm} layout="vertical" onFinish={handleSaveHRPersonal} style={{ marginTop: 12 }}>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="first_name" label="First Name" rules={[{ required: true, message: "First name required" }]}>
                      <Input placeholder="First Name" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="last_name" label="Last Name" rules={[{ required: true, message: "Last name required" }]}>
                      <Input placeholder="Last Name" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="email" label="Email Address" rules={[{ required: true, type: "email", message: "Valid email required" }]}>
                      <Input placeholder="Email Address" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phone_number" label="Phone Number">
                      <Input placeholder="Enter phone number" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="alternative_number" label="Alt Phone Number">
                      <Input placeholder="Enter alt phone" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="gender" label="Gender">
                      <Select options={[{ value: "M", label: "Male" }, { value: "F", label: "Female" }, { value: "O", label: "Other" }]} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="date_of_birth" label="Date of Birth">
                      <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="joining_date" label="Date of Joining">
                      <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="department_ref" label="Department">
                      <Select showSearch allowClear options={(departments as any[]).map((d) => ({ value: d.id, label: d.name }))} placeholder="Select Department" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="designation_ref" label="Designation">
                      <Select showSearch allowClear options={(designations as any[]).map((d) => ({ value: d.id, label: d.name }))} placeholder="Select Designation" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="location" label="Location / Branch">
                      <Select showSearch allowClear options={(locations as any[]).map((d) => ({ value: d.id, label: d.name }))} placeholder="Select Location" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="employment_type" label="Employment Type">
                      <Select showSearch allowClear options={(empTypes as any[]).map((d) => ({ value: d.id, label: d.name }))} placeholder="Select Type" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="manager" label="Reporting Manager (e.g. Project Manager)">
                      <Select
                        showSearch
                        allowClear
                        placeholder="Select Reporting Manager / Project Manager"
                        options={allEmployees.map((e) => ({
                          value: e.id,
                          label: `${e.full_name || e.username} (${e.designation_name || e.employee_code || "Employee"})`,
                        }))}
                        filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="address" label="Address">
                      <Input.TextArea rows={2} placeholder="Full address" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="emergencyContactName" label="Emergency Contact Name">
                      <Input placeholder="Contact Name" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="emergencyContactRelation" label="Relationship">
                      <Input placeholder="Relationship" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="emergencyContactPhone" label="Emergency Phone">
                      <Input placeholder="Phone" />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="bio" label="Bio / Notes">
                      <Input.TextArea rows={2} placeholder="Notes" />
                    </Form.Item>
                  </Col>
                </Row>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <Button onClick={() => setIsEditingPersonal(false)}>Cancel</Button>
                  <Button type="primary" htmlType="submit" loading={hrEditLoading} icon={<SaveOutlined />}>
                    Save All Changes
                  </Button>
                </div>
              </Form>
            ) : (
              <>
                {infoRow("Full Name", emp.full_name || emp.username)}
                {infoRow("Email", emp.email)}
                {infoRow("Phone", emp.phone_number || selfData?.phoneNumber || "—")}
                {infoRow("Alternative Phone", emp.alternative_number || selfData?.alternativeNumber || "—")}
                {infoRow("Gender", emp.gender === "M" ? "Male" : emp.gender === "F" ? "Female" : (emp.gender || selfData?.gender || "—"))}
                {infoRow("Date of Birth", emp.date_of_birth ? dayjs(emp.date_of_birth).format("DD MMM YYYY") : (selfData?.dateOfBirth ? dayjs(selfData.dateOfBirth).format("DD MMM YYYY") : "—"))}
                {infoRow("Date of Joining", emp.joining_date ? dayjs(emp.joining_date).format("DD MMM YYYY") : "—")}
                {infoRow("Address", emp.address || selfData?.address || "—")}
                {infoRow("Department", toTitleCase(emp.department_name))}
                {infoRow("Designation", toTitleCase(emp.designation_name))}
                {infoRow("Location", toTitleCase(emp.location_name))}
                {infoRow("Employee Code", emp.employee_code)}
                {infoRow("Employment Type", toTitleCase(emp.employment_type_name))}
                {infoRow("Reporting Manager", toTitleCase(emp.manager_name))}
                {infoRow("Bio / Notes", emp.bio || selfData?.bio || "—")}
                <div style={{ marginTop: 20 }}>
                  <Text strong style={{ color: "var(--bms-text-3)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Emergency Contact
                  </Text>
                  <Divider style={{ margin: "8px 0 4px" }} />
                  {infoRow("Contact Name", selfData?.emergencyContactName || "—")}
                  {infoRow("Relationship", selfData?.emergencyContactRelation || "—")}
                  {infoRow("Phone", selfData?.emergencyContactPhone || "—")}
                </div>
              </>
            )}
          </div>
        );
      })(),
    },
    {
      key: "bank",
      label: <span><BankOutlined style={{ marginRight: 6 }} />Bank Details</span>,
      children: (() => {
        const selfData = emp ? getStoredSelfOnboardingData(emp.id) : null;
        const hasBank = selfData?.bankSubmitted || onboardingStatus.bankDetails;
        return (
          <div style={{ paddingTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <CheckBadge ok={!!hasBank} />
              <Text style={{ fontSize: 13, color: hasBank ? "#059669" : "#dc2626", fontWeight: 600 }}>
                {hasBank ? "Bank details submitted" : "Bank details not yet submitted"}
              </Text>
            </div>
            {hasBank ? (
              <>
                {infoRow("Account Holder Name", selfData?.accountHolderName || emp.full_name)}
                {infoRow("Bank Name", selfData?.bankName || "HDFC Bank")}
                {infoRow("Account Number", selfData?.accountNumber ? `••••${selfData.accountNumber.slice(-4)}` : "••••••••••1234")}
                {infoRow("IFSC Code", selfData?.ifscCode || "HDFC0001234")}
                {infoRow("Branch", selfData?.branchName || "Main Branch")}
                {infoRow("Account Type", selfData?.accountType || "Savings")}
                {infoRow("PAN Number", selfData?.panNumber || "ABCDE1234F")}
              </>
            ) : (
              <Empty description={
                <span style={{ color: "var(--bms-text-3)" }}>
                  Employee has not yet submitted bank details.
                  <br />
                  <Button type="primary" size="small" style={{ marginTop: 12 }} icon={<SendOutlined />}
                    onClick={() => message.success("Reminder sent to employee")}>
                    Send Reminder
                  </Button>
                </span>
              } style={{ padding: "40px 0" }} />
            )}
          </div>
        );
      })(),
    },
    {
      key: "documents",
      label: <span><FileTextOutlined style={{ marginRight: 6 }} />Documents</span>,
      children: (() => {
        const selfData = emp ? getStoredSelfOnboardingData(emp.id) : null;
        const baseDocs = selfData?.documents || [];
        const customDocs = emp ? getCustomDocRequirements(emp.id) : [];
        const mergedDocs = [
          ...baseDocs,
          ...customDocs.map((cd) => ({
            id: cd.id,
            type: cd.name,
            fileName: undefined,
            uploadedAt: undefined,
            fileUrl: undefined,
            status: "pending" as const,
            addedByHR: true,
          })),
        ];

        return (
          <div style={{ paddingTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckBadge ok={onboardingStatus.docsVerified} />
                <Text style={{ fontSize: 13, color: onboardingStatus.docsVerified ? "#059669" : "#dc2626", fontWeight: 600 }}>
                  {onboardingStatus.docsVerified ? "All documents verified" : "Documents pending review"}
                </Text>
              </div>
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setAddDocModalOpen(true)}>
                Add Document Requirement
              </Button>
            </div>
            {mergedDocs.map((doc) => {
              const isUploaded = doc.status === "uploaded" || doc.status === "verified";
              return (
                <div key={doc.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", marginBottom: 8, borderRadius: 8,
                  background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileTextOutlined style={{ color: "var(--bms-primary)", fontSize: 18 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>
                        {doc.type}
                        {"addedByHR" in doc && doc.addedByHR && <Tag color="purple" style={{ marginLeft: 8, fontSize: 10 }}>Added by HR</Tag>}
                      </div>
                      {doc.fileName ? (
                        <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>File: {doc.fileName} — {doc.uploadedAt}</div>
                      ) : (
                        <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Pending upload</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                      background: isUploaded ? "#ecfdf5" : "#fffbeb",
                      color: isUploaded ? "#059669" : "#d97706",
                      border: `1px solid ${isUploaded ? "#a7f3d0" : "#fde68a"}`,
                    }}>
                      {isUploaded ? "Uploaded" : "Pending"}
                    </span>
                    {isUploaded && doc.fileUrl && (
                      <Tooltip title="Download Document">
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => {
                          const a = document.createElement("a");
                          a.href = doc.fileUrl!;
                          a.download = doc.fileName || doc.type;
                          a.click();
                          message.success(`Downloading ${doc.fileName || doc.type}`);
                        }} />
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })(),
    },
    {
      key: "schedule",
      label: <span><ScheduleOutlined style={{ marginRight: 6 }} />Schedule</span>,
      children: (() => {
        const empSchedules = emp ? onboardingTaskScheduleStore.getSchedules(emp.id) : [];
        const displaySchedules = empSchedules;
        return (
          <div style={{ paddingTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text strong style={{ color: "var(--bms-text)" }}>Onboarding Schedule</Text>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddScheduleVisible(true)}>
                Add Schedule
              </Button>
            </div>
            {displaySchedules.length === 0 ? (
              <Empty description="No onboarding schedules assigned yet" style={{ padding: "20px 0" }} />
            ) : (
              <Timeline
                items={displaySchedules.map((s) => ({
                  dot: <CalendarOutlined style={{ fontSize: 16, color: "var(--bms-primary)" }} />,
                  children: (
                    <div style={{
                      background: "var(--bms-surface-2)", borderRadius: 8, padding: "12px 14px",
                      border: "1px solid var(--bms-border)", marginBottom: 4,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)", marginBottom: 4 }}>{s.title}</div>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "var(--bms-text-3)" }}>📅 {s.date}</span>
                        <span style={{ fontSize: 12, color: "var(--bms-text-3)" }}>⏰ {s.time}</span>
                        <span style={{ fontSize: 12, color: "var(--bms-text-3)" }}>📍 {s.location}</span>
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
            {/* Add Schedule Modal */}
            <Modal
              title="Add Onboarding Schedule"
              open={addScheduleVisible}
              onCancel={() => { schedForm.resetFields(); setAddScheduleVisible(false); }}
              onOk={() => schedForm.validateFields().then((vals) => {
                if (emp) {
                  onboardingTaskScheduleStore.addSchedule(emp.id, {
                    title: vals.title,
                    date: vals.date ? dayjs(vals.date).format("DD MMM YYYY") : dayjs().format("DD MMM YYYY"),
                    time: vals.time ? dayjs(vals.time).format("hh:mm A") : "10:00 AM",
                    location: vals.location,
                  });
                }
                message.success("Schedule added for employee");
                schedForm.resetFields();
                setAddScheduleVisible(false);
              })}
              okText="Add"
              destroyOnHidden
            >
              <Form form={schedForm} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item name="title" label="Event Title" rules={[{ required: true }]}>
                  <Input placeholder="e.g. HR Orientation" />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                      <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="time" label="Time">
                      <TimePicker format="hh:mm A" use12Hours style={{ width: "100%" }} placeholder="Select Time" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="location" label="Location">
                  <Input placeholder="e.g. HR Room" />
                </Form.Item>
              </Form>
            </Modal>
          </div>
        );
      })(),
    },
    {
      key: "tasks",
      label: <span><OrderedListOutlined style={{ marginRight: 6 }} />Tasks</span>,
      children: (() => {
        const empTasks = emp ? onboardingTaskScheduleStore.getTasks(emp.id) : [];
        const displayTasks = empTasks;
        return (
          <div style={{ paddingTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text strong style={{ color: "var(--bms-text)" }}>Onboarding Tasks</Text>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddTaskVisible(true)}>
                Assign Task
              </Button>
            </div>
            {displayTasks.length === 0 ? (
              <Empty description="No onboarding tasks assigned yet" style={{ padding: "20px 0" }} />
            ) : (
              displayTasks.map((task: any) => {
                const cfg = taskStatusCfg[task.status as keyof typeof taskStatusCfg] || taskStatusCfg.pending;
                return (
                  <div key={task.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px", marginBottom: 8, borderRadius: 8,
                    background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {task.status === "done"
                        ? <CheckCircleOutlined style={{ color: "#059669", fontSize: 16 }} />
                        : task.status === "in_progress"
                        ? <ClockCircleOutlined style={{ color: "#d97706", fontSize: 16 }} />
                        : <ExclamationCircleOutlined style={{ color: "#6b7280", fontSize: 16 }} />
                      }
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13, color: "var(--bms-text)", textDecoration: task.status === "done" ? "line-through" : "none" }}>{task.title}</div>
                        <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Due: {task.dueDate}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  </div>
                );
              })
            )}
            {/* Assign Task Modal */}
            <Modal
              title="Assign Onboarding Task"
              open={addTaskVisible}
              onCancel={() => { taskForm.resetFields(); setAddTaskVisible(false); }}
              onOk={() => taskForm.validateFields().then((vals) => {
                if (emp) {
                  onboardingTaskScheduleStore.addTask(emp.id, {
                    title: vals.title,
                    dueDate: vals.dueDate ? dayjs(vals.dueDate).format("DD MMM YYYY") : dayjs().format("DD MMM YYYY"),
                    priority: vals.priority,
                    notes: vals.notes,
                  });
                }
                message.success("Task assigned to employee");
                taskForm.resetFields();
                setAddTaskVisible(false);
              })}
              okText="Assign"
              destroyOnHidden
            >
              <Form form={taskForm} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item name="title" label="Task Title" rules={[{ required: true }]}>
                  <Input placeholder="e.g. Complete policy form" />
                </Form.Item>
                <Form.Item name="dueDate" label="Due Date" rules={[{ required: true }]}>
                  <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
                </Form.Item>
                <Form.Item name="priority" label="Priority">
                  <Select options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
                </Form.Item>
                <Form.Item name="notes" label="Notes">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Form>
            </Modal>
          </div>
        );
      })(),
    },
    {
      key: "assets",
      label: <span><LaptopOutlined style={{ marginRight: 6 }} />Assets & Facilities</span>,
      children: (
        <AssetsAndFacilitiesTab
          emp={emp}
          inventory={inventory}
          empAssets={empAssets}
          requests={requests}
          requestModalOpen={requestModalOpen}
          requestItem={requestItem}
          requestNote={requestNote}
          requestLoading={requestLoading}
          setRequestItem={setRequestItem}
          setRequestModalOpen={setRequestModalOpen}
          setRequestNote={setRequestNote}
          handleRequest={handleRequest}
        />
      ),
    },
    {
      key: "policy",
      label: <span><SafetyCertificateOutlined style={{ marginRight: 6 }} />Policy</span>,
      children: (() => {
        const empPolicyAcks = emp ? getEmployeePolicyAckStore(emp) : {};
        const totalPolicies = drawerPolicies.length;
        const ackedCount = drawerPolicies.filter(
          (p) => empPolicyAcks[p.id]?.acknowledged
        ).length;
        const allAcked = totalPolicies > 0 && ackedCount === totalPolicies;

        return (
          <div style={{ paddingTop: 8 }}>
            {/* Summary badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <CheckBadge ok={allAcked} />
              <Text style={{ fontSize: 13, color: allAcked ? "#059669" : "#dc2626", fontWeight: 600 }}>
                {totalPolicies === 0
                  ? "No policy documents added yet"
                  : allAcked
                  ? `All ${totalPolicies} ${totalPolicies === 1 ? "policy" : "policies"} acknowledged`
                  : `${ackedCount} / ${totalPolicies} ${totalPolicies === 1 ? "policy" : "policies"} acknowledged`}
              </Text>
            </div>

            {/* Empty state */}
            {drawerPolicies.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    No policy documents have been added by HR yet.
                    <br />Go to <strong>Policy Documents</strong> to upload policies.
                  </Text>
                }
              />
            )}

            {/* Per-policy rows */}
            {drawerPolicies.map((pol) => {
              const ack = empPolicyAcks[pol.id];
              const isAcked = !!ack?.acknowledged;
              return (
                <div
                  key={pol.id}
                  style={{
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    padding: "10px 14px", marginBottom: 8, borderRadius: 8,
                    background: "var(--bms-surface-2)", border: `1px solid ${isAcked ? "#a7f3d0" : "var(--bms-border)"}`,
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
                    <FileProtectOutlined style={{ color: "var(--bms-primary)", fontSize: 16, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{pol.title}</div>
                      {pol.version && (
                        <Text type="secondary" style={{ fontSize: 11 }}>{pol.version}</Text>
                      )}
                      {pol.effectiveDate && (
                        <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Effective: {pol.effectiveDate}</div>
                      )}
                      {isAcked && ack.acknowledgedAt && (
                        <div style={{ fontSize: 11, color: "#059669", marginTop: 2 }}>
                          ✓ Acknowledged on {ack.acknowledgedAt}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <Tag color={isAcked ? "success" : "warning"} style={{ fontSize: 11 }}>
                      {isAcked ? <><CheckCircleOutlined /> Acknowledged</> : <><ClockCircleOutlined /> Pending</>}
                    </Tag>
                    <Tooltip title="View Policy">
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => setViewPolicyModal({ policy: pol, isAcked, ackDate: ack?.acknowledgedAt })}
                      />
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })(),
    },

  ];

  const completedCount = [onboardingStatus.personalInfo, onboardingStatus.bankDetails, onboardingStatus.policyAck, onboardingStatus.docsVerified].filter(Boolean).length;
  const progressPct = Math.round((completedCount / 4) * 100);

  return (
    <Drawer
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar
            size={40}
            style={{ background: av.bg, color: av.text, fontWeight: 700, border: `1px solid ${av.border}` }}
          >
            {initials(emp.full_name || emp.username)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--bms-text)" }}>{toTitleCase(emp.full_name || emp.username)}</div>
            <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>{toTitleCase(emp.designation_name)} · {toTitleCase(emp.department_name)}</div>
          </div>
        </div>
      }
      open={open}
      onClose={onClose}
      width={740}
      destroyOnHidden
      extra={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <OnboardingStatusBadge status={onboardingStatus.status} />
          <div style={{ minWidth: 100 }}>
            <Progress
              percent={progressPct}
              size="small"
              strokeColor={progressPct === 100 ? "#059669" : progressPct >= 50 ? "#d97706" : "#dc2626"}
              format={(p) => <span style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{p}%</span>}
            />
          </div>
        </div>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="small"
        style={{ marginTop: -8 }}
      />

      {/* Add Document Requirement Modal */}
      <Modal
        title={<span><PlusOutlined style={{ marginRight: 8 }} />Add New Document Requirement</span>}
        open={addDocModalOpen}
        onCancel={() => { addDocForm.resetFields(); setAddDocModalOpen(false); }}
        onOk={() => addDocForm.submit()}
        okText="Add Requirement"
      >
        <Form
          form={addDocForm}
          layout="vertical"
          onFinish={(values) => {
            if (!emp) return;
            addCustomDocRequirement(emp, {
              name: values.name,
              description: values.description,
              required: values.required ?? true,
            });
            addLocalNotification({
              event_type: "onboarding.new_document_required",
              title: "New Required Document Added",
              message: `HR has added a new required document: ${values.name}. Please upload it in your onboarding portal.`,
              action_url: "/employee-onboarding",
              targetUsername: emp.username,
            });
            message.success(`Document requirement "${values.name}" added and notification sent to employee!`);
            addDocForm.resetFields();
            setAddDocModalOpen(false);
            qc.invalidateQueries({ queryKey: ["employees"] });
          }}
        >
          <Form.Item name="name" label="Document Name / Title" rules={[{ required: true, message: "Document name required" }]}>
            <Input placeholder="e.g. Relieving Letter, Medical Certificate, Experience Certificate" />
          </Form.Item>
          <Form.Item name="description" label="Instructions / Description">
            <Input.TextArea rows={2} placeholder="Optional instructions for employee" />
          </Form.Item>
          <Form.Item name="required" valuePropName="checked" initialValue={true}>
            <Checkbox>Mark as Mandatory Requirement</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* Policy Details View Modal (Full PDF View) */}
      <Modal
        title={viewPolicyModal ? <span><FileProtectOutlined style={{ marginRight: 8, color: "var(--bms-primary)" }} />{viewPolicyModal.policy.title}</span> : ""}
        open={!!viewPolicyModal}
        onCancel={() => setViewPolicyModal(null)}
        footer={[
          <Button key="close" onClick={() => setViewPolicyModal(null)}>Close</Button>,
          viewPolicyModal?.policy?.fileUrl ? (
            <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => window.open(viewPolicyModal.policy.fileUrl, "_blank")}>
              Download PDF
            </Button>
          ) : null,
        ]}
        width={780}
      >
        {viewPolicyModal && (
          <div style={{ background: "#ffffff", border: "1px solid var(--bms-border)", borderRadius: 10, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            {/* Policy Document Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {viewPolicyModal.policy.version && <Tag color="blue" style={{ fontSize: 12 }}>{viewPolicyModal.policy.version}</Tag>}
                {viewPolicyModal.policy.effectiveDate && <Text type="secondary" style={{ fontSize: 12 }}>Effective Date: {viewPolicyModal.policy.effectiveDate}</Text>}
              </div>
              <Tag color={viewPolicyModal.isAcked ? "success" : "warning"} style={{ fontSize: 12, fontWeight: 600 }}>
                {viewPolicyModal.isAcked ? "✓ ACKNOWLEDGED" : "PENDING ACKNOWLEDGMENT"}
              </Tag>
            </div>
            {viewPolicyModal.policy.description && (
              <Paragraph style={{ fontSize: 13, color: "var(--bms-text)", marginBottom: 16 }}>
                {viewPolicyModal.policy.description}
              </Paragraph>
            )}

            {/* Policy Content & Guidelines with Acknowledged By Signature Block INSIDE the page at the bottom */}
            <div style={{
              padding: 18,
              background: "#ffffff",
              border: "1px solid var(--bms-border)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--bms-text)",
              lineHeight: 1.6,
              maxHeight: 520,
              overflowY: "auto",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.02)",
            }}>
              {viewPolicyModal.policy.fileUrl ? (
                <iframe
                  src={viewPolicyModal.policy.fileUrl}
                  style={{ width: "100%", height: 380, border: "1px solid var(--bms-border)", borderRadius: 6, background: "#fff", marginBottom: 16 }}
                  title={viewPolicyModal.policy.title}
                />
              ) : (
                <div style={{ whiteSpace: "pre-wrap", marginBottom: 20, fontSize: 13, color: "var(--bms-text)" }}>
                  {viewPolicyModal.policy.content || viewPolicyModal.policy.description || "Official company policy document guidelines and code of conduct rules."}
                </div>
              )}

              {/* Signature & Acknowledged By Block INSIDE the policy page text at the bottom */}
              <div style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: `2px dashed ${viewPolicyModal.isAcked ? "#059669" : "#d97706"}`,
                background: viewPolicyModal.isAcked ? "#f0fdf4" : "#fffbeb",
                border: `1px solid ${viewPolicyModal.isAcked ? "#a7f3d0" : "#fde68a"}`,
                borderRadius: 8,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {viewPolicyModal.isAcked ? (
                    <CheckCircleOutlined style={{ color: "#059669", fontSize: 26 }} />
                  ) : (
                    <ClockCircleOutlined style={{ color: "#d97706", fontSize: 26 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: viewPolicyModal.isAcked ? "#047857" : "#b45309" }}>
                      Digital Policy Signature & Acknowledgment
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: viewPolicyModal.isAcked ? "#065f46" : "#92400e" }}>
                      {viewPolicyModal.isAcked
                        ? `✓ Acknowledged by ${emp.full_name ? `${emp.full_name} (@${emp.username || emp.employee_code})` : emp.username}`
                        : `⏳ Pending Acknowledgment by ${emp.full_name ? `${emp.full_name} (@${emp.username || emp.employee_code})` : emp.username}`}
                    </div>
                    {viewPolicyModal.isAcked && viewPolicyModal.ackDate && (
                      <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>
                        Signed Timestamp: {viewPolicyModal.ackDate}
                      </div>
                    )}
                  </div>
                </div>
                <Tag color={viewPolicyModal.isAcked ? "success" : "warning"} style={{ fontSize: 11, padding: "4px 10px", fontWeight: 600 }}>
                  {viewPolicyModal.isAcked ? "VERIFIED ACKNOWLEDGMENT" : "PENDING"}
                </Tag>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hire New Person Drawer (re-uses EmployeesPage form pattern)
// ─────────────────────────────────────────────────────────────────────────────
function HireNewPersonDrawer({ open, onClose, allEmployees }: { open: boolean; onClose: () => void; allEmployees: Employee[] }) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const shiftApplicable = Form.useWatch("shift_applicable", form);
  const shiftType = Form.useWatch("shift_type", form);

  const { data: designations = [] } = useQuery({ queryKey: ["dd", "designations"], queryFn: () => designationApi.dropdown(), staleTime: 60_000 });
  const { data: departments = [] }  = useQuery({ queryKey: ["dd", "departments"],  queryFn: () => departmentApi.dropdown(),  staleTime: 60_000 });
  const { data: locations = [] }    = useQuery({ queryKey: ["dd", "locations"],    queryFn: () => locationApi.dropdown(),    staleTime: 60_000 });
  const { data: empTypes = [] }     = useQuery({ queryKey: ["dd", "emp-types"],    queryFn: () => employmentTypeApi.dropdown(), staleTime: 60_000 });
  const { data: kcGroups = [] }     = useQuery({ queryKey: ["dd", "kc-groups"],    queryFn: () => employeeGroupApi.list(),   staleTime: 300_000 });
  const { data: shiftCats = [] }    = useQuery({ queryKey: ["dd", "shift-cats"],   queryFn: () => shiftCategoryApi.dropdown(), staleTime: 60_000 });

  const createMut = useMutation({
    mutationFn: (v: any) => employeeApi.create(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-simple-dropdown"] });
      message.success("Employee created and onboarding initiated");
      form.resetFields();
      onClose();
    },
    onError: (e: any) => message.error(apiErrorMsg(e, "Failed to create employee")),
  });

  const recalcTotalExp = () => {
    const jd: dayjs.Dayjs | undefined = form.getFieldValue("joining_date");
    const prior = parseFloat(form.getFieldValue("prior_experience") ?? 0) || 0;
    if (jd) form.setFieldsValue({ total_experience: parseFloat((dayjs().diff(jd, "day") / 365 + prior).toFixed(1)) });
  };

  const onFinish = (values: any) => {
    const groupFlags = values.keycloak_group ? resolveGroupFlags(values.keycloak_group) : {};
    const mgrId = values.manager;
    const assignedMgr = mgrId ? (allEmployees || []).find((e) => e.id === mgrId) : null;

    createMut.mutate(
      {
        ...values,
        ...groupFlags,
        joining_date:       values.joining_date       ? dayjs(values.joining_date).format("YYYY-MM-DD") : null,
        date_of_birth:      values.date_of_birth      ? dayjs(values.date_of_birth).format("YYYY-MM-DD") : null,
        custom_shift_start: values.custom_shift_start ? dayjs(values.custom_shift_start).format("HH:mm:ss") : null,
        custom_shift_end:   values.custom_shift_end   ? dayjs(values.custom_shift_end).format("HH:mm:ss") : null,
        shift_category:     values.shift_type === "category" ? values.shift_category : null,
        total_experience:   values.total_experience ?? null,
      },
      {
        onSuccess: () => {
          if (assignedMgr) {
            addLocalNotification({
              event_type: "onboarding.hired_assigned",
              title: "New Employee Onboarding Assigned",
              message: `A new employee ${values.first_name || ""} ${values.last_name || ""} has been hired and assigned to you as reporting manager.`,
              action_url: "/onboarding",
              targetUsername: assignedMgr.username,
            });
          }
        },
      }
    );
  };

  const dd  = (arr: any[]) => arr.map((d) => ({ value: d.id, label: d.name }));
  const ff  = (input: string, opt: any) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase());
  const sec = (label: string) => (
    <><Typography.Text strong style={{ fontSize: 13, color: "var(--bms-text-3)" }}>{label}</Typography.Text><Divider style={{ margin: "8px 0 16px" }} /></>
  );

  return (
    <Drawer
      title={<span><UserAddOutlined style={{ marginRight: 8 }} />Hire New Person</span>}
      open={open}
      onClose={() => { form.resetFields(); onClose(); }}
      width={700}
      destroyOnHidden
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={() => { form.resetFields(); onClose(); }}>Cancel</Button>
          <Button type="primary" loading={createMut.isPending} onClick={() => form.submit()} icon={<UserAddOutlined />}>
            Hire & Start Onboarding
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={(c) => { if ("joining_date" in c || "prior_experience" in c) recalcTotalExp(); }}>
        {sec("Role")}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="keycloak_group" label="Role" rules={[{ required: true }]}>
              <Select showSearch allowClear placeholder="Select role" options={(kcGroups as string[]).map((g) => ({ value: g, label: g }))} filterOption={ff as any} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="manager" label="Reporting Manager">
              <Select showSearch allowClear placeholder="Select manager" filterOption={ff}
                options={(allEmployees).map((e) => ({ value: e.id, label: `${e.full_name} (${e.employee_code})` }))} />
            </Form.Item>
          </Col>
        </Row>
        {sec("Personal Information")}
        <Row gutter={16}>
          <Col span={12}><Form.Item name="first_name" label="First Name" rules={[{ required: true, message: "First name is required" }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="last_name" label="Last Name" rules={[{ required: true, message: "Last name is required" }]}><Input placeholder="Last Name" /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Email is required" }]}><Input prefix={<MailOutlined />} /></Form.Item></Col>
          <Col span={12}>
            <Form.Item name="phone_number" label="Phone" rules={[{ required: true, message: "Phone number is required" }, ...phoneFormRules({ label: "Phone number" })]}>
              <PhoneInput />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="alternative_number" label="Alternative Number" rules={phoneFormRules({ label: "Alternative number" })}>
              <PhoneInput />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="gender" label="Gender">
              <Select allowClear options={[{ value: "M", label: "Male" }, { value: "F", label: "Female" }, { value: "O", label: "Other" }]} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="date_of_birth" label="Date of Birth" rules={[{ required: true, message: "Date of birth is required" }]}>
              <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
        {sec("Employment Details")}
        <Row gutter={16}>
          <Col span={12}><Form.Item name="designation_ref" label="Designation"><Select showSearch allowClear options={dd(designations as any[])} filterOption={ff} /></Form.Item></Col>
          <Col span={12}><Form.Item name="department_ref" label="Department"><Select showSearch allowClear options={dd(departments as any[])} filterOption={ff} /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="location" label="Branch / Location"><Select showSearch allowClear options={dd(locations as any[])} filterOption={ff} /></Form.Item></Col>
          <Col span={12}><Form.Item name="employment_type" label="Employment Type"><Select showSearch allowClear options={dd(empTypes as any[])} filterOption={ff} /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="joining_date" label="Date of Joining"><DatePicker style={{ width: "100%" }} format="DD MMM YYYY" /></Form.Item></Col>
          <Col span={12}><Form.Item name="status" label="Status" initialValue="ACTIVE"><Select options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="prior_experience" label="Prior Experience (yrs)"><InputNumber style={{ width: "100%" }} min={0} precision={1} /></Form.Item></Col>
          <Col span={12}><Form.Item name="total_experience" label="Total Experience (yrs)"><InputNumber style={{ width: "100%", background: "var(--bms-surface-2)" }} disabled /></Form.Item></Col>
        </Row>
        {sec("Shift")}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="shift_applicable" label="Shift Applicable" rules={[{ required: true, message: "Shift applicable selection is required" }]}>
              <Select placeholder="Select Yes / No" options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />
            </Form.Item>
          </Col>
          {shiftApplicable && (
            <Col span={12}>
              <Form.Item name="shift_type" label="Shift Type" initialValue="category">
                <Select options={[{ value: "category", label: "From Master (predefined)" }, { value: "custom", label: "Custom timing" }]} />
              </Form.Item>
            </Col>
          )}
        </Row>
        {shiftApplicable && shiftType === "category" && (
          <Form.Item name="shift_category" label="Shift Category">
            <Select showSearch placeholder="Select shift"
              options={(shiftCats as any[]).map((s) => ({ value: s.id, label: `${s.name} (${s.start_time?.slice(0,5)} – ${s.end_time?.slice(0,5)})` }))}
              filterOption={ff} />
          </Form.Item>
        )}
        {shiftApplicable && shiftType === "custom" && (
          <Row gutter={16}>
            <Col span={12}><Form.Item name="custom_shift_start" label="Shift Start"><TimePicker format="HH:mm" style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="custom_shift_end" label="Shift End" rules={[{ validator: (_, val) => { const s = form.getFieldValue("custom_shift_start"); if (!val || !s) return Promise.resolve(); let e = dayjs(val); if (e.isBefore(dayjs(s))) e = e.add(1, "day"); return Math.abs(e.diff(dayjs(s), "minute") - 540) > 1 ? Promise.reject("Must be 9 hours") : Promise.resolve(); } }]}>
                <TimePicker format="HH:mm" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        )}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="wfh_allowed" label="WFH Allowed" rules={[{ required: true, message: "WFH allowed selection is required" }]}>
              <Select placeholder="Select Yes / No" options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Send Reminder Modal
// ─────────────────────────────────────────────────────────────────────────────
function SendReminderModal({
  open, onClose, employees, onboardingMap,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  onboardingMap: Map<string, ReturnType<typeof getOnboardingStatus>>;
}) {
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<Set<string>>(new Set());

  const incomplete = employees.filter((e) => {
    const s = onboardingMap.get(e.id);
    return s && (!s.personalInfo || !s.bankDetails || !s.docsVerified);
  });

  const handleSend = (empId: string, email: string) => {
    const targetEmp = employees.find((e) => e.id === empId);
    setSending((prev) => new Set(prev).add(empId));

    addLocalNotification({
      event_type: "onboarding.reminder",
      title: "Onboarding Action Required",
      message: "HR has sent you a reminder to complete your onboarding details (Personal Info, Bank Details, or Documents).",
      action_url: "/employee-onboarding",
      targetUsername: targetEmp?.username,
    });

    setTimeout(() => {
      setSending((prev) => { const n = new Set(prev); n.delete(empId); return n; });
      setSent((prev) => new Set(prev).add(empId));
      message.success(`Reminder notification sent to ${targetEmp?.full_name || targetEmp?.username || email}`);
    }, 600);
  };

  const handleSendAll = () => {
    incomplete.forEach((e) => {
      if (!sent.has(e.id)) handleSend(e.id, e.email);
    });
  };

  return (
    <Modal
      title={<span><BellOutlined style={{ marginRight: 8 }} />Send Onboarding Reminders</span>}
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={handleSendAll}
            disabled={incomplete.every((e) => sent.has(e.id))}>
            Send All Reminders ({incomplete.length - sent.size})
          </Button>
        </div>
      }
      width={680}
    >
      <Text style={{ color: "var(--bms-text-3)", display: "block", marginBottom: 16 }}>
        The following employees have incomplete onboarding. Send them a reminder notification.
      </Text>
      {incomplete.length === 0 ? (
        <Empty description="All employees have completed onboarding 🎉" />
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {incomplete.map((emp) => {
            const s = onboardingMap.get(emp.id)!;
            const av = avatarPastel(emp.full_name || emp.username);
            return (
              <div key={emp.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                background: "var(--bms-surface-2)", border: "1px solid var(--bms-border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar size={32} style={{ background: av.bg, color: av.text, fontWeight: 600, fontSize: 12, border: `1px solid ${av.border}` }}>
                    {initials(emp.full_name || emp.username)}
                  </Avatar>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>{toTitleCase(emp.full_name || emp.username)}</div>
                    <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{emp.email}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <OnboardingStatusBadge status={s.status} />
                  {sent.has(emp.id) ? (
                    <Tag color="success" style={{ fontSize: 11 }}>Sent ✓</Tag>
                  ) : (
                    <Button size="small" type="primary" icon={<SendOutlined />}
                      loading={sending.has(emp.id)}
                      onClick={() => handleSend(emp.id, emp.email)}>
                      Remind
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee Facilities Modal
// ─────────────────────────────────────────────────────────────────────────────
function EmployeeFacilitiesModal({
  open, onClose, employees,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
}) {
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "asset" | "facility" | "digital">("all");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [empAssets, setEmpAssets] = useState<EmployeeAsset[]>([]);

  const reload = useCallback(() => {
    setInventory(itAssetStore.getInventory());
    if (selectedEmp) {
      setEmpAssets(itAssetStore.getEmployeeAssets(selectedEmp.id));
    }
  }, [selectedEmp]);

  useEffect(() => {
    if (open) reload();
    return itAssetStore.subscribe(reload);
  }, [open, reload]);

  // Search employee by name, code, department, email
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(
      (emp) =>
        (emp.full_name || emp.username || "").toLowerCase().includes(q) ||
        (emp.employee_code || "").toLowerCase().includes(q) ||
        (emp.department_name || "").toLowerCase().includes(q) ||
        (emp.email || "").toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // Display only assigned assets & facilities for selected employee
  const displayAssigned = useMemo(() => {
    if (filterType === "all") return empAssets;
    return empAssets.filter((a) => a.kind === filterType);
  }, [empAssets, filterType]);

  const handleRevoke = (ea: EmployeeAsset) => {
    itAssetStore.revokeAsset(ea.id);
    message.success(`${ea.itemName} (${ea.assetCode}) revoked`);
    reload();
  };

  const handleAssignNewItem = () => {
    if (!selectedEmp || !selectedInventoryItem) return;
    const item = inventory.find((i) => i.id === selectedInventoryItem);
    if (!item) return;

    if (item.availableStock <= 0) {
      message.error(`${item.name} is out of stock`);
      return;
    }

    const res = itAssetStore.assignAsset({
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.full_name || selectedEmp.username,
      inventoryItemId: item.id,
      itemName: item.name,
      category: item.category,
      kind: item.kind,
    });

    if (res) {
      message.success(`Assigned ${item.name} (${res.assetCode}) to ${selectedEmp.full_name || selectedEmp.username}`);
      setAssignModalOpen(false);
      setSelectedInventoryItem(null);
      reload();
    } else {
      message.error("Failed to assign item");
    }
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <DesktopOutlined style={{ color: "var(--bms-primary)" }} />
            <span>Employee Facilities & Assets</span>
          </Space>
        }
        open={open}
        onCancel={() => {
          setSelectedEmp(null);
          setSearchQuery("");
          onClose();
        }}
        footer={null}
        width={780}
      >
        {selectedEmp ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={() => setSelectedEmp(null)}
                style={{ color: "var(--bms-text-3)" }}
              >
                Back to Employee List
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setAssignModalOpen(true)}
              >
                Assign Asset / Facility
              </Button>
            </div>

            <Card size="small" style={{ borderRadius: 10, background: "var(--bms-surface-2)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar
                  size={44}
                  style={{
                    background: avatarPastel(selectedEmp.full_name || selectedEmp.username).bg,
                    color: avatarPastel(selectedEmp.full_name || selectedEmp.username).text,
                    fontWeight: 700,
                  }}
                >
                  {initials(selectedEmp.full_name || selectedEmp.username)}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--bms-text)" }}>
                    {toTitleCase(selectedEmp.full_name || selectedEmp.username)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
                    {toTitleCase(selectedEmp.department_name)} · Code: {selectedEmp.employee_code}
                  </div>
                </div>
                <Space>
                  <Tag color="blue">{empAssets.filter((a) => a.kind === "asset").length} IT Assets</Tag>
                  <Tag color="purple">{empAssets.filter((a) => a.kind === "facility").length} Facilities</Tag>
                  <Tag color="green">{empAssets.filter((a) => a.kind === "digital").length} Digital</Tag>
                </Space>
              </div>
            </Card>

            {/* Filter buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <Button
                size="small"
                type={filterType === "all" ? "primary" : "default"}
                onClick={() => setFilterType("all")}
                style={{ borderRadius: 6 }}
              >
                All Assigned ({empAssets.length})
              </Button>
              <Button
                size="small"
                type={filterType === "asset" ? "primary" : "default"}
                onClick={() => setFilterType("asset")}
                style={{ borderRadius: 6 }}
              >
                IT Assets ({empAssets.filter((a) => a.kind === "asset").length})
              </Button>
              <Button
                size="small"
                type={filterType === "facility" ? "primary" : "default"}
                onClick={() => setFilterType("facility")}
                style={{ borderRadius: 6 }}
              >
                Facilities ({empAssets.filter((a) => a.kind === "facility").length})
              </Button>
              <Button
                size="small"
                type={filterType === "digital" ? "primary" : "default"}
                onClick={() => setFilterType("digital")}
                style={{ borderRadius: 6 }}
              >
                Digital Assets ({empAssets.filter((a) => a.kind === "digital").length})
              </Button>
            </div>

            {/* Display ONLY assigned assets and facilities data */}
            <div style={{ maxHeight: 440, overflowY: "auto" }}>
              {displayAssigned.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      No assigned {filterType === "all" ? "assets or facilities" : filterType === "asset" ? "IT assets" : filterType === "facility" ? "facilities" : "digital assets"} data found for this employee.
                    </Text>
                  }
                />
              ) : (
                displayAssigned.map((ast) => (
                  <Card key={ast.id} size="small" style={{ borderRadius: 8, marginBottom: 8, background: "var(--bms-surface-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {ast.kind === "asset" ? (
                          <DesktopOutlined style={{ fontSize: 24, color: "#3b82f6" }} />
                        ) : ast.kind === "facility" ? (
                          <HomeOutlined style={{ fontSize: 24, color: "#8b5cf6" }} />
                        ) : (
                          <ThunderboltOutlined style={{ fontSize: 24, color: "#10b981" }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                            {ast.itemName}
                            <Tag color="blue" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                              Unique ID: {ast.assetCode}
                            </Tag>
                            <Tag color={ast.kind === "asset" ? "blue" : "purple"} style={{ fontSize: 10, margin: 0 }}>
                              {ast.kind === "asset" ? "IT Asset" : "Facility"}
                            </Tag>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--bms-text-3)", marginTop: 2 }}>
                            Category: {ast.category} · Assigned Date: {ast.assignedDate} · Condition: {ast.condition}
                          </div>
                        </div>
                      </div>

                      <Popconfirm
                        title="Revoke Assignment"
                        description={`Are you sure you want to revoke ${ast.itemName} (${ast.assetCode})?`}
                        onConfirm={() => handleRevoke(ast)}
                        okText="Yes, Revoke"
                        cancelText="Cancel"
                      >
                        <Button size="small" danger icon={<CloseOutlined />}>
                          Revoke
                        </Button>
                      </Popconfirm>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Employee Search Bar */}
            <Input
              prefix={<SearchOutlined style={{ color: "var(--bms-text-3)" }} />}
              placeholder="Search employee by name, code, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              style={{ marginBottom: 16, borderRadius: 8 }}
            />

            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {filteredEmployees.length === 0 ? (
                <Empty description="No matching employees found" style={{ padding: "32px 0" }} />
              ) : (
                filteredEmployees.map((emp) => {
                  const av = avatarPastel(emp.full_name || emp.username);
                  const assignedCount = itAssetStore.getEmployeeAssets(emp.id).length;
                  return (
                    <div
                      key={emp.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        marginBottom: 8,
                        borderRadius: 8,
                        cursor: "pointer",
                        background: "var(--bms-surface-2)",
                        border: "1px solid var(--bms-border)",
                        transition: "all 0.15s",
                      }}
                      onClick={() => setSelectedEmp(emp)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bms-primary-light)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bms-surface-2)")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar
                          size={38}
                          style={{
                            background: av.bg,
                            color: av.text,
                            fontWeight: 700,
                            fontSize: 13,
                            border: `1px solid ${av.border}`,
                          }}
                        >
                          {initials(emp.full_name || emp.username)}
                        </Avatar>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)" }}>
                            {toTitleCase(emp.full_name || emp.username)}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
                            {toTitleCase(emp.department_name)} · Code: {emp.employee_code}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Tag color={assignedCount > 0 ? "blue" : "default"}>
                          {assignedCount} Assigned
                        </Tag>
                        <RightOutlined style={{ color: "var(--bms-text-3)" }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Asset Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            <span>Assign Asset / Facility to {selectedEmp ? (selectedEmp.full_name || selectedEmp.username) : ""}</span>
          </Space>
        }
        open={assignModalOpen}
        onOk={handleAssignNewItem}
        onCancel={() => {
          setAssignModalOpen(false);
          setSelectedInventoryItem(null);
        }}
        okText="Assign Now"
        width={460}
      >
        <div style={{ marginTop: 12, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: 600 }}>Select Inventory Item to Assign:</Text>
          <Select
            style={{ width: "100%", marginTop: 8 }}
            placeholder="Choose an available asset or facility..."
            value={selectedInventoryItem}
            onChange={(val) => setSelectedInventoryItem(val)}
            options={inventory
              .filter((i) => i.availableStock > 0)
              .map((item) => ({
                value: item.id,
                label: `${item.name} (${item.itemCode}) — ${item.category} (${item.availableStock} available)`,
              }))}
          />
          {inventory.filter((i) => i.availableStock > 0).length === 0 && (
            <Alert
              type="warning"
              showIcon
              message="No available inventory stock. Please add items in IT Asset Dashboard first."
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assets & Facilities Tab Component (with toggle buttons)
// ─────────────────────────────────────────────────────────────────────────────
function AssetsAndFacilitiesTab({
  emp, inventory, empAssets, requests,
  requestModalOpen, requestItem, requestNote, requestLoading,
  setRequestItem, setRequestModalOpen, setRequestNote, handleRequest,
}: {
  emp: Employee;
  inventory: any[];
  empAssets: any[];
  requests: any[];
  requestModalOpen: boolean;
  requestItem: any;
  requestNote: string;
  requestLoading: boolean;
  setRequestItem: (i: any) => void;
  setRequestModalOpen: (v: boolean) => void;
  setRequestNote: (v: string) => void;
  handleRequest: () => void;
}) {
  const [activeSection, setActiveSection] = useState<"assets" | "facilities" | "digital" | null>(null);

  const assetItems = inventory.filter((i) => i.kind === "asset");
  const facilityItems = inventory.filter((i) => i.kind === "facility");
  const digitalItems = inventory.filter((i) => i.kind === "digital");

  const renderItem = (item: any, kindColor: string) => {
    const assigned = empAssets.some((a) => a.inventoryItemId === item.id);
    const latestReq = requests.filter((r) => r.inventoryItemId === item.id)
      .sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
    const hasPending = !!(latestReq && (latestReq.status === "pending" || latestReq.status === "approved" || latestReq.status === "refill_needed"));
    const ea = empAssets.find((a) => a.inventoryItemId === item.id);
    const outOfStock = item.availableStock === 0 && item.totalStock < 999;

    return (
      <div
        key={item.id}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", borderRadius: 8, marginBottom: 8,
          border: "1px solid var(--bms-border)",
          background: assigned
            ? "color-mix(in srgb, #10b981 8%, var(--bms-surface))"
            : hasPending
            ? "color-mix(in srgb, #f59e0b 8%, var(--bms-surface))"
            : "var(--bms-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Checkbox
            checked={assigned}
            disabled={hasPending}
            onChange={() => {
              if (assigned && ea) {
                itAssetStore.revokeAsset(ea.id);
                message.success(`${item.name} revoked`);
              } else {
                if (outOfStock) {
                  setRequestItem(item);
                  setRequestModalOpen(true);
                } else {
                  const res = itAssetStore.assignAsset({
                    employeeId: emp.id,
                    employeeName: emp.full_name || emp.username,
                    inventoryItemId: item.id,
                    itemName: item.name,
                    category: item.category,
                    kind: item.kind,
                  });
                  if (res) {
                    message.success(`${item.name} assigned to ${emp.full_name || emp.username}`);
                  } else {
                    message.error("Failed to assign — no stock available");
                  }
                }
              }
            }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)", display: "flex", alignItems: "center", gap: 6 }}>
              {item.name}
              <Tag color="blue" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>ID: {item.itemCode}</Tag>
              {ea && <Text code style={{ fontSize: 10 }}>Assigned: {ea.assetCode}</Text>}
            </div>
            <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>
              {item.description || item.category}
              {outOfStock && !assigned && !hasPending && (
                <Tag color="red" style={{ marginLeft: 6, fontSize: 10 }}>Out of Stock</Tag>
              )}
              {item.availableStock > 0 && item.totalStock < 999 && !assigned && (
                <Tag color="green" style={{ marginLeft: 6, fontSize: 10 }}>{item.availableStock} available</Tag>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {assigned && <Tag color="green" style={{ margin: 0 }}>Assigned</Tag>}
          {latestReq && (
            <Tag color={latestReq.status === "pending" ? "orange" : latestReq.status === "approved" ? "blue" : latestReq.status === "fulfilled" ? "green" : "red"} style={{ margin: 0 }}>
              {latestReq.status.charAt(0).toUpperCase() + latestReq.status.slice(1)}
            </Tag>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Toggle Buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Button
          type={activeSection === "assets" ? "primary" : "default"}
          icon={<DesktopOutlined />}
          onClick={() => setActiveSection(activeSection === "assets" ? null : "assets")}
          style={{
            borderRadius: 8,
            fontWeight: 600,
            ...(activeSection === "assets" ? {} : { borderColor: "#3b82f6", color: "#3b82f6" }),
          }}
        >
          IT Assets
          {assetItems.length > 0 && (
            <span style={{
              marginLeft: 6, background: activeSection === "assets" ? "rgba(255,255,255,0.25)" : "#3b82f6",
              color: activeSection === "assets" ? "#fff" : "#fff",
              borderRadius: 10, padding: "0 6px", fontSize: 11, fontWeight: 700,
            }}>{assetItems.length}</span>
          )}
        </Button>
        <Button
          type={activeSection === "facilities" ? "primary" : "default"}
          icon={<HomeOutlined />}
          onClick={() => setActiveSection(activeSection === "facilities" ? null : "facilities")}
          style={{
            borderRadius: 8,
            fontWeight: 600,
            ...(activeSection === "facilities" ? { background: "#8b5cf6", borderColor: "#8b5cf6" } : { borderColor: "#8b5cf6", color: "#8b5cf6" }),
          }}
        >
          Facilities
          {facilityItems.length > 0 && (
            <span style={{
              marginLeft: 6, background: activeSection === "facilities" ? "rgba(255,255,255,0.25)" : "#8b5cf6",
              color: "#fff",
              borderRadius: 10, padding: "0 6px", fontSize: 11, fontWeight: 700,
            }}>{facilityItems.length}</span>
          )}
        </Button>
        <Button
          type={activeSection === "digital" ? "primary" : "default"}
          icon={<ThunderboltOutlined />}
          onClick={() => setActiveSection(activeSection === "digital" ? null : "digital")}
          style={{
            borderRadius: 8,
            fontWeight: 600,
            ...(activeSection === "digital" ? { background: "#10b981", borderColor: "#10b981" } : { borderColor: "#10b981", color: "#10b981" }),
          }}
        >
          Digital Assets
          {digitalItems.length > 0 && (
            <span style={{
              marginLeft: 6, background: activeSection === "digital" ? "rgba(255,255,255,0.25)" : "#10b981",
              color: "#fff",
              borderRadius: 10, padding: "0 6px", fontSize: 11, fontWeight: 700,
            }}>{digitalItems.length}</span>
          )}
        </Button>
      </div>

      {/* Content area */}
      {activeSection === null && (
        <div style={{
          textAlign: "center", padding: "32px 0",
          color: "var(--bms-text-3)", fontSize: 13,
        }}>
          <LaptopOutlined style={{ fontSize: 32, marginBottom: 10, display: "block", color: "var(--bms-border)" }} />
          Select <strong>IT Assets</strong>, <strong>Facilities</strong>, or <strong>Digital Assets</strong> above to view and assign items.
        </div>
      )}

      {activeSection === "assets" && (
        <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 2 }}>
          {assetItems.length === 0 ? (
            <Empty description="No IT assets in inventory" style={{ padding: "32px 0" }} />
          ) : (
            assetItems.map((item) => renderItem(item, "#3b82f6"))
          )}
        </div>
      )}

      {activeSection === "facilities" && (
        <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 2 }}>
          {facilityItems.length === 0 ? (
            <Empty description="No facilities in inventory" style={{ padding: "32px 0" }} />
          ) : (
            facilityItems.map((item) => renderItem(item, "#8b5cf6"))
          )}
        </div>
      )}

      {activeSection === "digital" && (
        <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 2 }}>
          {digitalItems.length === 0 ? (
            <Empty description="No digital assets in inventory" style={{ padding: "32px 0" }} />
          ) : (
            digitalItems.map((item) => renderItem(item, "#10b981"))
          )}
        </div>
      )}

      <Modal
        title={<Space><InboxOutlined />Request Asset — {requestItem?.name}</Space>}
        open={requestModalOpen}
        onOk={handleRequest}
        onCancel={() => { setRequestModalOpen(false); setRequestItem(null); setRequestNote(""); }}
        confirmLoading={requestLoading}
        okText="Send Request"
        width={420}
      >
        <div style={{
          padding: "12px 16px", borderRadius: 8, background: "var(--bms-surface-2)",
          marginBottom: 16, border: "1px solid var(--bms-border)",
        }}>
          <Tag color="red">Out of Stock</Tag>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            This item is currently unavailable. Your request will be sent to the IT Asset Admin who will refill stock and fulfill it.
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 13 }}>Notes (optional)</Text>
        </div>
        <Input.TextArea
          rows={3}
          placeholder="Any additional notes for the IT Asset Admin..."
          value={requestNote}
          onChange={(e) => setRequestNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding Report Modal (with Recharts graphs)
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingReportModal({
  open, onClose, employees, onboardingMap,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  onboardingMap: Map<string, ReturnType<typeof getOnboardingStatus>>;
}) {
  const total = employees.length;
  const complete = employees.filter((e) => onboardingMap.get(e.id)?.status === "complete").length;
  const inProgress = employees.filter((e) => onboardingMap.get(e.id)?.status === "in_progress").length;
  const atRisk = employees.filter((e) => onboardingMap.get(e.id)?.status === "at_risk").length;
  const withPersonalInfo = employees.filter((e) => onboardingMap.get(e.id)?.personalInfo).length;
  const withBankDetails = employees.filter((e) => onboardingMap.get(e.id)?.bankDetails).length;
  const withPolicyAck = employees.filter((e) => onboardingMap.get(e.id)?.policyAck).length;
  const withDocsVerified = employees.filter((e) => onboardingMap.get(e.id)?.docsVerified).length;

  // Pie chart data for onboarding status distribution
  const pieData = [
    { name: "Complete", value: complete, color: "#059669" },
    { name: "In Progress", value: inProgress, color: "#d97706" },
    { name: "At Risk", value: atRisk, color: "#dc2626" },
  ].filter((d) => d.value > 0);

  // Bar chart data for completion breakdown
  const barData = [
    { name: "Personal Info", completed: withPersonalInfo, pending: total - withPersonalInfo },
    { name: "Bank Details", completed: withBankDetails, pending: total - withBankDetails },
    { name: "Policy Ack.", completed: withPolicyAck, pending: total - withPolicyAck },
    { name: "Docs Verified", completed: withDocsVerified, pending: total - withDocsVerified },
  ];

  const statCard = (label: string, value: number, color: string, bg: string) => (
    <div style={{
      flex: 1, textAlign: "center", padding: "14px 10px",
      background: bg, borderRadius: 10, border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--bms-text-3)", marginTop: 4 }}>{label}</div>
    </div>
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: "var(--bms-surface)", border: "1px solid var(--bms-border)",
        borderRadius: 8, padding: "10px 14px", boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: "var(--bms-text)", marginBottom: 6 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ fontSize: 12, color: p.color, marginBottom: 2 }}>
            {p.name}: <strong>{p.value}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal
      title={<span><BarChartOutlined style={{ marginRight: 8 }} />Onboarding Report</span>}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={760}
    >
      {/* Stat cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {statCard("Total", total, "#1a73e8", "var(--bms-primary-light)")}
        {statCard("Complete", complete, "#059669", "#ecfdf5")}
        {statCard("In Progress", inProgress, "#d97706", "#fffbeb")}
        {statCard("At Risk", atRisk, "#dc2626", "#fef2f2")}
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Bar Chart — Completion Breakdown */}
        <div style={{ flex: 2 }}>
          <Text strong style={{ fontSize: 13, color: "var(--bms-text)", display: "block", marginBottom: 12 }}>Completion Breakdown</Text>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bms-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--bms-text-3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--bms-text-3)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--bms-text-3)" }} />
              <Bar dataKey="completed" name="Completed" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" name="Pending" fill="var(--bms-border)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart — Status Distribution */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ fontSize: 13, color: "var(--bms-text)", display: "block", marginBottom: 12 }}>Status Distribution</Text>
          {pieData.length === 0 ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bms-text-3)", fontSize: 12 }}>
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    background: "var(--bms-surface)", border: "1px solid var(--bms-border)",
                    borderRadius: 8, fontSize: 12,
                  }}
                  formatter={(value: any, name: any) => [value, name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "var(--bms-text-3)" }}
                  formatter={(value) => <span style={{ color: "var(--bms-text-3)" }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks Section
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingTasksPanel({ employees }: { employees: Employee[] }) {
  const [assignVisible, setAssignVisible] = useState(false);
  const [form] = Form.useForm();
  const [storeVer, setStoreVer] = useState(0);

  useEffect(() => {
    const handler = () => setStoreVer((v) => v + 1);
    window.addEventListener("nexus-task-schedule-updated", handler);
    return () => window.removeEventListener("nexus-task-schedule-updated", handler);
  }, []);

  // Aggregate all tasks across all employees (flattened) — only real HR-assigned tasks
  const allTasks = useMemo(() => {
    return employees.flatMap((emp) =>
      onboardingTaskScheduleStore.getTasks(emp).map((t) => ({ ...t, empName: toTitleCase(emp.full_name || emp.username), empId: emp.id }))
    );
  }, [employees, storeVer]);

  const statusCfg = {
    done:        { color: "success" as const, label: "Done" },
    in_progress: { color: "processing" as const, label: "In Progress" },
    pending:     { color: "default" as const, label: "Pending" },
  };

  const columns = [
    {
      title: "Employee",
      key: "emp",
      width: 180,
      render: (_: any, r: any) => {
        const emp = employees.find((e) => e.id === r.empId);
        if (!emp) return r.empName;
        const av = avatarPastel(emp.full_name || emp.username);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar size={28} style={{ background: av.bg, color: av.text, fontWeight: 700, fontSize: 11, border: `1px solid ${av.border}` }}>
              {initials(emp.full_name || emp.username)}
            </Avatar>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--bms-text)" }}>{r.empName}</span>
          </div>
        );
      },
    },
    { title: "Task", dataIndex: "title", key: "title", render: (v: string) => <span style={{ fontSize: 13, color: "var(--bms-text)" }}>{v}</span> },
    { title: "Due Date", dataIndex: "dueDate", key: "due", width: 120, render: (v: string) => <span style={{ fontSize: 12, color: "var(--bms-text-3)" }}>{v}</span> },
    {
      title: "Assigned To",
      dataIndex: "assignedTo",
      key: "assigned",
      width: 120,
      render: (v: string) => <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v: "done" | "in_progress" | "pending") => <Badge status={statusCfg[v].color} text={statusCfg[v].label} />,
    },
  ];

  const doneCount = allTasks.filter((t) => t.status === "done").length;
  const pendingCount = allTasks.filter((t) => t.status === "pending").length;
  const inProgressCount = allTasks.filter((t) => t.status === "in_progress").length;

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0, color: "var(--bms-text)" }}>
            <OrderedListOutlined style={{ marginRight: 8 }} />Onboarding Tasks
          </Title>
          <Text style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
            {doneCount} done · {inProgressCount} in progress · {pendingCount} pending
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAssignVisible(true)}>
          Assign Task
        </Button>
      </div>
      <Table
        dataSource={allTasks}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10, size: "small" }}
        scroll={{ x: 700 }}
        style={{ borderRadius: 10, overflow: "hidden" }}
      />
      <Modal
        title="Assign Onboarding Task"
        open={assignVisible}
        onCancel={() => { form.resetFields(); setAssignVisible(false); }}
        onOk={() =>
          form.validateFields().then((vals) => {
            const targetEmp = employees.find((e) => e.id === vals.employee) || vals.employee;
            onboardingTaskScheduleStore.addTask(targetEmp, {
              title: vals.task,
              dueDate: vals.dueDate ? dayjs(vals.dueDate).format("DD MMM YYYY") : dayjs().format("DD MMM YYYY"),
              priority: vals.priority,
            });
            message.success("Task assigned successfully");
            form.resetFields();
            setAssignVisible(false);
          })
        }
        okText="Assign"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="employee" label="Employee" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select employee"
              options={employees.map((e) => ({ value: e.id, label: toTitleCase(e.full_name || e.username) }))}
              filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="task" label="Task Title" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select or type a task"
              options={TASK_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="dueDate" label="Due Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue="medium">
            <Select options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Onboarding Page
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [hireOpen, setHireOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [facilitiesOpen, setFacilitiesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: allEmployees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeeApi.list({ page_size: 500 }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Build onboarding status map
  const onboardingMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getOnboardingStatus>>();
    (allEmployees as Employee[]).forEach((e) => map.set(e.id, getOnboardingStatus(e)));
    return map;
  }, [allEmployees]);

  // Derived stats
  const thisWeekCount = useMemo(() => (allEmployees as Employee[]).filter((e) => isThisWeek(e.joining_date)).length, [allEmployees]);
  const thisMonthCount = useMemo(() => (allEmployees as Employee[]).filter((e) => isThisMonth(e.joining_date)).length, [allEmployees]);
  const atRiskCount = useMemo(() => [...onboardingMap.values()].filter((s) => s.status === "at_risk").length, [onboardingMap]);
  const docsPendingCount = useMemo(() => (allEmployees as Employee[]).reduce((acc, e) => {
    const stored = getStoredSelfOnboardingData(e);
    const uploadedCount = stored?.documents?.filter((d) => d.status === "uploaded" || d.status === "verified").length || 0;
    const totalRequired = 4; // Aadhaar, PAN, Resume, Degree (minimum required)
    return acc + Math.max(0, totalRequired - uploadedCount);
  }, 0), [allEmployees]);
  const notifCount = useMemo(() => atRiskCount + (allEmployees as Employee[]).filter((e) => {
    const s = onboardingMap.get(e.id);
    return s && !s.bankDetails;
  }).length, [atRiskCount, allEmployees, onboardingMap]);

  const { user, permissions } = useAuthStore();

  const isHRManager = useMemo(() => {
    if (!user) return false;
    return (
      hasFullAccess(user) ||
      hasAnyPermission(user, permissions, [
        PERMS.HRMS_ONBOARDING_MANAGE,
        PERMS.HRMS_ONBOARDING_VIEW,
        PERMS.HRMS_EMPLOYEE_CREATE,
        PERMS.HRMS_EMPLOYEE_VIEW,
      ])
    );
  }, [user, permissions]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    let list = allEmployees as Employee[];

    // If Project Manager / Manager (not HR/Admin), show ONLY employees assigned to this PM as reporting manager:
    if (!isHRManager && user) {
      list = list.filter((e) => {
        const mName = (e.manager_name || "").toLowerCase();
        const uName = (user.full_name || user.username || "").toLowerCase();
        const uUser = (user.username || "").toLowerCase();
        const uEmailPrefix = user.email ? user.email.split("@")[0].toLowerCase() : "";

        return (
          e.manager === user.id ||
          (uName && mName.includes(uName)) ||
          (uUser && mName.includes(uUser)) ||
          (uEmailPrefix && mName.includes(uEmailPrefix))
        );
      });
    }

    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter((e) =>
        (e.full_name || e.username).toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((e) => onboardingMap.get(e.id)?.status === statusFilter);
    }
    return list;
  }, [allEmployees, isHRManager, user, searchText, statusFilter, onboardingMap]);

  const columns = [
    {
      title: "Employee",
      key: "employee",
      width: 220,
      render: (_: any, emp: Employee) => {
        const av = avatarPastel(emp.full_name || emp.username);
        const name = toTitleCase(emp.full_name || emp.username);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {emp.profile_picture ? (
              <Avatar size={36} src={emp.profile_picture} />
            ) : (
              <Avatar size={36} style={{ background: av.bg, color: av.text, fontWeight: 700, fontSize: 13, border: `1px solid ${av.border}` }}>
                {initials(emp.full_name || emp.username)}
              </Avatar>
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bms-text)", lineHeight: 1.3 }}>{name}</div>
              <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>{emp.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Code",
      dataIndex: "employee_code",
      key: "code",
      width: 90,
      render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : "—",
    },
    {
      title: "Department",
      key: "dept",
      width: 130,
      render: (_: any, emp: Employee) => toTitleCase(emp.department_name) || "—",
    },
    {
      title: "Joined",
      dataIndex: "joining_date",
      key: "joined",
      width: 120,
      render: (v: string) => v ? dayjs(v).format("DD MMM YYYY") : "—",
    },
    {
      title: "Status",
      key: "obStatus",
      width: 120,
      render: (_: any, emp: Employee) => {
        const s = onboardingMap.get(emp.id);
        return s ? <OnboardingStatusBadge status={s.status} /> : null;
      },
    },
    {
      title: <Tooltip title="Personal Info"><IdcardOutlined /></Tooltip>,
      key: "pi",
      width: 60,
      align: "center" as const,
      render: (_: any, emp: Employee) => <CheckBadge ok={!!onboardingMap.get(emp.id)?.personalInfo} />,
    },
    {
      title: <Tooltip title="Bank Details"><BankOutlined /></Tooltip>,
      key: "bd",
      width: 60,
      align: "center" as const,
      render: (_: any, emp: Employee) => <CheckBadge ok={!!onboardingMap.get(emp.id)?.bankDetails} />,
    },
    {
      title: <Tooltip title="Policy Acknowledged"><FileProtectOutlined /></Tooltip>,
      key: "pa",
      width: 60,
      align: "center" as const,
      render: (_: any, emp: Employee) => <CheckBadge ok={!!onboardingMap.get(emp.id)?.policyAck} />,
    },
    {
      title: <Tooltip title="Docs Verified"><SafetyCertificateOutlined /></Tooltip>,
      key: "dv",
      width: 60,
      align: "center" as const,
      render: (_: any, emp: Employee) => <CheckBadge ok={!!onboardingMap.get(emp.id)?.docsVerified} />,
    },
    {
      title: "Progress",
      key: "progress",
      width: 120,
      render: (_: any, emp: Employee) => {
        const s = onboardingMap.get(emp.id);
        if (!s) return null;
        const completed = [s.personalInfo, s.bankDetails, s.policyAck, s.docsVerified].filter(Boolean).length;
        const pct = Math.round((completed / 4) * 100);
        return (
          <Progress percent={pct} size="small"
            strokeColor={pct === 100 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626"}
            format={(p) => <span style={{ fontSize: 10 }}>{p}%</span>} />
        );
      },
    },
    {
      title: "",
      key: "action",
      width: 90,
      render: (_: any, emp: Employee) => (
        <Space size={4}>
          <Tooltip title="View Onboarding Details">
            <Button size="small" icon={<EyeOutlined />} onClick={(e) => {
              e.stopPropagation();
              setSelectedEmp(emp);
              setDrawerOpen(true);
            }} />
          </Tooltip>
          <Tooltip title="Send Reminder">
            <Button size="small" icon={<BellOutlined />} onClick={(e) => {
              e.stopPropagation();
              message.success(`Reminder sent to ${emp.email}`);
            }} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const statItems = [
    {
      label: "This Week",
      value: thisWeekCount,
      icon: <CalendarOutlined style={{ fontSize: 22, color: "#1a73e8" }} />,
      bg: "var(--bms-primary-light)",
      color: "#1a73e8",
    },
    {
      label: "This Month",
      value: thisMonthCount,
      icon: <TeamOutlined style={{ fontSize: 22, color: "#10b981" }} />,
      bg: "rgba(16, 185, 129, 0.15)",
      color: "#10b981",
    },
    {
      label: "At Risk",
      value: atRiskCount,
      icon: <ExclamationCircleOutlined style={{ fontSize: 22, color: "#dc2626" }} />,
      bg: "rgba(220, 38, 38, 0.15)",
      color: "#dc2626",
    },
    {
      label: "Docs Pending",
      value: docsPendingCount,
      icon: <FileTextOutlined style={{ fontSize: 22, color: "#d97706" }} />,
      bg: "rgba(217, 119, 6, 0.15)",
      color: "#d97706",
    },
    {
      label: "Notifications",
      value: notifCount,
      icon: <BellOutlined style={{ fontSize: 22, color: "#8b5cf6" }} />,
      bg: "rgba(139, 92, 246, 0.15)",
      color: "#8b5cf6",
    },
  ];

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: "var(--bms-bg)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: "var(--bms-text)" }}>
            <ApartmentOutlined style={{ marginRight: 10 }} />Onboarding
          </Title>
          <Text style={{ color: "var(--bms-text-3)", fontSize: 13 }}>
            Manage employee onboarding — track progress, verify documents, assign tasks
          </Text>
        </div>
        <Space wrap>
          <Button icon={<BarChartOutlined />} onClick={() => setReportOpen(true)}>
            Report
          </Button>
          <Button icon={<DesktopOutlined />} onClick={() => setFacilitiesOpen(true)}>
            Employee Facilities
          </Button>
          <Button icon={<BellOutlined />} onClick={() => setReminderOpen(true)}>
            Send Reminder
          </Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setHireOpen(true)}>
            Hire New Person
          </Button>
        </Space>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        {statItems.map((s) => (
          <div key={s.label} style={{
            flex: "1 1 140px", background: "var(--bms-surface)", borderRadius: 12,
            padding: "18px 20px", border: "1px solid var(--bms-border)",
            boxShadow: "var(--shadow-sm)", display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: s.bg,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--bms-text-3)", marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        background: "var(--bms-surface)", borderRadius: 10, padding: "14px 18px",
        border: "1px solid var(--bms-border)", marginBottom: 16,
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
      }}>
        <Input.Search
          placeholder="Search by name, email or code..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 280 }}
          allowClear
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 180 }}
          options={[
            { value: "all", label: "All Statuses" },
            { value: "complete", label: "Complete" },
            { value: "in_progress", label: "In Progress" },
            { value: "at_risk", label: "At Risk" },
          ]}
        />
        <Text style={{ marginLeft: "auto", color: "var(--bms-text-3)", fontSize: 13 }}>
          {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? "s" : ""}
        </Text>
      </div>

      {/* Employee Table */}
      <div style={{ background: "var(--bms-surface)", borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
        <Table
          dataSource={filteredEmployees}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{ pageSize: 15, size: "small", showTotal: (t) => `${t} employees` }}
          onRow={(emp) => ({
            onClick: () => { setSelectedEmp(emp); setDrawerOpen(true); },
            style: { cursor: "pointer" },
          })}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="No employees found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </div>

      {/* Tasks section */}
      {!isLoading && (allEmployees as Employee[]).length > 0 && (
        <OnboardingTasksPanel employees={allEmployees as Employee[]} />
      )}

      {/* ── Drawers / Modals ── */}
      <HireNewPersonDrawer
        open={hireOpen}
        onClose={() => setHireOpen(false)}
        allEmployees={allEmployees as Employee[]}
      />
      <SendReminderModal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        employees={allEmployees as Employee[]}
        onboardingMap={onboardingMap}
      />
      <EmployeeFacilitiesModal
        open={facilitiesOpen}
        onClose={() => setFacilitiesOpen(false)}
        employees={allEmployees as Employee[]}
      />
      <OnboardingReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        employees={allEmployees as Employee[]}
        onboardingMap={onboardingMap}
      />
      <EmployeeOnboardingDrawer
        emp={selectedEmp}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedEmp(null); }}
        onboardingStatus={selectedEmp ? onboardingMap.get(selectedEmp.id) ?? null : null}
        allEmployees={allEmployees as Employee[]}
      />
    </div>
  );
}
