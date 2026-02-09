import { el } from "../ui/dom.js";

export function renderDlc(ctx) {
  const { dlcList } = ctx.content;

  const cards = dlcList.map(m => {
    const iconPath = m.assets?.icon;
    const icon = iconPath ? el("img", { src: iconPath, alt: "", style:"width:40px;height:40px;border-radius:14px" }) : null;

    return el("div", { class: "tile" },
      el("div", { class: "tile-top" },
        el("div", { style:"display:flex;align-items:center;gap:10px" },
          icon,
          el("div", {},
            el("div", { class:"h2", style:"margin:0" }, m.name),
            el("div", { class:"tiny" }, `ID: ${m.id} • v${m.version}`)
          )
        ),
        el("div", { class:"badge" }, "Ativa")
      ),
      el("div", { class: "p" }, m.description ?? "")
    );
  });

  return el("div", {},
    el("div", { class: "card" },
      el("div", { class: "h1" }, "DLCs / Expansões"),
      el("div", { class: "p" }, "O core carrega conteúdo via manifests JSON. Admin permite ativar/desativar e editar dados (LocalStorage).")
    ),
    el("div", { class: "grid", style:"margin-top:12px" }, ...cards)
  );
}
