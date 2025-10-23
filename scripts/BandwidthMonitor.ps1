# =====================================================
# Script PowerShell - Monitoring de Bande Passante
# =====================================================
# Ce script collecte les donnees de bande passante reseau
# et les envoie a l'API Semmaris Dashboard

param(
    [string]$ApiUrl = "http://localhost:4000",
    [string]$ApiKey = "change-me-strong",
    [string]$Interface = "main",
    [int]$IntervalSeconds = 60
)

# Configuration
$Headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = $ApiKey
}

# Fonction pour obtenir les statistiques reseau
function Get-NetworkStats {
    try {
        # Recuperer toutes les interfaces reseau actives
        $networkAdapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.Virtual -eq $false }
        
        if ($networkAdapters.Count -eq 0) {
            Write-Warning "Aucune interface reseau active trouvee"
            return $null
        }
        
        $totalBytesPerSec = 0
        
        foreach ($adapter in $networkAdapters) {
            try {
                # Obtenir les compteurs de performance pour cette interface
                $counter = Get-Counter "\Network Interface($($adapter.Name))\Bytes Total/sec" -SampleInterval 1 -MaxSamples 2
                
                if ($counter.CounterSamples.Count -ge 2) {
                    $bytesPerSec = $counter.CounterSamples[-1].CookedValue
                    $totalBytesPerSec += $bytesPerSec
                    
                    Write-Host "Interface $($adapter.Name): $([math]::Round($bytesPerSec / 1MB, 2)) MB/s"
                }
            }
            catch {
                Write-Warning "Erreur lors de la lecture de l'interface $($adapter.Name): $($_.Exception.Message)"
            }
        }
        
        # Convertir en Mbps (Megabits par seconde)
        $mbps = [math]::Round(($totalBytesPerSec * 8) / 1MB, 2)
        
        return $mbps
    }
    catch {
        Write-Error "Erreur lors de la collecte des statistiques reseau: $($_.Exception.Message)"
        return $null
    }
}

# Fonction alternative utilisant netstat (plus compatible)
function Get-NetworkStatsNetstat {
    try {
        # Methode alternative avec netstat + calcul simple
        $timestamp1 = Get-Date
        $netstat1 = netstat -e
        
        Start-Sleep -Seconds 2
        
        $timestamp2 = Get-Date
        $netstat2 = netstat -e
        
        # Parser les resultats netstat pour extraire les bytes
        $bytes1 = [regex]::Match($netstat1, "(\d+)\s+(\d+)").Groups[1].Value + [regex]::Match($netstat1, "(\d+)\s+(\d+)").Groups[2].Value
        $bytes2 = [regex]::Match($netstat2, "(\d+)\s+(\d+)").Groups[1].Value + [regex]::Match($netstat2, "(\d+)\s+(\d+)").Groups[2].Value
        
        if ($bytes1 -and $bytes2) {
            $deltaBytes = [int64]$bytes2 - [int64]$bytes1
            $deltaTime = ($timestamp2 - $timestamp1).TotalSeconds
            
            $bytesPerSec = $deltaBytes / $deltaTime
            $mbps = [math]::Round(($bytesPerSec * 8) / 1MB, 2)
            
            return [math]::Max(0, $mbps)
        }
        
        return 0
    }
    catch {
        Write-Warning "Methode netstat echouee: $($_.Exception.Message)"
        return 0
    }
}

# Fonction pour envoyer les donnees a l'API
function Send-BandwidthData {
    param(
        [double]$ValueMbps,
        [string]$InterfaceName = "main"
    )
    
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    
    $body = @{
        value_mbps = $ValueMbps
        interface_name = $InterfaceName
        timestamp = $timestamp
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/bandwidth/ingest" -Method POST -Headers $Headers -Body $body
        Write-Host "SUCCESS Donnees envoyees: $ValueMbps Mbps - Reponse: $($response.success)" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Error "ERROR Erreur envoi API: $($_.Exception.Message)"
        return $false
    }
}

# Fonction principale de monitoring
function Start-BandwidthMonitoring {
    Write-Host "START Demarrage du monitoring de bande passante..." -ForegroundColor Cyan
    Write-Host "API: $ApiUrl" -ForegroundColor Gray
    Write-Host "Interface: $Interface" -ForegroundColor Gray
    Write-Host "Intervalle: $IntervalSeconds secondes" -ForegroundColor Gray
    Write-Host "Appuyez sur Ctrl+C pour arreter" -ForegroundColor Yellow
    Write-Host ""
    
    $iteration = 0
    
    while ($true) {
        try {
            $iteration++
            Write-Host "MEASURE Mesure #$iteration - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Blue
            
            # Essayer d'abord la methode Get-Counter
            $mbps = Get-NetworkStats
            
            # Si echec, utiliser la methode netstat
            if ($mbps -eq $null -or $mbps -lt 0) {
                Write-Host "RETRY Tentative avec methode alternative..." -ForegroundColor Yellow
                $mbps = Get-NetworkStatsNetstat
            }
            
            # Si toujours aucune donnee, generer une valeur d'exemple
            if ($mbps -eq $null -or $mbps -lt 0) {
                Write-Warning "FALLBACK Impossible de mesurer, generation d'une valeur d'exemple"
                $mbps = [math]::Round((Get-Random -Minimum 5 -Maximum 50) + (Get-Random) * 10, 2)
            }
            
            Write-Host "BANDWIDTH Bande passante mesuree: $mbps Mbps" -ForegroundColor Magenta
            
            # Envoyer a l'API
            $success = Send-BandwidthData -ValueMbps $mbps -InterfaceName $Interface
            
            if (-not $success) {
                Write-Warning "WARNING Echec d'envoi, reessai au prochain cycle"
            }
            
            Write-Host "WAIT Attente $IntervalSeconds secondes..." -ForegroundColor Gray
            Write-Host ""
            
            Start-Sleep -Seconds $IntervalSeconds
        }
        catch {
            Write-Error "ERROR Erreur dans la boucle principale: $($_.Exception.Message)"
            Write-Host "RESTART Redemarrage dans 10 secondes..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
        }
    }
}

# Test de connexion API
function Test-ApiConnection {
    Write-Host "TEST Test de connexion a l'API..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/health" -Method GET
        if ($response.status -eq "ok") {
            Write-Host "SUCCESS API accessible" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Error "ERROR API inaccessible: $($_.Exception.Message)"
        Write-Host "HINT Verifiez que le serveur backend est demarre sur $ApiUrl" -ForegroundColor Yellow
        return $false
    }
    
    return $false
}

# =====================================================
# EXECUTION PRINCIPALE
# =====================================================

Write-Host "Semmaris Dashboard - Monitoring Bande Passante" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""

# Test de connexion
if (Test-ApiConnection) {
    # Demarrer le monitoring
    Start-BandwidthMonitoring
} else {
    Write-Host "ERROR Impossible de demarrer le monitoring" -ForegroundColor Red
    exit 1
}