#Requires -Version 5.1

<#
.SYNOPSIS
    Supprime les équipements en doublon basés sur nom + modèle

.DESCRIPTION
    Ce script identifie les équipements avec le même nom ET modèle,
    et supprime les plus récents en gardant l'ancien.

.EXAMPLE
    .\RemoveDuplicateEquipment.ps1
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
Write-Host "  SUPPRESSION DES DOUBLONS (NOM + MODELE)" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# Connexion a l'API
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

# Recuperer toutes les equipements
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

Write-Host "      Total: $($allCameras.Count) cameras" -ForegroundColor Green

# Identifier les doublons
Write-Host "[3/3] Identification des doublons de cameras..." -ForegroundColor Cyan

# Fonction pour normaliser le texte (enlever espaces extras, guillemets, etc)
function Normalize-Text {
    param([string]$text)
    
    if (-not $text) {
        return "__EMPTY__"
    }
    
    # Enlever guillemets, espaces extras, caracteres speciaux
    $normalized = $text.Trim().Replace('"', '').Replace("'", '')
    $normalized = [System.Text.RegularExpressions.Regex]::Replace($normalized, '\s+', ' ')
    $normalized = $normalized.ToLower()
    
    return $normalized
}

# Grouper les cameras par nom + ip + modele normalises
$groupedByNameIpModel = $allCameras | Group-Object { 
    $normalizedName = Normalize-Text -text $_.name
    $normalizedIp = Normalize-Text -text $_.ip
    $normalizedModel = Normalize-Text -text $_.model
    "$normalizedName|$normalizedIp|$normalizedModel"
}

$toDelete = @()

foreach ($group in $groupedByNameIpModel) {
    if ($group.Count -gt 1) {
        # Plusieurs cameras avec le meme nom + ip + modele
        $sorted = $group.Group | Sort-Object { [int]$_.id }
        
        # Garder la plus ancienne (ID le plus bas), supprimer les autres
        $toKeep = $sorted[0]
        $toRemove = $sorted | Select-Object -Skip 1
        
        Write-Host "      Doublon trouve:" -ForegroundColor Yellow
        Write-Host "        Nom: '$($toKeep.name)'" -ForegroundColor Gray
        Write-Host "        IP: $($toKeep.ip)" -ForegroundColor Gray
        Write-Host "        Model: '$($toKeep.model)'" -ForegroundColor Gray
        Write-Host "        Conserve: ID=$($toKeep.id)" -ForegroundColor Green
        
        foreach ($remove in $toRemove) {
            Write-Host "          Suppression: ID=$($remove.id)" -ForegroundColor Red
            $toDelete += $remove
        }
    }
}

Write-Host ""
Write-Host "Total de doublons a supprimer: $($toDelete.Count)" -ForegroundColor Yellow

if ($toDelete.Count -eq 0) {
    Write-Host ""
    Write-Host "Aucun doublon trouve. Termine." -ForegroundColor Green
    exit 0
}

# Demander confirmation
Write-Host ""
$confirmation = Read-Host "Confirmer la suppression de $($toDelete.Count) doublons? (o/N)"

if ($confirmation -ne 'o' -and $confirmation -ne 'O') {
    Write-Host "Operation annulee." -ForegroundColor Green
    exit 0
}

# Suppression en masse
Write-Host ""
Write-Host "Suppression des doublons..." -ForegroundColor Cyan

$deleteIds = $toDelete | ForEach-Object { $_.id }

try {
    $deleteBody = @{
        ids = $deleteIds
    } | ConvertTo-Json
    
    $deleteUrl = $apiUrl + "/equipment/bulk-delete"
    $result = Invoke-RestMethod -Uri $deleteUrl -Method POST -Headers $headers -Body $deleteBody
    
    Write-Host "      $($result.deleted) doublons supprimes" -ForegroundColor Green
} catch {
    Write-Host "      Erreur lors de la suppression en masse: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "      Tentative de suppression individuelle..." -ForegroundColor Yellow
    
    $deletedCount = 0
    $errorCount = 0
    
    foreach ($eq in $toDelete) {
        try {
            $deleteUrl = $apiUrl + "/equipment/" + $eq.id
            Invoke-RestMethod -Uri $deleteUrl -Method DELETE -Headers $headers | Out-Null
            $deletedCount++
            
            if ($deletedCount % 10 -eq 0) {
                Write-Host "      $deletedCount doublons supprimes..." -ForegroundColor Gray
            }
        } catch {
            $errorCount++
            if ($errorCount -le 5) {
                Write-Host "      Erreur pour $($eq.name) (ID: $($eq.id)): $_" -ForegroundColor Red
            }
        }
    }
    
    Write-Host "      $deletedCount doublons supprimes" -ForegroundColor Green
    if ($errorCount -gt 0) {
        Write-Host "      $errorCount erreurs" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  NETTOYAGE TERMINE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
