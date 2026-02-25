import { Router } from "./router.js";
import { loadContent } from "./contentLoader.js";
import { initSheet } from "./ui/sheet.js";
import { toast } from "./ui/toast.js";

import { renderHome } from "./screens/home.js";
import { renderLibrary } from "./screens/library.js";
import { renderDlc } from "./screens/dlc.js";
import { renderSettings } from "./screens/settings.js";
import { renderQuote } from "./screens/quote.js";
import { renderReport } from "./screens/report.js";
import { renderSim } from "./screens/sim.js";
import { renderIR } from "./screens/ir.js";
import { renderAdmin } from "./screens/admin.js";
import { renderPlan } from "./screens/plan.js";
import { renderMiniGame } from "./screens/play.js";
import { renderMeasure } from "./screens/measure.js";

const app = document.getElementById("app");
const brandSub = document.getElementById("brandSub");

const ctx = {
  content: null,
  router: null,
  mount: (node) => {
    app.innerHTML = "";
    app.appendChild(node);
    app.scrollTop = 0;
  }
};

const routes = {
  "/home": () => renderHome(ctx),
  "/library": () => renderLibrary(ctx),
  "/dlc": () => renderDlc(ctx),
  "/settings": () => renderSettings(ctx),
  "/admin": () => renderAdmin(ctx),
  "/play": () => renderMiniGame(ctx),
  "/measure": () => renderMeasure(ctx),
  "/plan": () => renderPlan(ctx),
  "/quote": () => renderQuote(ctx),
  "/report": () => renderReport(ctx),
  "/sim": () => renderSim(ctx),
  "/ir": () => renderIR(ctx),
};

function setActiveDock(path) {
  document.querySelectorAll(".dock-item").forEach(btn => {
    const r = btn.getAttribute("data-route");
    if (r === path) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
}

async function boot() {
  ctx.content = await loadContent();
  brandSub.textContent = `${ctx.content.appInfo.tagline} • Build ${ctx.content.appInfo.buildStamp || ctx.content.appInfo.build}`;

  ctx.router = new Router({
    knownRoutes: Object.keys(routes),
    onRoute: (path) => {
      const view = routes[path] ?? routes["/home"];
      setActiveDock(path in routes ? path : "/home");
      ctx.mount(view());
    }
  });

  initSheet(ctx.router, `Build: 2026-02-09 • Core v${ctx.content.coreManifest.core_version}`);

  // Quick actions button
  document.getElementById("btnQuick").addEventListener("click", () => {
    toast("Abrindo Medição (RT) • use PC + microfone.");
    ctx.router.go("/measure");
  });

  ctx.router.start("/home");

  // Add a subtle initial toast
  setTimeout(() => toast("Pronto. Mobile-first, DLC-ready ✅"), 350);
}

boot().catch((e) => {
  console.error(e);
  app.innerHTML = `<div class="card"><div class="h1">Erro ao iniciar</div><div class="p">Verifique se você está rodando via servidor (não via file://).</div><div class="tiny">${String(e)}</div></div>`;
});
