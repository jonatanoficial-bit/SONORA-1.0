import { el } from "../ui/dom.js";
import { clearOverrides } from "../storage.js";
import { toast } from "../ui/toast.js";

export function renderSettings(ctx) {
  const { appInfo, coreManifest } = ctx.content;

  return el("div", {},
    el("div", { class: "card" },
      el("div", { class: "h1" }, "Ajustes"),
      el("div", { class: "p" }, "Preferências locais e ações rápidas.")
    ),
    el("div", { class: "card" },
      el("div", { class: "h2" }, "Info"),
      el("div", { class: "tiny" }, `Core v${coreManifest.core_version} • Build ${appInfo.build}`),
      el("div", { class: "sep" }),
      el("button", { class: "btn secondary", onclick: () => { clearOverrides(); toast("Dados locais limpos"); setTimeout(()=>location.reload(), 400); } },
        "Limpar overrides (LocalStorage)"
      )
    )
  );
}
