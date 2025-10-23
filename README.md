# Dashboard Semmaris - Magnetoo

Un tableau de bord pour la supervision réseau et la gestion des équipements.

## 🚀 Fonctionnalités

- 🔐 **Authentification sécurisée** avec gestion des rôles (Admin/User)
- 📊 **Monitoring en temps réel** de la bande passante réseau
- 🖥️ **Gestion des équipements** (Serveurs, Switches, PCs, Caméras)
- 📈 **Statistiques** et graphiques de performance
- 🎨 **Interface moderne** avec design red-black
- 🔧 **Panel d'administration** pour la gestion des utilisateurs
- 💾 **Persistance des données** avec volumes Docker

## 🛠️ Technologies

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + SQLite
- **Authentification**: JWT
- **Monitoring**: PowerShell Scripts + APIs REST
- **Déploiement**: Docker + Docker Compose
- **Base de données**: SQLite avec volumes persistants

## 📋 Installation

### Prérequis
- Docker et Docker Compose installés
- PowerShell (pour le monitoring réseau)
- Git (optionnel)

### 🔧 Configuration initiale
```powershell
# 1. Exécuter le script de setup (recommandé)
.\scripts\Setup.ps1

# OU configuration manuelle :
# Créer les fichiers d'environnement
cp backend\.env.example backend\.env
cp frontend\.env.example frontend\.env
```

### 🚀 Lancement rapide
```powershell
# Méthode recommandée - Script automatisé
.\scripts\DockerManager.ps1 start -Build

# OU méthode manuelle
docker compose up -d --build
```

L'application sera accessible sur :
- **🌐 Frontend**: http://localhost:5173
- **🔧 API**: http://localhost:4000

## 🔑 Utilisation

### Connexion par défaut
- **👤 Admin**: admin@semmaris.com / admin123
- **👥 User**: user@semmaris.com / user123

### 📊 Monitoring réseau
Les scripts PowerShell automatisent :
- 📈 Surveillance bande passante temps réel
- 🔍 Vérification statut équipements (ping)
- 📋 Collection données de performance
- 💾 Sauvegarde automatique des métriques

## ⚙️ Scripts de gestion

### 🐳 Gestion Docker
```powershell
# Démarrer les services
.\scripts\DockerManager.ps1 start

# Redémarrer avec reconstruction
.\scripts\DockerManager.ps1 restart -Build

# Reconstruction complète (garde les données)
.\scripts\DockerManager.ps1 rebuild

# Voir les logs en temps réel
.\scripts\DockerManager.ps1 logs

# Statut des conteneurs
.\scripts\DockerManager.ps1 status

# Arrêter les services
.\scripts\DockerManager.ps1 stop
```

### 💾 Gestion des backups
```powershell
# Créer un backup
.\scripts\BackupManager.ps1 backup

# Backup avec nom personnalisé
.\scripts\BackupManager.ps1 backup -BackupName "avant_mise_a_jour"

# Lister les backups
.\scripts\BackupManager.ps1 list

# Restaurer un backup
.\scripts\BackupManager.ps1 restore -BackupName "backup_name"

# Nettoyer les anciens backups
.\scripts\BackupManager.ps1 cleanup
```

### 🗄️ Vérification base de données
```powershell
# Vérification basique
.\scripts\DatabaseCheck.ps1

# Informations détaillées
.\scripts\DatabaseCheck.ps1 info

# Créer un backup de la DB
.\scripts\DatabaseCheck.ps1 backup
```

### 📡 Monitoring réseau
```powershell
# Monitoring bande passante (temps réel)
.\scripts\BandwidthMonitor.ps1

# Vérification équipements (ping)
.\scripts\PingEquipment.ps1

# Ajout équipements depuis CSV
.\scripts\AddEquipmentFromCsv.ps1
```

## 🏗️ Architecture

```
Dashboard-Semmaris-Base-Propre/
├── 🖥️ frontend/              # Application React
│   ├── src/
│   │   ├── views/           # Pages dashboard
│   │   ├── ui/              # Composants UI
│   │   └── styles.css       # Thème red-black
│   ├── Dockerfile
│   └── .dockerignore
├── ⚙️ backend/               # API Node.js
│   ├── src/                 # Code serveur
│   ├── data/                # 💾 Base SQLite (persistante)
│   ├── Dockerfile
│   └── .dockerignore
├── 📜 scripts/               # Scripts PowerShell
│   ├── DockerManager.ps1    # 🐳 Gestion Docker
│   ├── BackupManager.ps1    # 💾 Gestion backups
│   ├── DatabaseCheck.ps1    # 🗄️ Vérif. base
│   ├── BandwidthMonitor.ps1 # 📊 Monitoring
│   ├── PingEquipment.ps1    # 🔍 Test équipements
│   └── Setup.ps1           # 🔧 Config initiale
├── 🐳 docker-compose.yml     # Orchestration
└── 📖 README.md
```

## 🔧 Persistance des données

Les données sont automatiquement sauvegardées grâce aux volumes Docker :
- **Base de données** : `./backend/data` → `/app/data`
- **Équipements** et **utilisateurs** persistent entre les redémarrages
- **Métriques** de monitoring sauvegardées

### ⚠️ Important
- Les données survivent aux redémarrages Docker
- Utilisez les scripts de backup avant les mises à jour
- La base SQLite est dans `backend/data/app.db`

## 🆘 Dépannage

### Problèmes courants
```powershell
# Vérifier l'état des conteneurs
.\scripts\DockerManager.ps1 status

# Voir les logs d'erreur
.\scripts\DockerManager.ps1 logs

# Vérifier la base de données
.\scripts\DatabaseCheck.ps1 info

# Redémarrage complet
.\scripts\DockerManager.ps1 rebuild
```

### Perte de données
```powershell
# Restaurer depuis un backup
.\scripts\BackupManager.ps1 list
.\scripts\BackupManager.ps1 restore -BackupName "nom_du_backup"
```

### Problèmes réseau
```powershell
# Test connectivité
Test-NetConnection localhost -Port 5173  # Frontend
Test-NetConnection localhost -Port 4000  # Backend
```

## 📊 Monitoring avancé

Le système collecte automatiquement :
- **📈 Bande passante** : Débit upload/download en temps réel
- **🔍 Statut équipements** : Ping et disponibilité
- **📋 Métriques système** : CPU, mémoire, stockage
- **👥 Activité utilisateurs** : Connexions et actions

## 🔄 Mise à jour

```powershell
# 1. Créer un backup
.\scripts\BackupManager.ps1 backup -BackupName "avant_update"

# 2. Récupérer les nouveautés
git pull origin main

# 3. Redéployer
.\scripts\DockerManager.ps1 rebuild

# 4. Vérifier le fonctionnement
.\scripts\DatabaseCheck.ps1
```

## 📞 Support

Pour toute question ou problème :
1. **Consulter les logs** : `.\scripts\DockerManager.ps1 logs`
2. **Vérifier la base** : `.\scripts\DatabaseCheck.ps1`
3. **État des services** : `.\scripts\DockerManager.ps1 status`

---
**Dashboard Semmaris** - Supervision réseau moderne et intuitive 🚀
