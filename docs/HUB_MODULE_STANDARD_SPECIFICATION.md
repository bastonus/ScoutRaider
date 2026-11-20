# Spécification Technique du Standard de Module ScoutRaider (v2.0)
*Hub Unifié, Format de Paquetage Unique ZIP, Typologie Complète & Compatibilité S3*

---

## 1. Contexte & Philosophie d'Architecture

ScoutRaider Suite évolue d'un système monolithique de scripts de chiffrement vers un **Hub Modulaire Unifié**.
L'archive de référence `gilwell-studio-—-éditeur-wysiwyg-typescript.zip` a établi un niveau d'exigence inédit : un module ne se limite plus à une simple fonction de chiffrement textuel, mais constitue une brique logicielle riche comprenant :
- Un moteur d'exécution algorithmique pur et déterministe (TypeScript / Python).
- Des types de données d'entrée/sortie strictement typés (azimuts, distances, POI, connecteurs, polysegments).
- Des interfaces interactives WYSIWYG pour l'éditeur (React / SVG).
- Des gabarits et métriques pour le rendu d'impression à 300 DPI (PDF / WeasyPrint).
- Des métadonnées claires pour la résolution de dépendances et l'orchestration pédagogique.

Cette spécification définit le **Standard v2.0** pour l'ensemble des ressources distribuées via le Hub ScoutRaider.

---

## 2. Format de Paquetage Unique (.zip)

Tous les modules et ressources du Hub sont distribués sous forme d'une archive `.zip` unique et autonome.

### 2.1 Arborescence Standard d'un Paquet

```text
<package_id>-<version>.zip
├── manifest.json              # [OBLIGATOIRE] Métadonnées strictement typées selon le JSON Schema v2
├── README.md                  # [OBLIGATOIRE] Documentation technique et pédagogique scoute
├── icon.svg                   # [OBLIGATOIRE] Icône vectorielle du module (format 1:1, min 64x64)
├── preview.png                # [OPTIONNEL] Bannière de prévisualisation (ratio 16:9, min 640x360)
│
├── logic/                     # [OBLIGATOIRE pour crypto_module et syntax_extension]
│   ├── index.ts (ou main.py)  # Point d'entrée de calcul (sans dépendance UI)
│   └── types.ts               # Définitions TypeScript / Pydantic des entrées/sorties
│
├── ui/                        # [OPTIONNEL] Composants visuels pour l'éditeur de carnet
│   ├── EditorComponent.tsx    # Composant WYSIWYG de personnalisation
│   └── SheetView.tsx          # Vue carnet en direct
│
└── assets/                    # [OPTIONNEL] Ressources statiques
    ├── fonts/                 # Polices personnalisées (TTF/OTF/WOFF2)
    ├── templates/             # Gabarits HTML/Jinja/SVG pour l'export WeasyPrint
    └── tables/                # Tables de substitution, grilles, alphabets d'annexes
```

### 2.2 Règles d'Intégrité et de Sécurité de l'Archive
Le serveur du Hub applique les contrôles de sécurité suivants lors de la validation ou du téléversement d'un paquet :
1. **Protection Zip-Slip** : Aucun chemin relatif ne doit contenir `..` ni tenter de résoudre hors du répertoire cible racine.
2. **Protection Zip-Bomb** :
   - Taille maximale décompressée : **50 Mo**.
   - Nombre maximal de fichiers : **250**.
   - Taux de compression maximal toléré : **100:1**.
3. **Immutabilité des paquets** : Une fois une version `<version>` publiée pour un `<package_id>`, l'archive ne peut être réécrite. Une évolution nécessite l'incrémentation du numéro de version selon **SemVer 2.0.0**.

---

## 3. Typologie Complète des Ressources du Hub

Le Hub ScoutRaider réunit 5 familles de ressources sous un modèle de données unifié :

| Type de Ressource (`resource_type`) | Description | Capacités / Spécificités |
| :--- | :--- | :--- |
| **`crypto_module`** | Modules de chiffrement, d'encodage, de guidage et de restitution topographique | Déclare une capacité d'entrée/sortie (`data_capability`) : `map_path`, `elevation_profile`, `map_overview`, `panoramic_sketch`, `numeric`, `alphabetic`, `alphanumeric`, `symbolic_visual`. |
| **`map_provider`** | Fonds de cartes et couches topographiques | Tuiles raster/vectorielles (`xyz`, `wmts`, `tms`, `wms`), paramètres d'accès, clés API, projections. |
| **`raid_trame`** | Trames de Raid (anciennement « Orchestrations ») | Règles pédagogiques de progression scoute, contraintes de diffraction, graphe de dépendances vers les modules requis. |
| **`theme_style`** | Thèmes graphiques, styles d'export et gabarits | Palettes, typographies, règles CSS d'impression WeasyPrint, habillage narratif. |
| **`syntax_extension`** | Extensions de blocs pour l'éditeur de carnet | Nouveaux blocs WYSIWYG (croquis panoramique, rapport météo, méditation spirituelle). |

---

## 4. Spécification Détaillée des Manifestes par Type

### 4.1 Modules d'Encodage, de Chiffrement & de Topographie (`crypto_module`)

Le manifeste doit obligatoirement expliciter la capacité de traitement du module (`data_capability`) :

- **`map_path` / `routing`** : Encodage d'un tracé spatial du point A au point B, ou séquence d'itinéraires (séquence d'azimuts en degrés 0-360° et distances/métrages en mètres, coordonnées GPS, POI intermédiaires). *Exemple : Relevé Gilwell.*
- **`elevation_profile`** : Profil altimétrique et graphique de relief le long du parcours (altitudes min/max, dénivelés positifs/négatifs D+/D-, pentes en %, jalons de points d'eau et de cols). *Exemple : Profil Altimétrique Vectoriel.*
- **`map_overview`** : Cartouche d'aperçu général / vue synoptique du raid complet (rose des vents, échelle graphique, boîte de sécurité/numéros d'urgence, découpage des tronçons sur fond cartographique).
- **`panoramic_sketch`** : Croquis panoramique ou d'observation visuelle de paysage pour l'épreuve de repérage.
- **`numeric`** : Encode exclusivement des données numériques (coordonnées chiffrées, distances, dates, codes matriciels).
- **`alphabetic`** : Encode des lettres alphabétiques (A-Z). *Exemple : Code Avocat (A=K), Code Cassis (K=6), Morse alphabétique.*
- **`alphanumeric`** : Encode lettres et chiffres. *Exemple : Carré de Polybe 6×6, Chiffre de Vigenère étendu.*
- **`symbolic_visual`** : Encodage graphique basé sur des symboles, glyphes ou signaux. *Exemple : Croix des Templiers, Pavillons Maritimes NATO, Sémaphore / Drapeaux.*

#### Exemple de `manifest.json` pour un module Spatial / Itinéraire (Gilwell v2) :
```json
{
  "$schema": "https://scoutraider.org/schemas/v2/module.schema.json",
  "schema_version": "2.0",
  "id": "gilwell",
  "name": "Relevé Gilwell Studio",
  "version": "2.0.0",
  "resource_type": "crypto_module",
  "author": "ScoutRaider Core Team",
  "license": "MIT",
  "description": "Moteur WYSIWYG de relevé de route d'azimuts et distances avec connecteurs de lecture, export vectoriel SVG et WeasyPrint 300 DPI.",
  "data_capability": "map_path",
  "supported_inputs": ["poly_segments", "azimut_distance_list"],
  "render_type": "svg",
  "entrypoint": "logic/GilwellEngine.ts",
  "ui_component": "ui/GilwellSheet.tsx",
  "pedagogy": {
    "recommended_levels": ["seconde_classe", "premiere_classe", "raider"],
    "difficulty_weight": 3.5,
    "rules_explanation": "Le relevé Gilwell est optimal sur une succession de 3 à 8 changements d'azimuts sur sentier ou hors-piste."
  },
  "constraints": {
    "min_distance_m": 800.0,
    "max_distance_m": 2500.0,
    "max_azimuts": 8,
    "allow_consecutive": false,
    "max_proportion": 0.25,
    "forbidden_zones": ["high_poi_density"]
  },
  "annexes": [
    {
      "id": "alphabet_gilwell",
      "title": "Aide-mémoire de lecture des azimuts Gilwell",
      "file": "assets/tables/gilwell_guide.svg"
    }
  ],
  "assets": [
    "assets/fonts/ScoutSymbols.ttf"
  ]
}
```

#### Exemple de `manifest.json` pour un module de Profil Altimétrique (`elevation_profile`) :
```json
{
  "$schema": "https://scoutraider.org/schemas/v2/module.schema.json",
  "schema_version": "2.0",
  "id": "profil_altimetrique",
  "name": "Profil Altimétrique & Dénivelé",
  "version": "2.0.0",
  "resource_type": "crypto_module",
  "author": "ScoutRaider Core Team",
  "license": "MIT",
  "description": "Calcul et tracé vectoriel du profil altimétrique (courbes de niveau, D+, D-, altitude min/max, pente moyenne et jalons de sécurité).",
  "data_capability": "elevation_profile",
  "supported_inputs": ["elevation_points", "poly_segments"],
  "render_type": "svg",
  "entrypoint": "logic/ElevationEngine.ts",
  "pedagogy": {
    "recommended_levels": ["louveteaux", "seconde_classe", "premiere_classe", "raider"],
    "difficulty_weight": 1.0,
    "rules_explanation": "Le profil altimétrique permet à la patrouille d'anticiper les dénivelés critiques et les points d'eau."
  },
  "constraints": {
    "min_distance_m": 0.0,
    "max_distance_m": null,
    "max_proportion": 0.20,
    "allow_consecutive": false
  }
}
```

#### Exemple de `manifest.json` pour un Aperçu Général de la Carte (`map_overview`) :
```json
{
  "$schema": "https://scoutraider.org/schemas/v2/module.schema.json",
  "schema_version": "2.0",
  "id": "apercu_synoptique_carte",
  "name": "Aperçu Synoptique de Carte",
  "version": "2.0.0",
  "resource_type": "crypto_module",
  "author": "ScoutRaider Core Team",
  "license": "MIT",
  "description": "Vue d'ensemble cartographique de synthèse avec tracé global, points de contrôle numérotés, zone de bivouac et cartouche de sécurité.",
  "data_capability": "map_overview",
  "supported_inputs": ["full_itinerary_track", "waypoints"],
  "render_type": "map",
  "entrypoint": "logic/SynopticMapEngine.ts"
}
```

---

### 4.2 Fonds de Cartes & Cartes Personnalisées (`map_provider`)

Permet d'ajouter des couches cartographiques soit intégrées (IGN, OpenStreetMap, Mapy.cz), soit personnalisées via des flux de tuiles raster ou vectorielles.

#### Exemple de `manifest.json` pour une Carte Personnalisée :
```json
{
  "$schema": "https://scoutraider.org/schemas/v2/map.schema.json",
  "schema_version": "2.0",
  "id": "swiss_topo_custom",
  "name": "Swisstopo Randonnée 1:25k",
  "version": "1.0.0",
  "resource_type": "map_provider",
  "author": "Troupe 1ère Genève",
  "description": "Fond topographique officiel suisse haute précision pour les raids alpins.",
  "map_config": {
    "tile_type": "xyz",
    "tile_url": "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "min_zoom": 6,
    "max_zoom": 19,
    "projection": "EPSG:3857",
    "attribution": "© Swisstopo",
    "requires_auth": false,
    "auth_param_name": null,
    "custom_headers": {
      "User-Agent": "ScoutRaider-Desktop/2.0"
    }
  },
  "is_satellite": false,
  "offline_cache_allowed": true
}
```

---

### 4.3 Trames de Raid (`raid_trame` — anciennement « Orchestrations »)

Une Trame de Raid définit les règles d'agencement des étapes et déclare ses dépendances strictes envers les modules de chiffrement nécessaires à sa réalisation.

#### Exemple de `manifest.json` pour une Trame de Raid :
```json
{
  "$schema": "https://scoutraider.org/schemas/v2/trame.schema.json",
  "schema_version": "2.0",
  "id": "raid_premiere_classe",
  "name": "Trame Officielle — Raid de Première Classe",
  "version": "2.0.0",
  "resource_type": "raid_trame",
  "author": "Commission Pédagogique Nationale",
  "description": "Trame d'épreuve d'autonomie complète sur 35 km avec alternance d'azimuts purs (Gilwell), croquis panoramique, messages chiffrés et bivouac isolé.",
  "target_audience": {
    "age_group": "eclaireurs",
    "scout_class": "premiere_classe",
    "typical_duration_hours": 36,
    "recommended_distance_km": { "min": 25.0, "max": 40.0 }
  },
  "dependencies": {
    "required_modules": [
      { "id": "gilwell", "version": ">=2.0.0", "role": "croquis_route_azimut" },
      { "id": "morse", "version": ">=1.0.0", "role": "signalisation_optique" },
      { "id": "templier", "version": ">=1.0.0", "role": "message_spirituel" },
      { "id": "carte_ign", "version": ">=1.0.0", "role": "topographie_base" }
    ],
    "recommended_map": "PLAN.IGN",
    "default_theme": "chemins_epiques"
  },
  "sequencing_rules": {
    "max_consecutive_written_codes": 2,
    "mandatory_bivouac_checkpoint": true,
    "first_stage_requires_clear_instructions": true,
    "final_stage_requires_secret_code": true
  }
}
```

---

### 4.4 Thèmes & Styles d'Export (`theme_style`)

Définit la feuille de style CSS et les métadonnées de mise en page pour l'export WeasyPrint (300 DPI) et le carnet Web.

```json
{
  "$schema": "https://scoutraider.org/schemas/v2/theme.schema.json",
  "schema_version": "2.0",
  "id": "chemins_epiques",
  "name": "Chemins Épiques — Papier Rustique",
  "version": "1.2.0",
  "resource_type": "theme_style",
  "author": "Atelier Typographique Scout",
  "description": "Style soigné imitation papier parcheminé avec ornements héraldiques discrets et polices serif pour un carnet de raid traditionnel.",
  "colors": {
    "primary": "#451a03",
    "accent": "#d97706",
    "background_paper": "#fef3c7",
    "grid_lines": "#e5e7eb"
  },
  "fonts": [
    { "family": "EB Garamond", "src": "assets/fonts/EBGaramond-Regular.ttf", "weight": "400" },
    { "family": "EB Garamond", "src": "assets/fonts/EBGaramond-Bold.ttf", "weight": "700" }
  ],
  "weasyprint_stylesheet": "assets/templates/weasyprint_carnet.css",
  "web_stylesheet": "assets/templates/web_carnet.css"
}
```

---

## 5. Stockage Objet S3 & Distribution Distante

### 5.1 Architecture de Stockage (Garage S3)
Les archives de modules sont hébergées de manière immuable sur le bucket S3 ScoutRaider (`GarageClient`) :

```text
s3://<GARAGE_BUCKET>/
├── hub/
│   ├── catalog.json                 # Index complet du Hub (mis à jour à chaque publication)
│   ├── crypto_module/
│   │   ├── gilwell/
│   │   │   ├── gilwell-2.0.0.zip
│   │   │   └── gilwell-1.0.0.zip
│   │   └── morse/
│   │       └── morse-1.1.0.zip
│   ├── raid_trame/
│   │   └── raid_premiere_classe/
│   │       └── raid_premiere_classe-2.0.0.zip
│   └── map_provider/
│       └── swiss_topo_custom/
│           └── swiss_topo_custom-1.0.0.zip
```

### 5.2 Métadonnées S3 et Somme de Contrôle (SHA-256)
Chaque paquet uploadé sur S3 possède :
1. Un en-tête S3 `x-amz-meta-checksum-sha256` contenant le hachage SHA-256 du fichier ZIP.
2. Un en-tête `x-amz-meta-module-id` et `x-amz-meta-module-version`.
3. Un `Cache-Control: max-age=31536000, immutable` (garantie d'inviolabilité du cache CDN).

Le client de l'application desktop (ou l'agent IA) télécharge l'archive, recalcule le hash SHA-256 localement avant décompression, et rejette le paquet en cas de non-concordance.

---

## 6. Schéma de Validation JSON Schema v2

Le fichier `$schema` de référence est hébergé sur le serveur et intégré au validateur backend Pydantic. Il valide formellement la présence des champs obligatoires, le format des identifiants (kebab-case minuscule), la conformité SemVer et la cohérence de `data_capability` avec le `resource_type`.
