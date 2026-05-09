<p align="center">
  <img src="ScoutRaider%20Logo.svg" width="160" alt="ScoutRaider Logo">
</p>

# 🏕️ ScoutRaider — Générateur de Carnets de Raid

> **Version Beta 0.3.0-beta (Nouvelle Version Electron !)** · Application de bureau pour planifier, concevoir et générer automatiquement des carnets de raid scout.
> 
> 👉 **[📥 TÉLÉCHARGER LA DERNIÈRE VERSION (Windows, macOS, Linux)](https://github.com/bastonus/ScoutRaider-Suite/releases/latest)**

[![React/Vite](https://img.shields.io/badge/UI-React_Vite-61dafb?logo=react&logoColor=black)](#)
[![Electron](https://img.shields.io/badge/App-Electron-47848f?logo=electron&logoColor=white)](#)
[![Releases](https://img.shields.io/github/v/release/bastonus/ScoutRaider)](https://github.com/bastonus/ScoutRaider/releases)
[![Beta](https://img.shields.io/badge/Status-Beta-orange)](#avertissement-de-sécurité)

---

## 🚀 MISE À JOUR MAJEURE : Passage à Electron

ScoutRaider fait peau neuve ! L'application a été entièrement réécrite en **React / Vite / Electron** pour offrir une interface plus fluide, plus moderne et de meilleures performances.

**Quoi de neuf dans cette Beta 0.3 :**
- **Nouvelle Interface Utilisateur** : Design system moderne et réactif.
- **Performances accrues** : Navigation fluide sur la carte IGN et gestion optimisée des calculs.
- **Architecture Hybride** : Interface en React et futur moteur PDF en Python (WeasyPrint).
- **Installeurs Natifs** : Distribution simplifiée via GitHub Actions (.exe, .dmg, .AppImage).

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
