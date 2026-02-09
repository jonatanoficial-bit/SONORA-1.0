function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

export function calcChannels(spec){
  const s=spec||{};
  const vocals=+s.vocals||0;
  const pastor=+s.pastor||0;
  const wireless=+s.wireless||0;
  const playback=+s.playback||0; // stereo = 2ch
  const keysStereo=+s.keysStereo||0; // each = 2ch
  const guitar=+s.guitar||0;
  const bassDI=+s.bassDI||0;
  const drumsBasic=+s.drumsBasic||0; // 3ch
  const drumsFull=+s.drumsFull||0; // 8ch
  const extra=+s.extra||0;

  const ch = vocals + pastor + wireless + (playback*2) + (keysStereo*2) + guitar + bassDI + (drumsBasic*3) + (drumsFull*8) + extra;
  const headroom = clamp(Math.ceil(ch*0.25), 2, 12);
  return { channels: ch, headroom, recommended: ch+headroom };
}

export function suggestConsole(recommendedChannels, use){
  const ch=recommendedChannels||0;
  const u=use||"mixed";
  const needsFX = u !== "speech";
  let tier="compact";
  if(ch<=12) tier="compact"; else if(ch<=18) tier="mid"; else if(ch<=32) tier="pro"; else tier="large";
  const digitalBias = (ch>=12) || needsFX;

  const analog={ type:"Analógica", why:"Simples e direta. Boa quando o set é pequeno e estável.", note: ch<=16 ? "16 canais com 2 auxiliares resolve muita coisa." : "Acima de 16 canais fica grande/caro." };
  const digital={ type:"Digital", why:"Cenas, EQ/comp por canal, FX e mais auxiliares. Ideal para igrejas sem técnico fixo.", note: ch<=20 ? "Procure 16–20 canais com 6+ auxiliares." : "Procure 24–32 canais com 8+ auxiliares." };

  return { tier, prefer: digitalBias ? "digital" : "analog", analog, digital };
}

export function buildChecklist({ use="mixed", wirelessMics=0, vocalMics=4, diBoxes=2, monitors=2 }={}){
  const list=[];
  const add=(name,qty,note="")=>list.push({name,qty,note});

  add("Microfone vocal dinâmico", vocalMics, "Vozes / backing");
  add("Microfone para pastor/púlpito", 1, "Headworn/lapela ou gooseneck");
  if(wirelessMics>0) add("Sistema sem fio", wirelessMics, "Evite 2.4GHz se possível");

  if(use!=="speech") add("DI Box", diBoxes, "Teclado/baixo/playback");

  add("Pedestal de microfone", Math.max(vocalMics,2), "1 por vocal + reserva");
  add("Filtro pop / espuma", Math.max(2, Math.ceil(vocalMics/2)), "Reduz plosivas");
  add("Fita gaffer", 2, "Rolos");
  add("Extensões / réguas de energia", 4, "Palco/FOH");

  add("Cabos XLR (5–10m)", Math.max(8, vocalMics*2), "Tenha reserva");
  add("Cabos P10 / TRS", 6, "Instrumentos / linhas");
  add("Cabos para playback", 2, "Celular / notebook");
  add("Kit adaptadores", 1, "P2↔P10, RCA, etc.");

  if(use!=="speech") add("Retorno de palco (wedge) ou IEM", monitors, "Conforme banda");
  add("Cabos de energia IEC e extensões", 6, "Para caixas/mesa/periféricos");

  add("Protetor de linha / filtro", 2, "Proteção básica");
  add("Multímetro simples", 1, "Diagnóstico rápido");

  return list;
}
