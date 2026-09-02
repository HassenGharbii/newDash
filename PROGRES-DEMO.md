# SEMMARIS DASHBOARD — Progrès réalisés & préparation démo

## Résumé du travail effectué

1. **Audit complet du projet** — comparaison de ce qui était documenté comme "fait" avec l'état réel du code (backend, frontend, scripts). 21 écarts identifiés et corrigés.
2. **Sécurité** — rotation des identifiants exposés dans Git (mot de passe admin, clé d'ingestion), externalisation de tous les secrets vers des variables d'environnement, suppression de mots de passe codés en dur.
3. **Corrections de bugs** — chemins et IPs codés en dur corrigés dans les scripts PowerShell, conteneurs Docker qui référençaient des fichiers inexistants réparés, logs de debug supprimés, incompatibilités PowerShell corrigées (dont un bug bloquant préexistant).
4. **Nouvelle fonctionnalité : historique des métriques** — VMware et Stockage affichent maintenant des mini-graphiques d'historique (CPU%, RAM%, VMs / Capacité%, To, disques en défaut) sur 24h, avec toute la chaîne backend (base de données, endpoints API) et frontend.
5. **Nouvelle fonctionnalité : sauvegardes automatiques** (`BackupManager.ps1`) — était un fichier vide, entièrement construit et testé (backup/restauration/liste).
6. **Nouvelle fonctionnalité : alertes** (`AlertManager.ps1`) — était un fichier vide, entièrement construit et testé (détection de panne, notification de reprise, webhook).
7. **Amélioration du Panel Admin** — les types Hyperviseur/Stockage sont maintenant gérables, import CSV/Excel corrigé, documentation technique corrigée.
8. **Conteneurisation complète du monitoring** — toute la stack (ping, bande passante, métriques switches, alertes, sauvegardes) tourne maintenant via `docker compose up -d`, plus la correction de compatibilité Windows/Linux qui bloquait certains scripts.

---

## ✅ Ce qui est prêt à démontrer

- **Connexion** — 3 rôles (Admin/User/SGM), menu différent selon le rôle
- **Tableau de bord (Accueil)** — KPIs par type d'équipement avec camemberts en ligne/hors ligne
- **Panel Admin** (Admin uniquement) — ajout/modification/suppression d'équipement, import Excel/CSV (y compris Hyperviseur/Stockage maintenant), export
- **Pages de monitoring** — Caméras, Switches, PCs, Serveurs (cliquer sur les tuiles de l'Accueil)
- **PCA/PRA** — regroupement automatique par site (PCA1/PCA2/PRA)
- **VMware / Stockage** — interface complète avec graphiques d'historique 24h (sparklines) — *mais sans données réelles tant que les identifiants vCenter/Seagate ne sont pas configurés (voir ci-dessous)*
- **Sauvegarde** — `.\scripts\BackupManager.ps1 backup` / `list` / `restore` en live
- **Alertes** — `.\scripts\AlertManager.ps1` peut être démontré en simulant une panne (équipement qui passe DOWN puis UP)
- **Déploiement Docker** — `docker compose up -d --build` démarre toute la stack (api, frontend, 4 monitors, alertes, sauvegardes)

## ⚠️ À vérifier/préparer AVANT la démo

1. **Le monitoring ping n'est pas confirmé fonctionnel actuellement** — un test récent montrait un équipement "hors ligne" malgré un ping manuel réussi, et Docker Desktop n'était pas démarré au moment du diagnostic. **À faire avant la démo** : démarrer Docker Desktop, relancer `docker compose up -d --build`, et vérifier que `docker compose logs ping-monitor` montre bien des équipements passer en ligne. Ne pas démontrer le monitoring ping en live tant que ce n'est pas confirmé.
2. **VMware/Stockage seront vides** sans identifiants réels vCenter/ESXi/Seagate. Deux options pour la démo :
   - Expliquer que l'interface est prête et attend la configuration réseau/identifiants (message honnête, montre le travail fait)
   - Ou injecter des données de test via l'API avant la démo pour montrer les graphiques d'historique remplis (je peux préparer ça si vous voulez montrer le rendu final)
3. **Bande passante switches** nécessite `SnmpWalk.exe` (absent) ou net-snmp + accès réseau réel aux switches — probablement pas démontrable hors du réseau Semmaris.
4. Vérifier que le mot de passe admin actuel correspond bien à celui du `.env` (`fet5Corb8pdHXmZr8XaMMY`) — uniquement valable si la base de données est "fraîche" (pas d'ancienne base avec l'ancien mot de passe).

## Suggestion d'ordre de démo

1. Connexion (montrer les rôles)
2. Accueil → cliquer sur une tuile (ex: Serveurs) → vue détaillée
3. Panel Admin → ajouter un équipement en live, import Excel
4. PCA/PRA → regroupement automatique
5. VMware/Stockage → montrer l'interface + graphiques d'historique (avec données de test si préparées)
6. Sauvegarde en live (`BackupManager.ps1 backup` + `list`)
7. Alertes en live (couper un équipement, montrer l'alerte se déclencher)
8. `docker compose ps` pour montrer que tout tourne comme un seul déploiement
