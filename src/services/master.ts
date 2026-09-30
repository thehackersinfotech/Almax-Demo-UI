import { get, post, patch, put, del } from "./api";

const BASE = "/master";

export interface MasterItem {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationItem extends MasterItem {
  city: string;
  state: string;
  country: string;
}

export interface DropdownOption {
  id: string;
  name: string;
  slug: string;
}

// ── Generic CRUD factory ────────────────────────────────────────────────────────
function masterApi(resource: string) {
  return {
    list: (params?: Record<string, unknown>) => get<any>(`${BASE}/${resource}/`, params).then((r: any) => (Array.isArray(r) ? r : r.results ?? r)),
    get: (id: string) => get<MasterItem>(`${BASE}/${resource}/${id}/`),
    create: (data: Partial<MasterItem>) => post<MasterItem>(`${BASE}/${resource}/`, data),
    update: (id: string, data: Partial<MasterItem>) => patch<MasterItem>(`${BASE}/${resource}/${id}/`, data),
    delete: (id: string) => del(`${BASE}/${resource}/${id}/`),
    dropdown: () => get<DropdownOption[]>(`${BASE}/dropdown/${resource}/`),
  };
}

export const designationApi = masterApi("designations");
export const departmentApi  = masterApi("departments");
export const locationApi    = {
  ...masterApi("locations"),
  list: (params?: Record<string, unknown>) =>
    get<any>(`${BASE}/locations/`, params).then((r: any) => (Array.isArray(r) ? r : r.results ?? r)),
  dropdown: () => get<DropdownOption[]>(`${BASE}/dropdown/locations/`),
};
export const employmentTypeApi = masterApi("employment-types");

export interface ShiftCategoryItem extends MasterItem {
  start_time: string;
  end_time: string;
}

export interface ShiftCategoryOption {
  id: string; name: string; start_time: string; end_time: string;
}

export interface RateCardItem {
  id: string;
  designation_ref: string; designation_name: string;
  department_ref: string;  department_name: string;
  hr_daily_rate: string; client_billing_rate: string;
  monthly_hr_cost: number; monthly_client_rate: number;
  currency: string; is_active: boolean;
  created_at: string; updated_at: string;
}

export const rateCardApi = {
  list:   (p?: Record<string, unknown>) =>
    get<any>(`${BASE}/rate-cards/`, p).then((r: any) => Array.isArray(r) ? r : r.results ?? r),
  get:    (id: string) => get<RateCardItem>(`${BASE}/rate-cards/${id}/`),
  create: (data: Partial<RateCardItem>) => post<RateCardItem>(`${BASE}/rate-cards/`, data),
  update: (id: string, data: Partial<RateCardItem>) => patch<RateCardItem>(`${BASE}/rate-cards/${id}/`, data),
  delete: (id: string) => del(`${BASE}/rate-cards/${id}/`),
};

export const clientCategoryApi = masterApi("client-categories");

export interface BusinessTypeItem extends MasterItem {
  prefix: string;
}

export interface BusinessTypeDropdown {
  id: string;
  name: string;
  slug: string;
  prefix: string;
}

export const businessTypeApi = {
  list: (params?: Record<string, unknown>) =>
    get<any>(`${BASE}/business-types/`, params).then((r: any) => (Array.isArray(r) ? r : r.results ?? r)),
  get: (id: string) => get<BusinessTypeItem>(`${BASE}/business-types/${id}/`),
  create: (data: Partial<BusinessTypeItem>) => post<BusinessTypeItem>(`${BASE}/business-types/`, data),
  update: (id: string, data: Partial<BusinessTypeItem>) => patch<BusinessTypeItem>(`${BASE}/business-types/${id}/`, data),
  delete: (id: string) => del(`${BASE}/business-types/${id}/`),
  dropdown: () => get<BusinessTypeDropdown[]>(`${BASE}/dropdown/business-types/`),
};

export const billingTypeApi = {
  list: (params?: Record<string, unknown>) =>
    get<any>(`${BASE}/billing-types/`, params).then((r: any) => (Array.isArray(r) ? r : r.results ?? r)),
  get: (id: string) => get<MasterItem>(`${BASE}/billing-types/${id}/`),
  create: (data: Partial<MasterItem>) => post<MasterItem>(`${BASE}/billing-types/`, data),
  update: (id: string, data: Partial<MasterItem>) => patch<MasterItem>(`${BASE}/billing-types/${id}/`, data),
  delete: (id: string) => del(`${BASE}/billing-types/${id}/`),
  dropdown: () => get<DropdownOption[]>(`${BASE}/dropdown/billing-types/`),
};

export const followupTypeApi = masterApi("followup-types");

export const shiftCategoryApi = {
  list:     (params?: Record<string, unknown>) =>
    get<any>(`${BASE}/shift-categories/`, params).then((r: any) => (Array.isArray(r) ? r : r.results ?? r)),
  get:      (id: string) => get<ShiftCategoryItem>(`${BASE}/shift-categories/${id}/`),
  create:   (data: Partial<ShiftCategoryItem>) => post<ShiftCategoryItem>(`${BASE}/shift-categories/`, data),
  update:   (id: string, data: Partial<ShiftCategoryItem>) => patch<ShiftCategoryItem>(`${BASE}/shift-categories/${id}/`, data),
  delete:   (id: string) => del(`${BASE}/shift-categories/${id}/`),
  dropdown: () => get<ShiftCategoryOption[]>(`${BASE}/dropdown/shift-categories/`),
};

export interface LeaveTypeItem {
  id: string;
  name: string;
  code: string;
  max_days: number;
  is_paid: boolean;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const leaveTypeApi = {
  list:   (params?: Record<string, unknown>) =>
    get<any>(`${BASE}/leave/types/`, params).then((r: any) => Array.isArray(r) ? r : r.results ?? r),
  get:    (id: string) => get<LeaveTypeItem>(`${BASE}/leave/types/${id}/`),
  create: (data: Partial<LeaveTypeItem>) => post<LeaveTypeItem>(`${BASE}/leave/types/`, data),
  update: (id: string, data: Partial<LeaveTypeItem>) => patch<LeaveTypeItem>(`${BASE}/leave/types/${id}/`, data),
  delete: (id: string) => del(`${BASE}/leave/types/${id}/`),
};

export const leavePolicyApi = {
  list:   (params?: Record<string, unknown>) =>
    get<any>(`${BASE}/leave/policy-rules/`, params).then((r: any) => Array.isArray(r) ? r : r.results ?? r),
  get:    (id: string) => get<any>(`${BASE}/leave/policy-rules/${id}/`),
  create: (data: any) => post<any>(`${BASE}/leave/policy-rules/`, data),
  update: (id: string, data: any) => patch<any>(`${BASE}/leave/policy-rules/${id}/`, data),
  delete: (id: string) => del(`${BASE}/leave/policy-rules/${id}/`),
  allocate: (id: string, year: number) => post<any>(`${BASE}/leave/policy-rules/${id}/allocate/`, { year }),
};

export interface HolidayItem {
  id: string;
  name: string;
  slug: string;
  date: string;
  year: number;
  holiday_type: string;
  holiday_type_label: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const holidayApi = {
  list:   (params?: Record<string, unknown>) =>
    get<any>(`${BASE}/holidays/`, params).then((r: any) => Array.isArray(r) ? r : r.results ?? r),
  get:    (id: string) => get<HolidayItem>(`${BASE}/holidays/${id}/`),
  create: (data: Partial<HolidayItem>) => post<HolidayItem>(`${BASE}/holidays/`, data),
  update: (id: string, data: Partial<HolidayItem>) => patch<HolidayItem>(`${BASE}/holidays/${id}/`, data),
  delete: (id: string) => del(`${BASE}/holidays/${id}/`),
};

export const leaveBalanceAssignApi = {
  assign: (data: { year: number; assignments: Array<{ employee_id: string; leave_type_id: string; total_days: number }> }) =>
    post<any>(`${BASE}/leave/balances/assign/`, data),
};

/**
 * Singleton configuration: exactly ONE row in the database.
 * The API reflects this — no list, no ID-based access.
 */
export interface ReimbursementConfigItem {
  id: string;
  approver_id: string | null;
  approver_name: string | null;
  approver_code: string | null;
  approver_email: string | null;
  configured_by_name: string | null;
  is_configured: boolean;
  created_at: string;
  updated_at: string;
}

export const reimbursementConfigApi = {
  /** Fetch the active singleton config. Returns { is_configured: false } if not set up yet. */
  get: () => get<ReimbursementConfigItem & { is_configured: boolean }>("/master/reimbursement-config/"),

  /** Upsert (create or update) the singleton config with a new approver. */
  set: (approver_id: string) =>
    put<ReimbursementConfigItem>("/master/reimbursement-config/", { approver: approver_id }),
};