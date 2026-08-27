# SEMMARIS DASHBOARD — AUDIT: ÉTAT RÉEL DU CODE (2026-08-26)

This document records what was actually verified in the code, as opposed to what `SEMMARIS_DASHBOARD_CLAUDE_CODE_CONTEXT.md` and `README.md` claim. No code was changed to produce this — it's a read-only audit.

Legend: ✅ Confirmed working &nbsp; ⚠️ Partially working / caveat &nbsp; ❌ Not implemented / broken &nbsp; 🔴 Security risk &nbsp; ❓ Not independently re-verified in this pass

---

## 1. Authentication / Users

| Item | Status | Notes |
|---|---|---|
| Node/Express backend | ✅ | `backend/src/index.js`, single-file server, 1986 lines |
| Database | ⚠️ | **SQLite** (`better-sqlite3`), not Postgres as the context doc hedges — `index.js:7,241` |
| JWT auth middleware | ✅ | `auth(roles)` at `index.js:360-375` |
| Roles: Admin / User / SGM | ❓ | Role system exists in middleware; not independently re-checked row-by-row this pass |
| Login flow | ❓ | Not re-tested at runtime this pass (app not started yet) |
| Default seeded accounts | 🔴 | Hard-coded seed passwords `admin123` / `user123` in source (`index.js:348,351`) for `admin@semmaris.local` / `user@semmaris.local` — must be changed for production |
| JWT_SECRET / INGEST_KEY defaults | 🔴 | Hard-coded fallback secrets in source if env vars absent: `'devsecret-dev-only'` (`index.js:80`), `'dev-ingest-key'` (`index.js:82`) |

## 2. Infrastructure ping monitoring (Cameras, Switches, PCs, Servers)

| Item | Status | Notes |
|---|---|---|
| Ping monitoring pages exist | ✅ | `Cameras.jsx`, `Switches.jsx`, `PCs.jsx`, `Servers.jsx` all present in `frontend/src/views/` |
| Actual ping logic verified end-to-end | ❓ | Not re-traced this pass — doc's claim not contradicted by anything found |

## 3. Switch bandwidth (SNMP)

| Item | Status | Notes |
|---|---|---|
| `CollectSwitchBandwidth.ps1` uses `$PSScriptRoot` for `SnmpWalk.exe` | ❌ **FALSE** | Script computes `$ScriptRoot` (`line 6`) but only uses it for `config.json`; `SnmpWalk.exe` path is still hard-coded: `$SNMPWALK_PATH = "C:\Users\Axone\Documents\SnmpWalk\SnmpWalk.exe"` (`line 8`) |
| `scripts/SnmpWalk/SnmpWalk.exe` exists on disk | ❌ **FALSE** | Directory `scripts/SnmpWalk/` does not exist at all |
| ~90 switch IPs hard-coded in script | 🔴 | `CollectSwitchBandwidth.ps1:22-119`, range `172.16.5.x` |
| **Net effect** | ❌ | Switch bandwidth collection is currently non-functional as configured |

## 4. Equipment inventory / Admin panel

| Item | Status | Notes |
|---|---|---|
| CRUD via Admin Panel | ✅ | `AdminPanel.jsx`, hits `/equipment` REST endpoints |
| Excel (.xlsx) import/export | ✅ | `AdminPanel.jsx:346-408` → `/equipment/template-excel`, `/equipment/export-excel`, `/equipment/bulk-excel`; server-side uses full type list correctly |
| CSV import | ⚠️ | Exists, but any type outside `Server/Switch/Camera/PC` silently becomes `PC` (`AdminPanel.jsx:393`) |
| Manual add/edit form — equipment types | ⚠️ | Only `['Server','Switch','Camera','PC']` selectable (`AdminPanel.jsx:132`) — **`Hyperviseur` and `Stockage` cannot be manually added/edited in the UI**, only via `.xlsx` import or auto-creation by the ingest endpoints |
| Backend type enum | ✅ | `ALLOWED_TYPES = ['Camera','Switch','Server','PC','Hyperviseur','Stockage']` (`index.js:221`), with alias normalization `normType()` (`index.js:222-232`) |

## 5. Global availability statistics

| Item | Status | Notes |
|---|---|---|
| `GET /stats/overview` | ✅ | `index.js:1179` |
| `GET /stats/history` (claimed in doc) | ❌ | Does not exist |

## 6. Pages inventory (`frontend/src/views/`)

```
AdminPanel.jsx  Bandwidth.jsx  Cameras.jsx  Equipment.jsx  Home.jsx
HomeSGM.jsx     Login.jsx      PCs.jsx      SafeKit.jsx    Servers.jsx
SitePlan.jsx    Stats.jsx      Storage.jsx  Switches.jsx   VMware.jsx
```

| Doc claim | Status |
|---|---|
| `SafeKit.jsx` was removed | ❌ **FALSE** — it exists and **is** the live PCA/PRA page, routed in `main.jsx`, in the nav menu as "PCA / PRA" |
| `SitePlan.jsx` was removed | ❌ **FALSE** — file exists, but it's orphaned: only imported by `App.jsx`, which is dead code (real entry point `main.jsx` defines its own local `App()` and comments out the `App.jsx` import) |

## 7. Historical metrics (VMware / Storage) — doc's Section 5/6

**None of this exists. This is greenfield work, not a bug to fix.**

| Item | Status | Notes |
|---|---|---|
| `hyperviseur_metrics` table | ❌ | Not in schema. Only `users`, `equipment`, `bandwidth_data` exist |
| `storage_metrics` table | ❌ | Not in schema |
| Ingest writes history row | ❌ | `POST /ingest/hyperviseur` / `POST /ingest/storage` only `UPDATE equipment SET info_json=...` (current snapshot, overwritten each time) — `index.js:1838-1840`, `1901-1903` |
| `GET /metrics/hyperviseur/:id/history` | ❌ | Only `GET /metrics/hyperviseur/:id` exists (current-state only) |
| `GET /metrics/storage/:id/history` | ❌ | Only `GET /metrics/storage/:id` exists (current-state only) |
| SVG sparklines in `VMware.jsx` | ❌ | Only decorative icon SVGs; current-value `GaugeBar` only |
| SVG sparklines in `Storage.jsx` | ❌ | Same — current-value only |
| `"Pas encore de données"` empty-state string | ❌ | Not found. Actual strings: `"Aucun hyperviseur configuré"` (`VMware.jsx:253`), `"Aucune baie de stockage configurée"` (`Storage.jsx:293`) |
| Removed `[DEBUG]` console.logs | ❌ | 7 remain in `GET /equipment` handler, `index.js:1700-1732` |

## 8. VMware collector & page

| Item | Status | Notes |
|---|---|---|
| `CollectHyperviseurInfo.ps1` supports vCenter mode | ✅ | `-VCenterHost/-VCenterUser/-VCenterPass` params (`lines 19-33`), env fallback |
| Supports direct ESXi mode | ✅ | `-ESXiHosts` / `-ESXiUser` / `-ESXiPass` |
| PowerCLI dependency check | ✅ | `lines 46-50`, exits if `VMware.PowerCLI` not installed |
| API URL / ingest key config | ✅ | Via CLI params / env vars, defaults to `localhost:4000` / `dev-ingest-key` (not via `scripts/config.json`) |
| PowerShell version compatibility | 🔴 | Uses `??` null-coalescing operator → **requires PowerShell 7+**, will fail to parse on default Windows PowerShell 5.1 |
| Actually connects to real vCenter/ESXi | ❓ | Cannot verify without real credentials (external dependency, per doc §22) |
| Page displays current data | ✅ (code path) | `VMware.jsx` fetches `?type=Hyperviseur` and renders gauges — will show data once equipment + ingest are populated |
| Page displays history | ❌ | No history feature exists (see §7) |

## 9. Storage collector & page

| Item | Status | Notes |
|---|---|---|
| `CollectStorageInfo.ps1` params match doc | ✅ | `StorageHosts/SnmpCommunity/ApiUser/ApiPass/DashboardApiUrl/IngestKey` (`lines 16-32`) |
| Hard-coded default vendor password | 🔴 | `-ApiPass` defaults to `"!manage"` (known Seagate/Dot Hill default) baked into script |
| PowerShell version compatibility | 🔴 | Same `??` operator issue as above |
| Page displays current data | ✅ (code path) | Same pattern as VMware page |
| Page displays history | ❌ | No history feature exists (see §7) |

## 10. PCA / PRA

| Item | Status | Notes |
|---|---|---|
| Page exists and is live | ✅ | It's `SafeKit.jsx`, not a new/separate file — routed at `/safekit` |
| Tags PCA1 / PCA2 / PRA → site labels | ✅ | `SafeKit.jsx:6-40` |
| Case-insensitive substring matching | ✅ | `SafeKit.jsx:86-97` — `.toUpperCase().includes(tag)` on both `location` and `name` fields. Confirmed matches doc's example (`"Salle réseau PCA1 Baie 3"` → matches `PCA1`) |
| Empty-site UI feedback | ✅ | Present at `SafeKit.jsx:356` |

## 11. Backup

| Item | Status | Notes |
|---|---|---|
| `BackupManager.ps1` implemented | ❌ **FALSE** | File is **0 bytes / literally empty** — not "rewritten" |
| Scheduled task set up | ❌ | Nothing to schedule yet |

## 12. Alerting

| Item | Status | Notes |
|---|---|---|
| `AlertManager.ps1` implemented | ❌ **FALSE** | File is **0 bytes / literally empty** — not "rewritten" |
| Reads `scripts/config.json` for webhook config | ❌ | Can't — file is empty |
| Frontend alert components | ❌ | `AlertSystem.jsx` / `AlertIndicator.jsx` are empty stub components, explicitly commented "vide pour éviter les erreurs" (empty to avoid errors), and not even imported in `Layout.jsx` (import commented out) |
| **Net effect** | ❌ | Entire alerting feature is non-functional front-to-back |

## 13. Docker / deployment

| Item | Status | Notes |
|---|---|---|
| `docker-compose.yml` services | ✅ | 4 services: `api`, `frontend`, `ping-monitor`, `bandwidth-monitor` |
| `VITE_API_URL` corrected to production IP | ❌ **FALSE** | Still `http://localhost:4000` (`docker-compose.yml:18,20`), not the `10.8.11.230` IP seen elsewhere |
| `ping-monitor` / `bandwidth-monitor` scripts exist | ❌ **BROKEN, not mentioned in doc** | Compose references `/opt/monitors/PingEquipment.ps1` and `/opt/monitors/BandwidthMonitor.ps1`; **neither file exists anywhere in `scripts/`** — these containers fail on startup today |
| `.env.example` files exist | ✅ | `backend/backend.env.example` (4 vars: `PORT, JWT_SECRET, DB_PATH, INGEST_KEY` — missing `CORS_ORIGIN` even though code reads it), `frontend/frontend.env.example` (`VITE_API_URL`) |

## 14. Security — summary of live issues

| Issue | Severity | Notes |
|---|---|---|
| 🔴 `scripts/config.json` tracked in git | **High** | Contains `adminPassword`, `ingestKey`. Not in `.gitignore` (doc claims it was added — it wasn't). Committed in `92399cf` and `cbd7960`. Needs rotation + untracking (+ optionally history purge, which is destructive and needs explicit sign-off) |
| 🔴 Hard-coded default JWT/ingest secrets | Medium | `'devsecret-dev-only'`, `'dev-ingest-key'` fallbacks in `index.js` — fine for dev, must be overridden via env vars in production |
| 🔴 Hard-coded seed passwords | Medium | `admin123` / `user123` in source |
| 🔴 Hard-coded internal production IP | Low-Medium | `10.8.11.230` in `StartAllMonitors.ps1` |
| 🔴 Hard-coded vendor default password | Low-Medium | `"!manage"` default in `CollectStorageInfo.ps1` |

## 15. Duplicate / dead / not-in-doc scripts

Not broken per se, but worth knowing about before touching the collectors:

- **3 server collectors**: `CollectServerInfo.ps1`, `CollectServerMetrics.ps1`, `CollectServerMetricsV2.ps1` — unclear which is canonical
- **2 switch-metrics collectors**: `CollectSwitchMetrics.ps1` vs `CollectSwitchMetrics-Native.ps1`
- **2 competing "start everything" scripts**: `StartAllMonitors.ps1` vs `StartMonitors.ps1`
- `CollectSwitchInfo.ps1` — explicitly commented "version simplifiée temporaire"; `CollectSwitchInfo.ps1.broken` — a disabled 507-line predecessor
- `AutomationManager.ps1` (443 lines, not in doc at all) — its `-Task alerts` path has zero cross-references to `AlertManager.ps1`
- `DeploymentGuide.ps1` references a **third** hard-coded path (`C:\inetpub\Magnetoo-Semmaris\...`), inconsistent with the other two
- Many one-off maintenance scripts unrelated to the monitoring pipeline (camera cleanup/dedup scripts, NetSNMP installers, autostart installers, etc.)

---

## Overall picture

- **Solid and real:** auth/JWT, equipment CRUD + Excel import, ping-monitoring pages, PCA/PRA tagging logic, VMware/Storage collector scripts' parameter handling and current-state display pipeline.
- **Broken/incomplete relative to what the doc claims was "already done":** historical metrics (doesn't exist), backup + alerting (both scripts are empty), path/IP hard-coding in PowerShell (not fixed), SnmpWalk.exe (missing), docker-compose monitor containers (reference missing scripts), the committed secret (not actually gitignored).
- **New risk found, not in the doc at all:** PowerShell 7+ syntax (`??`) in two collector scripts likely to fail on default Windows PowerShell 5.1.
