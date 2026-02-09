import { toast } from "./toast.js";
import { exportOverrides, importOverrides } from "../storage.js";

export function initSheet(router, buildInfoText) {
  const sheet = document.getElementById("sheet");
  const back = document.getElementById("sheetBackdrop");
  const close = document.getElementById("btnCloseSheet");
  const btnMenu = document.getElementById("btnMenu");
  const btnExport = document.getElementById("btnExport");
  const btnImport = document.getElementById("btnImport");
  const file = document.getElementById("fileImport");
  const buildInfo = document.getElementById("buildInfo");
  buildInfo.textContent = buildInfoText;

  const open = () => { sheet.classList.add("show"); sheet.setAttribute("aria-hidden","false"); };
  const hide = () => { sheet.classList.remove("show"); sheet.setAttribute("aria-hidden","true"); };

  btnMenu.addEventListener("click", open);
  back.addEventListener("click", hide);
  close.addEventListener("click", hide);

  sheet.addEventListener("click", (e) => {
    const r = e.target.closest("[data-route]");
    if (!r) return;
    hide();
    router.go(r.getAttribute("data-route"));
  });

  btnExport.addEventListener("click", () => {
    const data = exportOverrides();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "content-overrides.json";
    a.click();
    toast("Exportado: content-overrides.json");
  });

  btnImport.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    const txt = await f.text();
    try{
      const obj = JSON.parse(txt);
      importOverrides(obj);
      toast("Importado com sucesso");
      location.reload();
    }catch(err){
      toast("Falha ao importar JSON");
      console.error(err);
    }
  });

  return { open, hide };
}
