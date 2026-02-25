
import { el } from "../ui/dom.js";
import { toast } from "../ui/toast.js";
import { loadProjects, getProject, upsertProject } from "../projects.js";
import { OCTAVE_BANDS, findImpulsePeak, sliceAroundImpulse, estimateRTBandsFromIR, computeIRConfidence } from "../audio/irAnalyzer.js";

// Record short audio and extract IR from clap impulse
async function recordIR(seconds=3.5){
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = e => chunks.push(e.data);
  const stopped = new Promise((resolve)=> rec.onstop = resolve);
  rec.start();
  await new Promise(r => setTimeout(r, seconds*1000));
  rec.stop();
  await stopped;
  stream.getTracks().forEach(t=>t.stop());
  const blob = new Blob(chunks, { type: "audio/webm" });
  const arr = await blob.arrayBuffer();
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ac.decodeAudioData(arr.slice(0));
  // mono
  const ch = buf.numberOfChannels > 0 ? buf.getChannelData(0) : new Float32Array(0);
  return { samples: Array.from(ch), sr: buf.sampleRate, duration: buf.duration };
}

export function renderIR(ctx){
  const projects = loadProjects();
  const pick = el("select",{class:"input"},
    el("option",{value:""},"Selecionar projeto…"),
    ...projects.slice(0,30).map(p=>el("option",{value:p.id}, p.name))
  );

  const info = el("div",{class:"card"},
    el("div",{class:"h1"},"Medição IR (Clap)"),
    el("div",{class:"p"},"Fase 13: captura de impulso (palma/estouro de balão) para estimar RT por bandas com processamento real."),
    el("div",{class:"tiny"},"Recomendações: ambiente silencioso, microfone fixo, faça uma palma forte e seca a ~1–2m do microfone.")
  );

  const out = el("div",{class:"card"},
    el("div",{class:"h2"},"Resultado"),
    el("div",{class:"p"},"Aguardando captura…")
  );

  const btn = el("button",{class:"btn",onclick:async()=>{
    try{
      if(!pick.value) return toast("Selecione um projeto para salvar");
      out.innerHTML="";
      out.appendChild(el("div",{class:"h2"},"Resultado"));
      out.appendChild(el("div",{class:"p"},"Gravando… (faça 1 palma forte no meio)"));
      const rec = await recordIR(3.6);

      const peak = findImpulsePeak(rec.samples);
      const clip = peak.peak >= 0.98;
      const win = sliceAroundImpulse(rec.samples, rec.sr, peak.idx, 30, 2500);
      const bands = estimateRTBandsFromIR(win.out, rec.sr);

      const valid = bands.filter(b=>typeof b.rt==="number" && !Number.isNaN(b.rt));
      const r2Mean = valid.length ? (valid.reduce((a,b)=>a+(b.r2||0),0)/valid.length) : 0;
      const conf = computeIRConfidence({ peak: peak.peak, r2Mean, clip });

      const p = getProject(pick.value);
      p.ir = {
        capturedAt: Date.now(),
        sr: rec.sr,
        duration: rec.duration,
        peak: peak.peak,
        clip,
        bands
      };
      // also store rtBands for report usage
      p.rtBands = bands.map(b=>({ hz:b.hz, rt:b.rt, r2:b.r2 }));
      p.irConfidence = conf;
      upsertProject(p);

      out.innerHTML="";
      out.appendChild(el("div",{class:"h2"},"Resultado"));
      out.appendChild(el("div",{class:"kpi-grid"},
        el("div",{class:"kpi"}, el("div",{class:"k"},"Confiança IR"), el("div",{class:"v"}, conf.overall+"%"), el("div",{class:"t"}, conf.level)),
        el("div",{class:"kpi"}, el("div",{class:"k"},"Pico"), el("div",{class:"v"}, peak.peak.toFixed(2)), el("div",{class:"t"}, clip?"Possível clipping":"OK")),
        el("div",{class:"kpi"}, el("div",{class:"k"},"Bandas"), el("div",{class:"v"}, String(valid.length)), el("div",{class:"t"},"125Hz–4kHz"))
      ));

      const table = document.createElement("table");
      table.className="table";
      const head = document.createElement("tr");
      head.innerHTML = "<th>Freq</th><th>RT (s)</th><th>Qualidade</th>";
      table.appendChild(head);
      for(const b of bands){
        const rt = (typeof b.rt==="number") ? b.rt.toFixed(2) : "—";
        const q = (b.r2==null) ? "—" : (b.r2>0.85?"Alta":b.r2>0.65?"Média":"Baixa");
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${b.hz} Hz</td><td>${rt}</td><td>${q}</td>`;
        table.appendChild(tr);
      }
      out.appendChild(table);
      out.appendChild(el("div",{class:"tiny",style:"margin-top:10px"},"Salvo no projeto. Você verá isso no Relatório."));
      toast("IR capturado e salvo");
    }catch(e){
      console.error(e);
      toast("Falha ao capturar IR. Verifique permissão do microfone.");
    }
  }},"Capturar IR (3.6s)");

  const goReport = el("button",{class:"btn secondary","data-route":"/report"},"Abrir Relatório");
  const back = el("button",{class:"btn ghost","data-route":"/measure"},"Voltar");

  const pickCard = el("div",{class:"card"},
    el("div",{class:"h2"},"Projeto"),
    pick,
    el("div",{style:"height:10px"}),
    el("div",{class:"row"}, btn, goReport, back)
  );

  return el("div",{}, info, pickCard, out);
}
