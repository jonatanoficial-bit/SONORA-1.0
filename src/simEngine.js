
/**
 * SONORA — Simulator Engine (Phase 10)
 * Simplified coverage model (indicative): directional tops emitting to audience plane.
 * This is NOT a physics-accurate acoustics model. It's meant for gameplay and planning.
 */

function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }

export function defaultSim(){
  return {
    room: { w: 14, l: 18, h: 4.2 },
    stage: { x: 7, y: 2.2, w: 8, d: 3 },
    tops: [
      { id:"L", x: 4.2, y: 2.2, rot: 18, spl1m: 112 },
      { id:"R", x: 9.8, y: 2.2, rot: -18, spl1m: 112 }
    ],
    subs: [
      { id:"S1", x: 6.2, y: 2.2, spl1m: 108 },
      { id:"S2", x: 7.8, y: 2.2, spl1m: 108 }
    ],
    options: {
      useSubs: true,
      target: 96,              // dB target (relative)
      audienceStartY: 4.0,
      audienceEndY: 17.2,
      audiencePaddingX: 1.0,
      grid: 48,
      directivity: 0.65,        // 0 omni -> 1 narrow
      hfLossPer10m: 1.5,        // gameplay parameter
      rtPenalty: 0.0            // derived from RT (optional)
    }
  };
}

function deg2rad(d){ return d*Math.PI/180; }
function angleDiff(a,b){
  let d = a-b;
  while(d>Math.PI) d-=2*Math.PI;
  while(d<-Math.PI) d+=2*Math.PI;
  return d;
}

function topContribution(top, px, py, opt){
  const dx = px - top.x;
  const dy = py - top.y;
  const r = Math.hypot(dx, dy);
  const r2 = Math.max(1.0, r);
  // inverse distance loss (20log10 r)
  let spl = top.spl1m - 20*Math.log10(r2);

  // directivity: attenuate off-axis
  const ang = Math.atan2(dy, dx);
  const forward = deg2rad(90) - deg2rad(top.rot); // interpret rot as toe-in toward centerline (gameplay)
  const off = Math.abs(angleDiff(ang, forward));
  const norm = clamp(off / deg2rad(85), 0, 1);
  const dirLoss = (opt.directivity*18) * (norm*norm);
  spl -= dirLoss;

  // mild HF loss with distance (gameplay)
  spl -= (r/10) * (opt.hfLossPer10m || 0);

  return spl;
}

function subContribution(sub, px, py){
  const dx = px - sub.x;
  const dy = py - sub.y;
  const r = Math.hypot(dx, dy);
  const r2 = Math.max(1.0, r);
  return sub.spl1m - 20*Math.log10(r2);
}

export function simulate(sim){
  const s = sim;
  const opt = s.options || {};
  const g = clamp(opt.grid || 48, 24, 96);

  const roomW = s.room.w, roomL = s.room.l;

  const ax0 = opt.audiencePaddingX;
  const ax1 = roomW - opt.audiencePaddingX;
  const ay0 = opt.audienceStartY;
  const ay1 = opt.audienceEndY;

  const values = new Float32Array(g*g);

  let min = 1e9, max = -1e9;
  let idx = 0;
  for(let yi=0; yi<g; yi++){
    const y = (roomL * yi)/(g-1);
    for(let xi=0; xi<g; xi++){
      const x = (roomW * xi)/(g-1);

      // ignore outside audience: keep low value
      let v = -120;
      if(x>=ax0 && x<=ax1 && y>=ay0 && y<=ay1){
        // sum energies: convert dB to power
        let pow = 0;
        for(const t of s.tops){
          const spl = topContribution(t, x, y, opt);
          pow += Math.pow(10, spl/10);
        }
        if(opt.useSubs){
          for(const sub of s.subs){
            const spl = subContribution(sub, x, y);
            pow += Math.pow(10, spl/10) * 0.35; // subs contribute less to overall dB(A)-ish
          }
        }
        v = 10*Math.log10(Math.max(1e-12, pow));
        // penalty for excessive RT (gameplay)
        v -= (opt.rtPenalty || 0);
      }

      values[idx++] = v;
      if(v<min) min=v;
      if(v>max) max=v;
    }
  }

  const score = computeScore(values, g, { roomW, roomL, ax0, ax1, ay0, ay1, target: opt.target || 96 });

  return { grid:g, values, min, max, score, bounds:{ ax0, ax1, ay0, ay1 } };
}

function computeScore(values, g, b){
  // score based on uniformity and closeness to target in audience area
  const { target } = b;
  let sum=0, sum2=0, n=0;
  let under=0, over=0;

  for(let i=0;i<values.length;i++){
    const v = values[i];
    if(v<-60) continue;
    n++;
    sum += v;
    sum2 += v*v;
    const d = v - target;
    if(d < -6) under++;
    if(d > 6) over++;
  }
  if(n<10) return { overall:0, mean:-120, std:0, coverage:0, balance:0 };

  const mean = sum/n;
  const varr = Math.max(0, (sum2/n) - mean*mean);
  const std = Math.sqrt(varr);

  // coverage: fraction within ±6 dB of target
  const within = 1 - ((under+over)/n);
  const coverage = clamp(within, 0, 1);

  // uniformity score: std smaller is better
  const uniform = clamp(1 - (std/10), 0, 1);

  // balance: penalize too much under/over
  const balance = clamp(1 - (Math.abs(under-over)/n), 0, 1);

  const overall = Math.round( (coverage*0.45 + uniform*0.45 + balance*0.10) * 100 );

  return { overall, mean, std, coverage: Math.round(coverage*100), uniform: Math.round(uniform*100), balance: Math.round(balance*100) };
}
