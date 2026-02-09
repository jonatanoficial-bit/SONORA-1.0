
const KEY="sonora.projects.v1";
export function loadProjects(){ try{ return JSON.parse(localStorage.getItem(KEY)||"[]"); }catch{ return []; } }
export function saveProjects(list){ localStorage.setItem(KEY,JSON.stringify(list)); }
export function upsertProject(p){
  const list=loadProjects();
  const i=list.findIndex(x=>x.id===p.id);
  if(i>=0) list[i]=p; else list.unshift(p);
  saveProjects(list); return p;
}
export function getProject(id){ return loadProjects().find(p=>p.id===id)||null; }
export function genId(){ return "p_"+Math.random().toString(36).slice(2,10)+"_"+Date.now().toString(36); }
