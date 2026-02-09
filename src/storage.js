// Storage adapter: static-first (LocalStorage), ready to swap for backend later.
const KEY = "premiumShell.contentOverrides.v1";

export function loadOverrides() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOverrides(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function clearOverrides() {
  localStorage.removeItem(KEY);
}

export function exportOverrides() {
  return loadOverrides() ?? { version: 1, manifest: null, dlc: {} };
}

export function importOverrides(obj) {
  if (!obj || typeof obj !== "object") throw new Error("JSON inválido");
  if (!("version" in obj)) obj.version = 1;
  if (!("dlc" in obj)) obj.dlc = {};
  saveOverrides(obj);
}
