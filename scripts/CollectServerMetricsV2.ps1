# =====================================================
# Script de Collecte des Métriques Serveurs v2
# Execution en continu toutes les 10 minutes
# =====================================================
param(
    [string]$ConfigFile = ".\config.json",
    [PSCredential]$Credential = $null,
    [int]$IntervalMinutes = 10
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Demander les credentials si non fournis
if (-not $Credential) {
    Write-Host "[INFO] Credentials requis pour WinRM distant" -ForegroundColor Yellow
    Write-Host "Entrez les credentials d'un compte avec droits admin sur tous les serveurs:" -ForegroundColor Yellow
    $Credential = Get-Credential -Message "Credentials pour WinRM distant"
    if (-not $Credential) {
        Write-Error "Credentials requis pour continuer"
        exit 1
    }
}

# Charger la configuration
if (-not (Test-Path $ConfigFile)) {
    Write-Error "Fichier de configuration introuvable: $ConfigFile"
    exit 1
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$apiBase = $config.apiBase
$ingestKey = $config.ingestKey

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Collecte Metriques Serveurs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "API: $apiBase" -ForegroundColor Gray
Write-Host "Intervalle: $IntervalMinutes minutes" -ForegroundColor Gray
Write-Host ""

# Authentification
function Get-AuthToken {
    try {
        $loginUrl = "$apiBase/auth/login"
        $loginBody = @{ identifier = $config.adminEmail; password = $config.adminPassword } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $loginBody -ContentType "application/json" -TimeoutSec 10
        return $response.token
    } catch {
        Write-Warning "Echec authentification: $_"
        return $null
    }
}

# Récupérer la liste des serveurs
function Get-ServersFromAPI {
    param($Token)
    try {
        $headers = @{ Authorization = "Bearer $Token" }
        $response = Invoke-RestMethod -Uri "$apiBase/equipment?type=Server" -Headers $headers -Method GET -TimeoutSec 10
        return $response
    } catch {
        Write-Warning "Echec recuperation serveurs: $_"
        return @()
    }
}

# Collecter métriques serveur LOCAL
function Get-LocalMetrics {
    try {
        Write-Host "  -> Collecte metriques locales..." -ForegroundColor Gray
        
        # CPU
        $cpuSamples = Get-Counter '\Processeur(_Total)\% temps processeur' -SampleInterval 1 -MaxSamples 2 -ErrorAction SilentlyContinue
        $cpuUsage = if ($cpuSamples) { [math]::Round(($cpuSamples.CounterSamples | Measure-Object -Property CookedValue -Average).Average, 1) } else { 0 }
        $cpuInfo = Get-CimInstance Win32_Processor | Select-Object -First 1
        
        # Mémoire
        $os = Get-CimInstance Win32_OperatingSystem
        $totalMemGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
        $freeMemGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
        $usedMemGB = [math]::Round($totalMemGB - $freeMemGB, 2)
        $memUsagePercent = if ($totalMemGB -gt 0) { [math]::Round(($usedMemGB / $totalMemGB) * 100, 1) } else { 0 }
        
        # Disques
        $disks = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | ForEach-Object {
            $totalGB = [math]::Round($_.Size / 1GB, 2)
            $freeGB = [math]::Round($_.FreeSpace / 1GB, 2)
            $usedGB = [math]::Round($totalGB - $freeGB, 2)
            @{
                drive = $_.DeviceID
                total_gb = $totalGB
                used_gb = $usedGB
                free_gb = $freeGB
                usage_percent = if ($totalGB -gt 0) { [math]::Round(($usedGB / $totalGB) * 100, 1) } else { 0 }
            }
        }
        
        # GPU (nvidia-smi si disponible)
        $gpuUsage = 0
        $gpuTemp = 0
        $gpuMemory = 0
        if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
            try {
                $nvidiaOutput = nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used --format=csv,noheader,nounits 2>$null
                if ($nvidiaOutput) {
                    $values = $nvidiaOutput.Split(',')
                    $gpuUsage = [int]$values[0].Trim()
                    $gpuTemp = [int]$values[1].Trim()
                    $gpuMemory = [int]$values[2].Trim()
                }
            } catch { }
        }
        
        # Cartes réseau et bande passante
        $allAdapters = Get-NetAdapter | Where-Object { $_.Virtual -eq $false }
        $networkCards = @()
        $totalBandwidth = 0
        
        foreach ($adapter in $allAdapters) {
            $ipConfig = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
            $bandwidth = 0
            
            # Essayer de collecter la bande passante si la carte est UP
            if ($adapter.Status -eq 'Up') {
                try {
                    $counterPath = "\Network Interface($($adapter.InterfaceDescription))\Bytes Total/sec"
                    $counter = Get-Counter -Counter $counterPath -ErrorAction Stop -SampleInterval 1 -MaxSamples 1
                    $bytesPerSec = $counter.CounterSamples[0].CookedValue
                    $bandwidth = [math]::Round(($bytesPerSec * 8) / 1MB, 2)
                    $totalBandwidth += $bandwidth
                } catch {
                    # Essayer avec le nom français
                    try {
                        $counterPath = "\Carte réseau($($adapter.InterfaceDescription))\Total des octets/s"
                        $counter = Get-Counter -Counter $counterPath -ErrorAction Stop -SampleInterval 1 -MaxSamples 1
                        $bytesPerSec = $counter.CounterSamples[0].CookedValue
                        $bandwidth = [math]::Round(($bytesPerSec * 8) / 1MB, 2)
                        $totalBandwidth += $bandwidth
                    } catch { }
                }
            }
            
            $networkCards += @{
                name = $adapter.Name
                interface = $adapter.InterfaceDescription
                type = if ($adapter.InterfaceDescription -match 'Ethernet') { 'Ethernet' } elseif ($adapter.InterfaceDescription -match 'Wi-Fi|Wireless') { 'WiFi' } else { 'Other' }
                status = $adapter.Status.ToString().ToLower()
                speed = "$($adapter.LinkSpeed)"
                ip_address = if ($ipConfig) { $ipConfig.IPAddress } else { $null }
                mac_address = $adapter.MacAddress
                bandwidth_mbps = $bandwidth
            }
        }
        
        # Uptime
        $uptime = (Get-Date) - $os.LastBootUpTime
        $uptimeHours = [math]::Round($uptime.TotalHours, 1)
        
        # Construire l'objet
        $metrics = @{
            hostname = $env:COMPUTERNAME
            os_name = $os.Caption
            os_version = $os.Version
            uptime_hours = $uptimeHours
            cpu = @{
                model = $cpuInfo.Name
                cores = $cpuInfo.NumberOfLogicalProcessors
                usage = $cpuUsage
                temperature = 0
            }
            memory = @{
                total_gb = $totalMemGB
                used_gb = $usedMemGB
                usage_percent = $memUsagePercent
            }
            gpu = @{
                usage = $gpuUsage
                temperature = $gpuTemp
                memory = $gpuMemory
            }
            power = @{
                voltage = 230
                current = 2.5
                status = "normal"
            }
            bandwidth = @{
                current = $totalBandwidth
                max = 1000
            }
            network_cards = $networkCards
            disks = $disks
            services_count = (Get-Service | Where-Object { $_.Status -eq 'Running' }).Count
        }
        
        Write-Host "    [OK] CPU: $cpuUsage% | RAM: $memUsagePercent% | Disques: $($disks.Count)" -ForegroundColor Green
        return $metrics
        
    } catch {
        Write-Warning "Erreur collecte locale: $_"
        return $null
    }
}

# Collecter métriques serveur DISTANT via WinRM
function Get-RemoteMetrics {
    param([string]$ServerName, [string]$ServerIP)
    try {
        Write-Host "  -> Collecte metriques distantes via WinRM..." -ForegroundColor Gray
        
        # Tester la connectivité WinRM
        $canConnect = Test-WSMan -ComputerName $ServerIP -ErrorAction SilentlyContinue
        if (-not $canConnect) {
            Write-Host "    [SKIP] WinRM non disponible" -ForegroundColor Yellow
            return $null
        }
        
        # Script à exécuter sur le serveur distant
        $scriptBlock = {
            # CPU
            $cpuSamples = Get-Counter '\Processeur(_Total)\% temps processeur' -SampleInterval 1 -MaxSamples 2 -ErrorAction SilentlyContinue
            $cpuUsage = if ($cpuSamples) { [math]::Round(($cpuSamples.CounterSamples | Measure-Object -Property CookedValue -Average).Average, 1) } else { 0 }
            $cpuInfo = Get-CimInstance Win32_Processor | Select-Object -First 1
            
            # Mémoire
            $os = Get-CimInstance Win32_OperatingSystem
            $totalMemGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
            $freeMemGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
            $usedMemGB = [math]::Round($totalMemGB - $freeMemGB, 2)
            $memUsagePercent = if ($totalMemGB -gt 0) { [math]::Round(($usedMemGB / $totalMemGB) * 100, 1) } else { 0 }
            
            # Disques
            $disks = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | ForEach-Object {
                $totalGB = [math]::Round($_.Size / 1GB, 2)
                $freeGB = [math]::Round($_.FreeSpace / 1GB, 2)
                $usedGB = [math]::Round($totalGB - $freeGB, 2)
                @{
                    drive = $_.DeviceID
                    total_gb = $totalGB
                    used_gb = $usedGB
                    free_gb = $freeGB
                    usage_percent = if ($totalGB -gt 0) { [math]::Round(($usedGB / $totalGB) * 100, 1) } else { 0 }
                }
            }
            
            # Uptime
            $uptime = (Get-Date) - $os.LastBootUpTime
            $uptimeHours = [math]::Round($uptime.TotalHours, 1)
            
            # Services
            $servicesCount = (Get-Service | Where-Object { $_.Status -eq 'Running' }).Count
            
            @{
                hostname = $env:COMPUTERNAME
                os_name = $os.Caption
                os_version = $os.Version
                uptime_hours = $uptimeHours
                cpu_usage = $cpuUsage
                cpu_model = $cpuInfo.Name
                cpu_cores = $cpuInfo.NumberOfLogicalProcessors
                total_mem_gb = $totalMemGB
                used_mem_gb = $usedMemGB
                mem_usage_percent = $memUsagePercent
                disks = $disks
                services_count = $servicesCount
            }
        }
        
        # Exécuter sur le serveur distant avec credentials
        $result = Invoke-Command -ComputerName $ServerIP -Credential $Credential -ScriptBlock $scriptBlock -ErrorAction Stop
        
        if ($result) {
            $metrics = @{
                hostname = $result.hostname
                os_name = $result.os_name
                os_version = $result.os_version
                uptime_hours = $result.uptime_hours
                cpu = @{
                    model = $result.cpu_model
                    cores = $result.cpu_cores
                    usage = $result.cpu_usage
                    temperature = 0
                }
                memory = @{
                    total_gb = $result.total_mem_gb
                    used_gb = $result.used_mem_gb
                    usage_percent = $result.mem_usage_percent
                }
                gpu = @{
                    usage = 0
                    temperature = 0
                    memory = 0
                }
                power = @{
                    voltage = 230
                    current = 2.5
                    status = "normal"
                }
                bandwidth = @{
                    current = 0
                    max = 1000
                }
                disks = $result.disks
                services_count = $result.services_count
            }
            
            Write-Host "    [OK] CPU: $($result.cpu_usage)% | RAM: $($result.mem_usage_percent)% | Disques: $($result.disks.Count)" -ForegroundColor Green
            return $metrics
        }
        
        return $null
        
    } catch {
        Write-Host "    [ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Envoyer les métriques
function Send-ServerMetrics {
    param([int]$ServerId, [string]$ServerName, [hashtable]$Metrics)
    try {
        $url = "$apiBase/ingest/server-metrics"
        $body = @{ server_id = $ServerId; server_name = $ServerName; metrics = $Metrics } | ConvertTo-Json -Depth 10
        $headers = @{ 'Content-Type' = 'application/json'; 'x-ingest-key' = $ingestKey }
        $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -Headers $headers -TimeoutSec 10
        Write-Host "    [OK] Metriques envoyees" -ForegroundColor Green
        return $true
    } catch {
        Write-Warning "Erreur envoi metriques: $_"
        return $false
    }
}

# SCRIPT PRINCIPAL - BOUCLE CONTINUE
while ($true) {
    $cycleStart = Get-Date
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Magenta
    Write-Host "  NOUVEAU CYCLE - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Magenta
    Write-Host "=====================================" -ForegroundColor Magenta
    Write-Host ""
    
    Write-Host "[1/3] Authentification..." -ForegroundColor Yellow
    $token = Get-AuthToken
    if (-not $token) {
        Write-Warning "Impossible de s'authentifier, nouvelle tentative dans 60s..."
        Start-Sleep -Seconds 60
        continue
    }
    Write-Host "[OK] Authentifie" -ForegroundColor Green
    Write-Host ""

    Write-Host "[2/3] Recuperation serveurs..." -ForegroundColor Yellow
    $servers = Get-ServersFromAPI -Token $token
    if ($servers.Count -eq 0) {
        Write-Warning "Aucun serveur trouve, nouvelle tentative dans 60s..."
        Start-Sleep -Seconds 60
        continue
    }
    Write-Host "[OK] $($servers.Count) serveur(s) trouve(s)" -ForegroundColor Green
    Write-Host ""

    Write-Host "[3/3] Collecte des metriques..." -ForegroundColor Yellow
    Write-Host ""

    $successCount = 0
    $failCount = 0

    foreach ($server in $servers) {
        Write-Host "[$($server.name)] - $($server.ip)" -ForegroundColor Cyan
        
        $metrics = $null
        
        # Vérifier si c'est le serveur local
        $localIps = @('127.0.0.1', 'localhost', $env:COMPUTERNAME)
        $currentIp = (Get-NetIPAddress | Where-Object { $_.AddressFamily -eq 'IPv4' -and $_.PrefixOrigin -eq 'Manual' } | Select-Object -First 1).IPAddress
        if ($currentIp) { $localIps += $currentIp }
        
        $isLocal = $localIps -contains $server.ip -or $localIps -contains $server.name
        
        if ($isLocal) {
            # Serveur local
            $metrics = Get-LocalMetrics
        } else {
            # Serveur distant via WinRM
            $metrics = Get-RemoteMetrics -ServerName $server.name -ServerIP $server.ip
        }
        
        if ($metrics) {
            $sent = Send-ServerMetrics -ServerId $server.id -ServerName $server.name -Metrics $metrics
            if ($sent) { $successCount++ } else { $failCount++ }
        } else {
            $failCount++
        }
        
        Write-Host ""
    }

    # Résumé du cycle
    $cycleEnd = Get-Date
    $cycleDuration = [math]::Round(($cycleEnd - $cycleStart).TotalSeconds, 1)
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Resume du cycle" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Succes: $successCount" -ForegroundColor Green
    $failColor = if ($failCount -gt 0) { 'Yellow' } else { 'Green' }
    Write-Host "Echecs: $failCount" -ForegroundColor $failColor
    Write-Host "Duree: $cycleDuration secondes" -ForegroundColor Gray
    Write-Host ""
    
    # Attendre avant le prochain cycle
    $waitSeconds = $IntervalMinutes * 60
    Write-Host "Prochaine execution dans $IntervalMinutes minutes ($waitSeconds secondes)..." -ForegroundColor Yellow
    Write-Host ""
    
    Start-Sleep -Seconds $waitSeconds
}
