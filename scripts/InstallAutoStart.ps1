# InstallAutoStart.ps1 - Configure le démarrage automatique des monitors au boot Windows

#Requires -RunAsAdministrator

param(
    [switch]$Uninstall
)

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$startMonitorsScript = Join-Path $scriptPath "StartMonitors.ps1"
$taskName = "Semmaris-Monitors"

function Install-AutoStart {
    Write-Host "[INFO] Installation du démarrage automatique des monitors..." -ForegroundColor Cyan

    # Vérifier que le script existe
    if (-not (Test-Path $startMonitorsScript)) {
        Write-Host "[ERROR] Script StartMonitors.ps1 introuvable: $startMonitorsScript" -ForegroundColor Red
        exit 1
    }

    # Supprimer la tâche si elle existe déjà
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "[INFO] Suppression de la tâche existante..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    # Créer l'action
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startMonitorsScript`""

    # Créer le déclencheur (au démarrage + 30 secondes pour laisser le réseau s'initialiser)
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $trigger.Delay = "PT30S"

    # Créer les paramètres
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

    # Créer le principal (exécuter en tant que SYSTEM pour ne pas dépendre d'une session utilisateur)
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    # Enregistrer la tâche
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Lance les monitors Ping et Bandwidth pour le dashboard Semmaris"

    Write-Host "[OK] Tâche planifiée créée avec succès!" -ForegroundColor Green
    Write-Host "`nDétails de la tâche:" -ForegroundColor Cyan
    Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State, Description
    
    Write-Host "`nLa tâche s'exécutera:" -ForegroundColor Cyan
    Write-Host "  - Au démarrage de Windows (avec délai de 30s)" -ForegroundColor White
    Write-Host "  - En tant que SYSTEM (service système)" -ForegroundColor White
    Write-Host "  - Redémarrage automatique en cas d'échec (3 tentatives)" -ForegroundColor White
    
    Write-Host "`nCommandes utiles:" -ForegroundColor Cyan
    Write-Host "  Start-ScheduledTask -TaskName '$taskName'     # Démarrer maintenant"
    Write-Host "  Stop-ScheduledTask -TaskName '$taskName'      # Arrêter"
    Write-Host "  Get-ScheduledTask -TaskName '$taskName'       # Voir l'état"
    Write-Host "  .\StartMonitors.ps1 -Status                   # État des monitors"
}

function Uninstall-AutoStart {
    Write-Host "[INFO] Désinstallation du démarrage automatique..." -ForegroundColor Yellow
    
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "[OK] Tâche '$taskName' supprimée" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Tâche '$taskName' non trouvée" -ForegroundColor Cyan
    }
    
    # Arrêter les monitors en cours
    Write-Host "[INFO] Arrêt des monitors en cours..." -ForegroundColor Yellow
    & $startMonitorsScript -Stop
}

# Main
if ($Uninstall) {
    Uninstall-AutoStart
} else {
    Install-AutoStart
}
