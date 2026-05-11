<p align="center">
  <img src="assets/logos/fleurdelyslogo%20rounded%20full.svg" width="160" alt="ScoutRaider Logo">
</p>

# 🏕️ ScoutRaider — Générateur de Carnets de Raid

> **Version Beta 0.3.3-beta (Galerie de Cartes & UX !)** · Application de bureau pour planifier, concevoir et générer automatiquement des carnets de raid scout.
> 
> 👉 **[📥 TÉLÉCHARGER LA DERNIÈRE VERSION (Windows, macOS, Linux)](https://github.com/bastonus/ScoutRaider/releases/latest)**

[![React/Vite](https://img.shields.io/badge/UI-React_Vite-61dafb?logo=react&logoColor=black)](#)
[![Electron](https://img.shields.io/badge/App-Electron-47848f?logo=electron&logoColor=white)](#)
[![Releases](https://img.shields.io/github/v/release/bastonus/ScoutRaider)](https://github.com/bastonus/ScoutRaider/releases)
[![Beta](https://img.shields.io/badge/Status-Beta-orange)](#avertissement-de-sécurité)

---

## 🚀 MISE À JOUR : Beta 0.3.3

Cette version transforme radicalement l'expérience de découverte et de sélection des cartes avec une toute nouvelle galerie visuelle et des optimisations d'interface majeures.

**Quoi de neuf dans cette Beta 0.3.3 :**
- **Bibliothèque de Cartes (Galerie Mode)** : Passage d'une simple liste à une galerie visuelle premium. Naviguez parmi tous les fonds de carte (IGN, Mapy.cz, OSM) avec des aperçus en plein format.
- **Badges Contextuels** : Identification immédiate du type de carte (SATELLITE, BLOQUÉ, FAVORI) grâce à un nouveau système de badges groupés.
- **Activation Fluide** : Cliquez n'importe où sur une fiche pour activer la carte. Les fonds nécessitant une clé API (IGN, Mapy.cz) affichent un bouton dédié avec le logo officiel du fournisseur.
- **Interface Itinéraire (RoutePanel) Épurée** : Suppression des en-têtes inutiles et uniformisation des hauteurs (40px) pour un alignement parfait et un gain d'espace vertical.
- **Connecteurs de Segments Redessinés** : Le métrage et le sélecteur "Hors piste" sont maintenant plus clairs, plus contrastés et mieux intégrés au design système.
- **Corrections & Stabilité** : Correction de la priorité des notifications (z-index) et harmonisation des barres de recherche dans toute l'application.

---

## 🚀 MISE À JOUR : Beta 0.3.2

Cette version apporte une refonte complète de la fenêtre d'exportation et un nouvel outil de tracé hors-piste.

**Quoi de neuf dans cette Beta 0.3.2 :**
- **Nouveau panneau d'exportation** : Une fenêtre d'exportation toute neuve, beaucoup plus propre.
- **Support CSV & TSV** : Prise en charge des formats de données tabulaires (CSV et TSV), préparant la future implémentation des formats de documents tels que le DOCX, le PDF et le HTML.
- **Nouvel outil "Hors-piste"** : Situé juste après l'outil de tracé d'itinéraire principal, cet outil permet de tracer des parcours hors-piste (points en vol d'oiseau formant des polygones).
- **Corrections des outils** : Réparations et améliorations sur les problèmes rencontrés avec les quatre outils principaux de la carte.

---

## 🚀 MISE À JOUR : Beta 0.3.1

Cette version apporte des améliorations majeures sur le système de points d'intérêt (POI) et l'interface utilisateur.

**Quoi de neuf dans cette Beta 0.3.1 :**
- **Système POI optimisé** : Fonctionne désormais pleinement sur l'application Desktop avec une récupération plus efficace via l'API Overpass (moins de requêtes, plus de rapidité).
- **Interface Itinéraire (Panel)** : Refonte visuelle et ergonomique du panneau latéral d'itinéraire pour une meilleure lisibilité.
- **Outil "Déplacer un nœud" fonctionnel** : Il est désormais possible de déplacer, ajouter ou supprimer des points sur un tracé existant.
- **Interactivité de la carte** : La quasi-totalité des outils (Azimut, Encodage) est désormais opérationnelle pour une édition fluide.
- **Détection des Voies Dangereuses** : Amélioration du système d'alerte contextuelle pour les routes à forte circulation (nouveaux icônes et messages d'alerte).
- **Corrections Electron** : Résolution des erreurs 406 lors des appels API et meilleure gestion des ressources.
- **Nouveau format de fichier `.srdoc`** : Passage au format "ScoutRaider Document" avec prise en charge de l'association de fichiers système.
- **Export CSV fonctionnel** : Possibilité d'exporter les données brutes de l'itinéraire au format CSV pour un usage externe.
- **⚠️ Note sur les exports** : Les exports PDF, HTML et DOCX sont temporairement indisponibles dans cette beta car ils sont en cours de migration vers le nouveau moteur Electron.

---

## ⚠️ Avertissement de Sécurité

> **IMPORTANT — À lire avant toute utilisation terrain**
>
> Les **azimuts, métrages et instructions** générés par cette application sont calculés **algorithmiquement** et **peuvent contenir des erreurs**.
>
> **Avant d'envoyer des scouts sur le terrain, il est IMPÉRATIF de :**
> - ✅ **Vérifier manuellement** chaque azimut et distance sur une carte IGN papier
> - ✅ **Reconnaître l'itinéraire** sur le terrain avant le jour J
> - ✅ **Corriger les azimuts** si nécessaire avec l'outil d'édition
> - ✅ **Tester le carnet** en conditions réelles avec un chef avant distribution
> - ✅ **Prévoir un plan B** : points de ralliement, téléphone d'urgence
>
> L'équipe de développement **décline toute responsabilité** en cas d'erreur d'orientation liée aux données générées automatiquement.

---

## 🎯 Qu'est-ce que c'est ?

ScoutRaider est un outil conçu pour les **chefs et cheftaines scouts** (Guides et Scouts d'Europe) qui organisent des raids et des randonnées. Il permet de :

1. **Tracer un itinéraire** sur une carte interactive (fonds IGN, satellite).
2. **Découper automatiquement** le tracé en segments avec azimuts et métrages calculés.
3. **Encoder des épreuves** (Morse, Vigenère, azimut-distance, chiffres romains, etc.) le long du parcours.
4. **Générer des carnets PDF** prêts à imprimer : un carnet participant et un carnet solution pour les chefs.

---

## 📦 Installation

| Plateforme | Fichier | Instructions |
|---|---|---|
| 🪟 **Windows** | `ScoutRaider Setup.exe` | Double-cliquez pour installer |
| 🍎 **macOS** | `ScoutRaider.dmg` | Glissez l'app dans Applications |
| 🐧 **Linux** | `ScoutRaider.AppImage` | `chmod +x *.AppImage` puis lancez |

> **Note** : Les installeurs sont désormais générés automatiquement via GitHub Actions. Téléchargez la dernière version dans l'onglet **Releases**.

### Depuis les sources (Développeurs)

```bash
# 1. Cloner le dépôt
git clone https://github.com/bastonus/ScoutRaider.git
cd ScoutRaider

# 2. Installer les dépendances Node.js
npm install

# 3. Lancer en mode développement
npm run dev

# Lancer la fenêtre Electron (dans un autre terminal)
npm run electron
```

---

## 🏗️ Architecture

```text
ScoutRaider/
├── src/                # Code frontend (React, Leaflet, CKEditor)
├── electron/           # Code backend Electron (main.js)
├── public/             # Assets statiques et icônes
├── legacy/             # (Archive) Ancien code source PySide6
└── .github/workflows/  # Pipelines CI/CD de génération des installeurs
```

---

## 💡 Suggestions & Feedback

Vos retours sont essentiels pour améliorer l'outil, particulièrement durant cette phase de refonte !

- 🐛 **Signaler un bug** → [Créer une Issue](https://github.com/bastonus/ScoutRaider/issues/new?labels=bug)
- 💡 **Proposer une fonctionnalité** → [Feature Request](https://github.com/bastonus/ScoutRaider/issues/new?labels=enhancement)

---

<p align="center">
  Fait avec ❤️ pour les scouts · **Créé par Pierre-Albéric Théobald, chef de troupe de la Première Port-Marly**
</p>
