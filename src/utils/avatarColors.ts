/** Elegant pastel palette — soft backgrounds with muted accent text (not harsh solids). */

export type PastelTone = { bg: string; text: string; border: string };

export const PASTEL_AVATAR_PALETTE: PastelTone[] = [
  { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe" },
  { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
  { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  { bg: "#fdf4ff", text: "#a21caf", border: "#f0abfc" },
  { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  { bg: "#faf5ff", text: "#6d28d9", border: "#c4b5fd" },
  { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
];

export const PASTEL_DEPT_PALETTE: PastelTone[] = [
  { bg: "#eef2ff", text: "#6366f1", border: "#c7d2fe" },
  { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  { bg: "#ecfdf5", text: "#059669", border: "#a7f3d0" },
  { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  { bg: "#f5f3ff", text: "#8b5cf6", border: "#ddd6fe" },
  { bg: "#fdf2f8", text: "#db2777", border: "#fbcfe8" },
  { bg: "#f0fdfa", text: "#14b8a6", border: "#99f6e4" },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

export function avatarPastel(name: string): PastelTone {
  return PASTEL_AVATAR_PALETTE[hashName(name) % PASTEL_AVATAR_PALETTE.length];
}

const deptCache: Record<string, PastelTone> = {};

export function deptPastel(dept: string): PastelTone {
  if (!deptCache[dept]) {
    deptCache[dept] = PASTEL_DEPT_PALETTE[Object.keys(deptCache).length % PASTEL_DEPT_PALETTE.length];
  }
  return deptCache[dept];
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
