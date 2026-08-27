<#
.SYNOPSIS
    Sauvegarde et restauration de la base SQLite du dashboard Semmaris.

.DESCRIPTION
    backup  : copie app.db (+ -wal/-shm) dans un dossier horodate sous backend/data/backups,
              puis supprime les sauvegardes plus anciennes que -RetentionDays.
    restore : restaure une sauvegarde precedente (sauvegarde de securite de l'etat actuel au passage).
              ARRETEZ D'ABORD LE BACKEND (API) - sous Windows, SQLite garde le fichier
              mappe en memoire et la restauration echoue avec "user-mapped section open"
              si le processus node tourne encore.
    list    : liste les sauvegardes disponibles.

.EXEMPLE
    .\BackupManager.ps1 backup
    .\BackupManager.ps1 list
    .\BackupManager.ps1 restore -RestoreFrom "2026-08-26_140000"
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('backup', 'restore', 'list')]
    [string]$Action = 'backup',

    [string]$DbDir = $(Join-Path $PSScriptRoot "..\backend\data"),
    [string]$BackupDir = $(Join-Path $PSScriptRoot "..\backend\data\backups"),
    [int]$RetentionDays = 30,
    [string]$RestoreFrom
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Level = "INFO", [string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts][$Level] $Message"
}

$DbFile = Join-Path $DbDir "app.db"

function Backup-Database {
    if (-not (Test-Path $DbFile)) {
        Write-Log "ERROR" "Base introuvable: $DbFile"
        exit 1
    }

    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }

    $stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $target = Join-Path $BackupDir $stamp
    New-Item -ItemType Directory -Path $target -Force | Out-Null

    $copied = 0
    foreach ($suffix in @("", "-shm", "-wal")) {
        $src = "$DbFile$suffix"
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $target -Force
            $copied++
        }
    }

    if ($copied -eq 0) {
        Write-Log "ERROR" "Aucun fichier copie - sauvegarde annulee."
        Remove-Item -Path $target -Recurse -Force
        exit 1
    }

    Write-Log "INFO" "Sauvegarde creee: $target"

    # Retention: supprime les sauvegardes plus anciennes que RetentionDays
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.CreationTime -lt $cutoff } |
        ForEach-Object {
            Write-Log "INFO" "Suppression de l'ancienne sauvegarde (> $RetentionDays jours): $($_.Name)"
            Remove-Item -Path $_.FullName -Recurse -Force
        }
}

function Restore-Database {
    if (-not $RestoreFrom) {
        Write-Log "ERROR" "Utilisez -RestoreFrom <nom_dossier> (voir '.\BackupManager.ps1 list')"
        exit 1
    }

    $source = Join-Path $BackupDir $RestoreFrom
    if (-not (Test-Path $source)) {
        Write-Log "ERROR" "Sauvegarde introuvable: $source"
        exit 1
    }

    # Sauvegarde de securite de la base actuelle avant restauration
    if (Test-Path $DbFile) {
        $safety = Join-Path $BackupDir "avant-restauration_$(Get-Date -Format 'yyyy-MM-dd_HHmmss')"
        New-Item -ItemType Directory -Path $safety -Force | Out-Null
        foreach ($suffix in @("", "-shm", "-wal")) {
            $src = "$DbFile$suffix"
            if (Test-Path $src) { Copy-Item -Path $src -Destination $safety -Force }
        }
        Write-Log "INFO" "Base actuelle sauvegardee par securite dans: $safety"
    }

    foreach ($suffix in @("", "-shm", "-wal")) {
        $backupFile = Join-Path $source "app.db$suffix"
        $dest = "$DbFile$suffix"
        if (Test-Path $backupFile) {
            Copy-Item -Path $backupFile -Destination $dest -Force
        } elseif (Test-Path $dest) {
            Remove-Item -Path $dest -Force
        }
    }

    Write-Log "INFO" "Restauration terminee depuis: $source"
    Write-Log "WARN" "Redemarrez le backend pour qu'il reprenne la base restauree."
}

function List-Backups {
    if (-not (Test-Path $BackupDir)) {
        Write-Log "INFO" "Aucune sauvegarde (dossier $BackupDir introuvable)."
        return
    }
    $found = $false
    Get-ChildItem -Path $BackupDir -Directory | Sort-Object Name -Descending | ForEach-Object {
        $found = $true
        $size = (Get-ChildItem -Path $_.FullName -File | Measure-Object -Property Length -Sum).Sum
        $sizeKb = [math]::Round($size / 1KB, 1)
        Write-Host "$($_.Name)  ($sizeKb KB)"
    }
    if (-not $found) { Write-Log "INFO" "Aucune sauvegarde trouvee dans $BackupDir." }
}

switch ($Action) {
    'backup'  { Backup-Database }
    'restore' { Restore-Database }
    'list'    { List-Backups }
}
