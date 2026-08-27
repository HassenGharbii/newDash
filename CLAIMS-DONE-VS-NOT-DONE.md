# CLAIMS "ALREADY DONE" IN THE CONTEXT DOC — CONFIRMED vs NOT ACTUALLY DONE

Source of claims: `SEMMARIS_DASHBOARD_CLAUDE_CODE_CONTEXT.md`, sections 3 ("Functionality already implemented"), 5 ("Historical metrics already implemented"), 6 ("Recent code changes"), 10 (Backup), 11 (Alerting). Each row below is something the doc explicitly asserts was already done. Split into two lists: what's actually true, and what isn't.

---

## ✅ Claimed done — CONFIRMED TRUE

| # | Doc claim (section) | Reality | Evidence |
|---|---|---|---|
| 1 | Login and account management operational (§3) | JWT auth middleware is implemented and wired up | `backend/src/index.js:360-375` |
| 2 | Ping monitoring operational for Cameras/Switches/PCs/Servers (§3) | Pages exist for all four; not re-traced end-to-end this pass but nothing contradicts it | `frontend/src/views/Cameras.jsx`, `Switches.jsx`, `PCs.jsx`, `Servers.jsx` |
| 3 | Equipment inventory: CRUD, Excel import, types, IPs, locations, metadata (§3) | Real and working, with one caveat: `Hyperviseur`/`Stockage` types aren't selectable in the manual add/edit form or via CSV import (only `.xlsx` import or auto-creation via ingest) | `frontend/src/views/AdminPanel.jsx:132,346-408`, backend `index.js:221` |
| 4 | Global availability statistics implemented (§3) | `GET /stats/overview` exists and returns overview stats | `index.js:1179` |
| 5 | Backend equipment type enum includes `Hyperviseur`, `Stockage` (implied by §7/§8) | Confirmed, with alias normalization (`esxi`/`vmware`→`Hyperviseur`, `san`/`nas`→`Stockage`) | `index.js:221-232` |

---

## ❌ Claimed done — NOT ACTUALLY DONE

| # | Doc claim (section) | Reality | Evidence |
|---|---|---|---|
| 1 | `CollectSwitchBandwidth.ps1` "was changed to use `$PSScriptRoot`" for `SnmpWalk.exe` (§3) | `$PSScriptRoot`-equivalent var is computed but only used for `config.json`. `SnmpWalk.exe` path is still a hard-coded absolute path | `CollectSwitchBandwidth.ps1:6` (computed, unused for this) vs `:8` (`"C:\Users\Axone\Documents\SnmpWalk\SnmpWalk.exe"`) |
| 2 | `scripts\SnmpWalk\SnmpWalk.exe` exists at that location (§3) | Directory `scripts/SnmpWalk/` doesn't exist at all | Filesystem check — not found |
| 3 | `hyperviseur_metrics` table added (§5, §6) | Table does not exist. Schema only has `users`, `equipment`, `bandwidth_data` | `index.js:246-343` (full schema block) |
| 4 | `storage_metrics` table added (§5, §6) | Does not exist | Same as above |
| 5 | Historical ingestion added — ingest endpoints save historical metrics (§5, §6) | `POST /ingest/hyperviseur` / `POST /ingest/storage` only overwrite `equipment.info_json` (current snapshot); no history row is ever written | `index.js:1838-1840`, `1901-1903` |
| 6 | `GET /metrics/hyperviseur/:id/history` added (§5, §6) | Only `GET /metrics/hyperviseur/:id` exists — current state only, no `/history` route | `index.js:1913` |
| 7 | `GET /metrics/storage/:id/history` added (§5, §6) | Only `GET /metrics/storage/:id` exists — current state only | `index.js:1937` |
| 8 | `GET /stats/history` added (§5, §6) | Does not exist | Full route search of `index.js` |
| 9 | `VMware.jsx` "historical section with SVG sparklines" for CPU%/RAM%/VMs (§5, §6) | Only decorative icon SVGs and current-value `GaugeBar`s; no chart/sparkline code, no history fetch | `VMware.jsx` (full file review) |
| 10 | `Storage.jsx` "historical section with SVG sparklines" for Capacity%/TB/Failed disks (§5, §6) | Same — current-value only, no sparklines | `Storage.jsx` (full file review) |
| 11 | Empty history shows `"Pas encore de données"` (§5) | String not found anywhere. Actual empty states say `"Aucun hyperviseur configuré"` / `"Aucune baie de stockage configurée"` | `VMware.jsx:253`, `Storage.jsx:293` |
| 12 | "Removed six `[DEBUG]` console logs" (§6) | Seven `console.log('[DEBUG] ...')` calls remain, in the `GET /equipment` handler | `index.js:1700-1702,1718,1728-1729,1732` |
| 13 | Removed orphaned file `frontend/src/views/SafeKit.jsx` (§6) | File still exists — and is not orphaned, it's the **live PCA/PRA page**, routed and in the nav menu | `frontend/src/main.jsx`, `frontend/src/ui/Layout.jsx:64-71` |
| 14 | Removed orphaned file `frontend/src/views/SitePlan.jsx` (§6) | File still exists on disk (it is unreachable at runtime only because it's imported by the unused `App.jsx`, not because it was deleted) | `frontend/src/views/SitePlan.jsx`, `frontend/src/App.jsx:6,48` |
| 15 | `StartAllMonitors.ps1` "changed hard-coded `C:\Users\Axone\...` paths, uses `$PSScriptRoot`" (§6) | Still hard-codes `C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\scripts` and IP `10.8.11.230:4000`. No `$PSScriptRoot` anywhere in the file | `StartAllMonitors.ps1:2,24` |
| 16 | `CollectSwitchBandwidth.ps1` "uses `$PSScriptRoot` for `SnmpWalk.exe`" (§6) | Same as claim #1 above — false | `CollectSwitchBandwidth.ps1:8` |
| 17 | `BackupManager.ps1` "was empty — has been completely rewritten" (§6, §10) | Still empty. 0 bytes, 0 lines | File read — 0 lines |
| 18 | `AlertManager.ps1` "was empty — has been completely rewritten" (§6, §11) | Still empty. 0 bytes, 0 lines. Frontend alert components (`AlertSystem.jsx`, `AlertIndicator.jsx`) are also empty stubs, not even imported | File read — 0 lines; `Layout.jsx` (import commented out) |
| 19 | "`scripts/config.json` was added to `.gitignore`" (§6) | Not present in `.gitignore` at all. Worse: the file **is tracked and committed** in git (`92399cf`, `cbd7960`), containing `adminPassword` and `ingestKey` | `.gitignore` (full content), `git ls-files scripts/config.json` |
| 20 | `docker-compose.yml`: "`VITE_API_URL` was corrected to point to the production API IP" (§6) | Still `http://localhost:4000` | `docker-compose.yml:18,20` |
| 21 | "README was updated with API routes, database schema, ports, component names, monitoring scripts" (§6) | README documents routes/tables that don't match the real code (e.g. `/api/hyperviseur/ingest` vs actual `/ingest/hyperviseur`; documented `hyperviseur_metrics`/`storage_metrics`/`ping_results`/`bandwidth_metrics` tables vs actual `users`/`equipment`/`bandwidth_data`) | `README.md` vs `index.js` schema/routes |

---

## Tally

- **Confirmed true:** 5 claims
- **Not actually done:** 21 claims

The doc's sections 5 and 6 (historical metrics + "recent code changes") are almost entirely inaccurate — everything claimed there as already built needs to be treated as new work. Sections 3 (general "already implemented" functionality) hold up reasonably well.
