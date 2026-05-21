# Dashboard Semmaris V3

Tableau de bord de supervision de l'infrastructure IT de la Semmaris — équipements réseau, serveurs virtualisés VMware, baies de stockage Seagate Exos X, et sites PCA/PRA.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Fonctionnalités](#2-fonctionnalités)
3. [Technologies et architecture](#3-technologies-et-architecture)
4. [Structure du projet](#4-structure-du-projet)
5. [Installation et lancement](#5-installation-et-lancement)
6. [Workflow de développement (point critique Windows/Docker)](#6-workflow-de-développement-point-critique-windowsdocker)
7. [Rôles et comptes utilisateurs](#7-rôles-et-comptes-utilisateurs)
8. [Types d'équipements et pages associées](#8-types-déquipements-et-pages-associées)
9. [API Backend — endpoints documentés](#9-api-backend--endpoints-documentés)
10. [Base de données SQLite — schéma](#10-base-de-données-sqlite--schéma)
11. [Scripts PowerShell de monitoring](#11-scripts-powershell-de-monitoring)
12. [Monitoring VMware / ESXi](#12-monitoring-vmware--esxi)
13. [Monitoring Stockage Seagate Exos X](#13-monitoring-stockage-seagate-exos-x)
14. [Sites PCA / PRA](#14-sites-pca--pra)
15. [Gestion Docker](#15-gestion-docker)
16. [Sauvegarde et restauration](#16-sauvegarde-et-restauration)
17. [Déploiement en production](#17-déploiement-en-production)
18. [Dépannage](#18-dépannage)
19. [Points d'architecture importants pour les développeurs](#19-points-darchitecture-importants-pour-les-développeurs)

---

## 1. Vue d'ensemble

Le Dashboard Semmaris est une application web de supervision interne permettant de visualiser en temps réel l'état de l'ensemble de l'infrastructure IT :

- Équipements réseau (caméras IP, switches, PCs, serveurs physiques)
- Hyperviseurs VMware ESXi (CPU, RAM, VMs, datastores)
- Baies de stockage Seagate Exos X 5U84 (capacité, disques, contrôleurs, pools RAID)
- Sites de continuité PCA1, PCA2 et PRA

L'application est hébergée en interne sur le serveur Semmaris (`10.8.11.230`) et accessible via navigateur. Les données sont collectées par des scripts PowerShell qui tournent sur des postes ayant accès au réseau Semmaris, et sont envoyées à l'API via des requêtes HTTP.

---

## 2. Fonctionnalités

### Supervision réseau (V2)
- **Ping en temps réel** : état en ligne / hors ligne de chaque équipement
- **Bande passante** : trafic entrant/sortant par switch (SNMP)
- **Caméras** : liste, état, localisation
- **Switches** : liste, état, bande passante en temps réel
- **PCs** : liste et état de disponibilité
- **Serveurs physiques** : liste et état

### Supervision avancée (V3)
- **VMware / ESXi** : CPU%, RAM%, nombre de VMs actives/arrêtées, datastores (capacité, libre, utilisé) par host ESXi
- **Stockage Seagate Exos X 5U84** : capacité totale/libre, nombre de disques OK/défaillants, état des contrôleurs, pools RAID
- **PCA / PRA** : état des sites PCA1, PCA2 et PRA, vue par site, taux de disponibilité, réplication

### Administration
- **Authentification sécurisée** : JWT 30 jours, hashage bcrypt des mots de passe
- **Gestion des rôles** : Admin / User / SGM avec accès différenciés
- **Panel Admin** : création/modification/suppression d'utilisateurs et d'équipements
- **Import CSV/Excel** : ajout en masse d'équipements via fichier
- **Statistiques** : graphiques de performance et d'activité
- **Interface** thème rouge-noir Semmaris

---

## 3. Technologies et architecture

### Frontend
| Composant | Technologie |
|-----------|-------------|
| Framework | React 18 |
| Bundler | Vite |
| CSS | Tailwind CSS |
| Routing | React Router v6 |
| State global | Zustand |
| Serveur (prod) | nginx:alpine |

### Backend
| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js 20 |
| Framework | Express |
| Base de données | SQLite (better-sqlite3, mode WAL) |
| Auth | JWT (jsonwebtoken) |
| Hashage | bcryptjs |
| Fichiers | multer + xlsx |

### Infrastructure
| Composant | Technologie |
|-----------|-------------|
| Conteneurisation | Docker + Docker Compose |
| Monitoring | Scripts PowerShell 7+ |
| VMware | VMware PowerCLI |
| Stockage | API REST Seagate + fallback SNMP |
| Ping | ICMP via Test-Connection PowerShell |

### Flux de données

```
Postes Semmaris (accès réseau interne)
    │
    ├── CollectHyperviseurInfo.ps1  ──► POST /api/hyperviseur/ingest
    ├── CollectStorageInfo.ps1      ──► POST /api/storage/ingest
    ├── BandwidthMonitor.ps1        ──► POST /api/bandwidth/ingest
    └── PingEquipment.ps1           ──► POST /api/ping/ingest
                                            │
                                        API Express (port 4000)
                                            │
                                        SQLite (backend/data/app.db)
                                            │
                                        Frontend React (port 5173)
                                            │
                                        Navigateur utilisateur
```

---

## 4. Structure du projet

```
Dashboard-Semmaris-Base-Propre/
│
├── frontend/
│   ├── src/
│   │   ├── views/                  # Pages de l'application
│   │   │   ├── Login.jsx           # Page de connexion
│   │   │   ├── Home.jsx            # Accueil — résumé global
│   │   │   ├── Cameras.jsx         # Supervision caméras
│   │   │   ├── Switches.jsx        # Supervision switches
│   │   │   ├── PCs.jsx             # Supervision PCs
│   │   │   ├── Servers.jsx         # Supervision serveurs
│   │   │   ├── Bandwidth.jsx       # Bande passante switches
│   │   │   ├── VMware.jsx          # Hyperviseurs ESXi (V3)
│   │   │   ├── Storage.jsx         # Baies Seagate (V3)
│   │   │   ├── SafeKit.jsx         # Sites PCA/PRA (V3)
│   │   │   ├── Equipment.jsx       # Vue globale équipements
│   │   │   ├── Stats.jsx           # Statistiques
│   │   │   ├── AdminPanel.jsx      # Admin (users + équipements)
│   │   │   ├── HomeSGM.jsx         # Accueil rôle SGM
│   │   │   └── SitePlan.jsx        # Plan de site
│   │   ├── ui/
│   │   │   └── Layout.jsx          # Layout global (sidebar + header)
│   │   ├── store.js                # Zustand — état auth + équipements
│   │   ├── main.jsx                # Point d'entrée React Router ⚠️ VOIR §19
│   │   └── styles.css              # Thème rouge-noir Semmaris
│   ├── dist/                       # Build produit par npm run build (NE PAS COMMITTER)
│   ├── nginx.conf                  # Config nginx SPA fallback (port 5173)
│   ├── Dockerfile                  # nginx:alpine servant dist/
│   ├── .dockerignore               # Exclut node_modules, .env (garde dist/)
│   └── package.json
│
├── backend/
│   ├── src/
│   │   └── index.js                # Monolithe : API + migrations SQLite + auth
│   ├── data/
│   │   └── app.db                  # Base SQLite (persiste via volume Docker)
│   ├── Dockerfile
│   └── package.json
│
├── scripts/                        # Scripts PowerShell de monitoring et gestion
│   ├── CollectHyperviseurInfo.ps1  # VMware PowerCLI — collecte ESXi/vCenter
│   ├── CollectStorageInfo.ps1      # Seagate REST API + fallback SNMP
│   ├── CollectSwitchBandwidth.ps1  # Bande passante switches (SNMP)
│   ├── CollectSwitchMetrics.ps1    # Métriques détaillées switches
│   ├── CollectServerInfo.ps1       # Informations serveurs physiques
│   ├── CollectServerMetrics.ps1    # Métriques serveurs (CPU, RAM, disques)
│   ├── SimplePing.ps1              # Ping léger pour équipements
│   ├── AddEquipmentFromCsv.ps1     # Import d'équipements depuis CSV
│   ├── BackupManager.ps1           # Sauvegarde/restauration SQLite
│   ├── DockerManager.ps1           # Gestion Docker depuis PowerShell
│   ├── AlertManager.ps1            # Gestion des alertes
│   ├── DatabaseCheck.ps1           # Vérification intégrité base de données
│   ├── MonitoringStatus.ps1        # État global du monitoring
│   ├── StartAllMonitors.ps1        # Démarre tous les scripts de monitoring
│   └── Setup.ps1                   # Installation initiale
│
├── docker/
│   └── monitor/
│       └── Dockerfile              # Image PowerShell pour moniteurs conteneurisés
│
├── docker-compose.yml              # 4 services : api, frontend, ping-monitor, bandwidth-monitor
└── README.md
```

---

## 5. Installation et lancement

### Prérequis

| Outil | Version minimale | Usage |
|-------|-----------------|-------|
| Docker Desktop (Windows) | Dernière version | Conteneurs |
| WSL2 | Activé | Requis par Docker Desktop |
| Node.js | 20+ | Build frontend local |
| PowerShell | 7+ | Scripts de monitoring |
| npm | Inclus avec Node.js | Dépendances frontend |

### Première installation complète

```powershell
# 1. Cloner ou copier le projet sur le poste
# Répertoire cible : C:\...\Dashboard-Semmaris-Base-Propre\

# 2. Installer les dépendances frontend
cd frontend
npm install

# 3. Builder le frontend (OBLIGATOIRE — voir §6 pour comprendre pourquoi)
#    En développement local :
$env:VITE_API_URL = "http://localhost:4000"
npm run build
cd ..

# 4. Lancer tous les services Docker
docker compose up -d

# 5. Vérifier que tout tourne
docker compose ps
```

L'application est accessible sur :
- **Frontend** : http://localhost:5173
- **API** : http://localhost:4000

> **Note locale** : Si le port 5173 est déjà occupé par un autre projet (ex. `parking_dashboard`), on peut
> utiliser un port de remplacement en changeant `"5173:5173"` en `"XXXX:5173"` dans `docker-compose.yml`.
> En production sur le serveur Semmaris, le port 5173 est le port standard — ne pas changer.

### Comptes par défaut

| Rôle  | Email                    | Mot de passe |
|-------|--------------------------|--------------|
| Admin | admin@semmaris.local     | admin123     |
| User  | user@semmaris.local      | user123      |

> Changer les mots de passe en production via le Panel Admin.

---

## 6. Workflow de développement (point critique Windows/Docker)

### Pourquoi le build local est obligatoire

Docker BuildKit sur Windows/WSL2 souffre d'un bug connu : la détection des nouveaux fichiers dans le filesystem Windows est défaillante. En pratique, même avec `--no-cache`, le contexte Docker ne contient que 1-2 kB au lieu de plusieurs Mo, et les nouveaux fichiers JSX ne sont jamais inclus dans le bundle.

**Symptôme** : après avoir ajouté un nouveau composant (ex. `VMware.jsx`), le build Docker produit un bundle incomplet (111 modules au lieu de 113), et les nouvelles pages redirigent vers l'accueil.

**Solution adoptée** : le frontend est buildé **localement** avec Node.js, et le Dockerfile nginx copie simplement le dossier `dist/` déjà compilé.

### Après toute modification de fichiers JSX ou CSS

```powershell
# 1. Rebuild le frontend localement
cd frontend
$env:VITE_API_URL = "http://localhost:4000"   # dev local
# OU
$env:VITE_API_URL = "http://10.8.11.230:4000"  # production
npm run build
cd ..

# 2. Rebuild et redémarrer le conteneur frontend
docker compose build --no-cache frontend
docker compose up -d frontend
```

### Points importants sur la variable VITE_API_URL

`VITE_API_URL` est embarquée dans le bundle JavaScript **au moment du build** via `import.meta.env.VITE_API_URL`. Elle n'est **pas** chargée au runtime depuis les variables d'environnement Docker. Conséquence :

- Si on build avec `http://localhost:4000` puis on déploie en production → les requêtes API échoueront
- Il faut toujours rebuilder avec la bonne URL avant de déployer

### Développement quotidien (API uniquement modifiée)

Si seul le backend est modifié, le frontend n'a pas besoin d'être rebuildé :

```powershell
docker compose restart api
# ou pour reconstruire l'image backend :
docker compose build --no-cache api
docker compose up -d api
```

---

## 7. Rôles et comptes utilisateurs

| Rôle  | Accès |
|-------|-------|
| **Admin** | Toutes les pages + Panel Admin (gestion utilisateurs et équipements) |
| **User** | Toutes les pages de supervision (lecture seule) |
| **SGM** | Accueil uniquement (résumé Caméras + Switches) |

Les tokens JWT ont une durée de vie de 30 jours. Ils sont stockés dans le `localStorage` du navigateur. L'authentification se fait avec le champ `identifier` (email) + `password`.

Création d'un compte via le Panel Admin (`/paneladmin`) — accès réservé au rôle Admin.

---

## 8. Types d'équipements et pages associées

| Type interne | Page URL | Script de collecte | Description |
|---|---|---|---|
| `Camera` | `/cameras` | `SimplePing.ps1` | Caméras IP — ping uniquement |
| `Switch` | `/switches` | `CollectSwitchBandwidth.ps1` | Switches — bande passante SNMP |
| `PC` | `/pcs` | `SimplePing.ps1` | Postes de travail — ping |
| `Server` | `/servers` | `CollectServerInfo.ps1` | Serveurs physiques — ping + infos |
| `Hyperviseur` | `/vmware` | `CollectHyperviseurInfo.ps1` | ESXi — CPU, RAM, VMs, datastores |
| `Stockage` | `/stockage` | `CollectStorageInfo.ps1` | Baies Seagate — capacité, disques, RAID |

Le champ `type` est normalisé côté API : les variantes (`vmware`, `esxi`, `hypervisor`, `baie`, `san`, `nas`, `storage`) sont toutes ramenées aux types canoniques ci-dessus.

---

## 9. API Backend — endpoints documentés

L'API tourne sur le port **4000**. Toutes les routes (sauf `/api/auth/*`) requièrent un header `Authorization: Bearer <token>`.

Les routes d'ingestion de métriques (utilisées par les scripts PowerShell) requièrent le header `x-ingest-key: <INGEST_KEY>`.

### Authentification

| Méthode | Route | Corps | Description |
|---------|-------|-------|-------------|
| `POST` | `/api/auth/login` | `{ identifier, password }` | Connexion — retourne `{ token, user }` |
| `GET` | `/api/auth/me` | — | Profil de l'utilisateur connecté |
| `PUT` | `/api/auth/password` | `{ currentPassword, newPassword }` | Changement de mot de passe |

### Équipements

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/equipment` | Liste tous les équipements (filtres : `?type=Camera&status=online`) |
| `GET` | `/api/equipment/:id` | Détail d'un équipement |
| `POST` | `/api/equipment` | Créer un équipement (Admin) |
| `PUT` | `/api/equipment/:id` | Modifier un équipement (Admin) |
| `DELETE` | `/api/equipment/:id` | Supprimer un équipement (Admin) |
| `POST` | `/api/equipment/import` | Import CSV/Excel (Admin) |

### Métriques réseau

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/ping/ingest` | Ingestion des résultats de ping (script) |
| `GET` | `/api/ping/latest` | Derniers résultats de ping |
| `POST` | `/api/bandwidth/ingest` | Ingestion bande passante (script) |
| `GET` | `/api/bandwidth/latest` | Dernières métriques bande passante |

### VMware / Hyperviseurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/hyperviseur/ingest` | Ingestion métriques ESXi (PowerCLI) |
| `GET` | `/api/hyperviseur/metrics` | Métriques de tous les hyperviseurs |
| `GET` | `/api/hyperviseur/metrics/:id` | Métriques d'un hyperviseur |

### Stockage Seagate

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/storage/ingest` | Ingestion métriques baie Seagate |
| `GET` | `/api/storage/metrics` | Métriques de toutes les baies |
| `GET` | `/api/storage/metrics/:id` | Métriques d'une baie |

### Utilisateurs (Admin uniquement)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/users` | Liste des utilisateurs |
| `POST` | `/api/users` | Créer un utilisateur |
| `PUT` | `/api/users/:id` | Modifier un utilisateur |
| `DELETE` | `/api/users/:id` | Supprimer un utilisateur |

### Statistiques

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/stats` | Statistiques globales (uptime, counts, etc.) |
| `GET` | `/api/stats/history` | Historique de disponibilité |

---

## 10. Base de données SQLite — schéma

La base est dans `backend/data/app.db`, en **mode WAL** (Write-Ahead Logging) pour de meilleures performances en lecture concurrente. Elle est migrée automatiquement au démarrage de l'API.

### Table `users`
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
email       TEXT UNIQUE NOT NULL
password    TEXT NOT NULL          -- bcrypt hash (cost 10)
name        TEXT
role        TEXT DEFAULT 'User'    -- 'Admin' | 'User' | 'SGM'
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Table `equipment`
```sql
id           INTEGER PRIMARY KEY AUTOINCREMENT
name         TEXT NOT NULL
type         TEXT NOT NULL          -- Camera | Switch | PC | Server | Hyperviseur | Stockage
ip           TEXT
location     TEXT                   -- Contient 'PCA1', 'PCA2' ou 'PRA' pour les sites
status       TEXT DEFAULT 'unknown' -- online | offline | unknown
description  TEXT
created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Table `ping_results`
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
equipment_id  INTEGER REFERENCES equipment(id)
status        TEXT    -- online | offline
latency_ms    REAL
collected_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Table `bandwidth_metrics`
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
equipment_id  INTEGER REFERENCES equipment(id)
interface     TEXT
rx_bps        REAL    -- débit entrant en bits/s
tx_bps        REAL    -- débit sortant en bits/s
collected_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Table `hyperviseur_metrics`
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
equipment_id    INTEGER REFERENCES equipment(id)
cpu_usage_pct   REAL
ram_usage_pct   REAL
ram_total_gb    REAL
ram_used_gb     REAL
vm_running      INTEGER
vm_stopped      INTEGER
datastores      TEXT    -- JSON : [{ name, capacity_gb, free_gb, used_pct }]
collected_at    DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Table `storage_metrics`
```sql
id                  INTEGER PRIMARY KEY AUTOINCREMENT
equipment_id        INTEGER REFERENCES equipment(id)
total_capacity_tb   REAL
used_capacity_tb    REAL
free_capacity_tb    REAL
disks_total         INTEGER
disks_ok            INTEGER
disks_failed        INTEGER
disks_spare         INTEGER
controllers_status  TEXT    -- JSON : [{ id, status, fw_version }]
pools               TEXT    -- JSON : [{ name, status, raid_level, size_tb }]
collected_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Persistance Docker

Le dossier `backend/data/` est monté en volume dans `docker-compose.yml` :
```yaml
volumes:
  - ./backend/data:/app/data
```
La base `app.db` survit aux `docker compose down` et aux rebuilds de l'image.

---

## 11. Scripts PowerShell de monitoring

Tous les scripts sont dans le dossier `scripts/`. Ils s'exécutent depuis un poste **ayant accès au réseau Semmaris** et envoient les données à l'API via HTTP.

### Variable commune : `INGEST_KEY`

Tous les scripts d'ingestion utilisent une clé d'API `INGEST_KEY` qui doit correspondre à la valeur définie dans `docker-compose.yml` (variable `INGEST_KEY` du service `api`). Valeur par défaut : `change-me-strong`.

### Scripts principaux

| Script | Rôle | Fréquence recommandée |
|--------|------|-----------------------|
| `SimplePing.ps1` | Ping de tous les équipements | Toutes les 2-5 min |
| `CollectSwitchBandwidth.ps1` | Bande passante switches via SNMP | Toutes les 5 min |
| `CollectHyperviseurInfo.ps1` | Métriques VMware ESXi | Toutes les 5-10 min |
| `CollectStorageInfo.ps1` | Métriques baies Seagate | Toutes les 5-10 min |
| `CollectServerInfo.ps1` | État serveurs physiques | Toutes les 5 min |
| `StartAllMonitors.ps1` | Démarre tous les scripts en boucle | Au démarrage du poste |
| `BackupManager.ps1` | Sauvegarde/restauration SQLite | Avant chaque mise à jour |

### Démarrage automatique au démarrage Windows

```powershell
# Installer le démarrage automatique
.\scripts\InstallAutoStart.ps1

# OU démarrer manuellement tous les moniteurs
.\scripts\StartAllMonitors.ps1
```

---

## 12. Monitoring VMware / ESXi

Collecte via VMware PowerCLI depuis un poste qui a accès au réseau Semmaris.

### Installation de PowerCLI (une seule fois)

```powershell
Install-Module -Name VMware.PowerCLI -Scope CurrentUser -Force
Set-PowerCLIConfiguration -InvalidCertificateAction Ignore -Confirm:$false
```

### Mode vCenter (recommandé — supervise tous les ESXi d'un coup)

```powershell
.\scripts\CollectHyperviseurInfo.ps1 `
    -VCenterHost "vcenter.semmaris.local" `
    -VCenterUser "administrator@vsphere.local" `
    -VCenterPass "votre-mot-de-passe" `
    -ApiUrl "http://10.8.11.230:4000" `
    -IngestKey "change-me-strong"
```

### Mode ESXi direct (sans vCenter)

```powershell
.\scripts\CollectHyperviseurInfo.ps1 `
    -ESXiHosts @("192.168.x.x", "192.168.x.y") `
    -ESXiUser "root" `
    -ESXiPass "votre-mot-de-passe" `
    -ApiUrl "http://10.8.11.230:4000" `
    -IngestKey "change-me-strong"
```

### Ce qui est collecté par host ESXi

- CPU : utilisation globale en %
- RAM : total (Go), utilisé (Go), utilisation en %
- VMs : nombre en cours d'exécution, nombre arrêtées
- Datastores : pour chaque datastore → nom, capacité totale (Go), espace libre (Go), % utilisé

### Page VMware dans l'application

Route : `/vmware` — accessible aux rôles Admin et User.

Un équipement de type `Hyperviseur` doit exister dans la base (créé via le Panel Admin ou importé) avec une IP correspondant à l'host ESXi. Le script associe les métriques par IP ou par nom.

---

## 13. Monitoring Stockage Seagate Exos X

Collecte via l'API REST Seagate (HTTPS sur port 443) avec authentification MD5 hash, et fallback SNMP si l'API REST n'est pas disponible.

### Lancement du script

```powershell
.\scripts\CollectStorageInfo.ps1 `
    -StorageHosts @("192.168.x.x", "192.168.x.y") `
    -ApiUser "manage" `
    -ApiPass "!manage" `
    -DashboardApiUrl "http://10.8.11.230:4000" `
    -IngestKey "change-me-strong"
```

### Ce qui est collecté par baie

- Capacité totale / utilisée / libre (en To)
- Nombre de disques : OK, défaillants, spare
- État des contrôleurs (A/B) : OK, dégradé, hors ligne + version firmware
- Pools RAID : nom, statut, niveau RAID, taille

### Authentification Seagate REST

L'API Seagate utilise un mécanisme d'authentification par session avec hash MD5. Le script gère automatiquement la session et les cookies. Accepter les certificats auto-signés est nécessaire :

```powershell
# Dans le script, ajouté automatiquement :
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
```

### Page Stockage dans l'application

Route : `/stockage` — accessible aux rôles Admin et User.

Un équipement de type `Stockage` doit exister dans la base avec l'IP de la baie.

---

## 14. Sites PCA / PRA

Les sites PCA (Plan de Continuité d'Activité) et PRA (Plan de Reprise d'Activité) sont gérés via le champ **Localisation** des équipements.

### Association site ↔ équipement

| Tag dans le champ Localisation | Site affiché dans l'app |
|-------------------------------|------------------------|
| `PCA1` | PCA Site 1 |
| `PCA2` | PCA Site 2 |
| `PRA` | PRA |

Le tag est insensible à la casse et peut être combiné avec d'autres informations (`ex: "Salle serveurs PCA1 Baie 3"`).

### Comment affecter un équipement à un site

1. Panel Admin → sélectionner l'équipement
2. Champ **Localisation** → ajouter le tag `PCA1`, `PCA2` ou `PRA`
3. Sauvegarder

### Page PCA/PRA dans l'application

Route : `/safekit` — accessible aux rôles Admin et User.

La page agrège l'état de tous les équipements de chaque site et affiche :
- Nombre d'équipements par site
- Taux de disponibilité par site
- Liste des équipements en alerte

---

## 15. Gestion Docker

### Commandes courantes

```powershell
# État des services
docker compose ps

# Logs en temps réel (tous les services)
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f api
docker compose logs -f frontend

# Redémarrer un service
docker compose restart api

# Arrêter tous les services (les données sont conservées)
docker compose down

# Arrêter ET supprimer les volumes (ATTENTION : efface la base de données)
docker compose down -v

# Reconstruction complète (garde les données)
docker compose down
docker compose up -d --build

# Reconstruction d'un seul service
docker compose build --no-cache api
docker compose up -d api
```

### Services Docker Compose

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `api` | `./backend` (Node.js 20 alpine) | 4000 | API Express + SQLite |
| `frontend` | `./frontend` (nginx:alpine) | 5173 | React SPA pré-compilé |
| `ping-monitor` | `./docker/monitor` (PowerShell) | — | Ping équipements en boucle |
| `bandwidth-monitor` | `./docker/monitor` (PowerShell) | — | Bande passante switches |

### Gestion via script PowerShell

```powershell
# Utiliser DockerManager.ps1 pour des opérations courantes
.\scripts\DockerManager.ps1 -Action status
.\scripts\DockerManager.ps1 -Action restart -Service api
.\scripts\DockerManager.ps1 -Action logs -Service frontend
```

---

## 16. Sauvegarde et restauration

La base SQLite est la seule donnée persistante. Elle contient les équipements, utilisateurs, métriques historiques.

### Créer un backup

```powershell
# Backup avec nom personnalisé
.\scripts\BackupManager.ps1 backup -BackupName "avant_mise_a_jour_v3"

# Backup automatique avec timestamp
.\scripts\BackupManager.ps1 backup
```

Le backup est créé dans `backend/data/backups/`.

### Lister les backups disponibles

```powershell
.\scripts\BackupManager.ps1 list
```

### Restaurer un backup

```powershell
# Arrêter l'API avant de restaurer
docker compose stop api

.\scripts\BackupManager.ps1 restore -BackupName "avant_mise_a_jour_v3"

# Redémarrer
docker compose start api
```

### Backup manuel (alternative directe)

```powershell
# Copie directe du fichier SQLite
Copy-Item "backend\data\app.db" "backend\data\app.db.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
```

---

## 17. Déploiement en production

Le serveur de production Semmaris est à l'adresse `10.8.11.230`.

### Étapes de déploiement

```powershell
# 1. Builder le frontend avec l'IP de production
cd frontend
$env:VITE_API_URL = "http://10.8.11.230:4000"
npm run build
cd ..

# 2. Rebuilder l'image frontend (qui copie le dist/ compilé)
docker compose build --no-cache frontend

# 3. Redémarrer le frontend
docker compose up -d frontend

# 4. Si l'API a aussi changé
docker compose build --no-cache api
docker compose up -d api
```

### Variables à modifier pour la production

Dans `docker-compose.yml`, service `api` :
```yaml
environment:
  - JWT_SECRET=valeur-forte-et-unique-generee-aleatoirement
  - INGEST_KEY=valeur-forte-et-unique-generee-aleatoirement
```

Ces deux valeurs doivent également être mises à jour dans les scripts PowerShell qui utilisent `-IngestKey`.

### Vérification post-déploiement

```powershell
# Vérifier que les services tournent
docker compose ps

# Tester l'API
curl http://10.8.11.230:4000/api/health

# Tester le frontend
# Ouvrir http://10.8.11.230:5173 dans un navigateur
```

---

## 18. Dépannage

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| "Failed to fetch" à la connexion | L'API ne répond pas, ou le frontend a été buildé avec la mauvaise URL | Vérifier `docker compose ps` ; si l'API est down : `docker compose restart api`. Vérifier `VITE_API_URL` dans le build |
| Pages VMware / Stockage / PCA redirigent vers l'accueil | Frontend buildé sans les nouveaux composants (bug Windows/Docker) | Rebuilder localement : `npm run build` puis `docker compose build --no-cache frontend && docker compose up -d frontend` |
| Port 5173 déjà utilisé | Conflit avec un autre projet Docker sur ce port | Modifier temporairement `"5173:5173"` en `"XXXX:5173"` dans `docker-compose.yml` (dev uniquement) |
| Hyperviseurs / Baies sans données | Scripts PowerShell non exécutés, ou `INGEST_KEY` incorrecte | Lancer les scripts avec le bon `-IngestKey` ; vérifier que `INGEST_KEY` dans docker-compose.yml correspond |
| Login "invalid credentials" | Compte inexistant ou mot de passe incorrect | Utiliser les comptes par défaut (§5) ; sinon vérifier la base via `DatabaseCheck.ps1` |
| API démarre mais crash immédiatement | Problème de droits sur `backend/data/` | `docker compose down` puis `docker compose up -d` ; si persistant, vérifier les permissions du dossier `backend/data/` |
| Build frontend très lent sur Windows | node_modules volumineuse | Normal à la première installation ; les builds suivants sont plus rapides grâce au cache npm |
| Contexte Docker = 1.39 kB | Bug BuildKit Windows/WSL2 | Ne jamais builder dans Docker sur Windows — toujours utiliser `npm run build` local |
| SNMP timeout sur les switches | SNMP non activé ou community string incorrecte | Vérifier la config SNMP du switch ; tester avec `Test-Connection` puis avec `snmpget` |

---

## 19. Points d'architecture importants pour les développeurs

### Point critique : `main.jsx` est le vrai point d'entrée — PAS `App.jsx`

Le projet utilise `frontend/src/main.jsx` comme point d'entrée React Router. `App.jsx` existe dans le projet mais son import est **intentionnellement commenté** dans `main.jsx` car il entrait en conflit.

Si vous ajoutez une nouvelle page, vous devez modifier `main.jsx` (et non `App.jsx`) :

```jsx
// Dans main.jsx — ajouter l'import :
import MaNouvellePage from './views/MaNouvellePage'

// Et la route dans le <Routes> :
<Route path="ma-nouvelle-page" element={<MaNouvellePage/>} />
```

Le catch-all `<Route path="*" element={<Navigate to="/" replace />} />` redirige vers l'accueil toutes les routes non déclarées — ce qui explique pourquoi une page non ajoutée à `main.jsx` semble "ne pas exister".

### Monolithe backend

Toute la logique backend est dans `backend/src/index.js` : configuration Express, migrations SQLite, routes API, middlewares d'auth, validation. C'est un choix intentionnel de simplicité pour ce projet interne. Pour ajouter un endpoint, tout se fait dans ce fichier.

### JWT stocké en localStorage

Les tokens JWT sont stockés dans le `localStorage` du navigateur (via Zustand persist). Ce choix est acceptable pour un outil interne non exposé sur Internet. Pour une application exposée, préférer les cookies HTTP-only.

### SQLite en production

SQLite en mode WAL est parfaitement adapté à ce cas d'usage : un seul serveur, quelques dizaines d'utilisateurs, pas de transactions concurrentes massives. Il n'y a pas besoin de migrer vers PostgreSQL sauf si des cas d'usage multi-serveurs se présentent.

### Variables d'environnement Vite

Les variables préfixées `VITE_` dans Vite sont embarquées statiquement dans le bundle au moment du build. Elles ne peuvent pas être changées au runtime sans rebuilder. Ne jamais y mettre de secrets (clés API, mots de passe) car elles sont lisibles dans le source du bundle JavaScript.

### Thème et styles

Le thème rouge-noir Semmaris est défini dans `frontend/src/styles.css`. Les composants utilisent les classes Tailwind CSS + des classes personnalisées définies dans ce fichier. Pour modifier le thème global (couleurs, polices), c'est dans `styles.css` et `tailwind.config.js`.

---

**Dashboard Semmaris V3** — Supervision infrastructure IT Semmaris
