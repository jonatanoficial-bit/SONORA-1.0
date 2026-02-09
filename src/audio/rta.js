
async function getMicStream(){
  return navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1 } });
}
function hann(n,N){ return 0.5*(1-Math.cos((2*Math.PI*n)/(N-1))); }
function fftRadix2(re, im){
  const n=re.length; let j=0;
  for(let i=0;i<n;i++){
    if(i<j){ [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; }
    let m=n>>1; while(m>=1 && j>=m){ j-=m; m>>=1; } j+=m;
  }
  for(let len=2; len<=n; len<<=1){
    const ang=-2*Math.PI/len, wlenRe=Math.cos(ang), wlenIm=Math.sin(ang);
    for(let i=0;i<n;i+=len){
      let wRe=1,wIm=0;
      for(let k=0;k<len/2;k++){
        const uRe=re[i+k], uIm=im[i+k];
        const vRe=re[i+k+len/2]*wRe - im[i+k+len/2]*wIm;
        const vIm=re[i+k+len/2]*wIm + im[i+k+len/2]*wRe;
        re[i+k]=uRe+vRe; im[i+k]=uIm+vIm;
        re[i+k+len/2]=uRe-vRe; im[i+k+len/2]=uIm-vIm;
        const nextRe=wRe*wlenRe - wIm*wlenIm;
        const nextIm=wRe*wlenIm + wIm*wlenRe;
        wRe=nextRe; wIm=nextIm;
      }
    }
  }
}
function magDb(x){ return 20*Math.log10(Math.max(1e-12,x)); }
const CENTERS=[31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000];
function bandForFreq(f){
  let best=0,bestD=1e9;
  for(let i=0;i<CENTERS.length;i++){
    const d=Math.abs(Math.log2(f/CENTERS[i]));
    if(d<bestD){ bestD=d; best=i; }
  }
  return CENTERS[best];
}
export async function runRTASnapshot({ seconds=2.0, fftSize=2048, onProgress=()=>{} }={}){
  if(!navigator.mediaDevices?.getUserMedia) throw new Error("Sem suporte a microfone.");
  const stream=await getMicStream();
  const ctx=new (window.AudioContext||window.webkitAudioContext)({ latencyHint:"interactive" });
  const src=ctx.createMediaStreamSource(stream);

  const proc=ctx.createScriptProcessor(4096,1,1);
  const chunks=[]; let frames=0;
  proc.onaudioprocess=(e)=>{
    const input=e.inputBuffer.getChannelData(0);
    const c=new Float32Array(input.length); c.set(input);
    chunks.push(c); frames+=c.length;
  };
  const zero=ctx.createGain(); zero.gain.value=0;
  src.connect(proc); proc.connect(zero); zero.connect(ctx.destination);

  const t0=performance.now();
  const tick=setInterval(()=>{
    const el=(performance.now()-t0)/1000;
    onProgress(Math.min(1, el/seconds));
  },80);
  await new Promise(r=>setTimeout(r, seconds*1000+80));
  clearInterval(tick);

  proc.disconnect(); src.disconnect();
  stream.getTracks().forEach(t=>t.stop());
  const sr=ctx.sampleRate;
  try{ await ctx.close(); }catch{}

  const y=new Float32Array(frames);
  let off=0; for(const c of chunks){ y.set(c,off); off+=c.length; }

  const hop=fftSize>>1;
  const win=new Float32Array(fftSize);
  for(let i=0;i<fftSize;i++) win[i]=hann(i,fftSize);

  const sum=new Map(), cnt=new Map();
  for(const hz of CENTERS){ sum.set(hz,0); cnt.set(hz,0); }

  const re=new Float32Array(fftSize), im=new Float32Array(fftSize);
  for(let start=0; start+fftSize<=y.length; start+=hop){
    for(let i=0;i<fftSize;i++){ re[i]=y[start+i]*win[i]; im[i]=0; }
    fftRadix2(re,im);
    const n2=fftSize>>1;
    for(let k=1;k<n2;k++){
      const f=(k*sr)/fftSize;
      if(f<25||f>17000) continue;
      const mag=Math.hypot(re[k],im[k]);
      const c=bandForFreq(f);
      sum.set(c, sum.get(c)+mag);
      cnt.set(c, cnt.get(c)+1);
    }
  }
  const bands=[];
  for(const c of CENTERS){
    const a=(sum.get(c)||0)/((cnt.get(c)||1));
    bands.push({ hz:c, db: magDb(a) });
  }
  const maxDb=Math.max(...bands.map(b=>b.db));
  return { bands: bands.map(b=>({ hz:b.hz, db:b.db-maxDb })), sampleRate:sr, seconds, fftSize };
}
export function suggestEQ(bands){
  const s=[];
  for(const b of bands){
    if(b.db>-6 && b.hz>=80 && b.hz<=8000){
      const cut=Math.min(6, Math.max(2, (b.db+6)));
      s.push({ hz:b.hz, type:"cut", db:-Math.round(cut) });
    }
  }
  return s.slice(0,6);
}
