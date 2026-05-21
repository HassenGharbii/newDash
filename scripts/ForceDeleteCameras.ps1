#Requires -Version 5.1

<#
.SYNOPSIS
    Force la suppression des caméras via SQLite direct

.DESCRIPTION
    Copie la base, supprime les caméras sans FK, puis remplace l'originale
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  SUPPRESSION FORCEE DES CAMERAS" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Supprimer TOUTES les cameras? (o/N)"
if ($confirmation -ne 'o' -and $confirmation -ne 'O') {
    Write-Host "Annule." -ForegroundColor Yellow
    exit 0
}

# Script Node.js qui force la suppression
$nodeScript = @"
const fs = require('fs');
const path = require('path');

const dbPath = './data/dashboard.db';
const backupPath = './data/dashboard.db.backup_' + Date.now();

try {
  console.log('[1/5] Backup de la base...');
  fs.copyFileSync(dbPath, backupPath);
  
  console.log('[2/5] Chargement better-sqlite3...');
  const Database = require('./node_modules/better-sqlite3/lib/index.js');
  const db = new Database(dbPath);
  
  console.log('[3/5] Désactivation FK...');
  db.pragma('foreign_keys = OFF');
  
  console.log('[4/5] Suppression bandwidth_data...');
  const bw = db.prepare('DELETE FROM bandwidth_data WHERE equipment_id IN (SELECT id FROM equipment WHERE type = ?)').run('Camera');
  console.log('  -> ' + bw.changes + ' entrées');
  
  console.log('[5/5] Suppression caméras...');
  const cam = db.prepare('DELETE FROM equipment WHERE type = ?').run('Camera');
  console.log('  -> ' + cam.changes + ' caméras');
  
  db.close();
  
  console.log('');
  console.log('✓ SUCCES');
  
} catch (e) {
  console.error('✗ ERREUR: ' + e.message);
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, dbPath);
  }
  process.exit(1);
}
"@

try {
    # Créer script temporaire
    $tempFile = New-TemporaryFile
    $nodeScript | Out-File -FilePath $tempFile -Encoding UTF8 -Force
    
    # Copier dans le conteneur (API en cours d'exécution)
    Write-Host "Copie du script dans le conteneur..." -ForegroundColor Cyan
    docker cp $tempFile "dashboard-semmaris-base-propre-api-1:/tmp/force_clean.js" 2>&1 | Out-Null
    
    # Exécuter
    Write-Host ""
    $result = docker exec -w /app dashboard-semmaris-base-propre-api-1 node /tmp/force_clean.js 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host $result -ForegroundColor Green
    } else {
        Write-Host $result -ForegroundColor Red
        throw "Erreur d'execution"
    }
    
    # Nettoyer
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  SUPPRESSION TERMINEE" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "Erreur: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Termine! Vous pouvez reimporter vos cameras." -ForegroundColor Cyan
Write-Host ""
