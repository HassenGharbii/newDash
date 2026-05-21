#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Configure le routage pour acceder simultanement a Internet et au reseau local des switches
.DESCRIPTION
    Ajoute une route statique pour que le trafic vers 172.16.5.0/24 passe par l'interface locale
#>

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Configuration Routage - Switches" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Verifier si la route existe deja
$existingRoute = Get-NetRoute -DestinationPrefix "172.16.5.0/24" -ErrorAction SilentlyContinue

if ($existingRoute) {
    Write-Host "[INFO] Route vers 172.16.5.0/24 existe deja:" -ForegroundColor Yellow
    $existingRoute | Select-Object DestinationPrefix, NextHop, InterfaceAlias, RouteMetric | Format-Table
    
    $response = Read-Host "Voulez-vous la supprimer et la recreer? (O/N)"
    if ($response -eq 'O' -or $response -eq 'o') {
        Write-Host "[ACTION] Suppression de la route existante..." -ForegroundColor Yellow
        Remove-NetRoute -DestinationPrefix "172.16.5.0/24" -Confirm:$false
    } else {
        Write-Host "[INFO] Conservation de la route existante" -ForegroundColor Green
        exit 0
    }
}

# Ajouter la nouvelle route
Write-Host "[ACTION] Ajout de la route vers 172.16.5.0/24..." -ForegroundColor Cyan

try {
    # Methode 1: Avec New-NetRoute (Windows 8+)
    try {
        New-NetRoute -DestinationPrefix "172.16.5.0/24" `
                     -InterfaceAlias "Embedded LOM 1 Port 1" `
                     -NextHop "10.8.11.254" `
                     -RouteMetric 1 `
                     -ErrorAction Stop
        
        Write-Host "[OK] Route ajoutee avec New-NetRoute!" -ForegroundColor Green
    } catch {
        # Methode 2: Avec route add (compatible toutes versions)
        Write-Host "[INFO] New-NetRoute echoue, utilisation de route add..." -ForegroundColor Yellow
        
        $ifIndex = (Get-NetAdapter -InterfaceAlias "Embedded LOM 1 Port 1").ifIndex
        $routeCmd = "route add 172.16.5.0 mask 255.255.255.0 10.8.11.254 metric 1 if $ifIndex"
        
        $result = Invoke-Expression $routeCmd 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Route ajoutee avec route add!" -ForegroundColor Green
            
            # Rendre la route persistante
            $persistCmd = "route add 172.16.5.0 mask 255.255.255.0 10.8.11.254 metric 1 if $ifIndex -p"
            Invoke-Expression $persistCmd 2>&1 | Out-Null
            Write-Host "[INFO] Route rendue persistante" -ForegroundColor Green
        } else {
            throw "Echec de route add: $result"
        }
    }
    
    Write-Host "[OK] Route ajoutee avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Cyan
    Write-Host "  - Destination: 172.16.5.0/24 (switches)" -ForegroundColor Gray
    Write-Host "  - Interface: Embedded LOM 1 Port 1 (10.8.11.230)" -ForegroundColor Gray
    Write-Host "  - Passerelle: 10.8.11.254" -ForegroundColor Gray
    Write-Host "  - Metrique: 1" -ForegroundColor Gray
    Write-Host "  - Persistante: Oui (survit au redemarrage)" -ForegroundColor Gray
    Write-Host ""
    
    # Tester la connectivite
    Write-Host "[TEST] Test de connectivite vers 172.16.5.10..." -ForegroundColor Cyan
    $pingResult = Test-Connection -ComputerName 172.16.5.10 -Count 2 -Quiet
    
    if ($pingResult) {
        Write-Host "[OK] Switch 172.16.5.10 joignable!" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Switch 172.16.5.10 non joignable (normal si aucun switch a cette IP)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Vous pouvez maintenant executer BandwidthCollector.ps1" -ForegroundColor Green
    
} catch {
    Write-Host "[ERROR] Echec de l'ajout de la route: $_" -ForegroundColor Red
    exit 1
}
