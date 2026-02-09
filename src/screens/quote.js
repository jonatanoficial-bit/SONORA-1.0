import { el } from "../ui/dom.js";
import { toast } from "../ui/toast.js";
import { loadProjects, getProject } from "../projects.js";
import { recommendPA } from "../planner.js";
import { buildChecklist, calcChannels, suggestConsole } from "../gearPlanner.js";

/**
 * Phase 5: Proposal / Budget generator (indicative).
 * Stores price catalog in localStorage and can export JSON or print to PDF.
 */

const PRICE_KEY = "sonora.prices.v1";
const QUOTE_KEY = "sonora.quotes.v1";

function money(n){
  const v = isFinite(n) ? n : 0;
  return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
function nnum(v, d=0){
  const x = Number(v);
  if(!isFinite(x)) return 0;
  const p = Math.pow(10,d);
  return Math.round(x*p)/p;
}
function slug(s){ return (s||"sonora").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }

function defaultCatalog(){
  return {
    version: "1.0.0",
    updatedAt: Date.now(),
    currency: "BRL",
    items: {
      top_active: { name: "Caixa TOP ativa (12/15\")", unit: "un", price: 3500 },
      sub_active: { name: "Sub ativo (18\")", unit: "un", price: 5500 },
      mixer_digital: { name: "Mesa digital", unit: "un", price: 8500 },
      mixer_analog: { name: "Mesa analógica", unit: "un", price: 1800 },
      monitor_wedge: { name: "Monitor de palco (wedge)", unit: "un", price: 1800 },
      iem_kit: { name: "Kit In-Ear (1 mix)", unit: "un", price: 2200 },
      mic_vocal: { name: "Microfone vocal dinâmico", unit: "un", price: 450 },
      mic_pastor: { name: "Microfone pastor (lapela/headset)", unit: "un", price: 1200 },
      wireless: { name: "Sistema sem fio (1 canal)", unit: "un", price: 1800 },
      di: { name: "DI Box", unit: "un", price: 250 },
      stand: { name: "Pedestal microfone", unit: "un", price: 160 },
      xlr: { name: "Cabo XLR 10m", unit: "un", price: 90 },
      p10: { name: "Cabo P10/TRS", unit: "un", price: 60 },
      power: { name: "Extensão/régua energia", unit: "un", price: 80 },
      gaffer: { name: "Fita gaffer (rolo)", unit: "un", price: 65 },
      dsp_proc: { name: "Processador/DSP (se necessário)", unit: "un", price: 1200 },
      service_setup: { name: "Serviço: medição + ajuste + treinamento", unit: "serv", price: 1200 }
    }
  };
}
function loadCatalog(){
  try{
    const j = JSON.parse(localStorage.getItem(PRICE_KEY) || "null");
    if(j?.items) return j;
  }catch{}
  const d = defaultCatalog();
  localStorage.setItem(PRICE_KEY, JSON.stringify(d));
  return d;
}
function saveCatalog(cat){
  cat.updatedAt = Date.now();
  localStorage.setItem(PRICE_KEY, JSON.stringify(cat));
}
function loadQuotes(){
  try{ return JSON.parse(localStorage.getItem(QUOTE_KEY) || "[]"); }catch{ return []; }
}
function saveQuotes(list){ localStorage.setItem(QUOTE_KEY, JSON.stringify(list)); }

function buildAutoLines(project, catalog){
  const use = project.use || "mixed";
  const people = project.people || 200;
  const area = project.area || 120;
  const height = project.height || 4;

  const pa = recommendPA({ people, area, height, use });
  const mix = project.mix || {};
  const ch = project.plan?.channels || calcChannels(mix);
  const cons = project.plan?.console || suggestConsole(ch.recommended, use);

  const checklist = buildChecklist({
    use,
    wirelessMics: mix.wireless || 0,
    vocalMics: mix.vocals || 0,
    diBoxes: mix.diBoxes || 0,
    monitors: mix.monitors || 0
  });

  const lines = [];
  const add = (key, qty, overrideName=null)=>{
    const item = catalog.items[key];
    if(!item) return;
    if(!qty || qty<=0) return;
    lines.push({
      key,
      name: overrideName || item.name,
      unit: item.unit,
      qty,
      unitPrice: item.price,
      note: ""
    });
  };

  // PA (assumindo ativo)
  add("top_active", pa.tops.perSide*2);
  if(pa.subs.count) add("sub_active", pa.subs.count);

  // mixer type from plan
  add(cons.prefer==="digital" ? "mixer_digital" : "mixer_analog", 1);

  // monitors
  if(use!=="speech"){
    add("monitor_wedge", mix.monitors || pa.monitors.wedges || 2);
    if((mix.inear||0)>0) add("iem_kit", mix.inear);
  }

  // mics + wireless
  add("mic_vocal", mix.vocals || (use==="speech"?2:4));
  add("mic_pastor", 1);
  if((mix.wireless||0)>0) add("wireless", mix.wireless);

  // DI
  if(use!=="speech") add("di", mix.diBoxes || 2);

  // stands & cables (rough)
  add("stand", Math.max(2, mix.vocals || 4));
  add("xlr", Math.max(8, (mix.vocals||4)*2));
  add("p10", 6);
  add("power", 4);
  add("gaffer", 2);

  // service
  add("service_setup", 1);

  return { pa, ch, cons, checklist, lines };
}

function computeTotals(lines){
  let sub=0;
  for(const l of lines){
    const qty = nnum(l.qty, 2);
    const up = nnum(l.unitPrice, 2);
    sub += qty*up;
  }
  return { subtotal: sub };
}

export function renderQuote(ctx){
  const projects = loadProjects();
  const catalog = loadCatalog();
  const quotes = loadQuotes();

  const header = el("div",{class:"card"},
    el("div",{class:"h1"},"Proposta / Orçamento"),
    el("div",{class:"p"},"Fase 5: gere uma proposta profissional a partir do projeto (PA + canais + checklist)."),
    el("div",{class:"tiny",style:"margin-top:8px"},"Você pode editar preços aqui (salva no navegador) e imprimir em PDF.")
  );

  const pick = el("select",{class:"input"});
  pick.appendChild(el("option",{value:""},"Selecionar projeto…"));
  projects.slice(0,30).forEach(p=> pick.appendChild(el("option",{value:p.id}, p.name)));
  const btnOpen = el("button",{class:"btn",onclick:()=>{ if(!pick.value) return toast("Selecione um projeto"); openProject(pick.value); }},"Abrir projeto");

  const btnPrices = el("button",{class:"btn secondary",onclick:()=>openPrices()},"Editar tabela de preços");
  const btnHistory = el("button",{class:"btn ghost",onclick:()=>openHistory()},"Histórico (local)");

  const chooser = el("div",{class:"card"},
    el("div",{class:"h2"},"Projeto"),
    pick,
    el("div",{style:"height:10px"}),
    el("div",{class:"row"}, btnOpen, btnPrices),
    el("div",{style:"height:10px"}),
    btnHistory
  );

  return el("div",{}, header, chooser);

  function openPrices(){
    const cat = loadCatalog();

    const list = el("div",{});
    Object.entries(cat.items).forEach(([key,it])=>{
      const price = el("input",{class:"input",type:"number",step:"1",value:String(it.price||0)});
      const row = el("div",{class:"tile"},
        el("div",{class:"tile-top"},
          el("div",{}, el("div",{class:"h2",style:"margin:0"}, it.name), el("div",{class:"tiny"}, `${key} • ${it.unit}`)),
          el("div",{style:"min-width:160px"}, price)
        )
      );
      price.addEventListener("change", ()=>{
        it.price = nnum(price.value, 2);
        saveCatalog(cat);
      });
      list.appendChild(row);
    });

    const back = el("button",{class:"btn ghost",onclick:()=>ctx.router.go("/quote")},"Voltar");
    ctx.mount(el("div",{},
      el("div",{class:"card"},
        el("div",{class:"h1"},"Tabela de preços (local)"),
        el("div",{class:"p"},"Edite os valores unitários. Isso afeta os cálculos de propostas neste navegador."),
        el("div",{class:"tiny"},"Dica: depois você pode exportar a proposta em JSON para usar em outro PC.")
      ),
      el("div",{class:"card"}, list),
      el("div",{class:"card"}, back)
    ));
  }

  function openHistory(){
    const list = loadQuotes().slice().reverse();
    const items = list.length ? list.map(q=>{
      const btn = el("button",{class:"btn small",onclick:()=>openQuote(q)},"Abrir");
      return el("div",{class:"tile"},
        el("div",{class:"tile-top"},
          el("div",{},
            el("div",{class:"h2",style:"margin:0"}, q.title || "Proposta"),
            el("div",{class:"tiny"}, new Date(q.createdAt).toLocaleString("pt-BR"))
          ),
          btn
        ),
        el("div",{class:"p"}, q.summary || "—")
      );
    }) : [el("div",{class:"p"},"Nenhuma proposta salva ainda.")];

    const back = el("button",{class:"btn ghost",onclick:()=>ctx.router.go("/quote")},"Voltar");
    ctx.mount(el("div",{},
      el("div",{class:"card"},
        el("div",{class:"h1"},"Histórico (local)"),
        el("div",{class:"p"},"Propostas salvas neste navegador.")
      ),
      el("div",{class:"card"}, ...items),
      el("div",{class:"card"}, back)
    ));
  }

  function openProject(id){
    const p = getProject(id);
    if(!p) return toast("Projeto não encontrado");

    const tier = el("select",{class:"input"},
      el("option",{value:"econ"},"Econômico"),
      el("option",{value:"mid",selected:true},"Intermediário"),
      el("option",{value:"prem"},"Premium")
    );
    const markup = el("input",{class:"input",type:"number",step:"1",value:"15"});
    const discount = el("input",{class:"input",type:"number",step:"1",value:"0"});
    const client = el("input",{class:"input",placeholder:"Cliente (nome da igreja/empresa)",value:p.name||""});
    const city = el("input",{class:"input",placeholder:"Cidade/UF (opcional)",value:""});
    const validity = el("input",{class:"input",placeholder:"Validade (ex.: 7 dias)",value:"7 dias"});
    const notes = el("input",{class:"input",placeholder:"Observações (opcional)",value:"Valores indicativos. Instalação/locação podem variar por região."});

    const out = el("div",{class:"tile"}, el("div",{class:"p"},"Clique em “Gerar proposta” para montar os itens automaticamente."));

    const btnGen = el("button",{class:"btn",onclick:()=>generate()},"Gerar proposta");
    const back = el("button",{class:"btn ghost",onclick:()=>ctx.router.go("/quote")},"Voltar");

    ctx.mount(el("div",{},
      el("div",{class:"card"},
        el("div",{class:"h1"}, `Nova proposta — ${p.name}`),
        el("div",{class:"p"}, `${p.useLabel} • capacidade ${p.people||"—"} • área ${p.area}m² • pé direito ${p.height}m`)
      ),
      el("div",{class:"card"},
        el("div",{class:"h2"},"Configuração"),
        el("div",{class:"grid"},
          el("div",{class:"tile"}, el("div",{class:"badge"},"Tier"), tier),
          el("div",{class:"tile"}, el("div",{class:"badge"},"Markup (%)"), markup),
          el("div",{class:"tile"}, el("div",{class:"badge"},"Desconto (%)"), discount),
          el("div",{class:"tile"}, el("div",{class:"badge"},"Validade"), validity)
        ),
        el("div",{style:"height:10px"}),
        client,
        el("div",{style:"height:10px"}),
        city,
        el("div",{style:"height:10px"}),
        notes,
        el("div",{style:"height:12px"}),
        el("div",{class:"row"}, btnGen, back)
      ),
      el("div",{class:"card"}, out)
    ));

    function tierMultiplier(v){
      if(v==="econ") return 0.85;
      if(v==="prem") return 1.25;
      return 1.0;
    }

    function generate(){
      const cat = loadCatalog();
      const auto = buildAutoLines(p, cat);
      const mult = tierMultiplier(tier.value);

      const lines = auto.lines.map(l=>({ ...l, unitPrice: nnum(l.unitPrice*mult,2) }));

      // editable table
      const table = el("div",{});
      const headers = el("div",{class:"row"},
        el("div",{class:"tiny",style:"flex:2"},"Item"),
        el("div",{class:"tiny",style:"width:90px;text-align:right"},"Qtd"),
        el("div",{class:"tiny",style:"width:140px;text-align:right"},"Unit"),
        el("div",{class:"tiny",style:"width:140px;text-align:right"},"Total")
      );
      table.appendChild(headers);
      table.appendChild(el("div",{class:"sep"}));

      const rowNodes = [];
      lines.forEach((l, idx)=>{
        const q = el("input",{class:"input",type:"number",step:"1",value:String(l.qty),style:"text-align:right"});
        const u = el("input",{class:"input",type:"number",step:"1",value:String(l.unitPrice),style:"text-align:right"});
        const name = el("input",{class:"input",value:l.name});
        const total = el("div",{class:"p",style:"width:140px;text-align:right;white-space:nowrap"}, money(l.qty*l.unitPrice));

        const row = el("div",{class:"row",style:"align-items:flex-start;gap:10px"},
          el("div",{style:"flex:2"}, name),
          el("div",{style:"width:90px"}, q),
          el("div",{style:"width:140px"}, u),
          total
        );
        rowNodes.push({q,u,name,total});
        q.addEventListener("change", ()=>recalc());
        u.addEventListener("change", ()=>recalc());
        name.addEventListener("change", ()=>recalc());
        table.appendChild(row);
        table.appendChild(el("div",{style:"height:8px"}));
      });

      const totalsBox = el("div",{class:"tile"});
      const btnPrint = el("button",{class:"btn small",onclick:()=>window.print()},"Imprimir / Salvar PDF");
      const btnSave = el("button",{class:"btn small secondary",onclick:()=>saveQuote()},"Salvar no histórico");
      const btnExport = el("button",{class:"btn small secondary",onclick:()=>exportJSON()},"Exportar JSON");
      const btnCopy = el("button",{class:"btn small ghost",onclick:()=>copyText()},"Copiar texto");

      function getState(){
        const stateLines = lines.map((l,i)=>({
          ...l,
          name: rowNodes[i].name.value.trim() || l.name,
          qty: nnum(rowNodes[i].q.value, 2),
          unitPrice: nnum(rowNodes[i].u.value, 2),
        })).filter(x=>x.qty>0);

        const sub = computeTotals(stateLines).subtotal;
        const mk = nnum(markup.value,2)/100;
        const dc = nnum(discount.value,2)/100;
        const total = sub * (1+mk) * (1-dc);

        return {
          projectId: p.id,
          tier: tier.value,
          client: client.value.trim(),
          city: city.value.trim(),
          validity: validity.value.trim(),
          notes: notes.value.trim(),
          markupPct: nnum(markup.value,2),
          discountPct: nnum(discount.value,2),
          lines: stateLines,
          subtotal: sub,
          total
        };
      }

      function recalc(){
        const st = getState();
        // update totals per row
        st.lines.forEach((l,i)=>{
          // find matching row index by original order; safe fallback
        });
        // update displayed per-row totals
        rowNodes.forEach((r,i)=>{
          const qty = nnum(r.q.value,2);
          const up = nnum(r.u.value,2);
          r.total.textContent = money(qty*up);
        });
        totalsBox.innerHTML = "";
        totalsBox.appendChild(el("div",{class:"h2",style:"margin:0"},"Totais"));
        totalsBox.appendChild(el("div",{class:"p"}, `Subtotal: ${money(st.subtotal)}`));
        totalsBox.appendChild(el("div",{class:"p"}, `Markup: ${nnum(markup.value,0)}% • Desconto: ${nnum(discount.value,0)}%`));
        totalsBox.appendChild(el("div",{class:"kpi"}, money(st.total)));
        totalsBox.appendChild(el("div",{class:"tiny"},"* Valores indicativos. Confirme disponibilidade, impostos e frete."));
      }

      function proposalText(st){
        const lines = st.lines.map(l=>`- ${l.qty} ${l.unit} • ${l.name} — ${money(l.unitPrice)} (un)`).join("\n");
        return [
          `PROPOSTA / ORÇAMENTO — SONORA`,
          ``,
          `Cliente: ${st.client || p.name}`,
          st.city ? `Local: ${st.city}` : null,
          `Projeto: ${p.name}`,
          `Uso: ${p.useLabel} • Capacidade: ${p.people||"—"} • Área: ${p.area}m² • Pé direito: ${p.height}m`,
          ``,
          `ITENS`,
          lines,
          ``,
          `Subtotal: ${money(st.subtotal)}`,
          `Markup: ${st.markupPct}% • Desconto: ${st.discountPct}%`,
          `TOTAL: ${money(st.total)}`,
          ``,
          `Validade: ${st.validity || "7 dias"}`,
          st.notes ? `Obs.: ${st.notes}` : null
        ].filter(Boolean).join("\n");
      }

      function copyText(){
        const st = getState();
        const txt = proposalText(st);
        navigator.clipboard?.writeText(txt).then(()=>toast("Texto copiado")).catch(()=>toast("Não foi possível copiar"));
      }

      function saveQuote(){
        const st = getState();
        const q = {
          id: "q_"+Math.random().toString(36).slice(2,10)+"_"+Date.now().toString(36),
          createdAt: Date.now(),
          title: `Proposta — ${st.client || p.name}`,
          summary: `${p.useLabel} • ${money(st.total)}`,
          data: st
        };
        const list = loadQuotes();
        list.push(q);
        saveQuotes(list);
        toast("Salvo no histórico");
      }

      function exportJSON(){
        const st = getState();
        const payload = JSON.stringify({ project: p, proposal: st }, null, 2);
        const blob = new Blob([payload], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href=url;
        a.download = `${slug(st.client||p.name)}-proposta-sonora.json`;
        a.click();
        setTimeout(()=>URL.revokeObjectURL(url), 1200);
      }

      // mount output UI (print-friendly)
      out.innerHTML = "";
      out.appendChild(el("div",{class:"h2",style:"margin:0"},"Itens (editáveis)"));
      out.appendChild(el("div",{class:"p"},"Ajuste quantidades e preços. Depois imprima em PDF."));
      out.appendChild(el("div",{style:"height:10px"}));
      out.appendChild(table);
      out.appendChild(el("div",{style:"height:10px"}));
      out.appendChild(totalsBox);
      out.appendChild(el("div",{style:"height:10px"}));
      out.appendChild(el("div",{class:"row"}, btnPrint, btnSave, btnExport, btnCopy));
      recalc();
    }
  }

  function openQuote(q){
    const st = q.data;
    const p = getProject(st.projectId);
    const lines = st.lines || [];

    const table = el("div",{});
    lines.forEach(l=>{
      table.appendChild(el("div",{class:"tile"},
        el("div",{class:"p"}, `${l.qty} ${l.unit} • ${l.name}`),
        el("div",{class:"tiny"}, `${money(l.unitPrice)} un • Total ${money(l.qty*l.unitPrice)}`)
      ));
    });

    const back = el("button",{class:"btn ghost",onclick:()=>openHistory()},"Voltar");
    ctx.mount(el("div",{},
      el("div",{class:"card"},
        el("div",{class:"h1"}, q.title || "Proposta"),
        el("div",{class:"p"}, p ? `Projeto: ${p.name}` : "Projeto não encontrado"),
        el("div",{class:"p"}, `Subtotal: ${money(st.subtotal)} • Total: ${money(st.total)}`),
        el("div",{class:"tiny"}, new Date(q.createdAt).toLocaleString("pt-BR"))
      ),
      el("div",{class:"card"}, table),
      el("div",{class:"card"},
        el("button",{class:"btn small",onclick:()=>window.print()},"Imprimir / Salvar PDF"),
        el("div",{style:"height:10px"}),
        back
      )
    ));
  }
}
