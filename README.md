# SONORA

**Build:** 2026-02-09

This is a **mobile-first**, **vanilla HTML/CSS/JS** platform for acoustic analysis and audio planning with:
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
