#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Migration du Dashboard Semmaris vers un utilisateur du domaine
.DESCRIPTION
    Ce script migre l'application, les scripts et les tâches planifiées vers un utilisateur du domaine
    pour permettre l'accès WinRM aux serveurs distants avec les credentials du domaine.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$DomainUser,  # Format: VIDEO\username ou username@video.semmaris
    
    [Parameter(Mandatory=$false)]
    [string]$TargetPath = "C:\Dashboard-Semmaris",
    
    [Parameter(Mandatory=$false)]
    [PSCredential]$Credential
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MIGRATION DASHBOARD VERS DOMAINE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Demander les credentials si non fournis
if (-not $Credential) {
    Write-Host "Entrez les credentials du compte domaine cible:" -ForegroundColor Yellow
    $Credential = Get-Credential -UserName $DomainUser -Message "Credentials pour $DomainUser"
}

$sourcePath = "c:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre"

Write-Host "[1/7] Vérification des prérequis..." -ForegroundColor Green

# Vérifier que le serveur est dans le domaine
$computerSystem = Get-WmiObject -Class Win32_ComputerSystem
if (-not $computerSystem.PartOfDomain) {
    Write-Error "Le serveur n'est pas dans un domaine Active Directory"
    exit 1
}
Write-Host "  ✓ Serveur dans le domaine: $($computerSystem.Domain)" -ForegroundColor Gray
Write-Host "  ✓ Utilisateur domaine cible: $DomainUser" -ForegroundColor Gray

Write-Host ""
Write-Host "[2/7] Arrêt des services en cours..." -ForegroundColor Green

# Arrêter les scripts PowerShell en cours
$collectProcesses = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    if ($cmdLine) {
        $cmdLine -like "*Collect*" -or $cmdLine -like "*SimplePing*"
    }
}

foreach ($proc in $collectProcesses) {
    Write-Host "  → Arrêt du processus $($proc.Id)..." -ForegroundColor Gray
    Stop-Process -Id $proc.Id -Force
}

# Arrêter Docker
Write-Host "  → Arrêt des conteneurs Docker..." -ForegroundColor Gray
Set-Location $sourcePath
docker-compose down 2>&1 | Out-Null

Write-Host ""
Write-Host "[3/7] Création du répertoire cible..." -ForegroundColor Green

# Créer le répertoire cible s'il n'existe pas
if (-not (Test-Path $TargetPath)) {
    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
    Write-Host "  ✓ Répertoire créé: $TargetPath" -ForegroundColor Gray
} else {
    Write-Host "  ⚠ Répertoire existe déjà: $TargetPath" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous continuer? (O/N)"
    if ($response -ne 'O') {
        Write-Host "Migration annulée." -ForegroundColor Red
        exit 0
    }
}

Write-Host ""
Write-Host "[4/7] Copie des fichiers..." -ForegroundColor Green

# Copier tous les fichiers
Write-Host "  → Copie en cours (cela peut prendre quelques minutes)..." -ForegroundColor Gray
Copy-Item -Path "$sourcePath\*" -Destination $TargetPath -Recurse -Force -ErrorAction SilentlyContinue

# Exclure node_modules et fichiers temporaires si présents
$excludePaths = @(
    "$TargetPath\backend\node_modules",
    "$TargetPath\frontend\node_modules",
    "$TargetPath\logs\*"
)

foreach ($excludePath in $excludePaths) {
    if (Test-Path $excludePath) {
        Write-Host "  → Nettoyage: $excludePath" -ForegroundColor Gray
        Remove-Item -Path $excludePath -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "  ✓ Fichiers copiés vers $TargetPath" -ForegroundColor Gray

Write-Host ""
Write-Host "[5/7] Configuration des permissions..." -ForegroundColor Green

# Donner les permissions complètes à l'utilisateur du domaine
$acl = Get-Acl $TargetPath
$permission = "$DomainUser","FullControl","ContainerInherit,ObjectInherit","None","Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)
Set-Acl $TargetPath $acl

Write-Host "  ✓ Permissions accordées à $DomainUser" -ForegroundColor Gray

Write-Host ""
Write-Host "[6/7] Mise à jour des fichiers de configuration..." -ForegroundColor Green

# Mettre à jour les chemins dans config.json si présent
$configFile = "$TargetPath\scripts\config.json"
if (Test-Path $configFile) {
    $config = Get-Content $configFile -Raw | ConvertFrom-Json
    if ($config.paths) {
        $config.paths.base = $TargetPath
        $config.paths.logs = "$TargetPath\logs"
        $config.paths.backups = "$TargetPath\backups"
    }
    $config | ConvertTo-Json -Depth 10 | Set-Content $configFile -Encoding UTF8
    Write-Host "  ✓ config.json mis à jour" -ForegroundColor Gray
}

# Créer un fichier .env pour Docker avec le nouvel utilisateur
$envContent = @"
# Utilisateur du domaine
DOMAIN_USER=$DomainUser
DASHBOARD_PATH=$TargetPath

# API Configuration
API_PORT=4000
FRONTEND_PORT=5173

# Database
DB_PATH=$TargetPath/backend/data/app.db
"@

Set-Content "$TargetPath\.env" -Value $envContent -Encoding UTF8
Write-Host "  ✓ Fichier .env créé" -ForegroundColor Gray

Write-Host ""
Write-Host "[7/7] Création des tâches planifiées..." -ForegroundColor Green

# Créer les tâches planifiées avec l'utilisateur du domaine
$tasks = @(
    @{
        Name = "Dashboard-Semmaris-Ping"
        Script = "$TargetPath\scripts\SimplePing.ps1"
        Interval = "PT2M"  # Toutes les 2 minutes
    },
    @{
        Name = "Dashboard-Semmaris-Servers"
        Script = "$TargetPath\scripts\CollectServerMetricsV2.ps1"
        Interval = "PT10M"  # Toutes les 10 minutes
    },
    @{
        Name = "Dashboard-Semmaris-Switches"
        Script = "$TargetPath\scripts\CollectSwitchMetrics.ps1"
        Interval = "PT5M"  # Toutes les 5 minutes
    },
    @{
        Name = "Dashboard-Semmaris-Bandwidth"
        Script = "$TargetPath\scripts\CollectBandwidthMetrics.ps1"
        Interval = "PT3M"  # Toutes les 3 minutes
    }
)

foreach ($task in $tasks) {
    # Supprimer la tâche si elle existe
    $existingTask = Get-ScheduledTask -TaskName $task.Name -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $task.Name -Confirm:$false
        Write-Host "  → Ancienne tâche supprimée: $($task.Name)" -ForegroundColor Gray
    }
    
    # Créer l'action
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$($task.Script)`""
    
    # Créer le déclencheur (répétition)
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval $task.Interval
    
    # Créer les paramètres
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
    
    # Créer le principal (utilisateur du domaine)
    $principal = New-ScheduledTaskPrincipal -UserId $DomainUser -LogonType Password -RunLevel Highest
    
    # Enregistrer la tâche
    Register-ScheduledTask -TaskName $task.Name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Password $Credential.GetNetworkCredential().Password | Out-Null
    
    Write-Host "  ✓ Tâche créée: $($task.Name)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[8/7] Démarrage des conteneurs Docker..." -ForegroundColor Green

Set-Location $TargetPath
docker-compose up -d --build

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  MIGRATION TERMINÉE AVEC SUCCÈS !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Résumé:" -ForegroundColor Cyan
Write-Host "  • Utilisateur du domaine: $DomainUser" -ForegroundColor White
Write-Host "  • Nouveau chemin: $TargetPath" -ForegroundColor White
Write-Host "  • Tâches planifiées: 4 créées" -ForegroundColor White
Write-Host "  • Services Docker: Démarrés" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Connectez-vous avec l'utilisateur domaine" -ForegroundColor White
Write-Host "  2. Vérifiez que les tâches s'exécutent: Get-ScheduledTask | Where-Object {`$_.TaskName -like 'Dashboard-*'}" -ForegroundColor White
Write-Host "  3. Vérifiez le dashboard: http://localhost:5173" -ForegroundColor White
Write-Host "  4. Supprimez l'ancien répertoire si tout fonctionne: $sourcePath" -ForegroundColor White
Write-Host ""
