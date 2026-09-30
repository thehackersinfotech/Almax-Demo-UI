// import { create } from "zustand";
// import { persist } from "zustand/middleware";

// export const THEME_STORAGE_KEY = "bms-theme";

// interface ThemeState {
//   isDark: boolean;
//   toggle: () => void;
//   setDark: (value: boolean) => void;
// }

// export const useThemeStore = create<ThemeState>()(
//   persist(
//     (set) => ({
//       isDark: false,
//       toggle: () => set((s) => ({ isDark: !s.isDark })),
//       setDark: (value) => set({ isDark: value }),
//     }),
//     { name: THEME_STORAGE_KEY },
//   ),
// );

// export function applyThemeToDocument(isDark: boolean) {
//   document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
// }
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const THEME_STORAGE_KEY = "bms-theme";

export function applyThemeToDocument(isDark: boolean) {
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}

// Read persisted value synchronously before any render
export function getPersistedIsDark(): boolean {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return false;
    return !!JSON.parse(raw)?.state?.isDark;
  } catch {
    return false;
  }
}

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: getPersistedIsDark(), // ← initialize synchronously, not false
      toggle: () =>
        set((s) => {
          const next = !s.isDark;
          applyThemeToDocument(next);
          return { isDark: next };
        }),
    }),
    { name: THEME_STORAGE_KEY }
  )
);