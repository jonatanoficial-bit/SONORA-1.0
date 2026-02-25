
let deferredPrompt = null;

export function initPWA(){
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.__sonoraCanInstall = true;
    window.dispatchEvent(new Event("sonora:installable"));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.__sonoraCanInstall = false;
    window.dispatchEvent(new Event("sonora:installed"));
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }
}

export async function promptInstall(){
  if(!deferredPrompt) return { ok:false, reason:"not-ready" };
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  window.__sonoraCanInstall = false;
  return { ok: choice?.outcome === "accepted", outcome: choice?.outcome || "dismissed" };
}
