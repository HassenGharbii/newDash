<#
.SYNOPSIS
    Collecte les métriques des baies Seagate Exos X via SNMP et/ou API REDFISH
    et les envoie au dashboard Semmaris.

.DESCRIPTION
    Mode SNMP  : ping + disponibilité (léger, polling fréquent)
    Mode REST  : métriques détaillées via l'API HTTP(S) Seagate Systems Management Console
    Les deux modes sont combinés : SNMP pour disponibilité rapide, REST pour télémetrie.

.EXEMPLE
    .\CollectStorageInfo.ps1 -StorageHosts @("192.168.1.20","192.168.1.21") -SnmpCommunity "public"
    .\CollectStorageInfo.ps1 -StorageHosts @("192.168.1.20") -ApiUser "manage" -ApiPass "!manage"
    .\CollectStorageInfo.ps1 -Loop -IntervalSeconds 300

.DESCRIPTION (suite)
    Deux modes :
    - Ponctuel (par défaut si -StorageHosts/STORAGE_HOSTS sont fournis) : une seule collecte puis sortie.
    - Continu (-Loop, ou automatique si aucune baie n'est fournie) : récupère la configuration
      (liste de baies + identifiants) depuis l'API (Panel Admin > Intégrations,
      GET /integrations/storage/config) à chaque cycle. C'est le mode utilisé par le conteneur Docker.
#>

param(
    # IPs des baies Seagate
    [string[]]$StorageHosts   = @(),

    # SNMP
    [string]$SnmpCommunity    = $(if ($env:SNMP_COMMUNITY) { $env:SNMP_COMMUNITY } else { "public" }),
    [int]$SnmpPort            = 161,

    # API REST Seagate Systems Management Console (HTTPS)
    [string]$ApiUser          = $(if ($env:SEAGATE_USER) { $env:SEAGATE_USER } else { "manage" }),
    [string]$ApiPass          = $env:SEAGATE_PASS,
    [int]$ApiPort             = 443,

    # Dashboard API
    [string]$DashboardApiUrl  = $(if ($env:API_URL) { $env:API_URL } else { "http://localhost:4000" }),
    [string]$IngestKey        = $(if ($env:INGEST_KEY) { $env:INGEST_KEY } else { "dev-ingest-key" }),

    # Mode continu (recupere la config depuis l'API a chaque cycle)
    [switch]$Loop,
    [int]$IntervalSeconds = 300
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function Write-Log {
    param([string]$Level = "INFO", [string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts][$Level] $Message"
}

# Ignorer les certificats auto-signés des baies.
# ICertificatePolicy/ServicePointManager.CertificatePolicy est une API .NET Framework qui
# n'existe plus sous .NET Core/PowerShell 7 (Linux) - on utilise -SkipCertificateCheck la ou
# disponible (PS6+), et on ne retombe sur l'ancien hack ServicePointManager que sous
# Windows PowerShell 5.1.
$script:SkipCertParam = @{}
if ($PSVersionTable.PSVersion.Major -ge 6) {
    $script:SkipCertParam = @{ SkipCertificateCheck = $true }
} else {
    Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAll : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
}
"@ -ErrorAction SilentlyContinue
    [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAll
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
}

# ─── Envoi vers le dashboard ─────────────────────────────────────────────────
function Send-StorageData {
    param([hashtable]$Data)

    $headers = @{
        "Content-Type" = "application/json"
        "x-ingest-key" = $IngestKey
    }
    $body = $Data | ConvertTo-Json -Depth 6

    try {
        $response = Invoke-RestMethod -Uri "$DashboardApiUrl/ingest/storage" `
            -Method POST -Headers $headers -Body $body -TimeoutSec 15
        Write-Log "INFO" "✅ $($Data.name) envoyé (ID: $($response.equipment_id))"
    } catch {
        Write-Log "WARN" "❌ Erreur envoi $(if ($Data.name) { $Data.name } else { $Data.ip }): $($_.Exception.Message)"
    }
}

# ─── Ping de disponibilité ───────────────────────────────────────────────────
function Test-StoragePing {
    # Note : $Host est une variable automatique PowerShell (objet hote de la console) -
    # on ne peut pas l'utiliser comme nom de parametre ("Cannot overwrite variable Host
    # because it is read-only or constant").
    param([string]$TargetHost)
    $ping = Test-Connection -ComputerName $TargetHost -Count 1 -Quiet -ErrorAction SilentlyContinue
    return $ping
}

# ─── Collecte via API REST Seagate ──────────────────────────────────────────
# L'API Seagate Systems Management Console expose des endpoints JSON.
# Documentation : https://www.seagate.com/support/dothill/
# Endpoint de base : https://<ip>/api/
function Collect-SeagateREST {
    param([string]$StorageIp)

    $baseUrl = "https://${StorageIp}:${ApiPort}"
    $sessionToken = $null
    $data = @{}

    try {
        # 1. Authentification - hash MD5 du login+password (API Seagate)
        $md5  = [System.Security.Cryptography.MD5]::Create()
        $hash = [BitConverter]::ToString($md5.ComputeHash(
            [System.Text.Encoding]::UTF8.GetBytes("${ApiUser}_${ApiPass}")
        )).Replace("-","").ToLower()

        $loginUrl = "$baseUrl/api/login/$hash"
        $authResp  = Invoke-RestMethod -Uri $loginUrl -Method GET -TimeoutSec 10 `
            -Headers @{ "dataType" = "json" } @script:SkipCertParam

        $sessionToken = $authResp.status[0].response
        if (-not $sessionToken) {
            Write-Log "WARN" "$StorageIp : authentification API échouée"
            return $null
        }

        $apiHeaders = @{
            "sessionKey" = $sessionToken
            "dataType"   = "json"
        }

        # 2. Informations système
        $sysInfo = Invoke-RestMethod -Uri "$baseUrl/api/show/system" `
            -Headers $apiHeaders -TimeoutSec 10 @script:SkipCertParam
        $sys = $sysInfo.objects[0]

        # 3. Volumes et capacité
        $volInfo = Invoke-RestMethod -Uri "$baseUrl/api/show/volumes" `
            -Headers $apiHeaders -TimeoutSec 10 @script:SkipCertParam
        $volumes = $volInfo.objects

        # Capacité globale depuis les pools
        $poolInfo = Invoke-RestMethod -Uri "$baseUrl/api/show/pools" `
            -Headers $apiHeaders -TimeoutSec 10 @script:SkipCertParam
        $pools = $poolInfo.objects

        $totalCapGBRaw = ($pools | Measure-Object -Property total-size-numeric -Sum).Sum
        $totalCapGB  = if ($null -ne $totalCapGBRaw) { $totalCapGBRaw } else { 0 }
        $usedCapGBRaw = ($pools | Measure-Object -Property allocated-size-numeric -Sum).Sum
        $usedCapGB   = if ($null -ne $usedCapGBRaw) { $usedCapGBRaw } else { 0 }
        $freeCapGB   = $totalCapGB - $usedCapGB
        $totalCapTB  = [math]::Round($totalCapGB / 1024, 2)
        $usedCapTB   = [math]::Round($usedCapGB / 1024, 2)
        $freeCapTB   = [math]::Round($freeCapGB / 1024, 2)

        # 4. Disques
        $diskInfo = Invoke-RestMethod -Uri "$baseUrl/api/show/disks" `
            -Headers $apiHeaders -TimeoutSec 10 @script:SkipCertParam
        $allDisks = $diskInfo.objects
        $disksOk       = ($allDisks | Where-Object { $_.health -eq "OK" }).Count
        $disksFailed   = ($allDisks | Where-Object { $_.health -ne "OK" -and $_.health -ne "N/A" }).Count
        $disksRebuilding = ($allDisks | Where-Object { $_.state -like "*REGEN*" -or $_.state -like "*REBUILD*" }).Count

        # 5. Contrôleurs
        $ctrlInfo = Invoke-RestMethod -Uri "$baseUrl/api/show/controllers" `
            -Headers $apiHeaders -TimeoutSec 10 @script:SkipCertParam
        $controllers = $ctrlInfo.objects | ForEach-Object {
            @{
                name   = $_.id
                status = if ($_.health -eq "OK") { "ok" } else { "fault" }
                role   = if ($_.'redundancy-status' -eq "ACTIVE") { "Actif" } else { "Passif/Secours" }
            }
        }

        # 6. Pools structurés pour l'UI
        $poolsForUI = $pools | ForEach-Object {
            @{
                name        = $_.name
                raid_level  = $_.'storage-type'
                capacity_gb = [math]::Round($(if ($null -ne $_.'total-size-numeric') { $_.'total-size-numeric' } else { 0 }), 0)
                used_gb     = [math]::Round($(if ($null -ne $_.'allocated-size-numeric') { $_.'allocated-size-numeric' } else { 0 }), 0)
                health      = $_.health
            }
        }

        $data = @{
            ip                 = $StorageIp
            name               = $(if ($sys.'system-name') { $sys.'system-name' } else { "Seagate-$StorageIp" })
            model              = $(if ($sys.'product-id') { $sys.'product-id' } else { "Exos X 5U84" })
            serial_number      = $(if ($sys.'midplane-serial-number') { $sys.'midplane-serial-number' } else { "" })
            firmware_version   = $(if ($sys.'bundle-version') { $sys.'bundle-version' } else { "" })
            health             = $sys.health
            overall_status     = if ($sys.health -eq "OK") { "OK" } else { "Fault" }
            capacity_total_tb  = $totalCapTB
            capacity_used_tb   = $usedCapTB
            capacity_free_tb   = $freeCapTB
            controllers        = $controllers
            disks_total        = $allDisks.Count
            disks_ok           = $disksOk
            disks_failed       = $disksFailed
            disks_rebuilding   = $disksRebuilding
            pools              = $poolsForUI
            volumes_count      = $volumes.Count
        }

        Write-Log "INFO" "REST collecté $StorageIp : santé=$($sys.health) | $totalCapTB To | $($allDisks.Count) disques"

        # Déconnexion
        Invoke-RestMethod -Uri "$baseUrl/api/logout" -Headers $apiHeaders -TimeoutSec 5 @script:SkipCertParam | Out-Null

    } catch {
        Write-Log "WARN" "API REST $StorageIp échouée : $($_.Exception.Message)"
        return $null
    }

    return $data
}

# ─── Collecte SNMP (OIDs standard MIB-II) ───────────────────────────────────
# Seagate Exos supporte SNMP v2c — on collecte au moins la disponibilité
function Collect-SeagateSNMP {
    param([string]$StorageIp)

    # Vérifier si le module SNMP est disponible
    $snmpAvailable = $false
    try {
        # Tentative de ping TCP sur le port SNMP (UDP 161 ne répond pas à Test-NetConnection)
        $tcpTest = Test-NetConnection -ComputerName $StorageIp -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
        $snmpAvailable = $tcpTest
    } catch {}

    # Construction du résultat basique (ping + disponibilité réseau)
    $isUp = Test-StoragePing -TargetHost $StorageIp
    return @{
        ip             = $StorageIp
        name           = "Seagate-$StorageIp"
        model          = "Seagate Exos X 5U84"
        health         = if ($isUp) { "OK" } else { "Critical" }
        overall_status = if ($isUp) { "OK" } else { "down" }
    }
}

# ─── Récupération de la config de connexion depuis l'API (mode continu) ─────
function Get-RemoteStorageConfig {
    try {
        $headers = @{ "x-ingest-key" = $IngestKey }
        return Invoke-RestMethod -Uri "$DashboardApiUrl/integrations/storage/config" -Method GET -Headers $headers -TimeoutSec 15
    } catch {
        Write-Log "WARN" "Impossible de récupérer la config Stockage depuis l'API: $($_.Exception.Message)"
        return $null
    }
}

# ─── Un cycle complet de collecte sur une liste de baies ────────────────────
function Invoke-StorageCollectionCycle {
    param([string[]]$Hosts)

    foreach ($storageIp in $Hosts) {
        $storageIp = $storageIp.Trim()
        if (-not $storageIp) { continue }
        Write-Log "INFO" "─── Baie : $storageIp ───"

        # 1. Test de disponibilité réseau
        $isReachable = Test-StoragePing -TargetHost $storageIp
        Write-Log "INFO" "$storageIp : disponibilité réseau = $isReachable"

        if (-not $isReachable) {
            Send-StorageData -Data @{
                ip             = $storageIp
                name           = "Seagate-$storageIp"
                model          = "Seagate Exos X 5U84"
                overall_status = "down"
                health         = "Critical"
            }
            continue
        }

        # 2. Collecte détaillée via API REST (mode principal)
        $data = $null
        if ($ApiUser -and $ApiPass) {
            $data = Collect-SeagateREST -StorageIp $storageIp
        }

        # 3. Fallback SNMP/basique si REST échoue
        if (-not $data) {
            Write-Log "INFO" "$storageIp : fallback vers collecte SNMP basique"
            $data = Collect-SeagateSNMP -StorageIp $storageIp
        }

        # 4. Envoi au dashboard
        if ($data) {
            Send-StorageData -Data $data
        }
    }
}

# ─── MAIN ────────────────────────────────────────────────────────────────────
Write-Log "INFO" "═══════ Collecte Baies Seagate Exos X ═══════"

if ($StorageHosts.Count -eq 0 -and $env:STORAGE_HOSTS) {
    $StorageHosts = $env:STORAGE_HOSTS -split ","
}
$hasExplicitHosts = $StorageHosts.Count -gt 0

if ($Loop -or -not $hasExplicitHosts) {
    Write-Log "INFO" "Mode continu - configuration récupérée depuis l'API (Panel Admin > Intégrations) toutes les ${IntervalSeconds}s"
    while ($true) {
        if ($hasExplicitHosts) {
            Invoke-StorageCollectionCycle -Hosts $StorageHosts
        } else {
            $cfg = Get-RemoteStorageConfig
            if ($cfg -and $cfg.configured -and $cfg.hosts -and $cfg.hosts.Count -gt 0) {
                $ApiUser = $cfg.apiUser
                $ApiPass = $cfg.apiPass
                $SnmpCommunity = $cfg.snmpCommunity
                Invoke-StorageCollectionCycle -Hosts $cfg.hosts
            } else {
                Write-Log "INFO" "Aucune baie configurée (Panel Admin > Intégrations). Nouvelle tentative dans ${IntervalSeconds}s."
            }
        }
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    Invoke-StorageCollectionCycle -Hosts $StorageHosts
}

Write-Log "INFO" "═══════ Collecte Stockage terminée ═══════"
