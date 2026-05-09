Here are instructions to make the desired UI that will reflect the new backend logic. Toujours se référer au dossier /legacy pour comparer à ce qui était bien et surtout au fichier next-features.md

0. ARCHITECTURE UI ET REFONTE GLOBALE (LES FONDATIONS)

Stack Technique & Objectif : L'application fait une refonte majeure, passant d'un back-end 100% Python à une architecture moderne en TypeScript avec une interface Electron. L'objectif est d'obtenir une application de type "bureau", fluide, réactive et interactive.

Layout et Navigation (Type IDE) :

Système d'onglets : Intégration d'un système d'onglets global pour naviguer facilement entre les différentes vues, fichiers ou modes du projet.

Séparateurs de panels (Splitters) : L'interface doit utiliser des séparateurs de panneaux redimensionnables pour que l'utilisateur puisse moduler son espace de travail à sa guise (ex: ajuster l'espace entre la vue carte et le panneau d'édition).

Nouveau paradigme de conception : Fin du calcul "boîte noire" qui génère un PDF figé à la toute fin. L'application proposera des calculs intermédiaires et interactifs, divisés en deux modes de travail principaux :

Mode Carte (Édition Visuelle) : Pour modifier le projet directement sur l'interface cartographique.

Mode Texte (Édition Textuelle) : Le nouveau module détaillé ci-dessous.

1. INTERFACE : LE GESTIONNAIRE D'EXPORTATION (FILE D'ATTENTE)

Accès : Un bouton "Exporter" en haut à droite de la page d'édition textuelle ouvre automatiquement cette fenêtre.

Mécanique de la file d'attente : * Possibilité d'ajouter des éléments à la file.

Choix/modification du format d'exportation pour les éléments en attente.

Un bouton "Tout exporter" pour lancer le processus.

Affichage des statuts et métriques (UI type "Legacy" améliorée) :

En haut/En cours : Fichiers en attente de calcul (azimuts, chemins) avec estimation du temps restant.

Au milieu : Une barre de progression claire séparant les deux zones.

En bas : Fichiers terminés avec leurs métriques (poids du fichier exporté, temps effectif d'exportation).

2. INTERFACE : LE MODE TEXTUEL (ÉDITION DU CARNET HTML)

Fidélité visuelle absolue : Le HTML généré doit être le clone parfait de ce que produit le PDF actuel (reprise de l'architecture, importation des bonnes polices, vérification de l'installation des modules).

Tâches de fond (Back-end) :

Priorité minimale (Background) : La recherche/génération des POI (Points of Interest) prend du temps. Elle doit s'exécuter uniquement quand l'utilisateur est inactif. Dès qu'il clique ou interagit, cette tâche est suspendue pour prioriser le reste (calcul des chemins/azimuts).

Intégration des Cartes (Leaflet) :

Utilisation de Leaflet pour les cartes IGN (points de départ/arrivée) directement manipulables dans l'éditeur.

Contrainte d'uniformité : Réutiliser exactement les mêmes fonds de carte que ceux de l'exportation actuelle, et les appliquer également à la carte générale de l'application.

3. GESTION DES ÉTAPES ET DU CONTENU (MODE TEXTUEL)

Manipulation à la volée : Le parcours est géré par "étapes". L'utilisateur peut sélectionner une étape et changer son module/encodage instantanément (ex: passer de morse à vigenère).

Fusion intelligente (Auto-Merge) : Si une étape prend le même encodage que l'étape adjacente (ex: deux étapes "avocat" de suite), le système doit automatiquement les fusionner en une seule étape.

Édition manuelle (Séparateurs interactifs) :

Au survol entre deux étapes, un séparateur avec un bouton "+" apparaît.

Ce bouton permet d'injecter manuellement du contenu : texte en clair, code, carte supplémentaire, etc.

Présence de boutons pour inclure/exclure des annexes spécifiques aux modules (qui doivent être identiques aux annexes PDF).

4. GESTION DES ERREURS ET CONTRÔLE QUALITÉ

Vérificateurs de contraintes intégrés : Les outils de vérification (issus de l'orchestrateur/version métro) doivent tourner sur ce mode textuel.

Warnings type "IDE" : Les erreurs doivent s'afficher contextuellement dans le HTML (ex: une barre rouge latérale au niveau de l'étape posant problème, accompagnée d'une fiche explicative de l'erreur).

5. OPTIONS GLOBALES DU CARNET

Toggle Orga/Participant : Un bouton propre pour basculer entre la version "Solution" et la version "Participant".

Carte Générale : Option demandée par les utilisateurs pour inclure (ou non) la carte générale au début du carnet participant.

6. INSTRUCTIONS DE DÉMARRAGE POUR L'AGENT IA

Étape 1 : Commencer par structurer l'architecture des nouveaux modules (Onglets, Splitters, Layout global) dans le nouvel environnement TypeScript/Electron.

Étape 2 : Générer une preview HTML propre du mode textuel intégrant toutes les règles de design (polices, modules), pour valider le rendu visuel avant de brancher la logique complexe.
]