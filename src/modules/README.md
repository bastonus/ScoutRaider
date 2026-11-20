# modules

## Overview
Feature module extensions providing specialized raid puzzles, spatial routing, altimetry, and cartography tools according to the ScoutRaider Hub v2.0 Standard.

## Standard v2 Architecture
Toutes les extensions modulaires suivent la spécification définie dans [HUB_MODULE_STANDARD_SPECIFICATION.md](../../docs/HUB_MODULE_STANDARD_SPECIFICATION.md) :
- Distribution sous forme de package autonome `.zip`
- Moteur algorithmique pur (`logic/`)
- Composants interactifs optionnels (`components/` / `ui/`)
- Déclaration stricte des capacités d'encodage (`map_path`, `elevation_profile`, `map_overview`, `alphabetic`, etc.)

## Subdirectories & Boundaries
- gilwell: [gilwell](./gilwell/README.md) - Module de référence standardisé pour le relevé d'azimuts et métrages (Path to Gilwell) avec moteur vectoriel SVG et éditeur WYSIWYG.
