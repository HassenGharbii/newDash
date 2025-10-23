Param(
  [string]$CsvPath = ".\scripts\equipements.csv",
  [string]$ConfigPath = ".\scripts\config.json"
)

if (!(Test-Path $ConfigPath)) { Write-Error "Config file not found: $ConfigPath"; exit 1 }
if (!(Test-Path $CsvPath)) { Write-Error "CSV file not found: $CsvPath"; exit 1 }

$config = Get-Content $ConfigPath | ConvertFrom-Json
$apiBase = $config.apiBase.TrimEnd('/')
$adminEmail = $config.adminEmail
$adminPassword = $config.adminPassword

function Invoke-JsonPost($url, $body, $headers=@{}) {
  $json = $body | ConvertTo-Json -Depth 10
  return Invoke-RestMethod -Method Post -Uri $url -Body $json -ContentType "application/json" -Headers $headers -TimeoutSec 30
}

# Login
try {
  $login = Invoke-JsonPost "$apiBase/auth/login" @{ email = $adminEmail; password = $adminPassword }
  $token = $login.token
  if (-not $token) { throw "No token returned" }
} catch {
  Write-Error "Login failed: $_"; exit 1
}
$authHeader = @{ Authorization = "Bearer $token" }

# Lire CSV (en-tête: name,type,ip,vendor,model,location)
$rows = Import-Csv -Path $CsvPath
$allowed = @('Camera','Switch','Server','PC')

$items = @()
foreach ($r in $rows) {
  $type = $r.type
  if ($allowed -notcontains $type) {
    # normalisation basique
    $t = ($type+"").ToLower()
    switch -Regex ($t) {
      '^serv' { $type = 'Server'; break }
      '^sw'   { $type = 'Switch'; break }
      '^cam'  { $type = 'Camera'; break }
      '^pc$'  { $type = 'PC'; break }
      default { $type = 'PC' }
    }
  }
  $items += @{
    name = $r.name
    type = $type
    ip = $r.ip
    vendor = $r.vendor
    model = $r.model
    location = $r.location
  }
}

try {
  $resp = Invoke-JsonPost "$apiBase/equipment/bulk" @{ items = $items } $authHeader
  Write-Host "Bulk insert -> inserted: $($resp.inserted) / total: $($resp.total)"
  if ($resp.errors -and $resp.errors.Count -gt 0) {
    Write-Warning ("Errors:`n" + ($resp.errors | ConvertTo-Json -Depth 5))
  }
} catch {
  Write-Error "Bulk insert failed: $_"
  exit 1
}
