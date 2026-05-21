# Installation du service SimplePing comme tache planifiee

$ErrorActionPreference = "Stop"

Write-Host "=== Installation SimplePing Service ===" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Join-Path $PSScriptRoot "SimplePing.ps1"
$taskName = "SemmarisSimplePing"

# Verifier si le script existe
if (-not (Test-Path $scriptPath)) {
    Write-Host "Erreur: SimplePing.ps1 introuvable!" -ForegroundColor Red
    exit 1
}

# Verifier si la tache existe deja
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Tache existante trouvee. Suppression..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Creer l'action
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

# Creer le declencheur (au demarrage du systeme)
$trigger = New-ScheduledTaskTrigger -AtStartup

# Parametres de la tache
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365)

# Creer la tache (utilisateur actuel avec privileges eleves)
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Description "Service de monitoring ping simple pour Semmaris Dashboard" | Out-Null

Write-Host "Tache planifiee creee avec succes!" -ForegroundColor Green
Write-Host ""
Write-Host "Nom de la tache: $taskName"
Write-Host "Script: $scriptPath"
Write-Host "Declencheur: Au demarrage du systeme"
Write-Host "Relance automatique: Oui (999 tentatives toutes les 1 min)"
Write-Host ""

# Demander si on demarre maintenant
$start = Read-Host "Voulez-vous demarrer le service maintenant? (O/N)"
if ($start -eq "O" -or $start -eq "o") {
    Start-ScheduledTask -TaskName $taskName
    Write-Host "Service demarre!" -ForegroundColor Green
}
else {
    Write-Host "Service non demarre. Utilisez: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pour verifier l'etat: Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Cyan
Write-Host "Pour arreter: Stop-ScheduledTask -TaskName '$taskName'" -ForegroundColor Cyan
Write-Host "Pour desinstaller: .\UninstallSimplePing.ps1" -ForegroundColor Cyan
