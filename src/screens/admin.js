import { el } from "../ui/dom.js";
import { isAuthed, login, logout } from "../admin/auth.js";
import { exportOverrides, loadOverrides, saveOverrides } from "../storage.js";
import { toast } from "../ui/toast.js";

function safeJsonParse(text){
  try { return { ok:true, value: JSON.parse(text) }; }
  catch(e){ return { ok:false, error: e }; }
}

export function renderAdmin(ctx) {
  const content = ctx.content;
  const overrides = exportOverrides();
  const authed = isAuthed();

  if (!authed) return renderLogin();

  return renderPanel();

  function renderLogin() {
    const user = el("input", { class:"input", placeholder:"Usuário", value:"admin" });
    const pass = el("input", { class:"input", placeholder:"Senha", type:"password", value:"admin" });

    return el("div", {},
      el("div", { class:"card" },
        el("div", { class:"h1" }, "Admin"),
        el("div", { class:"p" }, "Login local (modo estático). Pronto para evoluir para backend depois.")
      ),
      el("div", { class:"card" },
        el("div", { class:"h2" }, "Entrar"),
        user, el("div", { style:"height:10px" }),
        pass, el("div", { style:"height:12px" }),
        el("button", { class:"btn", onclick: () => { if (login(user.value.trim(), pass.value)) setTimeout(()=>location.reload(), 250); } }, "Login")
      )
    );
  }

  function renderPanel() {
    const dlcs = (content.coreManifest.installed_dlcs ?? []).map(d => ({...d}));

    // Build editable list, backed by overrides
    const list = el("div", { class:"card" },
      el("div", { class:"h2" }, "DLCs instaladas (manifest)"),
      el("div", { class:"p" }, "Ative/desative DLCs. Em modo estático, isso vira override em LocalStorage.")
    );

    for (const d of dlcs) {
      const id = d.id;
      const currentEnabled = (() => {
        const o = overrides?.dlc?.[id];
        if (o && "enabled" in o) return !!o.enabled;
        return d.enabled !== false;
      })();

      const btn = el("button", { class:"btn small secondary", onclick: () => toggle(id, !currentEnabled) }, currentEnabled ? "Desativar" : "Ativar");

      list.appendChild(el("div", { class:"tile", style:"margin-top:12px" },
        el("div", { class:"tile-top" },
          el("div", {},
            el("div", { class:"h2", style:"margin:0" }, id),
            el("div", { class:"tiny" }, `Status: ${currentEnabled ? "Ativa" : "Inativa"}`)
          ),
          btn
        ),
        el("button", { class:"btn small ghost", onclick: () => openEditor(id) }, "Editar JSON da DLC (manifest + data)")
      ));
    }

    const exportBtn = el("button", { class:"btn secondary", onclick: () => {
      const data = exportOverrides();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "content-overrides.json";
      a.click();
      toast("Exportado: content-overrides.json");
    } }, "Exportar overrides (JSON)");

    const resetBtn = el("button", { class:"btn ghost", onclick: () => {
      localStorage.removeItem("premiumShell.contentOverrides.v1");
      toast("Overrides limpos");
      setTimeout(()=>location.reload(), 350);
    } }, "Resetar overrides");

    const logoutBtn = el("button", { class:"btn ghost", onclick: () => { logout(); toast("Logout"); setTimeout(()=>location.reload(), 250); } }, "Sair");

    const actions = el("div", { class:"card" },
      el("div", { class:"h2" }, "Ações"),
      exportBtn,
      el("div", { style:"height:10px" }),
      resetBtn,
      el("div", { style:"height:10px" }),
      logoutBtn
    );

    return el("div", {}, 
      el("div", { class:"card" },
        el("div", { class:"h1" }, "Admin"),
        el("div", { class:"p" }, "Gerencie DLCs e dados. Tudo aqui é estático-friendly (LocalStorage + export/import).")
      ),
      list,
      actions
    );
  }

  function toggle(id, enabled) {
    overrides.dlc = overrides.dlc ?? {};
    overrides.dlc[id] = overrides.dlc[id] ?? {};
    overrides.dlc[id].enabled = enabled;
    saveOverrides(overrides);
    toast(enabled ? "DLC ativada" : "DLC desativada");
    setTimeout(()=>location.reload(), 250);
  }

  function openEditor(id) {
    const current = overrides.dlc?.[id] ?? {};
    const pack = content.dlc?.[id];

    const defaultManifest = pack?.manifest ?? null;
    const defaultData = pack?.data ?? null;

    const manifestArea = el("textarea", { class:"input" });
    const dataArea = el("textarea", { class:"input" });

    manifestArea.value = JSON.stringify(current.dlcManifest ?? defaultManifest, null, 2);
    dataArea.value = JSON.stringify(current.dlcData ?? defaultData, null, 2);

    const saveBtn = el("button", { class:"btn", onclick: () => {
      const m = safeJsonParse(manifestArea.value);
      const d = safeJsonParse(dataArea.value);
      if (!m.ok || !d.ok) return toast("JSON inválido (verifique vírgulas/aspas)");
      overrides.dlc = overrides.dlc ?? {};
      overrides.dlc[id] = overrides.dlc[id] ?? {};
      overrides.dlc[id].dlcManifest = m.value;
      overrides.dlc[id].dlcData = d.value;
      saveOverrides(overrides);
      toast("Salvo (LocalStorage)");
      setTimeout(()=>location.reload(), 250);
    } }, "Salvar");

    const closeBtn = el("button", { class:"btn secondary", onclick: () => ctx.router.go("/admin") }, "Voltar");

    const page = el("div", {},
      el("div", { class:"card" },
        el("div", { class:"h1" }, `Editar DLC: ${id}`),
        el("div", { class:"p" }, "Edite manifest e data JSON. Isso cria override local.")
      ),
      el("div", { class:"card" },
        el("div", { class:"h2" }, "DLC manifest (dlc.json)"),
        manifestArea
      ),
      el("div", { class:"card" },
        el("div", { class:"h2" }, "DLC data (data.json)"),
        dataArea,
        el("div", { style:"height:12px" }),
        saveBtn,
        el("div", { style:"height:10px" }),
        closeBtn
      )
    );

    ctx.mount(page);
  }
}
