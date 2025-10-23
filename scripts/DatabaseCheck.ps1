# Script de verification de la base de donnees SQLite
param(
    [string]$Action = "check"
)

$dbPath = ".\backend\data\app.db"

Write-Host "Verification Base de Donnees - Dashboard Semmaris" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

if (!(Test-Path $dbPath)) {
    Write-Host "ERREUR: Base de donnees non trouvee: $dbPath" -ForegroundColor Red
    exit 1
}

Write-Host "Base de donnees trouvee: $dbPath" -ForegroundColor Cyan

# Verifier la taille du fichier
$dbSize = (Get-Item $dbPath).Length
Write-Host "Taille: $($dbSize) octets" -ForegroundColor White

switch ($Action.ToLower()) {
    "check" {
        Write-Host ""
        Write-Host "Verification de l'integrite..." -ForegroundColor Cyan
        
        # Utiliser sqlite3 si disponible
        try {
            $tables = sqlite3 $dbPath ".tables"
            Write-Host "Tables disponibles:" -ForegroundColor White
            Write-Host $tables -ForegroundColor Gray
            
            Write-Host ""
            Write-Host "Nombre d'equipements:" -ForegroundColor White
            $equipmentCount = sqlite3 $dbPath "SELECT COUNT(*) FROM equipment;"
            Write-Host $equipmentCount -ForegroundColor Cyan
            
            Write-Host ""
            Write-Host "Nombre d'utilisateurs:" -ForegroundColor White
            $userCount = sqlite3 $dbPath "SELECT COUNT(*) FROM users;"
            Write-Host $userCount -ForegroundColor Cyan
            
        } catch {
            Write-Host "SQLite3 non disponible. Verification basique uniquement." -ForegroundColor Yellow
        }
    }
    
    "backup" {
        $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
        $backupPath = ".\backups\db_backup_$timestamp.db"
        
        Write-Host "Creation backup: $backupPath" -ForegroundColor Cyan
        
        if (!(Test-Path ".\backups")) {
            New-Item -ItemType Directory -Path ".\backups" -Force | Out-Null
        }
        
        Copy-Item $dbPath $backupPath
        Write-Host "Backup cree avec succes!" -ForegroundColor Green
    }
    
    "info" {
        Write-Host ""
        Write-Host "Informations detaillees:" -ForegroundColor White
        Write-Host "Chemin: $dbPath" -ForegroundColor Gray
        Write-Host "Taille: $dbSize octets" -ForegroundColor Gray
        Write-Host "Modifie: $((Get-Item $dbPath).LastWriteTime)" -ForegroundColor Gray
        
        # Fichiers associes
        $shmFile = $dbPath -replace "\.db$", ".db-shm"
        $walFile = $dbPath -replace "\.db$", ".db-wal"
        
        if (Test-Path $shmFile) {
            $shmSize = (Get-Item $shmFile).Length
            Write-Host "Fichier SHM: $shmSize octets" -ForegroundColor Gray
        }
        
        if (Test-Path $walFile) {
            $walSize = (Get-Item $walFile).Length
            Write-Host "Fichier WAL: $walSize octets" -ForegroundColor Gray
        }
    }
    
    default {
        Write-Host "Usage: .\scripts\DatabaseCheck.ps1 [Action]" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Actions disponibles:" -ForegroundColor White
        Write-Host "  check   - Verification de base (defaut)" -ForegroundColor Gray
        Write-Host "  backup  - Cree un backup de la DB" -ForegroundColor Gray
        Write-Host "  info    - Informations detaillees" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Verification terminee!" -ForegroundColor Green