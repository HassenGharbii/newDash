# CollectSwitchMetrics.ps1 - Collecte complète SNMP pour switches
# Collecte: ports status, trafic, CPU, RAM, température, uptime

param(
    [string]$ConfigFile,
    [string]$SnmpCommunity = "public"
)

# Déterminer le chemin du script
$scriptPath = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

# Utiliser le config.json dans le dossier du script si non spécifié
if (-not $ConfigFile) {
    $ConfigFile = Join-Path $scriptPath "config.json"
}

# Charger la configuration
if (-not (Test-Path $ConfigFile)) {
    Write-Error "Fichier de configuration introuvable: $ConfigFile"
    exit 1
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$apiBase = if ($env:API_URL) { $env:API_URL } else { $config.apiBase }
$ingestKey = $config.ingestKey

# Outil SNMP : net-snmp (snmpget/snmpwalk, multiplateforme) en priorite, sinon SnmpWalk.exe (Windows uniquement)
$snmpWalkPath = Join-Path $scriptPath "SnmpWalk\SnmpWalk.exe"
$SNMP_TOOL = $null
if (Get-Command snmpget -ErrorAction SilentlyContinue) {
    $SNMP_TOOL = "netsnmp"
} elseif (Test-Path $snmpWalkPath) {
    $SNMP_TOOL = "snmpwalkexe"
}
$snmpAvailable = [bool]$SNMP_TOOL

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   Collecte SNMP Switches - Métriques Complètes" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "[CONFIG] API: $apiBase" -ForegroundColor Gray
Write-Host "[CONFIG] Community SNMP: $SnmpCommunity" -ForegroundColor Gray
Write-Host "[CONFIG] Outil SNMP: $(if ($SNMP_TOOL -eq 'netsnmp') { 'net-snmp (snmpget/snmpwalk)' } elseif ($SNMP_TOOL -eq 'snmpwalkexe') { "SnmpWalk.exe ($snmpWalkPath)" } else { 'aucun' })" -ForegroundColor Gray

if (-not $snmpAvailable) {
    Write-Warning "Aucun outil SNMP disponible (ni snmpget/net-snmp, ni SnmpWalk.exe)"
    Write-Host "Sans SNMP, seules des donnees basiques (ping) seront collectees." -ForegroundColor Yellow
}

Write-Host ""

# OIDs SNMP standards (compatibles avec la plupart des switches)
$OID_SYSTEM_DESCR = "1.3.6.1.2.1.1.1.0"           # Description système
$OID_SYSTEM_UPTIME = "1.3.6.1.2.1.1.3.0"          # Uptime (ticks)
$OID_SYSTEM_NAME = "1.3.6.1.2.1.1.5.0"            # Hostname
$OID_IF_NUMBER = "1.3.6.1.2.1.2.1.0"              # Nombre d'interfaces
$OID_IF_DESCR = "1.3.6.1.2.1.2.2.1.2"             # Description interface (table)
$OID_IF_TYPE = "1.3.6.1.2.1.2.2.1.3"              # Type interface
$OID_IF_SPEED = "1.3.6.1.2.1.2.2.1.5"             # Vitesse interface (bps)
$OID_IF_ADMIN_STATUS = "1.3.6.1.2.1.2.2.1.7"      # Status admin (1=up, 2=down)
$OID_IF_OPER_STATUS = "1.3.6.1.2.1.2.2.1.8"       # Status opérationnel (1=up, 2=down)
$OID_IF_IN_OCTETS = "1.3.6.1.2.1.2.2.1.10"        # Octets entrants
$OID_IF_OUT_OCTETS = "1.3.6.1.2.1.2.2.1.16"       # Octets sortants
$OID_IF_IN_ERRORS = "1.3.6.1.2.1.2.2.1.14"        # Erreurs entrantes
$OID_IF_OUT_ERRORS = "1.3.6.1.2.1.2.2.1.20"       # Erreurs sortantes

# OIDs spécifiques (peuvent ne pas être supportés par tous les switches)
$OID_CPU_USAGE = "1.3.6.1.4.1.9.9.109.1.1.1.1.7"  # Cisco CPU 5sec avg
$OID_MEMORY_USED = "1.3.6.1.4.1.9.9.48.1.1.1.5"   # Cisco Memory Used
$OID_MEMORY_FREE = "1.3.6.1.4.1.9.9.48.1.1.1.6"   # Cisco Memory Free
$OID_TEMPERATURE = "1.3.6.1.4.1.9.9.13.1.3.1.3"   # Cisco Temperature

# Fonction pour exécuter une commande SNMP Get
function Invoke-SnmpGet {
    param(
        [string]$IpAddress,
        [string]$Community,
        [string]$Oid
    )

    try {
        if ($SNMP_TOOL -eq "netsnmp") {
            $result = snmpget -v2c -c $Community -t 2 -r 1 -Oqv $IpAddress $Oid 2>$null
            if ($result) {
                return ($result | Select-Object -First 1).ToString().Trim().Trim('"')
            }
            return $null
        }

        # Utiliser SnmpWalk.exe avec les parametres adaptes
        $result = & $snmpWalkPath -v:2c -c:$Community -r:$IpAddress -os:$Oid 2>$null

        if ($LASTEXITCODE -eq 0 -and $result) {
            # Parser la sortie (format: ".OID, Type=XXX, Value=YYY")
            $lines = $result -split "`n"
            foreach ($line in $lines) {
                # Extraire la valeur après "Value="
                if ($line -match "Value=(.+)$") {
                    return $matches[1].Trim()
                }
            }
        }
        return $null
    } catch {
        return $null
    }
}

# Fonction pour exécuter une commande SNMP Walk (table)
function Invoke-SnmpWalk {
    param(
        [string]$IpAddress,
        [string]$Community,
        [string]$Oid
    )

    try {
        if ($SNMP_TOOL -eq "netsnmp") {
            $result = snmpwalk -v2c -c $Community -t 2 -r 1 -Oqv $IpAddress $Oid 2>$null
            if ($result) {
                return @($result | ForEach-Object { $_.ToString().Trim().Trim('"') })
            }
            return @()
        }

        # Utiliser SnmpWalk.exe pour recuperer une table
        $result = & $snmpWalkPath -v:2c -c:$Community -r:$IpAddress -os:$Oid 2>$null

        if ($LASTEXITCODE -eq 0 -and $result) {
            # Parser chaque ligne et extraire les valeurs après "Value="
            $values = @()
            $lines = $result -split "`n"
            foreach ($line in $lines) {
                if ($line -match "Value=(.+)$") {
                    $values += $matches[1].Trim()
                }
            }
            return $values
        }
        return @()
    } catch {
        return @()
    }
}

# Fonction alternative sans Net-SNMP (utilise WMI/PowerShell natif - limité)
function Get-SnmpDataNative {
    param(
        [string]$IpAddress,
        [string]$Community
    )
    
    # Cette fonction collecte des données basiques sans SNMP
    # Utile si Net-SNMP n'est pas installé
    
    try {
        # Test de connectivité
        $pingTest = Test-Connection -ComputerName $IpAddress -Count 2 -Quiet -ErrorAction SilentlyContinue
        
        if (-not $pingTest) {
            return @{
                reachable = $false
                error = "Switch inaccessible (ping failed)"
            }
        }
        
        return @{
            reachable = $true
            basic_ping = $true
            # Les métriques SNMP nécessitent snmpget/snmpwalk
        }
    } catch {
        return @{
            reachable = $false
            error = $_.Exception.Message
        }
    }
}

# Fonction pour collecter les métriques d'un switch
function Get-SwitchMetrics {
    param(
        [string]$IpAddress,
        [string]$Community
    )
    
    Write-Host "  -> Collecte SNMP de $IpAddress..." -ForegroundColor Gray

    if (-not $snmpAvailable) {
        Write-Host "    [WARN] Aucun outil SNMP disponible - collecte basique uniquement" -ForegroundColor Yellow
        return Get-SnmpDataNative -IpAddress $IpAddress -Community $Community
    }
    
    # Collecter les informations système
    $sysDescr = Invoke-SnmpGet -IpAddress $IpAddress -Community $Community -Oid $OID_SYSTEM_DESCR
    $sysName = Invoke-SnmpGet -IpAddress $IpAddress -Community $Community -Oid $OID_SYSTEM_NAME
    $sysUptime = Invoke-SnmpGet -IpAddress $IpAddress -Community $Community -Oid $OID_SYSTEM_UPTIME
    
    if (-not $sysDescr) {
        Write-Host "    [ERROR] Pas de réponse SNMP - vérifier community string ou access" -ForegroundColor Red
        return @{
            reachable = $false
            error = "No SNMP response"
        }
    }
    
    # Uptime en heures
    $uptimeHours = 0
    if ($sysUptime) {
        try {
            # Nettoyer et convertir la valeur (enlever les caractères non-numériques)
            $cleanUptime = $sysUptime -replace '[^\d]', ''
            if ($cleanUptime -and $cleanUptime -match '^\d+$') {
                $uptimeTicks = [int64]$cleanUptime
                $uptimeHours = [math]::Round($uptimeTicks / 100 / 3600, 1)
            }
        } catch {
            Write-Host "    [WARN] Impossible de parser uptime: $sysUptime" -ForegroundColor Yellow
        }
    }
    
    # Collecter nombre d'interfaces
    $ifNumber = Invoke-SnmpGet -IpAddress $IpAddress -Community $Community -Oid $OID_IF_NUMBER
    $interfaceCount = 0
    if ($ifNumber) {
        try {
            $cleanIfNumber = $ifNumber -replace '[^\d]', ''
            if ($cleanIfNumber -match '^\d+$') {
                $interfaceCount = [int]$cleanIfNumber
            }
        } catch {
            Write-Host "    [WARN] Impossible de parser ifNumber: $ifNumber" -ForegroundColor Yellow
        }
    }
    
    Write-Host "    [INFO] $interfaceCount interfaces détectées" -ForegroundColor Cyan
    
    # Collecter les statuts des interfaces
    $portsUp = 0
    $portsDown = 0
    $totalBandwidthIn = 0
    $totalBandwidthOut = 0
    $ports = @()
    
    if ($interfaceCount -gt 0) {
        # Récupérer les statuts opérationnels
        $operStatusResults = Invoke-SnmpWalk -IpAddress $IpAddress -Community $Community -Oid $OID_IF_OPER_STATUS
        $ifDescrResults = Invoke-SnmpWalk -IpAddress $IpAddress -Community $Community -Oid $OID_IF_DESCR
        $ifSpeedResults = Invoke-SnmpWalk -IpAddress $IpAddress -Community $Community -Oid $OID_IF_SPEED
        $ifInOctetsResults = Invoke-SnmpWalk -IpAddress $IpAddress -Community $Community -Oid $OID_IF_IN_OCTETS
        $ifOutOctetsResults = Invoke-SnmpWalk -IpAddress $IpAddress -Community $Community -Oid $OID_IF_OUT_OCTETS
        
        for ($i = 0; $i -lt [math]::Min($interfaceCount, $operStatusResults.Count); $i++) {
            try {
                $operStatus = 2
                if ($operStatusResults[$i]) {
                    $cleanStatus = $operStatusResults[$i] -replace '[^\d]', ''
                    if ($cleanStatus -match '^\d+$') {
                        $operStatus = [int]$cleanStatus
                    }
                }
                
                $ifDescr = if ($ifDescrResults[$i]) { $ifDescrResults[$i] } else { "Interface $($i+1)" }
                
                $ifSpeed = 0
                if ($ifSpeedResults[$i]) {
                    $cleanSpeed = $ifSpeedResults[$i] -replace '[^\d]', ''
                    if ($cleanSpeed -match '^\d+$') {
                        $ifSpeed = [int64]$cleanSpeed
                    }
                }
                
                $ifInOctets = 0
                if ($ifInOctetsResults[$i]) {
                    $cleanIn = $ifInOctetsResults[$i] -replace '[^\d]', ''
                    if ($cleanIn -match '^\d+$') {
                        $ifInOctets = [int64]$cleanIn
                    }
                }
                
                $ifOutOctets = 0
                if ($ifOutOctetsResults[$i]) {
                    $cleanOut = $ifOutOctetsResults[$i] -replace '[^\d]', ''
                    if ($cleanOut -match '^\d+$') {
                        $ifOutOctets = [int64]$cleanOut
                    }
                }
            } catch {
                Write-Host "    [WARN] Erreur parsing interface $i" -ForegroundColor Yellow
                continue
            }
            
            $isUp = ($operStatus -eq 1)
            
            if ($isUp) {
                $portsUp++
            } else {
                $portsDown++
            }
            
            # Calculer la bande passante en Mbps (approximation basée sur les compteurs)
            $inMbps = [math]::Round(($ifInOctets * 8) / 1MB, 2)
            $outMbps = [math]::Round(($ifOutOctets * 8) / 1MB, 2)
            
            $totalBandwidthIn += $inMbps
            $totalBandwidthOut += $outMbps
            
            $ports += @{
                index = $i + 1
                name = $ifDescr
                status = if ($isUp) { "up" } else { "down" }
                speed_mbps = [math]::Round($ifSpeed / 1MB, 0)
                traffic_in_mbps = $inMbps
                traffic_out_mbps = $outMbps
            }
        }
    }
    
    Write-Host "    [INFO] Ports UP: $portsUp, DOWN: $portsDown" -ForegroundColor Green
    
    # Collecter CPU (peut échouer sur certains switches)
    $cpuUsage = Invoke-SnmpGet -IpAddress $IpAddress -Community $Community -Oid "$OID_CPU_USAGE.1"
    $cpuPercent = 0
    if ($cpuUsage) {
        try {
            $cleanCpu = $cpuUsage -replace '[^\d]', ''
            if ($cleanCpu -match '^\d+$') {
                $cpuPercent = [int]$cleanCpu
            }
        } catch { }
    }
    
    # Collecter Mémoire (peut échouer sur certains switches)
    $memUsed = Invoke-SnmpGet -IpAddress $IpAddress -Community $Community -Oid "$OID_MEMORY_USED.1"
    $memFree = Invoke-SnmpGet -IpAddress $IpAddress -Community $Community -Oid "$OID_MEMORY_FREE.1"
    
    $memUsedBytes = 0
    if ($memUsed) {
        try {
            $cleanMemUsed = $memUsed -replace '[^\d]', ''
            if ($cleanMemUsed -match '^\d+$') {
                $memUsedBytes = [int64]$cleanMemUsed
            }
        } catch { }
    }
    
    $memFreeBytes = 0
    if ($memFree) {
        try {
            $cleanMemFree = $memFree -replace '[^\d]', ''
            if ($cleanMemFree -match '^\d+$') {
                $memFreeBytes = [int64]$cleanMemFree
            }
        } catch { }
    }
    
    $memTotalBytes = $memUsedBytes + $memFreeBytes
    $memUsagePercent = if ($memTotalBytes -gt 0) { [math]::Round(($memUsedBytes / $memTotalBytes) * 100, 1) } else { 0 }
    
    # Collecter Température (peut échouer sur certains switches)
    $temperature = Invoke-SnmpGet -IpAddress $IpAddress -Community $Community -Oid "$OID_TEMPERATURE.1"
    $tempCelsius = 0
    if ($temperature) {
        try {
            $cleanTemp = $temperature -replace '[^\d]', ''
            if ($cleanTemp -match '^\d+$') {
                $tempCelsius = [int]$cleanTemp
            }
        } catch { }
    }
    
    # Construire l'objet de métriques
    $metrics = @{
        hostname = if ($sysName) { $sysName } else { $IpAddress }
        system_description = if ($sysDescr) { $sysDescr } else { "Unknown" }
        uptime_hours = $uptimeHours
        reachable = $true
        ports = @{
            total = $interfaceCount
            up = $portsUp
            down = $portsDown
            details = $ports
        }
        bandwidth = @{
            total_in_mbps = [math]::Round($totalBandwidthIn, 2)
            total_out_mbps = [math]::Round($totalBandwidthOut, 2)
            current_mbps = [math]::Round($totalBandwidthIn + $totalBandwidthOut, 2)
        }
        cpu = @{
            usage = $cpuPercent
        }
        memory = @{
            total_mb = [math]::Round($memTotalBytes / 1MB, 2)
            used_mb = [math]::Round($memUsedBytes / 1MB, 2)
            usage_percent = $memUsagePercent
        }
        temperature = @{
            celsius = $tempCelsius
        }
    }
    
    Write-Host "    [SUCCESS] Métriques collectées - CPU: $cpuPercent%, Temp: ${tempCelsius}°C" -ForegroundColor Green
    
    return $metrics
}

# Fonction d'authentification
function Get-AuthToken {
    param($apiBase, $email, $password)
    $loginUrl = "$apiBase/auth/login"
    $loginBody = @{ identifier = $email; password = $password } | ConvertTo-Json
    try {
        $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $loginBody -ContentType "application/json"
        return $response.token
    } catch {
        Write-Warning "Echec authentification: $_"
        return $null
    }
}

# Fonction pour récupérer les switches
function Get-SwitchesFromAPI {
    param($Token)
    try {
        $headers = @{ Authorization = "Bearer $Token" }
        $response = Invoke-RestMethod -Uri "$apiBase/equipment" -Headers $headers -Method GET
        return $response | Where-Object { $_.type -eq 'Switch' }
    } catch {
        Write-Warning "Echec récupération switches: $_"
        return @()
    }
}

# Fonction pour envoyer les métriques
function Send-SwitchMetrics {
    param([int]$SwitchId, [string]$SwitchName, [hashtable]$Metrics)
    try {
        $url = "$apiBase/ingest/switch-metrics"
        $headers = @{ 
            'Content-Type' = 'application/json'
            'x-ingest-key' = $ingestKey
        }
        $body = @{
            switch_id = $SwitchId
            switch_name = $SwitchName
            metrics = $Metrics
        } | ConvertTo-Json -Depth 10
        
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 30
        Write-Host "    [API] Métriques envoyées avec succès" -ForegroundColor Green
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
    Write-Error "Impossible de s'authentifier"
    exit 1
}

Write-Host "[AUTH] OK" -ForegroundColor Green
Write-Host ""

# Récupération des switches
Write-Host "[LOAD] Récupération switches depuis API..." -ForegroundColor Yellow
$switches = Get-SwitchesFromAPI -Token $token

if ($switches.Count -eq 0) {
    Write-Warning "Aucun switch trouvé dans la base de données"
    exit 0
}

Write-Host "[LOAD] OK - $($switches.Count) switch(es) trouvé(s)" -ForegroundColor Green
Write-Host ""

# Compteurs
$successCount = 0
$failCount = 0

# Collecter les métriques pour chaque switch
foreach ($switch in $switches) {
    Write-Host "-----------------------------------------------" -ForegroundColor Gray
    Write-Host "[SWITCH] $($switch.name) ($($switch.model)) - $($switch.ip)" -ForegroundColor Cyan
    
    # Déterminer la community SNMP (utiliser celle du switch si disponible, sinon la valeur par défaut)
    $community = if ($switch.snmp_community) { $switch.snmp_community } else { $SnmpCommunity }
    
    # Collecter les métriques
    $metrics = Get-SwitchMetrics -IpAddress $switch.ip -Community $community
    
    if ($metrics.reachable) {
        # Envoyer à l'API
        $sent = Send-SwitchMetrics -SwitchId $switch.id -SwitchName $switch.name -Metrics $metrics
        if ($sent) {
            $successCount++
        } else {
            $failCount++
        }
    } else {
        Write-Host "    [SKIP] Switch non accessible" -ForegroundColor Yellow
        $failCount++
    }
    
    Write-Host ""
}

# Résumé
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   RÉSUMÉ DE LA COLLECTE" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Total switches traités: $($switches.Count)" -ForegroundColor White
Write-Host "Succès: $successCount" -ForegroundColor Green
Write-Host "Échecs: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
Write-Host ""

if (-not $snmpAvailable) {
    Write-Host "[IMPORTANT] Aucun outil SNMP disponible (ni snmpget/net-snmp, ni SnmpWalk.exe)!" -ForegroundColor Yellow
    Write-Host "Sans SNMP, seules des donnees basiques (ping) seront collectees." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "[DONE] Collecte terminée" -ForegroundColor Green
