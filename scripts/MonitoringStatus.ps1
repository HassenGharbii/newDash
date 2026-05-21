# MonitoringStatus.ps1 - Affiche l'état complet du système de monitoring

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   État du Système de Monitoring" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la tâche planifiée
Write-Host "[1] Tâche Planifiée Windows" -ForegroundColor Yellow
Write-Host "    ----------------------" -ForegroundColor Gray

$taskName = "Dashboard-Monitoring-Service"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($task) {
    $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
    $stateColor = switch ($task.State) {
        'Running' { 'Green' }
        'Ready' { 'Cyan' }
        'Disabled' { 'Red' }
        default { 'Yellow' }
    }
    
    Write-Host "    Nom: $taskName" -ForegroundColor Gray
    Write-Host "    État: $($task.State)" -ForegroundColor $stateColor
    Write-Host "    Dernière exécution: $($taskInfo.LastRunTime)" -ForegroundColor Gray
    Write-Host "    Résultat: $($taskInfo.LastTaskResult)" -ForegroundColor $(if ($taskInfo.LastTaskResult -eq 0) { 'Green' } else { 'Red' })
    Write-Host "    Prochaine exécution: $($taskInfo.NextRunTime)" -ForegroundColor Gray
} else {
    Write-Host "    ✗ Tâche planifiée non installée" -ForegroundColor Red
    Write-Host "    → Exécutez: .\InstallMonitoringService.ps1" -ForegroundColor Yellow
}

Write-Host ""

# 2. Vérifier les jobs PowerShell
Write-Host "[2] Jobs PowerShell (Monitors)" -ForegroundColor Yellow
Write-Host "    --------------------------" -ForegroundColor Gray

$jobs = Get-Job | Where-Object { $_.Name -like "Monitor-*" }

if ($jobs) {
    foreach ($job in $jobs) {
        $stateColor = switch ($job.State) {
            'Running' { 'Green' }
            'Completed' { 'Cyan' }
            'Failed' { 'Red' }
            'Stopped' { 'Yellow' }
            default { 'Gray' }
        }
        
        $runtime = (Get-Date) - $job.PSBeginTime
        Write-Host "    $($job.Name)" -ForegroundColor White
        Write-Host "      État: $($job.State)" -ForegroundColor $stateColor
        Write-Host "      Durée: $([int]$runtime.TotalHours)h $($runtime.Minutes)m $($runtime.Seconds)s" -ForegroundColor Gray
    }
} else {
    Write-Host "    ⊘ Aucun monitor actif" -ForegroundColor Yellow
    Write-Host "    → Exécutez: .\StartMonitors.ps1" -ForegroundColor Yellow
}

Write-Host ""

# 3. Vérifier les logs
Write-Host "[3] Logs de Monitoring" -ForegroundColor Yellow
Write-Host "    ------------------" -ForegroundColor Gray

$scriptPath = $PSScriptRoot
$logDir = Join-Path $scriptPath "..\logs"

if (Test-Path $logDir) {
    $logFiles = @(
        @{Name="Ping"; File="ping-monitor.log"},
        @{Name="SNMP"; File="snmp-monitor.log"},
        @{Name="Bandwidth"; File="bandwidth-monitor.log"}
    )
    
    foreach ($logFile in $logFiles) {
        $logPath = Join-Path $logDir $logFile.File
        if (Test-Path $logPath) {
            $lastWrite = (Get-Item $logPath).LastWriteTime
            $size = [math]::Round((Get-Item $logPath).Length / 1KB, 2)
            $ageMinutes = [math]::Round(((Get-Date) - $lastWrite).TotalMinutes, 1)
            
            $ageColor = if ($ageMinutes -lt 5) { 'Green' } elseif ($ageMinutes -lt 15) { 'Yellow' } else { 'Red' }
            
            Write-Host "    $($logFile.Name) ($($logFile.File))" -ForegroundColor White
            Write-Host "      Taille: $size KB" -ForegroundColor Gray
            Write-Host "      Dernière écriture: il y a $ageMinutes min" -ForegroundColor $ageColor
        } else {
            Write-Host "    $($logFile.Name): Fichier introuvable" -ForegroundColor Red
        }
    }
} else {
    Write-Host "    ⊘ Dossier logs introuvable: $logDir" -ForegroundColor Red
}

Write-Host ""

# 4. Vérifier la connectivité API
Write-Host "[4] Connectivité Backend" -ForegroundColor Yellow
Write-Host "    --------------------" -ForegroundColor Gray

$configFile = Join-Path $scriptPath "config.json"
if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        $apiBase = $config.apiBase
        
        # Test de connexion
        $response = Invoke-RestMethod -Uri "$apiBase/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
        Write-Host "    API: $apiBase" -ForegroundColor Gray
        Write-Host "    État: ✓ En ligne" -ForegroundColor Green
    } catch {
        Write-Host "    API: $apiBase" -ForegroundColor Gray
        Write-Host "    État: ✗ Hors ligne ou inaccessible" -ForegroundColor Red
    }
} else {
    Write-Host "    ⊘ Fichier config.json introuvable" -ForegroundColor Red
}

Write-Host ""

# 5. Statistiques récentes
Write-Host "[5] Statistiques (Dernières 24h)" -ForegroundColor Yellow
Write-Host "    -----------------------------" -ForegroundColor Gray

if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
        $apiBase = $config.apiBase
        
        # Authentification
        $loginBody = @{ identifier = $config.adminEmail; password = $config.adminPassword } | ConvertTo-Json
        $token = (Invoke-RestMethod -Uri "$apiBase/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -TimeoutSec 5).token
        $headers = @{ Authorization = "Bearer $token" }
        
        # Statistiques equipment
        $equipment = Invoke-RestMethod -Uri "$apiBase/equipment" -Headers $headers -TimeoutSec 5
        $upCount = ($equipment | Where-Object { $_.status -eq 'up' }).Count
        $downCount = ($equipment | Where-Object { $_.status -eq 'down' }).Count
        
        Write-Host "    Équipements:" -ForegroundColor White
        Write-Host "      En ligne: $upCount" -ForegroundColor Green
        Write-Host "      Hors ligne: $downCount" -ForegroundColor $(if ($downCount -gt 0) { 'Red' } else { 'Gray' })
        
        # Statistiques bandwidth
        $bandwidthRecords = Invoke-RestMethod -Uri "$apiBase/bandwidth?hours=24" -Headers $headers -TimeoutSec 5
        Write-Host "    Bande passante:" -ForegroundColor White
        Write-Host "      Enregistrements (24h): $($bandwidthRecords.Count)" -ForegroundColor Gray
        
        if ($bandwidthRecords.Count -gt 0) {
            $lastRecord = $bandwidthRecords | Select-Object -First 1
            $lastTime = [DateTime]::Parse($lastRecord.timestamp)
            $ageMinutes = [math]::Round(((Get-Date).ToUniversalTime() - $lastTime).TotalMinutes, 1)
            Write-Host "      Dernière collecte: il y a $ageMinutes min" -ForegroundColor $(if ($ageMinutes -lt 5) { 'Green' } else { 'Yellow' })
        }
        
    } catch {
        Write-Host "    ⊘ Impossible de récupérer les statistiques" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Résumé global
$allGreen = $true
if (-not $task -or $task.State -ne 'Running') { $allGreen = $false }
if (-not $jobs -or ($jobs | Where-Object { $_.State -ne 'Running' })) { $allGreen = $false }

if ($allGreen) {
    Write-Host "✓ Tous les systèmes fonctionnent normalement" -ForegroundColor Green
} else {
    Write-Host "⚠ Certains systèmes nécessitent une attention" -ForegroundColor Yellow
}

Write-Host ""
