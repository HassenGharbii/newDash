# Script de collecte de bande passante RAPIDE pour switches
# Utilise SnmpGet au lieu de SnmpWalk (beaucoup plus rapide)

param([int]$IntervalSeconds = 10)

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$CONFIG_FILE = Join-Path $ScriptRoot "config.json"
$SNMPWALK_PATH = "C:\Users\Axone\Documents\SnmpWalk\SnmpWalk.exe"

# Charger la configuration
if (-not (Test-Path $CONFIG_FILE)) {
    Write-Error "Fichier config.json introuvable"
    exit 1
}

$config = Get-Content $CONFIG_FILE -Raw | ConvertFrom-Json
$API_URL = $config.apiBase
$API_KEY = $config.ingestKey
$SNMP_COMMUNITY = "public"

# Switches à monitorer (5 pour commencer)
$SWITCHES = @(
    @{ Name = "FED-VIDG3ST2"; IP = "172.16.5.3" },
    @{ Name = "SWVID-H2"; IP = "172.16.5.1" },
    @{ Name = "SWVID-G3-REPLI"; IP = "172.16.5.2" },
    @{ Name = "SWVID-E5"; IP = "172.16.5.4" },
    @{ Name = "SWVID-B3"; IP = "172.16.5.5" },
    @{ Name = "SWVID-PI2-STK1-2"; IP = "172.16.5.220" },
    @{ Name = "SWVID-D3"; IP = "172.16.5.6" },
    @{ Name = "SWVID-F3"; IP = "172.16.5.7" },
    @{ Name = "SWVID-A3"; IP = "172.16.5.8" },
    @{ Name = "SWVID-C3"; IP = "172.16.5.9" },
    @{ Name = "SWVID-PI3-STK1-2"; IP = "172.16.5.221" },
    @{ Name = "SWVID-E3"; IP = "172.16.5.10" },
    @{ Name = "SWVID-D4"; IP = "172.16.5.11" },
    @{ Name = "SWVID-F4"; IP = "172.16.5.12" },
    @{ Name = "SWVID-A4"; IP = "172.16.5.13" },
    @{ Name = "SWVID-C4"; IP = "172.16.5.14" },
    @{ Name = "SWVID-E4"; IP = "172.16.5.15" },
    @{ Name = "SWVID-D5"; IP = "172.16.5.16" },
    @{ Name = "SWVID-F5"; IP = "172.16.5.17" },
    @{ Name = "SWVID-A5"; IP = "172.16.5.18" },
    @{ Name = "SWVID-C5"; IP = "172.16.5.19" },
    @{ Name = "SWVID-PI5-STK1-2"; IP = "172.16.5.222" },
    @{ Name = "SWVID-D6"; IP = "172.16.5.20" },
    @{ Name = "SWVID-F6"; IP = "172.16.5.21" },
    @{ Name = "SWVID-A6"; IP = "172.16.5.22" },
    @{ Name = "SWVID-C6"; IP = "172.16.5.23" },
    @{ Name = "SWVID-E6"; IP = "172.16.5.24" },
    @{ Name = "SWVID-PI6-STK1-2"; IP = "172.16.5.223" },
    @{ Name = "SWVID-D7"; IP = "172.16.5.25" },
    @{ Name = "SWVID-F7"; IP = "172.16.5.26" },
    @{ Name = "SWVID-A7"; IP = "172.16.5.27" },
    @{ Name = "SWVID-C7"; IP = "172.16.5.28" },
    @{ Name = "SWVID-E7"; IP = "172.16.5.29" },
    @{ Name = "SWVID-PI7-STK1-2"; IP = "172.16.5.224" },
    @{ Name = "SWVID-D8"; IP = "172.16.5.30" },
    @{ Name = "SWVID-F8"; IP = "172.16.5.31" },
    @{ Name = "SWVID-A8"; IP = "172.16.5.32" },
    @{ Name = "SWVID-C8"; IP = "172.16.5.33" },
    @{ Name = "SWVID-E8"; IP = "172.16.5.34" },
    @{ Name = "SWVID-PI8-STK1-2"; IP = "172.16.5.225" },
    @{ Name = "SWVID-D9"; IP = "172.16.5.35" },
    @{ Name = "SWVID-F9"; IP = "172.16.5.36" },
    @{ Name = "SWVID-A9"; IP = "172.16.5.37" },
    @{ Name = "SWVID-C9"; IP = "172.16.5.38" },
    @{ Name = "SWVID-E9"; IP = "172.16.5.39" },
    @{ Name = "SWVID-PI9-STK1-2"; IP = "172.16.5.226" },
    @{ Name = "SWVID-D10"; IP = "172.16.5.40" },
    @{ Name = "SWVID-F10"; IP = "172.16.5.41" },
    @{ Name = "SWVID-A10"; IP = "172.16.5.42" },
    @{ Name = "SWVID-C10"; IP = "172.16.5.43" },
    @{ Name = "SWVID-E10"; IP = "172.16.5.44" },
    @{ Name = "SWVID-PI10-STK1-2"; IP = "172.16.5.227" },
    @{ Name = "SWVID-D11"; IP = "172.16.5.45" },
    @{ Name = "SWVID-F11"; IP = "172.16.5.46" },
    @{ Name = "SWVID-A11"; IP = "172.16.5.47" },
    @{ Name = "SWVID-C11"; IP = "172.16.5.48" },
    @{ Name = "SWVID-E11"; IP = "172.16.5.49" },
    @{ Name = "SWVID-PI11-STK1-2"; IP = "172.16.5.228" },
    @{ Name = "SWVID-D12"; IP = "172.16.5.50" },
    @{ Name = "SWVID-F12"; IP = "172.16.5.51" },
    @{ Name = "SWVID-A12"; IP = "172.16.5.52" },
    @{ Name = "SWVID-C12"; IP = "172.16.5.53" },
    @{ Name = "SWVID-E12"; IP = "172.16.5.54" },
    @{ Name = "SWVID-PI12-STK1-2"; IP = "172.16.5.229" },
    @{ Name = "SWVID-D13"; IP = "172.16.5.55" },
    @{ Name = "SWVID-F13"; IP = "172.16.5.56" },
    @{ Name = "SWVID-A13"; IP = "172.16.5.57" },
    @{ Name = "SWVID-C13"; IP = "172.16.5.58" },
    @{ Name = "SWVID-E13"; IP = "172.16.5.59" },
    @{ Name = "SWVID-PI13-STK1-2"; IP = "172.16.5.230" },
    @{ Name = "SWVID-D14"; IP = "172.16.5.60" },
    @{ Name = "SWVID-F14"; IP = "172.16.5.61" },
    @{ Name = "SWVID-A14"; IP = "172.16.5.62" },
    @{ Name = "SWVID-C14"; IP = "172.16.5.63" },
    @{ Name = "SWVID-E14"; IP = "172.16.5.64" },
    @{ Name = "SWVID-PI14-STK1-2"; IP = "172.16.5.231" },
    @{ Name = "SWVID-D15"; IP = "172.16.5.65" },
    @{ Name = "SWVID-F15"; IP = "172.16.5.66" },
    @{ Name = "SWVID-A15"; IP = "172.16.5.67" },
    @{ Name = "SWVID-C15"; IP = "172.16.5.68" },
    @{ Name = "SWVID-E15"; IP = "172.16.5.69" },
    @{ Name = "SWVID-PI15-STK1-2"; IP = "172.16.5.232" },
    @{ Name = "SWVID-D16"; IP = "172.16.5.70" },
    @{ Name = "SWVID-F16"; IP = "172.16.5.71" },
    @{ Name = "SWVID-A16"; IP = "172.16.5.72" },
    @{ Name = "SWVID-C16"; IP = "172.16.5.73" },
    @{ Name = "SWVID-E16"; IP = "172.16.5.74" },
    @{ Name = "SWVID-PI16-STK1-2"; IP = "172.16.5.233" },
    @{ Name = "SWVID-D17"; IP = "172.16.5.75" },
    @{ Name = "SWVID-F17"; IP = "172.16.5.76" },
    @{ Name = "SWVID-A17"; IP = "172.16.5.77" },
    @{ Name = "SWVID-C17"; IP = "172.16.5.78" },
    @{ Name = "SWVID-E17"; IP = "172.16.5.79" },
    @{ Name = "SWVID-PI17-STK1-2"; IP = "172.16.5.234" },
    @{ Name = "SWVID-G3ST2"; IP = "172.16.5.80" },
    @{ Name = "SWEXPL-RDC"; IP = "172.16.5.95" },
    @{ Name = "SWEXPL-ETAGE"; IP = "172.16.5.96" }
)

# OIDs standards MIB-II
$OID_IF_IN_OCTETS = "1.3.6.1.2.1.2.2.1.10"
$OID_IF_OUT_OCTETS = "1.3.6.1.2.1.2.2.1.16"

# Stockage des valeurs précédentes
$script:previousValues = @{}

Write-Host "`n========================================"
Write-Host "COLLECTE BANDE PASSANTE SWITCHES"
Write-Host "========================================"
Write-Host "`nAPI: $API_URL"
Write-Host "Switches: $($SWITCHES.Count)"
Write-Host "Intervalle: $IntervalSeconds secondes"
Write-Host "Methode: SnmpWalk avec OID precis (rapide)"
Write-Host "`nDemarrage...`n"

# Fonction SNMP Walk sur un OID précis (équivalent à GET)
function Get-SnmpValue {
    param([string]$IP, [string]$OID)
    
    try {
        $output = & $SNMPWALK_PATH -r:$IP -c:$SNMP_COMMUNITY -os:$OID -csv 2>$null | Select-Object -First 1
        if ($output -and $output -match ',(\d+)') {
            return [int64]$matches[1]
        }
        return $null
    } catch {
        return $null
    }
}

# Fonction d'envoi à l'API
function Send-BandwidthData {
    param([string]$SwitchName, [double]$Mbps)
    
    try {
        $body = @{
            equipment_name = $SwitchName
            equipment_type = "Switch"
            value_mbps = [math]::Round($Mbps, 2)
            timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        } | ConvertTo-Json
        
        $headers = @{
            'x-api-key' = $API_KEY
            'Content-Type' = 'application/json'
        }
        
        Invoke-RestMethod -Uri "$API_URL/bandwidth/ingest" `
            -Method Post `
            -Headers $headers `
            -Body $body `
            -ErrorAction Stop | Out-Null
        
        return $true
    } catch {
        Write-Host "    [ERREUR API] $_" -ForegroundColor Red
        return $false
    }
}

# Boucle principale
$iteration = 0
while ($true) {
    $iteration++
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    Write-Host "`n--- Collecte #$iteration ($timestamp) ---" -ForegroundColor Cyan
    
    foreach ($switch in $SWITCHES) {
        $switchName = $switch.Name
        $switchIP = $switch.IP
        
        Write-Host "`n  $switchName ($switchIP)" -ForegroundColor White
        
        # Collecter les 24 premiers ports (compromis vitesse/précision)
        $totalIn = 0
        $totalOut = 0
        $portsOk = 0
        
        for ($port = 1; $port -le 24; $port++) {
            $inVal = Get-SnmpValue -IP $switchIP -OID "$OID_IF_IN_OCTETS.$port"
            $outVal = Get-SnmpValue -IP $switchIP -OID "$OID_IF_OUT_OCTETS.$port"
            
            if ($null -ne $inVal -and $null -ne $outVal) {
                $totalIn += $inVal
                $totalOut += $outVal
                $portsOk++
            }
        }
        
        if ($portsOk -eq 0) {
            Write-Host "    [ERREUR] Pas de reponse SNMP" -ForegroundColor Red
            continue
        }
        
        Write-Host "    Ports collectes: $portsOk/24" -ForegroundColor Gray
        Write-Host "    Total IN: $totalIn octets" -ForegroundColor Gray
        Write-Host "    Total OUT: $totalOut octets" -ForegroundColor Gray
        
        # Calculer la bande passante si on a des valeurs précédentes
        $key = $switchName
        if ($script:previousValues.ContainsKey($key)) {
            $prevIn = $script:previousValues[$key].In
            $prevOut = $script:previousValues[$key].Out
            $prevTime = $script:previousValues[$key].Time
            
            $deltaIn = $totalIn - $prevIn
            $deltaOut = $totalOut - $prevOut
            $deltaTime = ((Get-Date) - $prevTime).TotalSeconds
            
            # Gérer les compteurs qui se réinitialisent
            if ($deltaIn -lt 0) { $deltaIn = $totalIn }
            if ($deltaOut -lt 0) { $deltaOut = $totalOut }
            
            # Calculer les Mbps
            $totalOctets = $deltaIn + $deltaOut
            $mbps = ($totalOctets * 8) / ($deltaTime * 1MB)
            
            # Affichage avec couleur
            $color = 'Green'
            $status = "ACTIF"
            if ($mbps -lt 0.01) {
                $color = 'DarkGray'
                $status = "INACTIF"
            } elseif ($mbps -lt 1) {
                $color = 'Yellow'
                $status = "FAIBLE"
            }
            
            Write-Host "    [$status] Bande passante: $([math]::Round($mbps, 2)) Mbps" -ForegroundColor $color
            
            # Envoyer les données
            $success = Send-BandwidthData -SwitchName $switchName -Mbps $mbps
            if ($success) {
                Write-Host "    [OK] Donnees envoyees" -ForegroundColor Green
            }
        } else {
            Write-Host "    [INFO] Premiere mesure - calcul au prochain cycle" -ForegroundColor Gray
        }
        
        # Stocker les valeurs actuelles
        $script:previousValues[$key] = @{
            In = $totalIn
            Out = $totalOut
            Time = Get-Date
        }
    }
    
    Write-Host "`nProchaine collecte dans $IntervalSeconds secondes..." -ForegroundColor Gray
    Write-Host "Appuyez sur Ctrl+C pour arreter`n" -ForegroundColor DarkGray
    
    Start-Sleep -Seconds $IntervalSeconds
}
