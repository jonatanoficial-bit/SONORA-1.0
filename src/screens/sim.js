
import { el } from "../ui/dom.js";
import { toast } from "../ui/toast.js";
import { loadProjects, getProject, upsertProject } from "../projects.js";
import { defaultSim, simulate } from "../simEngine.js";

function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }

export function renderSim(ctx){
  const projects = loadProjects();
  const header = el("div",{class:"card hero"},
    el("div",{class:"h1"},"Simulador"),
    el("div",{class:"p"},"Fase 10: mapa interativo + heatmap de cobertura + score (gameplay). Ajuste o sistema e melhore a pontuação."),
    el("div",{class:"tiny"},"Modelo simplificado (indicativo). Ótimo para planejar e apresentar ao cliente.")
  );

  const pick = el("select",{class:"input"});
  pick.appendChild(el("option",{value:""},"Selecionar projeto…"));
  projects.slice(0,30).forEach(p=> pick.appendChild(el("option",{value:p.id}, p.name)));
  const openBtn = el("button",{class:"btn",onclick:()=>openProject(pick.value)},"Abrir no simulador");
  const quickBtn = el("button",{class:"btn secondary",onclick:()=>openStandalone()},"Simular sem projeto");
  const chooser = el("div",{class:"card"},
    el("div",{class:"h2"},"Projeto"),
    pick,
    el("div",{style:"height:10px"}),
    el("div",{class:"row"}, openBtn, quickBtn)
  );

  const tip = el("div",{class:"card"},
    el("div",{class:"h2"},"Como “jogar”"),
    el("ul",{class:"p"},
      el("li",{},"Arraste as caixas (L/R) e subs no mapa."),
      el("li",{},"Ajuste Toe-in, Directivity e Alvo dB."),
      el("li",{},"Busque aumentar o Score (cobertura + uniformidade)."),
      el("li",{},"Salve no projeto e gere relatório depois.")
    )
  );

  return el("div",{}, header, chooser, tip);

  function openProject(id){
    if(!id) return toast("Selecione um projeto");
    const p = getProject(id);
    if(!p) return toast("Projeto não encontrado");
    const sim = hydrateSimFromProject(p);
    mountSim(sim, p);
  }
  function openStandalone(){
    mountSim(defaultSim(), null);
  }

  function hydrateSimFromProject(p){
    const base = p.sim || defaultSim();
    // room
    base.room = {
      w: clamp(Number(p.width || base.room.w || Math.sqrt(p.area||120)), 6, 40),
      l: clamp(Number(p.length || base.room.l || (p.area ? (p.area/Math.sqrt(p.area)) : 18)), 6, 60),
      h: clamp(Number(p.height || base.room.h || 4), 2.2, 12)
    };
    // RT penalty (very rough): if RT avg > 1.6 => penalty
    const rtAvg = p.rtAvg || p.rt || null;
    if(rtAvg){
      base.options.rtPenalty = clamp((rtAvg - 1.2) * 3.0, 0, 6);
    }
    return base;
  }

  function mountSim(sim, project){
    const title = project ? `Simulador — ${project.name}` : "Simulador — modo livre";

    const scoreKpi = el("div",{class:"kpi"},
      el("div",{class:"k"},"Score"),
      el("div",{class:"v"},"0"),
      el("div",{class:"t"},"Cobertura + Uniformidade")
    );
    const meanKpi = el("div",{class:"kpi"},
      el("div",{class:"k"},"Média"),
      el("div",{class:"v"},"—"),
      el("div",{class:"t"},"dB (relativo)")
    );
    const stdKpi = el("div",{class:"kpi"},
      el("div",{class:"k"},"Desvio"),
      el("div",{class:"v"},"—"),
      el("div",{class:"t"},"Uniformidade")
    );
    const kpis = el("div",{class:"kpi-grid"}, scoreKpi, meanKpi, stdKpi);

    const canvas = document.createElement("canvas");
    canvas.width = 900; canvas.height = 700;
    canvas.style.width = "100%";
    canvas.style.height = "min(64vh, 560px)";
    canvas.className = "sim-canvas";

    const controls = buildControls(sim, () => { run(); draw(); });

    const saveBtn = el("button",{class:"btn small",onclick:()=>{
      if(!project) return toast("Abra um projeto para salvar");
      project.sim = sim;
      project.simResult = lastResult ? { score: lastResult.score, at: Date.now() } : null;
      upsertProject(project);
      toast("Simulação salva no projeto");
    }},"Salvar no projeto");

    const reportBtn = el("button",{class:"btn small secondary","data-route":"/report"},"Ir para Relatório");

    const backBtn = el("button",{class:"btn ghost",onclick:()=>ctx.router.go("/sim")},"Voltar");

    const panel = el("div",{class:"card"},
      el("div",{class:"h1"}, title),
      kpis,
      el("div",{style:"height:12px"}),
      canvas,
      el("div",{style:"height:12px"}),
      el("div",{class:"row"}, saveBtn, reportBtn, backBtn),
      el("div",{class:"sep"}),
      controls
    );

    ctx.mount(panel);

    let drag = null;
    let lastResult = null;

    function worldToCanvas(x,y){
      const pad = 22;
      const w = canvas.width - pad*2;
      const h = canvas.height - pad*2;
      return {
        cx: pad + (x/sim.room.w)*w,
        cy: pad + (y/sim.room.l)*h
      };
    }
    function canvasToWorld(cx,cy){
      const pad = 22;
      const w = canvas.width - pad*2;
      const h = canvas.height - pad*2;
      return {
        x: clamp(((cx-pad)/w)*sim.room.w, 0, sim.room.w),
        y: clamp(((cy-pad)/h)*sim.room.l, 0, sim.room.l)
      };
    }

    function hitTest(cx,cy){
      const pts = [];
      for(const t of sim.tops) pts.push({ kind:"top", ref:t, r:18 });
      for(const s of sim.subs) pts.push({ kind:"sub", ref:s, r:16 });
      for(const p of pts){
        const {cx:tx,cy:ty} = worldToCanvas(p.ref.x, p.ref.y);
        const d = Math.hypot(cx-tx, cy-ty);
        if(d <= p.r) return p;
      }
      return null;
    }

    canvas.addEventListener("pointerdown",(e)=>{
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX-rect.left) * (canvas.width/rect.width);
      const cy = (e.clientY-rect.top) * (canvas.height/rect.height);
      const h = hitTest(cx,cy);
      if(h){ drag = h; canvas.setPointerCapture(e.pointerId); }
    });
    canvas.addEventListener("pointermove",(e)=>{
      if(!drag) return;
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX-rect.left) * (canvas.width/rect.width);
      const cy = (e.clientY-rect.top) * (canvas.height/rect.height);
      const wpos = canvasToWorld(cx,cy);
      drag.ref.x = wpos.x;
      drag.ref.y = wpos.y;
      run(); draw();
    });
    canvas.addEventListener("pointerup",()=>{ drag=null; });

    function run(){
      lastResult = simulate(sim);
      scoreKpi.querySelector(".v").textContent = String(lastResult.score.overall);
      meanKpi.querySelector(".v").textContent = `${lastResult.score.mean.toFixed(1)}`;
      stdKpi.querySelector(".v").textContent = `${lastResult.score.std.toFixed(1)}`;
    }

    function draw(){
      const g = canvas.getContext("2d");
      const pad=22;
      const w=canvas.width-pad*2;
      const h=canvas.height-pad*2;

      g.clearRect(0,0,canvas.width,canvas.height);

      // frame
      g.fillStyle = "rgba(0,0,0,.18)";
      g.strokeStyle = "rgba(255,255,255,.12)";
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(pad, pad, w, h, 18);
      g.fill();
      g.stroke();

      if(!lastResult) return;
      const res = lastResult;
      const grid = res.grid;
      const vals = res.values;
      const min = res.min, max = res.max;

      // heatmap
      const cellW = w/(grid-1);
      const cellH = h/(grid-1);

      for(let yi=0; yi<grid; yi++){
        for(let xi=0; xi<grid; xi++){
          const v = vals[yi*grid+xi];
          if(v<-60) continue;
          const t = (v-min)/Math.max(1e-6, (max-min)); // 0..1
          // color via hsla (green->yellow->red)
          const hue = 140 - 140*t; // 140 green to 0 red
          g.fillStyle = `hsla(${hue}, 90%, 55%, 0.38)`;
          const x = pad + xi*cellW;
          const y = pad + yi*cellH;
          g.fillRect(x, y, cellW+1, cellH+1);
        }
      }

      // audience bounds
      const ax0 = pad + (res.bounds.ax0/sim.room.w)*w;
      const ax1 = pad + (res.bounds.ax1/sim.room.w)*w;
      const ay0 = pad + (res.bounds.ay0/sim.room.l)*h;
      const ay1 = pad + (res.bounds.ay1/sim.room.l)*h;

      g.strokeStyle="rgba(255,255,255,.22)";
      g.setLineDash([8,8]);
      g.lineWidth=2;
      g.strokeRect(ax0, ay0, ax1-ax0, ay1-ay0);
      g.setLineDash([]);

      // stage
      const st = sim.stage;
      const st0 = worldToCanvas(st.x - st.w/2, st.y);
      const st1 = worldToCanvas(st.x + st.w/2, st.y + st.d);
      g.fillStyle="rgba(255,255,255,.08)";
      g.strokeStyle="rgba(255,255,255,.16)";
      g.lineWidth=2;
      g.beginPath();
      g.roundRect(st0.cx, st0.cy, st1.cx-st0.cx, st1.cy-st0.cy, 14);
      g.fill(); g.stroke();

      // speakers
      drawNodes(sim.tops, "rgba(14,165,233,.95)", 18, true);
      if(sim.options.useSubs) drawNodes(sim.subs, "rgba(34,197,94,.95)", 16, false);

      // legend
      g.fillStyle="rgba(255,255,255,.78)";
      g.font="700 18px ui-sans-serif, system-ui";
      g.fillText("Heatmap de cobertura (indicativo)", pad+10, pad+26);

      g.font="600 14px ui-sans-serif, system-ui";
      g.fillStyle="rgba(255,255,255,.65)";
      g.fillText("Arraste: caixas e subs • tracejado: área do público", pad+10, pad+48);

      function drawNodes(list, color, r, showArrow){
        for(const n of list){
          const {cx,cy} = worldToCanvas(n.x,n.y);
          g.fillStyle=color;
          g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.fill();
          g.strokeStyle="rgba(0,0,0,.35)"; g.lineWidth=2; g.stroke();

          g.fillStyle="rgba(0,0,0,.55)";
          g.font="800 14px ui-sans-serif, system-ui";
          g.fillText(n.id, cx-5, cy+5);

          if(showArrow){
            g.strokeStyle="rgba(255,255,255,.65)";
            g.lineWidth=2;
            const ang = (Math.PI/2) - (n.rot*Math.PI/180);
            g.beginPath();
            g.moveTo(cx,cy);
            g.lineTo(cx + Math.cos(ang)*28, cy + Math.sin(ang)*28);
            g.stroke();
          }
        }
      }
    }

    function buildControls(sim, onChange){
      const opt = sim.options;
      const mk = (label, input) => el("div",{class:"tile"},
        el("div",{class:"badge"}, label),
        input
      );

      const target = el("input",{class:"input",type:"range",min:"88",max:"104",value: opt.target, oninput:()=>{ opt.target = Number(target.value); onChange(); }});
      const direct = el("input",{class:"input",type:"range",min:"0",max:"1",step:"0.01",value: opt.directivity, oninput:()=>{ opt.directivity = Number(direct.value); onChange(); }});
      const toe = el("input",{class:"input",type:"range",min:"0",max:"35",value: 18, oninput:()=>{ 
        const v = Number(toe.value);
        sim.tops[0].rot = v;
        sim.tops[1].rot = -v;
        onChange();
      }});
      const useSubs = el("input",{type:"checkbox",checked: opt.useSubs, onchange:()=>{ opt.useSubs = useSubs.checked; onChange(); }});
      useSubs.className = "toggle";

      const grid = el("input",{class:"input",type:"range",min:"28",max:"80",value: opt.grid, oninput:()=>{ opt.grid = Number(grid.value); onChange(); }});

      const reset = el("button",{class:"btn ghost",onclick:()=>{
        const d = defaultSim();
        sim.room=d.room; sim.stage=d.stage; sim.tops=d.tops; sim.subs=d.subs; sim.options={...d.options, ...sim.options};
        onChange(); toast("Reset aplicado");
      }},"Reset");

      const wrap = el("div",{},
        el("div",{class:"h2"},"Ajustes do simulador"),
        el("div",{class:"grid"},
          mk("Alvo (dB)", target),
          mk("Directivity", direct),
          mk("Toe-in", toe),
          mk("Grid", grid)
        ),
        el("div",{style:"height:10px"}),
        el("div",{class:"row"},
          el("label",{class:"chip"}, useSubs, el("span",{},"Subs")),
          reset
        ),
        el("div",{class:"sep"}),
        el("div",{class:"tiny"},"Observação: o heatmap é um modelo simplificado para planejamento e apresentação. Não substitui medição profissional.")
      );
      return wrap;
    }

    run(); draw();
  }
}
