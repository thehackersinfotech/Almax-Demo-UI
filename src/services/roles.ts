import { del, get, post, put } from "./api";

export interface PermissionItem {
  name: string;
  description: string;
  label: string;
}

export interface PermissionCategory {
  category: string;
  category_label: string;
  permissions: PermissionItem[];
}

export interface RoleSummary {
  id: string;
  name: string;
  path: string;
  users_assigned: number;
  status: string;
}

export interface RoleDetail extends RoleSummary {
  description: string;
  permissions: string[];
  categories: PermissionCategory[];
}

export const rolesApi = {
  list: () =>
    get<{ count: number; results: RoleSummary[] }>("/roles/"),

  get: (roleId: string) =>
    get<RoleDetail>(`/roles/${roleId}/`),

  catalog: () =>
    get<{ categories: PermissionCategory[] }>("/permissions/catalog/"),

  updatePermissions: (roleId: string, permissions: string[]) =>
    put<{ message: string; permissions: string[] }>(
      `/roles/${roleId}/permissions/`,
      { permissions },
    ),

  create: (payload: { name: string; description?: string; permissions?: string[] }) =>
    post<{ message: string; id: string; name: string; permissions: string[] }>(
      "/roles/",
      payload,
    ),

  remove: (roleId: string) =>
    del<{ message: string }>(`/roles/${roleId}/`),
};
