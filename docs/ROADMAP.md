# ScoutRaider — Roadmap Technique & Produit

> **Dernière mise à jour :** 19 novembre 2026  
> **Version actuelle :** `0.3.11` (Dual-target Web + Electron Desktop)  
> **Documents de référence associés :** [PLAN_IMPLEMENTATION.md](../PLAN_IMPLEMENTATION.md) (Santé du code), [PRODUCTION_TESTS.md](../PRODUCTION_TESTS.md) (Recette production), [CHANGELOG.md](../CHANGELOG.md).

---

## 🎯 Vision Globale

ScoutRaider évolue vers une plateforme unifiée permettant aux chefs scouts de concevoir des carnets d'expédition riches et fiables sur le terrain :
1. **Desktop (Electron)** : Expérience hors-ligne complète, accès système natif, impression WeasyPrint locale, fichiers `.srdoc` et `.scoutproj`.
2. **Web (SPA)** : Édition collaborative et partage en ligne sur `scoutraider.silverhorse.fr` avec synchronisation PostgreSQL et S3.

---

## 🛠️ Priorités Techniques (Santé du Code & Infrastructure)

Synthèse du plan d'action d'audit de code ([PLAN_IMPLEMENTATION.md](../PLAN_IMPLEMENTATION.md)) :

### P0 — Sécurité & Secrets (Immédiat)
- [ ] **Rotation des secrets PostgreSQL** : Remplacer les identifiants en dur par l'injection stricte de variables d'environnement (`DATABASE_URL`).
- [ ] **Purge de l'historique Git** : Nettoyer les anciens commits contenant des valeurs sensibles via `git-filter-repo` / BFG.

### P1 — Automatisation & Reproductibilité
- [ ] **Pipeline CI GitHub Actions** : Automatiser `npm run build`, linting, tests frontend et `pytest backend/` sur chaque Pull Request.
- [ ] **Stabilité des installations** : Verrouiller les dépendances (`npm ci`) et spécifier les versions d'exécution Node.js (`engines` dans `package.json`).

### P2 — Refactoring Frontend & Tests
- [ ] **Découpage d'AppContext** : Séparer l'état global monolithique en réducteurs et contextes thématiques (Cartographie, Carnet, Auth/Projets).
- [ ] **Couverture de tests unitaires** : Déployer Vitest pour valider les moteurs critiques de `src/logic/` (`GeoUtils`, `PolygonalEngine`, `CarnetEngine`, `POIService`).

### P3 — Robustesse de l'Export
- [ ] **Repli Electron PDF** : Mettre en place un fallback direct via Chromium `printToPDF()` lorsque WeasyPrint n'est pas détecté sur la machine hôte.

---

## 🧭 Backlog Fonctionnel & Produit

Éléments actifs extraits et modernisés de l'historique de conception :

### 1. Cartographie & Données Terrain
- [ ] **Support étendu des fonds IGN & Mapy.cz** : Ajout simplifié des clés API tierces via les Préférences, intégration du Scan 25 communautaire IGN.
- [ ] **Gestion avancée du hors-piste** : Bascule dynamique fluide entre tronçons routés BRouter et segments hors-piste à vol d'oiseau.
- [ ] **Profil altimétrique enrichi** : Calcul des dénivelés cumulés positifs/négatifs et intégration directe dans les en-têtes d'étapes.

### 2. Moteur de Carnet, Hub Unifié & Modules d'Épreuves
> 📄 **Référence Maître :** [Catalogue & Spécifications des Codes à Implémenter (Google Docs)](https://docs.google.com/document/d/1bpodvArZtDRWSFa4pfR8y8y4V2ehFhRUxmQp32lL6bI/) *(Source : `ressources à adapter. privé/doc des codes à implementer.url`)*

- [x] **Architecture du Hub Unifié v2.0** : Spécification du standard de distribution ZIP, schéma de manifestes JSON v2 et typologie complète (chiffrements, spatial, altimétrie, cartes custom, trames).
- [x] **Adoption du Standard Gilwell** : Intégration du standard modulaire WYSIWYG de référence (types purs, SVG vectoriel 300 DPI, interface de personnalisation).
- [x] **Pédagogie scoute & Trames de Raid** : Abandon du terme « Orchestrations » au profit de « Trames de Raid » avec modélisation du graphe de dépendances déclaratives.
- [x] **Exposition Agent-First & MCP** : Intégration de 5 outils MCP pour permettre aux agents IA de requêter, valider et créer des modules de manière autonome.
- [ ] **Implémentation complète du catalogue des codes scoutes** : Intégration progressive de tous les codes recensés dans le document de référence Google Docs (chiffres historiques, grilles, signaux optiques et acoustiques).
- [ ] **Migration des anciens modules** : Application du plan de conversion pas-à-pas (Morse, Vigenère, Polybe, Templier, Avocat, etc.) vers le standard v2 sans ReportLab.
- [ ] **Stockage distant S3 Garage** : Mise en place de la synchronisation bidirectionnelle du catalogue et téléchargement automatisé des paquets `.zip`.
- [ ] **Édition WYSIWYG des blocs de carnet** : Enrichissement des options de mise en page textuelle (polices additionnelles, lettrines, notes de bas de page).

### 3. Collaboration & Partage
- [ ] **Export d'archive `.srproj`** : Export et import sans perte incluant les images compressées (WebP), polices intégrées et métadonnées complètes.
- [ ] **Gestion des droits de partage** : Liens en lecture seule pour les participants, liens d'édition pour les co-organisateurs.

---

## 📦 Archives & Historique
Pour consulter les anciens plans de refonte des versions initiales :
- [legacy_electron_implementation_plan.md](./archive/legacy_electron_implementation_plan.md) — Plan d'implémentation de la refonte Electron initiale.
- [legacy_roadmap_v0.2.md](./archive/legacy_roadmap_v0.2.md) — Feuille de route historique des versions Python 0.1.x et 0.2.x.
