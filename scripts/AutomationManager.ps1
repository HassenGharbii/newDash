# ====================================================================
# Script d'Orchestration Automatisée - Dashboard Semmaris
# ====================================================================
# Ce script gère l'exécution automatique des tâches de monitoring

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("ping", "bandwidth", "both", "setup", "status", "alerts")]
    [string]$Task = "both",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [switch]$DebugMode
)

# Configuration globale
$global:CONFIG = @{
    ScriptPath = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    LogPath = "C:\ProgramData\SemmarisMonitoring\logs"
    PidPath = "C:\ProgramData\SemmarisMonitoring\pids"
    ConfigPath = ".\config.json"
    MaxLogSize = 10MB
    MaxLogFiles = 10
    PingInterval = 300  # 5 minutes
    BandwidthInterval = 3600  # 1 heure
    AlertInterval = 600  # 10 minutes
}

# Initialisation des dossiers
function Initialize-Environment {
    Write-Log "Initialisation de l'environnement d'automatisation..."
    
    # Créer les dossiers nécessaires
    @($global:CONFIG.LogPath, $global:CONFIG.PidPath) | ForEach-Object {
        if (-not (Test-Path $_)) {
            New-Item -Path $_ -ItemType Directory -Force | Out-Null
            Write-Log "Dossier créé: $_"
        }
    }
    
    # Vérifier la configuration
    $configFile = Join-Path $global:CONFIG.ScriptPath $global:CONFIG.ConfigPath
    if (-not (Test-Path $configFile)) {
        Write-Log "ERREUR: Fichier de configuration manquant: $configFile" -Level "ERROR"
        return $false
    }
    
    Write-Log "Environnement initialisé avec succès"
    return $true
}

# Fonction de logging avancée
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "DEBUG")]
        [string]$Level = "INFO",
        [string]$Component = "MAIN"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] [$Component] $Message"
    
    # Affichage console avec couleurs
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "DEBUG" { "Gray" }
        default { "White" }
    }
    
    if ($Verbose -or $Level -ne "DEBUG") {
        Write-Host $logEntry -ForegroundColor $color
    }
    
    # Écriture dans le fichier de log
    $logFile = Join-Path $global:CONFIG.LogPath "automation-$(Get-Date -Format 'yyyy-MM').log"
    Add-Content -Path $logFile -Value $logEntry -Encoding UTF8
    
    # Rotation des logs si nécessaire
    if ((Get-Item $logFile).Length -gt $global:CONFIG.MaxLogSize) {
        Rotate-Logs $logFile
    }
}

# Rotation des fichiers de logs
function Rotate-Logs {
    param([string]$LogFile)
    
    $logDir = Split-Path $LogFile
    $logName = [System.IO.Path]::GetFileNameWithoutExtension($LogFile)
    $logExt = [System.IO.Path]::GetExtension($LogFile)
    
    # Renommer le fichier actuel
    $rotatedFile = Join-Path $logDir "$logName-$(Get-Date -Format 'yyyyMMdd-HHmmss')$logExt"
    Move-Item $LogFile $rotatedFile
    
    # Supprimer les anciens logs
    Get-ChildItem -Path $logDir -Filter "$logName-*$logExt" | 
        Sort-Object CreationTime -Descending | 
        Select-Object -Skip $global:CONFIG.MaxLogFiles | 
        Remove-Item -Force
    
    Write-Log "Log rotaté: $rotatedFile" -Level "DEBUG"
}

# Gestion des PID pour éviter les exécutions multiples
function Get-ProcessPid {
    param([string]$TaskName)
    
    $pidFile = Join-Path $global:CONFIG.PidPath "$TaskName.pid"
    if (Test-Path $pidFile) {
        $processId = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($processId -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
            return $processId
        } else {
            Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
        }
    }
    return $null
}

function Set-ProcessPid {
    param([string]$TaskName)
    
    $pidFile = Join-Path $global:CONFIG.PidPath "$TaskName.pid"
    $PID | Out-File $pidFile -Encoding ASCII
}

function Remove-ProcessPid {
    param([string]$TaskName)
    
    $pidFile = Join-Path $global:CONFIG.PidPath "$TaskName.pid"
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# Vérification de l'état des services
function Test-Services {
    Write-Log "Vérification de l'état des services..." -Component "HEALTH"
    
    # Vérifier Docker
    try {
        $dockerStatus = docker-compose ps --format json | ConvertFrom-Json
        $apiRunning = ($dockerStatus | Where-Object { $_.Service -eq "api" -and $_.State -eq "running" }) -ne $null
        $frontendRunning = ($dockerStatus | Where-Object { $_.Service -eq "frontend" -and $_.State -eq "running" }) -ne $null
        
        if (-not $apiRunning) {
            Write-Log "Service API non démarré, tentative de redémarrage..." -Level "WARN" -Component "HEALTH"
            docker-compose restart api
            Start-Sleep 10
        }
        
        if (-not $frontendRunning) {
            Write-Log "Service Frontend non démarré, tentative de redémarrage..." -Level "WARN" -Component "HEALTH"
            docker-compose restart frontend
            Start-Sleep 5
        }
        
    } catch {
        Write-Log "Erreur lors de la vérification Docker: $($_.Exception.Message)" -Level "ERROR" -Component "HEALTH"
        return $false
    }
    
    # Test de connectivité API
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET -TimeoutSec 10
        if ($response.status -eq "ok") {
            Write-Log "API accessible et fonctionnelle" -Component "HEALTH"
        } else {
            Write-Log "API répond mais statut incorrect: $($response.status)" -Level "WARN" -Component "HEALTH"
            return $false
        }
    } catch {
        Write-Log "API inaccessible: $($_.Exception.Message)" -Level "ERROR" -Component "HEALTH"
        return $false
    }
    
    return $true
}

# Exécution du script de ping
function Start-PingMonitoring {
    Write-Log "Démarrage du monitoring ping..." -Component "PING"
    
    $existingPid = Get-ProcessPid "ping"
    if ($existingPid -and -not $Force) {
        Write-Log "Monitoring ping déjà en cours (PID: $existingPid)" -Level "WARN" -Component "PING"
        return $false
    }
    
    Set-ProcessPid "ping"
    
    try {
        $pingScript = Join-Path $global:CONFIG.ScriptPath "PingEquipment.ps1"
        $startTime = Get-Date
        
        Write-Log "Exécution du script de ping: $pingScript" -Component "PING"
        
        # Exécuter le script avec capture des erreurs
        $result = & powershell.exe -ExecutionPolicy Bypass -File $pingScript 2>&1
        $exitCode = $LASTEXITCODE
        
        $duration = (Get-Date) - $startTime
        
        if ($exitCode -eq 0) {
            # Compter les résultats envoyés
            $successCount = ($result | Select-String "\[OK\] Ping envoye").Count
            $totalCount = ($result | Select-String "\[PING\] Test de").Count
            
            Write-Log "Ping monitoring terminé avec succès: $successCount/$totalCount équipements traités en $([math]::Round($duration.TotalSeconds, 2))s" -Component "PING"
        } else {
            Write-Log "Erreur lors du ping monitoring (code: $exitCode)" -Level "ERROR" -Component "PING"
            Write-Log "Sortie d'erreur: $($result -join "`n")" -Level "ERROR" -Component "PING"
        }
        
    } catch {
        Write-Log "Exception durant le ping monitoring: $($_.Exception.Message)" -Level "ERROR" -Component "PING"
    } finally {
        Remove-ProcessPid "ping"
    }
    
    return $exitCode -eq 0
}

# Fonction de surveillance des alertes
# Fonction de surveillance des alertes (DÉSACTIVÉE)
function Start-AlertMonitoring {
    Write-Log " Surveillance des alertes DÉSACTIVÉE par l'utilisateur" -Level "INFO" -Component "ALERTS"
    return $true  # Retourne succès sans exécuter les alertes
}

# Exécution du script de bande passante
function Start-BandwidthMonitoring {
    Write-Log "Démarrage du monitoring bande passante..." -Component "BANDWIDTH"
    
    $existingPid = Get-ProcessPid "bandwidth"
    if ($existingPid -and -not $Force) {
        Write-Log "Monitoring bande passante déjà en cours (PID: $existingPid)" -Level "WARN" -Component "BANDWIDTH"
        return $false
    }
    
    Set-ProcessPid "bandwidth"
    
    try {
        $bandwidthScript = Join-Path $global:CONFIG.ScriptPath "BandwidthMonitor.ps1"
        
        if (-not (Test-Path $bandwidthScript)) {
            Write-Log "Script de bande passante non trouvé: $bandwidthScript" -Level "ERROR" -Component "BANDWIDTH"
            return $false
        }
        
        $startTime = Get-Date
        Write-Log "Exécution du script de bande passante: $bandwidthScript" -Component "BANDWIDTH"
        
        $result = & powershell.exe -ExecutionPolicy Bypass -File $bandwidthScript 2>&1
        $exitCode = $LASTEXITCODE
        
        $duration = (Get-Date) - $startTime
        
        if ($exitCode -eq 0) {
            Write-Log "Monitoring bande passante terminé avec succès en $([math]::Round($duration.TotalSeconds, 2))s" -Component "BANDWIDTH"
        } else {
            Write-Log "Erreur lors du monitoring bande passante (code: $exitCode)" -Level "ERROR" -Component "BANDWIDTH"
            Write-Log "Sortie d'erreur: $($result -join "`n")" -Level "ERROR" -Component "BANDWIDTH"
        }
        
    } catch {
        Write-Log "Exception durant le monitoring bande passante: $($_.Exception.Message)" -Level "ERROR" -Component "BANDWIDTH"
    } finally {
        Remove-ProcessPid "bandwidth"
    }
    
    return $exitCode -eq 0
}

# Configuration des tâches Windows
function Setup-ScheduledTasks {
    Write-Log "Configuration des tâches programmées Windows..." -Component "SETUP"
    
    $scriptPath = Join-Path $global:CONFIG.ScriptPath "AutomationManager.ps1"
    $workingDir = $global:CONFIG.ScriptPath
    
    # Tâche de ping (toutes les 5 minutes)
    $pingAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -Task ping" -WorkingDirectory $workingDir
    $pingTrigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 5) -At (Get-Date) -Once
    $pingSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $pingPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
    
    try {
        Register-ScheduledTask -TaskName "Semmaris-PingMonitoring" -Action $pingAction -Trigger $pingTrigger -Settings $pingSettings -Principal $pingPrincipal -Force
        Write-Log "Tâche de ping programmée créée" -Component "SETUP"
    } catch {
        Write-Log "Erreur lors de la création de la tâche ping: $($_.Exception.Message)" -Level "ERROR" -Component "SETUP"
    }
    
    # Tâche de bande passante (toutes les heures)
    $bwAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -Task bandwidth" -WorkingDirectory $workingDir
    $bwTrigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Hours 1) -At (Get-Date) -Once
    
    try {
        Register-ScheduledTask -TaskName "Semmaris-BandwidthMonitoring" -Action $bwAction -Trigger $bwTrigger -Settings $pingSettings -Principal $pingPrincipal -Force
        Write-Log "Tâche de bande passante programmée créée" -Component "SETUP"
    } catch {
        Write-Log "Erreur lors de la création de la tâche bande passante: $($_.Exception.Message)" -Level "ERROR" -Component "SETUP"
    }
    
    # Tâche de supervision (toutes les 30 minutes)
    $healthAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -Task status" -WorkingDirectory $workingDir
    $healthTrigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 30) -At (Get-Date) -Once
    
    try {
        Register-ScheduledTask -TaskName "Semmaris-HealthCheck" -Action $healthAction -Trigger $healthTrigger -Settings $pingSettings -Principal $pingPrincipal -Force
        Write-Log "Tâche de supervision programmée créée" -Component "SETUP"
    } catch {
        Write-Log "Erreur lors de la création de la tâche supervision: $($_.Exception.Message)" -Level "ERROR" -Component "SETUP"
    }
    
    # Tâche d'alertes (toutes les 10 minutes)
    $alertAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -Task alerts" -WorkingDirectory $workingDir
    $alertTrigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 10) -At (Get-Date) -Once
    
    try {
        Register-ScheduledTask -TaskName "Semmaris-AlertMonitoring" -Action $alertAction -Trigger $alertTrigger -Settings $pingSettings -Principal $pingPrincipal -Force
        Write-Log "Tâche de surveillance des alertes programmée créée" -Component "SETUP"
    } catch {
        Write-Log "Erreur lors de la création de la tâche d'alertes: $($_.Exception.Message)" -Level "ERROR" -Component "SETUP"
    }
    
    Write-Log "Configuration des tâches programmées terminée" -Component "SETUP"
}

# Affichage du statut
function Show-Status {
    Write-Log "=== STATUT DU MONITORING AUTOMATIQUE ===" -Component "STATUS"
    
    # Services Docker operationnels
    if (Test-Services) {
        Write-Log "[OK] Services Docker operationnels" -Component "STATUS"
    } else {
        Write-Log "[KO] Probleme avec les services Docker" -Level "ERROR" -Component "STATUS"
    }
    
    # État des tâches programmées
    $tasks = @("Semmaris-PingMonitoring", "Semmaris-BandwidthMonitoring", "Semmaris-HealthCheck")
    foreach ($taskName in $tasks) {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($task) {
            $lastRun = (Get-ScheduledTaskInfo -TaskName $taskName).LastRunTime
            $state = $task.State
            Write-Log "[OK] ${taskName}: $state (derniere execution: $lastRun)" -Component "STATUS"
        } else {
            Write-Log "[KO] ${taskName}: Non configuree" -Level "WARN" -Component "STATUS"
        }
    }
    
    # Processus en cours
    foreach ($taskType in @("ping", "bandwidth")) {
        $processId = Get-ProcessPid $taskType
        if ($processId) {
            Write-Log "[ACTIF] Monitoring $taskType en cours (PID: $processId)" -Component "STATUS"
        } else {
            Write-Log "[INACTIF] Monitoring $taskType inactif" -Component "STATUS"
        }
    }
    
    # Logs recents
    $logFile = Join-Path $global:CONFIG.LogPath "automation-$(Get-Date -Format 'yyyy-MM').log"
    if (Test-Path $logFile) {
        $logSize = [math]::Round((Get-Item $logFile).Length / 1KB, 2)
        Write-Log "[LOGS] Log actuel: $logSize KB" -Component "STATUS"
    }
}

# ====================================================================
# POINT D'ENTRÉE PRINCIPAL
# ====================================================================

Write-Host "🚀 Dashboard Semmaris - Gestionnaire d'Automatisation" -ForegroundColor Cyan
Write-Host "Task: $Task | Force: $Force | Verbose: $Verbose`n" -ForegroundColor Gray

# Initialisation
if (-not (Initialize-Environment)) {
    Write-Log "Échec de l'initialisation" -Level "ERROR"
    exit 1
}

# Traitement selon la tâche demandée
switch ($Task) {
    "ping" {
        if (Test-Services) {
            Start-PingMonitoring
        } else {
            Write-Log "Services non disponibles pour le ping" -Level "ERROR"
            exit 1
        }
    }
    
    "bandwidth" {
        if (Test-Services) {
            Start-BandwidthMonitoring
        } else {
            Write-Log "Services non disponibles pour la bande passante" -Level "ERROR"
            exit 1
        }
    }
    
    "both" {
        if (Test-Services) {
            $pingSuccess = Start-PingMonitoring
            $bwSuccess = Start-BandwidthMonitoring
            
            if (-not $pingSuccess -or -not $bwSuccess) {
                Write-Log "Une ou plusieurs tâches ont échoué" -Level "WARN"
                exit 1
            }
        } else {
            Write-Log "Services non disponibles" -Level "ERROR"
            exit 1
        }
    }
    
    "setup" {
        Setup-ScheduledTasks
        Show-Status
    }
    
    "status" {
        Show-Status
    }
    
    "alerts" {
        if (Test-Services) {
            Start-AlertMonitoring
        } else {
            Write-Log "Services non disponibles pour les alertes" -Level "ERROR"
            exit 1
        }
    }
}

Write-Log "Gestionnaire d'automatisation termine" -Component "MAIN"
