# InstallDashboardAutoStart.ps1 - Configure le démarrage automatique complet du dashboard au boot

#Requires -RunAsAdministrator

param(
    [switch]$Uninstall
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$dockerComposeFile = Join-Path $projectRoot "docker-compose.yml"
$scriptsPath = $PSScriptRoot

# Noms des tâches planifiées
$dockerTaskName = "Semmaris-Dashboard-Docker"
$monitorsTaskName = "Semmaris-Monitors"

function Test-DockerRunning {
    try {
        $dockerInfo = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Install-DashboardAutoStart {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  Installation Démarrage Automatique" -ForegroundColor Cyan
    Write-Host "  Dashboard Semmaris" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan

    # Vérifier que Docker est installé
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] Docker n'est pas installé ou pas dans le PATH" -ForegroundColor Red
        Write-Host "[INFO] Installez Docker Desktop depuis: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        exit 1
    }

    # Vérifier que docker-compose.yml existe
    if (-not (Test-Path $dockerComposeFile)) {
        Write-Host "[ERROR] Fichier docker-compose.yml introuvable: $dockerComposeFile" -ForegroundColor Red
        exit 1
    }

    Write-Host "[1/3] Configuration du démarrage automatique Docker Compose..." -ForegroundColor Cyan

    # Supprimer la tâche Docker si elle existe
    $existingDockerTask = Get-ScheduledTask -TaskName $dockerTaskName -ErrorAction SilentlyContinue
    if ($existingDockerTask) {
        Write-Host "      Suppression de la tâche existante..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $dockerTaskName -Confirm:$false
    }

    # Créer un script wrapper pour Docker Compose
    $wrapperScript = Join-Path $scriptsPath "StartDashboardDocker.ps1"
    $wrapperContent = @"
# StartDashboardDocker.ps1 - Lance Docker Compose pour le dashboard
`$projectRoot = "$projectRoot"
`$logFile = Join-Path `$projectRoot "logs\docker-startup.log"
`$maxRetries = 10
`$retryDelay = 30

# Créer le dossier logs
`$logsDir = Join-Path `$projectRoot "logs"
if (-not (Test-Path `$logsDir)) {
    New-Item -ItemType Directory -Path `$logsDir -Force | Out-Null
}

# Logger
function Write-Log {
    param([string]`$Message)
    `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "`$timestamp - `$Message" | Out-File -FilePath `$logFile -Append -Encoding UTF8
}

Write-Log "=========================================="
Write-Log "Démarrage du Dashboard Semmaris"
Write-Log "=========================================="

# Attendre que Docker soit prêt
`$retry = 0
while (`$retry -lt `$maxRetries) {
    try {
        Write-Log "Vérification de Docker... (tentative `$(`$retry + 1)/`$maxRetries)"
        `$dockerInfo = docker info 2>&1
        if (`$LASTEXITCODE -eq 0) {
            Write-Log "Docker est prêt!"
            break
        }
    } catch {
        Write-Log "Docker pas encore prêt: `$_"
    }
    
    `$retry++
    if (`$retry -lt `$maxRetries) {
        Write-Log "Attente de `${retryDelay}s avant nouvelle tentative..."
        Start-Sleep -Seconds `$retryDelay
    }
}

if (`$retry -eq `$maxRetries) {
    Write-Log "ERREUR: Docker n'a pas démarré après `$maxRetries tentatives"
    exit 1
}

# Changer vers le répertoire du projet
Set-Location `$projectRoot
Write-Log "Répertoire de travail: `$projectRoot"

# Arrêter les anciens conteneurs si présents
Write-Log "Arrêt des conteneurs existants..."
docker-compose down 2>&1 | Out-File -FilePath `$logFile -Append -Encoding UTF8

# Démarrer les conteneurs
Write-Log "Démarrage des conteneurs Docker Compose..."
docker-compose up -d 2>&1 | Out-File -FilePath `$logFile -Append -Encoding UTF8

if (`$LASTEXITCODE -eq 0) {
    Write-Log "Dashboard démarré avec succès!"
    Write-Log "Frontend: http://10.8.11.230:5173"
    Write-Log "Backend API: http://10.8.11.230:4000"
} else {
    Write-Log "ERREUR lors du démarrage des conteneurs (code: `$LASTEXITCODE)"
    exit 1
}

Write-Log "=========================================="
"@
    Set-Content -Path $wrapperScript -Value $wrapperContent -Encoding UTF8
    Write-Host "      Script wrapper créé: $wrapperScript" -ForegroundColor Green

    # Créer la tâche planifiée pour Docker
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapperScript`""
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $trigger.Delay = "PT2M"  # 2 minutes pour laisser Docker Desktop démarrer
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2)
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    Register-ScheduledTask -TaskName $dockerTaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Démarre automatiquement le dashboard Semmaris (Docker Compose)" | Out-Null
    Write-Host "      Tâche planifiée '$dockerTaskName' créée" -ForegroundColor Green

    # Configuration des monitors
    Write-Host "`n[2/3] Configuration du démarrage automatique des Monitors..." -ForegroundColor Cyan

    # Supprimer la tâche Monitors si elle existe
    $existingMonitorsTask = Get-ScheduledTask -TaskName $monitorsTaskName -ErrorAction SilentlyContinue
    if ($existingMonitorsTask) {
        Write-Host "      Suppression de la tâche existante..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $monitorsTaskName -Confirm:$false
    }

    # Créer un script wrapper pour les monitors
    $monitorsWrapperScript = Join-Path $scriptsPath "StartAllMonitors.ps1"
    $monitorsWrapperContent = @"
# StartAllMonitors.ps1 - Lance tous les scripts de monitoring
`$scriptsPath = "$scriptsPath"
`$logFile = Join-Path `$scriptsPath "..\logs\monitors-startup.log"
`$maxRetries = 5
`$retryDelay = 30

# Créer le dossier logs
`$logsDir = Join-Path `$scriptsPath "..\logs"
if (-not (Test-Path `$logsDir)) {
    New-Item -ItemType Directory -Path `$logsDir -Force | Out-Null
}

function Write-Log {
    param([string]`$Message)
    `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "`$timestamp - `$Message" | Out-File -FilePath `$logFile -Append -Encoding UTF8
}

Write-Log "=========================================="
Write-Log "Démarrage des Monitors Semmaris"
Write-Log "=========================================="

# Attendre que l'API soit disponible
`$apiUrl = "http://10.8.11.230:4000"
`$retry = 0
while (`$retry -lt `$maxRetries) {
    try {
        Write-Log "Vérification de l'API Backend... (tentative `$(`$retry + 1)/`$maxRetries)"
        `$response = Invoke-WebRequest -Uri "`$apiUrl/health" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        if (`$response.StatusCode -eq 200) {
            Write-Log "API Backend disponible!"
            break
        }
    } catch {
        Write-Log "API pas encore disponible: `$_"
    }
    
    `$retry++
    if (`$retry -lt `$maxRetries) {
        Write-Log "Attente de `${retryDelay}s avant nouvelle tentative..."
        Start-Sleep -Seconds `$retryDelay
    }
}

if (`$retry -eq `$maxRetries) {
    Write-Log "AVERTISSEMENT: L'API n'a pas répondu, démarrage des monitors quand même..."
}

# Démarrer les scripts de monitoring en processus background
Write-Log "Démarrage des scripts de monitoring..."

# SimplePing.ps1
`$pingScript = Join-Path `$scriptsPath "SimplePing.ps1"
if (Test-Path `$pingScript) {
    Write-Log "Lancement de SimplePing.ps1..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"`$pingScript`"" -WindowStyle Hidden
    Write-Log "SimplePing.ps1 démarré"
} else {
    Write-Log "ERREUR: SimplePing.ps1 introuvable"
}

# CollectSwitchBandwidth.ps1
`$bandwidthScript = Join-Path `$scriptsPath "CollectSwitchBandwidth.ps1"
if (Test-Path `$bandwidthScript) {
    Write-Log "Lancement de CollectSwitchBandwidth.ps1..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"`$bandwidthScript`"" -WindowStyle Hidden
    Write-Log "CollectSwitchBandwidth.ps1 démarré"
} else {
    Write-Log "ERREUR: CollectSwitchBandwidth.ps1 introuvable"
}

# CollectSwitchMetrics.ps1
`$metricsScript = Join-Path `$scriptsPath "CollectSwitchMetrics.ps1"
if (Test-Path `$metricsScript) {
    Write-Log "Lancement de CollectSwitchMetrics.ps1..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"`$metricsScript`"" -WindowStyle Hidden
    Write-Log "CollectSwitchMetrics.ps1 démarré"
} else {
    Write-Log "ERREUR: CollectSwitchMetrics.ps1 introuvable"
}

# CollectServerMetricsV2.ps1
`$serverScript = Join-Path `$scriptsPath "CollectServerMetricsV2.ps1"
if (Test-Path `$serverScript) {
    Write-Log "Lancement de CollectServerMetricsV2.ps1..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"`$serverScript`"" -WindowStyle Hidden
    Write-Log "CollectServerMetricsV2.ps1 démarré"
} else {
    Write-Log "ERREUR: CollectServerMetricsV2.ps1 introuvable"
}

Write-Log "Tous les monitors ont été lancés"
Write-Log "=========================================="
"@
    Set-Content -Path $monitorsWrapperScript -Value $monitorsWrapperContent -Encoding UTF8
    Write-Host "      Script wrapper créé: $monitorsWrapperScript" -ForegroundColor Green

    # Créer la tâche planifiée pour les Monitors
    $monitorsAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$monitorsWrapperScript`""
    $monitorsTrigger = New-ScheduledTaskTrigger -AtStartup
    $monitorsTrigger.Delay = "PT4M"  # 4 minutes pour attendre que Docker et l'API soient prêts
    $monitorsSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2)
    $monitorsPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    Register-ScheduledTask -TaskName $monitorsTaskName -Action $monitorsAction -Trigger $monitorsTrigger -Settings $monitorsSettings -Principal $monitorsPrincipal -Description "Démarre automatiquement les scripts de monitoring (Ping, Bandwidth, Metrics)" | Out-Null
    Write-Host "      Tâche planifiée '$monitorsTaskName' créée" -ForegroundColor Green

    # Ajouter restart: always aux services Docker
    Write-Host "`n[3/3] Configuration de la politique de redémarrage Docker..." -ForegroundColor Cyan
    $dockerComposeContent = Get-Content $dockerComposeFile -Raw
    
    $needsUpdate = $false
    if ($dockerComposeContent -notmatch "api:[\s\S]*?restart:\s*always") {
        $needsUpdate = $true
    }

    if ($needsUpdate) {
        # Backup du fichier original
        $backupFile = "$dockerComposeFile.backup"
        Copy-Item $dockerComposeFile $backupFile -Force
        Write-Host "      Backup créé: $backupFile" -ForegroundColor Yellow

        # Modifier le fichier pour ajouter restart: always à tous les services
        $dockerComposeContent = $dockerComposeContent -replace '(services:\s+api:)', '$1'
        $dockerComposeContent = $dockerComposeContent -replace '(?m)(^\s+volumes:\s*\r?\n\s+- .*data.*\r?\n)', "`$1    restart: always`n"
        
        # Pour le frontend (après depends_on)
        $dockerComposeContent = $dockerComposeContent -replace '(?m)(^\s+depends_on:\s*\r?\n\s+- api\r?\n)(\s+frontend)', "`$1    restart: always`n`$2"
        
        Set-Content -Path $dockerComposeFile -Value $dockerComposeContent -Encoding UTF8
        Write-Host "      Politique 'restart: always' ajoutée aux services" -ForegroundColor Green
    } else {
        Write-Host "      Politique de redémarrage déjà configurée" -ForegroundColor Green
    }

    # Résumé
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  Installation Terminée!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green

    Write-Host "Configuration appliquée:" -ForegroundColor Cyan
    Write-Host "  ✓ Tâche '$dockerTaskName'" -ForegroundColor White
    Write-Host "    - Démarre 2 minutes après le boot" -ForegroundColor Gray
    Write-Host "    - Lance Docker Compose automatiquement" -ForegroundColor Gray
    Write-Host "    - Frontend: http://10.8.11.230:5173" -ForegroundColor Gray
    Write-Host "    - Backend: http://10.8.11.230:4000" -ForegroundColor Gray
    
    Write-Host "`n  ✓ Tâche '$monitorsTaskName'" -ForegroundColor White
    Write-Host "    - Démarre 4 minutes après le boot" -ForegroundColor Gray
    Write-Host "    - Lance SimplePing.ps1" -ForegroundColor Gray
    Write-Host "    - Lance CollectSwitchBandwidth.ps1" -ForegroundColor Gray
    Write-Host "    - Lance CollectSwitchMetrics.ps1" -ForegroundColor Gray
    Write-Host "    - Lance CollectServerMetricsV2.ps1" -ForegroundColor Gray

    Write-Host "`n  ✓ Docker Compose" -ForegroundColor White
    Write-Host "    - Politique 'restart: always' activée" -ForegroundColor Gray
    Write-Host "    - Conteneurs redémarrent automatiquement" -ForegroundColor Gray

    Write-Host "`nCommandes utiles:" -ForegroundColor Cyan
    Write-Host "  # Voir l'état des tâches" -ForegroundColor Yellow
    Write-Host "  Get-ScheduledTask -TaskName 'Semmaris-*' | Format-Table" -ForegroundColor White
    
    Write-Host "`n  # Démarrer maintenant (sans redémarrer)" -ForegroundColor Yellow
    Write-Host "  Start-ScheduledTask -TaskName '$dockerTaskName'" -ForegroundColor White
    Write-Host "  Start-ScheduledTask -TaskName '$monitorsTaskName'" -ForegroundColor White
    
    Write-Host "`n  # Voir les logs" -ForegroundColor Yellow
    Write-Host "  Get-Content '$projectRoot\logs\docker-startup.log' -Tail 20" -ForegroundColor White
    Write-Host "  Get-Content '$projectRoot\logs\monitors-startup.log' -Tail 20" -ForegroundColor White
    
    Write-Host "`n  # Arrêter les tâches" -ForegroundColor Yellow
    Write-Host "  Stop-ScheduledTask -TaskName '$dockerTaskName'" -ForegroundColor White
    Write-Host "  Stop-ScheduledTask -TaskName '$monitorsTaskName'" -ForegroundColor White

    Write-Host "`n  # Désinstaller" -ForegroundColor Yellow
    Write-Host "  .\InstallDashboardAutoStart.ps1 -Uninstall" -ForegroundColor White

    Write-Host "`n========================================`n" -ForegroundColor Green
}

function Uninstall-DashboardAutoStart {
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "  Désinstallation Démarrage Automatique" -ForegroundColor Yellow
    Write-Host "========================================`n" -ForegroundColor Yellow

    $removed = $false

    # Supprimer la tâche Docker
    $dockerTask = Get-ScheduledTask -TaskName $dockerTaskName -ErrorAction SilentlyContinue
    if ($dockerTask) {
        Unregister-ScheduledTask -TaskName $dockerTaskName -Confirm:$false
        Write-Host "[OK] Tâche '$dockerTaskName' supprimée" -ForegroundColor Green
        $removed = $true
    }

    # Supprimer la tâche Monitors
    $monitorsTask = Get-ScheduledTask -TaskName $monitorsTaskName -ErrorAction SilentlyContinue
    if ($monitorsTask) {
        Unregister-ScheduledTask -TaskName $monitorsTaskName -Confirm:$false
        Write-Host "[OK] Tâche '$monitorsTaskName' supprimée" -ForegroundColor Green
        $removed = $true
    }

    if (-not $removed) {
        Write-Host "[INFO] Aucune tâche à supprimer" -ForegroundColor Cyan
    }

    # Supprimer les scripts wrappers
    $wrapperScript = Join-Path $scriptsPath "StartDashboardDocker.ps1"
    if (Test-Path $wrapperScript) {
        Remove-Item $wrapperScript -Force
        Write-Host "[OK] Script wrapper Docker supprimé" -ForegroundColor Green
    }

    $monitorsWrapperScript = Join-Path $scriptsPath "StartAllMonitors.ps1"
    if (Test-Path $monitorsWrapperScript) {
        Remove-Item $monitorsWrapperScript -Force
        Write-Host "[OK] Script wrapper Monitors supprimé" -ForegroundColor Green
    }

    Write-Host "`n[INFO] Les conteneurs Docker continuent de tourner" -ForegroundColor Cyan
    Write-Host "[INFO] Pour les arrêter: docker-compose down" -ForegroundColor Cyan
    Write-Host "`n========================================`n" -ForegroundColor Yellow
}

# Main
if ($Uninstall) {
    Uninstall-DashboardAutoStart
} else {
    Install-DashboardAutoStart
}
