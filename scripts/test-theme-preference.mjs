import assert from "node:assert/strict";
import {
  LEGACY_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  normalizeThemePreference,
  resolveEffectiveTheme
} from "../src/ui-theme.ts";

assert.equal(THEME_STORAGE_KEY, "codex-monitor-desktop.themePreference");
assert.equal(LEGACY_THEME_STORAGE_KEY, "codex-animation-monitor.themePreference");

assert.equal(normalizeThemePreference("system"), "system");
assert.equal(normalizeThemePreference("light"), "light");
assert.equal(normalizeThemePreference("dark"), "dark");
assert.equal(normalizeThemePreference("invalid"), "system");
assert.equal(normalizeThemePreference(null), "system");

assert.equal(resolveEffectiveTheme("light", true), "light");
assert.equal(resolveEffectiveTheme("dark", false), "dark");
assert.equal(resolveEffectiveTheme("system", true), "dark");
assert.equal(resolveEffectiveTheme("system", false), "light");

console.log("theme preference tests passed");
