# ScoutRaider Suite \u2014 Roadmap des Fonctionnalit\u00E9s

> **Légende :**
> - 🟢 **Facile** (< 2h, changements isolés) — 🟡 **Moyen** (2–6h, multi-fichiers) — 🔴 **Difficile** (> 6h, architecture lourde)
> - ⭐ Priorité : **P0** = Critique/Bloquant — **P1** = Important — **P2** = Amélioration — **P3** = Nice-to-have
> - ✅ Déjà implémenté — 🔧 Partiellement implémenté

---

## 📦 v0.1.8-beta (Latest) — 08/04/2026

Cette version finalise la structure multi-onglets et améliore la fidélité des exports.

- [x] **Multi-Project Tabbed Workspace** : Support complet pour travailler sur plusieurs itinéraires simultanément.
- [x] **Export Format Parity** : Amélioration des exports HTML, DOCX et ODT (Rendu des images IGN, diagrammes Gilwell, etc.).
- [x] **[ATTENTION]** Les exports HTML, DOCX et ODT sont marqués comme **BETA** et ne sont pas encore certifiés pour l'usage terrain. Utilisez le PDF pour vos raids.
- [x] **Theme Editor Panel** :Nouvel outil pour créer et modifier vos thèmes visuels.
- [x] **Corrections de bugs** : Résolution des erreurs de POI et des crashs lors de la génération PDF.

---

## P0 — CORRECTIONS CRITIQUES (stabilité)

### 1. ✅ Corriger l'écriture IGN sur l'export PDF
> Fichier : `utils/pdf_helpers.py`
- [x] Identifier pourquoi le texte IGN ne s'affiche pas correctement sur les pages PDF
- [x] Vérifier l'encodage des noms de couches et des labels IGN
- [x] Tester avec les 10 thèmes existants (`themes.json`)

### 2. ✅ Réparer l'Import de `refactor_polygonalisation` ⭐ P0
> Fichier : `main.py` (L1072)
- [x] Corriger l'import error : le fichier est à la racine, pas dans `utils/`.

### 3. ✅ Corriger le chevauchement des étapes sur l'export PDF ⭐ P0
> Fichiers : `utils/pdf_helpers.py`, `main_orchestrator.py`
- [x] Remplacer la boucle archaïque `c.stringWidth()` par l'utilisation native des `Paragraph` de `reportlab.platypus`
- [x] Mesurer dynamiquement la hauteur exacte consommée via `p.wrap(width, height)` AVANT de dessiner sur le canvas
- [x] Ne déclencher un saut de page (`new_y = -1`) que si l'espace `wrap()` dépasse le `current_y` restant, éliminant tout risque de chevauchement ou de duplication du texte

### 4. 🟡 Stabiliser le Géocodage (Erreurs 400/504) ⭐ P0
> Fichier : `utils/ign_client.py`
- [x] Gérer les erreurs 400 (requête trop courte/malformée) en validant l'input avant l'envoi.
- [x] Gérer les timeouts 504 en affichant un message d'alerte discret (statusBar) au lieu d'une erreur bloquante.
- [x] Améliorer le feedback utilisateur lors d'une recherche infructueuse ou lente.
- [x] **Cache LRU** : routes et géocodage cachés en mémoire (TTL 5min, 200 entrées)
- [x] **Session HTTP persistante** : réutilisation des connexions TCP (keep-alive)
- [x] **Calcul parallèle** : `ThreadPoolExecutor` + `QThread` pour ne pas bloquer l'UI
- [x] **Overlap O(n)** : remplacement de la double boucle O(n²) par un grid hash spatial

### 5. 🟡 Optimisations du panneau Itinéraire ⭐ P0
Le panneau Itinéraire doit offrir une gestion fluide des étapes et des raccordements :
- [x] **Clarté des adresses** : Afficher uniquement l'adresse ou les coordonnées dans les champs de recherche (pas de labels A/B).
- [ ] **Visuel Google Maps** : Refondre l'UI pour ressembler à Google Maps (champs arrondis, icônes fluides).
  ![Inspiration Google Maps](file:///C:/Users/Azandikka/.gemini/antigravity/brain/29ef0434-1e5d-4962-951f-7f3e43af4c9d/media__1774649708482.png)
- [x] **Refonte de la recherche ("Inline" façon Google Maps)** :
    - Remplacer le menu déroulant flottant par un affichage complet sous les champs, intégré au layout latéral.
    - **Au focus (champ vide)** : Afficher obligatoirement "Votre position" (pointant vers la géolocalisation native) et l'historique des requêtes récentes.
    - **Lors de la frappe** : Afficher dynamiquement les résultats d'autocomplétion IGN.
- [x] **Limitation d'affichage à 3 étapes** :
    - Limiter la hauteur de la zone des étapes (idéalement via `QScrollArea`) pour afficher au maximum 3 champs simultanément.
    - Mettre en place un auto-scroll (ex: `ensureWidgetVisible`) pour cibler automatiquement le champ actif.
- [x] **Visuel de liste** : Placer les lettres (A, B, C...) à droite et afficher le métrage (distance) en bout de ligne pour chaque étape.
- [ ] **Gestion Dynamique des Étapes** :
    - **Étiquetage auto** : Les lettres (A, B, C...) se ré-indexent automatiquement lors d'un ajout, suppression ou déplacement.
    - **Recalcul fragmenté** : Déplacer une étape ne doit recalculer que les segments adjacents (ex: bouger B recalcule A->B et B->C) pour une fluidité maximale.
    - **Drag & Drop dans la Liste** : Permettre de réordonner les étapes par glisser-déposer dans le panneau latéral (avec ré-indexation A, B, C...).
    - **Drag & Drop sur la Carte** : Permettre de déplacer physiquement les marqueurs d'étape (A, B...) sur la carte. 
        - *Mécanique* : Le tracé suit approximativement (ou s'efface temporairement) puis, après un **temps de sécurité** (quelques ms de stabilisation/debounce), la **liste d'attente globale** (JobQueue) se reforme pour recalculer uniquement les segments rattachés au point déplacé, minimisant la charge.
- [x] **Édition d'étape (Crayon)** : Le bouton d'édition doit ancrer l'outil **Route (R)** sur la lettre de l'étape sélectionnée pour permettre son déplacement précis.
- [x] **Sélection d'étape** : Cliquer sur une étape dans le panneau doit centrer la carte sur ce point.

### 6. ✅ Corriger l'outil « Inverser l'itinéraire »
> Fichier : `ui/workspace/route_panel.py` → `_reverse_active()`
- [x] Analyser pourquoi l'inversion crée des trajets en vol d'oiseau (les coords sont inversées mais les routes ne sont pas recalculées entre étapes)
- [x] Après inversion des `stages`, recalculer les routes via `_calculate_route_for_stages()` au lieu de simplement inverser les coordonnées
- [x] Vérifier que les `polygonal_steps` et `manual_assignments` sont recalculés après inversion

### 7. ✅ Restaurer/recalculer les étapes absentes au chargement de fichier
> Fichiers : `state_manager.py`, `main.py`
- [x] Détecter à l'importation GeoJSON si des `polygonal_steps` sont absents
- [x] Lancer automatiquement `run_polygonalization()` si nécessaire après un `load_project()` ou un import GeoJSON
- [x] Gérer le cas d'un fichier GeoJSON brut sans métadonnées (azimuts, métrages) → les recalculer

---

## P1 — FONCTIONNALITÉS IMPORTANTES

### 6. ✅ Finir l'outil Nœuds (N) (P1)
L'outil Nœud permet de manipuler les nœuds de segmentation directement sur le tracé. Implémenté : placement, déplacement temps réel, et suppression par Alt+Clic.
> Fichiers : `main.py` → `on_node_added()` / `on_node_removed()`, `ui/workspace/map_view.py`

L'outil Nœud permet de manipuler les nœuds de segmentation directement sur le tracé :
- [x] **Placement** : cliquer sur un tronçon pour placer un nouveau nœud à cet endroit, avec calcul automatique de l'azimut
- [x] **Déplacement en temps réel** : glisser un nœud le long du tracé → recalcul de l'azimut en temps réel pendant le drag
- [x] **Suppression** : Alt+Clic sur un nœud existant → supprime le nœud et son azimut, fusionne les segments adjacents
- [x] Ajouter un feedback visuel (animation de suppression/ajout, highlight du nœud au survol)

### 7. ✅ Finir l'outil Azimut (A) (P1)
L'outil Azimut permet d'éditer manuellement les directions. Implémenté : suivi souris fluide, mise à jour des segments, et labels au survol.
> Fichier : `main.py` → `on_azimut_manually_updated()`, `ui/workspace/map_view.py`

L'outil Azimut ne fait **aucun calcul** — il édite manuellement la valeur de l'azimut, indépendamment de la cohérence avec le segment :
- [x] La flèche d'azimut doit suivre la souris en temps réel, parfaitement alignée et fluide (pas de snap)
- [x] L'utilisateur drag la poignée pour orienter la flèche → la valeur en degrés est écrite directement dans le segment
- [x] Supprimer les points rouges d'azimut parasites (red dots) sur les segments courts
- [x] Afficher la valeur de l'azimut en degrés au survol de la flèche

### 8. ✅ Implémenter l'édition des presets (panneau Difficulté)
> Fichier : `ui/workspace/difficulty_panel.py`, `utils/presets_manager.py`, `config/presets.json`
- [x] Permettre de cliquer sur un preset pour voir/éditer ses épreuves activées, leurs poids et contraintes
- [x] Créer un dialogue d'édition de preset (sliders de poids, checkboxes d'activation, limites d'occurrences)
- [x] Permettre de créer et sauvegarder des presets personnalisés (section `"custom"` de `presets.json`)

### 9. ✅ Auto-sélection de la dernière étape en mode Route (P1)
Auto-ancrage implémenté lors de l'activation de l'outil Route (R).
> Fichier : `main.py` → `set_active_tool()`
- [x] Quand on active l'outil Route, automatiquement "ancrer" la dernière étape (`_stage_anchor_idx = len(stages) - 1`)
- [x] Afficher immédiatement la preview en pointillé depuis la dernière étape
- [x] Mettre à jour le message contextuel en conséquence

### 10. ✅ Recoder l'outil Encodage (P1)
Outil Encodage refondu avec sélection rectangulaire (box), Shift+Click pour plages de segments, et interface simplifiée.
> Fichiers : `main.py`, `ui/workspace/map_view.py`, `ui/workspace/library_dock.py`
- [x] **Affichage simplifié** : en mode Encodage, afficher uniquement les nœuds (pas les étapes ni les azimuts)
- [x] **Menu au clic sur tronçon** : ouvrir un popup pour choisir le module à assigner
- [x] **Sélection multiple** :
  - [x] Ctrl+Clic pour ajouter un tronçon à la sélection
  - [x] Sélection rectangulaire (rubber band) sur la carte
- [x] Assigner en masse le module sélectionné à tous les tronçons sélectionnés
- [x] Afficher un code couleur par module (déjà défini dans `MOD_COLORS` de `library_dock.py`)

### 10. ✅ Implémenter Z-index strict pour les étapes
> Fichier : `ui/workspace/map_view.py` (JavaScript Leaflet)
- [x] S'assurer que les marqueurs de stage (A, B, C...) ont un `zIndexOffset` supérieur à tous les overlays
- [x] Vérifier que les flèches d'azimut ne masquent pas les marqueurs

### 11. ✅ Implémenter le zoom intelligent pour azimuts et métrages
> Fichier : `ui/workspace/map_view.py` (JavaScript Leaflet)
- [x] Détecter quand deux labels d'azimut/métrage sont trop proches visuellement (distance en pixels < seuil)
- [x] Masquer automatiquement les labels trop denses à faible zoom
- [x] Réafficher progressivement au zoom-in (approche « cluster » ou « priority queue »)

---

## P1 — EXPORT & IMPORT

### 12. 🟡 Refondre le panneau Export (PDF + HTML + DOCX + CSV)
> Fichiers : `ui/workspace/tools_panel.py`, `main_orchestrator.py`
- [ ] Créer un seul menu/dialogue d'export unifié avec onglets : PDF | HTML | DOCX | CSV
- [ ] **PDF** : déjà fonctionnel ✅ — ajouter des options (résolution carte, inclusion/exclusion annexes)
- [ ] **CSV** : déjà fonctionnel ✅ — ajouter le choix du séparateur (`,` ou `;`) et de l'encodage (UTF-8 / Latin-1)
- [ ] **HTML** : générer un carnet format web navigable (un fichier HTML avec CSS inline)
- [ ] **DOCX** : utiliser `python-docx` pour générer un document Word
- [ ] Rendre le bouton d'export plus visible et accessible

### 13. 🟡 Améliorer l'import GeoJSON et ajouter des formats
> Fichiers : `ui/workspace/route_panel.py` → `import_file()`, nouveau `utils/import_engine.py`
- [ ] Rendre l'import GeoJSON plus robuste :
  - [ ] Gérer les MultiLineString
  - [ ] Gérer les propriétés manquantes
  - [ ] Ajouter un dialogue de preview avec options (projection, simplification)
- [ ] Ajouter les formats d'import :
  - [ ] **GPX** : parser `<trk>` et `<rte>` → LineString
  - [ ] **KML/KMZ** : parser `<Placemark>` → LineString
- [ ] Ajouter l'export GeoJSON (sauvegarder l'itinéraire actuel)

---

## P1 — UX & NAVIGATION

### 14. 🟡 Intégration de la bulle d'info et recherche (Carte) ⭐ P1
- [ ] Fusionner l'overlay de recherche "Calcul d'itinéraires" avec le petit carré d'information (distance/kilométrage) en bas de la carte.
- [ ] Créer une bulle unifiée : la recherche met à jour dynamiquement le kilométrage affiché dans le même conteneur.
- [ ] Design : Aspect "bulle flottante" intégrée, évitant la superposition maladroite actuelle.

### 15. ✅ Géolocalisation préemptive au démarrage ⭐ P1
- [x] Lancer la récupération de la localisation utilisateur dès le lancement de l'application, *avant* l'initialisation visuelle de la carte.
- [x] Éviter le "saut" visuel (téléportation depuis Paris) en chargeant directement la carte sur la position trouvée.
- [x] Maintenir un fallback sur Paris si la localisation est indisponible ou trop lente.

---

## P2 — INTERFACE & THÈMES

### 16. ✅ Charger tous les thèmes dans le sélecteur
> Fichier : `ui/workspace/difficulty_panel.py` → combo_theme
- [x] Remplacer la liste en dur (`["Neutre", "Carnet_Contrebandier", "Aventures_Maritimes"]`) par un chargement dynamique depuis `config/themes.json`
  - Note : actuellement themes.json contient 10 thèmes (Neutre, La Mafia, Les Vikings, Le Roi Soleil, La Chevalerie, Les Gaulois, WW1, WW2, LOTR, Napoléon)
- [x] Synchroniser avec la variable `ph.CURRENT_THEME` dans l'orchestrateur

### 17. ✅ Séparer le panneau Difficulté du panneau Thème
> Fichier : `ui/workspace/difficulty_panel.py`
- [x] Extraire la section « STYLE DU CARNET PDF » (thème) dans un widget/dock séparé ou dans l'onglet Export
- [x] Le panneau Difficulté ne garde que : preset, bouton orchestrateur, résumé, validateur
- [ ] Le panneau Thème contient : sélection du thème, preview des labels, override des clés Vigenère, etc.

### 18. 🟡 Ajouter la fenêtre d'édition de presets
> Fichiers : `ui/workspace/difficulty_panel.py`, `utils/presets_manager.py`, `config/presets.json`
- [ ] Créer un dialogue `PresetEditor` :
  - [ ] Choisir les modules (épreuves) activés et désactivés
  - [ ] Ajuster les poids de chaque module (sliders ou spinboxes)
  - [ ] Régler les contraintes (max occurrences, distances min/max)
- [ ] Pouvoir créer de nouveaux presets personnalisés (sauvegardés dans `presets.json` → section `"custom"`)
- [ ] Pouvoir éditer les presets existants (factory → en lecture seule, custom → modifiables)

### 19. 🟡 Épreuves expandables (descriptions, contraintes, preview)
> Fichier : `ui/workspace/library_dock.py`
- [ ] Au clic ou au survol d'une épreuve dans la library, afficher un popup/panneau avec :
  - [ ] Le nom complet et la description (depuis le `manifest.json` du module)
  - [ ] Les contraintes (catégories, distances, occurrences)
  - [ ] Une image de preview (capture d'écran du PDF généré par ce module)
- [ ] Charger ces infos à partir des `manifest.json` dans chaque dossier `modules/`

### 20. 🔴 Onglets multiples pour projets (multi-map tabs)
> Fichier : `main.py` → `ScoutWorkspace`
- [ ] Remplacer le `setCentralWidget(map_view)` par un `QTabWidget` central
- [ ] Chaque onglet encapsule un `MapView` + un `StateManager` indépendant
- [ ] Permettre d'ouvrir plusieurs fichiers `.scoutproj` simultanément
- [ ] Gérer les raccourcis Ctrl+Tab pour naviguer entre projets

### 21. 🔴 Refonte complète de l'UI moderne
> Tous les fichiers `ui/workspace/`, `main.py`, `style.qss`
- [ ] Définir une charte graphique professionnelle complète (couleurs, typographie, icônes)
- [ ] Remplacer les boutons texte par des icônes SVG avec tooltips
- [ ] Ajouter des micro-animations (transitions, hover effects)
- [ ] Implémenter un mode clair/sombre
- [ ] Revoir l'agencement des docks pour un workflow plus intuitif
- [ ] Ajouter un écran d'accueil (Welcome Page) avec projets récents
Ajout de curseur custom pour les outils, ainsi que des preview au survol des outils pour voir un petit gif d'expliaction accompagné d'un texte explicatif. Ajouter des icones à chaque fenetre

---

## P2 — ARCHITECTURE MODULES

### 22. 🔴 Rendre les modules (épreuves) complètement indépendants et auto-chargés
> Fichiers : `main_orchestrator.py`, `ui/workspace/library_dock.py`, `config/config_codes.json`
- [ ] **Auto-découverte** : scanner le dossier `modules/` et charger dynamiquement tout module valide (présence de `module.py` + `manifest.json`)
  - 🔧 Partiellement implémenté dans `library_dock.py` (scan du dossier) et `main_orchestrator.py` (import dynamique)
  - [ ] Supprimer la nécessité de la liste `enabled` dans `config_codes.json` → la remplacer par un champ `enabled: true/false` dans chaque `manifest.json`
- [ ] **Manifest enrichi** : documenter le format requis du `manifest.json` :
  - [ ] `name`, `description`, `category`, `preview_image`, `author`, `version`
  - [ ] `constraints` : `min_distance_m`, `max_distance_m`, `max_azimuts`, `max_occurrences`
- [ ] **Installation de modules** :
  - 🔧 Déjà : bouton `+` dans la Library Dock copie un dossier de module
  - [ ] Ajouter le drag-and-drop d'un fichier `.zip` de module sur l'interface
  - [ ] Ajouter un système d'archive (exporter un module en `.scoutmod` → zip du dossier)
- [ ] **Documentation** : créer un `MODULES.md` avec un guide pour développeurs de modules
- [ ] **Templates** : créer un dossier `modules/_template/` avec un squelette de module

---

## P2 — CODE QUALITÉ

### 23. 🟡 Renommer variables/fichiers et commenter le code
> Tous les fichiers du projet
- [ ] Standardiser les noms :
  - [ ] `polygonal_steps` → garder (cohérent avec la segmentation)
  - [ ] `manual_assignments` → renommer si confusion avec l'auto
  - [ ] Harmoniser `epreuves` / `modules` / `challenges` / `methods` → choisir UN terme partout
- [ ] Ajouter des docstrings claires à toutes les classes et méthodes publiques
- [ ] Commenter les algorithmes complexes (polygonalisation, orchestration, overlap detection)
- [ ] Créer un `README.md` complet pour le dépôt GitHub :
  - [ ] Description du projet
  - [ ] Captures d'écran
  - [ ] Instructions d'installation
  - [ ] Guide d'utilisation rapide
  - [ ] Architecture du code

---

## P3 — FONCTIONNALITÉS AVANCÉES

### 24. 🟢 Cliquer sur une étape pour insérer un nœud (outil Route)
> Fichier : `main.py` → `on_stage_clicked()`
- [ ] Quand l'outil Route est actif, permettre de cliquer sur un marqueur d'étape (A, B, C…) pour insérer un nœud de segmentation juste après cette étape
- [ ] Recalculer l'itinéraire entre les étapes concernées

### 25. ✅ Distribution & Packaging
> Fichiers : `ScoutRaider-Suite.spec`, nouveaux scripts de build
- [x] **Windows** : créer un installeur `.exe` avec PyInstaller ou Inno Setup
  - 🔧 Le fichier `.spec` existe déjà mais nécessite une mise à jour
  - [x] Inclure toutes les dépendances (PySide6, reportlab, etc.)
  - [x] Ajouter une icône
- [x] **macOS** : créer un `.dmg` avec `create-dmg`
- [x] **Linux** : créer un `.AppImage` avec `appimagetool`
- [x] **Versioning** : mettre en place un système de versions (SemVer)
  - [x] Fichier `version.py` centralisé
  - [x] Changelog automatique via GitHub Actions
- [x] **Releases GitHub** : automatiser la création de releases avec des artefacts de build natifs
- [x] **Auto-updater** : intégrer un chercheur de mise à jour qui vérifie les releases GitHub
- [x] **README.md orienté utilisateur** : installation en un clic, captures d'écran, guide rapide


### 26. 🔴 Version Mobile (Compagnon & Création)
> Déclinaison de ScoutRaider Suite pour iOS & Android
- [ ] **Application compagnon (Joueur)** : Permettre aux scouts d'utiliser l'application sur le terrain avec GPS intégré pour valider les étapes sans imprimer le carnet ou valider des coordonnées.
- [ ] **Architecture hybride** : Évaluer l'utilisation de frameworks cross-platform (React Native, Flutter, ou Kivy/Qt pour Python).
- [ ] **UI/UX Tactile** : Adapter l'interface complexe pour un usage mobile (panneaux rétractables, map en plein écran).
- [ ] **Sync Cloud** : Synchroniser les projets (`.scoutproj`) entre l'application de bureau et l'application mobile pour concevoir sur PC et tester sur le terrain.