import React, { useState, useEffect, useMemo } from "react";
import logoImage from "@/assets/logo-AlMax.png";
import { Layout, Avatar, Dropdown, Typography, Space, Tooltip, Modal, Button } from "antd";
import OrgChart from "@/components/OrgChart";
import GlobalSearch from "@/components/common/GlobalSearch";
import ThemeToggle from "@/components/common/ThemeToggle";
import NotificationBell from "@/components/notifications/NotificationBell";
import WorkspaceCalendarModal from "@/pages/workspace/WorkspaceCalendarModal";
import DailyDueNotification from "@/components/common/DailyDueNotification";
import { GlobalCallListener } from "@/components/call";
import {
  DashboardOutlined, ProjectOutlined, TeamOutlined, ApartmentOutlined,
  BarChartOutlined, UserOutlined, LogoutOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, DatabaseOutlined, BankOutlined,
  ClockCircleOutlined, CheckCircleOutlined, RightOutlined,
  HomeOutlined, OrderedListOutlined, CalendarOutlined,
  WalletOutlined, FieldTimeOutlined, SafetyCertificateOutlined, FileProtectOutlined,
  SettingOutlined,
  FileTextOutlined,
  DollarOutlined, FileSearchOutlined, FundOutlined,
  ShopOutlined, CreditCardOutlined, PhoneOutlined, MessageOutlined,
  CloudServerOutlined,
  UsergroupAddOutlined, DesktopOutlined, BoxPlotOutlined, IdcardOutlined, UsergroupDeleteOutlined,
  RiseOutlined, FolderOpenOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation, Outlet, useSearchParams, Link } from "react-router-dom";
import ClientFormPage from "@/pages/clients/ClientFormPage";
import ProjectFormPage from "@/pages/projects/ProjectFormPage";
import { useAuthStore } from "@/store/auth";
import { useTenantStore } from "@/store/tenant";
import { PERMS, ANY_MASTER_VIEW, ANY_CRM_VIEW, ANY_FINANCE_VIEW, ANY_WORKSPACE_VIEW, type BmsPermission } from "@/constants/permissions";
import { canSeeNavItem, hasAnyPermission } from "@/utils/access";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

function useDarkMode() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark",
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute("data-theme") === "dark"),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function useIsMobile(breakpoint = 960) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

interface NavItem {
  key: string;
  icon?: React.ReactNode;
  label: string;
  permission?: BmsPermission;
  anyOf?: BmsPermission[];
  children?: NavItem[];
  badge?: number;
  platformAdminOnly?: boolean;
  workspaceAdminOnly?: boolean;
  module?: string;
}

function isChildActive(item: NavItem, pathname: string): boolean {
  if (!item.children) {
    return pathname === item.key || pathname.startsWith(item.key + "/");
  }
  return item.children.some((c) => isChildActive(c, pathname));
}

const NAV_ITEMS_WITHOUT_DASHBOARD: NavItem[] = [
  {
    key: "/hrms",
    icon: <TeamOutlined />,
    label: "HRMS",
    module: "hms",
    children: [
      { key: "/hrms-dashboard",           icon: <DashboardOutlined />,         label: "Dashboard",        permission: PERMS.DASHBOARD_HRMS, module: "hms" },
      { key: "/employees",                icon: <TeamOutlined />,              label: "Employees",        permission: PERMS.HRMS_EMPLOYEE_VIEW, module: "hms" },
      { key: "/onboarding",               icon: <UsergroupAddOutlined />,      label: "Onboarding",       anyOf: [PERMS.HRMS_ONBOARDING_VIEW, PERMS.HRMS_ONBOARDING_MANAGE], module: "hms" },
      { key: "/employee-onboarding",      icon: <IdcardOutlined />,            label: "My Onboarding",    permission: PERMS.HRMS_EMPLOYEE_ONBOARDING, module: "hms" },
      { key: "/offboarding",              icon: <UsergroupDeleteOutlined />,   label: "Offboarding",      anyOf: [PERMS.HRMS_OFFBOARDING_VIEW, PERMS.HRMS_OFFBOARDING_MANAGE], module: "hms" },
      { key: "/my-offboarding",           icon: <LogoutOutlined />,            label: "My Offboarding",   permission: PERMS.HRMS_EMPLOYEE_OFFBOARDING, module: "hms" },
      { key: "/attendance/tracker", icon: <FieldTimeOutlined />, label: "Attendance", permission: PERMS.HRMS_ATTENDANCE_VIEW, module: "hms" },
      { key: "/attendance/admin", icon: <SettingOutlined />, label: "Attendance Requests", permission: PERMS.HRMS_ATTENDANCE_MANAGE, module: "hms" },
      { key: "/employees/leave-requests", icon: <CalendarOutlined />, label: "Leave Management", permission: PERMS.HRMS_LEAVE_VIEW, module: "hms" },
      { key: "/employees/payroll",        icon: <WalletOutlined />,            label: "Payroll",          permission: PERMS.HRMS_PAYROLL_VIEW, module: "hms" },
      { key: "/employees/hr-compliance", icon: <SafetyCertificateOutlined />, label: "HR Compliance", permission: PERMS.HRMS_COMPLIANCE_VIEW, module: "hms" },
      { key: "/it-asset-dashboard",       icon: <DesktopOutlined />,           label: "Facilities & Assets", permission: PERMS.HRMS_ASSET_MANAGE, module: "hms" },
    ],
  },
  {
    key: "/project-ms",
    icon: <ProjectOutlined />,
    label: "Project MS",
    module: "project",
    children: [
      { key: "/dashboard",    icon: <DashboardOutlined />,   label: "Dashboard",  permission: PERMS.DASHBOARD_PROJECT, module: "project" },
      { key: "/projects",     icon: <ProjectOutlined />,     label: "Projects",   permission: PERMS.PROJECT_VIEW, module: "project" },
      { key: "/tickets",      icon: <DatabaseOutlined />,    label: "Tickets",    permission: PERMS.PROJECT_TICKET_VIEW, module: "project" },
      { key: "/allocation",   icon: <ApartmentOutlined />,   label: "Allocation", permission: PERMS.PROJECT_ALLOCATION_VIEW, module: "project" },
      { key: "/timesheets", label: "Timesheets", anyOf: [PERMS.PROJECT_TIMESHEET_VIEW, PERMS.PROJECT_TIMESHEET_APPROVE], module: "project" },
      { key: "/reports", icon: <BarChartOutlined />, label: "Reports", permission: PERMS.PROJECT_REPORT_UTILIZATION, module: "project" },
    ],
  },
  {
    key: "/workspace",
    icon: <CheckCircleOutlined />,
    label: "Workspace",
    module: "workspace",
    children: [
      { key: "/workspace/dashboard",  icon: <DashboardOutlined />,   label: "Dashboard", module: "workspace" },
      { key: "/workspace/todos",      icon: <OrderedListOutlined />, label: "To-Do", module: "workspace" },
      { key: "/workspace/followups",  icon: <PhoneOutlined />,       label: "Follow-up", module: "workspace" },
      { key: "/workspace/meetings",   icon: <CalendarOutlined />,    label: "Meetings", module: "workspace" },
      { key: "/workspace/calendar",   icon: <CalendarOutlined />,    label: "Calendar", module: "workspace" },
    ],
  },
  {
    key: "/crm",
    icon: <ShopOutlined />,
    label: "CRM",
    module: "crm",
    anyOf: ANY_CRM_VIEW,
    children: [
      { key: "/clients",             icon: <BankOutlined />,       label: "Client",          permission: PERMS.PROJECT_CLIENT_VIEW, module: "crm" },
      { key: "/finance/documents",   icon: <FileTextOutlined />,   label: "Quotation",       permission: PERMS.FINANCE_DOCUMENT_VIEW, module: "crm" },
      { key: "/crm/leads",           icon: <TeamOutlined />,       label: "Lead Management", permission: PERMS.CRM_LEAD_VIEW,  module: "crm" },
      { key: "/crm/sales",           icon: <RiseOutlined />,       label: "Sales Management", permission: PERMS.CRM_LEAD_VIEW, module: "crm" },
      { key: "/crm/documents",       icon: <FolderOpenOutlined />, label: "Documents",       permission: PERMS.CRM_LEAD_VIEW, module: "crm" },
    ],
  },
  {
    key: "/finance",
    icon: <DollarOutlined />,
    label: "Finance",
    module: "finance",
    anyOf: ANY_FINANCE_VIEW,
    children: [
      { key: "/payment/dashboard",   icon: <FundOutlined />,        label: "Dashboard",          permission: PERMS.PAYMENT_DASHBOARD_VIEW, module: "finance" },
      { key: "/payment/invoices",    icon: <FileSearchOutlined />,  label: "Invoice",            permission: PERMS.PAYMENT_INVOICE_VIEW, module: "finance" },
      { key: "/payment/payments",    icon: <WalletOutlined />,      label: "Payment",            permission: PERMS.PAYMENT_PAYMENT_VIEW, module: "finance" },
      { key: "/payment/milestones",  icon: <OrderedListOutlined />, label: "Milestone Billing",  permission: PERMS.PAYMENT_INVOICE_VIEW, module: "finance" },
      { key: "/expenses",            icon: <CreditCardOutlined />,  label: "Expenses & Reimbursements", anyOf: [PERMS.DASHBOARD_OWN, PERMS.CRM_EXPENSE_VIEW], module: "finance" },
      { key: "/payment/receivables", icon: <BarChartOutlined />,    label: "Receivable Summary", permission: PERMS.PAYMENT_DASHBOARD_VIEW, module: "finance" },
    ],
  },
  {
    key: "/chat",
    icon: <MessageOutlined />,
    label: "Chat",
    module: "chat",
    anyOf: [PERMS.CHAT_VIEW, PERMS.DASHBOARD_OWN],
  },
  {
    key: "/policy-documents",
    icon: <FileProtectOutlined />,
    label: "Policy Documents",
    module: "policy",
    permission: PERMS.POLICY_VIEW,
  },
  {
    key: "/master",
    icon: <SettingOutlined />,
    label: "Master",
    module: "master",
    anyOf: ANY_MASTER_VIEW,
  },
  {
    key: "/settings/roles",
    icon: <SafetyCertificateOutlined />,
    label: "Roles & Permissions",
    module: "role",
    permission: PERMS.ROLE_VIEW,
  },
  {
    key: "/settings/plan",
    icon: <CreditCardOutlined />,
    label: "Plan & Usage",
    module: "plan",
    workspaceAdminOnly: true,
  },
  {
    key: "/platform/tenants",
    icon: <CloudServerOutlined />,
    label: "Workspaces",
    platformAdminOnly: true,
  },
];

/** Top-level dashboard links — each shown separately when the user has permission. */
const TOP_DASHBOARD_NAV_ITEMS: NavItem[] = [
  { key: "/executive-dashboard", icon: <BarChartOutlined />, label: "Executive Dashboard", permission: PERMS.DASHBOARD_EXECUTIVE, module: "executive" },
  { key: "/my-dashboard",       icon: <HomeOutlined />,        label: "Home",              permission: PERMS.DASHBOARD_OWN, module: "hms" },
];

function visibleTopDashboardNavItems(
  user: ReturnType<typeof useAuthStore.getState>["user"],
  permissions: string[],
  isPlatformTenant: boolean,
  modules: string[] | null | undefined,
): NavItem[] {
  return TOP_DASHBOARD_NAV_ITEMS.filter((item) =>
    canSeeNavItem(item, user, permissions, { isPlatformTenant, modules }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar CSS injected once — keeps all animation logic in one place
// ─────────────────────────────────────────────────────────────────────────────
const SIDEBAR_CSS = `
  .bms-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    margin: 3px 10px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 400;
    color: rgba(255,255,255,0.6);
    transition:
      transform 0.15s ease-in-out,
      background 0.15s ease-in-out,
      color 0.15s ease-in-out;
    transform-origin: left center;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
  }
  .bms-nav-item:hover {
    transform: translateX(2px);
    color: #ffffff;
    background: rgba(255,255,255,0.06);
  }
  .bms-nav-item:hover .bms-nav-icon {
    transform: scale(1.1);
  }
  .bms-nav-item.bms-active {
    background: var(--bms-primary, #1a73e8);
    color: #ffffff;
    font-weight: 500;
  }
  .bms-nav-item.bms-active .bms-nav-icon {
    transform: scale(1.05);
  }
  .bms-nav-item.bms-parent-open {
    background: rgba(26, 115, 232, 0.1);
    color: #ffffff;
    font-weight: 500;
    border-left: 3px solid var(--bms-primary);
    border-radius: 0 8px 8px 0;
    padding-left: 11px;
  }
  .bms-nav-item.bms-parent-open:hover {
    transform: translateX(3px);
  }
  .bms-nav-icon {
    font-size: 17px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    transition: transform 0.15s ease-in-out;
  }

  /* Child leaf items */
  .bms-child-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13.5px;
    color: rgba(255,255,255,0.5);
    transition:
      transform 0.15s ease-in-out,
      background 0.15s ease-in-out,
      color 0.15s ease-in-out;
    transform-origin: left center;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
  }
  .bms-child-item:hover {
    transform: translateX(3px);
    color: #ffffff;
    background: rgba(255,255,255,0.05);
  }

  .bms-child-item.bms-active {
    background: var(--bms-primary, #1a73e8);
    color: #ffffff;
    font-weight: 500;
  }

  .bms-child-pip {
    width: 3px;
    height: 14px;
    border-radius: 4px;
    background: rgba(255,255,255,0.12);
    flex-shrink: 0;
    transition: transform 0.15s ease, background 0.15s ease, height 0.15s ease;
  }
  .bms-child-item:hover .bms-child-pip {
    background: #8ab4f8;
    height: 18px;
  }
  .bms-child-item.bms-active .bms-child-pip {
    background: #ffffff;
    height: 18px;
  }

  /* Arrow rotation */
  .bms-nav-arrow {
    font-size: 9px;
    opacity: 0.5;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease;
    display: flex;
    align-items: center;
  }
  .bms-nav-item:hover .bms-nav-arrow {
    opacity: 0.8;
  }
  .bms-nav-arrow.open {
    transform: rotate(90deg);
  }

  /* Children container — thin connector line */
  .bms-children {
    margin-left: 20px;
    margin-right: 10px;
    border-left: 1px solid rgba(255,255,255,0.06);
    padding-left: 2px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    margin-top: 0;
    margin-bottom: 0;
    transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.25s ease-in-out,
                margin 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .bms-children.expanded {
    max-height: 420px;
    opacity: 1;
    margin-top: 2px;
    margin-bottom: 4px;
  }

  /* Collapsed tooltip target */
  .bms-collapsed-item {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 0;
    margin: 2px 8px;
    border-radius: 8px;
    cursor: pointer;
    color: rgba(255,255,255,0.6);
    transition:
      transform 0.15s ease-in-out,
      background 0.15s ease-in-out,
      color 0.15s ease-in-out;
    transform-origin: center;
  }
  .bms-collapsed-item:hover {
    transform: scale(1.08);
    color: #ffffff;
    background: rgba(255,255,255,0.07);
  }
  .bms-collapsed-item.bms-active {
    background: var(--bms-primary, #1a73e8);
    color: #ffffff;
  }

  /* Section label */
  .bms-section-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: rgba(255,255,255,0.22);
    padding: 16px 24px 6px;
    text-transform: uppercase;
  }

  /* Scrollbar */
  .bms-nav-scroll::-webkit-scrollbar { width: 3px; }
  .bms-nav-scroll::-webkit-scrollbar-track { background: transparent; }
  .bms-nav-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
  .bms-nav-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }

  /* Header icon buttons */
  .bms-header-icon-btn {
    width: 34px; height: 34px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid var(--bms-border);
    background: var(--bms-surface);
    transition: all 0.15s ease-in-out;
  }
  .bms-header-icon-btn:hover {
    background: var(--bms-primary-light);
    border-color: var(--bms-primary);
    transform: translateY(-1px);
  }

`;

// Inject CSS once
if (typeof document !== "undefined" && !document.getElementById("bms-sidebar-css")) {
  const style = document.createElement("style");
  style.id = "bms-sidebar-css";
  style.textContent = SIDEBAR_CSS;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarItem
// ─────────────────────────────────────────────────────────────────────────────
function SidebarItem({
  item,
  collapsed,
  depth = 0,
  onNavigate,
  openParentKey,
  setOpenParentKey,
}: {
  item: NavItem;
  collapsed: boolean;
  depth?: number;
  onNavigate?: () => void;
  openParentKey?: string | null;
  setOpenParentKey?: (key: string | null) => void;
}) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = useAuthStore((s) => s.user);
  const userPerms = useAuthStore((s) => s.permissions);
  const isPlatformTenant = !!useTenantStore((s) => s.tenant?.is_platform);
  const planModules = useTenantStore((s) => s.tenant?.modules);
  const navOpts = { isPlatformTenant, modules: planModules };

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const handleKey = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  const open = openParentKey === item.key;
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    if (!setOpenParentKey) return;
    if (typeof v === "function") {
      const nextVal = v(open);
      setOpenParentKey(nextVal ? item.key : null);
    } else {
      setOpenParentKey(v ? item.key : null);
    }
  };

  const isLeafActive = !item.children && (
    location.pathname === item.key ||
    (depth === 0 && location.pathname.startsWith(item.key + "/"))
  );
  const isParentOpen = !!item.children &&
    (item.children ?? []).some((c) => isChildActive(c, location.pathname));

  // ── Collapsed mode: icon only with tooltip ──────────────────────────────
  if (collapsed) {
    const firstVisibleChild = item.children?.find((c) =>
      canSeeNavItem(c, user, userPerms, navOpts)
    );

    return (
      <Tooltip title={item.label} placement="right">
        <div
          role="button"
          tabIndex={0}
          aria-label={item.label}
          className={`bms-collapsed-item${isLeafActive || isParentOpen ? " bms-active" : ""}`}
          onClick={() => {
            // Navigate to first child if parent, otherwise navigate to the leaf
            if (firstVisibleChild) {
              go(firstVisibleChild.key);
            } else if (!item.children) {
              go(item.key);
            }
          }}
          onKeyDown={(e) => handleKey(e, () => {
            if (firstVisibleChild) {
              go(firstVisibleChild.key);
            } else if (!item.children) {
              go(item.key);
            }
          })}
        >
          <span style={{ fontSize: 17 }}>{item.icon ?? <span style={{ width: 17 }} />}</span>
        </div>
      </Tooltip>
    );
  }

  // ── Parent (group) row ──────────────────────────────────────────────────
  if (item.children) {
    const visibleChildren = (item.children ?? []).filter((child) =>
      canSeeNavItem(child, user, userPerms, navOpts)
    );
    if (!visibleChildren.length) return null;

    return (
      <div>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          className={`bms-nav-item${isParentOpen ? " bms-parent-open" : ""}`}
          style={{ justifyContent: "space-between" }}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => handleKey(e, () => setOpen((v) => !v))}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11, overflow: "hidden" }}>
            {item.icon != null && <span className="bms-nav-icon">{item.icon}</span>}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
          </div>
          <span className={`bms-nav-arrow${open ? " open" : ""}`}>
            <RightOutlined />
          </span>
        </div>

        <div className={`bms-children${open ? " expanded" : ""}`}>
          {visibleChildren.map((child) => (
            <SidebarItem
              key={child.key}
              item={child}
              collapsed={false}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Leaf item (depth 0 = top-level, depth > 0 = child) ─────────────────
  if (depth > 0) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-current={isLeafActive ? "page" : undefined}
        className={`bms-child-item${isLeafActive ? " bms-active" : ""}`}
        onClick={() => go(item.key)}
        onKeyDown={(e) => handleKey(e, () => go(item.key))}
      >
        <span className="bms-child-pip" />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.label}
        </span>
        {item.badge != null && (
          <span style={{
            background: "rgba(22,119,255,0.25)",
            color: "#60a5fa",
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 20,
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {item.badge}
          </span>
        )}
      </div>
    );
  }

  // Top-level leaf (no children)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isLeafActive ? "page" : undefined}
      className={`bms-nav-item${isLeafActive ? " bms-active" : ""}`}
      onClick={() => go(item.key)}
      onKeyDown={(e) => handleKey(e, () => go(item.key))}
    >
      {item.icon != null && <span className="bms-nav-icon">{item.icon}</span>}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
        {item.label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App Layout
// ─────────────────────────────────────────────────────────────────────────────
export default function AppLayout() {
  const [searchParams] = useSearchParams();
  const showAddClient = searchParams.get("add_client") === "true";
  const showAddProject = searchParams.get("add_project") === "true";
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate  = useNavigate();
  const dark      = useDarkMode();
  const { user, permissions, logout } = useAuthStore();
  const tenant = useTenantStore((s) => s.tenant);
  const isPlatformTenant = !!tenant?.is_platform;
  const planModules = tenant?.modules;
  const brandLogoUrl = tenant?.logo_url || null;
  const brandName = tenant?.name || "AlMax";
  const navOpts = { isPlatformTenant, modules: planModules };

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  const closeMobileNav = () => {
    if (isMobile) setMobileNavOpen(false);
  };

  const toggleSidebar = () => {
    if (isMobile) setMobileNavOpen((open) => !open);
    else setCollapsed((c) => !c);
  };

  const canViewWorkspaceCalendar =
    !isPlatformTenant &&
    hasAnyPermission(user, permissions, [
      PERMS.CRM_FOLLOWUP_VIEW,
      PERMS.WORKSPACE_CALENDAR_VIEW,
    ]);

  const pageBg       = "var(--bms-bg)";
  const headerBg     = "var(--bms-surface)";
  const headerBorder = "var(--bms-border)";
  const headerShadow = "var(--bms-header-shadow)";
  const iconColor    = dark ? "#8c9ab0" : "#5a6a7e";

  const siderExpanded = isMobile ? true : !collapsed;
  const siderWidth = siderExpanded ? 240 : 64;
  const mainMargin = isMobile ? 0 : siderWidth;

  const visibleNavItems = [
    ...visibleTopDashboardNavItems(user, permissions, isPlatformTenant, planModules),
    ...NAV_ITEMS_WITHOUT_DASHBOARD.filter((item) =>
      canSeeNavItem(item, user, permissions, navOpts),
    ),
  ];

  const [openParentKey, setOpenParentKey] = useState<string | null>(() => {
    const activeParent = visibleNavItems.find(
      (item) => item.children && item.children.some((c) => isChildActive(c, location.pathname))
    );
    return activeParent ? activeParent.key : null;
  });

  useEffect(() => {
    const activeParent = visibleNavItems.find(
      (item) => item.children && item.children.some((c) => isChildActive(c, location.pathname))
    );
    setOpenParentKey(activeParent ? activeParent.key : null);
  }, [location.pathname]);

  const lastLoginLabel = user?.last_login
    ? (() => {
        const d = new Date(user.last_login);
        return d.toLocaleString("en-IN", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: true,
        });
      })()
    : null;

  const userMenu = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "My Profile",
      onClick: () => navigate("/settings"),
    },
    ...(lastLoginLabel
      ? [
          { type: "divider" as const },
          {
            key: "last-login",
            icon: <ClockCircleOutlined style={{ color: "#8c9ab0" }} />,
            disabled: true,
            label: (
              <span style={{ fontSize: 12, color: "#5a6a7e" }}>
                Last login:{" "}
                <strong style={{ fontWeight: 500 }}>{lastLoginLabel}</strong>
              </span>
            ),
          },
        ]
      : []),
    { type: "divider" as const },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Sign Out",
      onClick: logout,
      danger: true,
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: pageBg }}>
      <a href="#bms-main-content" className="bms-skip-link">
        Skip to main content
      </a>

      {isMobile && mobileNavOpen && (
        <div
          className="bms-mobile-backdrop visible"
          aria-hidden
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <Sider
        width={240}
        collapsedWidth={64}
        collapsed={!siderExpanded}
        trigger={null}
        className={`bms-app-sider${isMobile && mobileNavOpen ? " bms-app-sider--open" : ""}`}
        style={{
          background: "#0a1628",
          position: "fixed",
          height: "100vh",
          left: 0, top: 0, bottom: 0,
          zIndex: 100,
          transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          overflow: "hidden",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/*
          antd renders Sider's children inside its own .ant-layout-sider-children
          wrapper, one level below the <aside> this `style` prop targets — so
          flex column here never reached the logo/nav/footer siblings below.
          This inner div is the real flex container.
        */}
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Logo */}
        <div style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          padding: siderExpanded ? "0 16px" : "0 14px",
          justifyContent: siderExpanded ? "flex-start" : "center",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          gap: 10,
          overflow: "hidden",
        }}>
          <div style={{
            width: 34, height: 34,
            borderRadius: 9,
            background: "#ffffff",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
            cursor: "pointer",
            overflow: "hidden",
            padding: brandLogoUrl ? 2 : 0,
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.12) rotate(-4deg)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1) rotate(0deg)"; }}
          >
            <img
              src={brandLogoUrl || logoImage}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = logoImage;
              }}
              alt="Logo"
              width="28"
              height="28"
              style={{ objectFit: "contain", width: "100%", height: "100%", borderRadius: 6 }}
            />
          </div>
          {siderExpanded && (
            <div style={{ overflow: "hidden", minWidth: 0 }}>
              {/* Clamp to two lines instead of a single nowrap line so
                  non-Latin names (e.g. Tamil) keep their vowel signs and
                  aren't cut short. */}
              <div title={brandName} style={{
                color: "#fff", fontWeight: 700, fontSize: 14,
                lineHeight: 1.35, maxWidth: 160,
                display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
                overflow: "hidden", wordBreak: "break-word",
              }}>
                {brandName}
              </div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                {brandLogoUrl ? "Enterprise Workspace" : "Your Business Ally"}
              </div>
            </div>
          )}
        </div>

        {/* ── Scrollable nav ── */}
        <div
          className="bms-nav-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "10px 0 24px",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.1) transparent",
          }}
        >
          {siderExpanded && (
            <div className="bms-section-label">Navigation</div>
          )}

          {visibleNavItems.map((item) => (
            <SidebarItem
              key={item.key}
              item={item}
              collapsed={!siderExpanded}
              onNavigate={closeMobileNav}
              openParentKey={openParentKey}
              setOpenParentKey={setOpenParentKey}
            />
          ))}

          <div style={{ height: 32 }} />
        </div>

        {/* ── Footer: platform branding + version + legal links ── */}
        <div style={{
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: siderExpanded ? "12px 16px" : "12px 0",
          display: "flex",
          flexDirection: siderExpanded ? "row" : "column",
          alignItems: siderExpanded ? "flex-start" : "center",
          gap: siderExpanded ? 8 : 6,
        }}>
          <div style={{
            width: 22, height: 22,
            borderRadius: 6,
            background: "#ffffff",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <img src={logoImage} alt="AlMax" width="16" height="16" style={{ objectFit: "contain" }} />
          </div>
          {siderExpanded ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11.5, fontWeight: 600 }}>
                AlMax
              </span>
              <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 10.5 }}>
                v{__APP_VERSION__}
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <Link
                  to="/terms"
                  target="_blank"
                  style={{ color: "rgba(255,255,255,0.32)", fontSize: 10.5 }}
                >
                  Terms
                </Link>
                <Link
                  to="/privacy"
                  target="_blank"
                  style={{ color: "rgba(255,255,255,0.32)", fontSize: 10.5 }}
                >
                  Privacy
                </Link>
              </div>
            </div>
          ) : (
            <Tooltip title={`AlMax v${__APP_VERSION__}`} placement="right">
              <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 9 }}>
                v{__APP_VERSION__}
              </span>
            </Tooltip>
          )}
        </div>
        </div>
      </Sider>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <Layout style={{
        marginLeft: mainMargin,
        width: `calc(100% - ${mainMargin}px)`,
        transition: "margin-left 0.22s cubic-bezier(0.4,0,0.2,1), width 0.22s cubic-bezier(0.4,0,0.2,1)",
        background: pageBg,
        height: "100vh",
        minWidth: 0,
      }}>

        {/* Header */}
        <Header
          className="bms-app-header"
          style={{
            padding: isMobile ? "0 12px" : "0 24px",
            background: headerBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "nowrap",
            borderBottom: `1px solid ${headerBorder}`,
            height: 64,
            minHeight: 64,
            position: "sticky",
            top: 0,
            zIndex: 99,
            boxShadow: headerShadow,
          }}
        >
          <Space size={isMobile ? 8 : 16} style={{ minWidth: 0 }}>
            <Button
              type="text"
              aria-label={isMobile ? (mobileNavOpen ? "Close navigation" : "Open navigation") : (collapsed ? "Expand sidebar" : "Collapse sidebar")}
              icon={React.createElement(
                isMobile ? MenuUnfoldOutlined : (collapsed ? MenuUnfoldOutlined : MenuFoldOutlined),
                { style: { fontSize: 18, color: iconColor } },
              )}
              onClick={toggleSidebar}
            />
            {!isMobile && !isPlatformTenant && <GlobalSearch />}
          </Space>

          <Space size={isMobile ? 6 : 12} className="bms-header-actions-compact">
            <ThemeToggle />

            {!isMobile && canViewWorkspaceCalendar && (
              <Tooltip title="Workspace calendar">
                <button
                  type="button"
                  className="bms-header-icon-btn"
                  aria-label="Workspace calendar"
                  onClick={() => setCalendarOpen(true)}
                >
                  <CalendarOutlined style={{ fontSize: 16, color: iconColor }} />
                </button>
              </Tooltip>
            )}

            {!isMobile && !isPlatformTenant && (
              <Tooltip title="Org Chart">
                <button
                  type="button"
                  className="bms-header-icon-btn"
                  aria-label="Organisation chart"
                  onClick={() => setOrgOpen(true)}
                >
                  <ApartmentOutlined style={{ fontSize: 16, color: iconColor }} />
                </button>
              </Tooltip>
            )}

            {/* Notifications live in tenant schemas; the control plane has none. */}
            {!isPlatformTenant && <NotificationBell iconColor={iconColor} />}

            <Dropdown
              menu={{ items: userMenu }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <button
                type="button"
                aria-label="User menu"
                style={{
                  cursor: "pointer",
                  padding: isMobile ? "4px" : "4px 8px",
                  borderRadius: 8,
                  transition: "background 0.15s",
                  border: "none",
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Space>
                  <Avatar
                    size={32}
                    src={user?.profile_picture_url || undefined}
                    icon={!user?.profile_picture_url ? <UserOutlined /> : undefined}
                    style={{ background: "var(--bms-primary)", flexShrink: 0 }}
                  />
                  {!isMobile && (
                    <div className="bms-user-name-block" style={{ lineHeight: 1.3, textAlign: "left" }}>
                      <Text style={{
                        fontSize: 13, fontWeight: 600, display: "block",
                        color: "var(--bms-text)",
                      }}>
                        {user?.full_name || user?.username}
                      </Text>
                      <Text style={{ fontSize: 11, color: "var(--bms-text-2)" }}>
                        {user?.designation || (user?.is_pmo ? "PMO" : user?.is_manager ? "Manager" : "Member")}
                      </Text>
                    </div>
                  )}
                </Space>
              </button>
            </Dropdown>
          </Space>
        </Header>

        {/* Page content */}
        <Content
          id="bms-main-content"
          style={{
            background: pageBg,
            overflow: location.pathname.includes("/chat") ? "hidden" : "auto",
            padding: location.pathname.includes("/chat") ? 0 : 24,
            height: "calc(100vh - 64px)",
            maxHeight: "calc(100vh - 64px)",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Outlet />
          {(showAddClient || showAddProject) && (
            <div style={{
              position: 'fixed',
              top: 64,
              left: isMobile ? 0 : (siderExpanded ? 240 : 64),
              right: 0,
              bottom: 0,
              /* Stay below antd's default Modal/Drawer z-index (1000) so any
                 modal opened from within this overlay (e.g. "Add Client")
                 still renders on top of it instead of behind it. */
              zIndex: 900,
              background: pageBg,
              overflow: 'auto',
              padding: 24,
            }}>
              {showAddClient && <ClientFormPage />}
              {showAddProject && <ProjectFormPage />}
            </div>
          )}
        </Content>
      </Layout>

      {/* Org Chart modal */}
      <Modal
        open={orgOpen}
        onCancel={() => setOrgOpen(false)}
        footer={null}
        width="90vw"
        style={{ top: 20 }}
        styles={{ body: { padding: 0, height: "80vh", overflow: "hidden" } }}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ApartmentOutlined style={{ color: "#1a73e8" }} />
            <span>Organisation Chart</span>
          </div>
        }
        destroyOnHidden
      >
        <div style={{ height: "100%", overflow: "hidden" }}>
          <OrgChart />
        </div>
      </Modal>

      {canViewWorkspaceCalendar && (
        <WorkspaceCalendarModal
          open={calendarOpen}
          onClose={() => setCalendarOpen(false)}
        />
      )}
      {!isPlatformTenant && <DailyDueNotification />}
      <GlobalCallListener />
    </Layout>
  );
}
