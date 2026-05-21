#Requires -RunAsAdministrator

# Installation de Net-SNMP pour Windows
# Ce script telecharge et installe Net-SNMP pour permettre la collecte SNMP des switches

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION NET-SNMP POUR WINDOWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier si deja installe
$snmpInstalled = Get-Command snmpget -ErrorAction SilentlyContinue
if ($snmpInstalled) {
    Write-Host "[INFO] Net-SNMP est deja installe!" -ForegroundColor Green
    Write-Host "Version: $(snmpget --version 2>&1 | Select-Object -First 1)" -ForegroundColor Gray
    exit 0
}

Write-Host "[1/4] Verification de Chocolatey..." -ForegroundColor Yellow

# Verifier si Chocolatey est installe
$chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue

if (-not $chocoInstalled) {
    Write-Host "  -> Installation de Chocolatey..." -ForegroundColor Gray
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # Rafraichir les variables d'environnement
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Host "  OK Chocolatey installe" -ForegroundColor Green
} else {
    Write-Host "  OK Chocolatey deja installe" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/4] Installation de Net-SNMP via Chocolatey..." -ForegroundColor Yellow

try {
    choco install net-snmp -y
    Write-Host "  OK Net-SNMP installe avec succes" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR lors de l'installation via Chocolatey" -ForegroundColor Red
    Write-Host ""
    Write-Host "[ALTERNATIVE] Installation manuelle:" -ForegroundColor Yellow
    Write-Host "1. Telechargez Net-SNMP depuis: http://www.net-snmp.org/download.html" -ForegroundColor White
    Write-Host "2. Installez le fichier MSI telecharge" -ForegroundColor White
    Write-Host "3. Ajoutez le chemin d'installation a la variable PATH systeme" -ForegroundColor White
    Write-Host "   Exemple: C:\usr\bin" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "[3/4] Rafraichissement des variables d'environnement..." -ForegroundColor Yellow
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Write-Host "  OK Variables d'environnement actualisees" -ForegroundColor Green

Write-Host ""
Write-Host "[4/4] Verification de l'installation..." -ForegroundColor Yellow

# Verifier les commandes SNMP
$commands = @('snmpget', 'snmpwalk', 'snmpset')
$allInstalled = $true

foreach ($cmd in $commands) {
    $cmdPath = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($cmdPath) {
        Write-Host "  OK $cmd disponible: $($cmdPath.Source)" -ForegroundColor Green
    } else {
        Write-Host "  ERREUR $cmd non trouve" -ForegroundColor Red
        $allInstalled = $false
    }
}

Write-Host ""
if ($allInstalled) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  INSTALLATION REUSSIE !" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Net-SNMP est maintenant installe et pret." -ForegroundColor White
    Write-Host ""
    Write-Host "Commandes disponibles:" -ForegroundColor Cyan
    Write-Host "  - snmpget : Recuperer une valeur SNMP specifique" -ForegroundColor White
    Write-Host "  - snmpwalk : Parcourir un arbre SNMP" -ForegroundColor White
    Write-Host "  - snmpset : Definir une valeur SNMP" -ForegroundColor White
    Write-Host ""
    Write-Host "Test rapide (remplacez IP_SWITCH par une IP):" -ForegroundColor Cyan
    Write-Host "  snmpget -v2c -c public IP_SWITCH 1.3.6.1.2.1.1.1.0" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Vous pouvez maintenant relancer CollectSwitchMetrics.ps1" -ForegroundColor Yellow
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  INSTALLATION INCOMPLETE" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Certaines commandes SNMP n'ont pas ete trouvees." -ForegroundColor Yellow
    Write-Host "Essayez de redemarrer PowerShell ou le systeme." -ForegroundColor Yellow
}

Write-Host ""
