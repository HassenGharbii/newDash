# SEMMARIS DASHBOARD — MODIFICATIONS RÉALISÉES (Phases 0 à 8)

Ce document résume, en français, les changements effectués suite à l'audit (`AUDIT-ETAT-REEL.md`, `CLAIMS-DONE-VS-NOT-DONE.md`, `NEXT-STEPS.md`). Rien n'a été committé dans git — tous les changements sont dans l'arbre de travail, prêts à être relus.

---

## Phase 0 — Décisions prises avec vous

| Question | Décision |
|---|---|
| Purge de l'historique git pour le secret exposé (`scripts/config.json`) | Ne pas réécrire l'historique — se limiter à la rotation des valeurs et au dé-suivi du fichier |
| Politique de rétention des nouvelles tables de métriques historiques | Aucune suppression automatique pour l'instant |
| Contenu de `GET /stats/history` | Tendances agrégées hyperviseurs/stockage (CPU/RAM moyens, capacité totale, etc.) |
| `VITE_API_URL` de production | Pas encore connue — rendue configurable via `.env` plutôt que codée en dur |

---

## Phase 1 — Sécurité

- **Secrets régénérés** : nouveau `JWT_SECRET`, `INGEST_KEY`, mot de passe admin/utilisateur seedés — stockés dans un nouveau fichier racine `.env` (ignoré par git) avec un `.env.example` à côté.
- **`scripts/config.json`** : valeurs `adminPassword`/`ingestKey` mises à jour avec les nouvelles valeurs, fichier ajouté à `.gitignore`, et retiré du suivi git (`git rm --cached`) — il reste présent sur le disque, seul l'historique git antérieur garde encore l'ancienne version (non réécrit, par choix).
- **`docker-compose.yml`** : `JWT_SECRET`, `INGEST_KEY` et `VITE_API_URL` lisent maintenant `.env` au lieu d'être codés en dur.
- **Mots de passe seedés (admin/user)** : externalisés via `ADMIN_SEED_PASSWORD`/`USER_SEED_PASSWORD`, avec un avertissement au démarrage si les valeurs par défaut sont utilisées. ⚠️ Cette externalisation ne change le mot de passe QUE lors du tout premier seed (base vide) — si une base de production existe déjà avec l'ancien mot de passe `admin123`, il faudra le changer manuellement via le Panel Admin.
- **`CollectStorageInfo.ps1`** : suppression du mot de passe Seagate par défaut codé en dur (`"!manage"`).

## Phase 2 — Correction des éléments annoncés comme faits mais cassés

- **`StartAllMonitors.ps1`** : remplacement du chemin `C:\Users\Axone\...` et de l'IP codée en dur par `$PSScriptRoot` + une URL d'API configurable.
- **`CollectSwitchBandwidth.ps1`** : chemin de `SnmpWalk.exe` corrigé pour utiliser `$PSScriptRoot\SnmpWalk\SnmpWalk.exe` (⚠️ le binaire lui-même doit toujours être déposé à cet endroit — non fourni).
- **`docker-compose.yml`** : les services `ping-monitor`/`bandwidth-monitor` pointaient vers des scripts inexistants — corrigés pour pointer vers `SimplePing.ps1` et `CollectSwitchBandwidth.ps1`. ⚠️ `bandwidth-monitor` ne fonctionnera quand même pas tel quel : `SnmpWalk.exe` est un binaire Windows qui ne peut pas s'exécuter dans ce conteneur Linux — à faire tourner sur l'hôte Windows plutôt qu'en Docker, ou à réécrire avec un client SNMP Linux.
- **`backend/src/index.js`** : suppression des 7 logs `[DEBUG]` restants dans `GET /equipment`.
- **`CollectHyperviseurInfo.ps1` et `CollectStorageInfo.ps1`** : réécriture des 16 usages de l'opérateur `??` (PowerShell 7+ uniquement) pour compatibilité avec Windows PowerShell 5.1.

## Phase 3 — Métriques historiques (construites de zéro, n'existaient pas)

- **Schéma** : ajout des tables `hyperviseur_metrics` et `storage_metrics` (indexées par équipement + date), sans suppression automatique.
- **Ingestion** : `POST /ingest/hyperviseur` et `POST /ingest/storage` insèrent maintenant une ligne d'historique en plus de la mise à jour de l'état courant.
- **Nouveaux endpoints** :
  - `GET /metrics/hyperviseur/:id/history?hours=24`
  - `GET /metrics/storage/:id/history?hours=24`
  - `GET /stats/history?hours=24` (tendances agrégées)
- **Frontend** : nouveau composant réutilisable `Sparkline` (`frontend/src/components/Sparkline.jsx`), intégré dans `VMware.jsx` (CPU %, RAM %, VMs) et `Storage.jsx` (capacité %, capacité en To, disques en défaut), avec l'état vide « Pas encore de données ».

## Validation effectuée

- Vérification syntaxique du backend (`node --check`).
- Backend démarré à froid, connexion, ingestion de données de test hyperviseur/stockage, vérification des 3 nouveaux endpoints (y compris le cas 404 pour un équipement inconnu) — tout fonctionne.
- Build du frontend réussi (`npm run build`). Un avertissement esbuild préexistant a été repéré dans `Stats.jsx` (accolade en trop) — sans lien avec ces changements, non bloquant, à corriger séparément si besoin.

---

## Phase 4 — Sauvegarde (`BackupManager.ps1`, construit de zéro)

Le fichier était vide (0 octet). Nouvelle implémentation avec trois actions :

- `backup` : copie `app.db` (+ `-wal`/`-shm`) dans un dossier horodaté sous `backend/data/backups/`, puis supprime les sauvegardes de plus de `-RetentionDays` (30 jours par défaut, ajustable).
- `restore -RestoreFrom <dossier>` : restaure une sauvegarde, avec sauvegarde de sécurité automatique de l'état actuel avant d'écraser quoi que ce soit.
- `list` : liste les sauvegardes disponibles avec leur taille.

⚠️ **Constat fait pendant les tests** : sous Windows, si le backend (processus `node`) tourne encore, la restauration échoue avec une erreur `user-mapped section open` (SQLite garde le fichier mappé en mémoire). **Il faut arrêter le backend avant de restaurer.** C'est documenté dans le script.

Aucune destination/rétention n'avait été précisée à l'avance — j'ai choisi par défaut `backend/data/backups/` (déjà anticipé dans le `.gitignore` existant) et 30 jours de rétention ; les deux sont ajustables via paramètres.

## Phase 5 — Alertes (`AlertManager.ps1`, construit de zéro)

Le fichier était vide (0 octet). Nouvelle implémentation :

- Interroge `GET /equipment` à intervalle régulier (`pollIntervalSeconds` dans `config.json`).
- Suit un compteur de pannes consécutives par équipement et déclenche une alerte une fois le seuil `debounceCount` atteint (pas de nouvelle alerte tant que l'équipement reste en panne — pas de spam).
- Envoie une notification de reprise quand l'équipement redevient `UP`.
- Envoie un heartbeat périodique si `heartbeatSeconds > 0`.
- Envoi via webhook (`config.json:webhookUrl`, avec 3 tentatives) — si `webhookUrl` est vide, les alertes sont simplement journalisées localement (aucune erreur, dégradation propre).
- Nouveau champ `webhookUrl` ajouté à `scripts/config.json` (vide par défaut — à renseigner quand une URL de webhook réelle sera disponible).

Testé en conditions réelles : backend de test démarré, équipement mis en panne puis rétabli — l'alerte et la notification de reprise se déclenchent correctement (voir logs de validation).

## Phase 6 — Panel Admin : types d'équipement manquants

- `AdminPanel.jsx` : `Hyperviseur` et `Stockage` sont maintenant sélectionnables dans le formulaire manuel d'ajout/modification (avant limité à `Server/Switch/Camera/PC`).
- Correction de l'import CSV qui rétrogradait silencieusement en `PC` tout type non reconnu — `normalizeType()` reconnaît maintenant aussi `hyperviseur/esxi/vmware` et `stockage/storage/san/nas`, en cohérence avec le backend.

## Phase 7 — Externalisation de la liste des switches

Les ~90 switches (nom + IP) codés en dur dans `CollectSwitchBandwidth.ps1` ont été déplacés dans `scripts/config.json` (champ `switches`). Le script échoue proprement avec un message clair si ce champ est absent ou vide, au lieu de contenir l'inventaire réseau en dur dans le code source.

## Phase 8 — Correction du README et points de nettoyage en attente

- **`README.md`** : les sections 9 (endpoints API) et 10 (schéma base de données) étaient entièrement fictives (routes `/api/...` inexistantes, tables `ping_results`/`bandwidth_metrics` inexistantes, colonnes `hyperviseur_metrics`/`storage_metrics` inventées). Réécrites pour refléter le code réel, tel que vérifié le 2026-08-26.
- **Décisions de nettoyage volontairement NON prises** (nécessitent votre confirmation avant suppression) :
  - `frontend/src/views/SitePlan.jsx` et `frontend/src/App.jsx` : code orphelin (non utilisé par le vrai point d'entrée `main.jsx`) mais peut-être une fonctionnalité voulue et jamais branchée (plan de site) — à trancher.
  - Scripts collecteurs redondants : 3 collecteurs serveur (`CollectServerInfo.ps1`/`CollectServerMetrics.ps1`/`CollectServerMetricsV2.ps1`), 2 collecteurs switch (`CollectSwitchMetrics.ps1`/`CollectSwitchMetrics-Native.ps1`), 2 scripts de démarrage (`StartAllMonitors.ps1`/`StartMonitors.ps1`), et `CollectSwitchInfo.ps1.broken` — à choisir lesquels sont réellement utilisés avant de supprimer les autres.

## Bug pré-existant découvert pendant la validation

En testant la syntaxe de tous les scripts modifiés, `CollectStorageInfo.ps1` contenait une erreur de syntaxe **déjà présente avant nos changements** : `$_.redundancy-status` (accès de propriété avec tiret non protégé par des guillemets) empêchait le script entier de s'analyser correctement. Corrigé en `$_.'redundancy-status'`, cohérent avec les autres accès à des propriétés à tiret dans le même fichier.

## Validation effectuée (phases 4 à 7)

- Vérification syntaxique de tous les scripts PowerShell modifiés/créés via le parseur PowerShell.
- `BackupManager.ps1` : `backup`, `list` et `restore` testés en conditions réelles sur une base de test.
- `AlertManager.ps1` : testé en conditions réelles contre un backend de test — déclenchement d'alerte et notification de reprise confirmés dans les logs.
- Build frontend relancé après les changements d'`AdminPanel.jsx` — toujours réussi (même avertissement `Stats.jsx` préexistant, sans rapport).
- Tous les fichiers temporaires de test ont été supprimés après validation.

## Ce qui reste bloqué sur des informations externes

- Le binaire `SnmpWalk.exe` doit être déposé dans `scripts\SnmpWalk\`.
- Identifiants vCenter/ESXi et Seagate réels pour tester les collecteurs en conditions réelles.
- URL/IP de production réelle pour `VITE_API_URL` (actuellement configurable mais toujours par défaut sur `localhost:4000`).
- URL de webhook réelle pour `AlertManager.ps1` (`scripts/config.json:webhookUrl`, vide pour l'instant).
- Règles d'alerte définitives (seuils, destinataires) à valider avec vous si le comportement par défaut (alerte dès la 1ère panne si `debounceCount=0`) ne convient pas.
- Décision sur les fichiers/scripts orphelins ou redondants listés en phase 8.
