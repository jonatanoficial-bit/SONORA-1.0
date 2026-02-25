
import { el } from "../ui/dom.js";
import { toast } from "../ui/toast.js";
import { loadProjects, getProject } from "../projects.js";
import { recommendPA } from "../planner.js";
import { calcChannels, suggestConsole, buildChecklist } from "../gearPlanner.js";

function fmt(n,d=2){ return (Math.round((n||0)*Math.pow(10,d))/Math.pow(10,d)).toFixed(d); }
function dt(ts){
  if(!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString();
}

export function renderReport(ctx){
  const projects = loadProjects();

  const header = el("div",{class:"card report-hero"},
    el("div",{class:"report-hero-top"},
      el("img",{class:"report-logo",src:"./assets/img/logo.svg",alt:"SONORA"}),
      el("div",{},
        el("div",{class:"h1"},"Relatório Premium"),
        el("div",{class:"p"},"Gere um PDF técnico-profissional (cliente-ready) com análise, planejamento e checklist.")
      )
    ),
    el("div",{class:"sep"}),
    el("div",{class:"row"},
      el("button",{class:"btn",onclick:()=> window.print()},"Imprimir / Salvar PDF"),
      el("button",{class:"btn secondary",onclick:()=> ctx.router.go("/measure")},"Ir para Medição"),
      el("button",{class:"btn ghost",onclick:()=> ctx.router.go("/quote")},"Ir para Proposta")
    ),
    el("div",{class:"tiny",style:"margin-top:10px"},"Dica: para incluir RTA no relatório, capture o RTA dentro do relatório da Medição (ele salva no projeto).")
  );

  const select = el("select",{class:"input"});
  select.appendChild(el("option",{value:""},"Selecione um projeto…"));
  projects.slice(0,30).forEach(p=> select.appendChild(el("option",{value:p.id}, p.name)));

  const generate = el("button",{class:"btn",onclick:()=>{
    if(!select.value) return toast("Selecione um projeto.");
    const p = getProject(select.value);
    if(!p) return toast("Projeto não encontrado.");
    ctx.mount(el("div",{}, header, chooser(), renderDoc(p, ctx.content.appInfo)));
    window.scrollTo({top:0, behavior:"smooth"});
  }},"Gerar relatório do projeto");

  const chooserCard = el("div",{class:"card"},
    el("div",{class:"h2"},"Projeto"),
    select,
    el("div",{style:"height:10px"}),
    generate
  );

  function chooser(){
    return chooserCard;
  }

  return el("div",{}, header, chooserCard, emptyState());

  function emptyState(){
    if(projects.length) return el("div",{class:"card"},
      el("div",{class:"h2"},"Como usar"),
      el("div",{class:"p"},"1) Crie um projeto em Medição • 2) Faça medições (frente/meio/fundo) • 3) Volte aqui e gere o relatório."),
      el("div",{class:"tiny"},"Você pode imprimir como PDF direto no navegador (GitHub Pages funciona).")
    );
    return el("div",{class:"card"},
      el("div",{class:"h2"},"Nenhum projeto encontrado"),
      el("div",{class:"p"},"Crie um projeto em Medição para começar.")
    );
  }
}

function renderDoc(p, appInfo){
  const vol = (p.area||0) * (p.height||0);
  const pa = recommendPA({ people: p.people||200, area: p.area||120, height: p.height||4, use: p.use||"mixed" });

  const mix = p.mix || {};
  const ch = calcChannels(mix);
  const cons = suggestConsole(ch.recommended, p.use||"mixed");
  const checklist = buildChecklist({
    use: p.use||"mixed",
    wirelessMics: mix.wireless||0,
    vocalMics: mix.vocals||0,
    diBoxes: mix.diBoxes||0,
    monitors: mix.monitors||0
  });

  const points = (()=>{
    // Accept both legacy formats: p.measurements[] or p.points{front/mid/back}
    if (Array.isArray(p.measurements)) return p.measurements.slice();
    const out = [];
    const map = { front: "Frente", mid: "Meio", back: "Fundo" };
    const pts = p.points || {};
    for (const k of ["front","mid","back"]){
      const m = pts[k];
      if (!m) continue;
      out.push({ label: map[k], rt60: m.rt60, rt30: m.rt30, r2: m.r2, ts: m.measuredAt || m.ts || null, note: "" });
    }
    return out;
  })().sort((a,b)=>(a.label||"").localeCompare(b.label||""));
  const avgRT = points.length ? (points.reduce((s,m)=>s+(m.rt60||0),0)/points.length) : null;

  const rta = p.rta || null;

  const cover = el("div",{class:"card report-page report-cover"},
    el("div",{class:"report-cover-badge"},"RELATÓRIO TÉCNICO • SONORA"),
    el("div",{class:"report-cover-title"}, p.name || "Projeto"),
    el("div",{class:"report-cover-sub"}, `${p.useLabel||"—"} • capacidade ${p.people||"—"} • área ${p.area||"—"} m² • pé direito ${p.height||"—"} m`),
    el("div",{class:"report-cover-meta"},
      chip("Build", appInfo?.buildStamp || appInfo?.build || "—"),
      chip("Gerado em", new Date().toLocaleString()),
      chip("Volume aprox.", vol ? `${fmt(vol,0)} m³` : "—")
    ),
    el("div",{class:"report-cover-note"},
      el("div",{class:"tiny"},"Observação"),
      el("div",{class:"p"},"Este relatório é uma estimativa técnica baseada em medições e heurísticas. Resultados podem variar conforme posicionamento de caixas, tratamento acústico e calibração de microfones/interfaces.")
    )
  );

  const secEnv = section("Dados do ambiente", el("div",{class:"grid report-kpis"},
    kpi("Capacidade", p.people ? `${p.people} pessoas` : "—"),
    kpi("Área", p.area ? `${p.area} m²` : "—"),
    kpi("Pé direito", p.height ? `${p.height} m` : "—"),
    kpi("Volume", vol ? `${fmt(vol,0)} m³` : "—")
  ), el("div",{class:"tiny"},"Dica: medições mais confiáveis em notebook + interface USB, com AGC desativado.") );

  const secRT = section("Reverberação (RT60)", points.length ? el("div",{},
    el("div",{class:"row"},
      chip("RT médio", avgRT ? `${fmt(avgRT,2)} s` : "—"),
      chip("Pontos", String(points.length)),
      chip("Última medição", dt(points.reduce((mx,it)=> (it?.ts && (!mx || it.ts>mx)) ? it.ts : mx, null)))
    ),
    table([
      ["Ponto","RT60 (s)","R²","Observação"],
      ...points.map(m=>[
        m.label||"—",
        m.rt60!=null ? fmt(m.rt60,2) : "—",
        m.r2!=null ? fmt(m.r2,2) : "—",
        m.note||""
      ])
    ])
  ) : el("div",{class:"p"},"Sem medições salvas. Faça medições em Medição (frente/meio/fundo).") );

  const secRTA = section("RTA Snapshot", rta?.bands?.length ? el("div",{},
    el("div",{class:"row"},
      chip("Capturado em", dt(rta.capturedAt)),
      chip("Sugestões EQ", rta.eq?.length ? `${rta.eq.length} corte(s)` : "—")
    ),
    el("div",{class:"p"},"RTA normalizado (0 dB no pico). Use como indicação de ressonâncias/realces."),
    table([
      ["Hz","dB (rel.)"],
      ...rta.bands.map(b=>[ String(b.hz), fmt(b.db,1) ])
    ]),
    rta.eq?.length ? el("div",{class:"tile"},
      el("div",{class:"h2",style:"margin:0"},"Sugestões de EQ (indicativas)"),
      el("ul",{class:"p"},
        ...rta.eq.map(s=> el("li",{}, `CORTE ${Math.abs(s.db)} dB em ~${s.hz} Hz`))
      )
    ) : el("div",{class:"tiny"},"Sem sugestões registradas.")
  ) : el("div",{class:"p"},"Sem RTA salvo neste projeto. Abra o relatório da Medição e clique em “Capturar RTA” (ele salva no projeto).") );

  const secPA = section("Planejamento de PA (estimativa)", el("div",{class:"grid report-kpis"},
    kpi("Tier", pa.tier),
    kpi("Alvo SPL", `~${pa.targets.spl} dBA`),
    kpi("Tops", `${pa.tops.perSide} / lado`),
    kpi("Subs", pa.subs.count ? `${pa.subs.count}×18"` : "—")
  ),
  el("div",{class:"tile"},
    el("div",{class:"p"}, `Tops: ${pa.tops.perSide} por lado • ${pa.tops.type} • ~${pa.tops.rmsW}W RMS cada`),
    el("div",{class:"p"}, pa.subs.count ? `Subs: ${pa.subs.count}x ${pa.subs.type} • ~${pa.subs.rmsW}W RMS` : "Subs: não necessário (fala)"),
    el("div",{class:"p"}, `Mesa: ${pa.mixer.min}–${pa.mixer.max} canais • ${pa.mixer.note}`),
    el("div",{class:"tiny"}, pa.ampNote),
    el("div",{class:"tiny",style:"margin-top:6px"}, pa.acoustic)
  ));

  const secChannels = section("Canais e mesa (estimativa)", el("div",{class:"grid report-kpis"},
    kpi("Canais", String(ch.channels)),
    kpi("Folga", `+${ch.headroom}`),
    kpi("Recomendado", String(ch.recommended)),
    kpi("Preferência", cons.prefer==="digital" ? "Digital" : "Analógica")
  ),
  el("div",{class:"tile"},
    el("div",{class:"p"}, cons.prefer==="digital" ? `Digital: ${cons.digital.why}` : `Analógica: ${cons.analog.why}`),
    el("div",{class:"tiny"}, cons.prefer==="digital" ? cons.digital.note : cons.analog.note)
  ));

  const secChecklist = section("Checklist (compra/locação)", el("div",{class:"tile"},
    el("ul",{class:"p"},
      ...checklist.map(i=> el("li",{}, `${i.qty}× ${i.name}${i.note?` — ${i.note}`:""}`))
    )
  ));

  const secConclusion = section("Conclusão técnica", el("div",{class:"tile"},
    el("div",{class:"p"},"Resumo automático (edite conforme necessário):"),
    el("div",{class:"report-textbox"},
      [
        `• O ambiente ${p.area?`(${p.area} m²)`: ""} apresenta RT médio ${avgRT?`${fmt(avgRT,2)} s`: "—"} (indicativo).`,
        `• Para o uso em ${p.useLabel||"—"}, recomenda-se priorizar inteligibilidade, com atenção a tratamento acústico se RT estiver elevado.`,
        `• O planejamento sugere PA tier ${pa.tier}, com ${pa.tops.perSide} tops por lado e ${pa.subs.count||0} subs.`,
        `• A mesa recomendada é ${cons.prefer==="digital"?"Digital":"Analógica"} com ~${ch.recommended} canais para folga e expansão.`,
        `• Checklist anexo para compra/locação e montagem.`
      ].join("\n")
    ),
    el("div",{class:"report-sign"},
      el("div",{class:"tiny"},"Responsável técnico"),
      el("div",{class:"p"},"______________________________"),
      el("div",{class:"tiny"},"Assinatura / Contato")
    )
  ));

  const controls = el("div",{class:"card report-controls"},
    el("div",{class:"h2"},"Exportar"),
    el("div",{class:"row"},
      el("button",{class:"btn",onclick:()=>window.print()},"Imprimir / Salvar PDF"),
      el("button",{class:"btn secondary",onclick:()=>{
        const payload = JSON.stringify({ project:p, computed:{ pa, channels:ch, console:cons, checklist } }, null, 2);
        const blob = new Blob([payload], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href=url;
        a.download=(p.name||"sonora-relatorio").replace(/[^a-z0-9\-_]+/gi,"_").toLowerCase()+".json";
        a.click();
        setTimeout(()=>URL.revokeObjectURL(url), 1200);
      }},"Exportar JSON (relatório)")
    ),
    el("div",{class:"tiny",style:"margin-top:10px"},"Para PDF: use “Imprimir / Salvar PDF” e selecione “Salvar como PDF”.")
  );

  return el("div",{}, cover, secEnv, secRT, secRTA, pageBreak(), secPA, secChannels, secChecklist, secConclusion, controls);
}

function section(title, ...children){
  return el("div",{class:"card report-page"},
    el("div",{class:"report-section-title"}, title),
    ...children
  );
}

function chip(k,v){
  return el("div",{class:"chip"}, el("div",{class:"k"},k), el("div",{class:"v"},v));
}
function kpi(k,v){
  return el("div",{class:"kpi"}, el("div",{class:"k"},k), el("div",{class:"v"},v));
}
function table(rows){
  const head = rows[0];
  const body = rows.slice(1);
  const thead = el("thead",{}, el("tr",{}, ...head.map(h=> el("th",{}, h))));
  const tbody = el("tbody",{}, ...body.map(r=> el("tr",{}, ...r.map(c=> el("td",{}, c)))));
  return el("div",{class:"table-wrap"}, el("table",{class:"table"}, thead, tbody));
}
function pageBreak(){
  return el("div",{class:"report-pagebreak"});
}


function rtBandsCard(project){
  const bands = project?.rtBands || project?.ir?.bands || null;
  if(!bands || !bands.length) return null;
  const conf = project.irConfidence || null;

  const card = el("div",{class:"card"},
    el("div",{class:"h2"},"RT por bandas (IR)"),
    el("div",{class:"tiny"},"Estimativa por impulso (palma/estouro). Indicativo para planejamento.")
  );

  if(conf){
    card.appendChild(el("div",{class:"kpi-grid"},
      el("div",{class:"kpi"}, el("div",{class:"k"},"Confiança IR"), el("div",{class:"v"}, conf.overall+"%"), el("div",{class:"t"}, conf.level))
    ));
  }

  const table = document.createElement("table");
  table.className="table";
  const head=document.createElement("tr");
  head.innerHTML="<th>Freq</th><th>RT (s)</th><th>Qualidade</th>";
  table.appendChild(head);
  bands.forEach(b=>{
    const rt = (typeof b.rt==="number") ? b.rt.toFixed(2) : "—";
    const q = (b.r2==null) ? "—" : (b.r2>0.85?"Alta":b.r2>0.65?"Média":"Baixa");
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${b.hz} Hz</td><td>${rt}</td><td>${q}</td>`;
    table.appendChild(tr);
  });
  card.appendChild(table);
  return card;
}
