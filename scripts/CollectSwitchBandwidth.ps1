# Script de collecte de bande passante RAPIDE pour switches
# Utilise SnmpGet au lieu de SnmpWalk (beaucoup plus rapide)

param([int]$IntervalSeconds = 10)

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$CONFIG_FILE = Join-Path $ScriptRoot "config.json"
$SNMPWALK_PATH = Join-Path $ScriptRoot "SnmpWalk\SnmpWalk.exe"

# Charger la configuration
if (-not (Test-Path $CONFIG_FILE)) {
    Write-Error "Fichier config.json introuvable"
    exit 1
}

if (-not (Test-Path $SNMPWALK_PATH)) {
    Write-Error "SnmpWalk.exe introuvable a l'emplacement attendu: $SNMPWALK_PATH"
    exit 1
}

$config = Get-Content $CONFIG_FILE -Raw | ConvertFrom-Json
$API_URL = $config.apiBase
$API_KEY = $config.ingestKey
$SNMP_COMMUNITY = "public"

# Liste des switches a monitorer - vient de config.json (champ "switches"), plus de liste en dur ici
if (-not $config.switches -or $config.switches.Count -eq 0) {
    Write-Error "Aucun switch configure dans config.json (champ 'switches')"
    exit 1
}
$SWITCHES = $config.switches | ForEach-Object { @{ Name = $_.Name; IP = $_.IP } }

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
