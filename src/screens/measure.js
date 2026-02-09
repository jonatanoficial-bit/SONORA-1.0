
import { el } from "../ui/dom.js";

export function renderMeasure(ctx) {
  return el("div", {},
    el("div", { class:"card" },
      el("div", { class:"h1" }, "Medição Acústica"),
      el("div", { class:"p" }, "Assistente guiado (fase 1). Nesta fase, o fluxo está preparado para receber a medição real via microfone.")
    ),
    el("div", { class:"card" },
      el("div", { class:"h2" }, "Passos"),
      el("ol", { class:"p" },
        el("li", {}, "Cadastrar dimensões do ambiente"),
        el("li", {}, "Selecionar uso (sermão / banda)"),
        el("li", {}, "Executar medição por microfone (fase 2)"),
        el("li", {}, "Gerar recomendações e relatório")
      )
    ),
    el("div", { class:"card" },
      el("button", { class:"btn", onclick: () => alert("Medição real entra na próxima fase.") }, "Iniciar medição")
    )
  );
}
