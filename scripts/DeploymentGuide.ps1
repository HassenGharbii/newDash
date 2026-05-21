# ═══════════════════════════════════════════════════════════════
# GUIDE DE DÉPLOIEMENT PRODUCTION - DASHBOARD SEMMARIS
# Windows Server 2022
# ═══════════════════════════════════════════════════════════════

# Ce guide contient TOUTES les commandes pour un déploiement production
# avec collecte RÉELLE des données (pas de simulation)

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  DÉPLOIEMENT PRODUCTION - DASHBOARD SEMMARIS             ║" -ForegroundColor Green
Write-Host "║  Windows Server 2022                                     ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# ═══════════════════════════════════════════════════════════════
# PHASE 1 : INSTALLATION DES PRÉREQUIS
# ═══════════════════════════════════════════════════════════════

Write-Host "═══ PHASE 1 : INSTALLATION DES PRÉREQUIS ═══" -ForegroundColor Cyan
Write-Host ""

# 1.1 - Installation de Docker Desktop
Write-Host "1.1 - Installation de Docker Desktop" -ForegroundColor Yellow
@"
# Méthode 1 : Téléchargement manuel
# Aller sur : https://www.docker.com/products/docker-desktop

# Méthode 2 : Installation via Chocolatey (recommandé)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Installer Docker Desktop
choco install docker-desktop -y

# Redémarrer le serveur
Restart-Computer -Force
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 1.2 - Installation de Git
Write-Host "`n1.2 - Installation de Git" -ForegroundColor Yellow
@"
# Via Chocolatey
choco install git -y

# OU téléchargement manuel
# https://git-scm.com/download/win

# Vérifier l'installation
git --version
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 1.3 - Installation du module PowerShell SSH (pour serveurs Linux)
Write-Host "`n1.3 - Installation du module Posh-SSH" -ForegroundColor Yellow
@"
# Installer le module Posh-SSH pour la collecte SSH
Install-Module -Name Posh-SSH -Force -Scope AllUsers
Import-Module Posh-SSH

# Vérifier
Get-Module -ListAvailable Posh-SSH
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 1.4 - Configuration du pare-feu
Write-Host "`n1.4 - Configuration du pare-feu Windows" -ForegroundColor Yellow
@"
# Ouvrir les ports nécessaires
New-NetFirewallRule -DisplayName "Dashboard API" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow
New-NetFirewallRule -DisplayName "Dashboard Frontend" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
New-NetFirewallRule -DisplayName "Dashboard HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Dashboard HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# Vérifier les règles
Get-NetFirewallRule -DisplayName "Dashboard*" | Format-Table DisplayName, Enabled, Direction, Action
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# ═══════════════════════════════════════════════════════════════
# PHASE 2 : CLONAGE ET CONFIGURATION DU PROJET
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══ PHASE 2 : CLONAGE ET CONFIGURATION ═══" -ForegroundColor Cyan
Write-Host ""

# 2.1 - Cloner le repository
Write-Host "2.1 - Clonage du repository" -ForegroundColor Yellow
@"
# Se positionner dans le dossier de déploiement
cd C:\inetpub

# Cloner le projet
git clone https://github.com/Matar100/Magnetoo-Semmaris.git
cd Magnetoo-Semmaris

# Vérifier les fichiers
ls
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 2.2 - Configuration des variables d'environnement
Write-Host "`n2.2 - Configuration des variables d'environnement" -ForegroundColor Yellow
@"
# Générer un JWT_SECRET aléatoire fort
`$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]`$_})

# Générer un INGEST_KEY aléatoire fort
`$ingestKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]`$_})

# Créer le fichier backend\.env
@"
PORT=4000
JWT_SECRET=`$jwtSecret
DB_PATH=./data/app.db
INGEST_KEY=`$ingestKey
"@ | Out-File -FilePath .\backend\.env -Encoding UTF8

# Créer le fichier frontend\.env
@"
VITE_API_URL=http://localhost:4000
"@ | Out-File -FilePath .\frontend\.env -Encoding UTF8

Write-Host "✓ Fichiers .env créés" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT - SAUVEGARDER CES CLÉS :" -ForegroundColor Red
Write-Host "JWT_SECRET = `$jwtSecret" -ForegroundColor Yellow
Write-Host "INGEST_KEY = `$ingestKey" -ForegroundColor Yellow
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 2.3 - Configuration du fichier config.json pour les scripts
Write-Host "`n2.3 - Configuration du fichier config.json" -ForegroundColor Yellow
@"
# Récupérer l'INGEST_KEY depuis backend\.env
`$envContent = Get-Content .\backend\.env -Raw
`$ingestKey = ([regex]::Match(`$envContent, 'INGEST_KEY=(.+)')).Groups[1].Value.Trim()

# Créer le fichier scripts\config.json
`$config = @{
    apiBase = "http://localhost:4000"
    adminEmail = "admin@semmaris.local"
    adminPassword = "admin123"  # À CHANGER après la première connexion
    ingestKey = `$ingestKey
    timeoutMs = 2000
    count = 1
} | ConvertTo-Json

`$config | Out-File -FilePath .\scripts\config.json -Encoding UTF8

Write-Host "✓ Fichier config.json créé" -ForegroundColor Green
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# ═══════════════════════════════════════════════════════════════
# PHASE 3 : DÉMARRAGE DES CONTENEURS DOCKER
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══ PHASE 3 : DÉMARRAGE DES CONTENEURS ═══" -ForegroundColor Cyan
Write-Host ""

# 3.1 - Construction et démarrage
Write-Host "3.1 - Construction et démarrage des conteneurs" -ForegroundColor Yellow
@"
# Exécuter le script de setup
.\scripts\Setup.ps1

# Démarrer les conteneurs avec reconstruction
.\scripts\DockerManager.ps1 start -Build

# OU directement avec Docker Compose
docker compose up -d --build

# Attendre que les conteneurs démarrent (30 secondes)
Start-Sleep -Seconds 30

# Vérifier l'état des conteneurs
docker compose ps
docker compose logs
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 3.2 - Vérification de la santé
Write-Host "`n3.2 - Vérification de la santé des services" -ForegroundColor Yellow
@"
# Tester l'API
Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method Get

# Tester le frontend
Start-Process "http://localhost:5173"

# Voir les logs en temps réel
docker compose logs -f
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# ═══════════════════════════════════════════════════════════════
# PHASE 4 : CONFIGURATION DE LA BASE DE DONNÉES
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══ PHASE 4 : CONFIGURATION DE LA BASE DE DONNÉES ═══" -ForegroundColor Cyan
Write-Host ""

# 4.1 - Première connexion et création du compte admin
Write-Host "4.1 - Première connexion" -ForegroundColor Yellow
@"
1. Ouvrir le navigateur : http://localhost:5173
2. Se connecter avec les credentials par défaut :
   - Identifiant : admin@semmaris.local
   - Mot de passe : admin123

3. IMPORTANT : Changer le mot de passe immédiatement !

4. Créer les utilisateurs supplémentaires si nécessaire
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 4.2 - Ajouter les équipements à surveiller
Write-Host "`n4.2 - Ajouter les équipements à surveiller" -ForegroundColor Yellow
@"
Option 1 : Via l'interface web
- Aller dans Admin Panel > Équipements
- Ajouter manuellement chaque équipement

Option 2 : Via script PowerShell avec fichier CSV
# Préparer un fichier equipements.csv avec colonnes :
# name,ip,category,model,location,os_type,snmp_community,ssh_username,ssh_password

# Exemple de contenu CSV :
@"
name,ip,category,model,location,os_type,snmp_community,ssh_username,ssh_password
SRV-AD-01,192.168.1.10,servers,Dell R740,Salle serveurs,windows,,,
SRV-SQL-01,192.168.1.11,servers,HP DL380,Salle serveurs,windows,,,
SRV-WEB-01,192.168.1.12,servers,Dell R640,DMZ,linux,,root,MotDePasse123
SW-CORE-01,192.168.1.1,switches,Cisco 3850,Salle réseau,,public,,
SW-FLOOR1-01,192.168.1.2,switches,HP 2530,Etage 1,,public,,
"@ | Out-File -FilePath .\scripts\equipements.csv -Encoding UTF8

# Importer les équipements
.\scripts\AddEquipmentFromCsv.ps1

Write-Host "✓ Équipements importés" -ForegroundColor Green
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# ═══════════════════════════════════════════════════════════════
# PHASE 5 : CONFIGURATION DU MONITORING EN PRODUCTION
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══ PHASE 5 : CONFIGURATION DU MONITORING ═══" -ForegroundColor Cyan
Write-Host ""

# 5.1 - Test manuel des scripts de collecte
Write-Host "5.1 - Test manuel des scripts de collecte" -ForegroundColor Yellow
@"
# Test du ping des équipements
.\scripts\PingEquipment.ps1

# Test de la collecte des serveurs
.\scripts\CollectServerInfo.ps1

# Test de la collecte des switches
.\scripts\CollectSwitchInfo.ps1

# Vérifier les résultats dans le dashboard web
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 5.2 - Démarrer le monitoring automatique
Write-Host "`n5.2 - Démarrer le monitoring automatique" -ForegroundColor Yellow
@"
# Mode test (1 seul cycle)
.\scripts\ProductionMonitoring.ps1 -RunOnce

# Mode production continu (cycle toutes les 5 minutes)
.\scripts\ProductionMonitoring.ps1 -IntervalMinutes 5

# Désactiver certains modules si nécessaire
.\scripts\ProductionMonitoring.ps1 -EnableBandwidth:`$false

# Les logs sont dans : .\logs\monitoring_YYYYMMDD.log
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 5.3 - Monitoring de la bande passante (en arrière-plan)
Write-Host "`n5.3 - Monitoring de la bande passante" -ForegroundColor Yellow
@"
# Lancer le monitoring bande passante en arrière-plan
Start-Process powershell -ArgumentList "-File .\scripts\BandwidthMonitor.ps1 -IntervalSeconds 60" -WindowStyle Minimized

# Pour arrêter : trouver le processus et le tuer
Get-Process powershell | Where-Object {`$_.MainWindowTitle -match "BandwidthMonitor"}
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# ═══════════════════════════════════════════════════════════════
# PHASE 6 : AUTOMATISATION ET TÂCHES PLANIFIÉES
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══ PHASE 6 : AUTOMATISATION ═══" -ForegroundColor Cyan
Write-Host ""

# 6.1 - Créer une tâche planifiée pour le monitoring
Write-Host "6.1 - Créer une tâche planifiée Windows" -ForegroundColor Yellow
@"
# Tâche pour le monitoring complet (toutes les 5 minutes)
`$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\inetpub\Magnetoo-Semmaris\scripts\ProductionMonitoring.ps1 -RunOnce"

`$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)

`$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

`$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "Dashboard Semmaris - Monitoring" `
    -Action `$action -Trigger `$trigger -Principal `$principal -Settings `$settings

Write-Host "✓ Tâche planifiée créée" -ForegroundColor Green
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 6.2 - Créer une tâche pour les backups quotidiens
Write-Host "`n6.2 - Tâche planifiée pour les backups" -ForegroundColor Yellow
@"
# Backup quotidien à 2h du matin
`$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\inetpub\Magnetoo-Semmaris\scripts\BackupManager.ps1"

`$trigger = New-ScheduledTaskTrigger -Daily -At 2am

`$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "Dashboard Semmaris - Backup" `
    -Action `$action -Trigger `$trigger -Principal `$principal

Write-Host "✓ Tâche de backup créée" -ForegroundColor Green
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# 6.3 - Démarrage automatique au boot du serveur
Write-Host "`n6.3 - Démarrage automatique au boot" -ForegroundColor Yellow
@"
# Docker démarre automatiquement
Set-Service -Name docker -StartupType Automatic

# Créer une tâche qui démarre les conteneurs au boot
`$action = New-ScheduledTaskAction -Execute "docker" -Argument "compose -f C:\inetpub\Magnetoo-Semmaris\docker-compose.yml up -d"

`$trigger = New-ScheduledTaskTrigger -AtStartup

`$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

`$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask -TaskName "Dashboard Semmaris - Startup" `
    -Action `$action -Trigger `$trigger -Principal `$principal -Settings `$settings

Write-Host "✓ Démarrage automatique configuré" -ForegroundColor Green
"@ | Write-Host -ForegroundColor Gray

Read-Host "`nAppuyez sur Entrée pour continuer..."

# ═══════════════════════════════════════════════════════════════
# PHASE 7 : VÉRIFICATIONS FINALES
# ═══════════════════════════════════════════════════════════════

Write-Host "`n═══ PHASE 7 : VÉRIFICATIONS FINALES ═══" -ForegroundColor Cyan
Write-Host ""

# 7.1 - Checklist de déploiement
Write-Host "7.1 - Checklist de déploiement" -ForegroundColor Yellow
@"
# Script de vérification complète
Write-Host "╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  VÉRIFICATION DU DÉPLOIEMENT          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════╝" -ForegroundColor Cyan

`$checks = @()

# 1. Docker fonctionne
try {
    docker --version | Out-Null
    `$checks += @{Item="Docker installé"; Status="✓"; Color="Green"}
} catch {
    `$checks += @{Item="Docker installé"; Status="✗"; Color="Red"}
}

# 2. Conteneurs actifs
try {
    `$containers = docker compose ps --format json | ConvertFrom-Json
    if (`$containers.Count -ge 2) {
        `$checks += @{Item="Conteneurs actifs (2+)"; Status="✓"; Color="Green"}
    } else {
        `$checks += @{Item="Conteneurs actifs"; Status="✗ (`$(`$containers.Count))"; Color="Red"}
    }
} catch {
    `$checks += @{Item="Conteneurs actifs"; Status="✗"; Color="Red"}
}

# 3. API accessible
try {
    `$health = Invoke-RestMethod -Uri "http://localhost:4000/api/health"
    if (`$health.status -eq "ok") {
        `$checks += @{Item="API accessible"; Status="✓"; Color="Green"}
    } else {
        `$checks += @{Item="API accessible"; Status="✗"; Color="Red"}
    }
} catch {
    `$checks += @{Item="API accessible"; Status="✗"; Color="Red"}
}

# 4. Frontend accessible
try {
    `$response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing
    if (`$response.StatusCode -eq 200) {
        `$checks += @{Item="Frontend accessible"; Status="✓"; Color="Green"}
    } else {
        `$checks += @{Item="Frontend accessible"; Status="✗"; Color="Red"}
    }
} catch {
    `$checks += @{Item="Frontend accessible"; Status="✗"; Color="Red"}
}

# 5. Base de données existe
if (Test-Path ".\backend\data\app.db") {
    `$checks += @{Item="Base de données"; Status="✓"; Color="Green"}
} else {
    `$checks += @{Item="Base de données"; Status="✗"; Color="Red"}
}

# 6. Variables d'environnement
if ((Test-Path ".\backend\.env") -and (Test-Path ".\frontend\.env")) {
    `$checks += @{Item="Fichiers .env"; Status="✓"; Color="Green"}
} else {
    `$checks += @{Item="Fichiers .env"; Status="✗"; Color="Red"}
}

# 7. Pare-feu configuré
`$fwRules = Get-NetFirewallRule -DisplayName "Dashboard*" -ErrorAction SilentlyContinue
if (`$fwRules.Count -ge 4) {
    `$checks += @{Item="Pare-feu configuré"; Status="✓"; Color="Green"}
} else {
    `$checks += @{Item="Pare-feu configuré"; Status="⚠ (`$(`$fwRules.Count)/4)"; Color="Yellow"}
}

# 8. Tâches planifiées
`$tasks = Get-ScheduledTask -TaskName "Dashboard Semmaris*" -ErrorAction SilentlyContinue
if (`$tasks.Count -ge 2) {
    `$checks += @{Item="Tâches planifiées"; Status="✓ (`$(`$tasks.Count))"; Color="Green"}
} else {
    `$checks += @{Item="Tâches planifiées"; Status="⚠ (`$(`$tasks.Count))"; Color="Yellow"}
}

# 9. Logs directory
if (Test-Path ".\logs") {
    `$checks += @{Item="Dossier logs"; Status="✓"; Color="Green"}
} else {
    `$checks += @{Item="Dossier logs"; Status="✗"; Color="Red"}
}

# 10. Scripts présents
`$scripts = Get-ChildItem ".\scripts\*.ps1"
if (`$scripts.Count -ge 5) {
    `$checks += @{Item="Scripts monitoring"; Status="✓ (`$(`$scripts.Count))"; Color="Green"}
} else {
    `$checks += @{Item="Scripts monitoring"; Status="⚠ (`$(`$scripts.Count))"; Color="Yellow"}
}

# Afficher les résultats
Write-Host "`n"
foreach (`$check in `$checks) {
    Write-Host ("`$(`$check.Status.PadRight(3)) `$(`$check.Item)") -ForegroundColor `$check.Color
}

Write-Host "`n"

# Résumé
`$success = (`$checks | Where-Object {`$_.Status -eq "✓"}).Count
`$total = `$checks.Count
`$percent = [math]::Round((`$success / `$total) * 100, 0)

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Résultat : `$success/`$total vérifications réussies (`$percent%)" -ForegroundColor $(if(`$percent -eq 100){"Green"}elseif(`$percent -ge 80){"Yellow"}else{"Red"})
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
"@ | Write-Host -ForegroundColor Gray

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "║  DÉPLOIEMENT TERMINÉ !                                        ║" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Accès au dashboard :" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "  API      : http://localhost:4000" -ForegroundColor White
Write-Host ""
Write-Host "Identifiants par défaut :" -ForegroundColor Cyan
Write-Host "  Email    : admin@semmaris.local" -ForegroundColor White
Write-Host "  Password : admin123" -ForegroundColor White
Write-Host "  ⚠ À CHANGER IMMÉDIATEMENT ⚠" -ForegroundColor Red
Write-Host ""
Write-Host "Logs de monitoring :" -ForegroundColor Cyan
Write-Host "  .\logs\monitoring_$(Get-Date -Format 'yyyyMMdd').log" -ForegroundColor White
Write-Host ""
Write-Host "Commandes utiles :" -ForegroundColor Cyan
Write-Host "  Voir les logs       : docker compose logs -f" -ForegroundColor Gray
Write-Host "  Redémarrer          : .\scripts\DockerManager.ps1 restart" -ForegroundColor Gray
Write-Host "  Backup manuel       : .\scripts\BackupManager.ps1" -ForegroundColor Gray
Write-Host "  Monitoring manuel   : .\scripts\ProductionMonitoring.ps1 -RunOnce" -ForegroundColor Gray
Write-Host ""
