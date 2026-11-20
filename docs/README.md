# Index de la Documentation ScoutRaider

Ce dossier regroupe la documentation produit, technique, pédagogique et historique du projet.

---

## 🧭 Feuille de Route & Spécifications Actives

- **[ROADMAP.md](./ROADMAP.md)** : Feuille de route produit et technique consolidée (objectifs court et moyen terme).
- **[PLAN_IMPLEMENTATION.md](../PLAN_IMPLEMENTATION.md)** : Plan d'action priorisé P0–P3 issu de l'audit de santé du code (sécurité, CI, tests, découpage modulaire).
- **[PRODUCTION_TESTS.md](../PRODUCTION_TESTS.md)** : Rapport de recette des 31 tests d'intégration en production sur `scoutraider.silverhorse.fr`.
- **[CHANGELOG.md](../CHANGELOG.md)** : Journal officiel des versions et historique des modifications.

---

## 🏕️ Pédagogie & Métier Scout

- **[pédagogie_scout_raid.md](./pédagogie_scout_raid.md)** : Recommandations pédagogiques, standards de marche, règles de sécurité et épreuves par niveau (Guides et Scouts d'Europe).

---

## 🏛️ Contrats d'Architecture (EGM)

- **[README.md Racine](../README.md)** : Blueprint architectural global de ScoutRaider (Hay).
- **[electron/README.md](../electron/README.md)** : Substrat desktop Electron, pont IPC et moteur WeasyPrint.
- **[backend/README.md](../backend/README.md)** : API REST asynchrone FastAPI, persistance PostgreSQL et stockage S3.
- **[src/README.md](../src/README.md)** : Application frontend React TypeScript (cartographie, carnet textuel).
- **[legacy/README.md](../legacy/README.md)** : Algorithmes et modules de référence historiques.

---

## 🗄️ Archives Historiques

Les anciens plans de développement et feuilles de route des versions initiales sont conservés pour référence :
- **[legacy_electron_implementation_plan.md](./archive/legacy_electron_implementation_plan.md)** : Plan de transition de l'interface lors du passage initial de Python vers Electron/TypeScript.
- **[legacy_roadmap_v0.2.md](./archive/legacy_roadmap_v0.2.md)** : Ancienne feuille de route détaillée des versions Beta 0.1.x et 0.2.x.
