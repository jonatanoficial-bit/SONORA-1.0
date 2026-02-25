
import { el } from "./dom.js";

export function openModal({ title="Aviso", content=null, actions=[] }={}){
  const backdrop = el("div",{class:"modal-backdrop"});
  const modal = el("div",{class:"modal"});
  const hd = el("div",{class:"hd"},
    el("div",{class:"h2",style:"margin:0"}, title)
  );
  const bd = el("div",{class:"bd"}, content || el("div",{class:"p"},""));
  const ft = el("div",{class:"ft"});

  actions = actions.length ? actions : [{ label:"Fechar", variant:"secondary", onClick:()=>close() }];
  actions.forEach(a=>{
    const cls = a.variant==="primary" ? "btn small" : a.variant==="ghost" ? "btn small ghost" : "btn small secondary";
    ft.appendChild(el("button",{class:cls, onclick:()=>{ try{ a.onClick?.(); } finally { if(a.close!==false) close(); } }}, a.label));
  });

  modal.appendChild(hd); modal.appendChild(bd); modal.appendChild(ft);
  backdrop.appendChild(modal);

  function onKey(e){ if(e.key==="Escape") close(); }
  function onClick(e){ if(e.target===backdrop) close(); }

  function close(){
    document.removeEventListener("keydown", onKey);
    backdrop.removeEventListener("click", onClick);
    backdrop.remove();
  }
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", onClick);
  document.body.appendChild(backdrop);
  return { close, backdrop, modal };
}

export function confirmModal({ title="Confirmar", message="Tem certeza?", confirmText="Confirmar", cancelText="Cancelar" }={}){
  return new Promise(resolve=>{
    const content = el("div",{class:"p",style:"white-space:pre-line"}, message);
    openModal({
      title,
      content,
      actions:[
        { label: cancelText, variant:"secondary", onClick:()=>resolve(false) },
        { label: confirmText, variant:"primary", onClick:()=>resolve(true) }
      ]
    });
  });
}
