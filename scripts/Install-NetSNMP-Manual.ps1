#Requires -RunAsAdministrator

# Installation manuelle de Net-SNMP pour Windows
# Telecharge et installe Net-SNMP depuis SourceForge

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION NET-SNMP POUR WINDOWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier si deja installe
$snmpInstalled = Get-Command snmpget -ErrorAction SilentlyContinue
if ($snmpInstalled) {
    Write-Host "[INFO] Net-SNMP est deja installe!" -ForegroundColor Green
    Write-Host "Chemin: $($snmpInstalled.Source)" -ForegroundColor Gray
    exit 0
}

$downloadUrl = "https://sourceforge.net/projects/net-snmp/files/net-snmp%20binaries/5.9.4-binaries/Net-SNMP-5.9.4-1.x64.exe/download"
$installerPath = "$env:TEMP\NetSNMP-Setup.exe"
$installPath = "C:\usr"

Write-Host "[1/4] Telechargement de Net-SNMP 5.9.4..." -ForegroundColor Yellow
Write-Host "  Source: SourceForge" -ForegroundColor Gray
Write-Host "  Destination: $installerPath" -ForegroundColor Gray

try {
    # Desactiver la barre de progression pour accelerer le telechargement
    $ProgressPreference = 'SilentlyContinue'
    
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing -TimeoutSec 300
    
    Write-Host "  OK Telechargement termine" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "[ALTERNATIVE] Telechargement manuel:" -ForegroundColor Yellow
    Write-Host "1. Allez sur: https://sourceforge.net/projects/net-snmp/files/" -ForegroundColor White
    Write-Host "2. Telechargez: Net-SNMP-5.9.4-1.x64.exe" -ForegroundColor White
    Write-Host "3. Executez le fichier et suivez l'assistant" -ForegroundColor White
    Write-Host "4. Ajoutez C:\usr\bin au PATH systeme" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "[2/4] Installation de Net-SNMP..." -ForegroundColor Yellow
Write-Host "  Chemin d'installation: $installPath" -ForegroundColor Gray

try {
    # Installation silencieuse
    $installArgs = "/S /D=$installPath"
    Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait -NoNewWindow
    
    Write-Host "  OK Installation terminee" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[3/4] Configuration du PATH..." -ForegroundColor Yellow

# Ajouter au PATH systeme
$binPath = "$installPath\bin"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

if ($currentPath -notlike "*$binPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$binPath", "Machine")
    Write-Host "  OK $binPath ajoute au PATH" -ForegroundColor Green
} else {
    Write-Host "  OK $binPath deja dans le PATH" -ForegroundColor Green
}

# Rafraichir le PATH de la session courante
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host ""
Write-Host "[4/4] Verification de l'installation..." -ForegroundColor Yellow

Start-Sleep -Seconds 2

# Verifier les commandes SNMP
$commands = @('snmpget', 'snmpwalk', 'snmpset')
$allInstalled = $true

foreach ($cmd in $commands) {
    $cmdPath = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($cmdPath) {
        Write-Host "  OK $cmd disponible" -ForegroundColor Green
    } else {
        Write-Host "  ERREUR $cmd non trouve" -ForegroundColor Red
        $allInstalled = $false
    }
}

# Nettoyage
if (Test-Path $installerPath) {
    Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
}

Write-Host ""
if ($allInstalled) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  INSTALLATION REUSSIE !" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Net-SNMP est maintenant installe." -ForegroundColor White
    Write-Host ""
    Write-Host "Commandes disponibles:" -ForegroundColor Cyan
    Write-Host "  - snmpget : Recuperer une valeur SNMP" -ForegroundColor White
    Write-Host "  - snmpwalk : Parcourir un arbre SNMP" -ForegroundColor White
    Write-Host "  - snmpset : Definir une valeur SNMP" -ForegroundColor White
    Write-Host ""
    Write-Host "Test rapide (exemple avec 10.8.11.1):" -ForegroundColor Cyan
    Write-Host "  snmpget -v2c -c public 10.8.11.1 1.3.6.1.2.1.1.1.0" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Relancez maintenant CollectSwitchMetrics.ps1" -ForegroundColor Yellow
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  INSTALLATION INCOMPLETE" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Les commandes SNMP n'ont pas ete trouvees." -ForegroundColor Yellow
    Write-Host "Redemarrez PowerShell et verifiez le PATH." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "PATH actuel:" -ForegroundColor Cyan
    Write-Host $env:Path -ForegroundColor Gray
}

Write-Host ""
