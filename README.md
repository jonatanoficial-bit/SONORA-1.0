# SONORA

**Build:** 2026-02-25 18:14 BRT

This is a **mobile-first**, **vanilla HTML/CSS/JS** project scaffold with:
- Premium AAA-style UI (glass/gradient, micro-interactions, smooth animations)
- A simple SPA router (no frameworks)
- **Modular content/DLC system** loaded dynamically via JSON manifests
- **Admin area** (local login) to manage DLCs/content (enable/disable, edit metadata)
- Import/Export of content data (JSON) so you can keep it static today and add a backend later

> **Replace the app/game purpose:** edit `content/core/app-info.json` and the Home screen text in `src/screens/home.js`.

---

## Run locally

Any static server works. Examples:

### Option A (Python)
```bash
python -m http.server 8080
```
Open:
- http://localhost:8080

### Option B (VS Code)
Use the extension **Live Server**.

---

## Deploy to GitHub Pages

1. Create a GitHub repository and upload the project files.
2. In GitHub: **Settings → Pages**
3. Source: `Deploy from a branch`
4. Branch: `main` and folder: `/ (root)`
5. Save. Your site will be available at the Pages URL.

✅ **SPA refresh fix:** this project includes a `404.html` fallback so deep links (ex: `/report`) work on GitHub Pages.

---

## Content / DLC system

### Where content lives
- `content/core/manifest.json` → lists installed DLCs and core content version
- `content/dlc/<dlc_id>/dlc.json` → each DLC manifest
- `content/dlc/<dlc_id>/data.json` → DLC data (levels/items/text/etc.)
- Assets live inside each DLC folder.

### How loading works
Core loads `content/core/manifest.json`, then loads each enabled DLC manifest and data.
Admin can **override**/extend content **in LocalStorage** (static-friendly).
You can export a JSON bundle to share or commit later.

---

## Admin

Open the app and go to:
- **Menu → Admin**

Default login (local-only):
- user: `admin`
- pass: `admin`

> Change credentials in `src/admin/auth.js`.

Admin features (static-friendly):
- Enable/disable DLCs
- Edit DLC metadata (name, version, description)
- Edit DLC data JSON (simple editor)
- Import/export all content overrides as JSON

---

## Notes / limitations (static mode)

- Browsers cannot write to your repository. Admin changes are stored in **LocalStorage**.
- Use **Export** to get a JSON file and commit it to `/content/` manually if you want permanence.
- Architecture is ready for a future backend (you can swap the storage adapter).

---

## Folder structure

```
/
  index.html
  assets/
  content/
    core/
    dlc/
  src/
    app.js
    router.js
    ui/
    screens/
    admin/
```

Enjoy.

## Medição via microfone (Fase 2)

- Use HTTPS (GitHub Pages ok)
- Permita acesso ao microfone
- Recomenda-se PC/notebook + interface de áudio
- Resultados são **indicativos** e dependem de ruído e do microfone


## Planejamento de PA (Fase 3)

- O relatório inclui uma estimativa de PA (tops/subs/mesa/monitores)
- Inclui RTA Snapshot (indicativo) via microfone
- Exportação de projeto em JSON e opção de imprimir/salvar PDF (via impressão do navegador)


## Checklist e Planejamento (Fase 4)

- Nova tela **Planejamento** (/plan) com calculadora de canais, sugestão de mesa analógica/digital e checklist de compra/locação.
- Templates prontos para igrejas (até 300 pessoas) ao criar projetos.
- Exportação do planejamento em JSON e opção de imprimir/salvar PDF.


## Proposta / Orçamento (Fase 5)

- Nova tela **Proposta** em `/quote`
- Gera itens automaticamente com base em:
  - Planejamento de PA (tops/subs/mesa/monitores)
  - Canais e checklist
- Tabela de preços editável (salva no navegador)
- Histórico local de propostas
- Exportação em JSON e impressão/salvar PDF (via impressão do navegador)

## Relatório Premium (Fase 7)

- Nova tela **Relatório Premium** (`/report`) com layout cliente-ready.
- Exportação por impressão do navegador (PDF) + export JSON.
- O RTA (snapshot) passa a ser salvo no projeto quando capturado em **Medição**, para entrar no relatório.


## Design System AAA (Fase 9)

- Tokens de espaçamento, raio, elevação e motion (microinterações)
- Componentes: chips, KPIs, tabelas aprimoradas, skeleton loader, modal
- Melhorias de foco/acessibilidade e impressão


## Simulador (Fase 10)

- Nova tela **Simulador** (/sim) com mapa interativo, heatmap de cobertura (indicativo) e score.
- Arraste caixas e subs, ajuste toe-in/directivity/target e salve no projeto.


## Medição Avançada (Fase 11)

- RT estimado por bandas (125Hz–4kHz).
- Confidence Score da medição.
- Base pronta para IR real futura.


## PWA e Modo Pro (Fase 12)

- Manifest + Service Worker para instalação (PWA).
- Ícone e logo oficiais incluídos.
- Toggle **Modo Pro** em Ajustes (localStorage).


## IR e RT por bandas (Fase 13)

- Nova tela **IR** (/ir) para capturar impulso (palma) e estimar RT por bandas com DSP real.
- Salva `project.ir`, `project.rtBands` e `project.irConfidence`.
- Relatório exibe RT por bandas quando disponível.

