import { loadOverrides } from "./storage.js";

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao carregar: ${path}`);
  return res.json();
}

export async function loadContent() {
  // Base manifests
  const coreManifest = await fetchJson("content/core/manifest.json");
  const appInfo = await fetchJson(coreManifest.app_info);

  // Overrides (static-friendly)
  const overrides = loadOverrides();
  const effectiveManifest = overrides?.manifest ?? coreManifest;

  const dlcMap = {};
  const dlcList = [];

  for (const item of effectiveManifest.installed_dlcs ?? []) {
    const id = item.id;
    const enabled = item.enabled !== false;

    // allow override enable/disable via overrides.dlc[id].enabled
    const o = overrides?.dlc?.[id];
    const effectiveEnabled = (o && "enabled" in o) ? !!o.enabled : enabled;

    if (!effectiveEnabled) continue;

    // allow override of dlc manifest/data via overrides
    let dlcManifest;
    try {
      dlcManifest = o?.dlcManifest ? o.dlcManifest : await fetchJson(`content/dlc/${id}/dlc.json`);
    } catch (e) {
      console.warn("DLC missing:", id, e);
      continue;
    }
    const dlcData = o?.dlcData ? o.dlcData : await fetchJson(dlcManifest.data);

    dlcMap[id] = { manifest: dlcManifest, data: dlcData };
    dlcList.push(dlcManifest);
  }

  return {
    appInfo,
    coreManifest: effectiveManifest,
    dlc: dlcMap,
    dlcList
  };
}
