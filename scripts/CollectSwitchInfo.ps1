# CollectSwitchInfo.ps1 - Version simplifiée temporaire
param([string]$ConfigFile = ".\config.json")

# Charger la configuration
if (-not (Test-Path $ConfigFile)) {
    Write-Error "Fichier de configuration introuvable: $ConfigFile"
    exit 1
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$apiBase = $config.apiBase
$ingestKey = $config.ingestKey

Write-Host "[INFO] Collecte SNMP des switches - Version simplifiée" -ForegroundColor Cyan
Write-Host "[INFO] API: $apiBase" -ForegroundColor Gray
Write-Host ""

# Fonction d'authentification
function Get-AuthToken {
    param($apiBase, $email, $password)
    $loginUrl = "$apiBase/auth/login"
    $loginBody = @{ identifier = $email; password = $password } | ConvertTo-Json
    try {
        $response = Invoke-RestMethod -Uri $loginUrl -Method POST -Body $loginBody -ContentType "application/json"
        return $response.token
    } catch {
        Write-Warning "Echec authentification: $_"
        return $null
    }
}

# Fonction pour récupérer les switches
function Get-SwitchesFromAPI {
    param($Token)
    try {
        $headers = @{ Authorization = "Bearer $Token" }
        $response = Invoke-RestMethod -Uri "$apiBase/equipment" -Headers $headers -Method GET
        return $response | Where-Object { $_.category -eq 'switches' }
    } catch {
        Write-Warning "Echec recuperation switches: $_"
        return @()
    }
}

# Authentification
Write-Host "[AUTH] Authentification..." -ForegroundColor Yellow
$token = Get-AuthToken -apiBase $apiBase -email $config.adminEmail -password $config.adminPassword

if (-not $token) {
    Write-Error "Impossible de s'authentifier"
    exit 1
}

Write-Host "[AUTH] OK" -ForegroundColor Green
Write-Host ""

# Récupération des switches
Write-Host "[LOAD] Récupération switches..." -ForegroundColor Yellow
$switches = Get-SwitchesFromAPI -Token $token

if ($switches.Count -eq 0) {
    Write-Warning "Aucun switch trouvé"
    exit 0
}

Write-Host "[LOAD] OK - $($switches.Count) switch(es) trouvé(s)" -ForegroundColor Green
Write-Host ""

# Pour chaque switch, tenter un ping et log
foreach ($switch in $switches) {
    Write-Host "[SWITCH] $($switch.name) - $($switch.ip)" -ForegroundColor Cyan
    
    # Test ping
    $pingTest = Test-Connection -ComputerName $switch.ip -Count 1 -Quiet -ErrorAction SilentlyContinue
    
    if ($pingTest) {
        Write-Host "  [PING] OK - Switch repond" -ForegroundColor Green
        # TODO: Implémenter collecte SNMP complète plus tard
        # Pour l'instant on envoie juste un statut basique
    } else {
        Write-Host "  [PING] FAIL - Switch ne repond pas" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "[DONE] Collecte terminée" -ForegroundColor Green
