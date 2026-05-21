# StartAllMonitors.ps1 - Lance tous les scripts de monitoring
$scriptsPath = "C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\scripts"
$logFile = Join-Path $scriptsPath "..\logs\monitors-startup.log"
$maxRetries = 5
$retryDelay = 30

# CrÃ©er le dossier logs
$logsDir = Join-Path $scriptsPath "..\logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $logFile -Append -Encoding UTF8
}

Write-Log "=========================================="
Write-Log "DÃ©marrage des Monitors Semmaris"
Write-Log "=========================================="

# Attendre que l'API soit disponible
$apiUrl = "http://10.8.11.230:4000"
$retry = 0
while ($retry -lt $maxRetries) {
    try {
        Write-Log "VÃ©rification de l'API Backend... (tentative $($retry + 1)/$maxRetries)"
        $response = Invoke-WebRequest -Uri "$apiUrl/health" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Log "API Backend disponible!"
            break
        }
    } catch {
        Write-Log "API pas encore disponible: $_"
    }
    
    $retry++
    if ($retry -lt $maxRetries) {
        Write-Log "Attente de ${retryDelay}s avant nouvelle tentative..."
        Start-Sleep -Seconds $retryDelay
    }
}

if ($retry -eq $maxRetries) {
    Write-Log "AVERTISSEMENT: L'API n'a pas rÃ©pondu, dÃ©marrage des monitors quand mÃªme..."
}

# DÃ©marrer les scripts de monitoring en processus background
Write-Log "DÃ©marrage des scripts de monitoring..."

# SimplePing.ps1
$pingScript = Join-Path $scriptsPath "SimplePing.ps1"
if (Test-Path $pingScript) {
    Write-Log "Lancement de SimplePing.ps1..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$pingScript"" -WindowStyle Hidden
    Write-Log "SimplePing.ps1 dÃ©marrÃ©"
} else {
    Write-Log "ERREUR: SimplePing.ps1 introuvable"
}

# CollectSwitchBandwidth.ps1
$bandwidthScript = Join-Path $scriptsPath "CollectSwitchBandwidth.ps1"
if (Test-Path $bandwidthScript) {
    Write-Log "Lancement de CollectSwitchBandwidth.ps1..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$bandwidthScript"" -WindowStyle Hidden
    Write-Log "CollectSwitchBandwidth.ps1 dÃ©marrÃ©"
} else {
    Write-Log "ERREUR: CollectSwitchBandwidth.ps1 introuvable"
}

# CollectSwitchMetrics.ps1
$metricsScript = Join-Path $scriptsPath "CollectSwitchMetrics.ps1"
if (Test-Path $metricsScript) {
    Write-Log "Lancement de CollectSwitchMetrics.ps1..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$metricsScript"" -WindowStyle Hidden
    Write-Log "CollectSwitchMetrics.ps1 dÃ©marrÃ©"
} else {
    Write-Log "ERREUR: CollectSwitchMetrics.ps1 introuvable"
}

# CollectServerMetricsV2.ps1
$serverScript = Join-Path $scriptsPath "CollectServerMetricsV2.ps1"
if (Test-Path $serverScript) {
    Write-Log "Lancement de CollectServerMetricsV2.ps1..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$serverScript"" -WindowStyle Hidden
    Write-Log "CollectServerMetricsV2.ps1 dÃ©marrÃ©"
} else {
    Write-Log "ERREUR: CollectServerMetricsV2.ps1 introuvable"
}

Write-Log "Tous les monitors ont Ã©tÃ© lancÃ©s"
Write-Log "=========================================="
