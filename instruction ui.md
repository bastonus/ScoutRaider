1. STRUCTURE ET STYLE DES PANNEAUX (PANELS)

Layout : L'interface est divisée en 3 panneaux principaux (gauche, milieu, droite).

Séparateurs et Espacement : Supprimer les lignes/traits de séparation basiques. Les panneaux ne doivent pas se toucher. Utiliser des marges ou des bandes de fond sombres (noires/foncées) pour créer un espace net entre chaque panneau.

Arrondis (Border-radius) : Les panneaux doivent avoir des coins bien arrondis pour créer un ensemble continu et moderne. Le fond sombre doit passer "sous" ces panneaux arrondis.

2. SYSTÈME D'ONGLETS (TABS - STYLE GOOGLE CHROME)

Design Général : S'inspirer fortement du comportement des onglets de Google Chrome.

États des Onglets :

Inactif : Pas de couleur de fond, le texte flotte "dans le vide".

Actif : Prend la couleur de fond de la zone de travail, avec un effet d'accroche visuelle propre (arrondi inverse) reliant l'onglet au panneau principal.

Dimensions : Tous les onglets doivent avoir strictement la même largeur (utiliser une largeur max avec un effet de fondu/ombre si le texte est trop long).

Icônes : Ajouter des icônes à gauche du texte. Utiliser une icône générique identique pour tous les "Projets", mais des icônes spécifiques et adaptées pour les outils par défaut.

Bouton Fermer (Croix) : Doit être visible en permanence, même sur les onglets inactifs au repos.

Corrections UX (Hitboxes) : Corriger les zones de clic (hover). Actuellement, la surbrillance au survol forme un rectangle disgracieux. Le hover doit épouser parfaitement la forme arrondie de l'onglet, et le hover du bouton "fermer" doit être un cercle parfait.

3. COMPORTEMENT DE LA BARRE D'OUTILS (SÉLECTION "ENCODAGE")

Nettoyage dynamique : Lors de la sélection de l'outil "Encodage", l'interface doit se nettoyer : disparition des notifications, de la barre de recherche, du bouton de changement de fond de carte et du bouton de localisation.

Remplacement : À la place, afficher le module "Carte Métro" qui doit prendre toute la largeur disponible.

4. MODULE "CARTE MÉTRO" (TIMELINE DES ÉTAPES)

![alt text](image.png)

Bouton "Répartir automatiquement" : À l'extrémité, ajouter ce bouton avec une petite flèche de menu déroulant (dropdown). Ce menu doit contenir :

Les options de "difficultés".

Une barre de recherche.

Un bouton "+" qui ouvre la "bibliothèque d'encodage automatique".

Interactivité de la ligne : Permettre la sélection multiple d'étapes (soit via Ctrl + Clic, soit avec un outil de sélection rectangulaire type "drag box").

Style Visuel de la Ligne (cf. Maquette) :

Épuré : Supprimer tous les effets de lueur ("glow effects") qui font cheap. Le style doit être très fin, minimaliste et plat, fidèle à l'image de référence.

Changements d'azimut : Représentés par de petits points (avec un centre blanc).

Grandes Étapes : Représentées par de plus gros cercles contenant des lettres majuscules (A, B, C, D...).

Couleurs : Chaque type/module d'encodage appliqué à une portion de la ligne doit avoir sa propre couleur distinctive (ex: la ligne turquoise sur la maquette changera de couleur selon le module).