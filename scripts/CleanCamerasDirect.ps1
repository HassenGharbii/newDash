#Requires -Version 5.1

<#
.SYNOPSIS
    Nettoie directement la base de données SQLite

.DESCRIPTION
    Ce script supprime toutes les caméras en accédant directement à la base,
    en contournant les problèmes d'API.

.EXAMPLE
    .\CleanCamerasDirect.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  NETTOYAGE DIRECT DE LA BASE DE DONNEES" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  SUPPRESSION DES CAMERAS" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# Créer un script Node.js temporaire
$nodeScript = @"
const db = require('better-sqlite3')('./data/dashboard.db');
const fs = require('fs');

try {
  console.log('[1/3] Désactivation des FK...');
  db.pragma('foreign_keys = OFF');
  
  console.log('[2/3] Suppression des données de bandwidth...');
  const bandwidthDeleted = db.prepare('DELETE FROM bandwidth_data WHERE equipment_id IN (SELECT id FROM equipment WHERE type = ?)').run('Camera');
  console.log('  -> ' + bandwidthDeleted.changes + ' entrées supprimées');
  
  console.log('[3/3] Suppression des caméras...');
  const camerasDeleted = db.prepare('DELETE FROM equipment WHERE type = ?').run('Camera');
  console.log('  -> ' + camerasDeleted.changes + ' caméras supprimées');
  
  db.pragma('foreign_keys = ON');
  
  console.log('');
  console.log('✓ Suppression réussie!');
} catch (e) {
  console.error('✗ Erreur: ' + e.message);
  process.exit(1);
}
"@

Write-Host "Exécution du nettoyage..." -ForegroundColor Cyan
Write-Host ""

try {
    # Créer un fichier Node.js temporaire
    $tempFile = New-TemporaryFile -ErrorAction Stop
    $nodeScript | Out-File -FilePath $tempFile -Encoding UTF8 -Force
    
    # Copier dans le conteneur
    docker cp $tempFile "dashboard-semmaris-base-propre-api-1:/tmp/clean.js" 2>&1 | Out-Null
    
    # Exécuter
    $result = docker exec -w /app dashboard-semmaris-base-propre-api-1 node /tmp/clean.js 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host $result -ForegroundColor Green
    } else {
        Write-Host $result -ForegroundColor Red
        throw "Erreur lors de l'exécution"
    }
    
    # Nettoyer
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  SUPPRESSION TERMINEE" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
} catch {
    Write-Host "Erreur lors de la suppression: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
