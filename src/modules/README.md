# modules

## Overview
Feature module extensions providing specialized raid puzzles, spatial routing, altimetry, and cartography tools according to the ScoutRaider Hub v2.0 Standard.

## Standard v2 Architecture
Toutes les extensions modulaires suivent la spécification définie dans [HUB_MODULE_STANDARD_SPECIFICATION.md](../../docs/HUB_MODULE_STANDARD_SPECIFICATION.md) :
- Distribution sous forme de package autonome `.zip`
- Moteur algorithmique pur (`logic/`)
- Composants interactifs optionnels (`components/` / `ui/`)
- Déclaration stricte des capacités d'encodage (`map_path`, `elevation_profile`, `map_overview`, `alphabetic`, etc.)

## Distribution S3 Garage
Les modules builtin sont distribués via le bucket Garage S3 `scoutraider-assets` :
- **Endpoint** : `https://s3-scoutraider.silverhorse.fr`
- **Préfixe** : `modules/`
- **Convention** : `{module_id}-{version}.zip` (ex. `morse-2.0.0.zip`)
- **Index global** : `modules/catalog_v2.json`
- **Publication** : `POST /api/hub/publish` (backend FastAPI) ou `scripts/package_modules.py` (batch)
- **Téléchargement** : URL publique `https://s3-scoutraider.silverhorse.fr/scoutraider-assets/modules/{id}-{version}.zip`

## Subdirectories & Boundaries
- gilwell: [gilwell](./gilwell/README.md) - Module de référence standardisé pour le relevé d'azimuts et métrages (Path to Gilwell) avec moteur vectoriel SVG et éditeur WYSIWYG.

