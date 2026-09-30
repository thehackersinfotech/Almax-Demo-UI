import type { ReactNode } from "react";
import {
  ApartmentOutlined,
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  IdcardOutlined,
  PartitionOutlined,
  ProjectOutlined,
  TeamOutlined,
  CheckSquareOutlined,
  CreditCardOutlined,
  PictureOutlined,
  BellOutlined,
  MailOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { PERMS, type BmsPermission } from "@/constants/permissions";

export interface MasterItemDef {
  key: string;
  label: string;
  description: string;
  permission: BmsPermission;
  icon: ReactNode;
  accent: string;
  /** Commercial plan module required to show this master (see apps/tenancy/plans.py). */
  module: string;
}

export interface MasterCategoryDef {
  key: string;
  title: string;
  items: MasterItemDef[];
}

export const MASTER_CATEGORIES: MasterCategoryDef[] = [
  {
    key: "employee",
    title: "Employee Management",
    items: [
      { key: "designation", label: "Designation", description: "Job titles", permission: PERMS.MASTER_HRMS_VIEW, icon: <IdcardOutlined />, accent: "#3b82f6", module: "hms" },
      { key: "department", label: "Department", description: "Teams & structure", permission: PERMS.MASTER_HRMS_VIEW, icon: <ApartmentOutlined />, accent: "#8b5cf6", module: "hms" },
      { key: "employment-type", label: "Employment Type", description: "Full-time, contract & more", permission: PERMS.MASTER_HRMS_VIEW, icon: <TeamOutlined />, accent: "#0ea5e9", module: "hms" },
      { key: "location", label: "Location", description: "Offices & sites", permission: PERMS.MASTER_HRMS_VIEW, icon: <EnvironmentOutlined />, accent: "#14b8a6", module: "hms" },
    ],
  },
  {
    key: "attendance",
    title: "Attendance & Shifts",
    items: [
      { key: "shift-category", label: "Shifts", description: "Working hours", permission: PERMS.MASTER_HRMS_VIEW, icon: <ClockCircleOutlined />, accent: "#f59e0b", module: "hms" },
      { key: "holiday", label: "Holiday", description: "Calendar & types", permission: PERMS.MASTER_HRMS_VIEW, icon: <CalendarOutlined />, accent: "#10b981", module: "hms" },
    ],
  },
  {
    key: "policy",
    title: "Policy & Expenses",
    items: [
      { key: "leave-type", label: "Leave Policy", description: "Types & balances", permission: PERMS.MASTER_HRMS_VIEW, icon: <FileTextOutlined />, accent: "#ec4899", module: "hms" },
      { key: "notice-period", label: "Notice Period Policy", description: "Standard offboarding notice period in days", permission: PERMS.MASTER_HRMS_VIEW, icon: <ClockCircleOutlined />, accent: "#d97706", module: "hms" },
      { key: "reimbursement", label: "Reimbursement Workflow", description: "Configure reviewer & approver employee mappings", permission: PERMS.CRM_EXPENSE_VIEW, icon: <CreditCardOutlined />, accent: "#8b5cf6", module: "finance" },
    ],
  },
  {
    key: "payroll",
    title: "Payroll & Salary",
    items: [
      { key: "rate-card", label: "Rate Cards", description: "HR & billing rates", permission: PERMS.MASTER_HRMS_VIEW, icon: <DollarOutlined />, accent: "#10b981", module: "hms" },
    ],
  },
  {
    key: "client",
    title: "Client",
    items: [
      { key: "client-category", label: "Client Category", description: "Segment & classify", permission: PERMS.MASTER_CLIENT_VIEW, icon: <ClusterOutlined />, accent: "#06b6d4", module: "crm" },
    ],
  },
  {
    key: "project",
    title: "Project & Billing",
    items: [
      { key: "business-type", label: "Business Type", description: "Project categories", permission: PERMS.MASTER_PROJECT_VIEW, icon: <ProjectOutlined />, accent: "#2563eb", module: "project" },
      { key: "billing-type", label: "Billing Type", description: "Fixed, T&M & more", permission: PERMS.MASTER_PROJECT_VIEW, icon: <BankOutlined />, accent: "#7c3aed", module: "project" },
    ],
  },
  {
    key: "workspace",
    title: "Workspace",
    items: [
      { key: "followup-type", label: "Follow-up Type", description: "Follow-up categories & modes", permission: PERMS.MASTER_PROJECT_VIEW, icon: <CheckSquareOutlined />, accent: "#6366f1", module: "workspace" },
    ],
  },
  {
    key: "workflow",
    title: "Workflow",
    items: [
      { key: "workflow", label: "Workflow States", description: "Project & ticket flows", permission: PERMS.MASTER_WORKFLOW_VIEW, icon: <PartitionOutlined />, accent: "#ef4444", module: "project" },
    ],
  },
  {
    key: "company",
    title: "Company Settings",
    items: [
      { key: "company-profile", label: "Company Profile", description: "Logo & branding", permission: PERMS.MASTER_HRMS_VIEW, icon: <PictureOutlined />, accent: "#0891b2", module: "hms" },
    ],
  },
  {
    key: "notification",
    title: "Notification",
    items: [
      { key: "notification", label: "Notifications", description: "Event alerts, trigger rules & system notifications", permission: PERMS.MASTER_WORKFLOW_VIEW, icon: <BellOutlined />, accent: "#f59e0b", module: "project" },
      { key: "configuration", label: "Configuration", description: "Browser Push (VAPID) keys & SMTP Email configuration", permission: PERMS.MASTER_WORKFLOW_VIEW, icon: <SettingOutlined />, accent: "#10b981", module: "project" },
    ],
  },
  {
    key: "security",
    title: "Security",
    items: [
      {
        key: "mfa",
        label: "Multi-Factor Authentication",
        description: "Google Authenticator, backup codes & login security",
        permission: PERMS.MASTER_HRMS_VIEW,
        icon: <SafetyCertificateOutlined />,
        accent: "#6366f1",
        module: "hms",
      },
    ],
  },
];

export const MASTER_TAB_PERMISSIONS: Record<string, BmsPermission> = Object.fromEntries(
  MASTER_CATEGORIES.flatMap((cat) => cat.items.map((item) => [item.key, item.permission])),
);

export function getMasterItemDef(key: string): MasterItemDef | undefined {
  for (const cat of MASTER_CATEGORIES) {
    const item = cat.items.find((i) => i.key === key);
    if (item) return item;
  }
  return undefined;
}
