
function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }
export function estimateTargets({ use="mixed" }={}){
  if(use==="speech") return { spl: 92, crest: 10 };
  if(use==="band") return { spl: 100, crest: 12 };
  return { spl: 96, crest: 12 };
}
export function estimateCoverage({ area=120, length=null, width=null }={}){
  const a=area||0;
  const w=width || (a>0 ? Math.sqrt(a) : 12);
  const l=length || (a>0 ? a / w : 10);
  const dist=clamp(0.6*l, 6, 28);
  return { width:w, length:l, mixDistance: dist };
}
export function recommendPA({ people=200, area=120, height=4, use="mixed" }={}){
  const targets=estimateTargets({use});
  const coverage=estimateCoverage({area});
  const tier = people<=120 ? "S" : people<=220 ? "M" : people<=300 ? "L" : "XL";
  const tops =
    tier==="S" ? { perSide: 1, type: '12" 2-vias', rmsW: 500 } :
    tier==="M" ? { perSide: 1, type: '12"/15" 2-vias', rmsW: 700 } :
    tier==="L" ? { perSide: 1, type: '15" alto SPL ou compacto line-array', rmsW: 900 } :
                 { perSide: 2, type: "line-array compacto", rmsW: 900 };
  const subs =
    use==="speech" ? { count: 0, type:"—", rmsW:0 } :
    tier==="S" ? { count: 1, type:'18"', rmsW: 800 } :
    tier==="M" ? { count: 2, type:'18"', rmsW: 900 } :
    tier==="L" ? { count: 2, type:'18" alto SPL', rmsW: 1200 } :
                 { count: 4, type:'18"', rmsW: 1200 };
  const mixer =
    use==="speech" ? { min: 8, max: 12, note:"2–4 microfones + playback + expansão" } :
    use==="band" ? { min: 16, max: 32, note:"banda completa + vozes + retornos" } :
                   { min: 12, max: 24, note:"sermão + banda ocasional" };
  const monitors =
    use==="speech" ? { wedges: 0, inear: 0, note:"retorno opcional (púlpito)" } :
    use==="band" ? { wedges: 2, inear: 1, note:"2 wedges ou 1–2 kits in-ear" } :
                   { wedges: 1, inear: 1, note:"1 wedge + possibilidade in-ear" };
  const ampNote = "Preferível sistema ativo (DSP interno) para praticidade e proteção.";
  const acoustic = "Se RT estiver alto, priorize tratamento antes de aumentar potência: melhora inteligibilidade e reduz feedback.";
  return { tier, targets, coverage, tops, subs, mixer, monitors, ampNote, acoustic };
}
