# =====================================================
# Script d'Automatisation Complète - Monitoring Production
# =====================================================
# Orchestre tous les scripts de monitoring en production
# - Ping des équipements
# - Collecte serveurs
# - Collecte switches
# - Monitoring bande passante

param(
    [string]$ConfigFile = ".\config.json",
    [int]$IntervalMinutes = 5,
    [switch]$RunOnce = $false,
    [switch]$EnableBandwidth = $true,
    [switch]$EnableServers = $true,
    [switch]$EnableSwitches = $true,
    [switch]$EnablePing = $true
)

# =====================================================
# CONFIGURATION
# =====================================================

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$logPath = Join-Path $scriptPath "..\logs"
$logFile = Join-Path $logPath "monitoring_$(Get-Date -Format 'yyyyMMdd').log"

# Créer le dossier de logs s'il n'existe pas
if (-not (Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
}

# Fonction de logging
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Écrire dans le fichier log
    Add-Content -Path $logFile -Value $logMessage
    
    # Afficher à l'écran avec couleur
    switch ($Level) {
        "ERROR"   { Write-Host $logMessage -ForegroundColor Red }
        "WARN"    { Write-Host $logMessage -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $logMessage -ForegroundColor Green }
        "INFO"    { Write-Host $logMessage -ForegroundColor Cyan }
        default   { Write-Host $logMessage }
    }
}

# =====================================================
# FONCTION D'EXÉCUTION DES SCRIPTS
# =====================================================

function Invoke-MonitoringScript {
    param(
        [string]$ScriptName,
        [string]$Description
    )
    
    $scriptFullPath = Join-Path $scriptPath $ScriptName
    
    if (-not (Test-Path $scriptFullPath)) {
        Write-Log "Script non trouvé: $ScriptName" "ERROR"
        return $false
    }
    
    Write-Log "Démarrage: $Description" "INFO"
    $startTime = Get-Date
    
    try {
        # Exécuter le script
        & $scriptFullPath -ConfigFile $ConfigFile
        
        $duration = ((Get-Date) - $startTime).TotalSeconds
        Write-Log "Terminé: $Description (durée: $duration s)" "SUCCESS"
        return $true
        
    } catch {
        $duration = ((Get-Date) - $startTime).TotalSeconds
        Write-Log "Erreur dans $Description : $($_.Exception.Message)" "ERROR"
        Write-Log "Durée avant erreur: $duration s" "WARN"
        return $false
    }
}

# =====================================================
# FONCTION DE CYCLE DE MONITORING
# =====================================================

function Start-MonitoringCycle {
    param([int]$CycleNumber)
    
    Write-Log "═══════════════════════════════════════════════════════" "INFO"
    Write-Log "CYCLE #$CycleNumber - Démarrage du monitoring complet" "INFO"
    Write-Log "═══════════════════════════════════════════════════════" "INFO"
    
    $cycleStart = Get-Date
    $results = @{
        ping = $false
        servers = $false
        switches = $false
        bandwidth = $false
    }
    
    # 1. Ping de tous les équipements (rapide)
    if ($EnablePing) {
        Write-Log "━━━ 1/4 PING DES ÉQUIPEMENTS ━━━" "INFO"
        $results.ping = Invoke-MonitoringScript -ScriptName "PingEquipment.ps1" -Description "Ping des équipements"
        Start-Sleep -Seconds 2
    }
    
    # 2. Collecte des informations serveurs (WMI/SSH)
    if ($EnableServers) {
        Write-Log "━━━ 2/4 COLLECTE SERVEURS ━━━" "INFO"
        $results.servers = Invoke-MonitoringScript -ScriptName "CollectServerInfo.ps1" -Description "Collecte informations serveurs"
        Start-Sleep -Seconds 2
    }
    
    # 3. Collecte des informations switches (SNMP)
    if ($EnableSwitches) {
        Write-Log "━━━ 3/4 COLLECTE SWITCHES ━━━" "INFO"
        $results.switches = Invoke-MonitoringScript -ScriptName "CollectSwitchInfo.ps1" -Description "Collecte informations switches"
        Start-Sleep -Seconds 2
    }
    
    # 4. Monitoring bande passante (un seul échantillon)
    if ($EnableBandwidth) {
        Write-Log "━━━ 4/4 BANDE PASSANTE ━━━" "INFO"
        # Pour la bande passante, on exécute une seule mesure
        # Le script BandwidthMonitor.ps1 tourne en continu, donc on le skip ici
        # Ou on peut créer un script SimpleBandwidthSample.ps1 pour un seul échantillon
        Write-Log "Bande passante: Utiliser BandwidthMonitor.ps1 en service séparé" "INFO"
    }
    
    # Résumé du cycle
    $cycleDuration = ((Get-Date) - $cycleStart).TotalSeconds
    $successCount = ($results.Values | Where-Object { $_ -eq $true }).Count
    $totalCount = $results.Count
    
    Write-Log "═══════════════════════════════════════════════════════" "INFO"
    Write-Log "CYCLE #$CycleNumber - Terminé en $cycleDuration secondes" "SUCCESS"
    Write-Log "Résultats: $successCount/$totalCount tâches réussies" "INFO"
    Write-Log "  Ping: $(if($results.ping){'✓'}else{'✗'})" "INFO"
    Write-Log "  Serveurs: $(if($results.servers){'✓'}else{'✗'})" "INFO"
    Write-Log "  Switches: $(if($results.switches){'✓'}else{'✗'})" "INFO"
    Write-Log "═══════════════════════════════════════════════════════" "INFO"
    Write-Log "" "INFO"
}

# =====================================================
# FONCTION DE VERIFICATION SANTE API
# =====================================================

function Test-ApiHealth {
    try {
        $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        $response = Invoke-RestMethod -Uri "$($config.apiBase)/health" -Method GET -TimeoutSec 5
        
        if ($response.status -eq "ok") {
            Write-Log "API Dashboard: OK Operationnelle" "SUCCESS"
            return $true
        }
    } catch {
        Write-Log "API Dashboard: X Inaccessible" "ERROR"
        return $false
    }
}

# =====================================================
# FONCTION DE RAPPORT QUOTIDIEN
# =====================================================

function Send-DailyReport {
    Write-Log "═══════════════════════════════════════════════════════" "INFO"
    Write-Log "RAPPORT QUOTIDIEN - $(Get-Date -Format 'yyyy-MM-dd')" "INFO"
    Write-Log "═══════════════════════════════════════════════════════" "INFO"
    
    # Lire le fichier de log du jour
    if (Test-Path $logFile) {
        $logContent = Get-Content $logFile
        $successLines = $logContent | Select-String "SUCCESS" | Measure-Object | Select-Object -ExpandProperty Count
        $errorLines = $logContent | Select-String "ERROR" | Measure-Object | Select-Object -ExpandProperty Count
        $warnLines = $logContent | Select-String "WARN" | Measure-Object | Select-Object -ExpandProperty Count
        
        Write-Log "Statistiques du jour:" "INFO"
        Write-Log "  OK Succes: $successLines" "SUCCESS"
        Write-Log "  ! Warnings: $warnLines" "WARN"
        Write-Log "  X Erreurs: $errorLines" "ERROR"
    }
    
    Write-Log "═══════════════════════════════════════════════════════" "INFO"
}

# =====================================================
# SCRIPT PRINCIPAL
# =====================================================

Clear-Host

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                                ║" -ForegroundColor Green
Write-Host "║   MONITORING PRODUCTION - DASHBOARD SEMMARIS                   ║" -ForegroundColor Green
Write-Host "║                                                                ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Log "═══════════════════════════════════════════════════════" "INFO"
Write-Log "DÉMARRAGE DU SYSTÈME DE MONITORING" "INFO"
Write-Log "═══════════════════════════════════════════════════════" "INFO"
Write-Log "Configuration:" "INFO"
Write-Log "  • Fichier config: $ConfigFile" "INFO"
Write-Log "  • Intervalle: $IntervalMinutes minutes" "INFO"
Write-Log "  • Mode: $(if($RunOnce){'Exécution unique'}else{'Continu'})" "INFO"
Write-Log "  • Ping: $(if($EnablePing){'✓'}else{'✗'})" "INFO"
Write-Log "  • Serveurs: $(if($EnableServers){'✓'}else{'✗'})" "INFO"
Write-Log "  • Switches: $(if($EnableSwitches){'✓'}else{'✗'})" "INFO"
Write-Log "  • Bande passante: $(if($EnableBandwidth){'✓'}else{'✗'})" "INFO"
Write-Log "  • Logs: $logFile" "INFO"
Write-Log "═══════════════════════════════════════════════════════" "INFO"
Write-Log "" "INFO"

# Verifier que le fichier de config existe
if (-not (Test-Path $ConfigFile)) {
    Write-Log "Fichier de configuration introuvable: $ConfigFile" "ERROR"
    Write-Log "Creez le fichier config.json avec les parametres requis" "ERROR"
    exit 1
}

# Tester la sante de lAPI
Write-Log "Verification de lAPI..." "INFO"
if (-not (Test-ApiHealth)) {
    Write-Log "L API n est pas accessible. Verifiez que le backend est demarre" "ERROR"
    Write-Log "Commande: docker compose up -d" "INFO"
    
    $response = Read-Host "Continuer quand meme ? (O/N)"
    if ($response -ne "O") {
        exit 1
    }
}

Write-Log "" "INFO"

# Boucle principale
$cycle = 0
$lastDailyReport = Get-Date

try {
    do {
        $cycle++
        
        # Exécuter un cycle de monitoring
        Start-MonitoringCycle -CycleNumber $cycle
        
        # Rapport quotidien (à minuit)
        $now = Get-Date
        if ($now.Date -gt $lastDailyReport.Date) {
            Send-DailyReport
            $lastDailyReport = $now
        }
        
        # Si mode unique, sortir
        if ($RunOnce) {
            Write-Log "Mode exécution unique - Terminé" "SUCCESS"
            break
        }
        
        # Attendre avant le prochain cycle
        Write-Log "⏳ Prochain cycle dans $IntervalMinutes minutes..." "INFO"
        Write-Log "   (Appuyez sur Ctrl+C pour arrêter)" "INFO"
        Write-Log "" "INFO"
        
        Start-Sleep -Seconds ($IntervalMinutes * 60)
        
    } while ($true)
    
} catch {
    Write-Log "Erreur fatale: $($_.Exception.Message)" "ERROR"
    Write-Log "Monitoring interrompu" "ERROR"
    exit 1
}

Write-Log "Monitoring arrete" "INFO"
