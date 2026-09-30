import { useAuthStore } from "@/store/auth";
import { assetApi } from "@/services/assets";

export type AssetCategory = "laptop" | "mouse" | "keyboard" | "monitor" | "headset" | "chair" | "desk" | "printer" | "webcam" | "other";
export type FacilityCategory = "parking" | "locker" | "cafeteria" | "gym" | "workstation" | "other";
export type DigitalCategory = "subscription" | "account" | "wifi" | "biometric" | "other_digital";
export type AssetKind = "asset" | "facility" | "digital";
export type RequestStatus = "pending" | "approved" | "fulfilled" | "rejected" | "refill_needed";

export interface AssetUnit {
  unitCode: string; // e.g. AST-1001-01, DIG-1001-01, etc.
  status: "available" | "assigned";
  assignedToEmployeeId?: string;
  assignedToEmployeeName?: string;
  assignedDate?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: AssetCategory | FacilityCategory | DigitalCategory;
  kind: AssetKind;
  totalStock: number;
  availableStock: number;
  assignedCount: number;
  description?: string;
  createdAt: string;
  itemCode: string; // Base prefix code e.g. AST-1001, FAC-1001, DIG-1001
  units: AssetUnit[]; // All individual units with unique IDs
}

export interface EmployeeAsset {
  id: string;
  employeeId: string;
  employeeName: string;
  inventoryItemId: string;
  itemName: string;
  category: string;
  kind: AssetKind;
  assignedDate: string;
  condition: "Excellent" | "Good" | "Fair";
  assetCode: string;
  status?: "assigned" | "revoked" | "revoked_with_issues";
  notes?: string;
}

export interface AssetRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  inventoryItemId: string;
  itemName: string;
  category: string;
  kind: AssetKind;
  requestedAt: string;
  status: RequestStatus;
  notes?: string;
  fulfilledAt?: string;
}

const STORE_KEY = "bms_it_asset_store";

interface StoreData {
  inventory: InventoryItem[];
  employeeAssets: EmployeeAsset[];
  requests: AssetRequest[];
}

function load(): StoreData {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreData;
      return parsed;
    }
  } catch { /* ignore */ }
  const initial: StoreData = { inventory: [], employeeAssets: [], requests: [] };
  save(initial);
  return initial;
}

function save(data: StoreData) {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

// Listeners for cross-tab reactivity
const listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((fn) => fn());
}

// Trigger initial sync with Django Backend — only when authenticated
let isBackendSynced = false;
let _syncInProgress = false;

async function syncWithBackend() {
  // Guard: only sync when a valid auth token is present
  const token = useAuthStore.getState().token;
  if (!token) return;
  // Guard: prevent concurrent sync calls
  if (_syncInProgress) return;
  _syncInProgress = true;
  try {
    const [inventory, employeeAssets, requests] = await Promise.all([
      assetApi.getInventory(),
      assetApi.getEmployeeAssignments(),
      assetApi.getRequests(),
    ]);
    const local = load();
    // Merge backend data with local if backend has records
    if (inventory.length > 0 || employeeAssets.length > 0 || requests.length > 0) {
      const updated: StoreData = {
        inventory: inventory.length > 0 ? inventory : local.inventory,
        employeeAssets: employeeAssets.length > 0 ? employeeAssets : local.employeeAssets,
        requests: requests.length > 0 ? requests : local.requests,
      };
      save(updated);
      isBackendSynced = true;
      notify();
    }
  } catch (e) {
    console.warn("Backend asset sync notice:", e);
  } finally {
    _syncInProgress = false;
  }
}

// Auto-sync when auth token becomes available (subscribe to auth store changes)
// This avoids circular imports — itAssets subscribes to auth, not the other way around.
let _prevToken: string | null = useAuthStore.getState().token;
useAuthStore.subscribe((state) => {
  if (state.token && !_prevToken) {
    // Token just appeared (login success) — sync now
    syncWithBackend();
  }
  _prevToken = state.token;
});

// If already authenticated at module load time (e.g. page refresh with stored token),
// kick off sync after a short delay to let the app fully initialize first.
setTimeout(() => {
  if (useAuthStore.getState().token) {
    syncWithBackend();
  }
}, 1000);

interface LocalNotificationPayload {
  event_type: string;
  title: string;
  message: string;
  reference_type: string;
  reference_id: string;
  action_url: string;
  severity: "info" | "warning" | "urgent";
  targetPermission?: string;
  targetUsername?: string;
}

function triggerLocalNotification(payload: LocalNotificationPayload) {
  try {
    const raw = sessionStorage.getItem("bms_it_asset_notifications");
    const list = raw ? JSON.parse(raw) : [];

    const notif = {
      ...payload,
      id: `local-notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      is_read: false,
      read_at: null,
      actor_name: useAuthStore.getState().user?.full_name || "System",
      metadata: {},
      created_at: new Date().toISOString(),
    };

    list.push(notif);
    sessionStorage.setItem("bms_it_asset_notifications", JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("local-notifications-updated"));
  } catch (e) {
    console.error("Failed to trigger local notification", e);
  }
}

export const itAssetStore = {
  subscribe(fn: () => void): () => void {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },

  /** Call this after successful login to pull backend data into store */
  syncIfAuthenticated(): void {
    syncWithBackend();
  },

  getInventory(): InventoryItem[] {
    return load().inventory;
  },

  getEmployeeAssets(employeeId?: string): EmployeeAsset[] {
    const data = load();
    return employeeId ? data.employeeAssets.filter((a) => a.employeeId === employeeId) : data.employeeAssets;
  },

  updateEmployeeAssetRevocation(assetId: string, status: "revoked" | "revoked_with_issues", notes?: string) {
    const data = load();
    const idx = data.employeeAssets.findIndex((a) => a.id === assetId);
    if (idx !== -1) {
      data.employeeAssets[idx].status = status;
      data.employeeAssets[idx].notes = notes || "";
      save(data);
      notify();
    }
  },

  ensureEmployeeAssets(empId: string, empName: string, empCode?: string, joiningDate?: string): EmployeeAsset[] {
    const data = load();
    let empAssets = data.employeeAssets.filter(
      (a) =>
        String(a.employeeId) === String(empId) ||
        (empCode && String(a.employeeId) === String(empCode)) ||
        (a.employeeName && empName && a.employeeName.toLowerCase().includes(empName.toLowerCase()))
    );

    if (empAssets.length === 0) {
      const defaultAssets: EmployeeAsset[] = [
        {
          id: `ea-laptop-${empId}`,
          employeeId: empId,
          employeeName: empName,
          inventoryItemId: "inv-laptop-01",
          itemName: "Company Laptop & Charger (Dell XPS / ThinkPad)",
          category: "Laptop",
          kind: "asset",
          assignedDate: joiningDate || "2024-01-15",
          condition: "Good",
          assetCode: `AST-${empCode || "1001"}-01`,
          status: "assigned",
        },
        {
          id: `ea-monitor-${empId}`,
          employeeId: empId,
          employeeName: empName,
          inventoryItemId: "inv-monitor-01",
          itemName: "27-inch Dell UltraSharp Monitor & HDMI Cable",
          category: "Monitor",
          kind: "asset",
          assignedDate: joiningDate || "2024-01-15",
          condition: "Good",
          assetCode: `AST-${empCode || "1001"}-02`,
          status: "assigned",
        },
        {
          id: `ea-badge-${empId}`,
          employeeId: empId,
          employeeName: empName,
          inventoryItemId: "inv-badge-01",
          itemName: "Building RFID Security Access Card & Locker Key",
          category: "Facility",
          kind: "facility",
          assignedDate: joiningDate || "2024-01-15",
          condition: "Excellent",
          assetCode: `FAC-${empCode || "1001"}-01`,
          status: "assigned",
        },
      ];
      data.employeeAssets.push(...defaultAssets);
      save(data);
      notify();
      return defaultAssets;
    }
    return empAssets;
  },

  getRequests(employeeId?: string): AssetRequest[] {
    const data = load();
    return employeeId ? data.requests.filter((r) => r.employeeId === employeeId) : data.requests;
  },

  generateNextCode(kind: AssetKind): string {
    const data = load();
    const count = data.inventory.filter((i) => i.kind === kind).length + 1;
    const prefix = kind === "asset" ? "AST" : kind === "facility" ? "FAC" : "DIG";
    return `${prefix}-${1000 + count}`;
  },

  addInventoryItem(item: Omit<InventoryItem, "id" | "createdAt" | "units"> & { itemCode?: string }): InventoryItem {
    const data = load();
    const code = item.itemCode?.trim() || this.generateNextCode(item.kind);

    const stock = item.totalStock || 0;
    const avail = item.availableStock ?? stock;
    const units: AssetUnit[] = [];

    if (stock < 999) {
      for (let i = 1; i <= stock; i++) {
        units.push({
          unitCode: `${code}-${String(i).padStart(2, "0")}`,
          status: i <= avail ? "available" : "assigned",
        });
      }
    }

    const newItem: InventoryItem = {
      ...item,
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemCode: code,
      createdAt: new Date().toISOString(),
      units,
    };
    data.inventory.push(newItem);
    save(data);

    // Call Backend API in background
    assetApi.createInventoryItem({
      name: item.name,
      category: item.category,
      kind: item.kind,
      initialStock: stock,
      description: item.description,
    }).then(() => syncWithBackend()).catch((e) => console.warn("Backend add item:", e));

    // Notify HR / employees
    triggerLocalNotification({
      event_type: "employee.asset_add",
      title: "New Item Added to Catalog",
      message: `${newItem.name} (${newItem.itemCode}) with ${stock} individual unit IDs created.`,
      reference_type: "inventory",
      reference_id: newItem.id,
      action_url: "/employees",
      severity: "info",
      targetPermission: "bms.hrms.employee.view",
    });

    notify();
    return newItem;
  },

  refillStock(itemId: string, quantity: number): void {
    const data = load();
    const item = data.inventory.find((i) => i.id === itemId);
    if (item) {
      if (!item.units) item.units = [];
      const currentTotal = item.units.length;

      if (item.totalStock < 999) {
        for (let i = 1; i <= quantity; i++) {
          const num = currentTotal + i;
          item.units.push({
            unitCode: `${item.itemCode}-${String(num).padStart(2, "0")}`,
            status: "available",
          });
        }
      }

      item.totalStock += quantity;
      item.availableStock += quantity;
      save(data);

      // Call Backend API in background
      assetApi.refillInventoryItem(itemId, quantity)
        .then(() => syncWithBackend())
        .catch((e) => console.warn("Backend refill stock:", e));

      // Notify HR / requesting employees
      triggerLocalNotification({
        event_type: "employee.asset_refill",
        title: `Stock Refilled: ${item.name}`,
        message: `${item.name} (${item.itemCode}) refilled with ${quantity} new units.`,
        reference_type: "inventory",
        reference_id: item.id,
        action_url: "/employees",
        severity: "info",
        targetPermission: "bms.hrms.employee.view",
      });
    }
    notify();
  },

  assignAsset(payload: {
    employeeId: string;
    employeeName: string;
    inventoryItemId: string;
    itemName: string;
    category: string;
    kind: AssetKind;
    requestedUnitCode?: string;
  }): EmployeeAsset | null {
    const data = load();
    const item = data.inventory.find((i) => i.id === payload.inventoryItemId);
    if (!item || item.availableStock <= 0) return null;

    if (!item.units) item.units = [];

    let targetUnit = payload.requestedUnitCode
      ? item.units.find((u) => u.unitCode === payload.requestedUnitCode && u.status === "available")
      : item.units.find((u) => u.status === "available");

    if (!targetUnit) {
      const nextNum = item.units.length + 1;
      const unitCode = `${item.itemCode}-${String(nextNum).padStart(2, "0")}`;
      targetUnit = { unitCode, status: "available" };
      item.units.push(targetUnit);
    }

    const assignedDate = new Date().toLocaleDateString("en-IN");
    targetUnit.status = "assigned";
    targetUnit.assignedToEmployeeId = payload.employeeId;
    targetUnit.assignedToEmployeeName = payload.employeeName;
    targetUnit.assignedDate = assignedDate;

    item.availableStock = Math.max(0, item.availableStock - 1);
    item.assignedCount += 1;

    const empAsset: EmployeeAsset = {
      id: `ea-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      employeeId: payload.employeeId,
      employeeName: payload.employeeName,
      inventoryItemId: payload.inventoryItemId,
      itemName: payload.itemName,
      category: payload.category,
      kind: payload.kind,
      assignedDate,
      condition: "Excellent",
      assetCode: targetUnit.unitCode,
    };
    data.employeeAssets.push(empAsset);
    save(data);

    // Call Backend API in background
    assetApi.assignAsset({
      employeeId: payload.employeeId,
      employeeName: payload.employeeName,
      inventoryItemId: payload.inventoryItemId,
    }).then(() => syncWithBackend()).catch((e) => console.warn("Backend assign asset:", e));

    notify();
    return empAsset;
  },

  revokeAsset(empAssetId: string): void {
    const data = load();
    const idx = data.employeeAssets.findIndex((a) => a.id === empAssetId);
    if (idx !== -1) {
      const ea = data.employeeAssets[idx];
      const item = data.inventory.find((i) => i.id === ea.inventoryItemId);
      if (item) {
        if (item.units) {
          const unit = item.units.find((u) => u.unitCode === ea.assetCode);
          if (unit) {
            unit.status = "available";
            delete unit.assignedToEmployeeId;
            delete unit.assignedToEmployeeName;
            delete unit.assignedDate;
          }
        }
        item.availableStock += 1;
        item.assignedCount = Math.max(0, item.assignedCount - 1);
      }
      data.employeeAssets.splice(idx, 1);
      save(data);

      // Call Backend API in background
      assetApi.revokeAsset(empAssetId)
        .then(() => syncWithBackend())
        .catch((e) => console.warn("Backend revoke asset:", e));
    }
    notify();
  },

  createRequest(payload: {
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    inventoryItemId: string;
    itemName: string;
    category: string;
    kind: AssetKind;
    notes?: string;
  }): AssetRequest {
    const data = load();
    const req: AssetRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      employeeId: payload.employeeId,
      employeeName: payload.employeeName,
      employeeCode: payload.employeeCode,
      inventoryItemId: payload.inventoryItemId,
      itemName: payload.itemName,
      category: payload.category,
      kind: payload.kind,
      notes: payload.notes,
      requestedAt: new Date().toISOString(),
      status: "pending",
    };
    data.requests.push(req);
    save(data);

    // Call Backend API in background
    assetApi.createRequest(payload)
      .then(() => syncWithBackend())
      .catch((e) => console.warn("Backend create request:", e));

    // Notify IT Asset Admin
    triggerLocalNotification({
      event_type: "employee.asset_request",
      title: `New Asset Request`,
      message: `${payload.employeeName} (${payload.employeeCode}) requested ${payload.itemName}.`,
      reference_type: "request",
      reference_id: req.id,
      action_url: "/it-asset-dashboard?tab=requests",
      severity: "warning",
      targetPermission: "bms.hrms.asset.manage",
    });

    notify();
    return req;
  },

  updateRequestStatus(requestId: string, status: RequestStatus): void {
    const data = load();
    const req = data.requests.find((r) => r.id === requestId);
    if (req) {
      req.status = status;
      if (status === "fulfilled") {
        req.fulfilledAt = new Date().toISOString();
        // Auto-assign if stock available
        const item = data.inventory.find((i) => i.id === req.inventoryItemId);
        if (item && item.availableStock > 0) {
          item.availableStock -= 1;
          item.assignedCount += 1;
          const assignedCode = item.itemCode
            ? `${item.itemCode}-${String(item.assignedCount).padStart(2, "0")}`
            : `${req.category.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

          data.employeeAssets.push({
            id: `ea-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            employeeId: req.employeeId,
            employeeName: req.employeeName,
            inventoryItemId: req.inventoryItemId,
            itemName: req.itemName,
            category: req.category,
            kind: req.kind,
            assignedDate: new Date().toLocaleDateString("en-IN"),
            condition: "Excellent",
            assetCode: assignedCode,
          });
        }
      }
      save(data);

      // Call Backend API in background
      assetApi.updateRequestStatus(requestId, status)
        .then(() => syncWithBackend())
        .catch((e) => console.warn("Backend update request status:", e));

      // Notify HR / request initiator
      triggerLocalNotification({
        event_type: "employee.asset_status",
        title: `Asset Request ${status === "fulfilled" ? "Fulfilled" : "Rejected"}`,
        message: `The request for ${req.itemName} for ${req.employeeName} has been ${status}.`,
        reference_type: "request",
        reference_id: req.id,
        action_url: "/employees",
        severity: status === "fulfilled" ? "info" : "urgent",
        targetPermission: "bms.hrms.employee.view",
      });
    }
    notify();
  },

  reset(): void {
    const initial: StoreData = { inventory: [], employeeAssets: [], requests: [] };
    save(initial);
    notify();
  },
};

