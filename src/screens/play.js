// Optional demo mini-game built from DLC 'demo_levels'.
// This is intentionally simple but shows how gameplay modules can be DLC-driven.
import { el } from "../ui/dom.js";
import { toast } from "../ui/toast.js";

export function renderMiniGame(ctx) {
  const pack = ctx.content.dlc?.demo_levels;
  const levels = pack?.data?.levels ?? [];

  const root = el("div", {},
    el("div", { class:"card" },
      el("div", { class:"h1" }, "Mini Game (Demo)"),
      el("div", { class:"p" }, "Exemplo de mecânica simples carregada via DLC. Você pode trocar os níveis no Admin.")
    )
  );

  if (!levels.length) {
    root.appendChild(el("div", { class:"card" }, el("div", { class:"p" }, "Ative a DLC 'demo_levels' para ver os níveis.")));
    return root;
  }

  const grid = el("div", { class:"grid", style:"margin-top:12px" });
  for (const lv of levels) {
    grid.appendChild(el("div", { class:"tile" },
      el("div", { class:"tile-top" },
        el("div", { class:"h2" }, lv.name),
        el("div", { class:"badge" }, lv.type)
      ),
      el("div", { class:"p" }, lv.goal),
      el("button", { class:"btn small", onclick: () => runLevel(lv) }, "Iniciar")
    ));
  }
  root.appendChild(grid);

  function runLevel(lv) {
    if (lv.type === "tap") return runTap(lv);
    if (lv.type === "focus") return runFocus(lv);
    if (lv.type === "memory") return runMemory(lv);
    toast("Tipo de nível não suportado");
  }

  function runTap(lv) {
    let taps = 0;
    let t = lv.time;
    const kpi = el("div", { class:"kpi" }, `${taps}/${lv.target}`);
    const timer = el("div", { class:"badge" }, `${t}s`);
    const btn = el("button", { class:"btn", onclick: () => { taps++; kpi.textContent = `${taps}/${lv.target}`; } }, "TOCAR");
    const panel = el("div", { class:"card" },
      el("div", { class:"h2" }, lv.name),
      el("div", { class:"row" }, kpi, timer),
      el("div", { class:"sep" }),
      btn,
      el("div", { style:"height:10px" }),
      el("button", { class:"btn secondary", onclick: () => ctx.router.go("/play") }, "Encerrar")
    );
    ctx.mount(panel);

    const tick = setInterval(() => {
      t--;
      timer.textContent = `${t}s`;
      if (t <= 0) {
        clearInterval(tick);
        const ok = taps >= lv.target;
        toast(ok ? "Sucesso!" : "Tente novamente");
        ctx.router.go("/play");
      }
    }, 1000);
  }

  function runFocus(lv) {
    let score = 0;
    let remaining = lv.targets;
    let t = lv.time;

    const kpi = el("div", { class:"kpi" }, `${score}`);
    const timer = el("div", { class:"badge" }, `${t}s`);
    const info = el("div", { class:"p" }, "Toque SOMENTE nos alvos dourados. Alvos falsos tiram pontos.");

    const arena = el("div", { class:"card" },
      el("div", { class:"h2" }, lv.name),
      el("div", { class:"row" }, kpi, timer),
      el("div", { class:"sep" }),
      info
    );

    const pad = el("div", { style:"display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px" });
    arena.appendChild(pad);

    function spawn() {
      pad.innerHTML = "";
      const goodIndex = Math.floor(Math.random() * 8);
      for (let i=0;i<8;i++){
        const good = i === goodIndex;
        const b = el("button", {
          class: "btn small " + (good ? "" : "ghost"),
          style: "justify-content:center",
          onclick: () => {
            if (good){ score++; remaining--; }
            else { score = Math.max(0, score-1); }
            kpi.textContent = `${score}`;
            if (remaining <= 0) {
              toast("Sucesso!");
              ctx.router.go("/play");
              return;
            }
            spawn();
          }
        }, good ? "✨" : "•");
        pad.appendChild(b);
      }
    }

    ctx.mount(arena);
    spawn();

    const tick = setInterval(() => {
      t--;
      timer.textContent = `${t}s`;
      if (t <= 0) {
        clearInterval(tick);
        toast("Tempo!");
        ctx.router.go("/play");
      }
    }, 1000);
  }

  function runMemory(lv) {
    const pairs = lv.pairs ?? 6;
    let t = lv.time ?? 60;
    const symbols = "◆●▲■★✦✺✹✧✷✸✪✫".slice(0, pairs).split("");
    const deck = [...symbols, ...symbols].sort(()=>Math.random()-0.5);

    let openA = null;
    let lock = false;
    let matched = 0;

    const timer = el("div", { class:"badge" }, `${t}s`);
    const kpi = el("div", { class:"kpi" }, `0/${pairs}`);

    const grid = el("div", { style:"display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px" });

    const panel = el("div", { class:"card" },
      el("div", { class:"h2" }, lv.name),
      el("div", { class:"row" }, kpi, timer),
      el("div", { class:"sep" }),
      grid,
      el("div", { style:"height:10px" }),
      el("button", { class:"btn secondary", onclick: () => ctx.router.go("/play") }, "Voltar")
    );

    deck.forEach((s, idx) => {
      const b = el("button", { class:"btn small ghost", "data-i": String(idx) }, " ");
      b.addEventListener("click", () => onFlip(b, s));
      grid.appendChild(b);
    });

    ctx.mount(panel);

    function onFlip(btn, sym){
      if (lock) return;
      if (btn.getAttribute("data-open") === "1") return;

      btn.textContent = sym;
      btn.setAttribute("data-open","1");
      btn.classList.remove("ghost");

      if (!openA) { openA = { btn, sym }; return; }

      if (openA.sym === sym) {
        matched++;
        kpi.textContent = `${matched}/${pairs}`;
        openA = null;
        if (matched >= pairs) {
          toast("Sucesso!");
          ctx.router.go("/play");
        }
      } else {
        lock = true;
        setTimeout(() => {
          btn.textContent = " ";
          btn.setAttribute("data-open","0");
          btn.classList.add("ghost");
          openA.btn.textContent = " ";
          openA.btn.setAttribute("data-open","0");
          openA.btn.classList.add("ghost");
          openA = null;
          lock = false;
        }, 550);
      }
    }

    const tick = setInterval(() => {
      t--;
      timer.textContent = `${t}s`;
      if (t <= 0) {
        clearInterval(tick);
        toast("Tempo!");
        ctx.router.go("/play");
      }
    }, 1000);
  }

  return root;
}
