# Monitors — Guide d'utilisation

Ce fichier explique comment builder et démarrer les services de monitoring (ping et bande passante) de façon propre.

## Principe
- Les scripts de monitoring se trouvent dans `./scripts/` : `PingEquipment.ps1` et `BandwidthMonitor.ps1`.
- Une image Docker `semmaris/monitors` est construite à partir de `docker/monitor/Dockerfile` et contient ces scripts.
- `docker-compose.yml` lance deux services distincts (`ping-monitor`, `bandwidth-monitor`) qui utilisent cette image.

## Démarrer (recommandé)
1. Depuis la racine du projet :

```powershell
cd 'C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre'
docker-compose up -d --build
```

2. Vérifier les conteneurs :

```powershell
docker-compose ps
```

3. Consulter les logs :

```powershell
# Ping monitor
docker logs -f $(docker ps --filter "name=ping-monitor" --format "{{.Names}}")

# Bandwidth monitor
docker logs -f $(docker ps --filter "name=bandwidth-monitor" --format "{{.Names}}")
```

## Rebuild de l'image monitors
- Si vous modifiez les scripts, reconstruisez l'image :

```powershell
docker-compose build --no-cache ping-monitor bandwidth-monitor
docker-compose up -d
```

## Paramètres et tuning
- `PingEquipment.ps1` lit d'abord `scripts/config.json` puis peut être surchargé par les variables d'environnement :
  - `API_URL` ou `API_BASE` — URL de l'API back-end (ex: `http://api:4000`)
  - `INGEST_KEY` — clé d'ingestion
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — identifiants pour l'API

- `BandwidthMonitor.ps1` accepte les options suivantes (ligne de commande) :
  - `-ApiUrl` : URL de l'API
  - `-ApiKey` : clé d'ingestion
  - `-IntervalSeconds`, `-Samples`, `-SampleIntervalSec`, `-SignificantChangePercent`, `-HeartbeatSeconds`

## Exécution hors-container (développement)
- Pour lancer localement (PowerShell Core) :

```powershell
pwsh .\scripts\BandwidthMonitor.ps1 -ApiUrl 'http://10.8.11.230:4000' -ApiKey 'change-me-strong'

# ou (PowerShell 5.1)
.\scripts\PingEquipment.ps1
```

## Emplacement des états
- Les états de debounce/heartbeat sont stockés sous `./scripts/state/` (fichiers JSON). Ils permettent de réduire les faux positifs.

## Option alternative
- Si vous préférez exécuter les scripts comme tâches planifiées Windows, je peux fournir un script PowerShell pour créer une Scheduled Task qui exécute les scripts en continu.

---

Si vous voulez, je peux aussi :
- Ajouter des `healthcheck` Docker pour `ping-monitor` et `bandwidth-monitor`.
- Fournir un petit `Makefile` ou `ps1` pour simplifier les commandes de build/restart.
