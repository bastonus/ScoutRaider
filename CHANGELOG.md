# Changelog

Tous les changements notables apportés à ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
