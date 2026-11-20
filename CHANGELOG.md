# Changelog

Tous les changements notables apportés à ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.14] - 2026-11-20

### Ajouté — Carnet textuel : badges interactifs, chiffrement visuel, bibliothèque modules

- **Badges azimut déroulants** (`AzimutToken`) : dropdown avec preview des 4 formats de navigation (Tournant, Horaire, Cardinaux, Azimut°) et sélection persistante par `navLanguage` / `onNavLanguageChange`.
- **Badges POI déroulants** (`PoiToken`) : fond coloré + flèche déroulante, liste de tous les POI cliquables, **sélection exclusive** (un seul POI actif à la fois par segment, géré par `TOGGLE_POI` dans `AppContext`).
- **Couleurs sur texte encodé** : les tokens azimut, distance et POI conservent leurs couleurs sémantiques même sur les lignes chiffrées (via `EncodedHighlightedText` qui mappe les positions source → encodé).
- **Icône sync dans la gouttière** (`BlockGutter`) : icône `Link2` sur les blocs calculés (itinéraire), rien sur les blocs manuels.
- **Bibliothèque de modules dynamique** : menu contextuel et sélecteur chargés depuis `ModuleManagementService.getAllModules()` au lieu d'une liste statique.
- **Markdown dans les commentaires** (`ManualStepHtml`) : rendu complet via `MarkdownRenderer` avec balises cipher `[cassis]…[/cassis]`, blocs ` ```morse … ``` ` et code inline.
- **Blocs d'étape A/B/C** séparés en composant autonome `StageHeaderBlock`, jamais imbriqués dans une étape.

### Corrigé

- **`CIPHER_cassis_0` / `CIPHER_morse_0` affichés bruts** dans les commentaires : `marked.js` convertissait `__CIPHER_xxx_0__` en balise bold HTML (`<strong>`) → le placeholder était détruit avant restauration. Format changé en `CIPHERPH-xxx-0-END` (sans double underscore) dans tout `MarkdownRenderer.tsx`.
- **Solutions ne s'affichaient plus** (hover ET bouton bas) : la condition `hovered` seule ignorait le mode `isSolutionView`. Restauré `(hovered || isSolutionView)` dans `ComputedStepLine` et `(hovered || isSolution)` dans `ManualCodeBlock`.
- **Hover perdu lors de l'ouverture d'un dropdown** POI ou Azimut (position fixed) : ajout d'un `hoverTimer` de 120 ms sur `onMouseLeave` dans les trois composants concernés (`StageHeaderBlock`, `ManualCodeBlock`, `ComputedStepLine`) pour laisser le temps à la souris d'atteindre le dropdown avant que le hover soit annulé.
- **Lignes calculées** : `MarkdownRenderer` retiré des `ComputedStepLine` (il génère des placeholders qui fuient dans le texte brut) — les lignes d'itinéraire utilisent exclusivement `HighlightedText` → `HighlightedTextCore`.

### Infrastructure

- Tests backend : **60/60 passed**.
- `npx tsc --noEmit` : **0 erreur**.
- `npm run build` : ✓ built in ~7 s.

## [0.3.13] - 2026-11-20
### Ajouté
- **Distribution des modules Hub v2 via Garage S3** :
  - Script `scripts/package_modules.py` : empaquète les 15 modules builtin en ZIP et les uploade dans `scoutraider-assets/modules/` sur Garage S3.
  - `backend/app/api/hub.py` : nouvel endpoint `POST /api/hub/publish` (validation Pydantic + packaging ZIP en mémoire + upload Garage S3) et `GET /api/hub/catalog/s3` (lecture de `catalog_v2.json` depuis S3).
  - `backend/app/services/s3_client.py` : méthodes `upload_module_package()`, `download_module_package()`, `upload_catalog_index()`, `get_module_url()`.
  - `backend/app/mcp/server.py` : catalogue MCP enrichi avec les URLs S3 Garage.
  - `src/logic/ModuleManagementService.ts` : interface `ManagedModule` avec `s3_url`, `s3_sha256`, `is_s3_synced` ; méthode `publishModuleToS3()`.
  - `src/components/panels/ModuleEditorModal.tsx` : bouton **"Publier dans le Bucket S3"** avec retour d'état.
  - `src/pages/ProjectsHomePage.tsx` : badge S3 Garage sur les cartes modules et bouton d'upload rapide.
  - `src/components/panels/UnifiedResourceHub.tsx` : badge `S3` avec lien de téléchargement direct sur toutes les cartes.

### Corrigé
- **Design restauré des cartes fonds de carte** (`ResourceHubCard`) :
  - Bannière 140 px pour les cartes `maps` avec image preview.
  - Badges overlay (Bloqué, Favori, Satellite, Badge texte) en haut à gauche de la bannière.
  - Logo provider en filigrane bas-droite avec gradient sombre (`item.logoImage` → img, fallback `@author` ou texte `IGN`).
  - `minHeight: 285px` pour les cartes maps avec bannière, `110px` pour les cartes compactes.
  - Bouton d'action plein-largeur sur les cartes maps.
  - `background: rgba(255,255,255,0.02)` / hover `rgba(255,255,255,0.04)`, `borderRadius: 16px`.
- **`auth.py`** : ajout de `get_current_user_optional()` manquant (référencé par `export.py`).
- **`registry.py`** : singleton `module_registry = ModuleRegistry()` ajouté en fin de fichier (exporté pour `api/mcp.py`).

### Infrastructure
- **15 modules** uploadés + `catalog_v2.json` dans `scoutraider-assets/modules/` sur Garage S3.
- Tests backend : **60/60 passed** (nouveau test `test_s3_module_storage_and_catalog` avec monkeypatch).

## [0.3.12] - 2026-11-20
### Corrigé & Infrastructure
- **Rétablissement complet du Stockage S3 (Garage) en production** :
  - **Identifiants réels synchronisés** : Remplacement des placeholders fictifs par les véritables identifiants générés par Coolify (`ViRY9mVo0wNuFGoU` et secret associé) dans les variables d'environnement de `scout-raider-web`.
  - **Création du bucket `scoutraider-assets`** : Initialisation du bucket dédié sur le cluster Garage S3 (`https://s3-scoutraider.silverhorse.fr`).
  - **Intégration Coolify Storage** : Déclaration et validation du stockage de sauvegarde S3 dans Coolify via le protocole MCP (`manage_s3_storage`).
  - **Santé de l'infrastructure certifiée** : Endpoints `/health/s3` et `/health/full` passant à `200 OK` avec `s3: "connected"`, `write_test: true`, et `read_test: true`.
  - **Configuration locale synchronisée** : Initialisation des fichiers `.env` et `backend/.env` avec validation du client asynchrone `garage_client`.

## [0.3.11] - 2026-11-18
### Ajouté
- **Contrats d'Architecture EGM (Elephant-Goldfish Model)** : Spécification complète et vérifiée de 47 contrats d'interface, invariants et effets de bord (`README.md`) sur tous les sous-systèmes du dépôt (`electron/`, `backend/`, `legacy/`, `src/`).
- **Audit de Santé du Code** : Plan d'action priorisé P0–P3 couvrant la rotation des secrets, l'automatisation CI et le refactoring d'AppContext (`PLAN_IMPLEMENTATION.md`).
- **Recette de Production** : Validation de 31 cas de tests d'intégration sur l'environnement de production `scoutraider.silverhorse.fr` (`PRODUCTION_TESTS.md`).

### Sécurité
- **Retrait des identifiants PostgreSQL en dur** : Élimination des secrets par défaut dans `Dockerfile` et `backend/app/db.py`.
- **CORS restrictif** : Autorisation stricte des domaines de production (`scoutraider.silverhorse.fr`, `scoutraider.app`).

## [0.3.10-beta] - 2026-11-17
### Ajouté
- **Endpoints de surveillance (Health checks)** : `/health`, `/health/db` et `/health/s3` pour le monitoring des conteneurs.
- **Accès aux projets partagés** : Endpoint public `/api/projects/shared/{id}` et support de l'authentification par email ou nom d'utilisateur.
- **Verrouillage optimiste** : Gestion des conflits d'édition concurrente via l'en-tête HTTP `If-Match` et suivi de révision sur les documents.

### Corrigé
- **Migrations Alembic** : Correction de l'interpolation des caractères `%` dans l'URL de connexion et utilisation native du driver asynchrone `asyncpg`.
- **Chiffrement des mots de passe** : Migration de `passlib` vers `bcrypt` direct avec coût configuré explicitement pour éviter les avertissements d'obsolescence.
- **Cycle de vie de la base de données** : Suppression de la réinitialisation automatique destructrice (`DROP SCHEMA`) au démarrage du serveur.

## [0.3.9-beta] - 2026-11-12
### Ajouté
- **Transformer vectoriel pour les dessins** : Boîte englobante projetée, 8 poignées de redimensionnement, rotation et déplacement avec aperçu fluide à 60 FPS.
- **Hiérarchie Calques / Sous-calques** : Gestion arborescente des dessins avec sélection et édition unitaire des traits (`DrawStroke`).
- **Panneau latéral contextuel** : Affichage d'informations dynamiques adaptées au type d'entité sélectionnée (itinéraire, zone, repère ou dessin).
- **Focus visuel d'itinéraire** : Itinéraire actif affiché en plein, itinéraires secondaires en pointillés cliquables.
- **Raccourcis clavier d'édition** : Raccourcis `Ctrl+T`, `Suppr`, `Échap`, `F2` et `Espace`.

### Corrigé
- **Nettoyage automatique des calques vides** : Suppression automatique des entités sans géométrie lors du changement d'outil.
- **Persistance de l'ordre d'empilement (z-index)** : Sauvegarde et restauration fidèles de l'ordre des calques dans le document.

## [0.3.8-beta] - 2026-11-06
### Ajouté
- **Transformer vectoriel pour les dessins** : boîte englobante projetée, 8 poignées de redimensionnement, rotation et déplacement, avec aperçu temps réel (60 FPS) et validation en une seule étape (compatible Ctrl+Z / Ctrl+Y).
- **Hiérarchie calques / traits** : un dessin est désormais un groupe composé de traits (`DrawStroke`) sélectionnables individuellement, chacun avec sa propre couleur, épaisseur et opacité.
- **Sous-calques dans le gestionnaire de calques** : arborescence dépliable, sélection d'un trait, changement de couleur, badge d'épaisseur et suppression unitaire.
- **Panneau gauche contextuel** : le panneau affiche les informations du calque sélectionné (itinéraire, zone, repère ou dessin) sous forme de cartes dédiées.
- **Raccourcis clavier** : `Ctrl+T` (trait ↔ groupe), `Suppr` (supprimer le trait ou le calque), `Échap` (désélectionner), avec rappels affichés dans les menus contextuels (`F2`, `Entrée`, `Espace`, `Suppr`).
- **Ordre des calques persistant** : l'ordre défini par glisser-déposer est sauvegardé dans l'état du document et restauré à l'ouverture ; il pilote désormais l'empilement (z-index) réel des calques sur la carte, le premier de la liste étant affiché au premier plan.

### Modifié
- **Focus d'itinéraire** : seul l'itinéraire sélectionné et actif est affiché en trait plein ; les autres apparaissent en pointillés et restent cliquables pour être sélectionnés.
- **Création automatique d'itinéraire** : tracer avec l'outil itinéraire alors qu'aucun itinéraire n'est sélectionné crée et active automatiquement un nouvel itinéraire.
- **Sélection unifiée** : cliquer sur un itinéraire, une zone, un repère ou un trait le sélectionne et synchronise le panneau de gauche, sans interrompre les outils d'annotation en cours.
- **Nettoyage automatique** : les calques vides (itinéraires sans étapes, dessins sans traits, zones incomplètes, repères invalides) sont supprimés au changement d'outil ou de mode.

### Corrigé
- **Clic sur un repère avec un autre outil** : le nom et l'épingle d'un repère sont désormais entièrement cliquables ; hors outils de tracé d'itinéraire, ils sélectionnent et ouvrent le repère au lieu de créer un point, une zone ou un dessin superposé. Avec le tracé pédestre ou hors piste, le clic place une étape exactement sur les coordonnées du repère, sans ouvrir sa popup d'édition.
- **Migration des anciens dessins** : les traits au format historique (`[lat, lng][]`) sont convertis automatiquement en `DrawStroke` à l'ouverture d'un document.
- **Fluidité du dessin** : conversion native des coordonnées Leaflet et verrouillage du déplacement de la carte pendant le tracé pour éviter les décalages.
- **Curseur des outils** : curseur en croix ajouté pour `annotate_area_routed` et `annotate_draw`.
- **Suppression du dernier itinéraire** : un itinéraire par défaut est recréé automatiquement.

## [0.3.3-beta] - 2026-05-11
### Ajouté
- **Bibliothèque de Cartes (Galerie)** : Refonte complète de la sélection de fonds de carte. Passage d'une simple liste à une galerie visuelle avec aperçus, badges contextuels (Satellite, Bloqué, Favori) et logos de services.
- **Support des logos dynamiques** : Les boutons de déblocage intègrent désormais les logos officiels (IGN, Mapy.cz) directement dans le texte pour une expérience plus premium.

### Modifié
- **Interface Itinéraire (RoutePanel)** : Suppression de l'en-tête redondant et uniformisation des hauteurs de lignes (40px) pour un alignement parfait avec le champ de recherche.
- **Sélecteur "Hors piste"** : Nouveau design plus compact et contrasté pour basculer entre le routage automatique et la ligne droite entre deux étapes.
- **Design Système** : Harmonisation des barres de recherche et des couleurs de fond entre les panneaux gauche et droit.

### Corrigé
- **Priorité des Notifications** : Ajustement du z-index pour s'assurer que les notifications s'affichent toujours au-dessus des fenêtres modales (Préférences, Export).
- **Stabilité visuelle** : Correction des problèmes d'écrasement des fiches dans la galerie de cartes.

## [0.3.2-beta] - 2026-05-10
### Ajouté
- **Outil Hors-piste** : Nouvel outil ajouté sur la carte (juste après l'outil de tracé principal), permettant de tracer des parcours à vol d'oiseau et des surfaces polygonales.
- **Support de formats d'export** : Prise en charge officielle de l'export en CSV et TSV, qui servira de base technique pour la future implémentation de l'export de documents plus complexes (DOCX, PDF, HTML).

### Modifié
- **Panneau d'exportation** : La fenêtre d'exportation a été entièrement refaite à neuf pour être beaucoup plus propre, claire et ergonomique.

### Corrigé
- **Stabilité des outils** : Réparations et ajustements divers sur les quatre outils principaux de la carte pour régler certains problèmes remontés.

---

## [0.3.1-beta] - 2026-05-10
### Ajouté
- **Système POI optimisé** : Fonctionne désormais pleinement sur l'application Desktop avec une récupération plus efficace via l'API Overpass.
- **Outil "Déplacer un nœud" fonctionnel** : Il est désormais possible de déplacer, ajouter ou supprimer des points sur un tracé existant.
- **Nouveau format de fichier `.srdoc`** : Passage au format "ScoutRaider Document" avec prise en charge de l'association de fichiers par le système d'exploitation.

### Modifié
- **Interface Itinéraire (Panel)** : Refonte visuelle et ergonomique du panneau latéral d'itinéraire pour une meilleure lisibilité.
- **Interactivité de la carte** : La quasi-totalité des outils (Azimut, Encodage) est désormais opérationnelle pour une édition fluide.
- **Détection des Voies Dangereuses** : Amélioration du système d'alerte contextuelle pour les routes à forte circulation.

### Corrigé
- **Corrections Electron** : Résolution des erreurs 406 lors des appels API (Overpass) en appliquant un User-Agent global et amélioration de la gestion des ressources.
