# 🔧 CONFIGURATION SNMP POUR SWITCHES

**Date:** 18 Novembre 2025  
**Projet:** Dashboard Semmaris - Configuration SNMP

---

## 📋 TABLE DES MATIÈRES

1. [Qu'est-ce que SNMP ?](#quest-ce-que-snmp)
2. [Community String : Explication](#community-string-explication)
3. [Configuration par Fabricant](#configuration-par-fabricant)
4. [Vérification SNMP](#vérification-snmp)
5. [Sécurité SNMP](#sécurité-snmp)
6. [Configuration dans le Dashboard](#configuration-dans-le-dashboard)

---

## 🤔 QU'EST-CE QUE SNMP ?

**SNMP** = Simple Network Management Protocol

C'est un protocole qui permet de :
- 📊 Récupérer des informations d'un équipement réseau (CPU, RAM, ports, uptime)
- 📈 Monitorer l'état des interfaces réseau
- ⚙️ Configurer des équipements à distance

### Versions SNMP
- **SNMPv1** : Ancien, peu sécurisé (texte clair)
- **SNMPv2c** : Amélioré, utilisé par le Dashboard (avec community string)
- **SNMPv3** : Sécurisé avec authentification (non supporté actuellement)

---

## 🔑 COMMUNITY STRING : EXPLICATION

### Qu'est-ce qu'une Community String ?

C'est comme un **"mot de passe"** qui autorise l'accès en lecture (RO = Read-Only) ou écriture (RW = Read-Write) aux données SNMP du switch.

### Types de Community

| Type | Droits | Usage Dashboard |
|------|--------|-----------------|
| **RO (Read-Only)** | Lecture seule | ✅ **C'est ce qu'on utilise** |
| **RW (Read-Write)** | Lecture + Écriture | ❌ Pas nécessaire (dangereux) |

### Community par Défaut

La plupart des switches sont pré-configurés avec :
- **Community RO** : `public`
- **Community RW** : `private`

⚠️ **ATTENTION** : Utiliser "public" en production est **non sécurisé** ! Changez-le !

---

## ⚙️ CONFIGURATION PAR FABRICANT

### 🔵 CISCO (IOS/Catalyst)

#### Se connecter au switch
```bash
# Via SSH
ssh admin@192.168.1.100

# Via console série
minicom -D /dev/ttyUSB0
```

#### Configuration SNMP
```cisco
enable
configure terminal

! Créer une community READ-ONLY personnalisée
snmp-server community semmaris_ro RO

! OU garder "public" (non recommandé en production)
snmp-server community public RO

! Activer SNMP
snmp-server enable traps

! Sauvegarder
write memory
exit
```

#### Vérification
```cisco
show snmp community
! Doit afficher : semmaris_ro (RO)
```

#### Supprimer l'ancienne community (sécurité)
```cisco
configure terminal
no snmp-server community public
write memory
```

---

### 🟢 HP / HPE (ProCurve / Aruba)

#### Se connecter au switch
```bash
ssh manager@192.168.1.101
# Password : par défaut vide ou "admin"
```

#### Configuration SNMP
```hp
configure

# Créer community personnalisée
snmp-server community semmaris_ro unrestricted

# OU garder "public"
snmp-server community public unrestricted

# Sauvegarder
write memory
exit
```

#### Vérification
```hp
show snmp-server
# Affiche les communities configurées
```

---

### 🟠 JUNIPER (EX / QFX Series)

#### Se connecter au switch
```bash
ssh admin@192.168.1.102
```

#### Configuration SNMP
```juniper
configure

# Créer community personnalisée
set snmp community semmaris_ro authorization read-only

# OU garder "public"
set snmp community public authorization read-only

# Appliquer
commit
exit
```

#### Vérification
```juniper
show snmp community
```

---

### ⚫ DELL (PowerConnect / Networking)

#### Configuration SNMP
```dell
console> enable
console# configure

# Community personnalisée
console(config)# snmp-server community semmaris_ro ro

# Sauvegarder
console(config)# exit
console# copy running-config startup-config
```

---

### 🔴 EXTREME NETWORKS

#### Configuration SNMP
```extreme
configure snmp add community readonly semmaris_ro
save configuration
```

---

## 🧪 VÉRIFICATION SNMP

### Option 1 : Avec snmpwalk (Linux/Windows)

#### Installation sur Windows
```powershell
# Télécharger snmpwalk depuis net-snmp.org
# OU installer via Chocolatey
choco install net-snmp
```

#### Test de connexion
```powershell
# Test basique - Récupérer la description du système
snmpwalk -v2c -c semmaris_ro 192.168.1.100 sysDescr

# Exemple de sortie attendue :
# SNMPv2-MIB::sysDescr.0 = STRING: Cisco IOS Software, C3850 Software...
```

#### Tester plusieurs OIDs
```powershell
# Description système
snmpget -v2c -c semmaris_ro 192.168.1.100 1.3.6.1.2.1.1.1.0

# Uptime
snmpget -v2c -c semmaris_ro 192.168.1.100 1.3.6.1.2.1.1.3.0

# Nom du switch
snmpget -v2c -c semmaris_ro 192.168.1.100 1.3.6.1.2.1.1.5.0
```

### Option 2 : Test depuis PowerShell (sans snmpwalk)

```powershell
# Tester la connectivité SNMP (port 161 UDP)
Test-NetConnection -ComputerName 192.168.1.100 -Port 161

# Résultat attendu :
# TcpTestSucceeded : True (ou UdpTestSucceeded pour UDP)
```

### Option 3 : Utiliser le script CollectSwitchInfo.ps1

```powershell
cd C:\Dashboard-Semmaris\scripts

# Éditer temporairement le script pour tester UN switch
notepad CollectSwitchInfo.ps1

# Lancer le script
.\CollectSwitchInfo.ps1

# Vérifier les logs
Get-Content ..\logs\collect-switch.log -Tail 20
```

---

## 🔒 SÉCURITÉ SNMP - BONNES PRATIQUES

### ❌ À NE PAS FAIRE

```cisco
! N'utilisez JAMAIS "public" en production !
snmp-server community public RO

! N'autorisez PAS l'écriture (RW) si non nécessaire
snmp-server community private RW
```

### ✅ RECOMMANDATIONS

#### 1. Community String Forte
```cisco
! Utilisez un nom complexe et unique
snmp-server community Semm@r1s_M0n1t0r_2025! RO
```

#### 2. Restriction par IP (ACL)
```cisco
! Cisco - Autoriser uniquement le serveur de monitoring
access-list 10 permit 192.168.1.50
snmp-server community semmaris_ro RO 10
```

```hp
! HP - Restriction IP
snmp-server community semmaris_ro restricted
ip authorized-managers 192.168.1.50
```

#### 3. VLAN Management Dédié
- Placer le serveur de monitoring et les switches dans un VLAN dédié
- Isoler du réseau utilisateur

#### 4. Firewall sur le Switch
```cisco
! Cisco - Bloquer SNMP depuis Internet
ip access-list extended BLOCK_SNMP_INTERNET
 deny udp any any eq 161
 permit ip any any
!
interface Vlan1
 ip access-group BLOCK_SNMP_INTERNET in
```

#### 5. Chiffrement avec SNMPv3 (Recommandé)

⚠️ **Note:** Le Dashboard utilise actuellement SNMPv2c. Migration vers SNMPv3 nécessite modification des scripts.

**Configuration SNMPv3 (pour référence future):**
```cisco
! Cisco SNMPv3
snmp-server group SEMMARIS-GROUP v3 priv
snmp-server user semmaris-monitor SEMMARIS-GROUP v3 auth sha AuthP@ssw0rd priv aes 128 PrivP@ssw0rd
```

---

## 📝 CONFIGURATION DANS LE DASHBOARD

### Méthode 1 : Via equipements.csv

Éditez `scripts/equipements.csv` :

```csv
name,type,ip_address,vendor,model,location,username,password
SW-CORE-01,switch,192.168.1.100,Cisco,Catalyst 3850,Datacenter,,,semmaris_ro
SW-ACCESS-01,switch,192.168.1.101,HP,ProCurve 2920,Bureau,,,semmaris_ro
SW-DISTRIB-01,switch,192.168.1.102,Juniper,EX4300,Datacenter,,,public
```

**⚠️ IMPORTANT :** Le champ `password` contient la **community string SNMP** pour les switches !

### Méthode 2 : Via Panel Admin (après import)

1. Se connecter au Dashboard : `http://localhost:5173`
2. Login : `admin@semmaris.fr` / `Admin2025!`
3. Menu : **Panel Admin**
4. Cliquer sur un switch dans la liste
5. Section **Credentials** :
   - **Username** : Laisser vide (non utilisé pour SNMP)
   - **Password** : Entrer la community string : `semmaris_ro`
6. Cliquer **Update Equipment**

---

## 🧪 TEST COMPLET - CHECKLIST

### Étape 1 : Vérifier la configuration SNMP sur le switch
```cisco
show snmp community
! Doit afficher votre community (ex: semmaris_ro)
```

### Étape 2 : Tester depuis PowerShell
```powershell
# Test connectivité
Test-NetConnection -ComputerName 192.168.1.100 -Port 161

# Si snmpget disponible
snmpget -v2c -c semmaris_ro 192.168.1.100 sysDescr.0
```

### Étape 3 : Configurer dans equipements.csv
```csv
SW-TEST,switch,192.168.1.100,Cisco,Catalyst,Lab,,,semmaris_ro
```

### Étape 4 : Importer dans le Dashboard
```powershell
cd C:\Dashboard-Semmaris\scripts
.\AddEquipmentFromCsv.ps1
```

### Étape 5 : Lancer la collecte SNMP
```powershell
.\CollectSwitchInfo.ps1
```

### Étape 6 : Vérifier les logs
```powershell
Get-Content ..\logs\collect-switch.log -Tail 30
```

**Résultat attendu :**
```
[2025-11-18 10:30:15] INFO: Collecting switch info for SW-TEST (192.168.1.100)
[2025-11-18 10:30:16] SUCCESS: Retrieved sysDescr: Cisco IOS Software...
[2025-11-18 10:30:17] SUCCESS: CPU Usage: 15%
[2025-11-18 10:30:18] SUCCESS: Memory: 512 MB / 1024 MB (50%)
[2025-11-18 10:30:20] SUCCESS: Collected 24 interfaces
[2025-11-18 10:30:21] INFO: Data sent to backend successfully
```

### Étape 7 : Vérifier dans le Dashboard
1. Ouvrir : `http://localhost:5173`
2. Menu : **Équipements**
3. Cliquer sur le switch
4. Vérifier que les données s'affichent :
   - ✅ CPU Usage
   - ✅ Memory Usage
   - ✅ Uptime
   - ✅ Liste des ports (status up/down)
   - ✅ Bande passante par port

---

## 📊 TABLEAU RÉCAPITULATIF

| Fabricant | Community RO par Défaut | Commande Configuration | Port SNMP |
|-----------|------------------------|------------------------|-----------|
| Cisco | `public` | `snmp-server community <name> RO` | 161/UDP |
| HP/HPE | `public` | `snmp-server community <name> unrestricted` | 161/UDP |
| Juniper | `public` | `set snmp community <name> authorization read-only` | 161/UDP |
| Dell | `public` | `snmp-server community <name> ro` | 161/UDP |
| Extreme | `public` | `configure snmp add community readonly <name>` | 161/UDP |

---

## 🚨 TROUBLESHOOTING

### Problème : "Timeout" lors de la collecte SNMP

**Causes possibles :**
1. Firewall bloque le port 161/UDP
2. Community string incorrecte
3. SNMP non activé sur le switch
4. ACL bloque l'IP du serveur

**Solutions :**
```powershell
# Test 1 : Ping le switch
Test-Connection 192.168.1.100

# Test 2 : Test port 161
Test-NetConnection -ComputerName 192.168.1.100 -Port 161

# Test 3 : Vérifier firewall Windows
Get-NetFirewallRule | Where-Object {$_.LocalPort -eq 161}

# Test 4 : Ajouter règle firewall
New-NetFirewallRule -DisplayName "SNMP Outbound" -Direction Outbound -LocalPort 161 -Protocol UDP -Action Allow
```

### Problème : "Authentication failed"

**Cause :** Community string incorrecte

**Solution :**
```cisco
! Sur le switch, vérifier les communities
show snmp community

! Corriger dans equipements.csv OU Panel Admin
```

### Problème : Pas de données dans le Dashboard

**Vérifier :**
1. Logs du script :
   ```powershell
   Get-Content C:\Dashboard-Semmaris\logs\collect-switch.log -Tail 50
   ```

2. Logs backend :
   ```powershell
   docker logs semmaris-backend --tail 50
   ```

3. Clé d'ingestion :
   - Vérifier que `INGEST_KEY` dans `backend.env` correspond à celle dans `config.json`

---

## 📋 CHECKLIST FINALE SNMP

```
□ SNMP activé sur tous les switches
□ Community string personnalisée créée (ex: semmaris_ro)
□ Community "public" désactivée (sécurité)
□ ACL configurée (autoriser uniquement IP du serveur monitoring)
□ Port 161/UDP ouvert dans firewall
□ Community string ajoutée dans equipements.csv (colonne password)
□ Équipements importés dans la DB
□ Test collecte réussi (CollectSwitchInfo.ps1)
□ Données visibles dans le Dashboard
□ Logs sans erreur
```

---

## 🎯 RÉSUMÉ RAPIDE

### Pour commencer RAPIDEMENT :

1. **Sur chaque switch Cisco :**
   ```cisco
   enable
   configure terminal
   snmp-server community semmaris_ro RO
   write memory
   ```

2. **Dans equipements.csv :**
   ```csv
   SW-CORE-01,switch,192.168.1.100,Cisco,Catalyst,DC,,,semmaris_ro
   ```

3. **Tester :**
   ```powershell
   .\CollectSwitchInfo.ps1
   ```

**C'est tout !** 🚀

---

**Document créé le :** 18 Novembre 2025  
**Version :** 1.0  
**Auteur :** GitHub Copilot  
**Projet :** Semmaris Infrastructure Monitoring Dashboard
