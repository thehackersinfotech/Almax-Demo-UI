import type { BmsPermission } from "@/constants/permissions";
import { PERMS } from "@/constants/permissions";
import type { AuthUser } from "@/store/auth";

/** Staff / Django superuser bypass Keycloak permission checks. */
export function hasFullAccess(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.is_staff || user.is_superuser);
}

/** Tenant-side admin: workspace owner (is_staff) or the Keycloak "Admin" role. */
export function isWorkspaceAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (hasFullAccess(user)) return true;
  return (user.keycloak_group ?? "").toLowerCase() === "admin";
}

export function hasPermission(
  user: AuthUser | null | undefined,
  permissions: string[],
  permission: BmsPermission,
): boolean {
  if (!user) return false;
  if (hasFullAccess(user)) return true;
  return (
    permissions.includes(permission) ||
    permissions.includes(permission.replace("bms.", "pmt.") as BmsPermission)
  );
}

export function hasAnyPermission(
  user: AuthUser | null | undefined,
  permissions: string[],
  anyOf: BmsPermission[],
): boolean {
  if (!user) return false;
  if (hasFullAccess(user)) return true;
  return anyOf.some(
    (p) =>
      permissions.includes(p) ||
      permissions.includes(p.replace("bms.", "pmt.") as BmsPermission)
  );
}

export function hasAllPermissions(
  user: AuthUser | null | undefined,
  permissions: string[],
  allOf: BmsPermission[],
): boolean {
  if (!user) return false;
  if (hasFullAccess(user)) return true;
  return allOf.every(
    (p) =>
      permissions.includes(p) ||
      permissions.includes(p.replace("bms.", "pmt.") as BmsPermission)
  );
}

/** Post-login / default route — platform panel vs business home. */
export function resolveLandingPath(
  user: AuthUser | null | undefined,
  permissions: string[],
  opts?: { isPlatformTenant?: boolean; modules?: string[] | null },
): string {
  if (permissions.includes("bms.workspace.dashboard.view")) {
    return "/workspace/dashboard";
  }

  if (opts?.isPlatformTenant) {
    return "/platform/tenants";
  }
  const modules = opts?.modules;
  const hasModule = (key: string) =>
    !Array.isArray(modules) || modules.includes(key);

  if (hasPermission(user, permissions, PERMS.DASHBOARD_OWN)) return "/my-dashboard";
  if (
    hasModule("project") &&
    hasPermission(user, permissions, PERMS.DASHBOARD_PROJECT)
  ) {
    return "/dashboard";
  }
  if (hasPermission(user, permissions, PERMS.DASHBOARD_HRMS)) return "/hrms-dashboard";
  if (
    hasModule("executive") &&
    hasPermission(user, permissions, PERMS.DASHBOARD_EXECUTIVE)
  ) {
    return "/executive-dashboard";
  }
  return "/my-dashboard";
}

/**
 * Master configuration access rule:
 * Evaluated dynamically based on user permissions without hardcoding roles or groups.
 */
export function canAccessMaster(
  user: AuthUser | null | undefined,
  permissions: string[],
): boolean {
  if (!user) return false;
  if (hasFullAccess(user)) return true;

  return hasAnyPermission(user, permissions, [
    PERMS.MASTER_HRMS_VIEW,
    PERMS.MASTER_HRMS_CREATE,
    PERMS.MASTER_HRMS_UPDATE,
    PERMS.MASTER_CLIENT_VIEW,
    PERMS.MASTER_PROJECT_VIEW,
    PERMS.MASTER_WORKFLOW_VIEW,
    PERMS.CRM_EXPENSE_VIEW,
  ]);
}

export interface NavPermissionItem {
  key?: string;
  permission?: BmsPermission;
  anyOf?: BmsPermission[];
  children?: NavPermissionItem[];
  /** Platform control-plane only (superuser on an is_platform workspace). */
  platformAdminOnly?: boolean;
  /** Tenant admin only (is_staff / Admin role inside a business workspace). */
  workspaceAdminOnly?: boolean;
  /** Commercial plan module key (hms, project, crm, …). */
  module?: string;
}

export type NavVisibilityOpts = {
  /** Current workspace is a platform control-plane tenant. */
  isPlatformTenant?: boolean;
  /** Modules entitled by the tenant's plan. */
  modules?: string[] | null;
};

/**
 * Whether a sidebar nav item (or any of its children) should be shown.
 *
 * Platform workspaces: only Platform Tenants (no HMS/PMS/CRM).
 * Business workspaces: normal modules filtered by plan entitlement.
 */
export function canSeeNavItem(
  item: NavPermissionItem,
  user: AuthUser | null | undefined,
  permissions: string[],
  opts?: NavVisibilityOpts,
): boolean {
  const isPlatform = !!opts?.isPlatformTenant;

  if (item.children?.length) {
    return item.children.some((c) => canSeeNavItem(c, user, permissions, opts));
  }
  if (!user) return false;

  if (isPlatform) {
    if (item.platformAdminOnly) {
      return !!user.is_superuser;
    }
    return false;
  }

  if (item.platformAdminOnly) {
    return isPlatform && (!!user.is_superuser || !!user.is_staff || hasFullAccess(user));
  }

  if (item.module && opts?.modules && Array.isArray(opts.modules) && !opts.modules.includes(item.module)) {
    return false;
  }

  if (item.workspaceAdminOnly && !isWorkspaceAdmin(user)) return false;

  // Special gate for /master menu — restricted to Admin, HR, Reporting Manager, or assigned permission
  if (item.key === "/master") {
    return canAccessMaster(user, permissions);
  }

  if (item.anyOf?.length) return hasAnyPermission(user, permissions, item.anyOf);
  if (!item.permission) return true;
  return hasPermission(user, permissions, item.permission);
}

export function masterCrudPerms(scope: "hrms" | "client" | "project") {
  if (scope === "hrms") {
    return {
      create: PERMS.MASTER_HRMS_CREATE,
      update: PERMS.MASTER_HRMS_UPDATE,
      delete: PERMS.MASTER_HRMS_DELETE,
    };
  }
  if (scope === "client") {
    return {
      create: PERMS.MASTER_CLIENT_CREATE,
      update: PERMS.MASTER_CLIENT_UPDATE,
      delete: PERMS.MASTER_CLIENT_DELETE,
    };
  }
  return {
    create: PERMS.MASTER_PROJECT_CREATE,
    update: PERMS.MASTER_PROJECT_UPDATE,
    delete: PERMS.MASTER_PROJECT_DELETE,
  };
}
