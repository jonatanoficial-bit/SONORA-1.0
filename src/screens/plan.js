
import { el } from "../ui/dom.js";
import { toast } from "../ui/toast.js";
import { loadProjects, getProject, upsertProject } from "../projects.js";
import { calcChannels, suggestConsole, buildChecklist } from "../gearPlanner.js";

function fmtInt(n){ return String(Math.max(0, Math.floor(n||0))); }

export function renderPlan(ctx){
  const projects = loadProjects();
  const last = projects[0] || null;

  const header = el("div",{class:"card"},
    el("div",{class:"h1"},"Planejamento"),
    el("div",{class:"p"},"Fase 4: calculadora de canais + sugestão de mesa + checklist de compra/locação (indicativo)."),
    el("div",{class:"tiny",style:"margin-top:8px"},"Dica: abra um projeto (criado em Medição) para usar dados de capacidade/uso."),
    el("div",{class:"row",style:"margin-top:12px"},
      el("button",{class:"btn small secondary","data-route":"/measure"},"Ir para Medição"),
      el("button",{class:"btn small","data-route":"/quote"},"Ir para Proposta"),
      el("button",{class:"btn small ghost","data-route":"/admin"},"Abrir Admin")
    )
  );

  const openBtn = el("button",{class:"btn",onclick:()=> last ? openProject(last.id) : toast("Crie um projeto em Medição primeiro")},"Abrir último projeto");

  const pick = el("select",{class:"input"});
  pick.appendChild(el("option",{value:""},"Selecionar projeto…"));
  projects.slice(0,20).forEach(p=> pick.appendChild(el("option",{value:p.id}, p.name)));
  pick.addEventListener("change", ()=>{ if(pick.value) openProject(pick.value); });

  const chooser = el("div",{class:"card"},
    el("div",{class:"h2"},"Projeto"),
    pick,
    el("div",{style:"height:10px"}),
    openBtn
  );

  const standalone = el("div",{class:"card"},
    el("div",{class:"h2"},"Cálculo rápido (sem projeto)"),
    el("div",{class:"p"},"Use isso para estimar canais quando você ainda não cadastrou o ambiente."),
    quickPlanner(null)
  );

  return el("div",{}, header, chooser, standalone);

  function openProject(id){
    const p = getProject(id);
    if(!p) return toast("Projeto não encontrado");

    const top = el("div",{class:"card"},
      el("div",{class:"h1"}, `Planejamento — ${p.name}`),
      el("div",{class:"p"}, `${p.useLabel} • capacidade ${p.people||"—"} • área ${p.area}m² • pé direito ${p.height}m`)
    );

    const panel = el("div",{class:"card"},
      el("div",{class:"h2"},"Canais / Mesa / Checklist"),
      quickPlanner(p)
    );

    const back = el("button",{class:"btn ghost",onclick:()=>ctx.router.go("/plan")},"Voltar");
    ctx.mount(el("div",{}, top, panel, el("div",{class:"card"}, back)));
  }

  function quickPlanner(project){
    const use = project?.use || "mixed";

    const fields = {
      vocals: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.vocals ?? (use==="speech"?2:4)}),
      pastor: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.pastor ?? 1}),
      wireless: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.wireless ?? 1}),
      playback: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.playback ?? 1}),
      keysStereo: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.keysStereo ?? (use==="speech"?0:1)}),
      guitar: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.guitar ?? (use==="speech"?0:1)}),
      bassDI: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.bassDI ?? (use==="speech"?0:1)}),
      drumsBasic: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.drumsBasic ?? (use==="band"?0:1)}),
      drumsFull: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.drumsFull ?? (use==="band"?1:0)}),
      extra: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.extra ?? 2}),
      monitors: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.monitors ?? (use==="speech"?0:2)}),
      diBoxes: el("input",{class:"input",type:"number",min:"0",step:"1",value: project?.mix?.diBoxes ?? (use==="speech"?0:2)})
    };

    const out = el("div",{class:"tile"}, el("div",{class:"p"},"Ajuste os números e gere uma estimativa de canais e lista de compra."));

    const btn = el("button",{class:"btn small",onclick:()=>{
      const spec = {};
      Object.keys(fields).forEach(k=> spec[k] = parseInt(fields[k].value||"0",10)||0);
      const ch = calcChannels(spec);
      const cons = suggestConsole(ch.recommended, project?.use || "mixed");
      const checklist = buildChecklist({
        use: project?.use || "mixed",
        wirelessMics: spec.wireless,
        vocalMics: spec.vocals,
        diBoxes: spec.diBoxes,
        monitors: spec.monitors
      });

      if(project){
        project.mix = spec;
        project.plan = { channels: ch, console: cons, updatedAt: Date.now() };
        upsertProject(project);
      }

      renderOutput(ch, cons, checklist);
      toast("Planejamento atualizado");
    }},"Gerar planejamento");

    const grid1 = el("div",{class:"grid"},
      el("div",{class:"tile"}, el("div",{class:"badge"},"Vozes"), fields.vocals),
      el("div",{class:"tile"}, el("div",{class:"badge"},"Pastor"), fields.pastor),
      el("div",{class:"tile"}, el("div",{class:"badge"},"Sem fio"), fields.wireless),
      el("div",{class:"tile"}, el("div",{class:"badge"},"Playback"), fields.playback)
    );
    const grid2 = el("div",{class:"grid",style:"margin-top:12px"},
      el("div",{class:"tile"}, el("div",{class:"badge"},"Teclado (st)"), fields.keysStereo),
      el("div",{class:"tile"}, el("div",{class:"badge"},"Guitarras"), fields.guitar),
      el("div",{class:"tile"}, el("div",{class:"badge"},"Baixo DI"), fields.bassDI),
      el("div",{class:"tile"}, el("div",{class:"badge"},"Extras"), fields.extra)
    );
    const grid3 = el("div",{class:"grid",style:"margin-top:12px"},
      el("div",{class:"tile"}, el("div",{class:"badge"},"Bateria básica"), fields.drumsBasic),
      el("div",{class:"tile"}, el("div",{class:"badge"},"Bateria completa"), fields.drumsFull),
      el("div",{class:"tile"}, el("div",{class:"badge"},"Monitores"), fields.monitors),
      el("div",{class:"tile"}, el("div",{class:"badge"},"DI Boxes"), fields.diBoxes)
    );

    // show saved plan
    if(project?.plan?.channels){
      const checklist = buildChecklist({
        use: project.use,
        wirelessMics: project.mix?.wireless||0,
        vocalMics: project.mix?.vocals||0,
        diBoxes: project.mix?.diBoxes||0,
        monitors: project.mix?.monitors||0
      });
      renderOutput(project.plan.channels, project.plan.console, checklist);
    }

    return el("div",{}, grid1, grid2, grid3, el("div",{style:"height:12px"}), btn, el("div",{style:"height:12px"}), out);

    function renderOutput(ch, cons, checklist){
      out.innerHTML = "";
      out.appendChild(el("div",{class:"h2",style:"margin:0"},"Resultado"));
      out.appendChild(el("div",{class:"p"}, `Canais calculados: ${fmtInt(ch.channels)} • folga: +${fmtInt(ch.headroom)} • recomendado: ${fmtInt(ch.recommended)} canais`));

      const pref = cons.prefer === "digital" ? cons.digital : cons.analog;
      out.appendChild(el("div",{class:"sep"}));
      out.appendChild(el("div",{class:"h2"},"Sugestão de mesa"));
      out.appendChild(el("div",{class:"p"}, `Preferência: ${cons.prefer === "digital" ? "Digital" : "Analógica"} • Classe: ${cons.tier}`));
      out.appendChild(el("div",{class:"p"}, `${pref.type}: ${pref.why}`));
      out.appendChild(el("div",{class:"tiny"}, pref.note));

      out.appendChild(el("div",{class:"sep"}));
      out.appendChild(el("div",{class:"h2"},"Checklist (compra/locação)"));
      const ul = document.createElement("ul");
      ul.className = "p";
      checklist.forEach(i=> ul.appendChild(el("li",{}, `${i.qty}× ${i.name}${i.note?` — ${i.note}`:""}`)));
      out.appendChild(ul);

      out.appendChild(el("div",{class:"sep"}));
      out.appendChild(el("div",{class:"row"},
        el("button",{class:"btn small",onclick:()=>window.print()},"Imprimir / Salvar PDF"),
        el("button",{class:"btn small secondary",onclick:()=>{
          const payload = JSON.stringify({ channels: ch, console: cons, checklist }, null, 2);
          const blob = new Blob([payload], {type:"application/json"});
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href=url; a.download="sonora-planejamento.json"; a.click();
          setTimeout(()=>URL.revokeObjectURL(url), 1200);
        }},"Exportar Planejamento (JSON)")
      ));
    }
  }
}
