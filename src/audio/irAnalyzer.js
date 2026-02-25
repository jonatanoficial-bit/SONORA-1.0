
/**
 * SONORA Phase 13 — IR + RT by bands (lightweight, real DSP)
 * Capture: short recording with a clap/balloon pop (impulse).
 * Steps:
 *  1) Find peak (impulse)
 *  2) Window after peak
 *  3) Band-pass filter per center band
 *  4) Schroeder integration (EDC) and linear regression for T20
 *
 * NOTE: Indicative. Not a full REW replacement.
 */

function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }

export const OCTAVE_BANDS = [125, 250, 500, 1000, 2000, 4000];

export function findImpulsePeak(samples){
  let max = 0;
  let idx = 0;
  for(let i=0;i<samples.length;i++){
    const v = Math.abs(samples[i]);
    if(v > max){ max = v; idx = i; }
  }
  return { idx, peak: max };
}

export function sliceAroundImpulse(samples, sr, peakIdx, preMs=30, postMs=2500){
  const pre = Math.floor(sr * preMs / 1000);
  const post = Math.floor(sr * postMs / 1000);
  const start = Math.max(0, peakIdx - pre);
  const end = Math.min(samples.length, peakIdx + post);
  const out = samples.slice(start, end);
  return { start, end, out };
}

function biquadBandpassCoeffs(fc, q, sr){
  // RBJ: bandpass (constant skirt gain, peak gain = Q)
  const w0 = 2*Math.PI*fc/sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin/(2*q);

  let b0 =   q*alpha;
  let b1 =   0;
  let b2 =  -q*alpha;
  let a0 =   1 + alpha;
  let a1 =  -2*cos;
  let a2 =   1 - alpha;

  b0/=a0; b1/=a0; b2/=a0; a1/=a0; a2/=a0;
  return { b0,b1,b2,a1,a2 };
}

function filterBiquad(samples, c){
  const out = new Float32Array(samples.length);
  let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<samples.length;i++){
    const x = samples[i];
    const y = c.b0*x + c.b1*x1 + c.b2*x2 - c.a1*y1 - c.a2*y2;
    out[i]=y;
    x2=x1; x1=x; y2=y1; y1=y;
  }
  return out;
}

export function schroederRT(samples, sr, t1=-5, t2=-25){
  // Energy decay curve and RT estimate using linear regression between t1..t2 dB
  const n = samples.length;
  const e = new Float64Array(n);
  for(let i=0;i<n;i++){ const v=samples[i]; e[i]=v*v; }

  const edc = new Float64Array(n);
  let acc=0;
  for(let i=n-1;i>=0;i--){ acc += e[i]; edc[i]=acc; }
  const edc0 = edc[0] || 1e-12;

  const db = new Float64Array(n);
  for(let i=0;i<n;i++){ db[i]=10*Math.log10((edc[i]/edc0)+1e-12); }

  let i1=-1, i2=-1;
  for(let i=0;i<n;i++){
    if(i1<0 && db[i] <= t1) i1=i;
    if(i2<0 && db[i] <= t2) { i2=i; break; }
  }
  if(i1<0 || i2<0 || i2-i1 < 10) return { rt:null, slope:null, r2:null };

  // linear regression: y = a + b*t
  let sumT=0,sumY=0,sumTT=0,sumTY=0, m=0;
  for(let i=i1;i<=i2;i++){
    const t = i/sr;
    const y = db[i];
    sumT += t; sumY += y; sumTT += t*t; sumTY += t*y; m++;
  }
  const den = (m*sumTT - sumT*sumT) || 1e-12;
  const b = (m*sumTY - sumT*sumY) / den;
  const a = (sumY - b*sumT) / m;

  // r2
  let ssTot=0, ssRes=0;
  const meanY = sumY/m;
  for(let i=i1;i<=i2;i++){
    const t=i/sr;
    const y=db[i];
    const yhat=a+b*t;
    ssTot += (y-meanY)*(y-meanY);
    ssRes += (y-yhat)*(y-yhat);
  }
  const r2 = ssTot>1e-9 ? 1 - (ssRes/ssTot) : 0;

  // RT60 extrapolated from regression: slope b (dB/s). We use T20 range (t1..t2 = 20 dB) => RT60 = -60/b
  const rt = (-60 / b);
  return { rt: clamp(rt, 0.2, 6.0), slope:b, r2: clamp(r2, 0, 1) };
}

export function estimateRTBandsFromIR(irSamples, sr){
  const bands = OCTAVE_BANDS;
  const results = [];
  for(const hz of bands){
    const q = 1.4; // octave-ish bandwidth
    const coeffs = biquadBandpassCoeffs(hz, q, sr);
    const filtered = filterBiquad(irSamples, coeffs);
    const est = schroederRT(filtered, sr, -5, -25);
    results.push({ hz, rt: est.rt, r2: est.r2 });
  }
  return results;
}

export function computeIRConfidence({peak=0, r2Mean=0, clip=false}={}){
  // peak: 0..1
  let score = 0;
  score += clamp((peak - 0.15)/0.6, 0, 1) * 45;   // strong impulse helps
  score += clamp(r2Mean, 0, 1) * 45;              // fit quality
  score += clip ? -20 : 10;                       // clipping hurts
  const overall = Math.round(clamp(score, 0, 100));
  return { overall, level: overall>75?"Alta":overall>45?"Média":"Baixa" };
}
