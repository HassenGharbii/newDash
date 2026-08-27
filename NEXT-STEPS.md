# NEXT STEPS — SEMMARIS DASHBOARD

Derived from `AUDIT-ETAT-REEL.md` and `CLAIMS-DONE-VS-NOT-DONE.md`. Organized as: things blocked on external input, then fixes (restore claimed baseline), then real feature builds (greenfield), then cleanup. Nothing here has been done yet — this is a plan only.

---

## 0. Blocked on input from you / Semmaris IT

Can't proceed on these without real values — do not fabricate them:

- [ ] vCenter host/user/pass, **or** ESXi host IP(s) + user/pass, for `CollectHyperviseurInfo.ps1`
- [ ] Seagate storage IP(s), SMC user/pass, SNMP community for `CollectStorageInfo.ps1`
- [ ] Confirmation that equipment records of type `Hyperviseur` / `Stockage` exist in the DB with correct IPs (or approval to create them)
- [ ] Real production API URL/IP to put in `docker-compose.yml` `VITE_API_URL` (currently `localhost:4000`)
- [ ] Real deployed install path on the server (for the `BackupManager.ps1` scheduled-task command and any doc examples)
- [ ] Desired backup destination + retention policy (days/count to keep)
- [ ] Desired alert webhook target (Teams/Slack/email?) and alert rules (what should trigger an alert)
- [ ] Confirmation on retention policy for new historical-metrics tables, once built (collectors running every minute grow tables fast)

---

## 1. Urgent security fixes (do first, independent of everything else)

- [ ] Rotate the real `adminPassword` / `ingestKey` values currently sitting in `scripts/config.json` (they're exposed in git history)
- [ ] Add `scripts/config.json` to `.gitignore`
- [ ] Untrack it going forward: `git rm --cached scripts/config.json`
- [ ] Decide separately whether to purge the secret from git history (destructive, rewrites history — needs your explicit go-ahead before I touch it)
- [ ] Ensure `JWT_SECRET` / `INGEST_KEY` are set via real env vars in production compose, not left on the hard-coded dev defaults (`'devsecret-dev-only'`, `'dev-ingest-key'`)
- [ ] Replace/force-change the hard-coded seed passwords (`admin123`/`user123`) for the default admin/user accounts
- [ ] Remove the hard-coded Seagate default password (`"!manage"`) as a fallback in `CollectStorageInfo.ps1` — require it to be supplied explicitly

## 2. Fix things the doc claims already work but don't (restore claimed baseline)

- [ ] `CollectSwitchBandwidth.ps1`: point `SnmpWalk.exe` lookup at `$PSScriptRoot`-relative path instead of hard-coded `C:\Users\Axone\...`; get an actual `SnmpWalk.exe` placed at `scripts\SnmpWalk\`
- [ ] `StartAllMonitors.ps1`: replace hard-coded `C:\Users\Axone\Documents\...` and hard-coded IP `10.8.11.230` with `$PSScriptRoot` + configurable API URL
- [ ] `docker-compose.yml`: `ping-monitor`/`bandwidth-monitor` services point at `PingEquipment.ps1`/`BandwidthMonitor.ps1`, which don't exist — either create them or repoint compose at the real scripts (e.g. `SimplePing.ps1`, `CollectSwitchBandwidth.ps1`)
- [ ] Remove the 7 remaining `[DEBUG]` `console.log` calls in the `GET /equipment` handler (`backend/src/index.js`)
- [ ] Fix PowerShell-7-only `??` operator usage in `CollectHyperviseurInfo.ps1` and `CollectStorageInfo.ps1` — either rewrite for PS 5.1 compatibility or confirm the collector host actually runs PowerShell 7+
- [ ] Once you provide it, update `VITE_API_URL` in `docker-compose.yml` to the real production URL

## 3. Build historical metrics (this is new work, not a fix)

- [ ] DB schema: add `hyperviseur_metrics` and `storage_metrics` tables, indexed on `(equipment_id, timestamp)`
- [ ] Confirm retention policy with you before adding any auto-deletion
- [ ] `POST /ingest/hyperviseur` / `POST /ingest/storage`: insert a history row in addition to the existing `equipment.info_json` update
- [ ] Add `GET /metrics/hyperviseur/:id/history` (time-range param, chronological order, capped row count)
- [ ] Add `GET /metrics/storage/:id/history` (same)
- [ ] Add `GET /stats/history` — needs scope clarified (what aggregate is it supposed to show?)
- [ ] Frontend: build a reusable SVG sparkline component
- [ ] `VMware.jsx`: historical section using sparklines for CPU%, RAM%, VM count
- [ ] `Storage.jsx`: historical section using sparklines for Capacity%, Capacity TB, Failed disks
- [ ] Decide the actual empty-state copy (doc wants `"Pas encore de données"`; existing pages use different French empty-state strings — worth being consistent)

## 4. Build Backup (currently a 0-byte file, not "rewritten")

- [ ] Define scope: back up the SQLite DB (`backend/data/app.db`) at minimum — confirm if `scripts/config.json` or anything else should be included
- [ ] Confirm destination path + retention policy with you
- [ ] Implement `BackupManager.ps1` (`backup` command at minimum; `restore` if useful)
- [ ] Provide `Register-ScheduledTask` instructions using the real deployed path, not a placeholder

## 5. Build Alerting (currently a 0-byte file, not "rewritten")

- [ ] Define alert rules: what conditions trigger an alert (equipment down via ping? bandwidth threshold? VMware/storage health?)
- [ ] Define webhook target/config format read from `scripts/config.json`
- [ ] Implement dedup/cooldown so persistent failures don't spam
- [ ] Implement recovery notification (equipment back up)
- [ ] Decide whether the frontend alert UI (`AlertSystem.jsx`/`AlertIndicator.jsx`, currently empty stubs and not imported) should actually be wired up, or if webhook-only alerting is sufficient

## 6. Equipment / Admin panel gaps

- [ ] Make `Hyperviseur`/`Stockage` selectable in the Admin Panel's manual add/edit form (currently limited to `Server/Switch/Camera/PC`)
- [ ] Fix CSV import silently downgrading unrecognized types to `PC` — either extend the allowed list or reject/warn instead
- [ ] Once VMware/Storage credentials are available, verify equipment records exist with correct type + IP + `Localisation` (needed before those collectors can populate anything)

## 7. Configuration management (externalize secrets/IPs)

- [ ] Ensure `docker-compose.yml` reads `JWT_SECRET`/`INGEST_KEY` from an untracked `.env`, not defaults
- [ ] Externalize the ~90 hard-coded switch IPs in `CollectSwitchBandwidth.ps1` into `scripts/config.json` or the equipment inventory instead of source
- [ ] Decide which of the duplicate scripts are canonical and retire the rest (see below) — don't delete anything without confirming which one is actually in use

## 8. Cleanup / accuracy (low urgency, do once the above stabilizes)

- [ ] Correct `README.md` so documented API routes and DB schema match the real code
- [ ] Decide fate of `SitePlan.jsx` (orphaned — only reachable through unused `App.jsx`): delete, or wire it into the real router?
- [ ] Decide fate of `App.jsx` itself (dead entry point superseded by `main.jsx`)
- [ ] Pick one server collector (`CollectServerInfo.ps1` / `CollectServerMetrics.ps1` / `CollectServerMetricsV2.ps1`) and retire the others
- [ ] Pick one switch-metrics collector (`CollectSwitchMetrics.ps1` / `CollectSwitchMetrics-Native.ps1`) and retire the other
- [ ] Pick one "start everything" script (`StartAllMonitors.ps1` / `StartMonitors.ps1`) and retire the other
- [ ] Delete or finish `CollectSwitchInfo.ps1.broken` and the "temporary simplified" `CollectSwitchInfo.ps1`
- [ ] Clarify what `AutomationManager.ps1 -Task alerts` is supposed to do, since it currently has no link to `AlertManager.ps1`

## 9. Validation after each phase

- Backend: startup, DB init, auth, ingestion endpoints, new history endpoints
- Frontend: build, login, dashboard, admin panel, VMware, Storage, PCA/PRA, historical charts
- Docker: `docker compose build && docker compose up`, frontend-to-backend connectivity, all 4 services actually starting
- Scripts: PowerShell syntax check on the version of PowerShell actually deployed, config loading, API connectivity, error handling

---

## Suggested order

1. **Phase 1 (security)** — no dependencies, should happen regardless of anything else.
2. **Phase 2 (fix-the-broken-baseline)** — restores what the doc already assumed was true; unblocks Docker and switch-bandwidth collection.
3. **Phases 3–5 (historical metrics, backup, alerting)** — each is real greenfield work; worth confirming scope with you individually before I build, since the doc's description of each was aspirational and the actual requirements (retention, alert rules, webhook target) aren't fully specified anywhere.
4. **Phases 6–8** — equipment/config/cleanup, lower urgency, can interleave with 3–5.

Let me know which phase to start with, or if you want to reorder.
