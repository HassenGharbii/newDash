# 🎯 GUIDE RAPIDE - DASHBOARD SEMMARIS PRODUCTION

**Version** : Production v1.0  
**Date** : 17 novembre 2025  
**Statut** : ✅ Production Ready

---

## 📚 **DOCUMENTATION DISPONIBLE**

### **1. Pour commencer**
- 📘 `README.md` - Vue d'ensemble du projet
- 📘 `NETTOYAGE-TERMINE.md` - ⭐ **À LIRE EN PREMIER** - Résumé du nettoyage
- 📘 `SCRIPTS-PRODUCTION.md` - Liste détaillée de tous les scripts

### **2. Documentation technique**
- 📘 `ANALYSE-COMPATIBILITE-SCRIPTS.md` - Analyse technique complète
- 📘 `PRODUCTION-MONITORING-GUIDE.md` - Guide de monitoring détaillé
- 📘 `REAJUSTEMENTS.md` - Historique des modifications

### **3. Guides spécifiques**
- 📘 `DESIGN_GUIDE.md` - Guide du design de l'interface
- 📘 `BANDWIDTH.md` - Guide de la gestion de la bande passante

---

## 🚀 **DÉMARRAGE EN 5 ÉTAPES**

### **Étape 1 : Configuration initiale**
```powershell
# Exécuter le script de setup
.\scripts\Setup.ps1
```

### **Étape 2 : Démarrer Docker**
```powershell
# Démarrer les conteneurs
.\scripts\DockerManager.ps1 start -Build

# Vérifier que tout fonctionne
.\scripts\DockerManager.ps1 status
```

### **Étape 3 : Ajouter vos équipements**
```powershell
# Éditer le fichier CSV avec VOS équipements
notepad .\scripts\equipements.csv

# Format CSV :
# name,ip,category,model,location,os_type,snmp_community,ssh_username,ssh_password
# SRV-DC-01,192.168.1.10,servers,Dell R740,Datacenter,windows,,,
# SW-CORE-01,192.168.1.1,switches,Cisco 3850,Salle réseau,,public,,

# Importer les équipements
.\scripts\AddEquipmentFromCsv.ps1
```

### **Étape 4 : Tester la collecte**
```powershell
# Test de collecte unique
.\scripts\ProductionMonitoring.ps1 -RunOnce

# Vérifier les logs
Get-Content ".\logs\monitoring_$(Get-Date -Format 'yyyyMMdd').log" -Tail 20
```

### **Étape 5 : Automatiser**
```powershell
# Créer une tâche planifiée (toutes les 5 minutes)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File $PWD\scripts\ProductionMonitoring.ps1 -RunOnce"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" `
    -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "Dashboard Monitoring" `
    -Action $action -Trigger $trigger -Principal $principal
```

---

## 📋 **SCRIPTS ESSENTIELS**

### **Monitoring (Collecte réelle)**
```powershell
# Ping tous les équipements
.\scripts\PingEquipment.ps1

# Collecter métriques serveurs (WMI/SSH)
.\scripts\CollectServerInfo.ps1

# Collecter métriques switches (SNMP)
.\scripts\CollectSwitchInfo.ps1

# Orchestrateur complet (exécute tous les scripts)
.\scripts\ProductionMonitoring.ps1 -RunOnce
```

### **Gestion Docker**
```powershell
# Démarrer
.\scripts\DockerManager.ps1 start

# Redémarrer avec rebuild
.\scripts\DockerManager.ps1 restart -Build

# Voir les logs
.\scripts\DockerManager.ps1 logs

# Arrêter
.\scripts\DockerManager.ps1 stop
```

### **Sauvegardes**
```powershell
# Créer un backup
.\scripts\BackupManager.ps1 backup

# Lister les backups
.\scripts\BackupManager.ps1 list

# Restaurer
.\scripts\BackupManager.ps1 restore -BackupName "nom_backup"
```

### **Base de données**
```powershell
# Vérifier la base
.\scripts\DatabaseCheck.ps1 info

# Ajouter des équipements depuis CSV
.\scripts\AddEquipmentFromCsv.ps1
```

---

## ⚠️ **IMPORTANT - CHANGEMENTS RÉCENTS**

### **✅ Ce qui a été fait (17/11/2025)**
- ✅ Suppression de 8 scripts de test
- ✅ Conservation de 14 scripts de production
- ✅ Nettoyage complet des données simulées
- ✅ Vérification de compatibilité
- ✅ Documentation complète

### **❌ Plus de données de test**
Le système ne génère **PLUS** de données automatiquement.  
Vous devez :
1. Ajouter vos équipements réels dans `equipements.csv`
2. Configurer les credentials (SSH pour Linux, SNMP pour switches)
3. Lancer les scripts de collecte

### **✅ Collecte 100% réelle**
- **Serveurs Windows** : WMI/CIM
- **Serveurs Linux** : SSH (Posh-SSH)
- **Switches** : SNMP v2c
- **Ping** : Test-Connection

---

## 🔧 **CONFIGURATION REQUISE**

### **Prérequis réseau**
- ✅ Serveurs Windows : WMI accessible (ports 135, 445)
- ✅ Serveurs Linux : SSH accessible (port 22)
- ✅ Switches : SNMP v2c accessible (port 161)
- ✅ Credentials configurés dans la base de données

### **Modules PowerShell**
```powershell
# Pour Linux (SSH)
Install-Module -Name Posh-SSH -Force

# Pour SNMP (optionnel)
Install-Module -Name Posh-SNMP -Force
```

### **Fichiers de configuration**
```powershell
# backend/.env
PORT=4000
JWT_SECRET=votre_secret_jwt
INGEST_KEY=votre_cle_ingest

# scripts/config.json
{
  "apiBase": "http://localhost:4000",
  "adminEmail": "admin@semmaris.local",
  "adminPassword": "admin123",
  "ingestKey": "MEME_QUE_BACKEND_ENV"
}
```

---

## 🌐 **ACCÈS AU DASHBOARD**

### **URLs**
- 🌐 **Frontend** : http://localhost:5173
- 🔧 **API** : http://localhost:4000
- 📊 **Health Check** : http://localhost:4000/health

### **Connexion par défaut**
- **👤 Admin** : admin@semmaris.local / admin123
- **👥 User** : user@semmaris.local / user123

---

## 📊 **VÉRIFICATION**

### **Checklist de validation**
```powershell
# 1. Docker fonctionne ?
.\scripts\DockerManager.ps1 status

# 2. API répond ?
Invoke-RestMethod http://localhost:4000/health

# 3. Frontend accessible ?
Start-Process http://localhost:5173

# 4. Base de données OK ?
.\scripts\DatabaseCheck.ps1 info

# 5. Équipements ajoutés ?
sqlite3 .\backend\data\app.db "SELECT COUNT(*) FROM equipment;"

# 6. Collecte fonctionne ?
.\scripts\ProductionMonitoring.ps1 -RunOnce
Get-Content ".\logs\monitoring_$(Get-Date -Format 'yyyyMMdd').log" -Tail 10
```

---

## 🆘 **DÉPANNAGE**

### **Problème : Aucune donnée ne s'affiche**
```powershell
# Vérifier que des équipements existent
.\scripts\DatabaseCheck.ps1 info

# Vérifier les logs de collecte
Get-Content ".\logs\monitoring_*.log" -Tail 50

# Tester manuellement chaque script
.\scripts\PingEquipment.ps1
.\scripts\CollectServerInfo.ps1
.\scripts\CollectSwitchInfo.ps1
```

### **Problème : Erreurs de collecte**
```powershell
# Serveurs Windows : Tester WMI
Get-CimInstance Win32_OperatingSystem -ComputerName IP_SERVER

# Serveurs Linux : Tester SSH
Test-NetConnection IP_SERVER -Port 22

# Switches : Tester SNMP
snmpget -v2c -c public IP_SWITCH 1.3.6.1.2.1.1.1.0
```

### **Problème : Docker ne démarre pas**
```powershell
# Logs Docker
.\scripts\DockerManager.ps1 logs

# Rebuild complet
.\scripts\DockerManager.ps1 rebuild

# Vérifier les ports
Test-NetConnection localhost -Port 4000
Test-NetConnection localhost -Port 5173
```

---

## 📚 **POUR ALLER PLUS LOIN**

### **Documentation complète**
- 📘 Lire `SCRIPTS-PRODUCTION.md` pour tous les détails sur chaque script
- 📘 Lire `PRODUCTION-MONITORING-GUIDE.md` pour le guide de monitoring
- 📘 Lire `ANALYSE-COMPATIBILITE-SCRIPTS.md` pour l'analyse technique

### **Scripts avancés**
- 🔧 `AlertManager.ps1` - Configurer les alertes
- 🔧 `AutomationManager.ps1` - Automatisation avancée
- 🔧 `BandwidthMonitor.ps1` - Monitoring bande passante

---

## ✅ **RÉSUMÉ**

✅ **14 scripts de production disponibles**  
✅ **Collecte 100% réelle (WMI, SSH, SNMP)**  
✅ **Aucune donnée simulée**  
✅ **Documentation complète**  
✅ **Production Ready**

**Le dashboard est prêt pour la production ! 🚀**

---

**Dashboard Semmaris - Guide Rapide v1.0**  
**Support** : Consultez la documentation ou les logs pour le dépannage
