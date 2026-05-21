#Requires -RunAsAdministrator

# Installation Net-SNMP via archive ZIP precompilee

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION NET-SNMP (METHODE ZIP)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier si deja installe
$snmpInstalled = Get-Command snmpget -ErrorAction SilentlyContinue
if ($snmpInstalled) {
    Write-Host "[INFO] Net-SNMP est deja installe!" -ForegroundColor Green
    Write-Host "Chemin: $($snmpInstalled.Source)" -ForegroundColor Gray
    exit 0
}

# Alternative: utiliser les binaires Windows pre-compiles
$installPath = "C:\Net-SNMP"
$binPath = "$installPath\bin"

Write-Host "[1/3] Creation du repertoire d'installation..." -ForegroundColor Yellow
if (-not (Test-Path $installPath)) {
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null
    Write-Host "  OK Repertoire cree: $installPath" -ForegroundColor Green
} else {
    Write-Host "  OK Repertoire existe deja" -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/3] Telechargement des binaires Windows..." -ForegroundColor Yellow

# URL alternative - binaires Net-SNMP 5.9.1 pour Windows x64
$zipUrl = "https://www.matts-tools.com/downloads/net-snmp-5.9.1-x64.zip"
$zipPath = "$env:TEMP\net-snmp.zip"

try {
    $ProgressPreference = 'SilentlyContinue'
    Write-Host "  Telechargement en cours..." -ForegroundColor Gray
    
    # Tentative de telechargement
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 300 -ErrorAction Stop
    
    Write-Host "  OK Telechargement termine" -ForegroundColor Green
    
    # Extraction
    Write-Host "  Extraction des fichiers..." -ForegroundColor Gray
    Expand-Archive -Path $zipPath -DestinationPath $installPath -Force
    
    Write-Host "  OK Extraction terminee" -ForegroundColor Green
    
} catch {
    Write-Host "  ERREUR lors du telechargement automatique" -ForegroundColor Red
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "  INSTALLATION MANUELLE REQUISE" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Methode 1 - Via navigateur:" -ForegroundColor Cyan
    Write-Host "1. Telechargez depuis:" -ForegroundColor White
    Write-Host "   https://ezfive.com/snmpsoft-tools/snmp-walk/" -ForegroundColor Gray
    Write-Host "   OU" -ForegroundColor White
    Write-Host "   https://www.paessler.com/tools/snmptester" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Extrayez dans: C:\Net-SNMP" -ForegroundColor White
    Write-Host "3. Ajoutez C:\Net-SNMP\bin au PATH systeme" -ForegroundColor White
    Write-Host ""
    Write-Host "Methode 2 - Utiliser SnmpB (alternative graphique):" -ForegroundColor Cyan
    Write-Host "1. Telechargez: https://sourceforge.net/projects/snmpb/" -ForegroundColor White
    Write-Host "2. Installez l'application" -ForegroundColor White
    Write-Host ""
    Write-Host "Methode 3 - Modifier le script PowerShell:" -ForegroundColor Cyan
    Write-Host "Le script CollectSwitchMetrics.ps1 peut fonctionner SANS Net-SNMP" -ForegroundColor White
    Write-Host "Il fera uniquement du ping et collectera les donnees basiques." -ForegroundColor White
    Write-Host ""
    
    # Nettoyage
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    }
    
    exit 1
}

Write-Host ""
Write-Host "[3/3] Configuration du PATH..." -ForegroundColor Yellow

# Trouver le dossier bin dans l'extraction
$possibleBinPaths = @(
    "$installPath\bin",
    "$installPath\usr\bin",
    "$installPath\net-snmp\bin"
)

$actualBinPath = $null
foreach ($path in $possibleBinPaths) {
    if (Test-Path "$path\snmpget.exe") {
        $actualBinPath = $path
        break
    }
}

if ($actualBinPath) {
    # Ajouter au PATH systeme
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    
    if ($currentPath -notlike "*$actualBinPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$actualBinPath", "Machine")
        Write-Host "  OK $actualBinPath ajoute au PATH" -ForegroundColor Green
    } else {
        Write-Host "  OK Deja dans le PATH" -ForegroundColor Green
    }
    
    # Rafraichir le PATH de la session courante
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Start-Sleep -Seconds 2
    
    # Verification
    Write-Host ""
    Write-Host "Verification de l'installation..." -ForegroundColor Yellow
    
    $snmpget = Get-Command snmpget -ErrorAction SilentlyContinue
    if ($snmpget) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  INSTALLATION REUSSIE !" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Net-SNMP est maintenant installe." -ForegroundColor White
        Write-Host "Chemin: $($snmpget.Source)" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "Les commandes ne sont pas encore visibles." -ForegroundColor Yellow
        Write-Host "Redemarrez PowerShell et reessayez." -ForegroundColor Yellow
    }
} else {
    Write-Host "  ERREUR Structure de fichiers inattendue" -ForegroundColor Red
    Write-Host "  Verifiez manuellement: $installPath" -ForegroundColor Yellow
}

# Nettoyage
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
}

Write-Host ""
