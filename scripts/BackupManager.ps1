# Script de Backup - Dashboard Semmaris
param(
    [string]$Action = "backup",
    [string]$BackupName = "",
    [string]$BackupPath = "./backups"
)

# Creer le dossier de backup
if (!(Test-Path $BackupPath)) {
    New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

switch ($Action.ToLower()) {
    "backup" {
        if ($BackupName -eq "") {
            $BackupName = "backup_$timestamp"
        }
        
        $backupFile = "$BackupPath\$BackupName.zip"
        
        Write-Host "Creation du backup: $BackupName" -ForegroundColor Green
        
        # Arreter les conteneurs temporairement
        Write-Host "Arret temporaire des conteneurs..." -ForegroundColor Yellow
        docker compose down
        
        # Creer l'archive
        Write-Host "Compression des donnees..." -ForegroundColor Cyan
        
        # Fichiers a sauvegarder
        $itemsToBackup = @()
        
        # Ajouter les fichiers s'ils existent
        if (Test-Path ".\backend\data") {
            $itemsToBackup += ".\backend\data"
        }
        if (Test-Path ".\docker-compose.yml") {
            $itemsToBackup += ".\docker-compose.yml"
        }
        if (Test-Path ".\backend\.env") {
            $itemsToBackup += ".\backend\.env"
        }
        if (Test-Path ".\frontend\.env") {
            $itemsToBackup += ".\frontend\.env"
        }
        
        if ($itemsToBackup.Count -gt 0) {
            Compress-Archive -Path $itemsToBackup -DestinationPath $backupFile -Force
            Write-Host "Backup cree: $backupFile" -ForegroundColor Green
        } else {
            Write-Host "Aucune donnee a sauvegarder trouvee" -ForegroundColor Yellow
        }
        
        # Redemarrer les conteneurs
        Write-Host "Redemarrage des conteneurs..." -ForegroundColor Cyan
        docker compose up -d
    }
    
    "restore" {
        Write-Host "Fonction restore disponible prochainement" -ForegroundColor Yellow
    }
    
    "list" {
        Write-Host "Backups disponibles:" -ForegroundColor Cyan
        $backups = Get-ChildItem -Path $BackupPath -Filter "*.zip" -ErrorAction SilentlyContinue
        
        if ($backups) {
            foreach ($backup in $backups) {
                $size = [math]::Round($backup.Length / 1KB, 2)
                Write-Host "  $($backup.BaseName) - $($backup.LastWriteTime) - ${size}KB" -ForegroundColor White
            }
        } else {
            Write-Host "  Aucun backup trouve" -ForegroundColor Gray
        }
    }
    
    "info" {
        Write-Host "Informations backup:" -ForegroundColor Cyan
        Write-Host "  Dossier: $BackupPath" -ForegroundColor Gray
        
        if (Test-Path $BackupPath) {
            $backups = Get-ChildItem -Path $BackupPath -Filter "*.zip" -ErrorAction SilentlyContinue
            Write-Host "  Nombre de backups: $($backups.Count)" -ForegroundColor Gray
            
            if ($backups) {
                $totalSize = ($backups | Measure-Object -Property Length -Sum).Sum
                $totalSizeKB = [math]::Round($totalSize / 1KB, 2)
                Write-Host "  Taille totale: ${totalSizeKB}KB" -ForegroundColor Gray
            }
        }
    }
    
    default {
        Write-Host "Usage: .\scripts\BackupManager.ps1 [Action] [Options]" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Actions:" -ForegroundColor White
        Write-Host "  backup  - Cree un backup" -ForegroundColor Gray
        Write-Host "  list    - Liste les backups" -ForegroundColor Gray
        Write-Host "  info    - Informations sur les backups" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Exemples:" -ForegroundColor White
        Write-Host "  .\scripts\BackupManager.ps1 backup" -ForegroundColor Gray
        Write-Host "  .\scripts\BackupManager.ps1 backup -BackupName 'config_initiale'" -ForegroundColor Gray
        Write-Host "  .\scripts\BackupManager.ps1 list" -ForegroundColor Gray
    }
}

Write-Host "Operation terminee" -ForegroundColor Green