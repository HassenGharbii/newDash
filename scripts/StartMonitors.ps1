# StartMonitors.ps1 - Lance les monitors ping et bandwidth en arrière-plan

param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Status
)

$scriptPath = $PSScriptRoot
$pingScript = Join-Path $scriptPath "SimplePing.ps1"
$snmpScript = Join-Path $scriptPath "SNMPMonitor.ps1"
$bandwidthScript = Join-Path $scriptPath "BandwidthCollector.ps1"
$serverScript = Join-Path $scriptPath "CollectServerMetricsV2.ps1"
$logDir = Join-Path $scriptPath "..\logs"

# Créer le dossier logs s'il n'existe pas
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$pingLogFile = Join-Path $logDir "ping-monitor.log"
$snmpLogFile = Join-Path $logDir "snmp-monitor.log"
$bandwidthLogFile = Join-Path $logDir "bandwidth-monitor.log"
$serverLogFile = Join-Path $logDir "server-monitor.log"

function Get-MonitorJobs {
    Get-Job | Where-Object { $_.Name -like "Monitor-*" }
}

function Stop-Monitors {
    Write-Host "[INFO] Arrêt des monitors..." -ForegroundColor Yellow
    $jobs = Get-MonitorJobs
    if ($jobs) {
        $jobs | Stop-Job
        $jobs | Remove-Job -Force
        Write-Host "[OK] Monitors arrêtés" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Aucun monitor en cours d'exécution" -ForegroundColor Cyan
    }
}

function Show-MonitorStatus {
    Write-Host "`n=== État des Monitors ===" -ForegroundColor Cyan
    $jobs = Get-MonitorJobs
    if ($jobs) {
        $jobs | Format-Table Name, State, HasMoreData, @{Label="Running Since"; Expression={(Get-Date) - $_.PSBeginTime}} -AutoSize
        
        Write-Host "`nDernières lignes des logs:" -ForegroundColor Cyan
        Write-Host "`n--- Ping Monitor ---" -ForegroundColor Yellow
        if (Test-Path $pingLogFile) {
            Get-Content $pingLogFile -Tail 5
        } else {
            Write-Host "Pas encore de logs"
        }
        
        Write-Host "\n--- SNMP Monitor (Switches) ---" -ForegroundColor Yellow
        if (Test-Path $snmpLogFile) {
            Get-Content $snmpLogFile -Tail 5
        } else {
            Write-Host "Pas encore de logs"
        }
        
        Write-Host "\n--- Bandwidth Monitor ---" -ForegroundColor Yellow
        if (Test-Path $bandwidthLogFile) {
            Get-Content $bandwidthLogFile -Tail 5
        } else {
            Write-Host "Pas encore de logs"
        }
        
        Write-Host "\n--- Server Monitor ---" -ForegroundColor Yellow
        if (Test-Path $serverLogFile) {
            Get-Content $serverLogFile -Tail 5
        } else {
            Write-Host "Pas encore de logs"
        }
    } else {
        Write-Host "Aucun monitor actif" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Start-Monitors {
    # Vérifier si déjà en cours
    $existing = Get-MonitorJobs
    if ($existing) {
        Write-Host "[WARN] Des monitors sont déjà en cours. Utilisez -Restart pour redémarrer." -ForegroundColor Yellow
        Show-MonitorStatus
        return
    }

    Write-Host "[INFO] Démarrage des monitors en arrière-plan..." -ForegroundColor Cyan

    # Lancer Ping Monitor
    Write-Host "[INFO] Lancement Ping Monitor..." -ForegroundColor Cyan
    $pingJob = Start-Job -Name "Monitor-Ping" -ScriptBlock {
        param($scriptContent, $scriptPath)
        # Définir l'ExecutionPolicy pour le job
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
        # Exécuter le script avec le paramètre ScriptRoot
        $sb = [ScriptBlock]::Create($scriptContent)
        & $sb -ScriptRoot $scriptPath
    } -ArgumentList (Get-Content $pingScript -Raw), $scriptPath
    
    Start-Sleep -Milliseconds 500

    # Lancer SNMP Monitor (collecte switches toutes les 2 minutes)
    Write-Host "[INFO] Lancement SNMP Monitor (switches)..." -ForegroundColor Cyan
    $snmpJob = Start-Job -Name "Monitor-SNMP" -ScriptBlock {
        param($scriptContent, $scriptPath)
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
        $sb = [ScriptBlock]::Create($scriptContent)
        & $sb -IntervalSeconds 120 -ScriptRoot $scriptPath
    } -ArgumentList (Get-Content $snmpScript -Raw), $scriptPath
    
    Start-Sleep -Milliseconds 500
    
    # Lancer Bandwidth Collector (collecte bande passante toutes les 2 minutes)
    Write-Host "[INFO] Lancement Bandwidth Collector..." -ForegroundColor Cyan
    $bandwidthJob = Start-Job -Name "Monitor-Bandwidth" -ScriptBlock {
        param($scriptContent, $scriptPath)
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
        $sb = [ScriptBlock]::Create($scriptContent)
        & $sb -IntervalSeconds 120 -ScriptRoot $scriptPath
    } -ArgumentList (Get-Content $bandwidthScript -Raw), $scriptPath
    
    Start-Sleep -Milliseconds 500
    
    # Lancer Server Metrics Collector V2 (collecte métriques serveurs toutes les 2 minutes)
    Write-Host "[INFO] Lancement Server Metrics Collector V2..." -ForegroundColor Cyan
    $serverJob = Start-Job -Name "Monitor-Servers" -ScriptBlock {
        param($scriptContent, $scriptPath)
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
        $sb = [ScriptBlock]::Create($scriptContent)
        & $sb -IntervalSeconds 120 -ScriptRoot $scriptPath
    } -ArgumentList (Get-Content $serverScript -Raw), $scriptPath

    Start-Sleep -Seconds 2

    Write-Host "`n[OK] Monitors démarrés!" -ForegroundColor Green
    Show-MonitorStatus
    
    Write-Host "`nCommandes utiles:" -ForegroundColor Cyan
    Write-Host "  .\StartMonitors.ps1 -Status    # Voir l'état"
    Write-Host "  .\StartMonitors.ps1 -Stop      # Arrêter"
    Write-Host "  .\StartMonitors.ps1 -Restart   # Redémarrer"
    Write-Host "  Get-Content '$pingLogFile' -Wait -Tail 20        # Suivre logs ping"
    Write-Host "  Get-Content '$snmpLogFile' -Wait -Tail 20        # Suivre logs SNMP"
    Write-Host "  Get-Content '$bandwidthLogFile' -Wait -Tail 20   # Suivre logs bandwidth"
    Write-Host "  Get-Content '$serverLogFile' -Wait -Tail 20      # Suivre logs serveurs"
}

# Main
if ($Stop) {
    Stop-Monitors
} elseif ($Status) {
    Show-MonitorStatus
} elseif ($Restart) {
    Stop-Monitors
    Start-Sleep -Seconds 1
    Start-Monitors
} else {
    Start-Monitors
}
