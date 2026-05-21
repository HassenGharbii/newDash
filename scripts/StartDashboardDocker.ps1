# StartDashboardDocker.ps1 - Lance Docker Compose pour le dashboard
$projectRoot = "C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre"
$logFile = Join-Path $projectRoot "logs\docker-startup.log"
$maxRetries = 10
$retryDelay = 30

# CrÃ©er le dossier logs
$logsDir = Join-Path $projectRoot "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Logger
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $logFile -Append -Encoding UTF8
}

Write-Log "=========================================="
Write-Log "DÃ©marrage du Dashboard Semmaris"
Write-Log "=========================================="

# Attendre que Docker soit prÃªt
$retry = 0
while ($retry -lt $maxRetries) {
    try {
        Write-Log "VÃ©rification de Docker... (tentative $($retry + 1)/$maxRetries)"
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Docker est prÃªt!"
            break
        }
    } catch {
        Write-Log "Docker pas encore prÃªt: $_"
    }
    
    $retry++
    if ($retry -lt $maxRetries) {
        Write-Log "Attente de ${retryDelay}s avant nouvelle tentative..."
        Start-Sleep -Seconds $retryDelay
    }
}

if ($retry -eq $maxRetries) {
    Write-Log "ERREUR: Docker n'a pas dÃ©marrÃ© aprÃ¨s $maxRetries tentatives"
    exit 1
}

# Changer vers le rÃ©pertoire du projet
Set-Location $projectRoot
Write-Log "RÃ©pertoire de travail: $projectRoot"

# ArrÃªter les anciens conteneurs si prÃ©sents
Write-Log "ArrÃªt des conteneurs existants..."
docker-compose down 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8

# DÃ©marrer les conteneurs
Write-Log "DÃ©marrage des conteneurs Docker Compose..."
docker-compose up -d 2>&1 | Out-File -FilePath $logFile -Append -Encoding UTF8

if ($LASTEXITCODE -eq 0) {
    Write-Log "Dashboard dÃ©marrÃ© avec succÃ¨s!"
    Write-Log "Frontend: http://10.8.11.230:5173"
    Write-Log "Backend API: http://10.8.11.230:4000"
} else {
    Write-Log "ERREUR lors du dÃ©marrage des conteneurs (code: $LASTEXITCODE)"
    exit 1
}

Write-Log "=========================================="
