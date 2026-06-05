export const LAYOUT_DEBUG_METRICS_ELEMENT_ID = "codex-animation-layout-debug";
export const LAYOUT_DEBUG_METRICS_WINDOW_KEY = "__codexAnimationLayoutDebug";

type LayoutDebugElement = {
  id: string;
  type?: string;
  textContent: string | null;
  remove?: () => void;
};

type LayoutDebugDocument = {
  head?: { appendChild: (element: LayoutDebugElement) => unknown };
  body?: { appendChild: (element: LayoutDebugElement) => unknown };
  documentElement?: { appendChild: (element: LayoutDebugElement) => unknown };
  createElement: (tagName: string) => LayoutDebugElement;
  getElementById: (id: string) => LayoutDebugElement | null;
};

type LayoutDebugWindow = Record<string, unknown>;

type PublishLayoutDebugMetricsOptions = {
  enabled: boolean;
  documentRef?: LayoutDebugDocument;
  windowRef?: LayoutDebugWindow;
};

export function publishLayoutDebugMetricsPayload(
  payload: unknown,
  options: PublishLayoutDebugMetricsOptions
) {
  const documentRef = options.documentRef ?? getDocument();
  const windowRef = options.windowRef ?? getWindow();

  if (!options.enabled) {
    clearWindowPayload(windowRef);
    clearDocumentPayload(documentRef);
    return;
  }

  publishWindowPayload(windowRef, payload);
  publishDocumentPayload(documentRef, payload);
}

function getDocument(): LayoutDebugDocument | undefined {
  return typeof document === "undefined" ? undefined : document as unknown as LayoutDebugDocument;
}

function getWindow(): LayoutDebugWindow | undefined {
  return typeof window === "undefined" ? undefined : window as unknown as LayoutDebugWindow;
}

function publishWindowPayload(windowRef: LayoutDebugWindow | undefined, payload: unknown) {
  if (!windowRef) {
    return;
  }

  try {
    if (Object.isExtensible(windowRef) || LAYOUT_DEBUG_METRICS_WINDOW_KEY in windowRef) {
      windowRef[LAYOUT_DEBUG_METRICS_WINDOW_KEY] = payload;
    }
  } catch {
    // Some browser automation surfaces expose a non-extensible window proxy.
  }
}

function clearWindowPayload(windowRef: LayoutDebugWindow | undefined) {
  if (!windowRef) {
    return;
  }

  try {
    delete windowRef[LAYOUT_DEBUG_METRICS_WINDOW_KEY];
  } catch {
    // Ignore read-only or non-extensible window proxies.
  }
}

function publishDocumentPayload(documentRef: LayoutDebugDocument | undefined, payload: unknown) {
  if (!documentRef) {
    return;
  }

  const element = getOrCreateMetricsElement(documentRef);
  if (!element) {
    return;
  }

  element.textContent = JSON.stringify(payload);
}

function clearDocumentPayload(documentRef: LayoutDebugDocument | undefined) {
  const element = documentRef?.getElementById(LAYOUT_DEBUG_METRICS_ELEMENT_ID);
  element?.remove?.();
}

function getOrCreateMetricsElement(documentRef: LayoutDebugDocument) {
  const existing = documentRef.getElementById(LAYOUT_DEBUG_METRICS_ELEMENT_ID);
  if (existing) {
    return existing;
  }

  const element = documentRef.createElement("script");
  element.id = LAYOUT_DEBUG_METRICS_ELEMENT_ID;
  element.type = "application/json";
  element.textContent = "";

  const parent = documentRef.head ?? documentRef.body ?? documentRef.documentElement;
  parent?.appendChild(element);
  return element;
}
