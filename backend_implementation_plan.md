# Plan d'Implémentation du Backend (Moteur de Génération Textuelle)

Ce document détaille les futures étapes du backend nécessaires pour soutenir le Mode Textuel. Ce développement se fera de manière séquentielle, étape par étape, afin de garantir la performance et la précision.

## Séquence des Opérations Backend

Pour transformer un simple tracé cartographique en un carnet de route crypté et détaillé, le backend devra exécuter les phases suivantes consécutivement :

### 1. Récupération d'Itinéraire
- **Entrée :** Les coordonnées brutes des points de passage (Waypoints) définis par l'utilisateur sur la carte.
- **Action :** Appel à un service de routing (ex: OSRM, GraphHopper ou routage local) pour obtenir les géométries précises des chemins empruntés.
- **Sortie :** Une liste de segments linéaires (polylignes) avec les distances réelles.

### 2. Récupération et Calcul des Azimuts
- **Entrée :** Les segments de l'itinéraire.
- **Action :** Calcul mathématique de l'angle (0-360°) entre chaque intersection critique ou changement de direction.
- **Sortie :** Liste des segments enrichis avec leur azimut respectif et leur orientation cardinale (Nord, Sud-Est, etc.).

### 3. Extraction et Analyse des Points d'Intérêt (POI)
- **Entrée :** Les coordonnées de chaque segment.
- **Action :** Requête vers une base de données géographique (ex: Overpass API / OpenStreetMap) pour détecter les POIs à proximité immédiate du tracé (ex: Rues, Rivières, Bâtiments remarquables, Églises).
- **Sortie :** Une liste de POIs candidats attachés à chaque étape du carnet. **Ces POIs seront ensuite sélectionnés/désélectionnés par l'utilisateur dans l'interface frontend.**

---

## Intégration Frontend ↔ Backend

Le backend retournera un objet JSON détaillé pour chaque étape du carnet. Le frontend (à travers le `CarnetEngine`) utilisera ces données pour générer le texte (solution). 

### Auto-Merge
Il a été défini que, côté logique applicative (Frontend/Backend), si deux étapes consécutives utilisent le même code/module (ex: Morse suivi de Morse), et ne sont pas interrompues par une étape manuelle, elles seront automatiquement fusionnées (`CarnetEngine.autoMerge`). Les distances s'additionnent, et le texte s'enchaîne, formant un seul grand bloc.

### Gestion Multilangage des Directions
Le texte solution par défaut mélangera de manière semi-aléatoire la façon d'indiquer la direction, pour ne pas être monotone. Le backend fournira toutes les traductions possibles pour la direction, et le frontend laissera l'utilisateur surcharger/sélectionner manuellement :
1. **Azimut :** "Prendre azimut 45°"
2. **Horaire :** "Prendre à 3 heures"
3. **Cardinaux :** "Prendre direction Nord-Est"

## Open Questions
- Le backend effectuera-t-il les requêtes Overpass (OSM) en temps réel, ou aurons-nous un cache local statique pour des régions spécifiques afin de réduire le temps de chargement ?
- La sélection aléatoire de la narration (Horaire vs Cardinaux) se fera-t-elle au niveau de l'algorithme Backend pour générer un `solutionText` brut, ou laissons-nous le Frontend recomposer la phrase dynamiquement via des tags de variables ?
