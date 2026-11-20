# ScoutRaider Suite \u2014 Roadmap des Fonctionnalit\u00E9s

> **Légende :**
> - 🟢 **Facile** (< 2h, changements isolés) — 🟡 **Moyen** (2–6h, multi-fichiers) — 🔴 **Difficile** (> 6h, architecture lourde)
> - ⭐ Priorité : **P0** = Critique/Bloquant — **P1** = Important — **P2** = Amélioration — **P3** = Nice-to-have
> - ✅ Déjà implémenté — 🔧 Partiellement implémenté

---

## 📦 v0.2.0-beta (Current) — 13/04/2026

Cette version initie une **refonte totale de l'UI**, pour l'instant concentrée sur la partie **Carte (Map)**. C'est une mise à jour majeure préparant un design plus simple et une refonte globale de tous les outils de préparation.

- [x] **Refonte visuelle de la Carte** : Modernisation des notifications, curseurs et interactions.
- [ ] **Simplification de l'UI** : Allègement des menus et amélioration de l'ergonomie (en cours).
- [ ] **Mise à jour majeure des outils** : Refonte programmée des outils de préparation pour un workflow plus fluide.

---

## 📦 v0.1.8-beta — 08/04/2026

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

### 11. 🔴 Persistance des labels Azimut ⭐ P1
- [ ] Corriger le bug où les labels d'azimut (textes rouges) disparaissent après l'utilisation de l'outil « Ajuster l'azimut ».
- [ ] S'assurer que les labels redeviennent visibles dès que l'on quitte l'outil d'ajustement.

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
- [x] Fusionner l'overlay de recherche "Calcul d'itinéraires" avec le petit carré d'information (distance/kilométrage) en bas de la carte.
- [x] Créer une bulle unifiée : la recherche met à jour dynamiquement le kilométrage affiché dans le même conteneur.
- [x] Design : Aspect "bulle flottante" intégrée, évitant la superposition maladroite actuelle.

### 15. ✅ Géolocalisation préemptive au démarrage ⭐ P1
- [x] Lancer la récupération de la localisation utilisateur dès le lancement de l'application, *avant* l'initialisation visuelle de la carte.
- [x] Éviter le "saut" visuel (téléportation depuis Paris) en chargeant directement la carte sur la position trouvée.
- [x] Maintenir un fallback sur Paris si la localisation est indisponible ou trop lente.

### 16. ✅ Notifications de la Carte (Chevauchement & Erreurs) ⭐ P1
- [x] **Chevauchement détecté** : Remplacer l'alerte texte simple par une bulle de notification à fond teinté jaune (ex: `rgba(245, 158, 11, 0.15)`) avec texte blanc et titre jaune ("Chevauchement détecté").
- [x] **Design du Chevauchement** : Afficher en dessous du titre l'étape source et l'étape destination (ex: `[C] - - - [D]`) qui posent problème, pour une lecture rapide visuelle.
- [x] **Suppression** : Ne *jamais* afficher de notification pour "Itinéraire calculé" (retirer ce comportement du code, le retour visuel du tracé suffit).

### 17. 🟡 Navigation globale avec Espace (Pan) ⭐ P1
- [ ] Permettre le déplacement de la carte (Pan) depuis n'importe quel outil en maintenant la touche `Espace`.
- [ ] Changer le curseur en **main ouverte** (`csr_main_hand.svg`) lors de l'appui sur `Espace`.
- [ ] Changer le curseur en **main fermée** (`csr_main_grab.svg`) lors du clic gauche maintenu pour déplacer.

## P1 — MODERNISATION RÉACTIVE DES OUTILS ⭐ P1
*Ce bloc regroupe les améliorations visuelles et les corrections techniques essentielles pour chaque outil de la carte.*

### 23. 🟡 Système de Design des Curseurs Professionnel ⭐ P2
Consolider les règles visuelles pour tous les curseurs de l'application :
- **Positionnement** : Tous les indicateurs d'action doivent être placés systématiquement dans le **coin inférieur droit** du curseur principal.
- **Palette de Couleurs** :
    - **Remplissage (Fill)** : Noir pour les formes fermées du curseur principal.
    - **Contour/Sélecteur** : Blanc pour assurer le contraste.
    - **Accents (Indicateurs)** : Utiliser le **Bleu** pour mettre en valeur les icônes d'action, avec des détails internes en **Blanc**.
- **Réactivité & Contraste** :
    - Assurer un alignement parfait entre le pointeur système et la "pointe" du SVG.
    - Pour les curseurs monochromes/sans forme interne, implémenter une inversion intelligente du contraste (foncé sur fond clair, clair sur fond foncé).
- **Consistance Visuelle** : Si un indicateur est à une échelle différente, adapter son épaisseur de trait (`stroke-width`) pour qu'elle corresponde visuellement à celle du curseur principal.
- **Lisibilité** : Garantir un espacement propre et une lisibilité maximale pour chaque état du curseur.
- **Note Technique** : Utiliser les fichiers SVG du dossier `ui/workspace/icons/` (préfixes `csr_` pour les bases de curseurs, `ind_` pour les indicateurs, `marker_` pour les épingles).

### 24. 🧱 Spécifications par Outil (Design & Stabilité)

#### A. Outil Itinéraire (Route) ⭐ P1
- [ ] **Curseur custom** : Utiliser `ui/workspace/icons/csr_itinerary_plus.svg` (basé sur `csr_marker_base.svg` + `ind_plus`) avec remplissage **Noir**, contour **Blanc** et indicateur **Bleu** en bas à droite.
- [ ] **Dynamicité** : Remplacer le rond central par la lettre de l'étape de l'itinéraire (feedback temps-réel).
- [ ] **Fusion Segmentation** : Intégrer les nœuds/azimuts comme "Paramètres avancés" et supprimer l'onglet indépendant.
- [ ] **Marqueurs** : Remplacer les ronds d'étape par des épingles `ui/workspace/icons/marker_stage.svg` bleues à bordure blanche (lettre au centre).

#### B. Outil Nœud (N) ⭐ P0
- [ ] **Curseur contextuel** : 
    - Défaut : `ui/workspace/icons/csr_main_pointer.svg` avec indicateur `ui/workspace/icons/ind_node.svg` (Bleu/Blanc) en bas à droite.
    - Survol tracé : `ui/workspace/icons/csr_main_hand.svg` avec le même indicateur.
    - Drag & Drop : Utiliser `ui/workspace/icons/csr_main_grab.svg` avec indicateur `ui/workspace/icons/ind_move_h.svg` (Bleu/Blanc).
- [ ] **Règles de Drag & Drop** :
    - Autoriser le déplacement des nœuds **UNIQUEMENT** lorsque l'outil Nœud est actif.
    - Les nœuds doivent **glisser le long de l'itinéraire** (contrainte de tracé) lors du déplacement.
    - Lors du "Drop" : Recalculer automatiquement les segments et **mettre à jour visuellement** les labels d'azimut (actuellement calculés mais non affichés).
- [ ] **Correctif Stabilité** : 🔴 Résoudre le bug où les nœuds ajoutés/supprimés ne s'affichent pas sur la carte malgré la notification de succès.

#### C. Outil Azimut (A) ⭐ P1
- [ ] **Curseur contextuel** : Défaut `ui/workspace/icons/csr_main_pointer.svg` avec indicateur `ui/workspace/icons/ind_compass.svg` (Bleu/Blanc) en bas à droite. Survol poignée : `ui/workspace/icons/csr_main_move.svg` sans indicateur.
- [ ] **Correctif Stabilité** : 🔴 Garantir la persistance des labels d'azimut (textes rouges) après utilisation de l'outil d'ajustement.

#### D. Outil Encodage d'itinéraire ⭐ P0
- [ ] **Correctif Critique** : 🔴 Résoudre le crash `IDX is not defined` qui bloque l'outil.
- [ ] **Brainstorm UX/Architecture** : Réfléchir à une version plus efficiente de l'assignation des modules.
- [ ] **Curseur** : À mettre à jour une fois le nouveau design validé (TBD lors du brainstorm).

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

### 19. 🟡 Refonte Bibliothèque d'Encodage ("Codes et épreuves") ⭐ P1
> Fichier : `ui/workspace/library_dock.py`
- [ ] Renommer l'onglet actuel ("Codes et épreuves") en "Types d'encodage" ou "Bibliothèque d'encodage".
- [ ] Rôle strict : Cet onglet doit être un pur **éditeur / visualiseur** de bibliothèque, il ne doit PAS permettre de glisser-déposer pour assigner à la carte (afin d'éviter la redite avec l'outil Encodage).
- [ ] Afficher un aperçu visuel (image/thumbnail) généré automatiquement ou ajouté dans le `manifest.json`.
- [ ] Gérer les informations détaillées (descriptions, contraintes, etc.) au clic ou au survol.

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

### 23. 🟡 Refonte Majeure : Outil Encodage & UI "Ligne de Métro" ⭐ P1
*Cette refonte vise à réorganiser l'assignation des encodages en créant une Trinité cohérente : L'Outil Carte (Métro), la Bibliothèque (Types) et le Bouton d'Orchestration.*

#### A. Bibliothèque d'Encodages (Ex-"Codes et épreuves")
> Fichier : `ui/workspace/library_dock.py`
- [ ] Renommer l'onglet `Codes et épreuves` en `Bibliothèque d'encodages` (ou `Types d'encodage`).
- [ ] Rôle strict : Pure interface de consultation/édition de bibliothèque.
- [ ] Supprimer toute logique de drag-and-drop vers la carte (pour contrer la redite avec l'Outil Encodage).
- [ ] Afficher pour chaque module : une preview miniature (image générée ou issue du `manifest.json`), sa description, et un panel pour éditer ses paramètres internes (ex: paramétrages de vigenère).

#### B. UI de l'Outil Encodage sur la Carte (L'interface)
> Fichier : `ui/workspace/map_template.html` & interface JS
L'activation de l'Outil Encodage déclenche les changements de vue suivants :
- [ ] **Dégagement de l'espace visuel** : Masquer automatiquement la barre de recherche, la vue satellite, et le bouton de géolocalisation pour libérer tout le haut de l'écran.
- [ ] **Légende Dynamique** : En bas à gauche, afficher un discret panneau Légende reliant chaque code couleur à son nom (ex: 🔴 Morse, 🔵 Polybe, etc.), avec un fond semi-transparent propre.
- [ ] **Rendu de l'Itinéraire sur la Map** :
  - L'affichage "classique" des étapes est masqué au profit du "Style Métro".
  - Les Nœuds/Tronçons s'affichent comme des ronds blancs cerclés de la couleur de l'encodage assigné.
  - Les Étapes (A, B) s'affichent en gros `A`, entourées de la couleur de la séquence qui leur succède.
  - Par défaut : tous les ronds blancs sont associés à une couleur "neutre" correspondant à l'IGN pur.

#### C. La Barre Flottante "Ligne de Métro" (Le workflow)
- [ ] Créer une barre d'outils flottante horizontale située en haut de l'écran (à la place de la barre de recherche masquée).
- [ ] Afficher explicitement l'itinéraire sous la forme d'un schéma Ligne de Métro :
  - `(Gros A) — o — o — o — (Gros B) — o — o — (Gros C)`
  - Chaque `o` est textuellement un nœud cliquable.
- [ ] Granularité Fine : Permettre de sélectionner, **depuis cette ligne de métro**, un ensemble strict de points/nœuds contigus (clic-glisser rapide + raccourcis). Ne SURTOUT PAS forcer l'assignation par bloc d'étapes (A vers B entier). L'utilisateur doit choisir "tronçon par tronçon" mais via une UI ultra-rapide.
- [ ] Relier la sélection à une palette d'affectation immédiate pour attribuer l'encodage aux points sélectionnés.
- [ ] Les couleurs de la timeline Métro doivent se mettre à jour instantanément pour refléter les nouvelles assignations et concorder avec la légende.

#### D. Orchestration Automatique (Le Bouton Magique)
> Fichier : `main_orchestrator.py`
- [ ] Supprimer l'aspect d'interface lourde de l'orchestrateur. Il ne doit pas être un outil en double.
- [ ] Intégrer un simple bouton "Répartition automatique des modules" directement hébergé dans la barre flottante "Ligne de Métro" (ou juste en dessous).
- [ ] Ce bouton doit remplir/compléter uniquement les trous non-assignés du trajet.
- [ ] Important : Assurer fermement la logique de fusion pour qu'il n'écrase JAMAIS ce que l'utilisateur a déjà peint manuellement (le code Python doit respecter `manual_assignments`).
- [ ] Les paramètres précis (limites des modules, éditeur de presets) deviennent des fenêtres secondaires de configuration via le panel ou l'onglet dédiés. (Améliorer les presets actuels qui sont jugés mauvais).

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
> Fichiers : `ScoutRaider.spec`, nouveaux scripts de build
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