# Script de monitoring ping simple
# Ping tous les equipements toutes les 3 minutes

$ErrorActionPreference = "Continue"

# Configuration
$configPath = Join-Path $PSScriptRoot "config.json"
$config = Get-Content $configPath | ConvertFrom-Json

$apiBase = $config.apiBase
$adminEmail = $config.adminEmail
$adminPassword = $config.adminPassword
$ingestKey = $config.ingestKey
$pollIntervalSeconds = 180  # 3 minutes

Write-Host "=== Demarrage SimplePing ===" -ForegroundColor Green
Write-Host "API: $apiBase"
Write-Host "Intervalle: $pollIntervalSeconds secondes (3 minutes)"
Write-Host ""

function Get-AuthToken {
    try {
        $body = @{
            identifier = $adminEmail
            password = $adminPassword
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$apiBase/auth/login" `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -ErrorAction Stop

        return $response.token
    }
    catch {
        Write-Host "Erreur authentification: $_" -ForegroundColor Red
        return $null
    }
}

function Get-Equipment {
    param([string]$token)
    
    try {
        $headers = @{
            Authorization = "Bearer $token"
        }
        
        $response = Invoke-RestMethod -Uri "$apiBase/equipment" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        return $response
    }
    catch {
        Write-Host "Erreur recuperation equipements: $_" -ForegroundColor Red
        return @()
    }
}

function Test-Ping {
    param([string]$ip)
    
    # Nettoyer l'IP (enlever le port si present)
    $cleanIp = $ip -replace ':\d+$', ''
    
    # Tenter 3 fois avant de declarer DOWN
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $result = ping $cleanIp -n 1 -w 1000 | Out-String
            
            if ($result -match "TTL=") {
                # Extraire la latence
                if ($result -match "time[=<](\d+)ms") {
                    return @{
                        status = "UP"
                        latency = [int]$matches[1]
                    }
                }
                return @{
                    status = "UP"
                    latency = 0
                }
            }
        }
        catch {
            # Continuer vers la prochaine tentative
        }
        
        # Si ce n'est pas la derniere tentative, attendre 500ms avant de reessayer
        if ($attempt -lt 3) {
            Start-Sleep -Milliseconds 500
        }
    }
    
    # Les 3 tentatives ont echoue
    return @{
        status = "DOWN"
        latency = $null
    }
}

function Send-PingBatch {
    param([array]$results)
    
    try {
        $body = @{
            results = $results
        } | ConvertTo-Json -Depth 3

        $headers = @{
            "x-ingest-key" = $ingestKey
        }

        $response = Invoke-RestMethod -Uri "$apiBase/ingest/ping/batch" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -ContentType "application/json" `
            -ErrorAction Stop
        
        return $response
    }
    catch {
        Write-Host "Erreur envoi batch: $_" -ForegroundColor Red
        return $null
    }
}

# Boucle principale
while ($true) {
    $cycleStart = Get-Date
    Write-Host "--- Nouveau cycle: $(Get-Date -Format 'HH:mm:ss') ---" -ForegroundColor Cyan
    
    # Authentification
    $token = Get-AuthToken
    if (-not $token) {
        Write-Host "Impossible de s'authentifier, attente 60s..." -ForegroundColor Red
        Start-Sleep -Seconds 60
        continue
    }
    
    # Recuperer les equipements
    $equipment = Get-Equipment -token $token
    if ($equipment.Count -eq 0) {
        Write-Host "Aucun equipement recupere, attente 60s..." -ForegroundColor Red
        Start-Sleep -Seconds 60
        continue
    }
    
    Write-Host "Ping de $($equipment.Count) equipements..."
    Write-Host "Debut du ping: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow
    
    $upCount = 0
    $downCount = 0
    $processed = 0
    $results = @()  # Stocker tous les resultats avant envoi
    
    # Phase 1: Ping tous les equipements (sans envoyer)
    foreach ($eq in $equipment) {
        $processed++
        
        # Afficher progression tous les 50 equipements
        if ($processed % 50 -eq 0) {
            Write-Host "  Progression: $processed/$($equipment.Count) - UP: $upCount, DOWN: $downCount" -ForegroundColor Cyan
        }
        
        # Premier ping - afficher pour debug
        if ($processed -eq 1) {
            Write-Host "  Premier ping: $($eq.ip)" -ForegroundColor Yellow
        }
        
        # Ping
        $pingResult = Test-Ping -ip $eq.ip
        
        # Stocker le resultat pour envoi groupé (format compatible JSON)
        $results += [PSCustomObject]@{
            ip = $eq.ip
            status = $pingResult.status
            latency_ms = $pingResult.latency
        }
        
        if ($pingResult.status -eq "UP") {
            $upCount++
        }
        else {
            $downCount++
        }
    }
    
    $pingEnd = Get-Date
    $pingDuration = ($pingEnd - $cycleStart).TotalSeconds
    
    Write-Host ""
    Write-Host "Ping termine en $([math]::Round($pingDuration, 1))s" -ForegroundColor Green
    Write-Host "  UP: $upCount" -ForegroundColor Green
    Write-Host "  DOWN: $downCount" -ForegroundColor Red
    Write-Host ""
    
    # Phase 2: Envoyer TOUS les resultats en UNE SEULE requete batch
    Write-Host "Envoi batch de $($results.Count) resultats..." -ForegroundColor Cyan
    
    $batchResponse = Send-PingBatch -results $results
    
    $cycleEnd = Get-Date
    $duration = ($cycleEnd - $cycleStart).TotalSeconds
    
    Write-Host ""
    if ($batchResponse) {
        Write-Host "Batch envoye avec succes!" -ForegroundColor Green
        Write-Host "  Mis a jour: $($batchResponse.updated)" -ForegroundColor Green
        if ($batchResponse.notFound -gt 0) {
            Write-Host "  Non trouves: $($batchResponse.notFound)" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "Echec envoi batch!" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Cycle termine en $([math]::Round($duration, 1))s" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaine execution dans $pollIntervalSeconds secondes..." -ForegroundColor Yellow
    Write-Host ""
    
    Start-Sleep -Seconds $pollIntervalSeconds
}
