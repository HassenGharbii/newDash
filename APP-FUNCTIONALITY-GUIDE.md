# SEMMARIS DASHBOARD — What It Does & How To Use It

Snapshot of the app as it stands today (verified against the actual code, not the old docs). Covers the web app and the PowerShell monitoring side.

---

## 1. What the app is

An internal web dashboard that centralizes monitoring for Semmaris' infrastructure: cameras, switches, PCs, servers, VMware hypervisors, and Seagate storage arrays — plus a PCA/PRA (disaster-recovery site) view, bandwidth monitoring, and an equipment inventory with Excel import/export. Windows PowerShell scripts collect data from the network and push it to the backend API; the React frontend displays it.

## 2. Logging in / roles

- Go to the app URL → login screen (identifier + password) → `/auth/login`.
- Three roles: **Admin**, **User**, **SGM**. The role comes back with the login response and controls what's visible in the sidebar (not what's reachable by URL — see the caveat in §9).
- **Logout**: click your name/role badge in the top-right corner → "Déconnexion". An expired/invalid session also auto-logs-out the next time it calls the API (401 response).
- Default seeded accounts (dev/fresh installs only): `admin@semmaris.local` / `user@semmaris.local`, passwords set via `ADMIN_SEED_PASSWORD`/`USER_SEED_PASSWORD` env vars (see `backend/backend.env.example`). **Change these before going to production.**

## 3. What each role sees

| Role | Sidebar menu |
|---|---|
| **Admin** | Accueil, Équipements, Statistiques, Bande Passante, VMware, Stockage, PCA/PRA, **Panel Admin** |
| **User** | Same as Admin minus Panel Admin |
| **SGM** | Only "Accueil" — a stripped-down home page (cameras + switches only, no bandwidth chart, a link to a static site-plan image, a search bar, offline-equipment lists) |

Cameras / Switches / PCs / Servers pages have **no sidebar link at all** for anyone — you reach them by clicking the matching KPI tile on the home page.

## 4. Home dashboard (`/`)

One KPI tile per equipment type (Caméras, Switches, PC, Serveurs, Hyperviseurs, Stockage), each with a mini up/down pie chart and a total — click a tile to jump to that equipment's page. Auto-refreshes every 20s. For Admin/User, there's also a live 24h bandwidth chart for a specific reference switch. SGM sees a narrower version (cameras/switches only, plus a site-plan link and offline-equipment lists) instead of a separate page.

## 5. Monitoring pages (read-only — editing happens in Admin Panel)

- **Cameras** (via Home tile): status pie chart + paginated table (name, IP, status, last-seen, location), offline ones sorted to the top. Refreshes every 30s.
- **PCs** (via Home tile): same pattern as Cameras.
- **Switches** (via Home tile): pick a switch from a dropdown → live power/CPU/bandwidth gauges + a grid of individual port cards (status, speed, bandwidth); click a port for connected-device detail. Refreshes every 10s.
- **Servers** (via Home tile): pick a server → power/CPU/GPU gauges, bandwidth, and a card per network interface (IP/MAC/speed/current usage); falls back to basic ping info if detailed metrics aren't available yet.
- **Équipements** (`/equipements`, sidebar): the general equipment list across all types — this is the read view; adding/removing equipment is done in Panel Admin.

## 6. Bandwidth (`/bande-passante`)

Overview cards (currently switches only) with a mini 24h trend + current/avg/max/min Mbps. Click a card to drill into a full 24h chart for that switch (or an aggregate "all switches" view). Pulled from `/bandwidth` + `/bandwidth/stats`; mini charts refresh every 30s, detail view every 2 minutes.

## 7. Statistics (`/stats`)

System-wide KPIs: total up/down, overall uptime %, average response time, alert counts, a per-type breakdown (Caméras/PCs/Serveurs/Switches with % available), and a recent-alerts list. Refreshes every 60s.

## 8. VMware (`/vmware`) and Stockage (`/stockage`)

List of hypervisors / storage arrays on the left (click to select), detail panel on the right showing current CPU/RAM/VM counts (VMware) or capacity/disk-health (Storage) — **plus a new "Historique (24h)" section with sparkline mini-charts** (CPU%, RAM%, VM count for VMware; capacity %, capacity in TB, failed disks for Storage). Shows "Pas encore de données" until a collector script has actually run and reported data more than once. These pages are empty today because no vCenter/ESXi or Seagate credentials are configured yet — that's a configuration gap, not a bug (see §11).

## 9. PCA/PRA (`/safekit`)

Groups equipment into three disaster-recovery sites (PCA Site 1, PCA Site 2, PRA) based on whether an equipment's `location` or `name` field *contains* the tag `PCA1`, `PCA2`, or `PRA` (case-insensitive, substring match — e.g. "Salle réseau PCA1 Baie 3" counts). Shows equipment health per site; flags sites with no equipment assigned.

## 10. Panel Admin (`/paneladmin`, Admin only)

- Full equipment CRUD (add/edit/delete, single or bulk-delete, delete-by-type, delete-all).
- Excel import/export (`.xlsx` — supports all 6 equipment types including Hyperviseur/Stockage) and CSV import (now also accepts Hyperviseur/Stockage, previously silently downgraded to PC).
- Equipment fields: name, type, IP, model, location.
- User management (create/edit/delete users, assign role) lives here too, via the `/users` API.

**Caveat worth knowing**: the SGM menu restriction is UI-only. Only `/paneladmin` has a hard server/router-level role check — an SGM user who types `/stats` (or another hidden URL) directly can still open it. Not a data-security hole (the backend still enforces role on writes/admin actions), but worth knowing if strict SGM containment matters to you.

## 11. What's still empty and why (not a bug)

- **VMware / Stockage pages**: empty until `CollectHyperviseurInfo.ps1` / `CollectStorageInfo.ps1` actually run against real vCenter/ESXi/Seagate credentials, which haven't been provided yet.
- **Switch bandwidth**: `SnmpWalk.exe` still needs to be placed at `scripts\SnmpWalk\SnmpWalk.exe` — it's referenced but not present on disk.
- **Alerts**: will stay silent until `AlertManager.ps1` is actually run (see §13) and a real `webhookUrl` is set in `scripts/config.json`.

## 12. Historical data (new)

VMware/Storage ingestion now also writes a history row every time a collector reports in (tables `hyperviseur_metrics`/`storage_metrics`, no auto-deletion yet). Two new endpoints back the sparklines: `GET /metrics/hyperviseur/:id/history` and `GET /metrics/storage/:id/history` (`?hours=`, default 24, max 720). A third endpoint, `GET /stats/history`, returns aggregate trends (avg CPU/RAM, total capacity, etc.) across all hypervisors/storage — not yet wired into a chart on any page, available for future use.

## 13. Running the monitoring side (PowerShell)

One script starts the always-on collectors:

```powershell
.\scripts\StartAllMonitors.ps1
```

This waits for the backend's `/health` to respond, then launches four background processes: `SimplePing.ps1` (ping sweep), `CollectSwitchBandwidth.ps1`, `CollectSwitchMetrics.ps1`, `CollectServerMetricsV2.ps1`. That's it — nothing else runs automatically.

**Not included in `StartAllMonitors.ps1` — run/schedule these separately:**

```powershell
# One-off or scheduled (e.g. daily via Task Scheduler) — see script header for -Action backup/restore/list
.\scripts\BackupManager.ps1 backup

# Continuous loop, like the other monitors — needs its own background process/service
.\scripts\AlertManager.ps1
```

```powershell
# Only once real credentials are available (not yet configured)
.\scripts\CollectHyperviseurInfo.ps1 -VCenterHost "vcenter.semmaris.local" -VCenterUser "administrator@vsphere.local" -VCenterPass "..."
.\scripts\CollectStorageInfo.ps1 -StorageHosts @("192.168.x.x") -ApiUser "manage" -ApiPass "..."
```

All of these read shared settings from `scripts/config.json` (API URL, ingest key, poll interval, switch list, alert debounce/webhook — see that file for the full list). It's gitignored now; never commit it.

## 14. Quick-start checklist

1. `docker compose up` (or run backend/frontend separately) — see root `.env.example` for required secrets.
2. Log in as admin, change the default seed password.
3. Add equipment via Panel Admin (manually, CSV, or `.xlsx` import) — cameras/switches/PCs/servers need real IPs for ping monitoring to mean anything.
4. Run `.\scripts\StartAllMonitors.ps1` on a machine with network access to that equipment.
5. Once you have vCenter/ESXi and/or Seagate credentials, run the VMware/Storage collectors to populate those pages.
6. Set `scripts/config.json:webhookUrl` and run `AlertManager.ps1` if you want alerting.
7. Schedule `BackupManager.ps1 backup` (Task Scheduler, daily).
