import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { PERMS } from "@/constants/permissions";
import { resolveLandingPath } from "@/utils/access";
import { useTenantStore } from "@/store/tenant";
import AppLayout from "@/components/layout/AppLayout";

import RequirePermission from "@/components/common/RequirePermission";
import RequirePlatformAdmin from "@/components/common/RequirePlatformAdmin";
import RequireWorkspaceAdmin from "@/components/common/RequireWorkspaceAdmin";
import TenantGate from "@/components/auth/TenantGate";
import LoginPage from "@/pages/auth/LoginPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import VerifyCodePage from "@/pages/auth/VerifyCodePage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import SetPasswordPage from "@/pages/auth/SetPasswordPage";
import TermsOfServicePage from "@/pages/legal/TermsOfServicePage";
import PrivacyPolicyPage from "@/pages/legal/PrivacyPolicyPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import ProjectsPage from "@/pages/projects/ProjectsPage";
import ProjectDetailPage from "@/pages/projects/ProjectDetailPage";
import TicketsPage from "@/pages/tickets/TicketsPage";
import TicketDetailPage from "@/pages/tickets/TicketDetailPage";
import TimesheetPage from "@/pages/timesheets/TimesheetPage";
import AllocationPage from "@/pages/allocation/AllocationPage";
import EmployeesPage from "@/pages/employees/EmployeesPage";
import EmployeeDetailPage from "@/pages/employees/EmployeeDetailPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import ClientFormPage from "@/pages/clients/ClientFormPage";
import ProjectFormPage from "@/pages/projects/ProjectFormPage";
import ClientPage from "@/pages/clients/ClientPage";
import MasterPage from "@/pages/master/MasterPage";
import EmployeeDashboardPage from "@/pages/dashboard/EmployeeDashboardPage";
import HRMSDashboardPage from "@/pages/dashboard/HRMSDashboardPage";
import LeaveRequestsPage from "@/pages/employees/LeaveRequestsPage";
import PayrollPage from "@/pages/employees/PayrollPage";
import AttendanceTrackerPage from "@/pages/attendance/AttendanceTrackerPage";
import AttendanceHRPage from "@/pages/attendance/AttendanceHRPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import RoleManagementPage from "@/pages/settings/RoleManagementPage";
import RoleDetailPage from "@/pages/settings/RoleDetailPage";
import PlanUsagePage from "@/pages/settings/PlanUsagePage";
import PlatformTenantsPage from "@/pages/platform/PlatformTenantsPage";
import HRCompliancePage from "@/pages/employees/HRCompliancePage";
import OnboardingPage from "@/pages/employees/OnboardingPage";
import EmployeeOnboardingPortalPage from "@/pages/employees/EmployeeOnboardingPortalPage";
import OffboardingPage from "@/pages/employees/OffboardingPage";
import MyOffboardingPortalPage from "@/pages/employees/MyOffboardingPortalPage";
import PolicyDocumentsPage from "@/pages/policies/PolicyDocumentsPage";
import ChatPage from "@/pages/chat/ChatPage";
import FinanceListPage from "@/pages/finance/FinanceListPage";
import FinanceFormPage from "@/pages/finance/FinanceFormPage";
import PaymentDashboardPage from "@/pages/payment/PaymentDashboardPage";
import InvoiceListPage from "@/pages/payment/InvoiceListPage";
import InvoiceDetailPage from "@/pages/payment/InvoiceDetailPage";
import PaymentListPage from "@/pages/payment/PaymentListPage";
import MilestoneListPage from "@/pages/payment/MilestoneListPage";
import ReceivableSummaryPage from "@/pages/payment/ReceivableSummaryPage";
import ExpensesPage from "@/pages/expenses/ExpensesPage";
import FollowUpsPage from "@/pages/followups/FollowUpsPage";
import TodosPage from "@/pages/workspace/TodosPage";
import WorkspaceCalendarPage from "@/pages/workspace/WorkspaceCalendarPage";
import MeetingsPage from "@/pages/workspace/MeetingsPage";
import WorkspaceDashboardPage from "@/pages/workspace/WorkspaceDashboardPage";
import ExecutiveDashboardPage from "@/pages/dashboard/ExecutiveDashboardPage";
import ITAssetDashboardPage from "@/pages/employees/ITAssetDashboardPage";
import LeadManagementPage from "@/pages/crm/LeadManagementPage";
import SalesManagementPage from "@/pages/crm/SalesManagementPage";
import CrmDocumentsPage from "@/pages/crm/CrmDocumentsPage";
import { MOCK_USER, MOCK_PERMISSIONS, MOCK_TENANT } from "@/mock/mockApi";

// ── Mock auth bootstrap — auto-login without backend ──────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const setToken     = useAuthStore((s) => s.setToken);
  const setUser      = useAuthStore((s) => s.setUser);
  const setPerms     = useAuthStore((s) => s.setPermissions);
  const setTenant    = useTenantStore((s) => s.setTenant);
  const token        = useAuthStore((s) => s.token);

  // On first mount, inject mock credentials so we're always "logged in"
  useEffect(() => {
    if (!token) {
      setToken("mock-access-token");
      setUser(MOCK_USER);
      setPerms(MOCK_PERMISSIONS);
      setTenant(MOCK_TENANT);
    }
  }, []);

  return <>{children}</>;
}

function DefaultLanding() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const tenant = useTenantStore((s) => s.tenant);
  return (
    <Navigate
      to={resolveLandingPath(user, permissions, {
        isPlatformTenant: !!tenant?.is_platform,
        modules: tenant?.modules,
      })}
      replace
    />
  );
}


export default function App() {
  return (
    <TenantGate>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify-code" element={<VerifyCodePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DefaultLanding />} />
        <Route path="executive-dashboard" element={<RequirePermission permission={PERMS.DASHBOARD_EXECUTIVE}><ExecutiveDashboardPage /></RequirePermission>} />
        <Route path="dashboard" element={<RequirePermission permission={PERMS.DASHBOARD_PROJECT}><DashboardPage /></RequirePermission>} />
        <Route path="hrms-dashboard" element={<RequirePermission permission={PERMS.DASHBOARD_HRMS}><HRMSDashboardPage /></RequirePermission>} />
        <Route path="my-dashboard" element={<RequirePermission permission={PERMS.DASHBOARD_OWN}><EmployeeDashboardPage /></RequirePermission>} />
        <Route path="team-leaves" element={<Navigate to="/employees/leave-requests?tab=team" replace />} />
        <Route path="employees" element={<RequirePermission permission={PERMS.HRMS_EMPLOYEE_VIEW}><EmployeesPage /></RequirePermission>} />
        <Route path="employees/leave-requests" element={
          <RequirePermission permission={PERMS.HRMS_LEAVE_VIEW}>
            <LeaveRequestsPage />
          </RequirePermission>
        } />
        <Route path="employees/payroll" element={<RequirePermission permission={PERMS.HRMS_PAYROLL_VIEW}><PayrollPage /></RequirePermission>} />
        <Route path="attendance/tracker" element={
          <RequirePermission permission={PERMS.HRMS_ATTENDANCE_VIEW}>
            <AttendanceTrackerPage />
          </RequirePermission>
        } />
        <Route path="attendance/admin" element={<RequirePermission permission={PERMS.HRMS_ATTENDANCE_MANAGE}><AttendanceHRPage /></RequirePermission>} />
        <Route path="employees/:id" element={<RequirePermission permission={PERMS.HRMS_EMPLOYEE_VIEW}><EmployeeDetailPage /></RequirePermission>} />
        <Route path="onboarding" element={<RequirePermission anyOf={[PERMS.HRMS_ONBOARDING_VIEW, PERMS.HRMS_ONBOARDING_MANAGE]}><OnboardingPage /></RequirePermission>} />
        <Route path="employee-onboarding" element={<RequirePermission permission={PERMS.HRMS_EMPLOYEE_ONBOARDING}><EmployeeOnboardingPortalPage /></RequirePermission>} />
        <Route path="offboarding" element={<RequirePermission anyOf={[PERMS.HRMS_OFFBOARDING_VIEW, PERMS.HRMS_OFFBOARDING_MANAGE]}><OffboardingPage /></RequirePermission>} />
        <Route path="my-offboarding" element={<RequirePermission permission={PERMS.HRMS_EMPLOYEE_OFFBOARDING}><MyOffboardingPortalPage /></RequirePermission>} />
                <Route path="clients/new" element={<RequirePermission permission={PERMS.PROJECT_CLIENT_VIEW}><ClientFormPage /></RequirePermission>} />
        <Route path="projects/new" element={<RequirePermission permission={PERMS.PROJECT_VIEW}><ProjectFormPage /></RequirePermission>} />
        <Route path="clients" element={<RequirePermission permission={PERMS.PROJECT_CLIENT_VIEW}><ClientPage /></RequirePermission>} />
        <Route path="projects" element={<RequirePermission permission={PERMS.PROJECT_VIEW}><ProjectsPage /></RequirePermission>} />
        <Route path="projects/:id" element={<RequirePermission permission={PERMS.PROJECT_VIEW}><ProjectDetailPage /></RequirePermission>} />
        <Route path="tickets" element={<RequirePermission permission={PERMS.PROJECT_TICKET_VIEW}><TicketsPage /></RequirePermission>} />
        <Route path="tickets/:id" element={<RequirePermission permission={PERMS.PROJECT_TICKET_VIEW}><TicketDetailPage /></RequirePermission>} />
        <Route path="allocation" element={<RequirePermission permission={PERMS.PROJECT_ALLOCATION_VIEW}><AllocationPage /></RequirePermission>} />
        <Route path="timesheets/reporting" element={<Navigate to="/timesheets?tab=team" replace />} />
        <Route path="timesheets" element={
          <RequirePermission anyOf={[PERMS.PROJECT_TIMESHEET_VIEW, PERMS.PROJECT_TIMESHEET_APPROVE]}>
            <TimesheetPage />
          </RequirePermission>
        } />
        <Route path="reports" element={<RequirePermission anyOf={[PERMS.PROJECT_REPORT_UTILIZATION, PERMS.PROJECT_REPORT_PORTFOLIO, PERMS.PROJECT_REPORT_ALLOCATION]}><ReportsPage /></RequirePermission>} />
        <Route path="master" element={
          <RequirePermission anyOf={[
            PERMS.MASTER_HRMS_VIEW,
            PERMS.MASTER_CLIENT_VIEW,
            PERMS.MASTER_PROJECT_VIEW,
            PERMS.MASTER_WORKFLOW_VIEW,
            PERMS.CRM_EXPENSE_VIEW,
          ]}>
            <MasterPage />
          </RequirePermission>
        } />
        <Route path="master/designation" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="designation" /></RequirePermission>} />
        <Route path="master/department" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="department" /></RequirePermission>} />
        <Route path="master/location" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="location" /></RequirePermission>} />
        <Route path="master/employment-type" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="employment-type" /></RequirePermission>} />
        <Route path="master/shift-category" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="shift-category" /></RequirePermission>} />
        <Route path="master/rate-card" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="rate-card" /></RequirePermission>} />
        <Route path="master/holiday" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="holiday" /></RequirePermission>} />
        <Route path="master/leave-type" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="leave-type" /></RequirePermission>} />
        <Route path="master/notice-period" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="notice-period" /></RequirePermission>} />
        <Route path="master/reimbursement" element={<RequirePermission anyOf={[PERMS.MASTER_HRMS_VIEW, PERMS.CRM_EXPENSE_VIEW]}><MasterPage defaultTab="reimbursement" /></RequirePermission>} />
        <Route path="master/reimbursement-config" element={<Navigate to="/master/reimbursement" replace />} />
        <Route path="master/reimbursements" element={<Navigate to="/master/reimbursement" replace />} />
        <Route path="reimbursement" element={<Navigate to="/expenses" replace />} />
        <Route path="reimbursements" element={<Navigate to="/expenses" replace />} />
        <Route path="master/client-category" element={<RequirePermission permission={PERMS.MASTER_CLIENT_VIEW}><MasterPage defaultTab="client-category" /></RequirePermission>} />
        <Route path="master/business-type" element={<RequirePermission anyOf={[PERMS.MASTER_PROJECT_VIEW, PERMS.MASTER_CLIENT_VIEW]}><MasterPage defaultTab="business-type" /></RequirePermission>} />
        <Route path="master/billing-type" element={<RequirePermission anyOf={[PERMS.MASTER_PROJECT_VIEW, PERMS.MASTER_CLIENT_VIEW]}><MasterPage defaultTab="billing-type" /></RequirePermission>} />
        <Route path="master/followup-type" element={<RequirePermission anyOf={[PERMS.MASTER_PROJECT_VIEW, PERMS.MASTER_CLIENT_VIEW]}><MasterPage defaultTab="followup-type" /></RequirePermission>} />
        <Route path="master/workflow" element={<RequirePermission permission={PERMS.MASTER_WORKFLOW_VIEW}><MasterPage defaultTab="workflow" /></RequirePermission>} />
        <Route path="master/company-profile" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="company-profile" /></RequirePermission>} />
        <Route path="master/notification" element={<RequirePermission permission={PERMS.MASTER_HRMS_VIEW}><MasterPage defaultTab="notification" /></RequirePermission>} />
        <Route path="master/configuration" element={<RequirePermission anyOf={[PERMS.MASTER_HRMS_VIEW, PERMS.MASTER_CLIENT_VIEW]}><MasterPage defaultTab="configuration" /></RequirePermission>} />
        <Route path="master/browser-push" element={<RequirePermission anyOf={[PERMS.MASTER_HRMS_VIEW, PERMS.MASTER_CLIENT_VIEW]}><MasterPage defaultTab="browser-push" /></RequirePermission>} />
        <Route path="master/smtp-email" element={<RequirePermission anyOf={[PERMS.MASTER_HRMS_VIEW, PERMS.MASTER_CLIENT_VIEW]}><MasterPage defaultTab="smtp-email" /></RequirePermission>} />
        <Route path="master/mfa" element={<RequirePermission anyOf={[PERMS.MASTER_HRMS_VIEW, PERMS.MASTER_WORKFLOW_VIEW]}><MasterPage defaultTab="mfa" /></RequirePermission>} />
        <Route path="employees/hr-compliance" element={<RequirePermission permission={PERMS.HRMS_COMPLIANCE_VIEW}><HRCompliancePage /></RequirePermission>} />
        <Route path="it-asset-dashboard" element={<RequirePermission anyOf={[PERMS.HRMS_ASSET_MANAGE, PERMS.HRMS_EMPLOYEE_VIEW]}><ITAssetDashboardPage /></RequirePermission>} />
        <Route path="policy-documents" element={<RequirePermission permission={PERMS.POLICY_VIEW}><PolicyDocumentsPage /></RequirePermission>} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="finance/documents" element={<RequirePermission permission={PERMS.FINANCE_DOCUMENT_VIEW}><FinanceListPage /></RequirePermission>} />
        <Route path="finance/documents/new" element={<RequirePermission permission={PERMS.FINANCE_DOCUMENT_CREATE}><FinanceFormPage /></RequirePermission>} />
        <Route path="finance/documents/:id" element={<RequirePermission permission={PERMS.FINANCE_DOCUMENT_VIEW}><FinanceFormPage /></RequirePermission>} />
        {/* Payment & Receivables */}
        <Route path="payment/dashboard"          element={<RequirePermission permission={PERMS.PAYMENT_DASHBOARD_VIEW}><PaymentDashboardPage /></RequirePermission>} />
        <Route path="payment/invoices"           element={<RequirePermission permission={PERMS.PAYMENT_INVOICE_VIEW}><InvoiceListPage /></RequirePermission>} />
        <Route path="payment/invoices/:id"       element={<RequirePermission permission={PERMS.PAYMENT_INVOICE_VIEW}><InvoiceDetailPage /></RequirePermission>} />
        <Route path="payment/payments"           element={<RequirePermission permission={PERMS.PAYMENT_PAYMENT_VIEW}><PaymentListPage /></RequirePermission>} />
        <Route path="payment/milestones"         element={<RequirePermission permission={PERMS.PAYMENT_INVOICE_VIEW}><MilestoneListPage /></RequirePermission>} />
        <Route path="payment/receivables"        element={<RequirePermission permission={PERMS.PAYMENT_DASHBOARD_VIEW}><ReceivableSummaryPage /></RequirePermission>} />
        <Route path="payment/client-receivables" element={<Navigate to="/payment/receivables" replace />} />
        <Route path="payment/project-receivables" element={<Navigate to="/payment/receivables" replace />} />
        <Route path="expenses" element={
          <RequirePermission anyOf={[PERMS.DASHBOARD_OWN, PERMS.CRM_EXPENSE_VIEW]}>
            <ExpensesPage />
          </RequirePermission>
        } />
        <Route path="crm/leads" element={
          <RequirePermission permission={PERMS.CRM_LEAD_VIEW}>
            <LeadManagementPage />
          </RequirePermission>
        } />
        <Route path="crm/sales/*" element={
          <RequirePermission permission={PERMS.CRM_LEAD_VIEW}>
            <SalesManagementPage />
          </RequirePermission>
        } />
        <Route path="crm/sales-management/*" element={<Navigate to="/crm/sales" replace />} />
        <Route path="crm/documents" element={
          <RequirePermission permission={PERMS.CRM_LEAD_VIEW}>
            <CrmDocumentsPage />
          </RequirePermission>
        } />
        <Route path="followups" element={<Navigate to="/workspace/followups" replace />} />
        <Route path="workspace" element={<Navigate to="/workspace/dashboard" replace />} />
        <Route path="workspace/dashboard" element={<WorkspaceDashboardPage />} />
        <Route path="workspace/todos" element={<TodosPage />} />
        <Route path="workspace/followups" element={<FollowUpsPage />} />
        <Route path="workspace/meetings" element={<MeetingsPage />} />
        <Route path="workspace/calendar" element={<WorkspaceCalendarPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/roles" element={<RequirePermission permission={PERMS.ROLE_VIEW}><RoleManagementPage /></RequirePermission>} />
        <Route path="settings/roles/:roleId" element={<RequirePermission permission={PERMS.ROLE_VIEW}><RoleDetailPage /></RequirePermission>} />
        <Route path="settings/plan" element={<RequireWorkspaceAdmin><PlanUsagePage /></RequireWorkspaceAdmin>} />
        <Route path="platform/tenants" element={<RequirePlatformAdmin><PlatformTenantsPage /></RequirePlatformAdmin>} />
      </Route>
      <Route path="*" element={<DefaultLanding />} />
    </Routes>
    </TenantGate>
  );
}
