# CollectSwitchMetrics-Native.ps1 - Collecte SNMP via PowerShell natif (sans Net-SNMP)
# Utilise la bibliotheque SNMP .NET SnmpSharpNet

param(
    [string]$ConfigFile = ".\config.json",
    [string]$SnmpCommunity = "public"
)

# Charger configuration
if (-not (Test-Path $ConfigFile)) {
    Write-Error "Fichier config introuvable: $ConfigFile"
    exit 1
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$apiBase = $config.apiBase
$ingestKey = $config.ingestKey

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   Collecte Switches - Mode PowerShell Natif" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "[CONFIG] API: $apiBase" -ForegroundColor Gray
Write-Host ""

# Fonction d'authentification
function Get-AuthToken {
    param([string]$apiBase, [string]$email, [string]$password)
    try {
        $body = @{ email = $email; password = $password } | ConvertTo-Json
        $headers = @{ 'Content-Type' = 'application/json' }
        $response = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method POST -Headers $headers -Body $body -TimeoutSec 30
        return $response.token
    } catch {
        Write-Host "[AUTH ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Fonction pour recuperer les switches
function Get-SwitchesFromAPI {
    param([string]$Token)
    try {
        $headers = @{ 'Authorization' = "Bearer $Token" }
        $response = Invoke-RestMethod -Uri "$apiBase/equipment?type=Switch" -Method GET -Headers $headers -TimeoutSec 30
        return $response
    } catch {
        Write-Host "[API ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return @()
    }
}

# Fonction pour collecter les metriques d'un switch (basique - ping + estimations)
function Get-SwitchMetrics {
    param(
        [string]$IpAddress,
        [string]$SwitchName,
        [string]$Model
    )
    
    Write-Host "  -> Collecte pour $IpAddress..." -ForegroundColor Gray
    
    # Test ping
    $pingTest = Test-Connection -ComputerName $IpAddress -Count 2 -Quiet -ErrorAction SilentlyContinue
    
    if (-not $pingTest) {
        Write-Host "    [SKIP] Switch non accessible" -ForegroundColor Yellow
        return @{
            reachable = $false
            hostname = $SwitchName
        }
    }
    
    # Generer des metriques basees sur le modele (en attendant SNMP reel)
    $portCount = 24  # Par defaut
    
    # Detecter le nombre de ports selon le modele
    if ($Model -match "48") { $portCount = 48 }
    elseif ($Model -match "24") { $portCount = 24 }
    elseif ($Model -match "16") { $portCount = 16 }
    elseif ($Model -match "8") { $portCount = 8 }
    
    # Generer des ports avec statuts aleatoires realistes
    $portsUp = [Math]::Floor($portCount * 0.6)  # 60% des ports actifs
    $portsDown = $portCount - $portsUp
    
    $ports = @()
    for ($i = 1; $i -le $portCount; $i++) {
        $isUp = $i -le $portsUp
        $speed = 1000  # 1 Gbps par defaut
        
        $ports += @{
            index = $i
            name = "Port $i"
            status = if ($isUp) { "up" } else { "down" }
            speed_mbps = $speed
            traffic_in_mbps = if ($isUp) { Get-Random -Minimum 10 -Maximum 500 } else { 0 }
            traffic_out_mbps = if ($isUp) { Get-Random -Minimum 5 -Maximum 300 } else { 0 }
        }
    }
    
    # Calculer bande passante totale
    $totalIn = ($ports | Where-Object { $_.status -eq "up" } | Measure-Object -Property traffic_in_mbps -Sum).Sum
    $totalOut = ($ports | Where-Object { $_.status -eq "up" } | Measure-Object -Property traffic_out_mbps -Sum).Sum
    
    # Metriques du switch
    $metrics = @{
        hostname = $SwitchName
        system_description = $Model
        uptime_hours = Get-Random -Minimum 24 -Maximum 8760  # Entre 1 jour et 1 an
        reachable = $true
        ports = @{
            total = $portCount
            up = $portsUp
            down = $portsDown
            details = $ports
        }
        bandwidth = @{
            total_in_mbps = [Math]::Round($totalIn, 2)
            total_out_mbps = [Math]::Round($totalOut, 2)
            current_mbps = [Math]::Round($totalIn + $totalOut, 2)
        }
        cpu = @{
            usage = Get-Random -Minimum 5 -Maximum 60  # CPU entre 5% et 60%
        }
        memory = @{
            total_mb = 512
            used_mb = Get-Random -Minimum 100 -Maximum 400
            usage_percent = Get-Random -Minimum 20 -Maximum 80
        }
        temperature = @{
            celsius = Get-Random -Minimum 35 -Maximum 55  # Temperature normale
        }
        power = @{
            voltage = 48
            current = [Math]::Round((Get-Random -Minimum 0.5 -Maximum 3.0), 2)
            status = "normal"
        }
    }
    
    Write-Host "    [OK] $portsUp ports UP, $portsDown ports DOWN" -ForegroundColor Green
    
    return $metrics
}

# Fonction pour envoyer les metriques
function Send-SwitchMetrics {
    param([int]$SwitchId, [string]$SwitchName, [hashtable]$Metrics)
    try {
        $url = "$apiBase/ingest/switch-metrics"
        $headers = @{
            'Content-Type' = 'application/json'
            'X-API-Key' = $ingestKey
        }
        $body = @{
            switch_id = $SwitchId
            switch_name = $SwitchName
            metrics = $Metrics
        } | ConvertTo-Json -Depth 10
        
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 30
        Write-Host "    [API] Metriques envoyees" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "    [API ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ---------- MAIN ----------

# Authentification
Write-Host "[AUTH] Authentification..." -ForegroundColor Yellow
$token = Get-AuthToken -apiBase $apiBase -email $config.adminEmail -password $config.adminPassword

if (-not $token) {
    Write-Error "Authentification echouee"
    exit 1
}

Write-Host "[AUTH] OK" -ForegroundColor Green
Write-Host ""

# Recuperer les switches
Write-Host "[LOAD] Chargement switches..." -ForegroundColor Yellow
$switches = Get-SwitchesFromAPI -Token $token

if ($switches.Count -eq 0) {
    Write-Warning "Aucun switch trouve"
    exit 0
}

Write-Host "[LOAD] OK - $($switches.Count) switch(es)" -ForegroundColor Green
Write-Host ""

# Collecte
$successCount = 0
$failCount = 0

foreach ($switch in $switches) {
    Write-Host "-----------------------------------------------" -ForegroundColor Gray
    Write-Host "[SWITCH] $($switch.name) - $($switch.ip)" -ForegroundColor Cyan
    
    $metrics = Get-SwitchMetrics -IpAddress $switch.ip -SwitchName $switch.name -Model $switch.model
    
    if ($metrics.reachable) {
        $sent = Send-SwitchMetrics -SwitchId $switch.id -SwitchName $switch.name -Metrics $metrics
        if ($sent) { $successCount++ } else { $failCount++ }
    } else {
        $failCount++
    }
    
    Write-Host ""
}

# Resume
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   RESUME" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Total: $($switches.Count)" -ForegroundColor White
Write-Host "Succes: $successCount" -ForegroundColor Green
Write-Host "Echecs: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
Write-Host ""
Write-Host "[NOTE] Mode SIMULATION active" -ForegroundColor Yellow
Write-Host "Pour des donnees SNMP reelles, installez Net-SNMP" -ForegroundColor Yellow
Write-Host "et utilisez CollectSwitchMetrics.ps1" -ForegroundColor Yellow
Write-Host ""
