/**
 * Map product surfaces (master cards, permission names) → commercial plan module keys.
 * Used to hide Master tabs and role-permission groups that the current plan does not include.
 */

export type PlanModuleKey =
  | "hms"
  | "workspace"
  | "master"
  | "policy"
  | "role"
  | "plan"
  | "project"
  | "crm"
  | "finance"
  | "executive"
  | "chat";

/** Whether the tenant's plan includes a module. Unknown / null modules → allow (safe default). */
export function planHasModule(
  modules: string[] | null | undefined,
  module: PlanModuleKey | string | null | undefined,
): boolean {
  if (!module) return true;
  if (!Array.isArray(modules)) return true;
  return modules.includes(module);
}

/**
 * Resolve which plan module a permission string belongs to.
 * Accepts both `bms.*` (frontend) and `pmt.*` (Keycloak) names.
 */
export function planModuleForPermission(name: string): PlanModuleKey | null {
  const n = (name || "")
    .replace(/^bms\./, "")
    .replace(/^pmt\./, "")
    .toLowerCase();

  if (!n) return null;

  if (n.startsWith("dashboard.project")) return "project";
  if (n.startsWith("dashboard.executive")) return "executive";
  if (n.startsWith("dashboard.hrms") || n.startsWith("dashboard.own")) return "hms";

  if (n.startsWith("master.client")) return "crm";
  if (n.startsWith("master.project") || n.startsWith("master.workflow")) return "project";
  if (n.startsWith("master.hrms")) return "hms";

  if (n.startsWith("role.") || n.startsWith("permission.")) return "role";
  if (n.startsWith("plan.")) return "plan";
  if (n.startsWith("hrms.")) return "hms";
  if (n.startsWith("chat.")) return "chat";
  if (n.startsWith("policy.")) return "policy";

  // Clients live under CRM in the product matrix.
  if (n.startsWith("project.client")) return "crm";
  if (n.startsWith("project.")) return "project";

  if (n.startsWith("payment.")) return "finance";
  if (n.startsWith("finance.")) return "finance";
  if (n.startsWith("crm.expense")) return "finance";
  if (n.startsWith("crm.followup")) return "workspace";

  if (n.startsWith("workspace.")) return "workspace";
  if (n.startsWith("social_feed.")) return "workspace";

  return null;
}

/** Filter a permission catalog to categories/items entitled by the plan. */
export function filterPermissionCatalogByPlan<
  T extends { category: string; permissions: { name: string }[] },
>(categories: T[], modules: string[] | null | undefined): T[] {
  if (!Array.isArray(modules)) return categories;

  return categories
    .map((cat) => ({
      ...cat,
      permissions: cat.permissions.filter((p) =>
        planHasModule(modules, planModuleForPermission(p.name)),
      ),
    }))
    .filter((cat) => cat.permissions.length > 0) as T[];
}
