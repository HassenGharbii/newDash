# 📊 GUIDE COMPLET - MONITORING EN PRODUCTION

Ce guide explique comment les scripts de collecte s'intègrent avec le dashboard.

---

## 🎯 **VUE D'ENSEMBLE**

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUX DE DONNÉES                              │
└─────────────────────────────────────────────────────────────────┘

1. SCRIPTS POWERSHELL (Collecte)
   ├── PingEquipment.ps1       → Ping tous les équipements
   ├── CollectServerInfo.ps1   → WMI/SSH → Serveurs Windows/Linux
   └── CollectSwitchInfo.ps1   → SNMP → Switches réseau

                    ↓ (HTTP POST avec X-Ingest-Key)

2. BACKEND API (Endpoints d'ingestion)
   ├── POST /ingest/ping       → Statut ping + latence
   ├── POST /ingest/server     → Métriques serveur complètes
   └── POST /ingest/switch     → Métriques switch + ports

                    ↓ (Stockage dans SQLite)

3. BASE DE DONNÉES
   └── equipment.info_json     → Stockage JSON des métriques

                    ↓ (HTTP GET)

4. FRONTEND (Affichage)
   ├── GET /metrics/server/:id → Page Serveurs
   └── GET /metrics/switch/:id → Page Switches
```

---

## 📋 **STRUCTURE DES DONNÉES**

### **1. SERVEURS**

#### **A. Données collectées par `CollectServerInfo.ps1`**

```json
{
  "equipment_id": 123,
  "hostname": "SRV-DC-01",
  "ip": "192.168.1.10",
  "os_name": "Windows Server 2022",
  "os_version": "10.0.20348",
  "cpu_model": "Intel Xeon E5-2690",
  "cpu_cores": 8,
  "cpu_usage_percent": 45.2,
  "memory_total_gb": 64,
  "memory_used_gb": 32.5,
  "memory_usage_percent": 50.78,
  "uptime_hours": 720.5,
  "temperature_celsius": 52,
  "disks": [
    {
      "letter": "C:",
      "total_gb": 500,
      "used_gb": 320,
      "free_gb": 180,
      "usage_percent": 64
    }
  ],
  "services_count": 142,
  "status": "online",
  "last_check": "2025-11-17T14:30:00Z"
}
```

#### **B. Stockage dans `equipment.info_json`**

```json
{
  "hostname": "SRV-DC-01",
  "os_name": "Windows Server 2022",
  "os_version": "10.0.20348",
  "uptime_hours": 720.5,
  "last_check": "2025-11-17 14:30:00",
  "cpu": {
    "model": "Intel Xeon E5-2690",
    "cores": 8,
    "usage": 45.2,
    "temperature": 52
  },
  "memory": {
    "total_gb": 64,
    "used_gb": 32.5,
    "usage_percent": 50.78
  },
  "disks": [...],
  "gpu": {
    "usage": 0,
    "temperature": 0,
    "memory": 0
  },
  "power": {
    "voltage": 230,
    "current": 2.5,
    "status": "normal"
  },
  "bandwidth": {
    "current": 0,
    "max": 1000
  },
  "services_count": 142
}
```

#### **C. Frontend affiche (`Servers.jsx`)**

```jsx
// Utilise GET /metrics/server/:id qui retourne :
{
  server_id: 123,
  server_name: "SRV-DC-01",
  ip_address: "192.168.1.10",
  cpu: { usage: 45.2, temperature: 52, cores: 8 },
  memory: { total_gb: 64, used_gb: 32.5, usage_percent: 50.78 },
  gpu: { usage: 0, temperature: 0, memory: 0 },
  power: { voltage: 230, current: 2.5, status: "normal" },
  bandwidth: { current: 0, max: 1000 },
  network_cards: [
    { id: "nic_123_0", name: "Ethernet 1", status: "up", interface: "eth0" },
    { id: "nic_123_1", name: "Ethernet 2", status: "up", interface: "eth1" }
  ]
}
```

---

### **2. SWITCHES**

#### **A. Données collectées par `CollectSwitchInfo.ps1`**

```json
{
  "equipment_id": 456,
  "ip": "192.168.1.1",
  "hostname": "SW-CORE-01",
  "description": "Cisco IOS Software, C3850 Software",
  "vendor": "cisco",
  "uptime_hours": 1440.0,
  "cpu_usage_percent": 15,
  "memory_total_mb": 4096,
  "memory_used_mb": 2048,
  "memory_usage_percent": 50,
  "temperature_celsius": 42,
  "interface_count": 48,
  "ports_up": 32,
  "ports_down": 16,
  "interfaces": [
    {
      "index": 1,
      "name": "GigabitEthernet1/0/1",
      "status": "up",
      "speed_mbps": 1000,
      "in_octets": 123456789,
      "out_octets": 987654321
    },
    ...
  ],
  "status": "online",
  "last_check": "2025-11-17T14:30:00Z"
}
```

#### **B. Stockage dans `equipment.info_json`**

```json
{
  "hostname": "SW-CORE-01",
  "description": "Cisco IOS Software, C3850 Software",
  "vendor": "cisco",
  "uptime_hours": 1440.0,
  "last_check": "2025-11-17 14:30:00",
  "cpu": {
    "usage": 15,
    "temperature": 42
  },
  "memory": {
    "total_mb": 4096,
    "used_mb": 2048,
    "usage_percent": 50
  },
  "power": {
    "voltage": 48,
    "current": 15,
    "status": "normal"
  },
  "bandwidth": {
    "current": 0,
    "max": 48000
  },
  "ports": [
    {
      "id": "port_456_1",
      "name": "GigabitEthernet1/0/1",
      "status": "up",
      "speed": "1000 Mbps",
      "type": "Ethernet",
      "bandwidth_usage": 25,
      "current_bandwidth": 250,
      "max_bandwidth": 1000,
      "connected_device": null
    },
    ...
  ],
  "interface_count": 48,
  "ports_up": 32,
  "ports_down": 16
}
```

#### **C. Frontend affiche (`Switches.jsx`)**

```jsx
// Utilise GET /metrics/switch/:id qui retourne :
{
  switch_id: 456,
  switch_name: "SW-CORE-01",
  ip_address: "192.168.1.1",
  cpu: { usage: 15, temperature: 42 },
  memory: { total_mb: 4096, used_mb: 2048, usage_percent: 50 },
  power: { voltage: 48, current: 15, status: "normal" },
  bandwidth: { current: 0, max: 48000 },
  ports: [
    { id: "port_456_1", name: "GigabitEthernet1/0/1", status: "up", ... },
    ...
  ],
  ports_up: 32,
  ports_down: 16
}
```

---

## 🔧 **CONFIGURATION REQUISE**

### **1. Fichier `scripts/config.json`**

```json
{
  "apiBase": "http://localhost:4000",
  "adminEmail": "admin@semmaris.local",
  "adminPassword": "admin123",
  "ingestKey": "VOTRE_CLE_INGEST_ICI",
  "timeoutMs": 2000,
  "count": 1
}
```

### **2. Fichier `backend/.env`**

```env
PORT=4000
JWT_SECRET=votre_secret_jwt_64_caracteres
DB_PATH=./data/app.db
INGEST_KEY=MEME_CLE_QUE_CONFIG_JSON
```

### **3. Équipements dans la base de données**

Chaque équipement doit avoir :
- **Serveurs Windows** : `ip`, `type=Server`, `os_type=windows`
- **Serveurs Linux** : `ip`, `type=Server`, `os_type=linux`, `ssh_username`, `ssh_password`
- **Switches** : `ip`, `type=Switch`, `snmp_community` (ex: "public")

---

## 🚀 **COMMANDES DE DÉPLOIEMENT**

### **Étape 1 : Démarrer le backend**

```powershell
cd C:\inetpub\Magnetoo-Semmaris
docker compose up -d
```

### **Étape 2 : Ajouter les équipements**

```powershell
# Via CSV
@"
name,ip,category,model,location,os_type,snmp_community,ssh_username,ssh_password
SRV-DC-01,192.168.1.10,servers,Dell R740,Datacenter,windows,,,
SRV-WEB-01,192.168.1.12,servers,HP DL380,DMZ,linux,,root,password123
SW-CORE-01,192.168.1.1,switches,Cisco 3850,Salle réseau,,public,,
"@ | Out-File -FilePath .\scripts\equipements.csv -Encoding UTF8

.\scripts\AddEquipmentFromCsv.ps1
```

### **Étape 3 : Tester les scripts manuellement**

```powershell
# Test ping
.\scripts\PingEquipment.ps1

# Test collecte serveurs
.\scripts\CollectServerInfo.ps1

# Test collecte switches
.\scripts\CollectSwitchInfo.ps1
```

### **Étape 4 : Démarrer le monitoring automatique**

```powershell
# Mode production continu (cycle toutes les 5 minutes)
.\scripts\ProductionMonitoring.ps1 -IntervalMinutes 5
```

### **Étape 5 : Automatiser avec tâches planifiées**

```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\inetpub\Magnetoo-Semmaris\scripts\ProductionMonitoring.ps1 -RunOnce"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" `
    -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "Dashboard Monitoring" `
    -Action $action -Trigger $trigger -Principal $principal
```

---

## ✅ **VÉRIFICATION**

### **1. Vérifier que les données sont collectées**

```powershell
# Voir les logs
Get-Content ".\logs\monitoring_$(Get-Date -Format 'yyyyMMdd').log" -Tail 50

# Vérifier la base de données
sqlite3 .\backend\data\app.db "SELECT name, type, ping_status, last_info_at FROM equipment;"
```

### **2. Vérifier via l'API**

```powershell
# Tester l'endpoint serveur
Invoke-RestMethod -Uri "http://localhost:4000/metrics/server/1" `
    -Headers @{ Authorization = "Bearer VOTRE_TOKEN" }

# Tester l'endpoint switch
Invoke-RestMethod -Uri "http://localhost:4000/metrics/switch/2" `
    -Headers @{ Authorization = "Bearer VOTRE_TOKEN" }
```

### **3. Vérifier via le frontend**

1. Ouvrir http://localhost:5173
2. Se connecter avec `admin@semmaris.local` / `admin123`
3. Aller sur "Serveurs" → Les métriques doivent s'afficher
4. Aller sur "Switches" → Les ports doivent s'afficher

---

## 🐛 **DÉPANNAGE**

### **Problème : Aucune donnée ne s'affiche**

```powershell
# 1. Vérifier que le backend tourne
docker compose ps

# 2. Vérifier les logs backend
docker compose logs -f api

# 3. Vérifier que les équipements existent
Invoke-RestMethod -Uri "http://localhost:4000/equipment" `
    -Headers @{ Authorization = "Bearer VOTRE_TOKEN" }

# 4. Tester l'ingest manuellement
$headers = @{ "X-Ingest-Key" = "VOTRE_INGEST_KEY" }
$body = @{
    ip = "192.168.1.10"
    status = "UP"
    latency_ms = 5
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/ingest/ping" `
    -Method POST -Headers $headers -Body $body -ContentType "application/json"
```

### **Problème : Erreur SNMP**

```powershell
# Installer les outils SNMP
# Télécharger Net-SNMP depuis : http://www.net-snmp.org/download.html
# Ou utiliser Posh-SNMP
Install-Module -Name Posh-SNMP -Force
```

### **Problème : Erreur SSH**

```powershell
# Installer Posh-SSH
Install-Module -Name Posh-SSH -Force
Import-Module Posh-SSH
```

---

## 📝 **RÉSUMÉ**

✅ **Les scripts sont maintenant 100% adaptés** aux pages Serveurs et Switches

✅ **Le flux complet** : Scripts PowerShell → API Backend → Base de données → Frontend

✅ **Les données réelles** sont collectées via WMI (Windows), SSH (Linux), et SNMP (Switches)

✅ **L'automatisation** est configurée avec des tâches planifiées Windows

✅ **Le monitoring** fonctionne en production avec collecte toutes les 5 minutes

---

## 📞 **SUPPORT**

En cas de problème :
1. Vérifier les logs dans `.\logs\monitoring_YYYYMMDD.log`
2. Vérifier les logs Docker avec `docker compose logs -f`
3. Tester les endpoints API manuellement avec PowerShell
4. Vérifier que les credentials (SSH, SNMP) sont corrects dans la base de données
