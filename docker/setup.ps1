$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Instala y abre Docker Desktop antes de continuar." }
docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw "Abre Docker Desktop y espera a que arranque." }
if (-not (Test-Path .env)) {
  $email = Read-Host "Tu correo para acceder a Ownly"
  if ($email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw "Correo no valido" }
  function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
  }
  $password = New-Secret
  $token = New-Secret
  @("ADMIN_EMAIL=$email", "ADMIN_PASSWORD=$password", "MARKET_COLLECTOR_TOKEN=$token", "PUBLIC_ORIGIN=http://localhost:3001") | Set-Content .env -Encoding ascii
  Write-Host "Tu contrasena de Ownly: $password"
  Write-Host "Guardala. Tambien queda en .env, que no debes compartir."
}
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw "Docker no pudo arrancar. Revisa el mensaje anterior." }
Start-Process "http://localhost:3001/admin/airbnb"
