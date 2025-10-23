# Lecture de la configuration
$configPath = Join-Path $PSScriptRoot "config.json"
if (-not (Test-Path $configPath)) {
    Write-Error "Fichier de configuration non trouve : $configPath"
    exit 1
}

try {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
} catch {
    Write-Error "Erreur lors de la lecture de la configuration : $_"
    exit 1
}

# Configuration
$apiBase = $config.apiBase
$ingestKey = $config.ingestKey
$timeoutMs = $config.timeoutMs

# Fonction pour obtenir le token d'authentification
function Get-AuthToken {
    param($apiBase, $email, $password)
    
    $loginUrl = "$apiBase/auth/login"
    $loginBody = @{
        email = $email
        password = $password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $loginBody -ContentType "application/json"
        return $response.token
    } catch {
        Write-Error "Echec de l'authentification : $_"
        return $null
    }
}

# Fonction pour récupérer la liste des équipements
function Get-Equipment {
    param($apiBase, $token)
    
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$apiBase/equipment" -Method GET -Headers $headers
        return $response
    } catch {
        Write-Error "Erreur lors de la recuperation des equipements : $_"
        return @()
    }
}

# Fonction pour pinger un équipement
function Test-EquipmentPing {
    param($ip, $timeoutMs = 2000)
    
    if ([string]::IsNullOrWhiteSpace($ip)) {
        return @{
            success = $false
            latency = $null
            error = "IP manquante"
        }
    }
    
    try {
        $ping = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction Stop
        if ($ping) {
            # Récupérer la latence avec une requête détaillée
            $pingResult = Test-Connection -ComputerName $ip -Count 1 -ErrorAction Stop
            $latency = if ($pingResult.ResponseTime) { $pingResult.ResponseTime } else { 0 }
            
            return @{
                success = $true
                latency = $latency
                error = $null
            }
        } else {
            return @{
                success = $false
                latency = $null
                error = "Pas de reponse"
            }
        }
    } catch {
        return @{
            success = $false
            latency = $null
            error = "Erreur ping : $($_.Exception.Message)"
        }
    }
}

# Fonction pour envoyer les résultats de ping
function Send-PingResult {
    param($apiBase, $ingestKey, $equipmentId, $ip, $pingResult)
    
    # Vérifier que l'IP n'est pas vide
    if ([string]::IsNullOrWhiteSpace($ip)) {
        Write-Warning "IP manquante pour l'equipement ID: $equipmentId"
        return $false
    }
    
    $ingestUrl = "$apiBase/ingest/ping"
    $headers = @{
        "X-Ingest-Key" = $ingestKey
        "Content-Type" = "application/json"
    }
    
    $body = @{
        equipment_id = $equipmentId
        ip = $ip.Trim()
        status = if ($pingResult.success) { "UP" } else { "DOWN" }
        latency_ms = $pingResult.latency
        timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    }
    
    # Ajouter l'erreur si elle existe
    if ($pingResult.error) {
        $body.error = $pingResult.error
    }
    
    $jsonBody = $body | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $ingestUrl -Method POST -Body $jsonBody -Headers $headers
        Write-Host "[OK] Ping envoye pour $ip (ID: $equipmentId) - Status: $($body.status)"
        return $true
    } catch {
        Write-Error "[ERREUR] Erreur lors de l'envoi du ping pour $ip : $_"
        Write-Host "Donnees envoyees : $jsonBody"
        return $false
    }
}

# Script principal
Write-Host "[INFO] Demarrage du monitoring des equipements..."

# Authentification
$token = Get-AuthToken -apiBase $apiBase -email $config.adminEmail -password $config.adminPassword
if (-not $token) {
    Write-Error "Impossible de s'authentifier"
    exit 1
}

# Récupération des équipements
Write-Host "[INFO] Recuperation de la liste des equipements..."
$equipment = Get-Equipment -apiBase $apiBase -token $token

if ($equipment.Count -eq 0) {
    Write-Warning "Aucun equipement trouve"
    exit 0
}

Write-Host "[INFO] $($equipment.Count) equipement(s) trouve(s)"

# Ping de chaque équipement
$successCount = 0
$totalCount = 0

foreach ($item in $equipment) {
    $totalCount++
    
    # Vérifier que l'équipement a une IP
    if ([string]::IsNullOrWhiteSpace($item.ip)) {
        Write-Warning "[WARN] Equipement '$($item.name)' (ID: $($item.id)) n'a pas d'adresse IP - ignore"
        continue
    }
    
    Write-Host "[PING] Test de $($item.name) ($($item.ip))..."
    
    # Ping de l'équipement
    $pingResult = Test-EquipmentPing -ip $item.ip -timeoutMs $timeoutMs
    
    # Envoi du résultat
    $sent = Send-PingResult -apiBase $apiBase -ingestKey $ingestKey -equipmentId $item.id -ip $item.ip -pingResult $pingResult
    
    if ($sent) {
        $successCount++
    }
    
    # Pause courte entre les pings
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "[FINI] Monitoring termine : $successCount/$totalCount resultats envoyes"
Write-Host "[TIME] $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"