# Docker Manager Script pour Dashboard Semmaris
param(
    [string]$Action = "restart",
    [switch]$Build = $false
)

Write-Host "Docker Dashboard Semmaris - Gestion" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

switch ($Action.ToLower()) {
    "start" {
        Write-Host "Demarrage des conteneurs..." -ForegroundColor Cyan
        if ($Build) {
            docker compose up -d --build
        } else {
            docker compose up -d
        }
    }
    
    "stop" {
        Write-Host "Arret des conteneurs..." -ForegroundColor Yellow
        docker compose down
    }
    
    "restart" {
        Write-Host "Redemarrage des conteneurs..." -ForegroundColor Cyan
        docker compose down
        if ($Build) {
            Write-Host "Reconstruction des images..." -ForegroundColor Blue
            docker compose up -d --build
        } else {
            docker compose up -d
        }
    }
    
    "rebuild" {
        Write-Host "Reconstruction complete..." -ForegroundColor Blue
        docker compose down
        docker compose build --no-cache
        docker compose up -d
    }
    
    "logs" {
        Write-Host "Affichage des logs..." -ForegroundColor Cyan
        docker compose logs -f
    }
    
    "status" {
        Write-Host "Etat des conteneurs:" -ForegroundColor Cyan
        docker compose ps
    }
    
    default {
        Write-Host "Usage: .\scripts\DockerManager.ps1 [Action] [Options]" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Actions disponibles:" -ForegroundColor White
        Write-Host "  start     - Demarre les conteneurs" -ForegroundColor Gray
        Write-Host "  stop      - Arrete les conteneurs" -ForegroundColor Gray
        Write-Host "  restart   - Redemarre les conteneurs" -ForegroundColor Gray
        Write-Host "  rebuild   - Reconstruction complete" -ForegroundColor Gray
        Write-Host "  logs      - Affiche les logs en temps reel" -ForegroundColor Gray
        Write-Host "  status    - Affiche l'etat des conteneurs" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Options:" -ForegroundColor White
        Write-Host "  -Build    - Force la reconstruction des images" -ForegroundColor Gray
        exit
    }
}

Write-Host ""
Write-Host "Operation terminee!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "API: http://localhost:4000" -ForegroundColor Cyan