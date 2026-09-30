// Keycloak group → role flag mapping.
// Override defaults via Vite env vars in .env:
//   VITE_KC_PMO_GROUPS=admin,des-admin
//   VITE_KC_MANAGER_GROUPS=admin,hr,officer

const splitEnv = (key: string, fallback: string): string[] =>
  (import.meta.env[key] ?? fallback)
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);

export const PMO_GROUPS: string[] = splitEnv("VITE_KC_PMO_GROUPS", "admin,des-admin");
export const MANAGER_GROUPS: string[] = splitEnv("VITE_KC_MANAGER_GROUPS", "admin,hr,officer");

export function resolveGroupFlags(group: string): { is_pmo: boolean; is_manager: boolean } {
  const name = group.trim().toLowerCase();
  return {
    is_pmo: PMO_GROUPS.includes(name),
    is_manager: MANAGER_GROUPS.includes(name),
  };
}
