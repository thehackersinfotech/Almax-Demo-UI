import { get, post } from "@/services/api";
import { useAuthStore } from "@/store/auth";

export interface Notification {
  id: string;
  event_type: string;
  title: string;
  message: string;
  reference_type: string;
  reference_id: string;
  action_url: string;
  severity: "info" | "warning" | "urgent";
  is_read: boolean;
  read_at: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LocalNotification {
  id: string;
  event_type: string;
  title: string;
  message: string;
  reference_type: string;
  reference_id: string;
  action_url: string;
  severity: "info" | "warning" | "urgent";
  is_read: boolean;
  read_at: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  targetPermission?: string;
  targetUsername?: string;
}

export interface NotificationDashboard {
  unread_count: number;
  by_severity: Record<string, number>;
  recent: Notification[];
}

function getLocalNotifications(): LocalNotification[] {
  try {
    const raw = localStorage.getItem("bms_it_asset_notifications");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalNotifications(list: LocalNotification[]) {
  try {
    localStorage.setItem("bms_it_asset_notifications", JSON.stringify(list));
  } catch {}
}

export async function fetchNotifications(unreadOnly = true, limit = 30): Promise<Notification[]> {
  let backendNotifs: Notification[] = [];
  try {
    backendNotifs = await get<Notification[]>("/notifications/", { unread_only: unreadOnly, limit, _: Date.now() });
  } catch {
    // Fail silently or fallback
  }

  const authState = useAuthStore.getState();
  const user = authState.user;
  const permissions = authState.permissions;

  let localNotifs = getLocalNotifications();
  if (unreadOnly) {
    localNotifs = localNotifs.filter((n) => !n.is_read);
  }

  localNotifs = localNotifs.filter((n) => {
    if (n.targetPermission && !permissions.includes(n.targetPermission)) {
      return false;
    }
    if (
      n.targetUsername &&
      user?.username !== n.targetUsername &&
      !permissions.includes("bms.hrms.onboarding.manage") &&
      user?.username !== "admin"
    ) {
      return false;
    }
    return true;
  });

  const mappedLocal: Notification[] = localNotifs.map((n) => ({
    id: n.id,
    event_type: n.event_type,
    title: n.title,
    message: n.message,
    reference_type: n.reference_type,
    reference_id: n.reference_id,
    action_url: n.action_url,
    severity: n.severity,
    is_read: n.is_read,
    read_at: n.read_at,
    actor_name: n.actor_name,
    metadata: n.metadata,
    created_at: n.created_at,
  }));

  const merged = [...mappedLocal, ...backendNotifs];
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return merged.slice(0, limit);
}

export async function fetchUnreadCount(): Promise<{ unread_count: number }> {
  let backendCount = 0;
  try {
    const res = await get<{ unread_count: number }>("/notifications/unread-count/", { _: Date.now() });
    backendCount = res.unread_count;
  } catch {
    // Fail silently
  }

  const authState = useAuthStore.getState();
  const user = authState.user;
  const permissions = authState.permissions;

  const localNotifs = getLocalNotifications().filter((n) => {
    if (n.is_read) return false;
    if (n.targetPermission && !permissions.includes(n.targetPermission)) return false;
    if (
      n.targetUsername &&
      user?.username !== n.targetUsername &&
      !permissions.includes("bms.hrms.onboarding.manage") &&
      user?.username !== "admin"
    ) return false;
    return true;
  });

  return { unread_count: backendCount + localNotifs.length };
}

export async function fetchNotificationDashboard(): Promise<NotificationDashboard> {
  // Used for billboard/dashboard widgets
  const notifs = await fetchNotifications(true, 20);
  const by_severity = { info: 0, warning: 0, urgent: 0 };
  notifs.forEach((n) => {
    if (n.severity in by_severity) {
      by_severity[n.severity]++;
    }
  });

  return {
    unread_count: notifs.length,
    by_severity,
    recent: notifs,
  };
}

export async function markNotificationRead(id: string): Promise<{ message: string }> {
  if (id.startsWith("local-notif-")) {
    const localNotifs = getLocalNotifications();
    const item = localNotifs.find((n) => n.id === id);
    if (item) {
      item.is_read = true;
      item.read_at = new Date().toISOString();
      saveLocalNotifications(localNotifs);
      window.dispatchEvent(new CustomEvent("local-notifications-updated"));
    }
    return { message: "Marked as read." };
  }
  return post<{ message: string }>(`/notifications/${id}/read/`, {});
}

export async function markAllNotificationsRead(): Promise<{ message: string }> {
  const localNotifs = getLocalNotifications();
  localNotifs.forEach((n) => {
    n.is_read = true;
    n.read_at = new Date().toISOString();
  });
  saveLocalNotifications(localNotifs);
  window.dispatchEvent(new CustomEvent("local-notifications-updated"));

  try {
    return await post<{ message: string }>("/notifications/read-all/", {});
  } catch {
    return { message: "Local marked. Backend failed." };
  }
}

export function addLocalNotification(payload: {
  event_type?: string;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: string;
  action_url?: string;
  severity?: "info" | "warning" | "urgent";
  targetUsername?: string;
  targetPermission?: string;
}) {
  const notifs = getLocalNotifications();
  const newItem: LocalNotification = {
    id: `local-notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    event_type: payload.event_type || "onboarding.reminder",
    title: payload.title,
    message: payload.message,
    reference_type: payload.reference_type || "onboarding",
    reference_id: payload.reference_id || "",
    action_url: payload.action_url || "/employee-onboarding",
    severity: payload.severity || "warning",
    is_read: false,
    read_at: null,
    actor_name: "HR Manager",
    metadata: {},
    created_at: new Date().toISOString(),
    targetUsername: payload.targetUsername,
    targetPermission: payload.targetPermission,
  };
  notifs.unshift(newItem);
  saveLocalNotifications(notifs);
  window.dispatchEvent(new CustomEvent("local-notifications-updated"));
}

