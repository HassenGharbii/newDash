# SEMMARIS DASHBOARD — CONTEXT & CONTINUATION INSTRUCTIONS FOR CLAUDE CODE

## 1. Mission

You are continuing development of the **Semmaris internal infrastructure monitoring Dashboard**.

Do not rebuild the application from scratch.

First inspect the existing repository, understand the current architecture and implementation, then continue from the existing state while preserving working functionality.

The application is an internal web dashboard accessible from browsers on the Semmaris network. It centralizes monitoring of:

- Cameras
- Switches
- PCs
- Servers
- Hypervisors / VMware
- Storage systems
- PCA/PRA infrastructure

The application runs on an internal Semmaris server and has no cloud dependency.

Windows PowerShell monitoring scripts run in the network and periodically send collected data to the backend API.

---

## 2. Current Architecture

Before changing anything, inspect the repository and confirm the actual implementation.

Expected architecture:

### Backend
- Node.js
- Express
- Database-backed REST API
- PostgreSQL or the database already configured in the repository
- Authentication using JWT
- Ingestion endpoints used by PowerShell monitoring scripts

### Frontend
- React
- Existing views/components already implemented
- Dashboard pages for monitoring and administration
- VMware and Storage historical charts/sparklines

### Monitoring
PowerShell scripts collect information from infrastructure and send it to the backend.

Important scripts include:

- `scripts/StartAllMonitors.ps1`
- `scripts/CollectHyperviseurInfo.ps1`
- `scripts/CollectStorageInfo.ps1`
- `scripts/CollectSwitchBandwidth.ps1`
- `scripts/BackupManager.ps1`
- `scripts/AlertManager.ps1`

### Deployment
- Docker / docker-compose
- Frontend is built and deployed through Docker
- Backend API is exposed internally

Do not assume exact ports, environment variables, database configuration, or Docker service names. Read the repository first.

---

# 3. FUNCTIONALITY ALREADY IMPLEMENTED

The following functionality should be considered existing functionality and must not be broken.

## Authentication / users

Supported roles:

- Admin
- User
- SGM

Login and account management are operational.

Preserve the existing authentication flow unless a bug requires modification.

---

## Infrastructure monitoring

Ping monitoring is operational for:

- Cameras
- Switches
- PCs
- Servers

The dashboard displays availability/status information.

Do not replace this implementation unnecessarily.

---

## Switch bandwidth

SNMP bandwidth monitoring for switches is operational.

Existing PowerShell/SNMP implementation should be preserved.

`CollectSwitchBandwidth.ps1` previously contained an absolute path to `SnmpWalk.exe`; it was changed to use `$PSScriptRoot`.

Verify this implementation instead of reverting to hard-coded paths.

Expected location:

`scripts\SnmpWalk\`

Verify that `SnmpWalk.exe` exists there.

---

## Equipment inventory

Admin panel supports:

- Equipment inventory
- Excel import
- CRUD operations
- Equipment types
- IP addresses
- Locations
- Equipment metadata

This is important because VMware, Storage and PCA/PRA monitoring depend on equipment records.

Do not bypass the existing inventory system.

---

## Global availability statistics

Global availability statistics are already implemented.

Preserve them.

---

# 4. EXISTING PAGES

The following pages exist:

- Dashboard
- Equipment / Inventory
- VMware
- Storage
- PCA/PRA
- Administration
- Other existing pages discovered in the repository

VMware, Storage and PCA/PRA interfaces already exist.

The important distinction is:

**The UI is developed, but some pages currently contain no data because the infrastructure credentials/configuration have not been provided.**

Do not interpret an empty page automatically as a frontend bug.

---

# 5. HISTORICAL METRICS ALREADY IMPLEMENTED

A recent version added historical time-series support.

Backend tables:

- `hyperviseur_metrics`
- `storage_metrics`

The following backend endpoints were added:

- `POST /ingest/hyperviseur`
- `POST /ingest/storage`
- `GET /metrics/hyperviseur/:id/history`
- `GET /metrics/storage/:id/history`
- `GET /stats/history`

The ingestion endpoints now save historical metrics.

Frontend:

### `frontend/src/views/VMware.jsx`

Contains historical section with SVG sparklines for:

- CPU %
- RAM %
- VMs

### `frontend/src/views/Storage.jsx`

Contains historical section with SVG sparklines for:

- Capacity %
- Capacity in TB
- Failed disks

If history is empty, the UI should display something equivalent to:

`Pas encore de données`

This is expected until monitoring scripts have run successfully.

Do not remove this historical functionality.

---

# 6. RECENT CODE CHANGES

These changes have already been made.

## `backend/src/index.js`

- Added `hyperviseur_metrics`
- Added `storage_metrics`
- Added historical ingestion
- Added historical API endpoints
- Added `/stats/history`
- Removed six `[DEBUG]` console logs

## `frontend/src/views/VMware.jsx`

Added historical sparklines.

## `frontend/src/views/Storage.jsx`

Added historical sparklines.

## Removed files

The following orphaned files were removed:

- `frontend/src/views/SafeKit.jsx`
- `frontend/src/views/SitePlan.jsx`

Do not recreate them unless the repository demonstrates they are actually required.

## PowerShell

`StartAllMonitors.ps1`

- Changed hard-coded `C:\Users\Axone\...` paths
- Uses `$PSScriptRoot`

`CollectSwitchBandwidth.ps1`

- Uses `$PSScriptRoot` for `SnmpWalk.exe`

`BackupManager.ps1`

- Was empty
- Has been completely rewritten

`AlertManager.ps1`

- Was empty
- Has been completely rewritten

## `.gitignore`

`scripts/config.json` was added to `.gitignore`.

Credentials must NEVER be committed to Git.

## Docker

`docker-compose.yml`

- `VITE_API_URL` was corrected to point to the production API IP.

## README

README was updated with:

- API routes
- Database schema
- Ports
- Component names
- Monitoring scripts

---

# 7. CURRENTLY EMPTY FUNCTIONALITY

## VMware

The VMware page is empty because the PowerShell collector has no configured hypervisor/vCenter target.

This is primarily a configuration problem.

Expected configuration modes:

### Recommended: vCenter

Parameters:

- `VCENTER_HOST`
- `VCENTER_USER`
- `VCENTER_PASS`

Example:

`administrator@vsphere.local`

### Direct ESXi

Parameters:

- `ESXiHosts`
- `ESXI_USER`
- `ESXI_PASS`

VMware PowerCLI may need to be installed:

```powershell
Install-Module -Name VMware.PowerCLI -Scope CurrentUser
```

Example collector execution:

```powershell
.\scripts\CollectHyperviseurInfo.ps1 `
    -VCenterHost "vcenter.semmaris.local" `
    -VCenterUser "administrator@vsphere.local" `
    -VCenterPass "VOTRE_MOT_DE_PASSE" `
    -ApiUrl "http://10.8.11.230:4000" `
    -IngestKey "VOTRE_INGEST_KEY"
```

IMPORTANT:

Do not hard-code credentials.

Use the existing configuration mechanism discovered in the repository.

Also verify that equipment records of type `Hyperviseur` exist in the database with the correct IP addresses.

---

# 8. STORAGE / SEAGATE

Storage page is empty because `CollectStorageInfo.ps1` has no configured Seagate storage targets.

Expected parameters:

- `StorageHosts`
- `ApiUser`
- `ApiPass`
- `SnmpCommunity`
- `DashboardApiUrl`
- `IngestKey`

Example:

```powershell
.\scripts\CollectStorageInfo.ps1 `
    -StorageHosts @("192.168.x.x") `
    -ApiUser "manage" `
    -ApiPass "VOTRE_MOT_DE_PASSE_SMC" `
    -SnmpCommunity "VOTRE_COMMUNITY" `
    -DashboardApiUrl "http://10.8.11.230:4000" `
    -IngestKey "VOTRE_INGEST_KEY"
```

Do not assume the example credentials are still valid.

Verify actual configuration and never commit secrets.

Also verify that equipment records of type `Stockage` exist with the correct IP addresses.

---

# 9. PCA / PRA

The PCA/PRA page groups equipment according to the `Localisation` field.

Recognized tags:

- `PCA1`
- `PCA2`
- `PRA`

Expected display:

| Localisation tag | Dashboard site |
|---|---|
| PCA1 | PCA Site 1 |
| PCA2 | PCA Site 2 |
| PRA | PRA |

Detection should be case-insensitive.

Example:

`Salle réseau PCA1 Baie 3`

should be classified as:

`PCA Site 1`

The system should not require the entire Localisation field to equal the tag.

If PCA/PRA appears empty, inspect equipment data first.

---

# 10. BACKUP

`BackupManager.ps1` is implemented but must be scheduled.

Expected Windows Scheduled Task:

```powershell
$action = New-ScheduledTaskAction -Execute "pwsh.exe" `
    -Argument "-NonInteractive -File C:\...\scripts\BackupManager.ps1 backup"

$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"

Register-ScheduledTask `
    -TaskName "Semmaris-Backup" `
    -Action $action `
    -Trigger $trigger `
    -RunLevel Highest
```

Do not blindly use `C:\...`.

Determine the real deployed path from the server/repository.

---

# 11. ALERTING

`AlertManager.ps1` exists and has been rewritten.

There is an expected webhook configuration in:

`scripts/config.json`

Do not commit real credentials, tokens, or webhook URLs.

Before modifying alerting, inspect:

- config structure
- current alert rules
- backend endpoints
- expected payload
- retry/error handling
- how alerts are consumed by the dashboard

---

# 12. IMPORTANT SECURITY REQUIREMENTS

This is an internal infrastructure monitoring application.

Security is important.

Before making changes:

1. Inspect authentication implementation.
2. Inspect JWT handling.
3. Inspect ingestion authentication.
4. Inspect CORS.
5. Inspect API exposure.
6. Inspect database credentials.
7. Inspect Docker environment variables.
8. Search for hard-coded secrets.
9. Search for hard-coded internal IPs that should be configurable.
10. Search Git history/current files for credentials.

Immediate production requirements:

- Change `JWT_SECRET`
- Change `INGEST_KEY`
- Change default admin password

Never put credentials directly in source code.

Never put credentials into documentation examples if they are real.

Use placeholders such as:

`VOTRE_MOT_DE_PASSE`

---

# 13. WHAT CLAUDE CODE MUST DO FIRST

Before coding:

## Step 1 — Inspect repository

Understand:

- directory structure
- frontend architecture
- backend architecture
- database
- Docker
- PowerShell scripts
- configuration
- authentication
- API routes

Do not start modifying files immediately.

---

## Step 2 — Run the application

Start the application using the repository's existing documented method.

Check:

- frontend loads
- backend starts
- database connects
- authentication works
- API works
- Docker services start

Record any errors.

---

## Step 3 — Verify existing features

Test:

- Login
- Roles
- Dashboard
- Equipment CRUD
- Excel import
- Ping monitoring
- Switch bandwidth
- VMware page
- Storage page
- PCA/PRA page
- Historical charts

Do not rewrite working functionality.

---

# 14. NEXT DEVELOPMENT PRIORITIES

Work in this order.

## PRIORITY 1 — Production stability

Fix any build/runtime errors.

Check:

- frontend build
- backend startup
- Docker
- database initialization
- migrations/schema
- API connectivity

---

## PRIORITY 2 — Configuration management

Improve configuration so that:

- IP addresses are configurable
- credentials are externalized
- ingestion keys are externalized
- JWT secret is externalized
- webhook configuration is externalized

Do not introduce unnecessary architecture changes.

---

## PRIORITY 3 — VMware collector

Make sure:

1. Collector can connect to vCenter.
2. Collector retrieves hypervisor metrics.
3. Collector maps data to inventory equipment.
4. Collector sends data to `/ingest/hyperviseur`.
5. Backend stores current data.
6. Backend stores historical data.
7. VMware page displays current data.
8. VMware history displays after multiple successful collections.

Add clear logs for connection failures, authentication failures and unknown equipment.

Do not log passwords or tokens.

---

## PRIORITY 4 — Storage collector

Make sure:

1. Collector connects to Seagate SMC.
2. SNMP fallback works if intended by existing implementation.
3. Storage is mapped to inventory.
4. Data is sent to `/ingest/storage`.
5. Current metrics are updated.
6. Historical metrics are stored.
7. Storage page displays data.
8. Historical charts display data.

---

## PRIORITY 5 — PCA/PRA

Verify:

- tagging logic
- grouping
- empty state
- equipment assignment
- case-insensitive detection

Add useful UI feedback when no equipment is assigned to a site.

---

## PRIORITY 6 — Backup

Verify:

- backup actually runs
- backup destination exists
- errors are reported
- old backups are handled according to the existing policy
- scheduled task instructions are correct

Do not delete backups automatically unless the existing requirements specify retention.

---

## PRIORITY 7 — Alerting

Verify the AlertManager implementation.

It should not generate duplicate alerts continuously for the same persistent failure.

If appropriate, implement:

- alert state
- recovery notification
- cooldown/debounce
- error handling
- webhook retry

Only implement behavior consistent with the existing application's requirements.

---

# 15. CODE QUALITY RULES

When continuing the project:

- Prefer small, focused changes.
- Do not rewrite the whole application.
- Reuse existing components.
- Reuse existing API patterns.
- Reuse existing database connection logic.
- Reuse existing authentication.
- Avoid introducing new dependencies unless necessary.
- Keep frontend and backend behavior consistent.
- Handle API failures gracefully.
- Add useful error messages.
- Remove debug logging from production code.
- Do not expose secrets.
- Do not silently swallow errors.

When adding a feature, update README/documentation if the behavior or deployment procedure changes.

---

# 16. DATABASE RULES

Before changing the database:

1. Inspect current schema.
2. Inspect initialization/migrations.
3. Determine whether the application uses migrations or startup table creation.
4. Preserve existing data.
5. Avoid destructive schema changes.
6. Add indexes when historical queries require them.
7. Check retention requirements for time-series metrics.

For historical metrics, consider the expected data volume.

If collectors run every minute, historical tables can grow quickly.

Do not add aggressive retention/deletion without confirming the requirement.

---

# 17. API RULES

Before adding an endpoint:

- inspect existing route conventions
- inspect authentication middleware
- inspect error response format
- inspect request validation
- inspect existing ingestion authentication

For ingestion endpoints:

- validate `IngestKey`
- validate payload
- reject malformed data
- do not expose credentials
- return useful HTTP status codes

For history endpoints:

- support sensible time ranges
- avoid loading unlimited historical data
- order data chronologically
- handle missing data cleanly

---

# 18. FRONTEND RULES

The dashboard is an internal monitoring tool.

UI should prioritize:

- clarity
- operational status
- fast loading
- readable metrics
- useful empty states
- useful error states
- responsive layout

Do not replace the current visual design without a clear reason.

For empty monitoring pages, distinguish between:

- no configuration
- collector offline
- API error
- no historical data
- equipment not found

Do not simply display an empty screen.

---

# 19. IMPORTANT DEBUGGING APPROACH

When a monitoring page is empty:

Do NOT immediately modify the frontend.

Trace the complete pipeline:

```text
Infrastructure
      ↓
PowerShell collector
      ↓
Network/API connection
      ↓
Ingest endpoint
      ↓
Database
      ↓
GET metrics endpoint
      ↓
React page
      ↓
Dashboard
```

Find where the data stops.

For VMware:

```text
vCenter/ESXi
 → CollectHyperviseurInfo.ps1
 → /ingest/hyperviseur
 → hypervisor current data
 → hyperviseur_metrics
 → GET /metrics/hyperviseur/:id/history
 → VMware.jsx
```

For Storage:

```text
Seagate SMC/SNMP
 → CollectStorageInfo.ps1
 → /ingest/storage
 → storage current data
 → storage_metrics
 → GET /metrics/storage/:id/history
 → Storage.jsx
```

---

# 20. TESTING EXPECTATIONS

After modifications, test at minimum:

### Backend
- startup
- database connection
- authentication
- ingestion endpoints
- history endpoints
- stats endpoint

### Frontend
- build
- login
- dashboard
- admin panel
- VMware
- Storage
- PCA/PRA

### Scripts
- PowerShell syntax
- configuration loading
- API connectivity
- error handling

### Docker
- build
- startup
- frontend-to-backend connectivity

---

# 21. DO NOT DO THESE THINGS

Do NOT:

- rewrite the project from scratch
- replace React with another framework
- replace Node/Express without a strong reason
- replace the database without a strong reason
- remove existing working monitoring
- remove existing authentication
- hard-code production credentials
- commit `scripts/config.json` if it contains secrets
- expose internal infrastructure publicly
- assume VMware or Seagate credentials
- assume example IP addresses are real
- delete historical data without confirmation
- make destructive database migrations
- hide errors behind empty UI states

---

# 22. CURRENT EXTERNAL DEPENDENCIES / INFORMATION NEEDED FROM IT

Some functionality cannot be fully validated without infrastructure information.

Needed from Semmaris IT:

### VMware

Either:

- vCenter IP/FQDN + credentials

or:

- ESXi IPs + credentials

### Storage

- Seagate Exos IPs
- SMC credentials
- SNMP community if SNMP fallback is used

### PCA/PRA

- equipment/site mapping

### Monitoring

- confirmation that required network ports are reachable
- confirmation that the Windows monitoring host can access infrastructure
- confirmation that `SnmpWalk.exe` exists

Do not fabricate these values.

---

# 23. EXPECTED DELIVERABLE FROM CLAUDE CODE

At the end of the work, provide:

## Changes made

List every important modified file.

## Features completed

List features that are now working.

## Bugs fixed

List bugs discovered and fixed.

## Configuration required

List values that must still be provided by Semmaris IT.

## Commands

Provide exact commands to:

- build
- run
- deploy
- test collectors
- run database changes if any
- schedule backup

## Remaining limitations

Clearly state anything that cannot be tested because infrastructure credentials or network access are unavailable.

---

# 24. FINAL INSTRUCTION

You are the development agent continuing an existing production-oriented project.

Your first priority is to understand the existing implementation.

Then:

1. Run it.
2. Test it.
3. Identify what is actually broken.
4. Fix the highest-priority issues.
5. Complete VMware/Storage data pipelines when configuration is available.
6. Verify historical metrics.
7. Verify PCA/PRA grouping.
8. Verify backups.
9. Verify alerts.
10. Improve reliability/security without unnecessary rewrites.

Always prefer **evidence from the repository and runtime behavior over assumptions**.

If something is missing because external credentials or infrastructure access is required, report it clearly instead of inventing a solution.
