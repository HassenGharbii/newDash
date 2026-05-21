# InstallMonitoringService.ps1 - Installation du monitoring automatique au démarrage
# Crée une tâche planifiée Windows pour lancer les monitors en continu

param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# Vérifier les droits administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] Ce script nécessite des droits administrateur" -ForegroundColor Red
    Write-Host "Relancez PowerShell en tant qu'administrateur" -ForegroundColor Yellow
    exit 1
}

$taskName = "Dashboard-Monitoring-Service"
$scriptPath = $PSScriptRoot
$startMonitorsScript = Join-Path $scriptPath "StartMonitors.ps1"

if (-not (Test-Path $startMonitorsScript)) {
    Write-Host "[ERROR] Script StartMonitors.ps1 introuvable: $startMonitorsScript" -ForegroundColor Red
    exit 1
}

# Fonction de désinstallation
if ($Uninstall) {
    Write-Host "=== Désinstallation du Service de Monitoring ===" -ForegroundColor Cyan
    
    try {
        $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        
        if ($existingTask) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "[OK] Tâche planifiée supprimée: $taskName" -ForegroundColor Green
        } else {
            Write-Host "[INFO] Aucune tâche planifiée à supprimer" -ForegroundColor Yellow
        }
        
        # Arrêter les monitors en cours
        $jobs = Get-Job | Where-Object { $_.Name -like "Monitor-*" }
        if ($jobs) {
            $jobs | Stop-Job
            $jobs | Remove-Job -Force
            Write-Host "[OK] Monitors arrêtés" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "Désinstallation terminée" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Erreur lors de la désinstallation: $_" -ForegroundColor Red
        exit 1
    }
    
    exit 0
}

# Installation
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Installation du Service de Monitoring Automatique" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Supprimer la tâche existante si elle existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "[INFO] Suppression de la tâche existante..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Créer la commande PowerShell qui sera exécutée
$psCommand = "Set-Location '$scriptPath'; & '$startMonitorsScript' -Restart"

# Action : Exécuter PowerShell avec le script
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"$psCommand`""

# Déclencheur : Au démarrage du système + délai de 30 secondes
$triggerStartup = New-ScheduledTaskTrigger -AtStartup
$triggerStartup.Delay = 'PT30S'  # Délai de 30 secondes après le démarrage

# Déclencheur supplémentaire : Si la tâche échoue, redémarrer après 1 minute
$triggerOnFailure = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)

# Paramètres de la tâche
$settings = New-ScheduledTaskSettings -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$settings.ExecutionTimeLimit = 'PT0S'  # Pas de limite de temps d'exécution

# Principal : Exécuter sous le compte SYSTEM avec les privilèges les plus élevés
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Créer la tâche planifiée
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggerStartup -Settings $settings -Principal $principal -Description "Service de monitoring continu pour le Dashboard Semmaris (Ping, SNMP, Bandwidth)" | Out-Null
    
    Write-Host "[OK] Tâche planifiée créée: $taskName" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Cyan
    Write-Host "  - Démarrage: Automatique au boot (délai 30s)" -ForegroundColor Gray
    Write-Host "  - Compte: SYSTEM" -ForegroundColor Gray
    Write-Host "  - Script: $startMonitorsScript" -ForegroundColor Gray
    Write-Host "  - Redémarrage auto: Oui (3 tentatives, intervalle 1 min)" -ForegroundColor Gray
    Write-Host ""
    
    # Démarrer la tâche immédiatement
    Write-Host "[INFO] Démarrage immédiat de la tâche..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $taskName
    
    Start-Sleep -Seconds 3
    
    # Vérifier l'état
    $task = Get-ScheduledTask -TaskName $taskName
    $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
    
    Write-Host ""
    Write-Host "État de la tâche:" -ForegroundColor Cyan
    Write-Host "  - État: $($task.State)" -ForegroundColor $(if ($task.State -eq 'Running') { 'Green' } else { 'Yellow' })
    Write-Host "  - Dernière exécution: $($taskInfo.LastRunTime)" -ForegroundColor Gray
    Write-Host "  - Prochaine exécution: $($taskInfo.NextRunTime)" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host "   ✓ Installation terminée avec succès !" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Les monitors sont maintenant actifs et se lanceront automatiquement" -ForegroundColor Cyan
    Write-Host "au démarrage de Windows." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Commandes utiles:" -ForegroundColor Yellow
    Write-Host "  • Vérifier l'état:      .\StartMonitors.ps1 -Status" -ForegroundColor White
    Write-Host "  • Voir les logs:        Get-Content ..\logs\*-monitor.log -Wait -Tail 20" -ForegroundColor White
    Write-Host "  • Redémarrer:           Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "  • Arrêter:              Stop-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
    Write-Host "  • Désinstaller:         .\InstallMonitoringService.ps1 -Uninstall" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "[ERROR] Erreur lors de la création de la tâche planifiée: $_" -ForegroundColor Red
    exit 1
}
