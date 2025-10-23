# 📊 Système de Monitoring de Bande Passante

## 🚀 Vue d'ensemble

Le Dashboard Semmaris intègre maintenant un système complet de monitoring de bande passante utilisant de **vraies données** au lieu de simulation.

## 🔧 Architecture

### Backend
- **Base de données** : Table `bandwidth_data` pour stocker les mesures
- **API REST** : Endpoints pour récupérer et injecter des données
- **Authentification** : Protection par JWT + clé API pour l'ingestion

### Frontend
- **Graphique temps réel** : Courbe SVG interactive avec données des 24h
- **États adaptatifs** : Loading, erreur, aucune donnée
- **Statistiques** : Min/Max/Moyenne calculées automatiquement

## 📡 API Endpoints

### GET /bandwidth
Récupère les données de bande passante
```http
GET /bandwidth?hours=24&interface=main
Authorization: Bearer <jwt_token>
```

### GET /bandwidth/stats  
Statistiques calculées (min/max/moyenne)
```http
GET /bandwidth/stats?hours=24&interface=main
Authorization: Bearer <jwt_token>
```

### POST /bandwidth/ingest
Injection de données (clé API requise)
```http
POST /bandwidth/ingest
X-API-Key: change-me-strong
Content-Type: application/json

{
  "value_mbps": 45.7,
  "interface_name": "main",
  "timestamp": "2025-10-20T14:30:00.000Z"
}
```

## 🔨 Utilisation

### 1. Monitoring automatique (PowerShell)
```powershell
# Lancer le script de monitoring
.\scripts\BandwidthMonitor.ps1 -ApiUrl "http://localhost:4000" -ApiKey "change-me-strong"

# Avec paramètres personnalisés
.\scripts\BandwidthMonitor.ps1 -ApiUrl "http://localhost:4000" -ApiKey "votre-clé" -Interface "eth0" -IntervalSeconds 30
```

### 2. Injection manuelle (curl/PowerShell)
```bash
# Exemple curl
curl -X POST http://localhost:4000/bandwidth/ingest \
  -H "X-API-Key: change-me-strong" \
  -H "Content-Type: application/json" \
  -d '{"value_mbps": 42.5}'
```

```powershell
# Exemple PowerShell
$headers = @{ "X-API-Key" = "change-me-strong"; "Content-Type" = "application/json" }
$body = '{"value_mbps": 42.5}' 
Invoke-RestMethod -Uri "http://localhost:4000/bandwidth/ingest" -Method POST -Headers $headers -Body $body
```

### 3. Intégration SNMP/Router
```powershell
# Exemple d'intégration avec routeur via SNMP
$bandwidth = Get-SNMPData -Router "192.168.1.1" -OID "1.3.6.1.2.1.2.2.1.10.1"
$mbps = ($bandwidth * 8) / 1MB
Invoke-RestMethod -Uri "$ApiUrl/bandwidth/ingest" -Method POST -Headers $headers -Body (@{value_mbps=$mbps} | ConvertTo-Json)
```

## 🛠️ Configuration

### Variables d'environnement Backend
```env
INGEST_KEY=your-strong-api-key-here
DB_PATH=./data/app.db
```

### Script PowerShell
```powershell
# Configuration dans BandwidthMonitor.ps1
$ApiUrl = "http://localhost:4000"          # URL de l'API
$ApiKey = "change-me-strong"               # Clé API (INGEST_KEY)
$Interface = "main"                        # Nom de l'interface
$IntervalSeconds = 60                      # Intervalle de mesure
```

## 📈 Fonctionnalités

### Dashboard Frontend
- ✅ **Graphique temps réel** avec courbe lissée
- ✅ **Indicateurs visuels** : 🟢 Faible / 🟡 Moyenne / 🔴 Élevée  
- ✅ **Statistiques automatiques** : Min/Max/Moyenne 24h
- ✅ **Gestion d'erreurs** avec bouton réessayer
- ✅ **État "aucune donnée"** avec instructions d'usage
- ✅ **Tooltips interactifs** sur les points de la courbe
- ✅ **Mise à jour automatique** toutes les 2 minutes

### Script PowerShell
- ✅ **Double méthode** : Get-Counter + netstat (compatibilité)
- ✅ **Détection automatique** des interfaces réseau actives
- ✅ **Gestion d'erreurs** avec redémarrage automatique
- ✅ **Logs colorés** avec statut temps réel
- ✅ **Test de connexion** API avant démarrage

## 🚨 Débogage

### Aucune donnée affichée
1. Vérifier que le backend est démarré
2. Vérifier la clé API (`INGEST_KEY`)
3. Lancer le script PowerShell manuellement
4. Consulter les logs du backend

### Erreurs d'injection
```powershell
# Test manuel d'injection
$headers = @{ "X-API-Key" = "change-me-strong"; "Content-Type" = "application/json" }
$body = '{"value_mbps": 25.0}'
Invoke-RestMethod -Uri "http://localhost:4000/bandwidth/ingest" -Method POST -Headers $headers -Body $body
```

### Vérifier les données en base
```sql
-- Dernières mesures
SELECT * FROM bandwidth_data ORDER BY timestamp DESC LIMIT 10;

-- Statistiques
SELECT 
  COUNT(*) as count,
  AVG(value_mbps) as avg,
  MIN(value_mbps) as min,
  MAX(value_mbps) as max
FROM bandwidth_data 
WHERE datetime(timestamp) >= datetime('now', '-24 hours');
```

## 📋 Exemples d'usage

### Monitoring production
```powershell
# Lancement en service Windows ou tâche planifiée
.\BandwidthMonitor.ps1 -ApiUrl "https://dashboard.semmaris.fr" -ApiKey "production-key" -IntervalSeconds 30
```

### Intégration continue
```bash
#!/bin/bash
# Script bash pour Linux/Unix
while true; do
  BANDWIDTH=$(cat /proc/net/dev | grep eth0 | awk '{print $2+$10}')
  MBPS=$(echo "scale=2; $BANDWIDTH * 8 / 1000000" | bc)
  
  curl -X POST http://localhost:4000/bandwidth/ingest \
    -H "X-API-Key: change-me-strong" \
    -H "Content-Type: application/json" \
    -d "{\"value_mbps\": $MBPS}"
  
  sleep 60
done
```

## 🔒 Sécurité

- ✅ **Clé API** pour l'ingestion (`X-API-Key`)
- ✅ **JWT requis** pour consultation des données
- ✅ **Validation** des données d'entrée
- ✅ **Limitation** par interface réseau

---

> 💡 **Conseil** : Commencez par lancer le script PowerShell pour avoir des données, puis consultez le dashboard pour voir le graphique en action !