# SNMPMonitor.ps1 - Surveillance continue des switches via SNMP

param(
    [int]$IntervalSeconds = 120,
    [string]$ScriptRoot = $PSScriptRoot
)

$scriptPath = $ScriptRoot
$collectScript = Join-Path $scriptPath "CollectSwitchMetrics.ps1"
$configFile = Join-Path $scriptPath "config.json"

if (-not (Test-Path $collectScript)) {
    Write-Error "Script CollectSwitchMetrics.ps1 introuvable"
    exit 1
}

Write-Host "[INFO] Demarrage SNMP Monitor - Intervalle: ${IntervalSeconds}s" -ForegroundColor Cyan
Write-Host ""

$cycleCount = 0
while ($true) {
    $cycleCount++
    $cycleStart = Get-Date
    
    Write-Host "-------------------------------------------------------" -ForegroundColor Gray
    Write-Host "[CYCLE #$cycleCount] $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        & $collectScript -ConfigFile $configFile
    } catch {
        Write-Warning "Erreur lors de la collecte: $_"
    }
    
    $cycleDuration = ((Get-Date) - $cycleStart).TotalSeconds
    Write-Host ""
    Write-Host "[CYCLE] Termine en $([math]::Round($cycleDuration, 1))s" -ForegroundColor Green
    Write-Host "  Prochain cycle dans ${IntervalSeconds}s..." -ForegroundColor Yellow
    Write-Host ""
    
    Start-Sleep -Seconds $IntervalSeconds
}
