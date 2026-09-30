import { get, post, patch } from "@/services/api";
import { API_BASE } from "@/constants/api";
import { resolveTenantSlug } from "@/services/tenant";
import { ACCESS_TOKEN_KEY } from "@/store/auth";
import type { InventoryItem, EmployeeAsset, AssetRequest, AssetKind } from "@/store/itAssets";

export const assetApi = {
  async getInventory(kind?: AssetKind): Promise<InventoryItem[]> {
    // Returns mock data via our mocked get() — no real backend call
    try {
      const res = await get<any>("/assets/inventory/", kind ? { kind } : {});
      const rawList = Array.isArray(res) ? res : ((res as any)?.results || []);
      return rawList.map((item: any) => ({
        id: String(item.id),
        itemCode: item.item_code || item.itemCode || "AST-001",
        name: item.name,
        category: item.category,
        kind: item.kind,
        description: item.description || "",
        totalStock: item.total_stock ?? item.totalStock ?? 0,
        availableStock: item.available_stock ?? item.availableStock ?? 0,
        assignedCount: (item.total_stock ?? 0) - (item.available_stock ?? 0),
        createdAt: item.created_at || new Date().toISOString(),
        units: [],
      }));
    } catch {
      return [];
    }
  },

  async createInventoryItem(data: { name: string; category: string; kind: AssetKind; initialStock: number; description?: string }): Promise<InventoryItem> {
    const item = await post<any>("/assets/inventory/", data);
    return {
      id: String(item.id || Date.now()),
      itemCode: item.item_code || item.itemCode || "AST-NEW",
      name: item.name || data.name,
      category: item.category || data.category,
      kind: item.kind || data.kind,
      description: item.description || "",
      totalStock: item.total_stock ?? data.initialStock ?? 0,
      availableStock: item.available_stock ?? data.initialStock ?? 0,
      assignedCount: 0,
      createdAt: item.created_at || new Date().toISOString(),
      units: [],
    };
  },

  async refillInventoryItem(id: string, quantity: number): Promise<void> {
    await post(`/assets/inventory/${id}/refill/`, { quantity });
  },

  async getEmployeeAssignments(employeeId?: string): Promise<EmployeeAsset[]> {
    try {
      const res = await get<any>("/assets/assignments/", employeeId ? { employee_id: employeeId, is_active: "true" } : { is_active: "true" });
      const rawList = Array.isArray(res) ? res : ((res as any)?.results || []);
      return rawList.map((a: any) => ({
        id: String(a.id),
        employeeId: a.employeeId || a.employee_id || "",
        employeeName: a.employeeName || a.employee_name || "",
        inventoryItemId: String(a.inventoryItemId || a.inventory_item || ""),
        itemName: a.itemName || a.item_name || "",
        category: a.category || "",
        kind: a.kind || "asset",
        assignedDate: a.assignedDate || a.assigned_date || "",
        condition: a.condition || "Excellent",
        assetCode: a.assetCode || a.asset_code || "",
      }));
    } catch {
      return [];
    }
  },

  async assignAsset(data: { employeeId: string; employeeName: string; inventoryItemId: string }): Promise<EmployeeAsset> {
    const a = await post<any>("/assets/assignments/", data);
    return {
      id: String(a.id || Date.now()),
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      inventoryItemId: data.inventoryItemId,
      itemName: a.itemName || a.item_name || "",
      category: a.category || "",
      kind: a.kind || "asset",
      assignedDate: a.assignedDate || new Date().toLocaleDateString(),
      condition: "Excellent",
      assetCode: a.assetCode || a.asset_code || "",
    };
  },

  async revokeAsset(assignmentId: string): Promise<void> {
    await post(`/assets/assignments/${assignmentId}/revoke/`);
  },

  async getRequests(employeeId?: string): Promise<AssetRequest[]> {
    try {
      const res = await get<any>("/assets/requests/", employeeId ? { employee_id: employeeId } : {});
      const rawList = Array.isArray(res) ? res : ((res as any)?.results || []);
      return rawList.map((r: any) => ({
        id: String(r.id),
        employeeId: r.employeeId || r.employee_id || "",
        employeeName: r.employeeName || r.employee_name || "",
        employeeCode: r.employeeCode || r.employee_code || "",
        inventoryItemId: String(r.inventoryItemId || r.inventory_item || ""),
        itemName: r.itemName || r.item_name || "",
        category: r.category || "",
        kind: r.kind || "asset",
        requestedAt: r.requestedAt || r.requested_at || "",
        status: r.status || "pending",
        notes: r.notes,
      }));
    } catch {
      return [];
    }
  },

  async createRequest(data: { employeeId: string; employeeName: string; employeeCode?: string; inventoryItemId: string; itemName: string; category: string; kind: AssetKind; notes?: string }): Promise<AssetRequest> {
    const r = await post<any>("/assets/requests/", data);
    return {
      id: String(r.id || Date.now()),
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      employeeCode: data.employeeCode || "",
      inventoryItemId: data.inventoryItemId,
      itemName: data.itemName,
      category: data.category,
      kind: data.kind,
      requestedAt: r.requestedAt || new Date().toISOString(),
      status: "pending",
      notes: data.notes,
    };
  },

  async updateRequestStatus(requestId: string, status: string): Promise<void> {
    await patch(`/assets/requests/${requestId}/`, { status });
  },
};


