<#
.SYNOPSIS
    Collecte les métriques des hyperviseurs VMware ESXi via PowerCLI
    et les envoie au dashboard Semmaris.

.DESCRIPTION
    Se connecte à vCenter ou directement aux ESXi hosts.
    Récupère : CPU/RAM, VMs (état), datastores, uptime, version ESXi.
    Envoie les données vers POST /ingest/hyperviseur.

.PREREQUISIS
    Install-Module -Name VMware.PowerCLI -Scope CurrentUser

.EXEMPLE
    .\CollectHyperviseurInfo.ps1 -VCenterHost "vcenter.semmaris.local" -VCenterUser "administrator@vsphere.local"
    .\CollectHyperviseurInfo.ps1 -ESXiHosts @("192.168.1.10","192.168.1.11") -ESXiUser "root"
#>

param(
    # Mode vCenter (recommandé si déployé)
    [string]$VCenterHost = $env:VCENTER_HOST,
    [string]$VCenterUser = $env:VCENTER_USER,
    [string]$VCenterPass = $env:VCENTER_PASS,

    # Mode ESXi direct (si pas de vCenter)
    [string[]]$ESXiHosts  = @(),
    [string]$ESXiUser     = $env:ESXI_USER,
    [string]$ESXiPass     = $env:ESXI_PASS,

    # Dashboard API
    [string]$ApiUrl       = $(if ($env:API_URL) { $env:API_URL } else { "http://localhost:4000" }),
    [string]$IngestKey    = $(if ($env:INGEST_KEY) { $env:INGEST_KEY } else { "dev-ingest-key" })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Logging ────────────────────────────────────────────────────────────────
function Write-Log {
    param([string]$Level = "INFO", [string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts][$Level] $Message"
}

# ─── Vérification PowerCLI ──────────────────────────────────────────────────
if (-not (Get-Module -ListAvailable -Name VMware.PowerCLI)) {
    Write-Log "ERROR" "VMware.PowerCLI n'est pas installé."
    Write-Log "INFO"  "Installation : Install-Module -Name VMware.PowerCLI -Scope CurrentUser"
    exit 1
}

Import-Module VMware.PowerCLI -ErrorAction SilentlyContinue
Set-PowerCLIConfiguration -InvalidCertificateAction Ignore -Confirm:$false -Scope User | Out-Null
Set-PowerCLIConfiguration -ParticipateInCeip $false -Confirm:$false -Scope User 2>$null | Out-Null

# ─── Envoi vers l'API ───────────────────────────────────────────────────────
function Send-HyperviseurData {
    param([hashtable]$Data)

    $headers = @{
        "Content-Type"  = "application/json"
        "x-ingest-key"  = $IngestKey
    }
    $body = $Data | ConvertTo-Json -Depth 5

    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/ingest/hyperviseur" `
            -Method POST -Headers $headers -Body $body -TimeoutSec 15
        Write-Log "INFO" "✅ $($Data.hostname) envoyé (ID: $($response.equipment_id))"
    } catch {
        Write-Log "WARN" "❌ Erreur envoi $($Data.hostname): $($_.Exception.Message)"
    }
}

# ─── Collecte depuis un VMHost ───────────────────────────────────────────────
function Collect-VMHost {
    param($VMHost)

    try {
        $hostView = $VMHost | Get-View
        $summary  = $hostView.Summary
        $hardware = $summary.Hardware
        $runtime  = $summary.Runtime

        # CPU
        $cpuUsageMhz  = $summary.QuickStats.OverallCpuUsage
        $cpuTotalMhz  = $hardware.CpuMhz * $hardware.NumCpuCores
        $cpuUsagePct  = if ($cpuTotalMhz -gt 0) { [math]::Round(($cpuUsageMhz / $cpuTotalMhz) * 100, 1) } else { 0 }

        # RAM
        $memTotalMB   = $hardware.MemorySize / 1MB
        $memUsedMB    = $summary.QuickStats.OverallMemoryUsage
        $memUsagePct  = if ($memTotalMB -gt 0) { [math]::Round(($memUsedMB / $memTotalMB) * 100, 1) } else { 0 }

        # VMs
        $vms = Get-VM -Server $global:viConn -VMHost $VMHost -ErrorAction SilentlyContinue
        $vmRunning   = ($vms | Where-Object { $_.PowerState -eq "PoweredOn" }).Count
        $vmStopped   = ($vms | Where-Object { $_.PowerState -eq "PoweredOff" }).Count
        $vmSuspended = ($vms | Where-Object { $_.PowerState -eq "Suspended" }).Count
        $vmTotal     = $vms.Count

        # Datastores
        $datastores = @()
        Get-Datastore -VMHost $VMHost -ErrorAction SilentlyContinue | ForEach-Object {
            $ds = $_
            $datastores += @{
                name        = $ds.Name
                capacity_gb = [math]::Round($ds.CapacityGB, 1)
                used_gb     = [math]::Round($ds.CapacityGB - $ds.FreeSpaceGB, 1)
                free_gb     = [math]::Round($ds.FreeSpaceGB, 1)
                type        = $ds.Type
            }
        }

        # Uptime
        $uptimeSec = $summary.QuickStats.Uptime
        $uptimeDays = if ($uptimeSec) { [math]::Round($uptimeSec / 86400, 1) } else { 0 }

        # Connexion status
        $connState = $runtime.ConnectionState.ToString()
        $status    = if ($connState -eq "connected") { "connected" } else { "disconnected" }

        $data = @{
            hostname        = $VMHost.Name
            ip              = $VMHost.Name  # vCenter utilise le hostname/FQDN
            esxi_version    = $hardware.VendorIdentifier + " ESXi $($VMHost.Version)"
            vendor          = "VMware"
            model           = $hardware.Model
            cpu_usage_pct   = $cpuUsagePct
            memory_usage_pct = $memUsagePct
            memory_total_gb = [math]::Round($memTotalMB / 1024, 1)
            memory_used_gb  = [math]::Round($memUsedMB / 1024, 1)
            vm_total        = $vmTotal
            vm_running      = $vmRunning
            vm_stopped      = $vmStopped
            vm_suspended    = $vmSuspended
            uptime_days     = $uptimeDays
            cpu_sockets     = $hardware.NumCpuPkgs
            cpu_cores_total = $hardware.NumCpuCores
            cpu_mhz         = $hardware.CpuMhz
            datastores      = $datastores
            status          = $status
        }

        Write-Log "INFO" "Collecté : $($VMHost.Name) | CPU: $cpuUsagePct% | RAM: $memUsagePct% | VMs: $vmRunning/$vmTotal actives"
        Send-HyperviseurData -Data $data

    } catch {
        Write-Log "WARN" "Erreur collecte host $($VMHost.Name): $($_.Exception.Message)"

        # Envoyer au moins le statut DOWN
        Send-HyperviseurData -Data @{
            hostname = $VMHost.Name
            ip       = $VMHost.Name
            status   = "disconnected"
        }
    }
}

# ─── MAIN ────────────────────────────────────────────────────────────────────
Write-Log "INFO" "═══════ Collecte Hyperviseurs VMware ═══════"

$global:viConn = $null

try {
    # Connexion vCenter ou ESXi direct
    if ($VCenterHost) {
        Write-Log "INFO" "Connexion à vCenter: $VCenterHost"

        if (-not $VCenterPass) {
            $secPass = Read-Host "Mot de passe vCenter" -AsSecureString
            $VCenterPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass))
        }

        $global:viConn = Connect-VIServer -Server $VCenterHost `
            -User $VCenterUser -Password $VCenterPass -ErrorAction Stop
        Write-Log "INFO" "✅ Connecté à vCenter $VCenterHost"

        $vmHosts = Get-VMHost -Server $global:viConn
        Write-Log "INFO" "Hosts ESXi trouvés : $($vmHosts.Count)"

        foreach ($h in $vmHosts) {
            Collect-VMHost -VMHost $h
        }

    } elseif ($ESXiHosts.Count -gt 0) {
        # Mode connexion directe à chaque ESXi
        foreach ($esxiIp in $ESXiHosts) {
            Write-Log "INFO" "Connexion directe à ESXi: $esxiIp"
            try {
                if (-not $ESXiPass) {
                    $secPass = Read-Host "Mot de passe ESXi $esxiIp" -AsSecureString
                    $ESXiPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass))
                }

                $global:viConn = Connect-VIServer -Server $esxiIp `
                    -User $ESXiUser -Password $ESXiPass -ErrorAction Stop
                Write-Log "INFO" "✅ Connecté à $esxiIp"

                $vmHost = Get-VMHost -Server $global:viConn | Select-Object -First 1
                Collect-VMHost -VMHost $vmHost

                Disconnect-VIServer -Server $global:viConn -Confirm:$false -ErrorAction SilentlyContinue
                $global:viConn = $null
            } catch {
                Write-Log "WARN" "Impossible de se connecter à $esxiIp : $($_.Exception.Message)"
            }
        }
    } else {
        Write-Log "ERROR" "Aucune cible définie. Utilisez -VCenterHost ou -ESXiHosts."
        Write-Log "INFO"  "Exemple: .\CollectHyperviseurInfo.ps1 -VCenterHost vcenter.semmaris.local -VCenterUser administrator@vsphere.local"
        exit 1
    }

} finally {
    if ($global:viConn) {
        Disconnect-VIServer -Server $global:viConn -Confirm:$false -ErrorAction SilentlyContinue
        Write-Log "INFO" "Déconnecté de vCenter/ESXi"
    }
}

Write-Log "INFO" "═══════ Collecte terminée ═══════"
