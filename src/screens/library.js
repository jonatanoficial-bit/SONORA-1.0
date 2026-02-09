import { el } from "../ui/dom.js";

export function renderLibrary(ctx) {
  const dlc = ctx.content.dlc;
  const items = [];

  for (const [id, pack] of Object.entries(dlc)) {
    const packItems = pack.data.items ?? [];
    for (const it of packItems) items.push({ dlc: id, ...it, _pack: pack.manifest });
  }

  const root = el("div", {},
    el("div", { class: "card" },
      el("div", { class: "h1" }, "Conteúdo"),
      el("div", { class: "p" }, "Itens carregados das DLCs (exemplo de conteúdo modular).")
    ),
    el("div", { class: "grid", style: "margin-top:12px" },
      ...items.map(it => el("div", { class: "tile" },
        el("div", { class: "tile-top" },
          el("div", { class: "h2" }, it.title),
          el("div", { class: "badge" }, it._pack.name)
        ),
        el("div", { class: "p" }, it.body ?? ""),
        el("div", { class: "tiny" }, `DLC: ${it.dlc} • v${it._pack.version}`)
      ))
    )
  );

  if (!items.length) {
    root.appendChild(el("div", { class: "card" }, el("div", { class: "p" }, "Nenhum item encontrado. Ative uma DLC no Admin.")));
  }

  return root;
}
