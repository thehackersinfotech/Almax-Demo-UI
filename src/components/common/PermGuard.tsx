import React from "react";
import { useAuthStore } from "@/store/auth";
import type { BmsPermission } from "@/constants/permissions";
import { hasAllPermissions, hasAnyPermission, hasPermission } from "@/utils/access";

interface Props {
  permission?: BmsPermission;
  anyOf?: BmsPermission[];
  allOf?: BmsPermission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Renders children only when the current user has the required permission(s).
 *
 *   <PermGuard permission="bms.project.create">
 *     <Button>Add Project</Button>
 *   </PermGuard>
 *
 *   <PermGuard anyOf={["bms.project.update", "bms.project.delete"]}>
 *     …
 *   </PermGuard>
 */
export default function PermGuard({ permission, anyOf, allOf, fallback = null, children }: Props) {
  const user        = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  if (!user) return <>{fallback}</>;

  const allowed = (() => {
    if (permission) return hasPermission(user, permissions, permission);
    if (anyOf)      return hasAnyPermission(user, permissions, anyOf);
    if (allOf)      return hasAllPermissions(user, permissions, allOf);
    return true;
  })();

  return <>{allowed ? children : fallback}</>;
}
