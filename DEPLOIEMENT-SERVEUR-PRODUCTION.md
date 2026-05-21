# 🚀 GUIDE DE DÉPLOIEMENT - SERVEUR DE PRODUCTION

**Date:** 18 Novembre 2025  
**Projet:** Dashboard Semmaris - Monitoring Infrastructure  
**Environnement:** Production Server

---

## 📋 TABLE DES MATIÈRES

1. [Prérequis Serveur](#prérequis-serveur)
2. [Transfert des Fichiers](#transfert-des-fichiers)
3. [Installation des Prérequis](#installation-des-prérequis)
4. [Configuration des Équipements](#configuration-des-équipements)
5. [Configuration des Variables d'Environnement](#configuration-des-variables-denvironnement)
6. [Initialisation de la Base de Données](#initialisation-de-la-base-de-données)
7. [Construction et Démarrage Docker](#construction-et-démarrage-docker)
8. [Import des Équipements](#import-des-équipements)
9. [Configuration des Credentials](#configuration-des-credentials)
10. [Test de Collecte Manuelle](#test-de-collecte-manuelle)
11. [Automatisation (Tâche Planifiée)](#automatisation-tâche-planifiée)
12. [Vérification Finale](#vérification-finale)
13. [Troubleshooting](#troubleshooting)

---

## 🖥️ PRÉREQUIS SERVEUR

### Spécifications Minimales
- **OS:** Windows Server 2016+ ou Windows 10/11
- **RAM:** 4 GB minimum (8 GB recommandé)
- **CPU:** 2 cores minimum
- **Disque:** 20 GB d'espace libre
- **Réseau:** Accès aux équipements à monitorer (WMI, SSH, SNMP)

### Logiciels Requis
- **Docker Desktop** (ou Docker Engine pour Windows Server)
- **PowerShell 5.1+**
- **Git** (optionnel, pour récupérer le code)
- **Posh-SSH module** (si serveurs Linux à monitorer)

### Ports à Ouvrir
- **4000** : Backend API
- **5173** : Frontend Dashboard (ou 80/443 si proxy inverse)
- **Firewall:** Autoriser WMI (135, 445), SSH (22), SNMP (161)

---

## 📦 TRANSFERT DES FICHIERS

### Option 1 : Via Git (Recommandé)
```powershell
# Sur le serveur de production
cd C:\
git clone https://github.com/Matar100/Magnetoo-Semmaris.git Dashboard-Semmaris
cd Dashboard-Semmaris
```

### Option 2 : Copie Manuelle
1. Compresser le dossier `Dashboard-Semmaris-Base-Propre` en ZIP
2. Transférer via RDP, USB, ou réseau vers le serveur
3. Extraire dans `C:\Dashboard-Semmaris`

### Vérification
```powershell
cd C:\Dashboard-Semmaris
Get-ChildItem
# Vous devez voir : backend/, frontend/, scripts/, docker-compose.yml, etc.
```

---

## 🔧 INSTALLATION DES PRÉREQUIS

### 1. Vérifier PowerShell
```powershell
$PSVersionTable.PSVersion
# Doit afficher version 5.1 ou supérieure
```

### 2. Installer Docker Desktop
- Télécharger depuis : https://www.docker.com/products/docker-desktop
- Installer et redémarrer le serveur
- Vérifier :
```powershell
docker --version
docker-compose --version
```

### 3. Installer Posh-SSH (UNIQUEMENT si serveurs Linux)
```powershell
# Ouvrir PowerShell en ADMINISTRATEUR
Install-Module -Name Posh-SSH -Force -Scope AllUsers

# Vérifier
Get-Module -ListAvailable -Name Posh-SSH
```

### 4. Vérifier l'Accès Réseau
```powershell
# Test WMI vers serveur Windows
Test-Connection -ComputerName "IP_SERVEUR_WINDOWS" -Count 2

# Test SSH vers serveur Linux
Test-NetConnection -ComputerName "IP_SERVEUR_LINUX" -Port 22

# Test SNMP vers switch
Test-NetConnection -ComputerName "IP_SWITCH" -Port 161
```

---

## 📝 CONFIGURATION DES ÉQUIPEMENTS

### Éditer le fichier equipements.csv
```powershell
cd C:\Dashboard-Semmaris\scripts
notepad equipements.csv
```

### Format du Fichier
```csv
name,type,ip_address,vendor,model,location,username,password
SRV-PROD-01,server,192.168.1.10,Dell,PowerEdge R740,Datacenter A,,
SRV-PROD-02,server,192.168.1.11,HP,ProLiant DL380,Datacenter A,root,MotDePasseSSH
SW-CORE-01,switch,192.168.1.100,Cisco,Catalyst 3850,Datacenter A,,
SW-ACCESS-01,switch,192.168.1.101,HP,ProCurve 2920,Datacenter B,,
```

### ⚠️ IMPORTANT - Colonnes Obligatoires
- **name** : Nom unique de l'équipement
- **type** : `server`, `switch`, `camera`, ou `pc`
- **ip_address** : Adresse IP accessible depuis le serveur
- **vendor** : Fabricant (Dell, HP, Cisco, etc.)
- **model** : Modèle de l'équipement
- **location** : Emplacement physique
- **username** : Vide pour Windows (WMI), obligatoire pour Linux (SSH)
- **password** : Vide pour Windows, obligatoire pour Linux (sera hashé en DB)

### Exemples de Configuration

#### Serveur Windows (WMI)
```csv
SRV-DC-01,server,192.168.1.5,Microsoft,Windows Server 2019,Datacenter,,
```
**Note:** Username/password vides = utilise les credentials Windows du compte qui exécute le script

#### Serveur Linux (SSH)
```csv
SRV-WEB-01,server,192.168.1.20,Ubuntu,22.04 LTS,DMZ,semmaris_monitor,P@ssw0rd123
```
**Note:** Créer un utilisateur dédié avec accès sudo pour les commandes de monitoring

#### Switch Cisco/HP (SNMP)
```csv
SW-CORE-01,switch,192.168.1.100,Cisco,Catalyst 3850,Datacenter,,,public
```
**Note:** Le champ password contiendra la community SNMP (défaut: public)

---

## 🔐 CONFIGURATION DES VARIABLES D'ENVIRONNEMENT

### Backend (.env)
```powershell
cd C:\Dashboard-Semmaris\backend
Copy-Item backend.env.example backend.env
notepad backend.env
```

**Contenu de `backend.env`:**
```env
# Base de données
DB_PATH=./data/monitoring.db

# JWT pour authentification
JWT_SECRET=VotreSecretSuperSecurise_ChangezMoi_2025!

# Port backend
PORT=4000

# Clé d'ingestion (pour scripts PowerShell)
INGEST_KEY=IngestKey_Production_2025_Semmaris_SecureKey

# Environnement
NODE_ENV=production
```

### Frontend (.env)
```powershell
cd C:\Dashboard-Semmaris\frontend
Copy-Item frontend.env.example frontend.env
notepad frontend.env
```

**Contenu de `frontend.env`:**
```env
# URL de l'API backend
VITE_API_URL=http://localhost:4000

# OU si accès externe :
# VITE_API_URL=http://IP_SERVEUR:4000
```

### ⚠️ SÉCURITÉ
- **JWT_SECRET** : Générer une chaîne aléatoire longue (32+ caractères)
- **INGEST_KEY** : Clé secrète pour autoriser les scripts à envoyer des données
- **NE JAMAIS** commiter les fichiers .env dans Git

---

## 🗄️ INITIALISATION DE LA BASE DE DONNÉES

### Exécuter le Script Setup
```powershell
cd C:\Dashboard-Semmaris\scripts
.\Setup.ps1
```

### Ce que fait Setup.ps1
1. ✅ Crée la base de données SQLite `backend/data/monitoring.db`
2. ✅ Crée les tables : `users`, `equipment`, `bandwidth_data`, `alerts`
3. ✅ Crée un utilisateur admin par défaut
4. ✅ Configure la structure initiale

### Credentials Admin par Défaut
- **Email:** `admin@semmaris.fr`
- **Password:** `Admin2025!`
- **Rôle:** `admin`

### ⚠️ IMPORTANT
**Changez le mot de passe admin dès la première connexion !**

### Vérification
```powershell
# Vérifier que la DB existe
Test-Path C:\Dashboard-Semmaris\backend\data\monitoring.db
# Doit retourner : True
```

---

## 🐳 CONSTRUCTION ET DÉMARRAGE DOCKER

### Option 1 : Via DockerManager.ps1 (Recommandé)
```powershell
cd C:\Dashboard-Semmaris\scripts
.\DockerManager.ps1 start -Build
```

### Option 2 : Commandes Docker Directes
```powershell
cd C:\Dashboard-Semmaris
docker-compose up -d --build
```

### Vérification des Conteneurs
```powershell
docker ps
# Vous devez voir 2 conteneurs :
# - semmaris-backend (port 4000)
# - semmaris-frontend (port 5173)
```

### Vérifier les Logs
```powershell
# Backend
docker logs semmaris-backend --tail 50

# Frontend
docker logs semmaris-frontend --tail 50
```

### Tester l'API Backend
```powershell
curl http://localhost:4000/health
# Doit retourner : {"status":"ok"}
```

### Tester le Frontend
Ouvrir un navigateur : `http://localhost:5173`
- Vous devez voir la page de login

---

## 📥 IMPORT DES ÉQUIPEMENTS

### Exécuter le Script d'Import
```powershell
cd C:\Dashboard-Semmaris\scripts
.\AddEquipmentFromCsv.ps1
```

### Ce que fait le Script
1. ✅ Lit le fichier `equipements.csv`
2. ✅ Insère chaque équipement dans la table `equipment`
3. ✅ Hash les mots de passe avant stockage
4. ✅ Affiche un résumé des équipements importés

### Vérification
```powershell
# Via DatabaseCheck.ps1
.\DatabaseCheck.ps1

# OU via le Dashboard
# 1. Se connecter : http://localhost:5173
# 2. Login : admin@semmaris.fr / Admin2025!
# 3. Aller dans "Équipements"
# 4. Vérifier que tous les équipements sont listés
```

---

## 🔑 CONFIGURATION DES CREDENTIALS

### Pour Serveurs Windows (WMI)

**Option 1 : Utiliser le compte qui exécute les scripts**
- Le compte Windows qui lance `ProductionMonitoring.ps1` doit avoir :
  - Droits admin local sur les serveurs cibles
  - Accès WMI activé
  
**Option 2 : Credentials spécifiques**
- Via le Panel Admin dans le Dashboard :
  1. Se connecter au Dashboard
  2. Aller dans **Panel Admin**
  3. Cliquer sur un équipement Windows
  4. Ajouter username/password Windows

### Pour Serveurs Linux (SSH)

**Credentials déjà dans equipements.csv**
- Les credentials SSH sont importés depuis le CSV
- Stockés de manière sécurisée (hashés) dans la DB

**OU via Panel Admin :**
1. Se connecter au Dashboard
2. Aller dans **Panel Admin**
3. Cliquer sur un serveur Linux
4. Ajouter/Modifier username/password SSH

### Pour Switches (SNMP)

**Community String SNMP**
- Par défaut : `public` (en lecture seule)
- À configurer dans le champ `password` du CSV
- OU via Panel Admin après import

**Configuration SNMP sur les Switches :**
```cisco
# Cisco IOS
snmp-server community public RO

# HP ProCurve
snmp-server community public unrestricted
```

### ⚠️ SÉCURITÉ - Bonnes Pratiques

1. **Créer un compte dédié monitoring**
   ```bash
   # Sur serveurs Linux
   sudo useradd -m -s /bin/bash semmaris_monitor
   sudo usermod -aG sudo semmaris_monitor
   ```

2. **Utiliser SNMP v3 (recommandé)**
   - Plus sécurisé que v2c avec community string
   - Nécessite modification des scripts (voir documentation SNMP v3)

3. **Segmentation réseau**
   - Serveur de monitoring dans un VLAN dédié
   - Règles firewall restrictives (autoriser uniquement ports nécessaires)

---

## 🧪 TEST DE COLLECTE MANUELLE

### Test Collecte Serveur Windows
```powershell
cd C:\Dashboard-Semmaris\scripts
.\CollectServerInfo.ps1
```

**Vérifier dans les logs :**
```powershell
Get-Content C:\Dashboard-Semmaris\logs\collect-server.log -Tail 20
```

### Test Collecte Serveur Linux
```powershell
.\CollectServerInfo.ps1
# Les serveurs avec credentials SSH dans la DB seront interrogés
```

### Test Collecte Switches
```powershell
.\CollectSwitchInfo.ps1
```

**Vérifier dans les logs :**
```powershell
Get-Content C:\Dashboard-Semmaris\logs\collect-switch.log -Tail 20
```

### Test Ping Equipment
```powershell
.\PingEquipment.ps1
```

### Test Complet avec ProductionMonitoring
```powershell
.\ProductionMonitoring.ps1 -RunOnce
```

**Ce script exécute :**
1. ✅ PingEquipment.ps1 (vérifier accessibilité)
2. ✅ CollectServerInfo.ps1 (collecter métriques serveurs)
3. ✅ CollectSwitchInfo.ps1 (collecter métriques switches)
4. ✅ BandwidthMonitor.ps1 (calculer bande passante)

### Vérification des Données dans le Dashboard
1. Ouvrir le navigateur : `http://localhost:5173`
2. Se connecter : `admin@semmaris.fr` / `Admin2025!`
3. Aller dans **Équipements**
4. Cliquer sur un serveur → Vérifier les métriques (CPU, RAM, etc.)
5. Cliquer sur un switch → Vérifier les ports et métriques

---

## ⏰ AUTOMATISATION (TÂCHE PLANIFIÉE)

### Créer une Tâche Planifiée Windows

```powershell
# Script à exécuter pour créer la tâche planifiée
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\Dashboard-Semmaris\scripts\ProductionMonitoring.ps1"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)

$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "Semmaris-Monitoring" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Collecte automatique des métriques d'infrastructure Semmaris"
```

### OU Utiliser AutomationManager.ps1
```powershell
cd C:\Dashboard-Semmaris\scripts
.\AutomationManager.ps1 enable
```

### Vérifier la Tâche Planifiée
```powershell
Get-ScheduledTask -TaskName "Semmaris-Monitoring"
```

### Tester Manuellement la Tâche
```powershell
Start-ScheduledTask -TaskName "Semmaris-Monitoring"
```

### Voir l'Historique d'Exécution
```powershell
Get-ScheduledTaskInfo -TaskName "Semmaris-Monitoring"
```

### Configuration de la Tâche
- **Fréquence** : Toutes les 5 minutes
- **Compte** : SYSTEM (ou compte avec droits admin)
- **Redémarrage automatique** : En cas d'échec
- **Timeout** : 1 heure maximum par exécution

---

## ✅ VÉRIFICATION FINALE

### Checklist de Déploiement

```powershell
# Exécuter ce script de vérification complète
cd C:\Dashboard-Semmaris\scripts

Write-Host "`n════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   VÉRIFICATION FINALE DU DÉPLOIEMENT" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════`n" -ForegroundColor Cyan

# 1. Docker
Write-Host "1. Conteneurs Docker..." -ForegroundColor Yellow
docker ps --filter "name=semmaris" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Backend Health
Write-Host "`n2. Backend API..." -ForegroundColor Yellow
curl http://localhost:4000/health

# 3. Frontend Access
Write-Host "`n3. Frontend Dashboard..." -ForegroundColor Yellow
curl -I http://localhost:5173

# 4. Base de données
Write-Host "`n4. Base de données..." -ForegroundColor Yellow
.\DatabaseCheck.ps1

# 5. Tâche planifiée
Write-Host "`n5. Tâche planifiée..." -ForegroundColor Yellow
Get-ScheduledTask -TaskName "Semmaris-Monitoring" | Select-Object TaskName, State, LastRunTime, NextRunTime

# 6. Logs récents
Write-Host "`n6. Logs récents (5 dernières minutes)..." -ForegroundColor Yellow
Get-ChildItem C:\Dashboard-Semmaris\logs\*.log | 
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) } | 
    Select-Object Name, LastWriteTime

Write-Host "`n════════════════════════════════════════" -ForegroundColor Green
Write-Host "   VÉRIFICATION TERMINÉE" -ForegroundColor Green
Write-Host "════════════════════════════════════════`n" -ForegroundColor Green
```

### Tests de Validation

#### 1. Test Login
- URL : `http://localhost:5173` (ou `http://IP_SERVEUR:5173`)
- Email : `admin@semmaris.fr`
- Password : `Admin2025!`
- ✅ Connexion réussie → Dashboard s'affiche

#### 2. Test Équipements
- Menu : **Équipements**
- ✅ Tous les équipements du CSV sont listés
- ✅ Statut "Online" pour équipements accessibles

#### 3. Test Serveurs
- Menu : **Équipements** → Cliquer sur un serveur
- ✅ Métriques affichées : CPU, RAM, Température, GPU, Disques
- ✅ Graphiques de bande passante
- ✅ Network cards

#### 4. Test Switches
- Menu : **Équipements** → Cliquer sur un switch
- ✅ Métriques affichées : CPU, RAM, Uptime
- ✅ Liste des ports avec statut (up/down)
- ✅ Utilisation bande passante par port

#### 5. Test Statistiques
- Menu : **Statistiques**
- ✅ Graphiques de tendances
- ✅ Top équipements par utilisation

#### 6. Test Bande Passante
- Menu : **Bande Passante**
- ✅ Graphiques d'utilisation réseau
- ✅ Top consommateurs

---

## 🚨 TROUBLESHOOTING

### Problème : Conteneurs Docker ne démarrent pas

**Diagnostic :**
```powershell
docker-compose logs backend
docker-compose logs frontend
```

**Solutions :**
1. Vérifier les fichiers `.env` (backend et frontend)
2. Vérifier les ports 4000 et 5173 ne sont pas utilisés :
   ```powershell
   netstat -ano | findstr :4000
   netstat -ano | findstr :5173
   ```
3. Reconstruire les images :
   ```powershell
   docker-compose down
   docker-compose up -d --build --force-recreate
   ```

---

### Problème : "Cannot connect to backend API"

**Diagnostic :**
```powershell
# Test backend
curl http://localhost:4000/health

# Test depuis frontend
curl http://localhost:5173
```

**Solutions :**
1. Vérifier `frontend.env` → `VITE_API_URL=http://localhost:4000`
2. Vérifier firewall Windows :
   ```powershell
   New-NetFirewallRule -DisplayName "Semmaris Backend" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "Semmaris Frontend" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
   ```

---

### Problème : Collecte WMI échoue (serveurs Windows)

**Diagnostic :**
```powershell
# Tester WMI manuellement
Get-CimInstance -ComputerName "IP_SERVEUR" -ClassName Win32_OperatingSystem
```

**Solutions :**
1. Vérifier firewall sur serveur cible (ports 135, 445)
2. Vérifier service WMI :
   ```powershell
   # Sur le serveur cible
   Get-Service Winmgmt
   ```
3. Vérifier credentials :
   - Le compte qui exécute doit être admin local sur serveur cible
   - OU configurer credentials dans Panel Admin

---

### Problème : Collecte SSH échoue (serveurs Linux)

**Diagnostic :**
```powershell
# Tester connexion SSH manuellement
$cred = Get-Credential
New-SSHSession -ComputerName "IP_SERVEUR_LINUX" -Credential $cred -Port 22
```

**Solutions :**
1. Vérifier Posh-SSH installé :
   ```powershell
   Get-Module -ListAvailable -Name Posh-SSH
   ```
2. Vérifier firewall (port 22)
3. Vérifier credentials dans la DB (Panel Admin)
4. Vérifier accès SSH :
   ```bash
   # Sur serveur Linux
   sudo systemctl status sshd
   ```

---

### Problème : Collecte SNMP échoue (switches)

**Diagnostic :**
```powershell
# Tester SNMP manuellement (avec snmpget.exe)
snmpget -v2c -c public IP_SWITCH sysDescr.0
```

**Solutions :**
1. Vérifier community string dans DB (champ password)
2. Vérifier SNMP activé sur switch :
   ```cisco
   show snmp community
   ```
3. Vérifier firewall (port 161 UDP)
4. Vérifier version SNMP (scripts utilisent v2c)

---

### Problème : Pas de données dans le Dashboard

**Diagnostic :**
```powershell
# Vérifier logs
Get-Content C:\Dashboard-Semmaris\logs\*.log -Tail 50

# Vérifier tâche planifiée
Get-ScheduledTaskInfo -TaskName "Semmaris-Monitoring"

# Lancer collecte manuelle
.\ProductionMonitoring.ps1 -RunOnce
```

**Solutions :**
1. Vérifier que les scripts s'exécutent sans erreur
2. Vérifier `INGEST_KEY` dans `backend.env` et dans scripts
3. Vérifier logs backend :
   ```powershell
   docker logs semmaris-backend --tail 100
   ```

---

### Problème : "Invalid credentials" lors du login

**Solutions :**
1. Réinitialiser admin :
   ```powershell
   .\Setup.ps1 -ResetAdmin
   ```
2. Vérifier JWT_SECRET dans `backend.env`
3. Redémarrer backend :
   ```powershell
   docker-compose restart backend
   ```

---

## 📞 SUPPORT ET DOCUMENTATION

### Documentation Complète
- **GUIDE-RAPIDE.md** : Guide de démarrage rapide
- **SCRIPTS-PRODUCTION.md** : Documentation de tous les scripts
- **PRODUCTION-MONITORING-GUIDE.md** : Guide du monitoring
- **ANALYSE-COMPATIBILITE-SCRIPTS.md** : Architecture technique

### Logs
- **Backend** : `docker logs semmaris-backend`
- **Frontend** : `docker logs semmaris-frontend`
- **Scripts** : `C:\Dashboard-Semmaris\logs\*.log`

### Commandes Utiles
```powershell
# Redémarrer tout
docker-compose restart

# Arrêter tout
docker-compose down

# Voir les logs en temps réel
docker-compose logs -f

# Nettoyer et redémarrer
docker-compose down -v
docker-compose up -d --build

# Backup de la DB
.\scripts\BackupManager.ps1 create

# Vérifier la DB
.\scripts\DatabaseCheck.ps1
```

---

## ✅ CHECKLIST FINALE DE DÉPLOIEMENT

- [ ] Docker installé et fonctionnel
- [ ] PowerShell 5.1+ disponible
- [ ] Posh-SSH installé (si serveurs Linux)
- [ ] Fichiers transférés sur le serveur
- [ ] `equipements.csv` configuré avec vrais équipements
- [ ] `backend.env` configuré (JWT_SECRET, INGEST_KEY)
- [ ] `frontend.env` configuré (VITE_API_URL)
- [ ] Setup.ps1 exécuté (DB créée, admin créé)
- [ ] Docker containers démarrés (backend + frontend)
- [ ] Équipements importés via AddEquipmentFromCsv.ps1
- [ ] Credentials SSH/SNMP configurés
- [ ] Test collecte manuelle réussi
- [ ] Dashboard accessible et fonctionnel
- [ ] Tâche planifiée créée et active
- [ ] Données collectées visibles dans le dashboard
- [ ] Mot de passe admin changé
- [ ] Firewall configuré (ports 4000, 5173)
- [ ] Backup automatique configuré
- [ ] Documentation lue et comprise

---

## 🎉 DÉPLOIEMENT TERMINÉ !

Une fois toutes les étapes complétées, votre Dashboard Semmaris est opérationnel en production !

**Accès Dashboard :** `http://IP_SERVEUR:5173`  
**Login :** `admin@semmaris.fr`  
**Password :** `Admin2025!` (à changer immédiatement)

**Monitoring actif :** Collecte automatique toutes les 5 minutes

---

**Document créé le :** 18 Novembre 2025  
**Version :** 1.0  
**Auteur :** GitHub Copilot  
**Projet :** Semmaris Infrastructure Monitoring Dashboard
