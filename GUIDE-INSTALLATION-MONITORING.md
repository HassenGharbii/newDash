# Guide d'Installation du Monitoring Automatique

## 📋 Vue d'ensemble

Ce système lance automatiquement 3 monitors en continu :
- **Ping Monitor** : Vérification de disponibilité de tous les équipements
- **SNMP Monitor** : Collecte des métriques switches (CPU, RAM, ports, température)
- **Bandwidth Monitor** : Collecte de la bande passante (Caméras, Switches, PC, Serveurs)

---

## ✅ Installation (1 seule fois)

### Étape 1 : Ouvrir PowerShell en Administrateur
1. Clic droit sur le menu Démarrer → **Windows PowerShell (Admin)**
2. Ou rechercher "PowerShell" → Clic droit → **Exécuter en tant qu'administrateur**

### Étape 2 : Naviguer vers le dossier scripts
```powershell
cd C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\scripts
```

### Étape 3 : Installer le service
```powershell
.\InstallMonitoringService.ps1
```

**Résultat attendu** :
```
======================================================
   Installation du Service de Monitoring Automatique
======================================================

[OK] Tâche planifiée créée: Dashboard-Monitoring-Service
[INFO] Démarrage immédiat de la tâche...

État de la tâche:
  - État: Running
  - Dernière exécution: 01/12/2025 14:30:00
  - Prochaine exécution: 02/12/2025 08:00:00

======================================================
   ✓ Installation terminée avec succès !
======================================================
```

---

## 🔍 Vérifier l'état

### Option 1 : Script MonitoringStatus
```powershell
cd C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\scripts
.\MonitoringStatus.ps1
```

Affiche :
- État de la tâche planifiée
- Jobs PowerShell actifs
- Logs récents
- Connectivité API
- Statistiques (équipements en ligne, collectes récentes)

### Option 2 : StartMonitors -Status
```powershell
.\StartMonitors.ps1 -Status
```

Affiche :
- Liste des jobs actifs
- Dernières lignes des logs

### Option 3 : Planificateur de tâches Windows
1. Rechercher "Planificateur de tâches"
2. Chercher : **Dashboard-Monitoring-Service**
3. Onglet "Historique" pour voir les exécutions

---

## 📊 Suivre les logs en temps réel

### Tous les logs
```powershell
cd C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\logs
Get-Content *.log -Wait -Tail 30
```

### Ping Monitor
```powershell
Get-Content C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\logs\ping-monitor.log -Wait -Tail 20
```

### SNMP Monitor
```powershell
Get-Content C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\logs\snmp-monitor.log -Wait -Tail 20
```

### Bandwidth Monitor
```powershell
Get-Content C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\logs\bandwidth-monitor.log -Wait -Tail 20
```

---

## 🔧 Commandes de gestion

### Redémarrer les monitors
```powershell
cd C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\scripts
.\StartMonitors.ps1 -Restart
```

### Arrêter les monitors
```powershell
.\StartMonitors.ps1 -Stop
```

### Redémarrer via la tâche planifiée
```powershell
Start-ScheduledTask -TaskName "Dashboard-Monitoring-Service"
```

### Arrêter la tâche planifiée
```powershell
Stop-ScheduledTask -TaskName "Dashboard-Monitoring-Service"
```

---

## 🗑️ Désinstallation

Pour supprimer le service automatique :

```powershell
cd C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\scripts

# Ouvrir PowerShell en Administrateur puis :
.\InstallMonitoringService.ps1 -Uninstall
```

Cela :
- Supprime la tâche planifiée
- Arrête tous les monitors en cours
- Conserve les logs existants

---

## 🚀 Fonctionnement

### Au démarrage de Windows
1. Windows attend **30 secondes** (pour que le réseau soit prêt)
2. La tâche planifiée démarre automatiquement
3. Le script `StartMonitors.ps1` est exécuté
4. 3 jobs PowerShell sont lancés en arrière-plan :
   - **Monitor-Ping** : Ping toutes les 60s
   - **Monitor-SNMP** : Collecte SNMP toutes les 2 min
   - **Monitor-Bandwidth** : Collecte bande passante toutes les 2 min

### En cas d'échec
- **Redémarrage automatique** : 3 tentatives, intervalle 1 minute
- **Répétition** : Toutes les 5 minutes si la tâche échoue
- **Logs** : Tout est journalisé dans `logs/*.log`

### Compte d'exécution
- **SYSTEM** : Le service tourne sous le compte système
- **Privilèges élevés** : Accès complet aux compteurs de performance et SNMP
- **Toujours actif** : Même si aucun utilisateur n'est connecté

---

## 📈 Données collectées

### Toutes les 60 secondes
- **Ping** : État de disponibilité de tous les équipements
  - API : `POST /equipment/{id}` (mise à jour du statut)

### Toutes les 2 minutes
- **SNMP (Switches)** :
  - CPU, RAM, température
  - Statut des ports
  - Trafic réseau
  - API : `POST /ingest/switch-metrics`

- **Bandwidth (Tous)** :
  - Bande passante Caméras, Switches, PC, Serveurs
  - Octets entrants/sortants
  - Total en Mbps
  - API : `POST /bandwidth/ingest`

---

## 🔔 Notifications et Alertes

Les données collectées sont accessibles :
- **Dashboard Web** : http://10.8.11.230:3000
- **API Backend** : http://10.8.11.230:4000
- **Logs fichiers** : `C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\logs\`

Pour ajouter des alertes email/SMS, voir le fichier `AlertManager.ps1`.

---

## ❓ Dépannage

### La tâche ne démarre pas
```powershell
# Vérifier les permissions
Get-ScheduledTask -TaskName "Dashboard-Monitoring-Service" | Select-Object *

# Voir les erreurs
Get-ScheduledTaskInfo -TaskName "Dashboard-Monitoring-Service"
```

### Les monitors ne tournent pas
```powershell
# Vérifier les jobs
Get-Job | Where-Object { $_.Name -like "Monitor-*" }

# Voir les erreurs d'un job
Get-Job -Name "Monitor-Ping" | Receive-Job
```

### Pas de données collectées
1. Vérifier que l'API backend est accessible :
   ```powershell
   Invoke-RestMethod -Uri "http://10.8.11.230:4000/health"
   ```

2. Vérifier la configuration :
   ```powershell
   Get-Content C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\scripts\config.json
   ```

3. Tester manuellement :
   ```powershell
   cd C:\Users\Axone\Documents\Dashboard-Semmaris-Base-Propre\scripts
   .\TestBandwidthCollection.ps1
   ```

### SNMP ne fonctionne pas
- Vérifier que SnmpWalk.exe existe :
  ```powershell
  Test-Path C:\Users\Axone\Documents\SnmpWalk\SnmpWalk.exe
  ```
- Tester la connectivité réseau vers les switches
- Vérifier que SNMP est activé sur les switches (community: public)

---

## 📝 Fichiers importants

```
scripts/
  ├── StartMonitors.ps1              # Lance tous les monitors
  ├── InstallMonitoringService.ps1   # Installation du service auto
  ├── MonitoringStatus.ps1           # Vérification de l'état
  ├── PingEquipment.ps1              # Monitor ping
  ├── SNMPMonitor.ps1                # Monitor SNMP
  ├── BandwidthCollector.ps1         # Monitor bande passante
  ├── config.json                    # Configuration API
  └── TestBandwidthCollection.ps1    # Test de collecte

logs/
  ├── ping-monitor.log               # Logs ping
  ├── snmp-monitor.log               # Logs SNMP
  └── bandwidth-monitor.log          # Logs bande passante
```

---

## ✅ Checklist de vérification

- [ ] Tâche planifiée créée et active
- [ ] 3 jobs PowerShell en cours d'exécution
- [ ] Logs récents (moins de 5 minutes)
- [ ] API backend accessible
- [ ] Données de bande passante collectées (dernière heure)
- [ ] Dashboard web affiche les données

---

*Document créé le 1er décembre 2025*
