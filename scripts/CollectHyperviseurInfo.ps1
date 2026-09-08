<#
.SYNOPSIS
    Collecte les métriques des hyperviseurs VMware ESXi via PowerCLI
    et les envoie au dashboard Semmaris.

.DESCRIPTION
    Se connecte à vCenter ou directement aux ESXi hosts.
    Récupère : CPU/RAM, VMs (état), datastores, uptime, version ESXi.
    Envoie les données vers POST /ingest/hyperviseur.

    Deux modes :
    - Ponctuel (par défaut si -VCenterHost/-ESXiHosts sont fournis) : une seule collecte puis sortie.
    - Continu (-Loop, ou automatique si aucune cible n'est fournie en ligne de commande) :
      récupère la configuration de connexion depuis l'API (Panel Admin > Intégrations,
      GET /integrations/vmware/config) à chaque cycle, et collecte en boucle. C'est le mode
      utilisé par le conteneur Docker.

.PREREQUISIS
    Install-Module -Name VMware.PowerCLI -Scope CurrentUser

.EXEMPLE
    .\CollectHyperviseurInfo.ps1 -VCenterHost "vcenter.semmaris.local" -VCenterUser "administrator@vsphere.local"
    .\CollectHyperviseurInfo.ps1 -ESXiHosts @("192.168.1.10","192.168.1.11") -ESXiUser "root"
    .\CollectHyperviseurInfo.ps1 -Loop -IntervalSeconds 300
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
    [string]$IngestKey    = $(if ($env:INGEST_KEY) { $env:INGEST_KEY } else { "dev-ingest-key" }),

    # Mode continu (recupere la config depuis l'API a chaque cycle)
    [switch]$Loop,
    [int]$IntervalSeconds = 300
)

$ErrorActionPreference = "Stop"
# Deliberately no Set-StrictMode here: PowerCLI's View/Summary objects carry a different
# property set depending on connection mode (vCenter vs direct ESXi) and PowerCLI version -
# under strict mode a merely-absent field (e.g. VendorIdentifier on some direct-ESXi
# connections) throws instead of returning $null, aborting the whole host's collection.

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

# ─── Récupération de TOUTES les connexions VMware configurées (mode continu) ────
# Plusieurs connexions nommées peuvent être configurées (Panel Admin > Intégrations) -
# chacune est collectée séparément et taguée avec son nom (connection_name) pour que le
# frontend puisse filtrer par connexion.
function Get-RemoteVCenterConnections {
    try {
        $headers = @{ "x-ingest-key" = $IngestKey }
        return @(Invoke-RestMethod -Uri "$ApiUrl/integrations/vmware/connections/config" -Method GET -Headers $headers -TimeoutSec 15)
    } catch {
        Write-Log "WARN" "Impossible de récupérer les connexions VMware depuis l'API: $($_.Exception.Message)"
        return @()
    }
}

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
    param($VMHost, $ViConnection, [bool]$DirectEsxi = $false, [string]$ConnectionName = '')

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
        # Note : -Location $VMHost ne retourne rien de fiable sur une connexion ESXi directe
        # (pas de vCenter) avec cette version de PowerCLI - dans ce cas, la connexion ne
        # concerne de toute facon qu'un seul hote, donc on recupere tout sans filtrer.
        if ($DirectEsxi) {
            $vms = @(Get-VM -Server $ViConnection -ErrorAction SilentlyContinue)
        } else {
            $vms = @(Get-VM -Server $ViConnection -Location $VMHost -ErrorAction SilentlyContinue)
        }
        $vmRunning   = @($vms | Where-Object { $_.PowerState -eq "PoweredOn" }).Count
        $vmStopped   = @($vms | Where-Object { $_.PowerState -eq "PoweredOff" }).Count
        $vmSuspended = @($vms | Where-Object { $_.PowerState -eq "Suspended" }).Count
        $vmTotal     = $vms.Count

        # Détail par VM (nom, état, ressources, OS/IP si VMware Tools est installé)
        $vmDetails = @()
        foreach ($vm in $vms) {
            $vmDetails += @{
                name         = $vm.Name
                power_state  = $vm.PowerState.ToString()
                cpu_count    = $vm.NumCpu
                memory_gb    = [math]::Round($vm.MemoryGB, 1)
                provisioned_space_gb = [math]::Round($vm.ProvisionedSpaceGB, 1)
                used_space_gb = [math]::Round($vm.UsedSpaceGB, 1)
                guest_os     = if ($vm.Guest -and $vm.Guest.OSFullName) { $vm.Guest.OSFullName } else { $vm.ExtensionData.Config.GuestFullName }
                ip_address   = if ($vm.Guest -and $vm.Guest.IPAddress) { ($vm.Guest.IPAddress | Select-Object -First 1) } else { $null }
            }
        }

        # Datastores
        # Note : -Location de Get-Datastore n'accepte pas d'objet VMHost dans cette version
        # de PowerCLI ("accepts only Datacenter, Folder and DatastoreCluster objects") - il
        # faut passer le VMHost par le pipeline pour un scoping correct par hote.
        $datastores = @()
        $dsList = $VMHost | Get-Datastore -Server $ViConnection -ErrorAction SilentlyContinue
        $dsList | ForEach-Object {
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
            vms             = $vmDetails
            uptime_days     = $uptimeDays
            cpu_sockets     = $hardware.NumCpuPkgs
            cpu_cores_total = $hardware.NumCpuCores
            cpu_mhz         = $hardware.CpuMhz
            datastores      = $datastores
            status          = $status
            connection_name = $ConnectionName
        }

        Write-Log "INFO" "Collecté : $($VMHost.Name) | CPU: $cpuUsagePct% | RAM: $memUsagePct% | VMs: $vmRunning/$vmTotal actives"
        Send-HyperviseurData -Data $data

    } catch {
        Write-Log "WARN" "Erreur collecte host $($VMHost.Name): $($_.Exception.Message)"

        # Envoyer au moins le statut DOWN
        Send-HyperviseurData -Data @{
            hostname        = $VMHost.Name
            ip              = $VMHost.Name
            status          = "disconnected"
            connection_name = $ConnectionName
        }
    }
}

# Retient, par connexion, les derniers hotes ESXi vus sous un vCenter - permet de signaler
# ces hotes comme DOWN si une connexion ulterieure au vCenter echoue completement (sinon on
# ne saurait pas quels hotes existaient pour les marquer hors ligne).
$script:lastKnownHostsByConnection = @{}

# ─── Un cycle complet de collecte (vCenter ou ESXi direct) ──────────────────
function Invoke-VMwareCollection {
    param(
        [string]$VCenterHost, [string]$VCenterUser, [string]$VCenterPass,
        [string[]]$ESXiHosts, [string]$ESXiUser, [string]$ESXiPass,
        [bool]$AllowPrompt = $false, [string]$ConnectionName = ''
    )

    $viConn = $null
    try {
        if ($VCenterHost) {
            Write-Log "INFO" "Connexion à vCenter: $VCenterHost"

            if (-not $VCenterPass -and $AllowPrompt) {
                $secPass = Read-Host "Mot de passe vCenter" -AsSecureString
                $VCenterPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass))
            }
            if (-not $VCenterPass) {
                Write-Log "WARN" "Aucun mot de passe vCenter fourni - collecte ignorée pour ce cycle."
                return
            }

            try {
                $viConn = Connect-VIServer -Server $VCenterHost -User $VCenterUser -Password $VCenterPass -ErrorAction Stop
            } catch {
                Write-Log "WARN" "Impossible de se connecter à vCenter $VCenterHost : $($_.Exception.Message)"
                # On ne peut pas interroger les hotes maintenant qu'on est deconnecte - on
                # utilise la derniere liste connue pour signaler ces hotes comme hors ligne
                # au lieu de laisser leur statut UP en base indéfiniment.
                $known = $script:lastKnownHostsByConnection[$ConnectionName]
                if ($known) {
                    foreach ($hostName in $known) {
                        Send-HyperviseurData -Data @{
                            hostname        = $hostName
                            ip              = $hostName
                            status          = "disconnected"
                            connection_name = $ConnectionName
                        }
                    }
                }
                return
            }
            Write-Log "INFO" "✅ Connecté à vCenter $VCenterHost"

            $vmHosts = @(Get-VMHost -Server $viConn)
            Write-Log "INFO" "Hosts ESXi trouvés : $($vmHosts.Count)"
            $script:lastKnownHostsByConnection[$ConnectionName] = @($vmHosts | ForEach-Object { $_.Name })

            foreach ($h in $vmHosts) {
                Collect-VMHost -VMHost $h -ViConnection $viConn -ConnectionName $ConnectionName
            }

        } elseif ($ESXiHosts -and $ESXiHosts.Count -gt 0) {
            foreach ($esxiIp in $ESXiHosts) {
                Write-Log "INFO" "Connexion directe à ESXi: $esxiIp"
                $hostPass = $ESXiPass
                try {
                    if (-not $hostPass -and $AllowPrompt) {
                        $secPass = Read-Host "Mot de passe ESXi $esxiIp" -AsSecureString
                        $hostPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass))
                    }
                    if (-not $hostPass) {
                        Write-Log "WARN" "Aucun mot de passe ESXi fourni pour $esxiIp - ignoré."
                        continue
                    }

                    $esxiConn = Connect-VIServer -Server $esxiIp -User $ESXiUser -Password $hostPass -ErrorAction Stop
                    Write-Log "INFO" "✅ Connecté à $esxiIp"

                    $vmHost = Get-VMHost -Server $esxiConn | Select-Object -First 1
                    Collect-VMHost -VMHost $vmHost -ViConnection $esxiConn -DirectEsxi $true -ConnectionName $ConnectionName

                    Disconnect-VIServer -Server $esxiConn -Confirm:$false -ErrorAction SilentlyContinue
                } catch {
                    Write-Log "WARN" "Impossible de se connecter à $esxiIp : $($_.Exception.Message)"
                    # Signaler l'hote comme hors ligne plutot que de laisser son statut UP
                    # en base indefiniment jusqu'a la prochaine connexion reussie.
                    Send-HyperviseurData -Data @{
                        hostname        = $esxiIp
                        ip              = $esxiIp
                        status          = "disconnected"
                        connection_name = $ConnectionName
                    }
                }
            }
        } else {
            Write-Log "WARN" "Aucune cible VMware configurée."
        }
    } catch {
        Write-Log "WARN" "Erreur de collecte VMware : $($_.Exception.Message)"
    } finally {
        if ($viConn) {
            Disconnect-VIServer -Server $viConn -Confirm:$false -ErrorAction SilentlyContinue
            Write-Log "INFO" "Déconnecté de vCenter/ESXi"
        }
    }
}

# ─── MAIN ────────────────────────────────────────────────────────────────────
Write-Log "INFO" "═══════ Collecte Hyperviseurs VMware ═══════"

$hasExplicitTarget = [bool]$VCenterHost -or ($ESXiHosts -and $ESXiHosts.Count -gt 0)

if ($Loop -or -not $hasExplicitTarget) {
    if ($hasExplicitTarget) {
        Write-Log "INFO" "Mode continu (cible fixe) - collecte toutes les ${IntervalSeconds}s"
        while ($true) {
            Invoke-VMwareCollection -VCenterHost $VCenterHost -VCenterUser $VCenterUser -VCenterPass $VCenterPass `
                -ESXiHosts $ESXiHosts -ESXiUser $ESXiUser -ESXiPass $ESXiPass -AllowPrompt $false -ConnectionName "CLI"
            Start-Sleep -Seconds $IntervalSeconds
        }
    } else {
        # Chaque connexion a son propre planning : collecte reguliere toutes les
        # IntervalSeconds, MAIS on verifie toutes les PollTickSeconds si le bouton
        # "Collecter maintenant" (Panel Admin > Integrations) a ete utilise, pour
        # reagir en quelques secondes plutot que d'attendre le cycle complet.
        $PollTickSeconds = 10
        $lastCollectedAt = @{}
        $lastTriggerSeen = @{}
        $lastEmptyLogAt = $null

        Write-Log "INFO" "Mode continu - connexions depuis l'API (Panel Admin > Intégrations), verifiees toutes les ${PollTickSeconds}s, collecte reguliere toutes les ${IntervalSeconds}s par connexion"

        while ($true) {
            $connections = Get-RemoteVCenterConnections
            $usable = @($connections | Where-Object { $_.vcenterHost -or ($_.esxiHosts -and $_.esxiHosts.Count -gt 0) })

            foreach ($conn in $usable) {
                $key = "$($conn.id)"
                $now = Get-Date

                $dueRegular = -not $lastCollectedAt.ContainsKey($key) -or (($now - $lastCollectedAt[$key]).TotalSeconds -ge $IntervalSeconds)
                $dueTrigger = $conn.triggerRequestedAt -and ($lastTriggerSeen[$key] -ne $conn.triggerRequestedAt)

                if ($dueRegular -or $dueTrigger) {
                    if ($dueTrigger -and -not $dueRegular) {
                        Write-Log "INFO" "─── Connexion: $($conn.name) (collecte demandée manuellement) ───"
                    } else {
                        Write-Log "INFO" "─── Connexion: $($conn.name) ───"
                    }
                    Invoke-VMwareCollection -VCenterHost $conn.vcenterHost -VCenterUser $conn.vcenterUser -VCenterPass $conn.vcenterPass `
                        -ESXiHosts $conn.esxiHosts -ESXiUser $conn.esxiUser -ESXiPass $conn.esxiPass -AllowPrompt $false -ConnectionName $conn.name
                    $lastCollectedAt[$key] = $now
                    $lastTriggerSeen[$key] = $conn.triggerRequestedAt
                }
            }

            if ($usable.Count -eq 0 -and (-not $lastEmptyLogAt -or ((Get-Date) - $lastEmptyLogAt).TotalSeconds -ge $IntervalSeconds)) {
                Write-Log "INFO" "Aucune connexion VMware configurée (Panel Admin > Intégrations)."
                $lastEmptyLogAt = Get-Date
            }

            Start-Sleep -Seconds $PollTickSeconds
        }
    }
} else {
    Invoke-VMwareCollection -VCenterHost $VCenterHost -VCenterUser $VCenterUser -VCenterPass $VCenterPass `
        -ESXiHosts $ESXiHosts -ESXiUser $ESXiUser -ESXiPass $ESXiPass -AllowPrompt $true -ConnectionName "CLI"
}

Write-Log "INFO" "═══════ Collecte terminée ═══════"
