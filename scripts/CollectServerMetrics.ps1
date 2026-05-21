# =====================================================
# Script de Collecte des Métriques Serveurs
# =====================================================
# Collecte CPU, RAM, Disques, GPU, Bande passante pour tous les serveurs
# et envoie les données à l'API

param(
    [string]$ConfigFile = ".\config.json"
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Charger la configuration
if (-not (Test-Path $ConfigFile)) {
    Write-Error "Fichier de configuration introuvable: $ConfigFile"
    exit 1
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$apiBase = $config.apiBase
$ingestKey = $config.ingestKey

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Collecte des Métriques Serveurs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "API: $apiBase" -ForegroundColor Gray
Write-Host ""

# =====================================================
# FONCTION D'AUTHENTIFICATION
# =====================================================
function Get-AuthToken {
    try {
        $loginUrl = "$apiBase/auth/login"
        $loginBody = @{ 
            identifier = $config.adminEmail
            password = $config.adminPassword
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $loginBody -ContentType "application/json" -TimeoutSec 10
        return $response.token
    } catch {
        Write-Warning "Échec authentification: $_"
        return $null
    }
}

# =====================================================
# FONCTION: Récupérer la liste des serveurs
# =====================================================
function Get-ServersFromAPI {
    param($Token)
    try {
        $headers = @{ Authorization = "Bearer $Token" }
        $response = Invoke-RestMethod -Uri "$apiBase/equipment?type=Server" -Headers $headers -Method GET -TimeoutSec 10
        return $response
    } catch {
        Write-Warning "Échec récupération serveurs: $_"
        return @()
    }
}

# =====================================================
# FONCTION: Collecter métriques serveur Windows LOCAL
# =====================================================
function Get-LocalWindowsMetrics {
    try {
        Write-Host "  → Collecte métriques Windows locales..." -ForegroundColor Gray
        
        # CPU
        $cpuSamples = Get-Counter '\Processeur(_Total)\% temps processeur' -SampleInterval 1 -MaxSamples 2 -ErrorAction SilentlyContinue
        $cpuUsage = if ($cpuSamples) { [math]::Round(($cpuSamples.CounterSamples | Measure-Object -Property CookedValue -Average).Average, 1) } else { 0 }
        
        $cpuInfo = Get-CimInstance Win32_Processor | Select-Object -First 1
        $cpuTemp = 0  # Température CPU nécessite WMI spécifique au fabricant
        
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
        
        # GPU (si disponible via nvidia-smi)
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
            } catch {
                Write-Host "    ⚠ nvidia-smi non disponible" -ForegroundColor DarkGray
            }
        }
        
        # Bande passante (interfaces réseau actives)
        $networkAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.Virtual -eq $false }
        $totalBandwidth = 0
        
        foreach ($adapter in $networkAdapters) {
            try {
                $counterInstance = $adapter.InterfaceDescription.ToLower() -replace '#', '_'
                $counterPath = "\Carte réseau($counterInstance)\Total des octets/s"
                $counter = Get-Counter -Counter $counterPath -ErrorAction Stop -SampleInterval 1 -MaxSamples 1
                $bytesPerSec = $counter.CounterSamples[0].CookedValue
                $mbps = [math]::Round(($bytesPerSec * 8) / 1MB, 2)
                $totalBandwidth += $mbps
            } catch {
                # Interface sans compteur, ignorer
            }
        }
        
        # Uptime
        $uptime = (Get-Date) - $os.LastBootUpTime
        $uptimeHours = [math]::Round($uptime.TotalHours, 1)
        
        # Construire l'objet de métriques
        $metrics = @{
            hostname = $env:COMPUTERNAME
            os_name = $os.Caption
            os_version = $os.Version
            uptime_hours = $uptimeHours
            cpu = @{
                model = $cpuInfo.Name
                cores = $cpuInfo.NumberOfLogicalProcessors
                usage = $cpuUsage
                temperature = $cpuTemp
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
                voltage = 230  # Valeur par défaut
                current = 2.5  # Valeur par défaut
                status = "normal"
            }
            bandwidth = @{
                current = $totalBandwidth
                max = 1000  # Supposons 1 Gbps max
            }
            disks = $disks
            services_count = (Get-Service | Where-Object { $_.Status -eq 'Running' }).Count
        }
        
        Write-Host "    ✓ CPU: $cpuUsage% | RAM: $memUsagePercent% | Disques: $($disks.Count)" -ForegroundColor Green
        return $metrics
        
    } catch {
        Write-Warning "Erreur collecte métriques locales: $_"
        return $null
    }
}

# =====================================================
# FONCTION: Collecter métriques serveur Windows DISTANT
# =====================================================
function Get-RemoteWindowsMetrics {
    param(
        [string]$ServerName,
        [string]$ServerIP,
        [PSCredential]$Credential
    )
    
    try {
        Write-Host "  → Collecte métriques Windows distantes de $ServerName ($ServerIP)..." -ForegroundColor Gray
        
        # Test de connectivité WinRM
        $canConnect = Test-WSMan -ComputerName $ServerIP -ErrorAction SilentlyContinue
        if (-not $canConnect) {
            Write-Host "    ⚠ WinRM non disponible sur $ServerIP" -ForegroundColor Yellow
            return $null
        }
        
        # Utiliser Invoke-Command pour exécuter le script sur le serveur distant
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
                services_count = (Get-Service | Where-Object { $_.Status -eq 'Running' }).Count
            }
        }
        
        $params = @{
            ComputerName = $ServerIP
            ScriptBlock = $scriptBlock
            ErrorAction = 'Stop'
        }
        
        if ($Credential) {
            $params.Credential = $Credential
        }
        
        $result = Invoke-Command @params
        
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
            
            Write-Host "    ✓ CPU: $($result.cpu_usage)% | RAM: $($result.mem_usage_percent)% | Disques: $($result.disks.Count)" -ForegroundColor Green
            return $metrics
        }
        
        return $null
        
    } catch {
        Write-Warning "Erreur collecte métriques distantes $ServerName : $_"
        return $null
    }
}

# =====================================================
# FONCTION: Collecter métriques serveur Linux (SSH)
# =====================================================
function Get-LinuxMetrics {
    param(
        [string]$ServerName,
        [string]$ServerIP,
        [string]$SshUser,
        [string]$SshKeyPath
    )
    
    try {
        Write-Host "  → Collecte métriques Linux de $ServerName ($ServerIP) via SSH..." -ForegroundColor Gray
        
        # Vérifier si plink (PuTTY) ou ssh est disponible
        $sshCommand = if (Get-Command plink -ErrorAction SilentlyContinue) { "plink" } 
                      elseif (Get-Command ssh -ErrorAction SilentlyContinue) { "ssh" }
                      else { $null }
        
        if (-not $sshCommand) {
            Write-Host "    ⚠ SSH/Plink non disponible" -ForegroundColor Yellow
            return $null
        }
        
        # Script bash à exécuter sur le serveur Linux
        $bashScript = @"
#!/bin/bash
# CPU Usage
cpu_usage=\$(top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\([0-9.]*\)%* id.*/\1/' | awk '{print 100 - \$1}')
cpu_cores=\$(nproc)

# Memory
mem_total=\$(free -g | awk '/^Mem:/{print \$2}')
mem_used=\$(free -g | awk '/^Mem:/{print \$3}')
mem_percent=\$(free | awk '/^Mem:/{printf "%.1f", \$3/\$2 * 100}')

# Disk
disk_info=\$(df -BG / | tail -1 | awk '{gsub("G",""); printf "{\"drive\":\"/\",\"total_gb\":%d,\"used_gb\":%d,\"free_gb\":%d,\"usage_percent\":%.1f}", \$2, \$3, \$4, (\$3/\$2)*100}')

# Uptime
uptime_hours=\$(awk '{print \$1/3600}' /proc/uptime)

# OS Info
os_name=\$(cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '"')

echo "CPU_USAGE:\$cpu_usage"
echo "CPU_CORES:\$cpu_cores"
echo "MEM_TOTAL:\$mem_total"
echo "MEM_USED:\$mem_used"
echo "MEM_PERCENT:`$mem_percent"
echo "DISK_INFO:`$disk_info"
echo "UPTIME_HOURS:`$uptime_hours"
echo "OS_NAME:`$os_name"
"@
        
        # Exécuter via SSH
        if ($SshKeyPath) {
            $output = & $sshCommand "-i" $SshKeyPath "-batch" "$SshUser@$ServerIP" $bashScript 2>$null
        } else {
            $output = & $sshCommand "-batch" "$SshUser@$ServerIP" $bashScript 2>$null
        }
        
        if ($LASTEXITCODE -eq 0 -and $output) {
            # Parser la sortie
            $data = @{}
            foreach ($line in $output) {
                if ($line -match '^([^:]+):(.+)$') {
                    $data[$matches[1]] = $matches[2]
                }
            }
            
            $metrics = @{
                hostname = $ServerName
                os_name = $data['OS_NAME']
                os_version = ""
                uptime_hours = [math]::Round([decimal]$data['UPTIME_HOURS'], 1)
                cpu = @{
                    model = "Linux CPU"
                    cores = [int]$data['CPU_CORES']
                    usage = [math]::Round([decimal]$data['CPU_USAGE'], 1)
                    temperature = 0
                }
                memory = @{
                    total_gb = [int]$data['MEM_TOTAL']
                    used_gb = [int]$data['MEM_USED']
                    usage_percent = [math]::Round([decimal]$data['MEM_PERCENT'], 1)
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
                disks = @(($data['DISK_INFO'] | ConvertFrom-Json))
                services_count = 0
            }
            
            Write-Host "    ✓ CPU: $($metrics.cpu.usage)% | RAM: $($metrics.memory.usage_percent)%" -ForegroundColor Green
            return $metrics
        }
        
        return $null
        
    } catch {
        Write-Warning "Erreur collecte métriques Linux $ServerName : $_"
        return $null
    }
}

# =====================================================
# FONCTION: Envoyer les métriques à l'API
# =====================================================
function Send-ServerMetrics {
    param(
        [int]$ServerId,
        [string]$ServerName,
        [hashtable]$Metrics
    )
    
    try {
        $url = "$apiBase/ingest/server-metrics"
        $body = @{
            server_id = $ServerId
            server_name = $ServerName
            metrics = $Metrics
        } | ConvertTo-Json -Depth 10
        
        $headers = @{
            'Content-Type' = 'application/json'
            'x-ingest-key' = $ingestKey
        }
        
        $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -Headers $headers -TimeoutSec 10
        Write-Host "    ✓ Métriques envoyées pour $ServerName" -ForegroundColor Green
        return $true
        
    } catch {
        Write-Warning "Erreur envoi métriques pour $ServerName : $_"
        return $false
    }
}

# =====================================================
# SCRIPT PRINCIPAL
# =====================================================

# Authentification
Write-Host "[1/3] Authentification..." -ForegroundColor Yellow
$token = Get-AuthToken

if (-not $token) {
    Write-Error "Impossible de s'authentifier à l'API"
    exit 1
}
Write-Host "✓ Authentifié" -ForegroundColor Green
Write-Host ""

# Récupérer la liste des serveurs
Write-Host "[2/3] Récupération de la liste des serveurs..." -ForegroundColor Yellow
$servers = Get-ServersFromAPI -Token $token

if ($servers.Count -eq 0) {
    Write-Warning "Aucun serveur trouvé dans la base de données"
    exit 0
}

Write-Host "✓ $($servers.Count) serveur(s) trouvé(s)" -ForegroundColor Green
Write-Host ""

# Collecter les métriques pour chaque serveur
Write-Host "[3/3] Collecte des métriques..." -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($server in $servers) {
    Write-Host "[$($server.name)] - $($server.ip)" -ForegroundColor Cyan
    
    $metrics = $null
    
    # Déterminer si c'est le serveur local
    $isLocal = ($server.ip -eq '127.0.0.1') -or 
               ($server.ip -eq 'localhost') -or
               ($server.name -eq $env:COMPUTERNAME) -or
               ($server.ip -eq (Get-NetIPAddress | Where-Object { $_.AddressFamily -eq 'IPv4' -and $_.PrefixOrigin -eq 'Manual' } | Select-Object -First 1).IPAddress)
    
    if ($isLocal) {
        # Serveur local Windows
        $metrics = Get-LocalWindowsMetrics
    }
    elseif ($server.model -like '*Linux*' -or $server.os -like '*Linux*') {
        # Serveur Linux distant (SSH)
        # TODO: Configurer les credentials SSH dans config.json
        $sshUser = "admin"  # À adapter
        $sshKeyPath = $null  # À adapter si clé SSH
        $metrics = Get-LinuxMetrics -ServerName $server.name -ServerIP $server.ip -SshUser $sshUser -SshKeyPath $sshKeyPath
    }
    else {
        # Serveur Windows distant (WinRM)
        # TODO: Configurer les credentials dans config.json si nécessaire
        $credential = $null  # À adapter si credentials requis
        $metrics = Get-RemoteWindowsMetrics -ServerName $server.name -ServerIP $server.ip -Credential $credential
    }
    
    if ($metrics) {
        $sent = Send-ServerMetrics -ServerId $server.id -ServerName $server.name -Metrics $metrics
        if ($sent) {
            $successCount++
        } else {
            $failCount++
        }
    } else {
        Write-Host "    ⚠ Aucune métrique collectée" -ForegroundColor Yellow
        $failCount++
    }
    
    Write-Host ""
}

# Résumé
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Résumé de la collecte" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Succès: $successCount" -ForegroundColor Green
$failColor = if ($failCount -gt 0) { 'Yellow' } else { 'Green' }
Write-Host "Échecs: $failCount" -ForegroundColor $failColor
Write-Host ""
