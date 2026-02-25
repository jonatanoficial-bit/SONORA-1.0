
function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }

export function estimateRTBands(rtFull){
  if(!rtFull) return null;
  const bands = [
    { hz:125, factor:1.15 },
    { hz:250, factor:1.10 },
    { hz:500, factor:1.00 },
    { hz:1000, factor:0.95 },
    { hz:2000, factor:0.90 },
    { hz:4000, factor:0.85 }
  ];
  return bands.map(b => ({
    hz: b.hz,
    rt: clamp(rtFull * b.factor, 0.2, 4.5)
  }));
}

export function computeConfidence({signalDb=-40, noiseDb=-55, duration=2.0, rt=1.2}={}){
  const snr = signalDb - noiseDb;
  let score = 0;
  score += clamp((snr-10)/30, 0, 1) * 40;
  score += clamp(duration/3.0, 0, 1) * 20;
  score += clamp(1 - Math.abs(rt-1.2)/2.5, 0, 1) * 40;
  const overall = Math.round(score);
  return {
    snr,
    overall,
    level: overall>75?"Alta":overall>45?"Média":"Baixa"
  };
}
