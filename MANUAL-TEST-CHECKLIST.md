# Manual Test Checklist — Changes From This Session

Run through this after building, to verify everything we added/fixed actually works on your machine. Two build paths are covered — pick whichever you use.

---

## 0. Build

**Local (no Docker) — what we used during development:**
```powershell
cd backend; npm install; node src/index.js
cd frontend; npm install; npm run build; npm run preview   # or: npm run dev
```

**Docker:**
```powershell
docker compose build
docker compose up -d
docker compose ps
```
Expect `api`, `frontend` to come up healthy. **`bandwidth-monitor` will still exit/crash** — `CollectSwitchBandwidth.ps1` shells out to `SnmpWalk.exe`, a Windows binary, which cannot run inside the Linux-based `powershell:latest` image regardless of the path fix we made. That's expected, not a new regression; run bandwidth collection on the Windows monitoring host via `StartAllMonitors.ps1` instead. `ping-monitor` should start fine (`SimplePing.ps1` is pure PowerShell/HTTP).

Note: `scripts/config.json` is now gitignored — if you're building on a fresh clone (not this working copy), you must create it manually first (see `scripts/config.json` here as a template) or the `ping-monitor`/`bandwidth-monitor` images will fail with "config.json introuvable".

---

## 1. Config & secrets sanity check

- [ ] `git status` shows `scripts/config.json` as untracked-going-forward (already removed from the index) and `.env`/`.env.example` present — `.env` should NOT show up in `git status` as trackable.
- [ ] Start the backend and confirm **no warnings** are printed about `JWT_SECRET`/`INGEST_KEY`/`ADMIN_SEED_PASSWORD` defaults (they only appear if those env vars are missing).
- [ ] Start it again with the env vars unset and confirm the warnings **do** appear (proves the check works):
  ```powershell
  cd backend
  $env:JWT_SECRET=""; $env:INGEST_KEY=""; $env:ADMIN_SEED_PASSWORD=""
  node src/index.js
  # expect: [WARN] JWT_SECRET is not set ... / INGEST_KEY is not set ... / ADMIN_SEED_PASSWORD is not set ...
  ```

## 2. Login with rotated credentials

- [ ] Open the frontend, log in with `admin@semmaris.local` and the password from `.env`'s `ADMIN_SEED_PASSWORD` (only works against a **fresh** `backend/data/app.db` — if a DB already exists, the old password is still active until changed via Panel Admin).
- [ ] Confirm Admin sees "Panel Admin" in the sidebar; log in as the seeded user account and confirm it does not.

## 3. Admin Panel — Hyperviseur/Stockage type fix

- [ ] Panel Admin → add equipment manually → type dropdown now includes **Hyperviseur** and **Stockage** (previously missing). Save one of each, confirm they appear in the equipment list with the correct type.
- [ ] Create a small CSV: `name,ip,type\nTestHV,10.0.0.50,Hyperviseur\nTestStorage,10.0.0.51,Stockage` → import it via Panel Admin's CSV import → confirm both rows land with type `Hyperviseur`/`Stockage`, **not** downgraded to `PC` (that was the bug).

## 4. Historical metrics + sparklines (the main new feature)

Simulate what a collector script would send, using curl (or Postman). Replace the ingest key with the value in `scripts/config.json`.

```bash
BASE=http://localhost:4000
KEY=<value of ingestKey from scripts/config.json>

# Ingest two hypervisor samples a few seconds apart, values must differ so the sparkline isn't flat
curl -s -X POST $BASE/ingest/hyperviseur -H "Content-Type: application/json" -H "x-ingest-key: $KEY" \
  -d '{"hostname":"esxi-manual-test","ip":"10.0.0.60","status":"connected","cpu_usage_pct":30,"memory_usage_pct":40,"vm_total":5,"vm_running":4}'

curl -s -X POST $BASE/ingest/hyperviseur -H "Content-Type: application/json" -H "x-ingest-key: $KEY" \
  -d '{"hostname":"esxi-manual-test","ip":"10.0.0.60","status":"connected","cpu_usage_pct":55,"memory_usage_pct":48,"vm_total":5,"vm_running":5}'

# Same for storage
curl -s -X POST $BASE/ingest/storage -H "Content-Type: application/json" -H "x-ingest-key: $KEY" \
  -d '{"name":"seagate-manual-test","ip":"10.0.0.61","overall_status":"OK","capacity_total_tb":50,"capacity_used_tb":10,"disks_failed":0}'

curl -s -X POST $BASE/ingest/storage -H "Content-Type: application/json" -H "x-ingest-key: $KEY" \
  -d '{"name":"seagate-manual-test","ip":"10.0.0.61","overall_status":"OK","capacity_total_tb":50,"capacity_used_tb":14,"disks_failed":1}'
```

- [ ] **API check** — log in via curl to get a token, then:
  ```bash
  TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"identifier":"admin@semmaris.local","password":"<your password>"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")
  curl -s "$BASE/equipment?type=Hyperviseur" -H "Authorization: Bearer $TOKEN"          # current state
  curl -s "$BASE/metrics/hyperviseur/<id>/history?hours=24" -H "Authorization: Bearer $TOKEN"   # 2 rows expected
  curl -s "$BASE/metrics/storage/<id>/history?hours=24" -H "Authorization: Bearer $TOKEN"        # 2 rows expected
  curl -s "$BASE/stats/history?hours=24" -H "Authorization: Bearer $TOKEN"               # aggregated trend
  ```
- [ ] **UI check** — open `/vmware`, select "esxi-manual-test" → the detail panel should show a "Historique (24h)" section with 3 small line charts (CPU %, RAM %, VMs) instead of "Pas encore de données". Same on `/stockage` for "seagate-manual-test" (Capacité %, Capacité To, Disques en défaut).
- [ ] With only **one** ingest instead of two, the sparkline area should show "Pas encore de données" (needs ≥2 points to draw a line) — worth confirming the empty state still works.

## 5. PowerShell script fixes

- [ ] Syntax-parse check (should print `OK` for all):
  ```powershell
  foreach ($f in 'BackupManager.ps1','AlertManager.ps1','CollectSwitchBandwidth.ps1','CollectHyperviseurInfo.ps1','CollectStorageInfo.ps1','StartAllMonitors.ps1') {
      $e=$null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "scripts\$f"), [ref]$null, [ref]$e) | Out-Null
      "$f : " + $(if ($e) { $e -join '; ' } else { 'OK' })
  }
  ```
- [ ] `CollectSwitchBandwidth.ps1` now reads its switch list from `scripts/config.json` (`switches` field) instead of a hardcoded array — edit/add an entry there and confirm the script picks it up (`Write-Host` at startup shows the switch count).
- [ ] `StartAllMonitors.ps1` no longer hard-codes `C:\Users\Axone\...` — run it from any location and confirm it resolves paths relative to its own folder (`$PSScriptRoot`).

## 6. BackupManager.ps1

```powershell
.\scripts\BackupManager.ps1 backup
.\scripts\BackupManager.ps1 list
# stop the backend first, then:
.\scripts\BackupManager.ps1 restore -RestoreFrom <folder-name-from-list>
```
- [ ] `backup` creates a timestamped folder under `backend/data/backups/` containing `app.db` (+ `-wal`/`-shm` if present).
- [ ] `list` shows it with a size.
- [ ] `restore` **fails with "user-mapped section open"** if the backend is still running — that's expected on Windows (SQLite mmap lock); stop the backend first and it succeeds, also creating a safety copy of the pre-restore state.

## 7. AlertManager.ps1

```powershell
# leave webhookUrl empty in config.json to just watch console output
.\scripts\AlertManager.ps1
```
- [ ] Make an equipment go down (e.g. ingest `status:"disconnected"` for a hypervisor, or unplug/stop pinging a real device) → within `debounceCount` poll cycles, expect a console line: `[ALERTE - webhook non configure] ALERTE: ...`
- [ ] Bring it back up → expect `[ALERTE - webhook non configure] RETABLI: ...`
- [ ] Set a real `webhookUrl` in `scripts/config.json` (e.g. a webhook.site test URL) and confirm the POST actually arrives there instead of just logging locally.
- [ ] Stop the script with Ctrl+C — it's an infinite loop by design, same pattern as the other monitors.

## 8. Docker-compose monitor fix (if using Docker)

```powershell
docker compose logs ping-monitor
docker compose logs bandwidth-monitor
```
- [ ] `ping-monitor` logs should show `SimplePing.ps1` actually starting (previously: "file not found" for `PingEquipment.ps1`).
- [ ] `bandwidth-monitor` logs should show `CollectSwitchBandwidth.ps1` starting and then failing on the `SnmpWalk.exe` call (Windows binary in Linux container) — not on a missing-file error like before. Confirms the fix landed even though the container still can't fully do its job (see §0).

---

## Cleanup after testing

- Delete the `esxi-manual-test` / `seagate-manual-test` equipment rows via Panel Admin (or `DELETE /equipment/:id`).
- Delete any test backup folders under `backend/data/backups/` you don't want to keep.
- If you tested with the env vars unset in §1, remember to restart the backend normally afterward.
