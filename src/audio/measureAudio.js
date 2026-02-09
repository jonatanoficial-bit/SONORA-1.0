
/**
 * SONORA Phase 2: Real microphone measurement (broadband RT estimate) using Web Audio API.
 * Requires HTTPS (GitHub Pages ok).
 * Results are indicative and depend on noise + mic/interface.
 */
function db(x){ return 20*Math.log10(Math.max(1e-12,x)); }
function hann(n,N){ return 0.5*(1-Math.cos((2*Math.PI*n)/(N-1))); }

function makeSweepBuffer(ctx,{duration=3.5,f1=80,f2=16000,fade=0.03}={}){
  const sr=ctx.sampleRate, N=Math.floor(duration*sr);
  const buf=ctx.createBuffer(1,N,sr);
  const x=buf.getChannelData(0);
  const T=duration, R=Math.log(f2/f1), K=(2*Math.PI*f1*T)/R;
  const fadeN=Math.max(16,Math.floor(fade*sr));
  for(let i=0;i<N;i++){
    const t=i/sr;
    const phase=K*(Math.exp((t/T)*R)-1);
    let s=Math.sin(phase);
    let g=1;
    if(i<fadeN) g*=hann(i,fadeN);
    if(i>N-fadeN) g*=hann(N-i-1,fadeN);
    x[i]=s*g*0.75;
  }
  return buf;
}

async function getMicStream(){
  return navigator.mediaDevices.getUserMedia({
    audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1 }
  });
}

export async function runMeasurement({duration=3.5,preRoll=0.35,postRoll=2.8,f1=80,f2=16000,onProgress=()=>{}}={}){
  if(!navigator.mediaDevices?.getUserMedia) throw new Error("Navegador sem getUserMedia");
  const stream=await getMicStream();
  const ctx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:"interactive"});
  const mic=ctx.createMediaStreamSource(stream);

  // record via ScriptProcessor (broad compatibility)
  const recorder=ctx.createScriptProcessor(4096,1,1);
  const chunks=[]; let frames=0;
  recorder.onaudioprocess=(e)=>{
    const input=e.inputBuffer.getChannelData(0);
    const c=new Float32Array(input.length); c.set(input);
    chunks.push(c); frames+=c.length;
  };

  // keep processor alive but silent
  const zero=ctx.createGain(); zero.gain.value=0;
  mic.connect(recorder); recorder.connect(zero); zero.connect(ctx.destination);

  // play sweep
  const sweepBuf=makeSweepBuffer(ctx,{duration,f1,f2});
  const src=ctx.createBufferSource(); src.buffer=sweepBuf;
  const out=ctx.createGain(); out.gain.value=0.65;
  src.connect(out); out.connect(ctx.destination);

  const total=preRoll+duration+postRoll;
  const startAt=ctx.currentTime+preRoll;
  const t0=performance.now();
  const tick=setInterval(()=>{
    const elapsed=(performance.now()-t0)/1000;
    onProgress(Math.min(1,elapsed/total));
  },80);

  src.start(startAt); src.stop(startAt+duration);
  await new Promise(r=>setTimeout(r,total*1000+120));
  clearInterval(tick);

  recorder.disconnect(); mic.disconnect();
  stream.getTracks().forEach(t=>t.stop());

  const y=new Float32Array(frames);
  let off=0; for(const c of chunks){ y.set(c,off); off+=c.length; }
  const sr=ctx.sampleRate;
  try{ await ctx.close(); }catch{}
  return {samples:y,sampleRate:sr,meta:{duration,preRoll,postRoll,f1,f2}};
}

export function estimateRT({samples,sampleRate}){
  // moving RMS window ~20ms
  const win=Math.max(64,Math.floor(sampleRate*0.02));
  const N=samples.length;
  const env=new Float32Array(N);
  let acc=0;
  for(let i=0;i<N;i++){
    const v=samples[i], e=v*v;
    acc+=e;
    if(i>=win){ const vw=samples[i-win]; acc-=vw*vw; }
    env[i]=Math.sqrt(acc/Math.min(win,i+1));
  }

  // peak after 200ms
  const ignore=Math.floor(sampleRate*0.2);
  let peakI=ignore, peakV=0;
  for(let i=ignore;i<N;i++){ if(env[i]>peakV){ peakV=env[i]; peakI=i; } }
  if(peakV<1e-6) return {ok:false,reason:"Sinal muito baixo. Aumente volume do sweep e reduza ruído."};

  const tail=env.subarray(peakI);
  const E=new Float32Array(tail.length);
  for(let i=0;i<tail.length;i++) E[i]=tail[i]*tail[i];

  // Schroeder integral
  const sch=new Float32Array(E.length);
  let sum=0;
  for(let i=E.length-1;i>=0;i--){ sum+=E[i]; sch[i]=sum; }

  const schDb=new Float32Array(sch.length);
  const ref=sch[0]||1e-12;
  for(let i=0;i<sch.length;i++) schDb[i]=db(Math.sqrt(sch[i]/ref));

  // indices -5 to -35 dB
  const hi=-5, lo=-35;
  let iHi=-1,iLo=-1;
  for(let i=0;i<schDb.length;i++){
    const v=schDb[i];
    if(iHi<0 && v<=hi) iHi=i;
    if(iLo<0 && v<=lo){ iLo=i; break; }
  }
  if(iHi<0||iLo<0||iLo-iHi<10) return {ok:false,reason:"Decaimento insuficiente. Tente mais silêncio e/ou aumente post-roll."};

  // linear regression
  const x0=iHi,x1=iLo,n=x1-x0+1;
  let sx=0,sy=0,sxx=0,sxy=0;
  for(let i=x0;i<=x1;i++){
    const t=i/sampleRate, y=schDb[i];
    sx+=t; sy+=y; sxx+=t*t; sxy+=t*y;
  }
  const denom=(n*sxx-sx*sx)||1e-9;
  const m=(n*sxy-sx*sy)/denom; // dB/s
  const b=(sy-m*sx)/n;

  // R^2
  let ssTot=0,ssRes=0; const yMean=sy/n;
  for(let i=x0;i<=x1;i++){
    const t=i/sampleRate, y=schDb[i], yHat=m*t+b;
    ssTot+=(y-yMean)*(y-yMean); ssRes+=(y-yHat)*(y-yHat);
  }
  const r2=ssTot>0 ? 1-(ssRes/ssTot) : 0;

  const rt60=60/Math.max(1e-6,Math.abs(m));
  const rt30=30/Math.max(1e-6,Math.abs(m));

  return { ok:true, rt60, rt30, fitR2:r2, decayDb:schDb, sampleRate };
}
