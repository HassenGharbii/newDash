<#
.SYNOPSIS
    Surveille l'etat des equipements et envoie des alertes (webhook) en cas de panne persistante.

.DESCRIPTION
    Interroge periodiquement GET /equipment, suit un compteur de pannes consecutives par
    equipement (debounce via config.json:debounceCount), declenche une alerte au-dela du
    seuil configure, et notifie la reprise de service. Envoie egalement un heartbeat
    periodique si config.json:heartbeatSeconds > 0.

    Si config.json:webhookUrl est vide, les alertes sont simplement journalisees localement
    (aucune erreur, fonctionnement degrade gracieux).

.EXEMPLE
    .\AlertManager.ps1
#>

param(
    [string]$ConfigPath = $(Join-Path $PSScriptRoot "config.json"),
    [string]$StatePath  = $(Join-Path $PSScriptRoot "alert-state.json")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function Write-Log {
    param([string]$Level = "INFO", [string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts][$Level] $Message"
}

if (-not (Test-Path $ConfigPath)) {
    Write-Log "ERROR" "Fichier de configuration introuvable: $ConfigPath"
    exit 1
}
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

$apiBase             = $config.apiBase
$adminEmail          = $config.adminEmail
$adminPassword       = $config.adminPassword
$pollIntervalSeconds = if ($config.pollIntervalSeconds -gt 0) { $config.pollIntervalSeconds } else { 60 }
$debounceCount       = if ($config.debounceCount -gt 0) { $config.debounceCount } else { 1 }
$heartbeatSeconds    = if ($config.PSObject.Properties.Name -contains 'heartbeatSeconds') { $config.heartbeatSeconds } else { 0 }
$webhookUrl          = if ($config.PSObject.Properties.Name -contains 'webhookUrl') { $config.webhookUrl } else { "" }

if (-not $webhookUrl) {
    Write-Log "WARN" "webhookUrl non configure dans config.json - les alertes seront seulement journalisees localement."
}

function Get-AuthToken {
    try {
        $body = @{ identifier = $adminEmail; password = $adminPassword } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
        return $response.token
    } catch {
        Write-Log "ERROR" "Authentification echouee: $_"
        return $null
    }
}

function Get-AllEquipment {
    param([string]$Token)
    try {
        $headers = @{ Authorization = "Bearer $Token" }
        return Invoke-RestMethod -Uri "$apiBase/equipment" -Method GET -Headers $headers -ErrorAction Stop
    } catch {
        Write-Log "ERROR" "Recuperation des equipements echouee: $_"
        return @()
    }
}

function Load-State {
    if (Test-Path $StatePath) {
        try { return Get-Content $StatePath -Raw | ConvertFrom-Json } catch { return $null }
    }
    return $null
}

function Save-State {
    param($State)
    $State | ConvertTo-Json -Depth 5 | Set-Content -Path $StatePath -Encoding UTF8
}

function Send-Webhook {
    param([string]$Text, [int]$MaxRetries = 3)

    if (-not $webhookUrl) {
        Write-Log "INFO" "[ALERTE - webhook non configure] $Text"
        return
    }

    $body = @{ text = $Text } | ConvertTo-Json
    for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
        try {
            Invoke-RestMethod -Uri $webhookUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10 -ErrorAction Stop | Out-Null
            return
        } catch {
            Write-Log "WARN" "Envoi webhook echoue (tentative $attempt/$MaxRetries): $_"
            if ($attempt -lt $MaxRetries) { Start-Sleep -Seconds (2 * $attempt) }
        }
    }
    Write-Log "ERROR" "Envoi webhook abandonne apres $MaxRetries tentatives: $Text"
}

Write-Log "INFO" "=== Demarrage AlertManager ==="
Write-Log "INFO" "API: $apiBase | Intervalle: ${pollIntervalSeconds}s | Seuil debounce: $debounceCount panne(s) consecutive(s)"

$token = Get-AuthToken
$lastHeartbeat = Get-Date

while ($true) {
    if (-not $token) {
        $token = Get-AuthToken
        if (-not $token) {
            Start-Sleep -Seconds $pollIntervalSeconds
            continue
        }
    }

    $equipmentList = @(Get-AllEquipment -Token $token)
    if ($equipmentList.Count -eq 0) {
        Start-Sleep -Seconds $pollIntervalSeconds
        continue
    }

    $rawState = Load-State
    $stateHash = @{}
    if ($rawState) {
        foreach ($prop in $rawState.PSObject.Properties) { $stateHash[$prop.Name] = $prop.Value }
    }

    foreach ($equip in $equipmentList) {
        $key = "$($equip.id)"
        $isUp = ($equip.ping_status -eq 'UP')

        if (-not $stateHash.ContainsKey($key)) {
            $stateHash[$key] = @{ consecutiveDown = 0; alerting = $false }
        }
        $entry = $stateHash[$key]

        if ($isUp) {
            if ($entry.alerting) {
                Send-Webhook "RETABLI: $($equip.name) ($($equip.ip)) est de nouveau UP."
                Write-Log "INFO" "Reprise: $($equip.name)"
            }
            $entry.consecutiveDown = 0
            $entry.alerting = $false
        } else {
            $entry.consecutiveDown++
            if ($entry.consecutiveDown -ge $debounceCount -and -not $entry.alerting) {
                Send-Webhook "ALERTE: $($equip.name) ($($equip.ip)) est DOWN depuis $($entry.consecutiveDown) controle(s)."
                Write-Log "WARN" "Alerte declenchee: $($equip.name)"
                $entry.alerting = $true
            }
        }

        $stateHash[$key] = $entry
    }

    Save-State -State $stateHash

    if ($heartbeatSeconds -gt 0 -and ((Get-Date) - $lastHeartbeat).TotalSeconds -ge $heartbeatSeconds) {
        Send-Webhook "Heartbeat AlertManager - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $($equipmentList.Count) equipements surveilles."
        $lastHeartbeat = Get-Date
    }

    Start-Sleep -Seconds $pollIntervalSeconds
}
