C'est la touche finale qui fait basculer ce projet d'un "script amélioré" à un véritable logiciel professionnel. Le système de sauvegarde global (State Management) est une fonctionnalité vitale pour ne pas frustrer l'utilisateur s'il doit interrompre son travail de conception. Et rendre l'export final visuel et compréhensible est la meilleure façon de rassurer un utilisateur novice.

Voici la directive système ultime et complète, intégrant ces nouvelles exigences. Elle est prête à être transmise à ton agent.

[
### 🤖 DIRECTIVE SYSTÈME : ARCHITECTE LOGICIEL PYTHON & UI/UX

**RÔLE :** Tu interviens en tant qu'Architecte Logiciel et Développeur Python Senior. 
**MISSION :** Ton objectif est de transformer un script Python monolithique (générateur de jeux de piste géolocalisés) en une application de bureau (Desktop App) multiplateforme, modulaire, dotée d'une interface graphique (GUI) ergonomique fonctionnant comme un "Assistant" (Wizard) par étapes.
**CONTRAINTE MAJEURE :** Ce n'est PAS une application Web. C'est un exécutable lourd (Standalone) conçu pour des utilisateurs novices, avec des options "Avancé" pour les experts.

---

### PARTIE 1 : STRATÉGIE DE COMPILATION, DISTRIBUTION ET SAUVEGARDE GLOBALE
1.  **Framework de Compilation :** Utilise `PyInstaller` ou `cx_Freeze` couplé à des workflows CI/CD (GitHub Actions) pour générer automatiquement à chaque version : un `.exe` (Windows), un `.dmg` (macOS) et un exécutable autonome (Linux).
2.  **Gestion Automatique du Versionnage :** Le script de build doit auto-incrémenter les versions.
3.  **Environnement Isolé et Dépendances :** L'exécutable embarque son propre Python. À l'import d'un nouveau module par l'utilisateur, l'Orchestrateur lit le `requirements.txt` et exécute silencieusement un `subprocess` pour installer les dépendances via `pip`.
4.  **NOUVEAU - Système de Fichier Projet (Sauvegarde Globale) :** L'application doit gérer un état global (State Management). À tout moment, l'utilisateur peut sauvegarder son travail ("Fichier > Enregistrer sous"). L'application sérialise la totalité de la session (le tracé GeoJSON brut importé, les paramètres de polygonalisation, le mode de génération choisi, les presets/poids configurés, les affectations manuelles, et le thème) dans un fichier d'archive unique avec une extension personnalisée (ex: `.scoutproj` ou `.track`). Ce fichier permet de restaurer l'application exactement dans l'état où elle a été fermée.

---

### PARTIE 2 : ARCHITECTURE MODULAIRE ET RÈGLES DE DISTRIBUTION
Le code monolithique actuel doit être détruit et réécrit selon un modèle **Orchestrateur + Modules Plug-and-Play**.

1.  **L'Orchestrateur (Core) :** Gère la logique globale, la cartographie, et la distribution.
2.  **Structure des Modules :** Chaque code (Morse, IGN, Vigenère, etc.) est un dossier contenant `main.py` (point d'entrée), `requirements.txt`, et `/assets` (ressources). L'interface permet d'importer de nouveaux dossiers qui seront copiés et persistés dans un `modules_registry.json`.
3.  **Moteur de Règles (Orchestrateur) :**
    * *Exhaustivité :* Utiliser tous les codes activés au moins une fois avant de répéter.
    * *Anti-Répétition :* Jamais deux fois le même code de suite.
    * *Espacement :* Idéalement deux codes différents entre deux occurrences d'un même module.
    * *Alternance :* Jamais plus de 3 codes "écrits/chiffrés" d'affilée. Forcer un code "visuel" (Carte, Gilwell, Drapeaux).
4.  **Moteur de Règles Locales (Modules) :** Définies via un `constraints_categories.json` ou en interne :
    * *Texte en Clair (POI) :* Priorité 1 dans les zones denses. Écrase les probabilités et exclut les codes visuels.
    * *Carte IGN :* 100 à 300 mètres. 0% de probabilité sur le dernier tiers du tracé. Accès exceptionnel au vrai tracé GeoJSON pour l'affichage.
    * *Gilwell :* 4 à 6 azimuts. / *Drapeaux :* 200 à 300 mètres. / *Morse :* 1 ou 2 azimuts. / *Autres codes :* 1 azimut.

---

### PARTIE 3 : TUNNEL UTILISATEUR (UX/UI FLOW)
Utilise `PySide6` (Qt) ou `CustomTkinter`. L'interface est un "Tunnel" par étapes.

**Étape 1 : Importation et Vue Carte Live**
* Widget cartographique interactif. Import d'un ou plusieurs GeoJSON (fusion possible).

**Étape 2 : Polygonalisation**
* Slider "Taux de polygonalisation" avec retour visuel en direct sur la carte.
* Options avancées : Autoriser hors-piste, forcer carrefours. Bouton "Passer" si déjà polygonalisé.

**Étape 3 : Bifurcation (Auto vs Manuel)**
* Choix du mode de distribution pour les segments créés à l'étape 2.

**Étape 4A : Mode Automatique & Presets**
* Tuiles rapides (Niveaux scouts : Promesse, Seconde Classe, etc.).
* *Éditeur Avancé :* Importation de modules. Interface Drag & Drop pour définir la hiérarchie/poids des modules. Bouton pour écraser les règles locales d'un module (Override). Sauvegarde de ces choix comme nouveau Preset.

**Étape 4B : Mode Manuel (Alternative)**
* Carte et barre latérale des segments. L'utilisateur assigne lui-même un module à chaque segment via menu déroulant, ignorant l'Orchestrateur.

**Étape 5 : Moteur de Thèmes Dynamique (Data-Driven UI)**
* Gestion des thèmes modifiant le vocabulaire ("Tournez à droite" vs "Bâbord").
* *Instruction stricte :* Générer un formulaire dynamique récursif basé sur la structure du fichier `theme.json` (QLineEdits pour textes, ColorPickers pour couleurs) pour que l'utilisateur modifie l'habillage sémantique sans coder.

**Étape 6 : Compilation et Exportation (Le Carnet Final)**
* Les fonctions techniques de création de PDF/dossiers existent déjà, mais elles doivent être intégrées dans l'interface de façon ergonomique pour un novice.
* Au clic sur "Générer le Carnet", l'interface se verrouille et affiche une fenêtre contextuelle (Modale) avec une **Barre de progression détaillée et explicite** (ex: "1/4 : Analyse des segments...", "2/4 : Génération des clés de déchiffrement...", "3/4 : Création du PDF Animateur...").
* L'Orchestrateur rassemble les rendus des modules, compile le document, et ouvre automatiquement le dossier de destination contenant les PDF finaux et le dossier des annexes.

***

**Tâche initiale : Définis l'arborescence complète du projet (dossiers et fichiers) incluant la gestion d'état (.scoutproj), et rédige le squelette du point d'entrée de l'application (Main GUI).**
]

Souhaites-tu démarrer l'intégration avec ton agent, ou veux-tu qu'on explore un dernier aspect technique ?

Compris. Le moteur mathématique tourne déjà, il faut donc se concentrer purement sur le "câblage" UI/UX et la structure de données. 

Voici le cahier des charges exact et direct à transmettre à ton agent pour développer l'interface de ces deux fonctionnalités.

### DIRECTIVE DÉVELOPPEUR : UI POLYGONALISATION ET ARCHITECTURE DES PRESETS

**1. CÂBLAGE DE LA POLYGONALISATION (INTERFACE ET PARAMÈTRES)**
* **État Actuel :** La fonction Python de polygonalisation est déjà implémentée. Le travail consiste exclusivement à créer les widgets d'interface (UI) pour piloter ses arguments et afficher le retour visuel en direct.
* **Contrôle Principal (Slider) :** Créer un curseur horizontal nommé "Précision du tracé". Ce curseur doit être mappé proportionnellement à l'argument de tolérance de la fonction existante (allant d'une valeur minimale pour un tracé ultra-fidèle à une valeur maximale pour de grandes lignes droites).
* **Contrôles Intelligents (Switch/Checkbox) :** Ajouter une case à cocher "Autoriser le hors-piste" mappée directement à l'argument booléen correspondant dans ta fonction.
* **Contrôle des Carrefours :** Ajouter une case à cocher "Forcer la détection des intersections" pour activer l'argument d'ancrage sur le réseau routier.
* **Bouton de Bypass :** Intégrer un bouton explicite "Ignorer : tracé déjà optimisé" qui désactive l'appel à la fonction de polygonalisation et transfère directement le GeoJSON brut à l'étape suivante.
* **Feedback Live :** Relier le signal de modification du curseur ou des cases à cocher à un *worker* en arrière-plan (pour ne pas figer l'UI). Le résultat de la fonction doit mettre à jour le calque du polygone sur le widget cartographique (Folium/WebEngine) en temps réel.

---

**2. ARCHITECTURE DU SYSTÈME DE PRESETS (DONNÉES)**
* **Fichier Cible :** L'application doit lire et écrire dans un fichier `presets.json` situé dans l'environnement local de l'application.
* **Structure d'un Preset :** Chaque entrée de ce fichier JSON doit définir de manière stricte : un `preset_id` unique, un `name` d'affichage, un `theme_id` (référençant le thème visuel/sémantique), et une liste `modules_hierarchy`.
* **Données des Modules :** Dans la liste `modules_hierarchy`, chaque module activé doit posséder un `module_id`, un `weight` (entier représentant la probabilité de tirage), et un dictionnaire `override_rules` (vide par défaut, rempli si l'utilisateur modifie une règle locale du module).

---

**3. INTERFACE DU GESTIONNAIRE DE PRESETS (UI DES POIDS ET THÈMES)**
* **Sélecteur de Thème :** Intégrer un menu déroulant (ComboBox) qui parse les identifiants disponibles dans le fichier `theme.json` et permet à l'utilisateur de sélectionner l'habillage sémantique du jeu de piste.
* **Bibliothèque de Modules :** Créer une zone visuelle (ex: panneau latéral) listant tous les modules installés et reconnus par l'Orchestrateur via la lecture du `modules_registry.json`.
* **Interface des Poids (Système Drag & Drop) :** Il est strictement interdit d'utiliser des champs de saisie manuelle pour les pourcentages. Implémenter une liste réordonnable (ListWidget avec *Drag & Drop* activé). L'utilisateur fait glisser les modules de la bibliothèque vers cette liste.
* **Calcul des Poids en Arrière-plan :** La position d'un module dans la liste (Haut = Fréquent, Bas = Rare) doit déclencher une fonction mathématique dans l'interface qui calcule et attribue automatiquement les valeurs du champ `weight` avant la sauvegarde dans le JSON.
* **Panneau d'Override (Surcharge) :** Ajouter une icône "Paramètres" ⚙️ à côté de chaque module déposé dans la liste active. Au clic, ouvrir une fenêtre modale listant les contraintes par défaut de ce module spécifique. L'utilisateur peut y saisir de nouvelles valeurs qui viendront remplir le dictionnaire `override_rules` du preset.
* **Gestion de Fichier :** Ajouter les boutons d'action standard : "Sauvegarder comme nouveau Preset", "Mettre à jour le Preset actuel", et un menu déroulant pour "Charger un Preset existant".

