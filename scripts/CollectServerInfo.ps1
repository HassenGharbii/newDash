# =====================================================
# Script de Collecte d'Informations Serveurs
# =====================================================
# Ce script collecte en temps réel les informations des serveurs Windows/Linux
# via WMI (Windows) ou SSH (Linux) et les envoie à l'API

param(
    [string]$ConfigFile = ".\config.json"
)

# Charger la configuration
if (-not (Test-Path $ConfigFile)) {
    Write-Error "Fichier de configuration introuvable: $ConfigFile"
    exit 1
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$apiBase = $config.apiBase
$ingestKey = $config.ingestKey

# =====================================================
# FONCTIONS DE COLLECTE WINDOWS (WMI/CIM)
# =====================================================

function Get-WindowsServerInfo {
    param(
        [string]$ServerName,
        [PSCredential]$Credential = $null
    )
    
    Write-Host "[INFO] Collecte des informations du serveur Windows: $ServerName" -ForegroundColor Cyan
    
    try {
        $params = @{
            ComputerName = $ServerName
            ErrorAction = 'Stop'
        }
        
        if ($Credential) {
            $params.Credential = $Credential
        }
        
        # Informations système
        $os = Get-CimInstance Win32_OperatingSystem @params
        $cpu = Get-CimInstance Win32_Processor @params | Select-Object -First 1
        $memory = Get-CimInstance Win32_PhysicalMemory @params | Measure-Object Capacity -Sum
        $disk = Get-CimInstance Win32_LogicalDisk @params | Where-Object { $_.DriveType -eq 3 }
        
        # Utilisation CPU (moyenne sur 2 échantillons)
        $cpuLoad = (Get-CimInstance Win32_Processor @params | 
                    Measure-Object -Property LoadPercentage -Average).Average
        
        # Utilisation mémoire
        $totalMemoryGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
        $freeMemoryGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
        $usedMemoryGB = $totalMemoryGB - $freeMemoryGB
        $memoryUsagePercent = [math]::Round(($usedMemoryGB / $totalMemoryGB) * 100, 2)
        
        # Uptime
        $uptime = (Get-Date) - $os.LastBootUpTime
        $uptimeHours = [math]::Round($uptime.TotalHours, 2)
        
        # Températures (si disponible via WMI)
        $temperature = $null
        try {
            $tempSensor = Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace "root/wmi" @params -ErrorAction SilentlyContinue
            if ($tempSensor) {
                $temperature = [math]::Round(($tempSensor.CurrentTemperature - 2732) / 10, 1)
            }
        } catch {
            Write-Verbose "Température non disponible via WMI"
        }
        
        # Disques
        $diskInfo = @()
        foreach ($d in $disk) {
            $diskInfo += @{
                letter = $d.DeviceID
                total_gb = [math]::Round($d.Size / 1GB, 2)
                used_gb = [math]::Round(($d.Size - $d.FreeSpace) / 1GB, 2)
                free_gb = [math]::Round($d.FreeSpace / 1GB, 2)
                usage_percent = [math]::Round((($d.Size - $d.FreeSpace) / $d.Size) * 100, 2)
            }
        }
        
        # Services critiques
        $services = Get-Service @params | Where-Object { 
            $_.Status -eq 'Running' -and 
            $_.StartType -eq 'Automatic' 
        } | Select-Object -First 10 Name, Status
        
        $result = @{
            hostname = $os.CSName
            ip = (Test-Connection -ComputerName $ServerName -Count 1).IPV4Address.IPAddressToString
            os_name = $os.Caption
            os_version = $os.Version
            cpu_model = $cpu.Name
            cpu_cores = $cpu.NumberOfCores
            cpu_usage_percent = $cpuLoad
            memory_total_gb = $totalMemoryGB
            memory_used_gb = $usedMemoryGB
            memory_usage_percent = $memoryUsagePercent
            uptime_hours = $uptimeHours
            temperature_celsius = $temperature
            disks = $diskInfo
            services_count = $services.Count
            status = "online"
            last_check = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
        
        Write-Host "[OK] Collecte réussie - CPU: $cpuLoad%, RAM: $memoryUsagePercent%, Uptime: $uptimeHours h" -ForegroundColor Green
        return $result
        
    } catch {
        Write-Error "[ERREUR] Impossible de collecter les informations de $ServerName : $($_.Exception.Message)"
        return @{
            hostname = $ServerName
            status = "offline"
            error = $_.Exception.Message
            last_check = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    }
}

# =====================================================
# FONCTIONS DE COLLECTE LINUX (SSH)
# =====================================================

function Get-LinuxServerInfo {
    param(
        [string]$ServerIP,
        [string]$Username,
        [string]$Password,
        [int]$Port = 22
    )
    
    Write-Host "[INFO] Collecte des informations du serveur Linux: $ServerIP" -ForegroundColor Cyan
    
    # Note: Nécessite Posh-SSH module
    # Install-Module -Name Posh-SSH -Force
    
    if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
        Write-Warning "[WARN] Module Posh-SSH non installé. Installation..."
        try {
            Install-Module -Name Posh-SSH -Force -Scope CurrentUser
            Import-Module Posh-SSH
        } catch {
            Write-Error "[ERREUR] Impossible d'installer Posh-SSH: $_"
            return $null
        }
    }
    
    try {
        # Créer les credentials
        $securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential ($Username, $securePassword)
        
        # Établir la connexion SSH
        $session = New-SSHSession -ComputerName $ServerIP -Credential $credential -Port $Port -AcceptKey -ErrorAction Stop
        
        # Commandes pour collecter les informations
        $commands = @{
            hostname = "hostname"
            os = "cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '`"'"
            uptime = "uptime -p"
            cpu_model = "lscpu | grep 'Model name' | cut -d: -f2 | xargs"
            cpu_cores = "nproc"
            cpu_usage = "top -bn1 | grep 'Cpu(s)' | awk '{print 100 - `$8}'"
            memory = "free -g | grep Mem | awk '{print `$2,`$3,`$7}'"
            disk = "df -BG / | tail -1 | awk '{print `$2,`$3,`$4,`$5}'"
            temperature = "sensors 2>/dev/null | grep 'Core 0' | awk '{print `$3}' | tr -d '+°C' || echo 'N/A'"
            load = "uptime | awk -F'load average:' '{print `$2}' | awk '{print `$1}' | tr -d ','"
        }
        
        $data = @{}
        foreach ($cmd in $commands.GetEnumerator()) {
            $result = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd.Value
            $data[$cmd.Key] = $result.Output.Trim()
        }
        
        # Parser les données
        $memParts = $data.memory -split '\s+'
        $diskParts = $data.disk -split '\s+'
        
        $result = @{
            hostname = $data.hostname
            ip = $ServerIP
            os_name = $data.os
            cpu_model = $data.cpu_model
            cpu_cores = [int]$data.cpu_cores
            cpu_usage_percent = [math]::Round([double]$data.cpu_usage, 2)
            memory_total_gb = [int]$memParts[0]
            memory_used_gb = [int]$memParts[1]
            memory_free_gb = [int]$memParts[2]
            memory_usage_percent = [math]::Round(([int]$memParts[1] / [int]$memParts[0]) * 100, 2)
            disk_total_gb = [int]($diskParts[0] -replace 'G','')
            disk_used_gb = [int]($diskParts[1] -replace 'G','')
            disk_free_gb = [int]($diskParts[2] -replace 'G','')
            disk_usage_percent = [int]($diskParts[3] -replace '%','')
            temperature_celsius = if ($data.temperature -ne 'N/A') { [double]$data.temperature } else { $null }
            load_average = [double]$data.load
            uptime = $data.uptime
            status = "online"
            last_check = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
        
        # Fermer la session SSH
        Remove-SSHSession -SessionId $session.SessionId | Out-Null
        
        Write-Host "[OK] Collecte réussie - CPU: $($result.cpu_usage_percent)%, RAM: $($result.memory_usage_percent)%, Load: $($result.load_average)" -ForegroundColor Green
        return $result
        
    } catch {
        Write-Error "[ERREUR] Impossible de collecter les informations de $ServerIP : $($_.Exception.Message)"
        return @{
            hostname = $ServerIP
            ip = $ServerIP
            status = "offline"
            error = $_.Exception.Message
            last_check = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    }
}

# =====================================================
# ENVOI DES DONNÉES À L'API
# =====================================================

function Send-ServerData {
    param(
        [hashtable]$ServerData,
        [int]$EquipmentId
    )
    
    $ingestUrl = "$apiBase/ingest/server"
    $headers = @{
        "X-Ingest-Key" = $ingestKey
        "Content-Type" = "application/json"
    }
    
    # Ajouter l'ID de l'équipement
    $ServerData.equipment_id = $EquipmentId
    
    $jsonBody = $ServerData | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri $ingestUrl -Method POST -Body $jsonBody -Headers $headers
        Write-Host "[API] Données envoyées avec succès pour l'équipement ID: $EquipmentId" -ForegroundColor Green
        return $true
    } catch {
        Write-Error "[API] Erreur lors de l'envoi des données: $($_.Exception.Message)"
        Write-Host "Données tentées: $jsonBody" -ForegroundColor Yellow
        return $false
    }
}

# =====================================================
# RÉCUPÉRATION DE LA LISTE DES SERVEURS
# =====================================================

function Get-ServersFromAPI {
    param(
        [string]$Token
    )
    
    $headers = @{
        "Authorization" = "Bearer $Token"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$apiBase/equipment?type=server" -Method GET -Headers $headers
        return $response | Where-Object { $_.category -eq 'servers' }
    } catch {
        Write-Error "[API] Erreur lors de la récupération des serveurs: $_"
        return @()
    }
}

# =====================================================
# FONCTION D'AUTHENTIFICATION
# =====================================================

function Get-AuthToken {
    param($apiBase, $email, $password)
    
    $loginUrl = "$apiBase/auth/login"
    $loginBody = @{
        identifier = $email
        password = $password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $loginBody -ContentType "application/json"
        return $response.token
    } catch {
        Write-Error "Échec de l'authentification: $_"
        return $null
    }
}

# =====================================================
# SCRIPT PRINCIPAL
# =====================================================

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Collecte d'Informations Serveurs - Dashboard Semmaris  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Authentification
Write-Host "[AUTH] Authentification à l'API..." -ForegroundColor Yellow
$token = Get-AuthToken -apiBase $apiBase -email $config.adminEmail -password $config.adminPassword

if (-not $token) {
    Write-Error "[AUTH] Impossible de s'authentifier. Vérifiez les credentials dans config.json"
    exit 1
}

Write-Host "[AUTH] ✓ Authentification réussie" -ForegroundColor Green
Write-Host ""

# Récupération de la liste des serveurs
Write-Host "[LOAD] Récupération de la liste des serveurs..." -ForegroundColor Yellow
$servers = Get-ServersFromAPI -Token $token

if ($servers.Count -eq 0) {
    Write-Warning "[WARN] Aucun serveur trouvé dans la base de données"
    Write-Host "[INFO] Ajoutez des serveurs via l'interface web ou la base de données" -ForegroundColor Yellow
    exit 0
}

Write-Host "[LOAD] ✓ $($servers.Count) serveur(s) trouvé(s)" -ForegroundColor Green
Write-Host ""

# Collecter les informations de chaque serveur
$successCount = 0
$failCount = 0

foreach ($server in $servers) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "[SERVER] $($server.name) ($($server.ip))" -ForegroundColor Cyan
    
    $serverData = $null
    
    # Déterminer le type de serveur (Windows ou Linux)
    if ($server.os_type -eq 'windows' -or $server.name -match 'WIN|SRV') {
        # Serveur Windows - Utiliser WMI/CIM
        $serverData = Get-WindowsServerInfo -ServerName $server.ip
        
    } elseif ($server.os_type -eq 'linux' -or $server.name -match 'LNX|UBU|DEB|RHEL') {
        # Serveur Linux - Utiliser SSH
        # Note: Nécessite credentials SSH configurés dans la DB ou le fichier config
        if ($server.ssh_username -and $server.ssh_password) {
            $serverData = Get-LinuxServerInfo -ServerIP $server.ip `
                                              -Username $server.ssh_username `
                                              -Password $server.ssh_password
        } else {
            Write-Warning "[WARN] Credentials SSH manquants pour $($server.name)"
        }
        
    } else {
        # Type inconnu - Tenter Windows par défaut
        Write-Host "[INFO] Type OS non spécifié, tentative avec WMI..." -ForegroundColor Yellow
        $serverData = Get-WindowsServerInfo -ServerName $server.ip
    }
    
    # Envoyer les données si collecte réussie
    if ($serverData) {
        $sent = Send-ServerData -ServerData $serverData -EquipmentId $server.id
        if ($sent) {
            $successCount++
        } else {
            $failCount++
        }
    } else {
        $failCount++
    }
    
    Write-Host ""
    Start-Sleep -Milliseconds 500
}

# Résumé
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "[RÉSUMÉ] Collecte terminée" -ForegroundColor Green
Write-Host "  ✓ Succès: $successCount" -ForegroundColor Green
Write-Host "  ✗ Échecs: $failCount" -ForegroundColor Red
Write-Host "  📊 Total: $($servers.Count)" -ForegroundColor Cyan
Write-Host "  🕐 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""
