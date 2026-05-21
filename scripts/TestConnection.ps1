# TestConnection.ps1 - Script pour tester la connexion vers API Dashboard

param(
    [string]$ApiUrl = "http://10.8.11.230:4000"
)

Write-Host ""
Write-Host "=== Test de connexion vers l'API Dashboard ===" -ForegroundColor Cyan
Write-Host "URL: $ApiUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Ping
Write-Host "[1] Test Ping vers 10.8.11.230..." -ForegroundColor Yellow
$pingOk = Test-Connection -ComputerName 10.8.11.230 -Count 2 -Quiet -ErrorAction SilentlyContinue
if ($pingOk) {
    Write-Host "  OK - Ping reussi" -ForegroundColor Green
} else {
    Write-Host "  ERREUR - Pas de reponse ping" -ForegroundColor Red
}

# Test 2: Port TCP
Write-Host ""
Write-Host "[2] Test Port TCP 4000..." -ForegroundColor Yellow
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connect = $tcpClient.BeginConnect("10.8.11.230", 4000, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(3000, $false)
    if ($wait) {
        $tcpClient.EndConnect($connect)
        $tcpClient.Close()
        Write-Host "  OK - Port 4000 accessible" -ForegroundColor Green
    } else {
        Write-Host "  ERREUR - Timeout connexion port 4000" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERREUR - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Endpoint health
Write-Host ""
Write-Host "[3] Test endpoint /health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/health" -Method GET -TimeoutSec 5
    Write-Host "  OK - API repond" -ForegroundColor Green
    Write-Host "  Response: $($health | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "  ERREUR - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Authentification
Write-Host ""
Write-Host "[4] Test authentification..." -ForegroundColor Yellow
try {
    $body = '{"identifier":"admin@semmaris.local","password":"admin123"}'
    $auth = Invoke-RestMethod -Uri "$ApiUrl/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 5
    if ($auth.token) {
        Write-Host "  OK - Token recu" -ForegroundColor Green
        Write-Host "  Token: $($auth.token.Substring(0,30))..." -ForegroundColor Gray
    } else {
        Write-Host "  ERREUR - Pas de token" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERREUR - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Fin des tests ===" -ForegroundColor Cyan
Write-Host ""
