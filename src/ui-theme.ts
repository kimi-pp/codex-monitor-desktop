export type ThemePreference = "system" | "light" | "dark";

export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "codex-monitor-desktop.themePreference";
export const LEGACY_THEME_STORAGE_KEY = "codex-animation-monitor.themePreference";

const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : "system";
}

export function resolveEffectiveTheme(preference: ThemePreference, systemPrefersDark: boolean): EffectiveTheme {
  if (preference === "light" || preference === "dark") {
    return preference;
  }

  return systemPrefersDark ? "dark" : "light";
}
