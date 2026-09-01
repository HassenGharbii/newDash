<#
.SYNOPSIS
    Boucle d'appel periodique de BackupManager.ps1 - pour execution continue
    (ex: conteneur Docker qui doit rester "up", contrairement a une tache planifiee ponctuelle).

.EXEMPLE
    .\BackupLoop.ps1
    .\BackupLoop.ps1 -DbDir "/data" -BackupDir "/data/backups" -IntervalSeconds 86400
#>

param(
    [string]$DbDir = "/data",
    [string]$BackupDir = "/data/backups",
    [int]$RetentionDays = 30,
    [int]$IntervalSeconds = 86400
)

$backupScript = Join-Path $PSScriptRoot "BackupManager.ps1"

while ($true) {
    & $backupScript backup -DbDir $DbDir -BackupDir $BackupDir -RetentionDays $RetentionDays
    Start-Sleep -Seconds $IntervalSeconds
}
