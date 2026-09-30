/**
 * Tenant resolution for multi-tenant login (Phase 5).
 *
 * Production: first label of hostname before the platform base domain
 *   e.g. acme.localhost → "acme", acme.pmt.example.com with base "pmt.example.com" → "acme"
 * Local resolution (in order):
 *   1. ?tenant=<slug> query param (also persisted to localStorage)
 *   2. subdomain from hostname (hit.localhost → hit)
 *   3. bare apex / localhost / 127.0.0.1 → public (control-plane login)
 *   4. localStorage key pmt_tenant_slug (customer hosts only; never on apex)
 *   5. VITE_TENANT_SLUG
 *
 * Note: DB also has an internal auth tenant with slug "platform" (schema=platform).
 * That is not a browser workspace — login always uses "public" on the apex host.
 */

import { API_BASE } from "@/constants/api";

/** Public control plane on bare localhost / apex (not a customer tenant). */
export const PLATFORM_TENANT_SLUG = "public";

/** Reserved internal schema slug — never a login workspace. */
const INTERNAL_PLATFORM_SLUG = "platform";

export const TENANT_SLUG_STORAGE_KEY = "pmt_tenant_slug";

export type TenantInfo = {
  slug: string;
  name: string;
  keycloak_realm: string;
  status: string;
  domain: string | null;
  logo_url?: string | null;
  plan?: string;
  plan_name?: string;
  modules?: string[];
  limits?: {
    max_employees: number | null;
    max_projects: number | null;
    max_storage_mb: number | null;
  };
  /** Platform control-plane workspace — may provision tenants. */
  is_platform?: boolean;
};

export function getTenantBaseDomain(): string {
  const fromEnv = (import.meta.env.VITE_TENANT_BASE_DOMAIN as string | undefined)?.trim();
  return fromEnv || "localhost";
}

/** Pure hostname → slug parser (exported for unit tests). */
export function parseTenantSlugFromHostname(
  hostname: string,
  baseDomain: string = getTenantBaseDomain(),
): string | null {
  const host = (hostname || "").split(":")[0].toLowerCase().replace(/\.$/, "");
  if (!host) return null;

  // Bare localhost / loopback / IP address — no subdomain
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
  ) {
    return null;
  }

  const base = baseDomain.toLowerCase().replace(/^\./, "");
  if (host === base) return null;

  if (host.endsWith(`.${base}`)) {
    const sub = host.slice(0, -(base.length + 1));
    // Take the left-most label only (acme.dev.localhost → acme when base is localhost)
    const slug = sub.split(".")[0];
    return slug && slug !== "www" ? slug : null;
  }

  // Fallback: first label if multi-part host
  const parts = host.split(".");
  if (parts.length >= 2) {
    const slug = parts[0];
    return slug && slug !== "www" ? slug : null;
  }
  return null;
}

function readQueryTenant(search: string): string | null {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const v = (params.get("tenant") || "").trim().toLowerCase();
    return v || null;
  } catch {
    return null;
  }
}

function readStoredTenant(): string | null {
  try {
    const v = (localStorage.getItem(TENANT_SLUG_STORAGE_KEY) || "").trim().toLowerCase();
    return v || null;
  } catch {
    return null;
  }
}

export function persistTenantSlug(slug: string): void {
  const normalized = normalizeWorkspaceSlug(slug);
  if (!normalized || normalized === PLATFORM_TENANT_SLUG) {
    clearStoredTenantSlug();
    return;
  }
  try {
    localStorage.setItem(TENANT_SLUG_STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
}

function clearStoredTenantSlug(): void {
  try {
    localStorage.removeItem(TENANT_SLUG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Map reserved / legacy slugs to the real control-plane workspace. */
export function normalizeWorkspaceSlug(slug: string | null | undefined): string {
  const s = (slug || "").trim().toLowerCase();
  if (!s || s === INTERNAL_PLATFORM_SLUG) return PLATFORM_TENANT_SLUG;
  return s;
}

function isControlPlaneHost(hostname: string, baseDomain: string): boolean {
  const host = (hostname || "").split(":")[0].toLowerCase().replace(/\.$/, "");
  const base = baseDomain.toLowerCase().replace(/^\./, "");
  return (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(host) ||
    host === base
  );
}

/**
 * Resolve the active tenant slug for the current browser context.
 */
export function resolveTenantSlug(opts?: {
  hostname?: string;
  search?: string;
  baseDomain?: string;
}): string {
  const hostname = opts?.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  const search = opts?.search ?? (typeof window !== "undefined" ? window.location.search : "");
  const baseDomain = opts?.baseDomain ?? getTenantBaseDomain();

  const fromQuery = readQueryTenant(search);
  if (fromQuery) {
    const slug = normalizeWorkspaceSlug(fromQuery);
    persistTenantSlug(slug);
    return slug;
  }

  // On bare apex / localhost without ?tenant= query param, always default to public control-plane
  if (isControlPlaneHost(hostname, baseDomain)) {
    return PLATFORM_TENANT_SLUG;
  }

  const fromHost = parseTenantSlugFromHostname(hostname, baseDomain);
  if (fromHost) return normalizeWorkspaceSlug(fromHost);

  const fromStore = readStoredTenant();
  if (fromStore) return normalizeWorkspaceSlug(fromStore);

  const fromEnv = (import.meta.env.VITE_TENANT_SLUG as string | undefined)?.trim().toLowerCase();
  if (fromEnv) return normalizeWorkspaceSlug(fromEnv);

  return PLATFORM_TENANT_SLUG;
}

export async function fetchTenantInfo(slug?: string): Promise<TenantInfo> {
  const resolved = (slug || resolveTenantSlug()).toLowerCase();
  const url = `${API_BASE}/tenant-info/?slug=${encodeURIComponent(resolved)}`;

  // Timeout after 10s so the Loading workspace screen never hangs forever
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "X-Tenant-Slug": resolved,
      },
    });
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    const isTimeout = fetchErr?.name === "AbortError";
    const err = new Error(
      isTimeout
        ? `Connection to workspace timed out. Is the backend running?`
        : `Unable to connect to backend: ${fetchErr?.message || "Network error"}`
    ) as Error & { status?: number; slug?: string };
    err.status = 503;
    err.slug = resolved;
    throw err;
  }
  clearTimeout(timeoutId);

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      body?.message ||
      (res.status === 404
        ? `Unknown tenant "${resolved}".`
        : res.status === 403
          ? `Tenant "${resolved}" is suspended.`
          : `Unable to load tenant "${resolved}".`);
    const err = new Error(message) as Error & { status?: number; slug?: string };
    err.status = res.status;
    err.slug = resolved;
    throw err;
  }

  // Envelope unwrap: { status, data } or plain
  const data = body?.status === "success" && body.data ? body.data : body;
  return data as TenantInfo;
}
