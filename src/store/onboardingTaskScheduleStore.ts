import { get, post, patch } from "@/services/api";

export interface HRScheduleItem {
  id: string;
  employeeId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  createdAt: string;
}

export interface HRTaskItem {
  id: string;
  employeeId: string;
  title: string;
  dueDate: string;
  priority: string;
  notes?: string;
  status: "pending" | "in_progress" | "done";
  createdAt: string;
}

// In-memory cache for fast UI updates & offline fallback
let schedulesCache: HRScheduleItem[] = [];
let tasksCache: HRTaskItem[] = [];
let listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("nexus-task-schedule-updated"));
  }
}

function extractKeys(empIdOrObj: any): string[] {
  if (!empIdOrObj) return [];
  if (typeof empIdOrObj === "string") return [empIdOrObj];
  const keys: string[] = [];
  if (empIdOrObj.id) keys.push(empIdOrObj.id);
  if (empIdOrObj.keycloak_id) keys.push(empIdOrObj.keycloak_id);
  if (empIdOrObj.username) keys.push(empIdOrObj.username);
  if (empIdOrObj.email) keys.push(empIdOrObj.email);
  return keys;
}

export const onboardingTaskScheduleStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  fetchForEmployee: async (empIdOrObj: any) => {
    const keys = extractKeys(empIdOrObj);
    const empId = keys[0] || (typeof empIdOrObj === "string" ? empIdOrObj : "default");
    try {
      const [schRes, tskRes] = await Promise.all([
        get<any>(`/master/onboarding-schedules/?employee_id=${encodeURIComponent(empId)}`),
        get<any>(`/master/onboarding-tasks/?employee_id=${encodeURIComponent(empId)}`),
      ]);

      const schList = Array.isArray(schRes) ? schRes : schRes?.results || [];
      const tskList = Array.isArray(tskRes) ? tskRes : tskRes?.results || [];

      const mappedSchedules: HRScheduleItem[] = schList.map((s: any) => ({
        id: s.id,
        employeeId: s.employee_id || empId,
        title: s.title,
        date: s.date,
        time: s.time || "10:00 AM",
        location: s.location || "HR Room / Online",
        createdAt: s.created_at || new Date().toISOString(),
      }));

      const mappedTasks: HRTaskItem[] = tskList.map((t: any) => ({
        id: t.id,
        employeeId: t.employee_id || empId,
        title: t.title,
        dueDate: t.due_date,
        priority: t.priority || "medium",
        notes: t.notes || "",
        status: t.status || "pending",
        createdAt: t.created_at || new Date().toISOString(),
      }));

      // Update in-memory cache for empId
      schedulesCache = [
        ...schedulesCache.filter((s) => !keys.includes(s.employeeId)),
        ...mappedSchedules,
      ];
      tasksCache = [
        ...tasksCache.filter((t) => !keys.includes(t.employeeId)),
        ...mappedTasks,
      ];

      notifyListeners();
      return { schedules: mappedSchedules, tasks: mappedTasks };
    } catch (e) {
      console.error("Failed to fetch onboarding schedules/tasks from server", e);
      return {
        schedules: schedulesCache.filter((s) => keys.includes(s.employeeId)),
        tasks: tasksCache.filter((t) => keys.includes(t.employeeId)),
      };
    }
  },

  getSchedules: (empIdOrObj: any): HRScheduleItem[] => {
    const keys = extractKeys(empIdOrObj);
    if (keys.length === 0) return schedulesCache;
    return schedulesCache.filter((s) => keys.includes(s.employeeId));
  },

  addSchedule: async (
    empIdOrObj: any,
    item: { title: string; date: string; time?: string; location?: string }
  ): Promise<HRScheduleItem> => {
    const keys = extractKeys(empIdOrObj);
    const empId = keys[0] || (typeof empIdOrObj === "string" ? empIdOrObj : "default");

    const payload = {
      employee_id: empId,
      title: item.title,
      date: item.date,
      time: item.time || "10:00 AM",
      location: item.location || "HR Room / Online",
    };

    try {
      const res = await post<any>("/master/onboarding-schedules/", payload);
      const newItem: HRScheduleItem = {
        id: res.id,
        employeeId: res.employee_id || empId,
        title: res.title,
        date: res.date,
        time: res.time,
        location: res.location,
        createdAt: res.created_at || new Date().toISOString(),
      };
      schedulesCache.push(newItem);
      notifyListeners();
      return newItem;
    } catch (e) {
      console.error("Failed to persist schedule on server", e);
      const localItem: HRScheduleItem = {
        id: `sch-${Date.now()}`,
        employeeId: empId,
        title: item.title,
        date: item.date,
        time: item.time || "10:00 AM",
        location: item.location || "HR Room / Online",
        createdAt: new Date().toISOString(),
      };
      schedulesCache.push(localItem);
      notifyListeners();
      return localItem;
    }
  },

  getTasks: (empIdOrObj: any): HRTaskItem[] => {
    const keys = extractKeys(empIdOrObj);
    if (keys.length === 0) return tasksCache;
    return tasksCache.filter((t) => keys.includes(t.employeeId));
  },

  addTask: async (
    empIdOrObj: any,
    item: { title: string; dueDate: string; priority?: string; notes?: string }
  ): Promise<HRTaskItem> => {
    const keys = extractKeys(empIdOrObj);
    const empId = keys[0] || (typeof empIdOrObj === "string" ? empIdOrObj : "default");

    const payload = {
      employee_id: empId,
      title: item.title,
      due_date: item.dueDate,
      priority: item.priority || "medium",
      notes: item.notes || "",
      status: "pending",
    };

    try {
      const res = await post<any>("/master/onboarding-tasks/", payload);
      const newItem: HRTaskItem = {
        id: res.id,
        employeeId: res.employee_id || empId,
        title: res.title,
        dueDate: res.due_date,
        priority: res.priority,
        notes: res.notes,
        status: res.status as any,
        createdAt: res.created_at || new Date().toISOString(),
      };
      tasksCache.push(newItem);
      notifyListeners();
      return newItem;
    } catch (e) {
      console.error("Failed to persist task on server", e);
      const localItem: HRTaskItem = {
        id: `tsk-${Date.now()}`,
        employeeId: empId,
        title: item.title,
        dueDate: item.dueDate,
        priority: item.priority || "medium",
        notes: item.notes || "",
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      tasksCache.push(localItem);
      notifyListeners();
      return localItem;
    }
  },

  updateTaskStatus: async (taskId: string, status: "pending" | "in_progress" | "done") => {
    tasksCache = tasksCache.map((t) => (t.id === taskId ? { ...t, status } : t));
    notifyListeners();

    try {
      await patch(`/master/onboarding-tasks/${taskId}/`, { status });
    } catch (e) {
      console.error("Failed to update task status on server", e);
    }
  },
};
