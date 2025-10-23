# Script de configuration initiale - Dashboard Semmaris
Write-Host "Configuration initiale - Dashboard Semmaris" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

# 1. Verifier que Docker est installe et fonctionne
Write-Host "1. Verification de Docker..." -ForegroundColor Cyan
try {
    $dockerVersion = docker --version
    Write-Host "   Docker detecte: $dockerVersion" -ForegroundColor Gray
} catch {
    Write-Host "   ERREUR: Docker non installe ou non demarré!" -ForegroundColor Red
    exit 1
}

# 2. Verifier Docker Compose
Write-Host "2. Verification de Docker Compose..." -ForegroundColor Cyan
try {
    $composeVersion = docker compose version
    Write-Host "   Docker Compose detecte: $composeVersion" -ForegroundColor Gray
} catch {
    Write-Host "   ERREUR: Docker Compose non disponible!" -ForegroundColor Red
    exit 1
}

# 3. Creer les dossiers necessaires
Write-Host "3. Creation des dossiers..." -ForegroundColor Cyan
$directories = @(
    ".\backend\data",
    ".\backups",
    ".\logs"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   Cree: $dir" -ForegroundColor Gray
    } else {
        Write-Host "   Existe: $dir" -ForegroundColor Gray
    }
}

# 4. Verifier les fichiers de configuration
Write-Host "4. Verification des fichiers de config..." -ForegroundColor Cyan
$configFiles = @(
    ".\docker-compose.yml",
    ".\backend\package.json",
    ".\frontend\package.json"
)

foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Write-Host "   OK: $file" -ForegroundColor Green
    } else {
        Write-Host "   MANQUANT: $file" -ForegroundColor Red
    }
}

# 5. Verifier les variables d'environnement
Write-Host "5. Verification des variables d'environnement..." -ForegroundColor Cyan
$envFiles = @(
    ".\backend\.env",
    ".\frontend\.env"
)

foreach ($envFile in $envFiles) {
    $exampleFile = $envFile -replace "\.env$", ".env.example"
    
    if (!(Test-Path $envFile) -and (Test-Path $exampleFile)) {
        Write-Host "   Creation de $envFile depuis $exampleFile" -ForegroundColor Yellow
        Copy-Item $exampleFile $envFile
    } elseif (Test-Path $envFile) {
        Write-Host "   OK: $envFile" -ForegroundColor Green
    } else {
        Write-Host "   ATTENTION: $envFile et $exampleFile manquants" -ForegroundColor Yellow
    }
}

# 6. Permissions des scripts
Write-Host "6. Configuration des permissions des scripts..." -ForegroundColor Cyan
$scripts = Get-ChildItem ".\scripts\*.ps1" -ErrorAction SilentlyContinue

if ($scripts) {
    foreach ($script in $scripts) {
        Write-Host "   Script trouve: $($script.Name)" -ForegroundColor Gray
    }
} else {
    Write-Host "   Aucun script PowerShell trouve" -ForegroundColor Yellow
}

# 7. Test de connectivite
Write-Host "7. Test de connectivite reseau..." -ForegroundColor Cyan
try {
    $testConnection = Test-NetConnection -ComputerName "google.com" -Port 80 -WarningAction SilentlyContinue
    if ($testConnection.TcpTestSucceeded) {
        Write-Host "   Connexion internet: OK" -ForegroundColor Green
    } else {
        Write-Host "   Connexion internet: Limitee" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Test de connexion: Impossible" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Configuration initiale terminee!" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor White
Write-Host "1. Executer: .\scripts\DockerManager.ps1 start -Build" -ForegroundColor Cyan
Write-Host "2. Acceder au dashboard: http://localhost:5173" -ForegroundColor Cyan
Write-Host "3. API disponible sur: http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Scripts disponibles:" -ForegroundColor White
Write-Host "- .\scripts\DockerManager.ps1    - Gestion Docker" -ForegroundColor Gray
Write-Host "- .\scripts\DatabaseCheck.ps1    - Verification DB" -ForegroundColor Gray
Write-Host "- .\scripts\BackupManager.ps1    - Gestion backups" -ForegroundColor Gray