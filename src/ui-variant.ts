export type UiVariant = "product" | "liquid";

export const UI_VARIANTS: UiVariant[] = ["product", "liquid"];

export function normalizeUiVariant(value: string | null | undefined): UiVariant {
  return value === "liquid" ? "liquid" : "product";
}

export function readUiVariantFromSearch(search: string): UiVariant {
  return normalizeUiVariant(new URLSearchParams(search).get("uiVariant"));
}
