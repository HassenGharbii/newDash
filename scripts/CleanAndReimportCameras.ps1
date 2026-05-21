#Requires -Version 5.1

<#
.SYNOPSIS
    Supprime toutes les cameras de la base de donnees

.DESCRIPTION
    Ce script supprime toutes les cameras existantes pour permettre
    une reimportation propre depuis un fichier Excel.
    
    Les donnees de bandwidth associees seront mises a NULL automatiquement.

.EXAMPLE
    .\CleanAndReimportCameras.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Configuration
$apiUrl = "http://localhost:4000"
$adminIdentifier = "Axone"
$adminPassword = "Ax0nesys!"

Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  SUPPRESSION DE TOUTES LES CAMERAS" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "ATTENTION: Cette operation va supprimer TOUTES les cameras" -ForegroundColor Red
Write-Host "Les donnees de bandwidth associees seront conservees mais orphelines" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Etes-vous sur de vouloir continuer? Tapez 'SUPPRIMER' pour confirmer"

if ($confirmation -ne 'SUPPRIMER') {
    Write-Host "Operation annulee." -ForegroundColor Green
    exit 0
}

# Connexion a l'API
Write-Host ""
Write-Host "[1/3] Connexion a l'API..." -ForegroundColor Cyan
$loginBody = @{
    identifier = $adminIdentifier
    password = $adminPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri ($apiUrl + "/auth/login") -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "      OK Connecte" -ForegroundColor Green
} catch {
    Write-Host "      Erreur de connexion: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Recuperer toutes les cameras
Write-Host "[2/3] Recuperation des cameras..." -ForegroundColor Cyan
$allCameras = @()
$page = 1
$pageSize = 100

do {
    try {
        $url = $apiUrl + "/equipment/search?type=Camera" + "&page=" + $page + "&pageSize=" + $pageSize
        $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers
        
        if ($response.items -and $response.items.Count -gt 0) {
            $allCameras += $response.items
            Write-Host "      Page $page : $($response.items.Count) cameras" -ForegroundColor Gray
        }
        
        $page++
    } catch {
        Write-Host "      Erreur lors de la recuperation: $_" -ForegroundColor Red
        break
    }
} while ($response.items.Count -eq $pageSize)

Write-Host "      Total: $($allCameras.Count) cameras a supprimer" -ForegroundColor Yellow

if ($allCameras.Count -eq 0) {
    Write-Host ""
    Write-Host "Aucune camera a supprimer." -ForegroundColor Green
    exit 0
}

# Derniere confirmation
Write-Host ""
Write-Host "Vous allez supprimer $($allCameras.Count) cameras." -ForegroundColor Yellow
$finalConfirmation = Read-Host "Confirmer la suppression? (o/N)"

if ($finalConfirmation -ne 'o' -and $finalConfirmation -ne 'O') {
    Write-Host "Operation annulee." -ForegroundColor Green
    exit 0
}

# Suppression en masse
Write-Host ""
Write-Host "[3/3] Suppression des cameras..." -ForegroundColor Cyan

# Utiliser l'endpoint de suppression en masse
$cameraIds = $allCameras | ForEach-Object { $_.id }

try {
    $deleteBody = @{
        ids = $cameraIds
    } | ConvertTo-Json
    
    $deleteUrl = $apiUrl + "/equipment/bulk-delete"
    $result = Invoke-RestMethod -Uri $deleteUrl -Method POST -Headers $headers -Body $deleteBody
    
    Write-Host "      $($result.deleted) cameras supprimees" -ForegroundColor Green
} catch {
    Write-Host "      Erreur lors de la suppression en masse: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "      Tentative de suppression individuelle..." -ForegroundColor Yellow
    
    $deletedCount = 0
    $errorCount = 0
    
    foreach ($camera in $allCameras) {
        try {
            $deleteUrl = $apiUrl + "/equipment/" + $camera.id
            Invoke-RestMethod -Uri $deleteUrl -Method DELETE -Headers $headers | Out-Null
            $deletedCount++
            
            if ($deletedCount % 50 -eq 0) {
                Write-Host "      $deletedCount cameras supprimees..." -ForegroundColor Gray
            }
        } catch {
            $errorCount++
            if ($errorCount -le 5) {
                Write-Host "      Erreur pour $($camera.name): $_" -ForegroundColor Red
            }
        }
    }
    
    Write-Host "      $deletedCount cameras supprimees" -ForegroundColor Green
    if ($errorCount -gt 0) {
        Write-Host "      $errorCount erreurs" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  SUPPRESSION TERMINEE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Vous pouvez maintenant reimporter vos cameras depuis Excel." -ForegroundColor Cyan
Write-Host ""
