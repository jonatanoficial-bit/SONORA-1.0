import { el } from "../ui/dom.js";
import { toast } from "../ui/toast.js";

export function renderHome(ctx) {
  const { appInfo, dlcList } = ctx.content;
  const root = el("div", { class: "card" },
    el("div", { class: "h1" }, appInfo.title),
    el("div", { class: "p" }, appInfo.tagline),
    el("div", { class: "sep" }),
    el("div", { class: "tiny" }, "Propósito do app/jogo:"),
    el("div", { class: "p" }, appInfo.purpose_placeholder),
    el("div", { class: "sep" }),
    el("div", { class: "h2" }, "DLCs Ativas"),
    el("div", { class: "p" }, dlcList.length ? `${dlcList.length} pacote(s) carregado(s) dinamicamente.` : "Nenhuma DLC ativa."),
    el("div", { class: "sep" }),
    el("div", { class: "row" },
      el("button", { class: "btn", onclick: () => toast("Dica: abra o Admin para editar conteúdo e exportar JSON.") },
        "Abrir dica rápida"
      ),
      el("button", { class: "btn secondary", "data-route": "/dlc" }, "Ver DLCs")
    )
  );
  return root;
}
