# Script de monitoring ping simple
# Ping tous les equipements toutes les 3 minutes

$ErrorActionPreference = "Continue"

# Configuration
$configPath = Join-Path $PSScriptRoot "config.json"
$config = Get-Content $configPath | ConvertFrom-Json

$apiBase = if ($env:API_URL) { $env:API_URL } else { $config.apiBase }
$adminEmail = $config.adminEmail
$adminPassword = $config.adminPassword
$ingestKey = $config.ingestKey
$pollIntervalSeconds = 180  # 3 minutes

# Nombre de pings simultanes (PowerShell 7+ uniquement - voir Test-PingAll). Avec un grand
# parc (ex: >1000 cameras), le ping sequentiel avec retries peut prendre des heures pour un
# seul cycle ; le parallelisme ramene ca a moins d'une minute.
$pingThrottleLimit = if ($env:PING_THROTTLE_LIMIT) { [int]$env:PING_THROTTLE_LIMIT } else { 60 }

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

    # Utilise Test-Connection (cross-platform : fonctionne en Windows PowerShell 5.1
    # ET en PowerShell 7/pwsh sous Linux - contrairement a l'appel a "ping" qui a des
    # options incompatibles entre Windows (-n/-w) et Linux (-c/-W)).
    # Tenter 3 fois avant de declarer DOWN
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $reply = Test-Connection -ComputerName $cleanIp -Count 1 -ErrorAction Stop
            if ($reply) {
                $r = $reply | Select-Object -First 1
                $latency = 0
                if ($r.PSObject.Properties.Name -contains 'Latency' -and $null -ne $r.Latency) {
                    $latency = [int]$r.Latency
                } elseif ($r.PSObject.Properties.Name -contains 'ResponseTime' -and $null -ne $r.ResponseTime) {
                    $latency = [int]$r.ResponseTime
                }
                return @{
                    status = "UP"
                    latency = $latency
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

# Ping l'ensemble du parc. En PowerShell 7+ (le conteneur Docker), ping en parallele avec
# ForEach-Object -Parallel - indispensable a grande echelle (des centaines/milliers
# d'equipements en sequentiel avec retries peut prendre des heures pour un seul cycle).
# Repli sequentiel (fonction Test-Ping ci-dessus) si execute sous Windows PowerShell 5.1
# natif, qui ne supporte pas -Parallel.
function Test-PingAll {
    param([array]$Equipment, [int]$ThrottleLimit = 60)

    if ($PSVersionTable.PSVersion.Major -ge 7) {
        return $Equipment | ForEach-Object -ThrottleLimit $ThrottleLimit -Parallel {
            $eq = $_
            $cleanIp = $eq.ip -replace ':\d+$', ''
            $status = "DOWN"
            $latency = $null

            for ($attempt = 1; $attempt -le 2; $attempt++) {
                try {
                    $reply = Test-Connection -ComputerName $cleanIp -Count 1 -TimeoutSeconds 1 -ErrorAction Stop
                    if ($reply) {
                        $r = $reply | Select-Object -First 1
                        $status = "UP"
                        $latency = 0
                        if ($r.PSObject.Properties.Name -contains 'Latency' -and $null -ne $r.Latency) {
                            $latency = [int]$r.Latency
                        } elseif ($r.PSObject.Properties.Name -contains 'ResponseTime' -and $null -ne $r.ResponseTime) {
                            $latency = [int]$r.ResponseTime
                        }
                        break
                    }
                } catch {
                    # Continuer vers la prochaine tentative
                }
                if ($attempt -lt 2) { Start-Sleep -Milliseconds 300 }
            }

            [PSCustomObject]@{ ip = $eq.ip; status = $status; latency_ms = $latency }
        }
    } else {
        $results = @()
        foreach ($eq in $Equipment) {
            $pingResult = Test-Ping -ip $eq.ip
            $results += [PSCustomObject]@{ ip = $eq.ip; status = $pingResult.status; latency_ms = $pingResult.latency }
        }
        return $results
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
    
    Write-Host "Ping de $($equipment.Count) equipements (parallelisme: $(if ($PSVersionTable.PSVersion.Major -ge 7) { $pingThrottleLimit } else { 'sequentiel, PS5.1' }))..."
    Write-Host "Debut du ping: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow

    # Phase 1: Ping tous les equipements (sans envoyer) - en parallele si possible
    $results = @(Test-PingAll -Equipment $equipment -ThrottleLimit $pingThrottleLimit)
    $upCount = @($results | Where-Object { $_.status -eq 'UP' }).Count
    $downCount = @($results | Where-Object { $_.status -eq 'DOWN' }).Count

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
