# EduOS Backend Startup Script
# Run this from the project root: .\start-backend.ps1

$ErrorActionPreference = 'Stop'

Write-Host "Loading .env file..." -ForegroundColor Cyan

# Read and export every non-comment, non-empty KEY=VALUE line from .env
Get-Content ".\.env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
        $key   = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        Set-Item -Path "Env:\$key" -Value $value
        Write-Host "  SET $key" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "DATABASE_URL = $env:DATABASE_URL" -ForegroundColor Green
Write-Host "REDIS_URL    = $env:REDIS_URL"    -ForegroundColor Green
Write-Host ""
Write-Host "Starting EduOS backend..." -ForegroundColor Cyan

cargo run --package eduos-backend
