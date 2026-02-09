
import { el } from "../ui/dom.js";
import { toast } from "../ui/toast.js";
import { runMeasurement, estimateRT } from "../audio/measureAudio.js";
import { runRTASnapshot, suggestEQ } from "../audio/rta.js";
import { recommendPA } from "../planner.js";
import { genId, loadProjects, upsertProject, getProject } from "../projects.js";

async function loadTemplates(){
  try{
    const res = await fetch("./content/core/templates.json");
    if(!res.ok) return [];
    const j = await res.json();
    return j.templates || [];
  }catch{ return []; }
}


function fmt(n,d=2){ return (Math.round(n*Math.pow(10,d))/Math.pow(10,d)).toFixed(d); }
function targetRtFor(use, vol){
  const sizeBoost = vol>1500?0.25:vol>900?0.15:0;
  if(use==="speech") return {min:0.85+sizeBoost,max:1.25+sizeBoost};
  if(use==="band") return {min:1.10+sizeBoost,max:1.80+sizeBoost};
  return {min:0.95+sizeBoost,max:1.55+sizeBoost};
}
function recommend(rt,use,vol){
  const t=targetRtFor(use,vol);
  if(!isFinite(rt)) return {text:"Medição não confiável. Refaça em silêncio e com sweep um pouco mais alto."};
  if(rt<t.min) return {text:`RT baixo (${fmt(rt)}s). Tendência: som seco. Fala tende a ficar ótima; banda pode soar menos “cheia”.`};
  if(rt<=t.max) return {text:`RT dentro do alvo (${fmt(rt)}s). Bom equilíbrio para ${use==="speech"?"sermão":"banda/misto"}.`};
  if(rt<=t.max+0.6) return {text:`RT alto (${fmt(rt)}s). Provável embolo. Priorize absorção em médios (500–2k) e controle de reflexões.`};
  return {text:`RT muito alto (${fmt(rt)}s). Tratamento acústico é prioridade (teto/primeiras reflexões/parede traseira).`};
}
function createCanvas(){
  const c=document.createElement("canvas");
  c.width=900; c.height=360;
  c.style.width="100%"; c.style.height="220px";
  c.style.borderRadius="18px";
  c.style.border="1px solid rgba(255,255,255,.12)";
  c.style.background="rgba(0,0,0,.18)";
  return c;
}
function plotDecay(canvas, decayDb, sampleRate){
  const g=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  g.clearRect(0,0,w,h);
  g.strokeStyle="rgba(255,255,255,.15)"; g.lineWidth=2;
  g.beginPath(); g.moveTo(54,18); g.lineTo(54,h-42); g.lineTo(w-18,h-42); g.stroke();
  g.lineWidth=1;
  for(let i=0;i<=6;i++){ const y=18+((h-60)*i/6); g.beginPath(); g.moveTo(54,y); g.lineTo(w-18,y); g.stroke(); }
  const maxT=Math.min(4.0, decayDb.length/sampleRate);
  const maxIdx=Math.min(decayDb.length-1, Math.floor(maxT*sampleRate));
  const xFor=(i)=>54+((w-72)*(i/maxIdx));
  const yFor=(dbv)=>{ const v=Math.max(-60,Math.min(0,dbv)); const p=(0-v)/60; return 18+(h-60)*p; };
  g.strokeStyle="rgba(139,92,246,.95)"; g.lineWidth=2.5;
  g.beginPath();
  for(let i=0;i<=maxIdx;i++){ const x=xFor(i), y=yFor(decayDb[i]); if(i===0) g.moveTo(x,y); else g.lineTo(x,y); }
  g.stroke();
  g.fillStyle="rgba(255,255,255,.75)"; g.font="700 20px ui-sans-serif, system-ui";
  g.fillText("Decaimento (Schroeder)",54,h-12);
  g.font="600 16px ui-sans-serif, system-ui";
  g.fillText("0 dB",12,24); g.fillText("-60 dB",4,h-44); g.fillText(`${maxT.toFixed(1)}s`,w-56,h-18);
}

export function renderMeasure(ctx){
  const projects=loadProjects();
  const last=projects[0]||null;

  const root=el("div", {},
    el("div",{class:"card"},
      el("div",{class:"h1"},"Medição (RT)"),
      el("div",{class:"p"},"Fase 2: medição real via microfone (banda larga) + multipontos (frente/meio/fundo)."),
      el("div",{class:"tiny",style:"margin-top:8px"},"Dica: PC + interface. Ambiente silencioso. Permita microfone (HTTPS).")
    ),
    el("div",{class:"card"},
      el("div",{class:"h2"},"Projetos"),
      el("div",{class:"row"},
        el("button",{class:"btn",onclick:()=>openProjectForm(null)},"Novo projeto"),
        el("button",{class:"btn secondary",onclick:()=>last?openProject(last.id):toast("Nenhum projeto ainda")},"Continuar último")
      ),
      el("div",{class:"sep"}),
      ...projects.slice(0,6).map(p=>el("div",{class:"tile"},
        el("div",{class:"tile-top"},
          el("div",{},
            el("div",{class:"h2",style:"margin:0"},p.name||"Projeto"),
            el("div",{class:"tiny"},`${p.useLabel} • ${p.area}m² • pé direito ${p.height}m`)
          ),
          el("button",{class:"btn small",onclick:()=>openProject(p.id)},"Abrir")
        ),
        el("div",{class:"p"},p.notes||"—")
      ))
    )
  );

  return root;

  function openProjectForm(existing){
    const isEdit=!!existing;
    const name=el("input",{class:"input",placeholder:"Nome do projeto (ex.: Igreja X)",value:existing?.name||""});
    const area=el("input",{class:"input",type:"number",min:"10",step:"0.1",placeholder:"Área (m²)",value:existing?.area||"120"});
    const height=el("input",{class:"input",type:"number",min:"2",step:"0.1",placeholder:"Pé direito (m)",value:existing?.height||"4"});
    const use=el("select",{class:"input"},
      el("option",{value:"mixed",selected:(existing?.use||"mixed")==="mixed"},"Uso misto (sermão + banda)"),
      el("option",{value:"speech",selected:existing?.use==="speech"},"Prioridade: sermão/fala"),
      el("option",{value:"band",selected:existing?.use==="band"},"Prioridade: banda/música")
    );
    const people=el("input",{class:"input",type:"number",min:"10",step:"1",placeholder:"Capacidade (pessoas)",value:existing?.people||"200"});
    const notes=el("input",{class:"input",placeholder:"Observações (opcional)",value:existing?.notes||""});
    const saveBtn=el("button",{class:"btn",onclick:async()=>{
      const a=parseFloat(area.value||"0"), h=parseFloat(height.value||"0");
      const vol=(a>0&&h>0)?a*h:0;
      const u=use.value, useLabel=u==="speech"?"Sermão":u==="band"?"Banda":"Misto";
            const templateId = tplSelect.value || existing?.templateId || "";
      const templates = await loadTemplates();
      const chosen = templates.find(t=>t.id===templateId) || null;
      const useFinal = chosen?.use || u;
      const useLabelFinal = useFinal==="speech"?"Sermão":useFinal==="band"?"Banda":"Misto";
      const peopleFinal = chosen?.people || (parseInt(people.value||"0",10)||null);

      const p={
        id:existing?.id||genId(),
        name:name.value.trim()||"Projeto",
        area:a, height:h, volume:vol,
        use:useFinal, useLabel:useLabelFinal,
        people:peopleFinal,
        notes:notes.value.trim(),
        templateId,
        mix: existing?.mix || (chosen?.defaultMix ? {
          ...chosen.defaultMix,
          wireless: chosen.defaultMix.wireless ?? 1,
          monitors: (chosen.defaultMix.drumsFull || chosen.defaultMix.drumsBasic) ? 2 : 0,
          diBoxes: (chosen.defaultMix.keysStereo || chosen.defaultMix.bassDI || chosen.defaultMix.playback) ? 2 : 0,
          extra: chosen.defaultMix.extra ?? 2
        } : (existing?.mix || null)),
        points: existing?.points || {front:null,mid:null,back:null},
        updatedAt:Date.now()
      };
      upsertProject(p);
      toast(isEdit?"Projeto atualizado":"Projeto criado");
      openProject(p.id);
    }}, isEdit?"Salvar alterações":"Criar projeto");
    const cancelBtn=el("button",{class:"btn ghost",onclick:()=>ctx.router.go("/measure")},"Voltar");

    ctx.mount(el("div",{},
      el("div",{class:"card"},
        el("div",{class:"h1"},isEdit?"Editar projeto":"Novo projeto"),
        el("div",{class:"p"},"Cadastre dimensões e uso. Depois meça frente/meio/fundo.")
      ),
      el("div",{class:"card"},
        el("div",{class:"h2"},"Dados do ambiente"),
        name, el("div",{style:"height:10px"}),
        el("div",{class:"row"},area,height),
        el("div",{style:"height:10px"}),
        use,
        el("div",{style:"height:10px"}),
        people,
        el("div",{style:"height:10px"}),
        notes,
        el("div",{style:"height:10px"}),
        tplWrap,
        el("div",{style:"height:12px"}),
        saveBtn,
        el("div",{style:"height:10px"}),
        cancelBtn
      )
    ));
  }

  function openProject(id){
    const p=getProject(id);
    if(!p) return toast("Projeto não encontrado");
    const t=targetRtFor(p.use,p.volume);

    const pointCard=(key,label)=>{
      const m=p.points?.[key];
      const status=m?.rt60?`${fmt(m.rt60)}s`:"não medido";
      const rec=m?.rt60?recommend(m.rt60,p.use,p.volume):null;
      const btnMeasure=el("button",{class:"btn small",onclick:()=>measurePoint(p,key,label)}, m?"Refazer":"Medir");
      const btnClear=el("button",{class:"btn small ghost",onclick:()=>{p.points[key]=null;p.updatedAt=Date.now();upsertProject(p);toast("Removido");openProject(p.id);}},"Limpar");
      return el("div",{class:"tile"},
        el("div",{class:"tile-top"},
          el("div",{},
            el("div",{class:"h2",style:"margin:0"},label),
            el("div",{class:"tiny"},`RT60: ${status}`)
          ),
          el("div",{style:"display:flex;gap:8px"},btnMeasure,btnClear)
        ),
        el("div",{class:"p"},rec?rec.text:"Meça este ponto para comparar o ambiente ao longo do público.")
      );
    };

    const header=el("div",{class:"card"},
      el("div",{class:"h1"},p.name),
      el("div",{class:"p"},`${p.useLabel} • ${p.area}m² • pé direito ${p.height}m • volume ~${fmt(p.volume,0)} m³`),
      el("div",{class:"tiny",style:"margin-top:6px"},`Alvo RT (indicativo): ${fmt(t.min)}s – ${fmt(t.max)}s`)
    );

    const points=el("div",{class:"card"},
      el("div",{class:"h2"},"Pontos de medição"),
      el("div",{class:"p"},"Recomendado: 3 pontos — frente, meio e fundo. Microfone ~1,2m e sempre parado."),
      el("div",{class:"sep"}),
      el("div",{class:"grid"},
        pointCard("front","Frente (perto do palco)"),
        pointCard("mid","Meio do público"),
        pointCard("back","Fundo (última fileira)")
      )
    );

    const btnReport=el("button",{class:"btn",onclick:()=>openReport(p)},"Ver resumo / relatório");
    const btnEdit=el("button",{class:"btn secondary",onclick:()=>openProjectForm(p)},"Editar projeto");
    const btnBack=el("button",{class:"btn ghost",onclick:()=>ctx.router.go("/measure")},"Voltar");

    ctx.mount(el("div",{}, header, points, el("div",{class:"card"}, el("div",{class:"row"},btnReport,btnEdit), el("div",{style:"height:10px"}), btnBack)));
  }

  async function measurePoint(p,key,label){
    const prog=el("div",{class:"tiny"},"Preparando microfone…");
    const bar=el("div",{style:"height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:10px"},
      el("div",{id:"barIn",style:"height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg, rgba(139,92,246,.95), rgba(6,182,212,.9))"})
    );
    ctx.mount(el("div",{}, el("div",{class:"card"},
      el("div",{class:"h1"},`Medindo: ${label}`),
      el("div",{class:"p"},"O app vai tocar um sweep. Mantenha silêncio e segure o microfone parado."),
      prog, bar,
      el("div",{class:"tiny",style:"margin-top:10px"},"Se o navegador pedir permissão, permita o microfone.")
    )));

    try{
      const result=await runMeasurement({
        duration:3.5, preRoll:0.35, postRoll:2.8,
        onProgress:(v)=>{
          const w=Math.round(v*100);
          const inner=document.getElementById("barIn");
          if(inner) inner.style.width=w+"%";
          prog.textContent = w<100 ? `Medindo… ${w}%` : "Processando…";
        }
      });
      const rt=estimateRT({samples:result.samples,sampleRate:result.sampleRate});
      if(!rt.ok){ toast(rt.reason||"Falha na medição"); openProject(p.id); return; }

      p.points=p.points||{};
      p.points[key]={
        rt60:rt.rt60, rt30:rt.rt30, r2:rt.fitR2,
        measuredAt:Date.now(),
        decay:Array.from(rt.decayDb.slice(0,Math.min(rt.decayDb.length, rt.sampleRate*5)).filter((_,i)=>i%20===0))
      };
      p.updatedAt=Date.now();
      upsertProject(p);
      toast(`RT60 ~ ${fmt(rt.rt60)}s (R² ${fmt(rt.fitR2,2)})`);
      openProject(p.id);
    }catch(e){
      console.error(e);
      toast("Erro ao medir. Use HTTPS e permita microfone.");
      openProject(p.id);
    }
  }

  function openReport(p){
    const pts=p.points||{};
    const vals=["front","mid","back"].map(k=>pts[k]?.rt60).filter(v=>typeof v==="number"&&isFinite(v));
    const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:NaN;
    const t=targetRtFor(p.use,p.volume);
    const rec=recommend(avg,p.use,p.volume);

    const canvas=createCanvas();
    const pick=pts.mid?.decay||pts.front?.decay||pts.back?.decay||null;
    if(pick) plotDecay(canvas, new Float32Array(pick), 1000);

    const bullets=el("ul",{class:"p"},
      el("li",{},"Se RT está alto: absorção em médios (painéis, cortinas, teto e parede traseira)."),
      el("li",{},"EQ não reduz reverberação — muda timbre, não o tempo."),
      el("li",{},"Para fala: diretividade e posicionamento correto do PA são críticos."),
      el("li",{},"Para banda: controle de graves (HPF, subs) reduz acúmulo no ambiente.")
    );

    const card=el("div",{class:"card"},
      el("div",{class:"h1"},"Resumo / Relatório"),
      el("div",{class:"p"},`${p.name} • ${p.useLabel} • volume ~${fmt(p.volume,0)} m³`),
      el("div",{class:"sep"}),
      el("div",{class:"h2"},"RT60 (s) por ponto"),
      el("div",{class:"grid",style:"margin-top:12px"},
        el("div",{class:"tile"}, el("div",{class:"badge"},"Frente"), el("div",{class:"kpi"}, pts.front?.rt60?fmt(pts.front.rt60):"—"), el("div",{class:"tiny"}, pts.front?.r2?`R² ${fmt(pts.front.r2,2)}`:"")),
        el("div",{class:"tile"}, el("div",{class:"badge"},"Meio"), el("div",{class:"kpi"}, pts.mid?.rt60?fmt(pts.mid.rt60):"—"), el("div",{class:"tiny"}, pts.mid?.r2?`R² ${fmt(pts.mid.r2,2)}`:"")),
        el("div",{class:"tile"}, el("div",{class:"badge"},"Fundo"), el("div",{class:"kpi"}, pts.back?.rt60?fmt(pts.back.rt60):"—"), el("div",{class:"tiny"}, pts.back?.r2?`R² ${fmt(pts.back.r2,2)}`:""))
      ),
      el("div",{class:"sep"}),
      el("div",{class:"h2"},"Média (indicativa)"),
      el("div",{class:"p"}, isFinite(avg)?`RT60 médio: ${fmt(avg)}s • alvo: ${fmt(t.min)}–${fmt(t.max)}s`:"Meça pelo menos 1 ponto para ver a média."),
      el("div",{class:"p",style:"margin-top:10px"}, rec.text),
      el("div",{class:"sep"}),
      el("div",{class:"h2"},"Decaimento (visual)"),
      canvas,
      el("div",{class:"sep"}),
      
      el("div",{class:"sep"}),
      el("div",{class:"h2"},"Planejamento de PA (estimativa)"),
      (()=>{
        const pa = recommendPA({ people: p.people||200, area: p.area||120, height: p.height||4, use: p.use||"mixed" });
        return el("div",{class:"tile"},
          el("div",{class:"p"}, `Tier: ${pa.tier} • Alvo SPL: ~${pa.targets.spl} dBA`),
          el("div",{class:"p"}, `Tops: ${pa.tops.perSide} por lado • ${pa.tops.type} • ~${pa.tops.rmsW}W RMS cada`),
          el("div",{class:"p"}, pa.subs.count?`Subs: ${pa.subs.count}x ${pa.subs.type} • ~${pa.subs.rmsW}W RMS`:"Subs: não necessário (fala)"),
          el("div",{class:"p"}, `Mesa: ${pa.mixer.min}–${pa.mixer.max} canais • ${pa.mixer.note}`),
          el("div",{class:"tiny"}, pa.ampNote),
          el("div",{class:"tiny",style:"margin-top:6px"}, pa.acoustic)
        );
      })(),
      el("div",{class:"sep"}),
      el("div",{class:"h2"},"RTA Snapshot (indicativo)"),
      (()=>{
        const state = { bands:null, eq:null };
        const btn = el("button",{class:"btn small",onclick: async ()=>{
          btn.disabled = true; btn.textContent = "Capturando…";
          try{
            const res = await runRTASnapshot({ seconds: 2.2, onProgress: (v)=>{ btn.textContent = `Capturando… ${Math.round(v*100)}%`; } });
            state.bands = res.bands;
            state.eq = suggestEQ(res.bands);
            toast("RTA capturado");
            renderRta();
          }catch(e){
            console.error(e);
            toast("Erro no RTA. Permita microfone (HTTPS).");
          }finally{
            btn.disabled = false; btn.textContent = "Capturar RTA";
          }
        }},"Capturar RTA");

        const chart = document.createElement("canvas");
        chart.width = 900; chart.height = 280;
        chart.style.width = "100%"; chart.style.height = "180px";
        chart.style.borderRadius = "18px";
        chart.style.border = "1px solid rgba(255,255,255,.12)";
        chart.style.background = "rgba(0,0,0,.18)";

        const eqBox = el("div",{class:"p"},"Capture o RTA para ver sugestões simples de EQ (cortes).");

        function draw(){
          const g = chart.getContext("2d");
          const w=chart.width,h=chart.height;
          g.clearRect(0,0,w,h);
          g.strokeStyle="rgba(255,255,255,.15)"; g.lineWidth=2;
          g.beginPath(); g.moveTo(54,18); g.lineTo(54,h-38); g.lineTo(w-18,h-38); g.stroke();
          if(!state.bands) return;

          const xs = state.bands.map(b=>b.hz);
          const xMin=Math.log10(Math.min(...xs)), xMax=Math.log10(Math.max(...xs));
          const yMin=-36, yMax=0;
          const xFor=(hz)=>54 + (w-72) * ((Math.log10(hz)-xMin)/(xMax-xMin));
          const yFor=(db)=>18 + (h-56) * ((yMax-db)/(yMax-yMin));

          g.strokeStyle="rgba(6,182,212,.9)"; g.lineWidth=2.5;
          g.beginPath();
          state.bands.forEach((b,i)=>{
            const x=xFor(b.hz), y=yFor(b.db);
            if(i===0) g.moveTo(x,y); else g.lineTo(x,y);
          });
          g.stroke();

          g.fillStyle="rgba(255,255,255,.75)";
          g.font="700 18px ui-sans-serif, system-ui";
          g.fillText("RTA (normalizado)", 54, h-10);
        }

        function renderRta(){
          draw();
          if(!state.eq || !state.eq.length){
            eqBox.textContent = "Sem sugestões relevantes (ou sinal fraco).";
            return;
          }
          const lines = state.eq.map(s=>`• CORTE ${Math.abs(s.db)} dB em ~${s.hz} Hz`);
          eqBox.textContent = "Sugestões (indicativas):\n" + lines.join("\n");
          eqBox.style.whiteSpace = "pre-line";
        }
        setTimeout(draw, 0);

        return el("div",{class:"tile"},
          el("div",{class:"p"},"Captura rápida do espectro do ambiente. Útil para apontar ressonâncias/realces. (Não é calibração.)"),
          btn, chart, eqBox,
          el("div",{class:"tiny",style:"margin-top:8px"},"Dica: gere ruído rosa no PA e capture no ponto do público.")
        );
      })(),
      el("div",{class:"sep"}),
      el("div",{class:"h2"},"Exportar / Imprimir"),
      el("div",{class:"row"},
        el("button",{class:"btn small",onclick:()=>window.print()},"Imprimir / Salvar PDF"),
        el("button",{class:"btn small","data-route":"/quote"},"Gerar Proposta"),
        el("button",{class:"btn small secondary",onclick:()=>{
          const payload = JSON.stringify(p, null, 2);
          const blob = new Blob([payload], { type:"application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = (p.name||"sonora-projeto").replace(/[^a-z0-9\-_]+/gi,"_").toLowerCase() + ".json";
          a.click();
          setTimeout(()=>URL.revokeObjectURL(url), 1500);
        }},"Exportar Projeto (JSON)")
      ),
      el("div",{class:"h2"},"Recomendações rápidas"),
      bullets
    );

    const btnBack=el("button",{class:"btn secondary",onclick:()=>openProject(p.id)},"Voltar ao projeto");
    const btnList=el("button",{class:"btn ghost",onclick:()=>ctx.router.go("/measure")},"Lista de projetos");
    ctx.mount(el("div",{}, card, el("div",{class:"card"}, el("div",{class:"row"}, btnBack, btnList))));
  }
}
