#Requires -Version 5.1

<#
.SYNOPSIS
    Transforme les IPs des cameras de 10.10.x.xx vers 10.10.x.0xx

.DESCRIPTION
    Ce script transforme toutes les cameras ayant une IP au format 10.10.x.xx
    vers le format 10.10.x.0xx en ajoutant un zero devant le dernier octet.
    Si une camera avec la nouvelle IP existe deja (meme nom), elle sera supprimee
    avant la mise a jour.

.EXAMPLE
    .\FixCameraIPs.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Configuration
$apiUrl = "http://localhost:4000"
$adminIdentifier = "Axone"
$adminPassword = "Ax0nesys!"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Transformation des IPs des cameras" -ForegroundColor Cyan
Write-Host "  Format: 10.10.x.xx => 10.10.x.0xx" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Recuperer le token admin
Write-Host "[1/5] Connexion a l'API..." -ForegroundColor Cyan
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
Write-Host "[2/5] Recuperation des cameras..." -ForegroundColor Cyan
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

Write-Host "      Total: $($allCameras.Count) cameras recuperees" -ForegroundColor Green

# Analyser les cameras a transformer
Write-Host "[3/5] Analyse des IPs..." -ForegroundColor Cyan
$camerasToUpdate = @()
$duplicatesToDelete = @()

foreach ($camera in $allCameras) {
    if ($camera.ip -match '^10\.10\.(\d+)\.(\d+)$') {
        $thirdOctet = $matches[1]
        $lastOctet = [int]$matches[2]
        
        # Verifier si le dernier octet est inferieur a 100 (donc pas deja au format 0xx)
        if ($lastOctet -lt 100) {
            # Construire la nouvelle IP avec zero devant
            $newIP = "10.10." + $thirdOctet + ".0" + $lastOctet.ToString().PadLeft(2, '0')
            
            # Verifier si une camera avec cette nouvelle IP existe deja (meme nom)
            $duplicate = $allCameras | Where-Object { 
                $_.ip -eq $newIP -and $_.name -eq $camera.name -and $_.id -ne $camera.id
            }
            
            if ($duplicate) {
                # Ajouter le doublon a supprimer (celui qui a deja l'IP en 0xx)
                $duplicatesToDelete += $duplicate
                Write-Host "      Doublon trouve: $($camera.name) - $($camera.ip) ET $($duplicate.ip)" -ForegroundColor Yellow
            }
            
            $camerasToUpdate += @{
                id = $camera.id
                name = $camera.name
                oldIP = $camera.ip
                newIP = $newIP
            }
        }
    }
}

Write-Host "      $($camerasToUpdate.Count) cameras a transformer" -ForegroundColor Green
Write-Host "      $($duplicatesToDelete.Count) doublons a supprimer" -ForegroundColor Yellow

if ($camerasToUpdate.Count -eq 0) {
    Write-Host ""
    Write-Host "Aucune camera a transformer. Termine." -ForegroundColor Green
    exit 0
}

# Afficher un apercu
Write-Host ""
Write-Host "Apercu des transformations (5 premieres):" -ForegroundColor Cyan
$camerasToUpdate | Select-Object -First 5 | ForEach-Object {
    Write-Host "  - $($_.name)" -ForegroundColor White
    Write-Host "    $($_.oldIP) => $($_.newIP)" -ForegroundColor Gray
}

if ($camerasToUpdate.Count -gt 5) {
    Write-Host "  ... et $($camerasToUpdate.Count - 5) autres" -ForegroundColor Gray
}

# Demander confirmation
Write-Host ""
$confirmation = Read-Host "Confirmer la transformation de $($camerasToUpdate.Count) cameras? (o/N)"

if ($confirmation -ne 'o' -and $confirmation -ne 'O') {
    Write-Host "Operation annulee." -ForegroundColor Yellow
    exit 0
}

# Supprimer les doublons d'abord
if ($duplicatesToDelete.Count -gt 0) {
    Write-Host ""
    Write-Host "[4/5] Suppression des doublons..." -ForegroundColor Cyan
    
    $deletedCount = 0
    foreach ($duplicate in $duplicatesToDelete) {
        try {
            $deleteUrl = $apiUrl + "/equipment/" + $duplicate.id
            Invoke-RestMethod -Uri $deleteUrl -Method DELETE -Headers $headers | Out-Null
            $deletedCount++
            
            if ($deletedCount % 10 -eq 0) {
                Write-Host "      $deletedCount doublons supprimes..." -ForegroundColor Gray
            }
        } catch {
            Write-Host "      Erreur lors de la suppression de $($duplicate.name) (ID: $($duplicate.id)): $_" -ForegroundColor Red
        }
    }
    
    Write-Host "      $deletedCount doublons supprimes" -ForegroundColor Green
}

# Mettre a jour les cameras
Write-Host "[5/5] Mise a jour des IPs..." -ForegroundColor Cyan

$updatedCount = 0
$errorCount = 0

foreach ($camera in $camerasToUpdate) {
    try {
        $updateUrl = $apiUrl + "/equipment/" + $camera.id
        $updateBody = @{
            ip = $camera.newIP
        } | ConvertTo-Json
        
        Invoke-RestMethod -Uri $updateUrl -Method PUT -Headers $headers -Body $updateBody | Out-Null
        $updatedCount++
        
        if ($updatedCount % 50 -eq 0) {
            Write-Host "      $updatedCount cameras mises a jour..." -ForegroundColor Gray
        }
    } catch {
        $errorCount++
        if ($errorCount -le 10) {
            Write-Host "      Erreur pour $($camera.name) ($($camera.oldIP)): $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Transformation terminee!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Cameras mises a jour: $updatedCount" -ForegroundColor White
Write-Host "  Doublons supprimes: $($duplicatesToDelete.Count)" -ForegroundColor White
Write-Host "  Erreurs: $errorCount" -ForegroundColor White
Write-Host ""
