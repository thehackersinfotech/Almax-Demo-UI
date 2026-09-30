import { useAuthStore } from "@/store/auth";
import type { BmsPermission } from "@/constants/permissions";
import { hasAllPermissions, hasAnyPermission, hasPermission, masterCrudPerms } from "@/utils/access";

/**
 * Returns true if the current user has the given permission.
 * Staff / superuser bypass; everyone else uses Keycloak-assigned permissions.
 */
export function usePermission(permission: BmsPermission): boolean {
  const user        = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  return hasPermission(user, permissions, permission);
}

/** Returns true if the user has ALL of the listed permissions. */
export function usePermissions(required: BmsPermission[]): boolean {
  const user        = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  return hasAllPermissions(user, permissions, required);
}

/** Returns true if the user has ANY of the listed permissions. */
export function useAnyPermission(anyOf: BmsPermission[]): boolean {
  const user        = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  return hasAnyPermission(user, permissions, anyOf);
}

/** Master data create / update / delete flags for a scope. */
export function useMasterCrud(scope: "hrms" | "client" | "project") {
  const perms = masterCrudPerms(scope);
  return {
    canCreate: usePermission(perms.create),
    canUpdate: usePermission(perms.update),
    canDelete: usePermission(perms.delete),
  };
}
