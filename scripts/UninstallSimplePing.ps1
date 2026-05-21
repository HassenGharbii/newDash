# Desinstallation du service SimplePing

$ErrorActionPreference = "Stop"

Write-Host "=== Desinstallation SimplePing Service ===" -ForegroundColor Cyan
Write-Host ""

$taskName = "SemmarisSimplePing"

# Verifier si la tache existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $existingTask) {
    Write-Host "Aucune tache '$taskName' trouvee." -ForegroundColor Yellow
    exit 0
}

# Arreter la tache si elle est en cours
Write-Host "Arret de la tache..." -ForegroundColor Yellow
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

# Supprimer la tache
Write-Host "Suppression de la tache..." -ForegroundColor Yellow
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false

Write-Host ""
Write-Host "Service desinstalle avec succes!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Les logs et scripts ne sont pas supprimes." -ForegroundColor Cyan
