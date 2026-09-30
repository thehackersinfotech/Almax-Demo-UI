import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Typography, Card, Steps, Form, Input, Button, DatePicker, Select,
  Row, Col, Space, Tag, Divider, Upload, Progress, Alert, Timeline,
  Empty, message, Tooltip, Badge, Modal, Checkbox,
} from "antd";
import {
  IdcardOutlined, BankOutlined, FileTextOutlined, ScheduleOutlined,
  DesktopOutlined, CheckCircleOutlined, UploadOutlined, SaveOutlined,
  RightOutlined, LeftOutlined, FilePdfOutlined, CalendarOutlined,
  UserOutlined, MailOutlined, PhoneOutlined, SafetyCertificateOutlined,
  ClockCircleOutlined, CheckOutlined, LaptopOutlined, HomeOutlined,
  LockOutlined, EditOutlined, ExclamationCircleOutlined,
  FileProtectOutlined, EyeOutlined, DownloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { useAuthStore } from "@/store/auth";
import { employeeApi, type Employee } from "@/services/employees";
import { policyApi } from "@/services/compliance";
import { itAssetStore, type EmployeeAsset } from "@/store/itAssets";
import { onboardingTaskScheduleStore, type HRScheduleItem, type HRTaskItem } from "@/store/onboardingTaskScheduleStore";

const { Title, Text, Paragraph } = Typography;

function getOnboardingStorageKey(empId: string) {
  return `nexus_onboarding_data_${empId}`;
}

export interface EmployeeSelfOnboardingData {
  phoneNumber: string;
  alternativeNumber: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  address: string;
  gender: string;
  dateOfBirth: string;
  bio: string;

  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: string;
  panNumber: string;
  bankSubmitted: boolean;

  documents: {
    id: string;
    type: string;
    fileName?: string;
    uploadedAt?: string;
    fileUrl?: string;
    status: "verified" | "uploaded" | "pending";
  }[];

  completedTaskIds: string[];
}

const DEFAULT_DOC_TYPES = [
  { id: "doc-1", name: "Aadhaar Card (Front & Back)", required: true },
  { id: "doc-2", name: "PAN Card", required: true },
  { id: "doc-3", name: "Resume / CV", required: true },
  { id: "doc-4", name: "Degree / Highest Qualification Certificate", required: true },
  { id: "doc-5", name: "Previous Company Offer / Relieving Letter", required: false },
  { id: "doc-6", name: "Bank Passbook / Cancelled Cheque", required: true },
  { id: "doc-7", name: "Passport Photo / Passport Copy", required: false },
];

export function getStoredSelfOnboardingData(empIdOrKey: string | { id?: string; keycloak_id?: string | null; username?: string; email?: string }): EmployeeSelfOnboardingData {
  const keysToTry: string[] = [];
  if (typeof empIdOrKey === "string") {
    keysToTry.push(empIdOrKey);
  } else if (empIdOrKey && typeof empIdOrKey === "object") {
    if (empIdOrKey.id) keysToTry.push(empIdOrKey.id);
    if (empIdOrKey.keycloak_id) keysToTry.push(empIdOrKey.keycloak_id);
    if (empIdOrKey.username) keysToTry.push(empIdOrKey.username);
    if (empIdOrKey.email) keysToTry.push(empIdOrKey.email);
  }

  for (const k of keysToTry) {
    if (!k) continue;
    try {
      const raw = localStorage.getItem(getOnboardingStorageKey(k));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.phoneNumber || parsed.emergencyContactName || parsed.bankSubmitted || parsed.address)) {
          return parsed;
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  return {
    phoneNumber: "",
    alternativeNumber: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    address: "",
    gender: "",
    dateOfBirth: "",
    bio: "",

    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    branchName: "",
    accountType: "Savings",
    panNumber: "",
    bankSubmitted: false,

    documents: DEFAULT_DOC_TYPES.map((d) => ({
      id: d.id,
      type: d.name,
      status: "pending" as const,
    })),
    completedTaskIds: [],
  };
}

export function saveStoredSelfOnboardingData(empId: string, data: EmployeeSelfOnboardingData) {
  if (!empId) return;
  try {
    const key = typeof empId === "string" ? empId : (empId as any).id || (empId as any).username;
    if (key) localStorage.setItem(getOnboardingStorageKey(key), JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save onboarding store", e);
  }
}

export interface PolicyAckRecord {
  policyId: string;
  policyTitle: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

export const DEFAULT_ONBOARDING_POLICIES = [
  {
    id: "pol-1",
    title: "Code of Conduct & Ethics Policy v2026",
    version: "v2026.1",
    description: "Guidelines on workplace professional behavior, confidentiality, anti-bribery, and corporate values.",
    effectiveDate: "01 Jan 2026",
    content: "All employees must adhere to professional ethics, respect workplace diversity, protect confidential company assets, and comply with anti-bribery guidelines.",
  },
  {
    id: "pol-2",
    title: "Information Security & IT Usage Policy",
    version: "v3.1",
    description: "Acceptable use guidelines for company assets, networks, password security, and data privacy protocols.",
    effectiveDate: "15 Jan 2026",
    content: "Company laptops, credentials, and data must be secured at all times. Unapproved software downloads and sharing confidential credentials are strictly prohibited.",
  },
  {
    id: "pol-3",
    title: "Prevention of Sexual Harassment (POSH) Policy",
    version: "v2.0",
    description: "Company policy guaranteeing an inclusive, safe, and respectful work environment for all employees.",
    effectiveDate: "01 Feb 2026",
    content: "Our organization enforces a zero-tolerance policy against any form of sexual harassment. Employees have access to the Internal Complaints Committee (ICC).",
  },
  {
    id: "pol-4",
    title: "Attendance & Remote Work Regularization Policy",
    version: "v1.4",
    description: "Rules governing working hours, leave requests, shift schedules, and work-from-home guidelines.",
    effectiveDate: "01 Jan 2026",
    content: "Standard working hours, leave application procedures, regularizations, and remote work approval processes are outlined in this policy.",
  },
];

export function getEmployeePolicyAckStore(empIdOrObj: any): Record<string, PolicyAckRecord> {
  if (!empIdOrObj) return {};
  const keysToTry: string[] = [];
  if (typeof empIdOrObj === "string") {
    keysToTry.push(empIdOrObj);
  } else if (empIdOrObj && typeof empIdOrObj === "object") {
    if (empIdOrObj.id) keysToTry.push(empIdOrObj.id);
    if (empIdOrObj.keycloak_id) keysToTry.push(empIdOrObj.keycloak_id);
    if (empIdOrObj.username) keysToTry.push(empIdOrObj.username);
  }

  for (const k of keysToTry) {
    if (!k) continue;
    try {
      const raw = localStorage.getItem(`nexus_policy_ack_${k}`);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
  }
  return {};
}

export function setEmployeePolicyAck(empIdOrObj: any, policyId: string, policyTitle: string) {
  if (!empIdOrObj || !policyId) return;
  const store = getEmployeePolicyAckStore(empIdOrObj);
  store[policyId] = {
    policyId,
    policyTitle,
    acknowledged: true,
    acknowledgedAt: dayjs().format("DD MMM YYYY, hh:mm A"),
  };

  const keysToSave: string[] = [];
  if (typeof empIdOrObj === "string") {
    keysToSave.push(empIdOrObj);
  } else if (empIdOrObj && typeof empIdOrObj === "object") {
    if (empIdOrObj.id) keysToSave.push(empIdOrObj.id);
    if (empIdOrObj.keycloak_id) keysToSave.push(empIdOrObj.keycloak_id);
    if (empIdOrObj.username) keysToSave.push(empIdOrObj.username);
  }

  for (const k of keysToSave) {
    if (!k) continue;
    try {
      localStorage.setItem(`nexus_policy_ack_${k}`, JSON.stringify(store));
    } catch (e) {}
  }
  try {
    window.dispatchEvent(new CustomEvent("nexus-policy-ack-updated", { detail: { empIdOrObj, policyId } }));
  } catch (e) {}
}

export interface CustomDocRequirement {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  addedByHR: boolean;
  createdAt: string;
}

export function getCustomDocRequirements(empIdOrObj: any): CustomDocRequirement[] {
  const keysToTry: string[] = ["global"];
  if (typeof empIdOrObj === "string" && empIdOrObj) {
    keysToTry.push(empIdOrObj);
  } else if (empIdOrObj && typeof empIdOrObj === "object") {
    if (empIdOrObj.id) keysToTry.push(empIdOrObj.id);
    if (empIdOrObj.keycloak_id) keysToTry.push(empIdOrObj.keycloak_id);
    if (empIdOrObj.username) keysToTry.push(empIdOrObj.username);
    if (empIdOrObj.email) keysToTry.push(empIdOrObj.email);
  }

  const allDocsMap: Record<string, CustomDocRequirement> = {};
  for (const k of keysToTry) {
    try {
      const raw = localStorage.getItem(`nexus_custom_docs_${k}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((doc) => {
            if (doc && doc.name) {
              allDocsMap[doc.name.toLowerCase().trim()] = doc;
            }
          });
        }
      }
    } catch (e) {}
  }
  return Object.values(allDocsMap);
}

export function addCustomDocRequirement(empIdOrObj: any, doc: { name: string; description?: string; required?: boolean }) {
  const newDoc: CustomDocRequirement = {
    id: `custom-doc-${Date.now()}`,
    name: doc.name,
    description: doc.description || "Required by HR",
    required: doc.required ?? true,
    addedByHR: true,
    createdAt: dayjs().format("DD MMM YYYY"),
  };

  const keysToSave: string[] = ["global"];
  if (typeof empIdOrObj === "string" && empIdOrObj) {
    keysToSave.push(empIdOrObj);
  } else if (empIdOrObj && typeof empIdOrObj === "object") {
    if (empIdOrObj.id) keysToSave.push(empIdOrObj.id);
    if (empIdOrObj.keycloak_id) keysToSave.push(empIdOrObj.keycloak_id);
    if (empIdOrObj.username) keysToSave.push(empIdOrObj.username);
    if (empIdOrObj.email) keysToSave.push(empIdOrObj.email);
  }

  for (const k of keysToSave) {
    try {
      const current = getCustomDocRequirements(k);
      const updated = [...current.filter((d) => d.name.toLowerCase().trim() !== doc.name.toLowerCase().trim()), newDoc];
      localStorage.setItem(`nexus_custom_docs_${k}`, JSON.stringify(updated));
    } catch (e) {}
  }

  try {
    window.dispatchEvent(new CustomEvent("nexus-custom-docs-updated", { detail: { empIdOrObj } }));
  } catch (e) {}
  return newDoc;
}

export function getAllPolicyDocuments(realApiPolicies: any[] = []): any[] {
  const localRaw = localStorage.getItem("nexus_policy_documents");
  let localPolicies: any[] = [];
  if (localRaw) {
    try {
      localPolicies = JSON.parse(localRaw);
    } catch (e) {}
  }

  const map: Record<string, any> = {};

  // Only include real local HR-uploaded policies (no defaults)
  localPolicies.forEach((p) => {
    if (p && (p.id || p.title)) {
      const key = p.id || p.title;
      map[key] = {
        id: key,
        title: p.title,
        version: p.version || "v1.0",
        description: p.description || p.title,
        effectiveDate: p.effective_date ? dayjs(p.effective_date).format("DD MMM YYYY") : p.effectiveDate || "Effective Date",
        content: p.description || "Please review the policy guidelines.",
        fileUrl: p.file_url || p.file || null,
        is_acknowledged_by_me: p.is_acknowledged_by_me,
      };
    }
  });

  // Merge real API policies (overwrite locals if same id/title)
  if (Array.isArray(realApiPolicies)) {
    realApiPolicies.forEach((p) => {
      if (p && (p.id || p.title)) {
        const key = p.id || p.title;
        map[key] = {
          id: key,
          title: p.title,
          version: p.version || "v1.0",
          description: p.description || p.title,
          effectiveDate: p.effective_date ? dayjs(p.effective_date).format("DD MMM YYYY") : "Effective Date",
          content: p.description || "Please review the policy guidelines.",
          fileUrl: p.file_url || p.file || null,
          is_acknowledged_by_me: p.is_acknowledged_by_me,
        };
      }
    });
  }

  return Object.values(map);
}

export default function EmployeeOnboardingPortalPage() {
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [empData, setEmpData] = useState<Employee | null>(null);

  const [onboardingState, setOnboardingState] = useState<EmployeeSelfOnboardingData>(() =>
    user?.id ? getStoredSelfOnboardingData(user.id) : getStoredSelfOnboardingData("default")
  );

  const { data: realPolicies = [] } = useQuery({
    queryKey: ["policy-documents"],
    queryFn: () => policyApi.list(),
  });

  const displayPolicies = useMemo(() => {
    return getAllPolicyDocuments(realPolicies);
  }, [realPolicies]);

  const [policyAcks, setPolicyAcks] = useState<Record<string, PolicyAckRecord>>(() =>
    user ? getEmployeePolicyAckStore(user) : {}
  );
  const [customDocs, setCustomDocs] = useState<CustomDocRequirement[]>(() =>
    user ? getCustomDocRequirements(user) : []
  );
  const [selectedPolicyModal, setSelectedPolicyModal] = useState<any | null>(null);

  const [realAssets, setRealAssets] = useState<EmployeeAsset[]>([]);
  const [realSchedules, setRealSchedules] = useState<HRScheduleItem[]>([]);
  const [realTasks, setRealTasks] = useState<HRTaskItem[]>([]);

  const [personalForm] = Form.useForm();
  const [bankForm] = Form.useForm();

  const empId = user?.id || "default";

  // Reload schedules, tasks, assets, policies and custom docs
  const reloadData = React.useCallback(() => {
    if (!user?.id) return;
    setRealAssets(itAssetStore.getEmployeeAssets(user.id));
    onboardingTaskScheduleStore.fetchForEmployee(user.id).then(({ schedules, tasks }) => {
      setRealSchedules(schedules);
      setRealTasks(tasks);
    });
    setPolicyAcks(getEmployeePolicyAckStore(user));
    setCustomDocs(getCustomDocRequirements(user));
  }, [user]);

  useEffect(() => {
    reloadData();
    window.addEventListener("nexus-policy-ack-updated", reloadData);
    window.addEventListener("nexus-policy-updated", reloadData);
    window.addEventListener("nexus-custom-docs-updated", reloadData);
    const unsub1 = itAssetStore.subscribe(reloadData);
    const unsub2 = onboardingTaskScheduleStore.subscribe(reloadData);
    return () => {
      window.removeEventListener("nexus-policy-ack-updated", reloadData);
      window.removeEventListener("nexus-policy-updated", reloadData);
      window.removeEventListener("nexus-custom-docs-updated", reloadData);
      unsub1();
      unsub2();
    };
  }, [user, reloadData]);

  // Fetch employee details & fill form values
  useEffect(() => {
    if (!user?.id) return;
    const keyData = getStoredSelfOnboardingData(user.id);
    setOnboardingState(keyData);

    employeeApi.get(user.id).then((emp) => {
      setEmpData(emp);
      personalForm.setFieldsValue({
        phone_number: emp.phone_number || keyData.phoneNumber,
        alternative_number: emp.alternative_number || keyData.alternativeNumber,
        emergencyContactName: keyData.emergencyContactName,
        emergencyContactRelation: keyData.emergencyContactRelation,
        emergencyContactPhone: keyData.emergencyContactPhone,
        address: emp.address || keyData.address,
        gender: emp.gender || keyData.gender,
        date_of_birth: emp.date_of_birth ? dayjs(emp.date_of_birth) : keyData.dateOfBirth ? dayjs(keyData.dateOfBirth) : null,
        bio: emp.bio || keyData.bio,
      });

      bankForm.setFieldsValue({
        accountHolderName: keyData.accountHolderName || emp.full_name || emp.username,
        bankName: keyData.bankName,
        accountNumber: keyData.accountNumber,
        ifscCode: keyData.ifscCode,
        branchName: keyData.branchName,
        accountType: keyData.accountType || "Savings",
        panNumber: keyData.panNumber,
      });
    }).catch(() => {
      personalForm.setFieldsValue({
        phone_number: keyData.phoneNumber,
        alternative_number: keyData.alternativeNumber,
        emergencyContactName: keyData.emergencyContactName,
        emergencyContactRelation: keyData.emergencyContactRelation,
        emergencyContactPhone: keyData.emergencyContactPhone,
        address: keyData.address,
        gender: keyData.gender,
        date_of_birth: keyData.dateOfBirth ? dayjs(keyData.dateOfBirth) : null,
        bio: keyData.bio,
      });

      bankForm.setFieldsValue({
        accountHolderName: keyData.accountHolderName || user?.full_name || user?.username || "",
        bankName: keyData.bankName,
        accountNumber: keyData.accountNumber,
        ifscCode: keyData.ifscCode,
        branchName: keyData.branchName,
        accountType: keyData.accountType || "Savings",
        panNumber: keyData.panNumber,
      });
    });
  }, [user?.id]);

  // Determine if a field was filled by HR (non-editable) or missed by HR (editable)
  const isFilledByHR = (fieldName: string, currentVal: any) => {
    if (!empData) return false;
    const hrVal = (empData as any)[fieldName];
    return !!(hrVal && String(hrVal).trim().length > 0);
  };

  const updateState = (updater: (prev: EmployeeSelfOnboardingData) => EmployeeSelfOnboardingData) => {
    setOnboardingState((prev) => {
      const next = updater(prev);
      if (user?.id) saveStoredSelfOnboardingData(user.id, next);
      return next;
    });
  };

  // Step 1: Save Personal Info & Auto-Advance to Bank Details
  const handleSavePersonal = async (values: any) => {
    setLoading(true);
    try {
      if (user?.id) {
        await employeeApi.update(user.id, {
          phone_number: values.phone_number,
          alternative_number: values.alternative_number,
          address: values.address,
          gender: values.gender,
          date_of_birth: values.date_of_birth ? dayjs(values.date_of_birth).format("YYYY-MM-DD") : null,
          bio: values.bio,
        }).catch(() => {});
      }

      updateState((prev) => ({
        ...prev,
        phoneNumber: values.phone_number || prev.phoneNumber,
        alternativeNumber: values.alternative_number || prev.alternativeNumber,
        emergencyContactName: values.emergencyContactName || prev.emergencyContactName,
        emergencyContactRelation: values.emergencyContactRelation || prev.emergencyContactRelation,
        emergencyContactPhone: values.emergencyContactPhone || prev.emergencyContactPhone,
        address: values.address || prev.address,
        gender: values.gender || prev.gender,
        dateOfBirth: values.date_of_birth ? dayjs(values.date_of_birth).format("YYYY-MM-DD") : prev.dateOfBirth,
        bio: values.bio || prev.bio,
      }));

      message.success("Personal information saved successfully!");
      // Auto-advance to Bank Details (Step 1)
      setCurrentStep(1);
    } catch (e) {
      message.error("Failed to update personal information");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save Bank Details & Auto-Advance to Documents
  const handleSaveBank = (values: any) => {
    updateState((prev) => ({
      ...prev,
      accountHolderName: values.accountHolderName,
      bankName: values.bankName,
      accountNumber: values.accountNumber,
      ifscCode: values.ifscCode,
      branchName: values.branchName,
      accountType: values.accountType,
      panNumber: values.panNumber,
      bankSubmitted: true,
    }));

    message.success("Bank details submitted successfully!");
    // Auto-advance to Documents (Step 2)
    setCurrentStep(2);
  };

  // Step 3: Document Upload
  const handleFileUpload = (docId: string, docType: string, file: File) => {
    updateState((prev) => {
      const exists = prev.documents.some(
        (d) => d.id === docId || d.type.toLowerCase().trim() === docType.toLowerCase().trim()
      );
      const updatedDocs = exists
        ? prev.documents.map((d) =>
            d.id === docId || d.type.toLowerCase().trim() === docType.toLowerCase().trim()
              ? {
                  ...d,
                  id: docId,
                  type: docType,
                  fileName: file.name,
                  uploadedAt: dayjs().format("DD MMM YYYY, hh:mm A"),
                  status: "uploaded" as const,
                  fileUrl: URL.createObjectURL(file),
                }
              : d
          )
        : [
            ...prev.documents,
            {
              id: docId,
              type: docType,
              fileName: file.name,
              uploadedAt: dayjs().format("DD MMM YYYY, hh:mm A"),
              status: "uploaded" as const,
              fileUrl: URL.createObjectURL(file),
            },
          ];
      return {
        ...prev,
        documents: updatedDocs,
      };
    });
    message.success(`${file.name} uploaded successfully!`);
  };

  // Task Checkbox Toggle
  const toggleTask = (taskId: string) => {
    const isDone = onboardingState.completedTaskIds.includes(taskId);
    const newStatus = isDone ? "pending" : "done";
    onboardingTaskScheduleStore.updateTaskStatus(taskId, newStatus);
    toggleLocalTask(taskId);
    reloadData();
  };

  const toggleLocalTask = (taskId: string) => {
    updateState((prev) => {
      const exists = prev.completedTaskIds.includes(taskId);
      const nextTasks = exists
        ? prev.completedTaskIds.filter((id) => id !== taskId)
        : [...prev.completedTaskIds, taskId];
      return { ...prev, completedTaskIds: nextTasks };
    });
  };

  const isPersonalInfoComplete = useMemo(() => {
    return !!(
      (empData?.phone_number || onboardingState.phoneNumber) &&
      (empData?.date_of_birth || onboardingState.dateOfBirth) &&
      (empData?.gender || onboardingState.gender) &&
      (empData?.address || onboardingState.address)
    );
  }, [empData, onboardingState]);

  const isBankComplete = useMemo(() => {
    return !!onboardingState.bankSubmitted;
  }, [onboardingState.bankSubmitted]);

  const allUserDocs = useMemo(() => {
    const existing = onboardingState.documents || [];
    const customList = customDocs || [];
    const customDocItems = customList.map((cd) => {
      const match = existing.find((d) => d.id === cd.id || d.type.toLowerCase().trim() === cd.name.toLowerCase().trim());
      if (match) return { ...match, addedByHR: true };
      return {
        id: cd.id,
        type: cd.name,
        status: "pending" as const,
        addedByHR: true,
      };
    });
    const defaultDocItems = existing.filter(
      (d) => !customList.some((cd) => cd.id === d.id || cd.name.toLowerCase().trim() === d.type.toLowerCase().trim())
    );
    return [...defaultDocItems, ...customDocItems];
  }, [onboardingState.documents, customDocs]);

  const handleDownloadPolicy = (pol: any) => {
    if (!pol) return;
    if (pol.fileUrl || pol.file) {
      const url = pol.fileUrl || pol.file;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pol.title}.pdf`;
      a.target = "_blank";
      a.click();
      message.success(`Downloading policy document: ${pol.title}`);
    } else {
      const element = document.createElement("a");
      const file = new Blob([
        `POLICY DOCUMENT: ${pol.title}\nVersion: ${pol.version}\nEffective Date: ${pol.effectiveDate}\n\nDescription:\n${pol.description}\n\nPolicy Guidelines & Content:\n${pol.content}`
      ], { type: "text/plain;charset=utf-8" });
      element.href = URL.createObjectURL(file);
      element.download = `${pol.title.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      message.success(`Downloaded policy document: ${pol.title}`);
    }
  };

  const isDocsComplete = useMemo(() => {
    const uploaded = allUserDocs.filter(
      (d) => d.status === "uploaded" || d.status === "verified"
    ).length;
    return uploaded >= 3 || (allUserDocs.length > 0 && uploaded >= allUserDocs.length);
  }, [allUserDocs]);

  const isPolicyComplete = useMemo(() => {
    return displayPolicies.every((pol) => !!policyAcks[pol.id]?.acknowledged);
  }, [displayPolicies, policyAcks]);

  const hasHRSchedulesOrTasks = realSchedules.length > 0 || realTasks.length > 0;
  const hasHRAssets = realAssets.length > 0;

  // Status bar line progression step:
  // 0: Personal Info -> 1: Bank Details -> 2: Documents -> 3: Schedules (if HR assigned) -> 4: Assets (if HR assigned)
  const activeLineStep = useMemo(() => {
    if (!isPersonalInfoComplete) return 0;
    if (!isBankComplete) return 1;
    if (!isDocsComplete) return 2;
    if (!isPolicyComplete) return 3;
    if (hasHRSchedulesOrTasks) return 4;
    if (hasHRAssets) return 5;
    return 3; // Stay at policy documents step if no HR assignments yet
  }, [isPersonalInfoComplete, isBankComplete, isDocsComplete, isPolicyComplete, hasHRSchedulesOrTasks, hasHRAssets]);

  useEffect(() => {
    setCurrentStep(activeLineStep);
  }, [activeLineStep]);

  // Stepper Items (Icons Only)
  // Policy, Schedules & Tasks, Assets & Facilities are accessible whenever content is assigned —
  // they do NOT require all previous steps to be complete first.
  const stepsItems = [
    { title: "Personal Information", icon: <IdcardOutlined />, disabled: false },
    { title: "Bank Details", icon: <BankOutlined />, disabled: false },
    { title: "Documents", icon: <FileTextOutlined />, disabled: false },
    {
      title: "Policy Documents",
      icon: <FileProtectOutlined />,
      // Enable as long as policies exist — no prerequisite chain needed
      disabled: displayPolicies.length === 0,
    },
    {
      title: "Schedules & Tasks",
      icon: <ScheduleOutlined />,
      // Enable as long as HR has assigned schedules or tasks
      disabled: !hasHRSchedulesOrTasks,
    },
    {
      title: "Assets & Facilities",
      icon: <DesktopOutlined />,
      // Enable as long as HR has assigned assets
      disabled: !hasHRAssets,
    },
  ];

  // Helper field label renderer showing locked badge if filled by HR
  const renderFieldLabel = (label: string, isHR: boolean) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span>{label}</span>
      {isHR ? (
        <Tag icon={<LockOutlined />} color="default" style={{ fontSize: 10, padding: "0 6px", margin: 0 }}>
          Filled by HR
        </Tag>
      ) : (
        <Tooltip title="Editable">
          <EditOutlined style={{ color: "#d97706", fontSize: 13 }} />
        </Tooltip>
      )}
    </div>
  );

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "var(--bms-bg)" }}>
      {/* Top Banner */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0, color: "var(--bms-text)" }}>
              <IdcardOutlined style={{ marginRight: 12, color: "var(--bms-primary)" }} />
              My Onboarding
            </Title>
            <Text style={{ color: "var(--bms-text-3)", fontSize: 14 }}>
              Complete your onboarding lifecycle steps below to finalize your joining profile and credentials.
            </Text>
          </div>
          <Tag color="processing" style={{ fontSize: 13, padding: "6px 14px", borderRadius: 20 }}>
            Status: Active Onboarding
          </Tag>
        </div>
      </div>

      {/* Top Workflow Lifecycle Stepper (Icons Only) */}
      <Card style={{ marginBottom: 24, borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}>
        <Steps
          current={currentStep}
          onChange={(step) => {
            const item = stepsItems[step];
            if (item.disabled) {
              if (step === 3) {
                message.warning("No policy documents have been assigned yet.");
              } else if (step === 4) {
                message.warning("No schedules or tasks have been assigned by HR yet.");
              } else if (step === 5) {
                message.warning("No IT assets or facilities have been assigned by HR yet.");
              } else {
                message.warning("This step is not available yet.");
              }
              return;
            }
            setCurrentStep(step);
          }}
          items={stepsItems.map((s, idx) => ({
            title: "", // Icons ONLY
            icon: (
              <Tooltip title={`${s.title}${s.disabled ? " (Not yet assigned by HR)" : ""}`}>
                <span style={{
                  fontSize: 20,
                  color: currentStep === idx ? "var(--bms-primary)" : s.disabled ? "#d1d5db" : "inherit",
                  cursor: s.disabled ? "not-allowed" : "pointer",
                }}>
                  {s.icon}
                </span>
              </Tooltip>
            ),
            disabled: s.disabled,
            status: currentStep === idx ? "process" : currentStep > idx ? "finish" : "wait",
          }))}
        />
      </Card>

      {/* Main Step Card */}
      <Card style={{ borderRadius: 12, border: "1px solid var(--bms-border)", boxShadow: "var(--shadow-sm)" }}>

        {/* ── STAGE 0: PERSONAL INFORMATION ── */}
        {currentStep === 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>Personal Information</Title>
                <Text type="secondary">
                  Fields filled by HR during hiring are locked. Complete any missing fields below.
                </Text>
              </div>
              <Tag color="blue">Step 1 of 5</Tag>
            </div>

            <Form form={personalForm} layout="vertical" onFinish={handleSavePersonal}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={renderFieldLabel("First Name", true)}>
                    <Input value={empData?.first_name || user?.first_name || ""} disabled prefix={<LockOutlined style={{ color: "#8c8c8c" }} />} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={renderFieldLabel("Last Name", true)}>
                    <Input value={empData?.last_name || user?.last_name || ""} disabled prefix={<LockOutlined style={{ color: "#8c8c8c" }} />} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={renderFieldLabel("Official Email", true)}>
                    <Input value={empData?.email || user?.email || ""} disabled prefix={<MailOutlined style={{ color: "#8c8c8c" }} />} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={renderFieldLabel("Employee Code", true)}>
                    <Input value={empData?.employee_code || user?.employee_code || "—"} disabled prefix={<IdcardOutlined style={{ color: "#8c8c8c" }} />} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={renderFieldLabel("Department", true)}>
                    <Input value={empData?.department_name || "Engineering"} disabled prefix={<LockOutlined style={{ color: "#8c8c8c" }} />} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={renderFieldLabel("Designation", true)}>
                    <Input value={empData?.designation_name || "Software Engineer"} disabled prefix={<LockOutlined style={{ color: "#8c8c8c" }} />} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={renderFieldLabel("Date of Joining", true)}>
                    <Input value={empData?.joining_date ? dayjs(empData.joining_date).format("DD MMM YYYY") : "—"} disabled prefix={<LockOutlined style={{ color: "#8c8c8c" }} />} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={renderFieldLabel("Reporting Manager", true)}>
                    <Input value={empData?.manager_name || "Reporting Manager"} disabled prefix={<LockOutlined style={{ color: "#8c8c8c" }} />} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: "16px 0 20px" }}>Personal Details (Complete Missing Information)</Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="phone_number"
                    label={renderFieldLabel("Primary Phone Number", isFilledByHR("phone_number", empData?.phone_number))}
                    rules={[{ required: true, message: "Phone number is required" }]}
                  >
                    <Input
                      disabled={isFilledByHR("phone_number", empData?.phone_number)}
                      prefix={<PhoneOutlined />}
                      placeholder="+91 9876543210"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="alternative_number"
                    label={renderFieldLabel("Alternative Phone Number", isFilledByHR("alternative_number", empData?.alternative_number))}
                  >
                    <Input
                      disabled={isFilledByHR("alternative_number", empData?.alternative_number)}
                      prefix={<PhoneOutlined />}
                      placeholder="+91 9876543211"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="date_of_birth"
                    label={renderFieldLabel("Date of Birth", isFilledByHR("date_of_birth", empData?.date_of_birth))}
                    rules={[{ required: true, message: "Date of Birth required" }]}
                  >
                    <DatePicker
                      style={{ width: "100%" }}
                      format="DD MMM YYYY"
                      disabled={isFilledByHR("date_of_birth", empData?.date_of_birth)}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="gender"
                    label={renderFieldLabel("Gender", isFilledByHR("gender", empData?.gender))}
                    rules={[{ required: true, message: "Gender required" }]}
                  >
                    <Select
                      disabled={isFilledByHR("gender", empData?.gender)}
                      options={[{ value: "M", label: "Male" }, { value: "F", label: "Female" }, { value: "O", label: "Other" }]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="address"
                label={renderFieldLabel("Residential Address", isFilledByHR("address", empData?.address))}
                rules={[{ required: true, message: "Address is required" }]}
              >
                <Input.TextArea
                  rows={2}
                  disabled={isFilledByHR("address", empData?.address)}
                  placeholder="Enter your full residential address..."
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="emergencyContactName"
                    label={renderFieldLabel("Emergency Contact Name", false)}
                  >
                    <Input placeholder="Full Name (Optional)" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="emergencyContactRelation"
                    label={renderFieldLabel("Relationship", false)}
                  >
                    <Input placeholder="e.g. Spouse / Parent (Optional)" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="emergencyContactPhone"
                    label={renderFieldLabel("Emergency Phone", false)}
                  >
                    <Input placeholder="+91 9876543210 (Optional)" />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Save & Proceed to Bank Details
                </Button>
              </div>
            </Form>
          </div>
        )}

        {/* ── STAGE 1: BANK DETAILS ── */}
        {currentStep === 1 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>Bank Account & Payroll Details</Title>
                <Text type="secondary">Enter your bank details for monthly payroll and salary credit.</Text>
              </div>
              <Tag color="blue">Step 2 of 5</Tag>
            </div>

            {onboardingState.bankSubmitted && (
              <Alert
                type="success"
                showIcon
                message="Bank Details Submitted"
                description="Your bank account details have been saved and sent to HR."
                style={{ marginBottom: 20 }}
              />
            )}

            <Form form={bankForm} layout="vertical" onFinish={handleSaveBank}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="accountHolderName" label="Account Holder Name" rules={[{ required: true, message: "Account holder name required" }]}>
                    <Input prefix={<UserOutlined />} placeholder="Full Name as in Bank Account" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="bankName" label="Bank Name" rules={[{ required: true, message: "Bank name required" }]}>
                    <Input prefix={<BankOutlined />} placeholder="e.g. HDFC Bank / ICICI Bank / SBI" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="accountNumber" label="Account Number" rules={[{ required: true, message: "Account number required" }]}>
                    <Input.Password placeholder="Enter Account Number" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="ifscCode" label="IFSC Code" rules={[{ required: true, message: "IFSC code required" }]}>
                    <Input placeholder="e.g. HDFC0001234" style={{ textTransform: "uppercase" }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="branchName" label="Branch Name" rules={[{ required: true, message: "Branch name required" }]}>
                    <Input placeholder="e.g. Main Branch, Chennai" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="accountType" label="Account Type" rules={[{ required: true }]}>
                    <Select options={[{ value: "Savings", label: "Savings Account" }, { value: "Salary", label: "Salary Account" }, { value: "Current", label: "Current Account" }]} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="panNumber" label="PAN Number" rules={[{ required: true, message: "PAN number required" }]}>
                    <Input placeholder="e.g. ABCDE1234F" style={{ textTransform: "uppercase" }} />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
                <Button icon={<LeftOutlined />} onClick={() => setCurrentStep(0)}>
                  Back
                </Button>
                <Button type="primary" htmlType="submit">
                  Save & Proceed to Documents
                </Button>
              </div>
            </Form>
          </div>
        )}

        {/* ── STAGE 2: DOCUMENTS ── */}
        {currentStep === 2 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>Verification Documents</Title>
                <Text type="secondary">Upload mandatory document files for HR verification.</Text>
              </div>
              <Tag color="blue">Step 3 of 5</Tag>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {allUserDocs.map((doc) => (
                <Card key={doc.id} size="small" style={{ borderRadius: 8, background: "var(--bms-surface-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <FilePdfOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {doc.type}
                          {(DEFAULT_DOC_TYPES.find((d) => d.id === doc.id)?.required || ("addedByHR" in doc && doc.addedByHR)) && (
                            <span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>
                          )}
                          {"addedByHR" in doc && doc.addedByHR && (
                            <Tag color="purple" style={{ marginLeft: 8, fontSize: 10 }}>Required by HR</Tag>
                          )}
                        </div>
                        {doc.fileName ? (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {doc.fileName} — Uploaded: {doc.uploadedAt}
                          </Text>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>Not uploaded yet</Text>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {doc.status === "uploaded" && <Tag color="processing"><ClockCircleOutlined /> Uploaded</Tag>}
                      {doc.status === "verified" && <Tag color="success"><CheckCircleOutlined /> Verified</Tag>}
                      {doc.status === "pending" && <Tag color="default">Pending Upload</Tag>}

                      <Upload
                        beforeUpload={(file) => {
                          handleFileUpload(doc.id, doc.type, file);
                          return false;
                        }}
                        showUploadList={false}
                      >
                        <Button icon={<UploadOutlined />} size="small" type={doc.fileName ? "default" : "primary"}>
                          {doc.fileName ? "Re-upload" : "Upload File"}
                        </Button>
                      </Upload>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <Button icon={<LeftOutlined />} onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button
                type="primary"
                onClick={() => setCurrentStep(3)}
              >
                Save & Proceed to Policy Documents
              </Button>
            </div>
          </div>
        )}

        {/* ── STAGE 3: POLICY DOCUMENTS ── */}
        {currentStep === 3 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>HR Policy Documents & Acknowledgements</Title>
                <Text type="secondary">
                  Review and acknowledge company policy documents assigned by HR to complete your onboarding lifecycle.
                </Text>
              </div>
              <Tag color="purple">Step 4 of 6</Tag>
            </div>

            <Alert
              type={isPolicyComplete ? "success" : "info"}
              showIcon
              message={isPolicyComplete ? "All required HR policy documents acknowledged!" : "Please review and acknowledge each policy document listed below."}
              style={{ marginBottom: 20, borderRadius: 8 }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {displayPolicies.map((pol) => {
                const ack = policyAcks[pol.id];
                const isAck = !!ack?.acknowledged;
                return (
                  <Card key={pol.id} size="small" style={{ borderRadius: 10, border: `1px solid ${isAck ? "#a7f3d0" : "var(--bms-border)"}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FileProtectOutlined style={{ fontSize: 18, color: isAck ? "#059669" : "#1a73e8" }} />
                          <Text strong style={{ fontSize: 14, color: "var(--bms-text)" }}>{pol.title}</Text>
                          <Tag color="blue">{pol.version}</Tag>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                          {pol.description}
                        </Text>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {isAck ? (
                          <Tag color="success" icon={<CheckCircleOutlined />}>
                            Acknowledged ({ack.acknowledgedAt})
                          </Tag>
                        ) : (
                          <Tag color="warning" icon={<ClockCircleOutlined />}>
                            Pending Acknowledgement
                          </Tag>
                        )}

                        <Button icon={<EyeOutlined />} size="small" onClick={() => setSelectedPolicyModal(pol)}>
                          View Policy
                        </Button>

                        <Button icon={<DownloadOutlined />} size="small" onClick={() => handleDownloadPolicy(pol)}>
                          Download Document
                        </Button>

                        {!isAck && (
                          <Button
                            type="primary"
                            size="small"
                            icon={<CheckCircleOutlined />}
                            onClick={async () => {
                              if (pol.id && !pol.id.startsWith("pol-")) {
                                try {
                                  await policyApi.acknowledge(pol.id);
                                } catch (e) {
                                  console.warn("Backend policy acknowledge notice:", e);
                                }
                              }
                              setEmployeePolicyAck(user || empId, pol.id, pol.title);
                              message.success(`Acknowledged: ${pol.title}`);
                              reloadData();
                            }}
                          >
                            Acknowledge Policy
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <Button icon={<LeftOutlined />} onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button
                type="primary"
                disabled={!isPolicyComplete}
                onClick={() => {
                  if (hasHRSchedulesOrTasks) {
                    setCurrentStep(4);
                  } else if (hasHRAssets) {
                    setCurrentStep(5);
                  } else {
                    message.info("Policy documents acknowledged! HR has not assigned any schedules, tasks, or assets yet.");
                  }
                }}
              >
                {hasHRSchedulesOrTasks ? "Proceed to Schedules & Tasks" : hasHRAssets ? "Proceed to Assets & Facilities" : "Policy Acknowledgements Complete"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STAGE 4: SCHEDULES & TASKS ── */}
        {currentStep === 4 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>HR-Assigned Schedules & Tasks</Title>
                <Text type="secondary">
                  Real orientation schedules and onboarding tasks assigned by HR.
                </Text>
              </div>
              <Tag color="blue">Step 5 of 6</Tag>
            </div>

            {!hasHRSchedulesOrTasks ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span>
                    <Text strong style={{ fontSize: 14 }}>No onboarding schedules or tasks assigned by HR yet.</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      When your HR manager creates an orientation event or assigns tasks in HRMS Onboarding, they will automatically appear here.
                    </Text>
                  </span>
                }
                style={{ padding: "40px 0" }}
              />
            ) : (
              <Row gutter={24}>
                {/* Real HR Schedules */}
                <Col span={12}>
                  <Card title={<span><CalendarOutlined style={{ marginRight: 8 }} />Orientation Sessions ({realSchedules.length})</span>} size="small" style={{ borderRadius: 8 }}>
                    {realSchedules.length === 0 ? (
                      <Empty description="No schedules assigned by HR yet" style={{ padding: "20px 0" }} />
                    ) : (
                      <Timeline
                        items={realSchedules.map((sch) => ({
                          dot: <ClockCircleOutlined style={{ color: "#1890ff", fontSize: 16 }} />,
                          children: (
                            <div style={{ paddingBottom: 8 }}>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{sch.title}</div>
                              <div style={{ fontSize: 12, color: "var(--bms-text-3)", marginTop: 2 }}>
                                <CalendarOutlined style={{ marginRight: 4 }} />{sch.date} ({sch.time})
                              </div>
                              <div style={{ fontSize: 12, color: "var(--bms-text-3)" }}>
                                <HomeOutlined style={{ marginRight: 4 }} />Location: {sch.location}
                              </div>
                            </div>
                          ),
                        }))}
                      />
                    )}
                  </Card>
                </Col>

                {/* Real HR Tasks */}
                <Col span={12}>
                  <Card
                    title={
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span><CheckCircleOutlined style={{ marginRight: 8 }} />Assigned Tasks ({realTasks.length})</span>
                      </div>
                    }
                    size="small"
                    style={{ borderRadius: 8 }}
                  >
                    {realTasks.length === 0 ? (
                      <Empty description="No tasks assigned by HR yet" style={{ padding: "20px 0" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {realTasks.map((tsk) => {
                          const isDone = tsk.status === "done" || onboardingState.completedTaskIds.includes(tsk.id);
                          return (
                            <div
                              key={tsk.id}
                              onClick={() => toggleTask(tsk.id)}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "10px 12px", borderRadius: 6, cursor: "pointer",
                                background: isDone ? "var(--bms-surface-2)" : "var(--bms-surface)",
                                border: `1px solid ${isDone ? "#a7f3d0" : "var(--bms-border)"}`,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{
                                  width: 20, height: 20, borderRadius: "50%",
                                  border: `2px solid ${isDone ? "#059669" : "#d1d5db"}`,
                                  background: isDone ? "#059669" : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12,
                                }}>
                                  {isDone && <CheckOutlined />}
                                </div>
                                <div>
                                  <div style={{ fontSize: 13, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--bms-text-3)" : "var(--bms-text)", fontWeight: 500 }}>
                                    {tsk.title}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--bms-text-3)" }}>Due: {tsk.dueDate}</div>
                                </div>
                              </div>
                              <Tag color={tsk.priority === "high" ? "red" : "blue"}>{tsk.priority || "medium"}</Tag>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 24 }}>
              <Button icon={<LeftOutlined />} onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  if (hasHRAssets) {
                    setCurrentStep(5);
                  } else {
                    message.info("Schedules & Tasks reviewed! HR has not assigned any IT assets or facilities yet.");
                  }
                }}
              >
                {hasHRAssets ? "Proceed to Assets & Facilities" : "Schedules & Tasks Complete"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STAGE 5: ASSETS & FACILITIES ── */}
        {currentStep === 5 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>HR & IT Assigned Assets & Facilities</Title>
                <Text type="secondary">Real equipment allocated to you by HR and IT departments.</Text>
              </div>
              <Tag color="blue">Step 6 of 6</Tag>
            </div>

            {realAssets.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span>
                    <Text strong style={{ fontSize: 15, display: "block", marginBottom: 6 }}>
                      No assets and facilities have been updated
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      When HR assigns equipment (laptops, peripherals, ID badges) in HRMS Onboarding, they will automatically reflect here.
                    </Text>
                  </span>
                }
                style={{ padding: "40px 0" }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {realAssets.map((ast) => (
                  <Card key={ast.id} size="small" style={{ borderRadius: 8, background: "var(--bms-surface-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <LaptopOutlined style={{ fontSize: 28, color: "var(--bms-primary)" }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{ast.itemName}</div>
                          <div style={{ fontSize: 13, color: "var(--bms-text-3)" }}>
                            Category: {ast.category} | Unique ID Code: <code style={{ fontWeight: 600, color: "#1890ff" }}>{ast.assetCode}</code> | Condition: {ast.condition}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Tag color="success"><CheckCircleOutlined /> Assigned & Active</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>Date: {ast.assignedDate}</Text>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <Alert
              type="info"
              showIcon
              message="Onboarding Completion Status"
              description="You have reviewed all onboarding lifecycle stages! All updates and document uploads are synced with HR."
              style={{ marginBottom: 24 }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <Button icon={<LeftOutlined />} onClick={() => setCurrentStep(hasHRSchedulesOrTasks ? 4 : 3)}>
                Back
              </Button>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => message.success("Onboarding workflow complete!")}>
                Finish Onboarding Portal
              </Button>
            </div>
          </div>
        )}

      </Card>

      {/* Policy Details Modal */}
      <Modal
        title={selectedPolicyModal ? <span><FileProtectOutlined style={{ marginRight: 8, color: "var(--bms-primary)" }} />{selectedPolicyModal.title}</span> : ""}
        open={!!selectedPolicyModal}
        onCancel={() => setSelectedPolicyModal(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedPolicyModal(null)}>Close</Button>,
          selectedPolicyModal && !policyAcks[selectedPolicyModal.id]?.acknowledged ? (
            <Button
              key="ack"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setEmployeePolicyAck(empId, selectedPolicyModal.id, selectedPolicyModal.title);
                message.success(`Acknowledged: ${selectedPolicyModal.title}`);
                setSelectedPolicyModal(null);
              }}
            >
              Acknowledge Policy
            </Button>
          ) : null,
        ]}
        width={780}
      >
        {selectedPolicyModal && (
          <div style={{ background: "#ffffff", border: "1px solid var(--bms-border)", borderRadius: 10, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            {/* Policy Document Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {selectedPolicyModal.version && <Tag color="blue" style={{ fontSize: 12 }}>{selectedPolicyModal.version}</Tag>}
                {selectedPolicyModal.effectiveDate && <Text type="secondary" style={{ fontSize: 12 }}>Effective Date: {selectedPolicyModal.effectiveDate}</Text>}
              </div>
              <Tag color={policyAcks[selectedPolicyModal.id]?.acknowledged ? "success" : "warning"} style={{ fontSize: 12, fontWeight: 600 }}>
                {policyAcks[selectedPolicyModal.id]?.acknowledged ? "✓ ACKNOWLEDGED" : "PENDING ACKNOWLEDGMENT"}
              </Tag>
            </div>
            {selectedPolicyModal.description && (
              <Paragraph style={{ fontSize: 13, color: "var(--bms-text)", marginBottom: 16 }}>
                {selectedPolicyModal.description}
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
              {selectedPolicyModal.fileUrl ? (
                <iframe
                  src={selectedPolicyModal.fileUrl}
                  style={{ width: "100%", height: 380, border: "1px solid var(--bms-border)", borderRadius: 6, background: "#fff", marginBottom: 16 }}
                  title={selectedPolicyModal.title}
                />
              ) : (
                <div style={{ whiteSpace: "pre-wrap", marginBottom: 20, fontSize: 13, color: "var(--bms-text)" }}>
                  {selectedPolicyModal.content || selectedPolicyModal.description || "Official company policy document guidelines and code of conduct rules."}
                </div>
              )}

              {/* Signature & Acknowledged By Block INSIDE the policy page text at the bottom */}
              <div style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: `2px dashed ${policyAcks[selectedPolicyModal.id]?.acknowledged ? "#059669" : "#d97706"}`,
                background: policyAcks[selectedPolicyModal.id]?.acknowledged ? "#f0fdf4" : "#fffbeb",
                border: `1px solid ${policyAcks[selectedPolicyModal.id]?.acknowledged ? "#a7f3d0" : "#fde68a"}`,
                borderRadius: 8,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {policyAcks[selectedPolicyModal.id]?.acknowledged ? (
                    <CheckCircleOutlined style={{ color: "#059669", fontSize: 26 }} />
                  ) : (
                    <ClockCircleOutlined style={{ color: "#d97706", fontSize: 26 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: policyAcks[selectedPolicyModal.id]?.acknowledged ? "#047857" : "#b45309" }}>
                      Digital Policy Signature & Acknowledgment
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: policyAcks[selectedPolicyModal.id]?.acknowledged ? "#065f46" : "#92400e" }}>
                      {policyAcks[selectedPolicyModal.id]?.acknowledged
                        ? `✓ Acknowledged by ${user?.first_name ? `${user.first_name} ${user.last_name || ""} (@${user.username || empId})` : user?.username || empId}`
                        : `⏳ Pending Acknowledgment by ${user?.first_name ? `${user.first_name} ${user.last_name || ""} (@${user.username || empId})` : user?.username || empId}`}
                    </div>
                    {policyAcks[selectedPolicyModal.id]?.acknowledged && policyAcks[selectedPolicyModal.id]?.acknowledgedAt && (
                      <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>
                        Signed Timestamp: {policyAcks[selectedPolicyModal.id].acknowledgedAt}
                      </div>
                    )}
                  </div>
                </div>
                <Tag color={policyAcks[selectedPolicyModal.id]?.acknowledged ? "success" : "warning"} style={{ fontSize: 11, padding: "4px 10px", fontWeight: 600 }}>
                  {policyAcks[selectedPolicyModal.id]?.acknowledged ? "VERIFIED ACKNOWLEDGMENT" : "PENDING"}
                </Tag>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
