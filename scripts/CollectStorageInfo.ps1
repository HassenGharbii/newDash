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

# ─── Collecte via SSH/CLI Seagate ────────────────────────────────────────────
# Sur certains firmwares, l'API REST refuse des comptes pourtant valides cote GUI
# (401 systematique). Le CLI via SSH utilise le meme compte et s'est avere fiable -
# on l'utilise comme methode principale, l'API REST reste en repli au cas ou.
# Necessite openssh-client + sshpass dans l'image (voir docker/monitor/Dockerfile).
function Invoke-SeagateSSHCommand {
    param([string]$StorageIp, [string]$Command)

    try {
        $output = & sshpass -p $ApiPass ssh `
            -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 `
            "$ApiUser@$StorageIp" "$Command" 2>&1
        return ($output -join "`n")
    } catch {
        Write-Log "WARN" "$StorageIp : commande SSH '$Command' échouée : $($_.Exception.Message)"
        return $null
    }
}

# "show system" : paires "Label: Valeur", une par ligne
function ConvertFrom-SeagateSystemText {
    param([string]$Text)
    $info = @{}
    foreach ($line in ($Text -split "`n")) {
        if ($line -match '^([^:]+):\s*(.*)$') {
            $info[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }
    return $info
}

# "show disks" : tableau sur 2 lignes par disque (ligne 1 = "0.0  serial  vendor ... taille",
# ligne 2 indentee = "sec-fmt  disk-group  pool  tier  fips  health"). On ancre sur le
# numero d'emplacement en debut de ligne 1 et la sante en fin de ligne 2 - robuste meme si
# les colonnes du milieu varient en largeur.
function ConvertFrom-SeagateDisksText {
    param([string]$Text)
    $lines = $Text -split "`n"
    $total = 0; $ok = 0; $failed = 0; $rebuilding = 0

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\d+\.\d+\s') {
            $total++
            if ($i + 1 -lt $lines.Count) {
                $tokens = ($lines[$i + 1].Trim()) -split '\s+'
                $health = $tokens[$tokens.Count - 1]
                if ($health -eq 'OK') { $ok++ }
                elseif ($health -match 'REBUILD|REGEN') { $rebuilding++ }
                elseif ($health -and $health -ne 'N/A') { $failed++ }
            }
        }
    }
    return @{ total = $total; ok = $ok; failed = $failed; rebuilding = $rebuilding }
}

function Convert-SeagateSizeToTB {
    param([double]$Value, [string]$Unit)
    switch ($Unit) {
        'TiB' { return $Value }
        'GiB' { return $Value / 1024 }
        'MiB' { return $Value / 1024 / 1024 }
        'B'   { return $Value / 1024 / 1024 / 1024 / 1024 }
        default { return $Value }
    }
}

# "show pools" : meme principe 2-lignes. Ligne 1 commence par "<Lettre> <numero-serie-32hex>"
# et contient au moins 2 tailles ("Total Size" puis "Avail") ; ligne 2 se termine par la sante.
function ConvertFrom-SeagatePoolsText {
    param([string]$Text)
    $lines = $Text -split "`n"
    $pools = @()
    $totalTB = 0.0; $availTB = 0.0
    $sizeRegex = [regex]'([\d,]+)\s*(TiB|GiB|MiB|B)\b'

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^([A-Z])\s+[0-9a-f]{32}\s') {
            $poolName = $Matches[1]
            $sizeMatches = $sizeRegex.Matches($lines[$i])
            if ($sizeMatches.Count -ge 2) {
                $totalPoolTB = Convert-SeagateSizeToTB `
                    -Value ([double]($sizeMatches[0].Groups[1].Value -replace ',', '.')) `
                    -Unit $sizeMatches[0].Groups[2].Value
                $availPoolTB = Convert-SeagateSizeToTB `
                    -Value ([double]($sizeMatches[1].Groups[1].Value -replace ',', '.')) `
                    -Unit $sizeMatches[1].Groups[2].Value

                $totalTB += $totalPoolTB
                $availTB += $availPoolTB

                $health = 'OK'
                if ($i + 1 -lt $lines.Count) {
                    $contTokens = ($lines[$i + 1].Trim()) -split '\s+'
                    $health = $contTokens[$contTokens.Count - 1]
                }

                $pools += @{
                    name        = $poolName
                    raid_level  = "Virtuel"
                    capacity_gb = [math]::Round($totalPoolTB * 1024, 0)
                    used_gb     = [math]::Round(($totalPoolTB - $availPoolTB) * 1024, 0)
                    health      = $health
                }
            }
        }
    }
    return @{
        pools    = $pools
        total_tb = [math]::Round($totalTB, 2)
        avail_tb = [math]::Round($availTB, 2)
        used_tb  = [math]::Round($totalTB - $availTB, 2)
    }
}

function Collect-SeagateSSH {
    param([string]$StorageIp)

    $sysText = Invoke-SeagateSSHCommand -StorageIp $StorageIp -Command "show system"
    if (-not $sysText -or $sysText -notmatch 'Health') {
        Write-Log "WARN" "$StorageIp : SSH indisponible ou reponse inattendue"
        return $null
    }
    $sys = ConvertFrom-SeagateSystemText -Text $sysText

    $disksText = Invoke-SeagateSSHCommand -StorageIp $StorageIp -Command "show disks"
    $disks = if ($disksText) { ConvertFrom-SeagateDisksText -Text $disksText } else { @{ total=0; ok=0; failed=0; rebuilding=0 } }

    $poolsText = Invoke-SeagateSSHCommand -StorageIp $StorageIp -Command "show pools"
    $poolsInfo = if ($poolsText) { ConvertFrom-SeagatePoolsText -Text $poolsText } else { @{ pools=@(); total_tb=0; avail_tb=0; used_tb=0 } }

    $health = if ($sys.ContainsKey('Health')) { $sys['Health'] } else { 'Unknown' }
    $data = @{
        ip                 = $StorageIp
        name               = $(if ($sys['System Name'] -and $sys['System Name'] -ne 'Uninitialized Name') { $sys['System Name'] } else { "Seagate-$StorageIp" })
        model              = $(if ($sys['Product Brand']) { "$($sys['Product Brand']) $($sys['Product ID'])" } else { "Seagate Exos X" })
        serial_number      = $(if ($sys['Midplane Serial Number']) { $sys['Midplane Serial Number'] } else { "" })
        health             = $health
        overall_status     = if ($health -eq 'OK') { "OK" } else { "Fault" }
        capacity_total_tb  = $poolsInfo.total_tb
        capacity_used_tb   = $poolsInfo.used_tb
        capacity_free_tb   = $poolsInfo.avail_tb
        disks_total        = $disks.total
        disks_ok           = $disks.ok
        disks_failed       = $disks.failed
        disks_rebuilding   = $disks.rebuilding
        pools              = $poolsInfo.pools
        volumes_count      = $poolsInfo.pools.Count
    }

    Write-Log "INFO" "SSH collecté $StorageIp : santé=$health | $($data.capacity_total_tb) TiB | $($disks.total) disques"
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

        # 2. Collecte détaillée via SSH/CLI (mode principal - certains firmwares refusent
        # des comptes pourtant valides via l'API REST, le CLI SSH s'est avere plus fiable)
        $data = $null
        if ($ApiUser -and $ApiPass) {
            $data = Collect-SeagateSSH -StorageIp $storageIp
        }

        # 3. Repli sur l'API REST si SSH échoue
        if (-not $data -and $ApiUser -and $ApiPass) {
            $data = Collect-SeagateREST -StorageIp $storageIp
        }

        # 4. Dernier repli : ping + SNMP basique
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
