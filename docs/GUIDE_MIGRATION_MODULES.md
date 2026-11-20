# Guide de Migration des Modules ScoutRaider
*Passage des anciens modules hérités (v1/legacy) vers le Standard Modulaire Hub v2.0*

---

## 1. Contexte & Pourquoi Migrer ?

Les anciens modules de chiffrement de ScoutRaider (Morse, Vigenère, Polybe, Templier, Avocat, Cassis, Pavillons Maritimes) souffraient de plusieurs limitations structurelles :
1. **Couplage fort au moteur d'export ReportLab** : Le fichier `module.py` contenait à la fois la logique d'encodage et des instructions d'affichage impératif de bas niveau (`c.setStrokeColorRGB`, `c.drawString`), interdisant le rendu WYSIWYG dans le navigateur ou l'éditeur desktop.
2. **Manifestes anémiques** : Les anciens `manifest.json` contenaient seulement 3 champs (`category`, `description`, `rules_explanation`), sans déclarer le type de données acceptées (`numeric`, `alphabetic`, `map_path`), ni la version SemVer, ni les métriques d'impression.
3. **Absence d'interfaces interactives** : Contrairement au nouveau module Gilwell (`gilwell-studio-—-éditeur-wysiwyg-typescript.zip`) qui fournit un éditeur interactif en direct et un moteur vectoriel SVG propre, les anciens modules étaient de simples boîtes noires.

Ce guide décrit la méthode pas-à-pas pour hisser n'importe quel ancien module au standard v2.0.

---

## 2. Tableau Comparatif : Ancien vs Nouveau Standard

| Caractéristique | Ancien Module (Legacy / v1) | Nouveau Standard (v2.0 — Modèle Gilwell) |
| :--- | :--- | :--- |
| **Format** | Répertoire de fichiers lâches non versionnés | Archive `.zip` autonome avec somme SHA-256 |
| **Manifeste** | `manifest.json` incomplet (3 champs) | `manifest.json` strictement typé conforme au JSON Schema v2 |
| **Déclaration de Capacité** | Inexistante (infiltrée par heuristique) | Champ explicite `data_capability` (`map_path`, `numeric`, `alphabetic`, etc.) |
| **Moteur Algorithmique** | Script Python mêlant calcul et dessin | Logique pure et déterministe (TypeScript ou Python) |
| **Sortie Produite** | Tuple ad-hoc ou dessin direct sur canvas | Objet structuré `EncodedOutput` (SVG, texte formaté ou grille) |
| **Édition WYSIWYG** | Aucune (édition texte brut uniquement) | Composant React optionnel (`ui/EditorComponent.tsx`) |
| **Distribution** | Fichiers locaux codés en dur | Distribution distante S3 avec résolution de versions |
| **Exploitation IA / MCP** | Impossible sans parsing heuristique | Outils MCP dédiés, validation automatique |

---

## 3. Procédure de Migration en 5 Étapes

### Étape 1 : Analyser et Classifier le Module
Déterminez la capacité fondamentale du module :
- Si le module transforme un texte en un autre texte alphabétique $\to$ `data_capability: "alphabetic"`.
- Si le module opère sur des coordonnées, des métrages ou des azimuts $\to$ `data_capability: "map_path"`.
- Si le module substitue des lettres par des symboles graphiques $\to$ `data_capability: "symbolic_visual"`.

### Étape 2 : Mettre à Niveau le Manifeste `manifest.json`

Remplacez l'ancien manifeste par la structure v2.

#### Avant (Exemple : Morse hérité) :
```json
{
  "category": "crypted_message",
  "description": "Code Morse classique avec une typographie personnalisée et des délimiteurs.",
  "rules_explanation": "Codes écrits : Pour ne pas saturer l'attention, évitez d'enchaîner plus de 3 messages cryptés/écrits d'affilée."
}
```

#### Après (Morse Standard v2.0) :
```json
{
  "$schema": "https://scoutraider.org/schemas/v2/module.schema.json",
  "schema_version": "2.0",
  "id": "morse",
  "name": "Code Morse International",
  "version": "2.0.0",
  "resource_type": "crypto_module",
  "author": "ScoutRaider Core Team",
  "description": "Transmission par signaux courts et longs (acoustique, lumineux ou tracé).",
  "data_capability": "alphabetic",
  "supported_inputs": ["raw_text"],
  "render_type": "text",
  "entrypoint": "logic/index.ts",
  "pedagogy": {
    "recommended_levels": ["louveteaux", "seconde_classe", "premiere_classe"],
    "difficulty_weight": 2.0,
    "rules_explanation": "Codes écrits : Pour ne pas saturer l'attention, évitez d'enchaîner plus de 3 messages cryptés d'affilée."
  },
  "constraints": {
    "min_distance_m": 0.0,
    "max_distance_m": null,
    "max_azimuts": 2,
    "max_proportion": 0.30,
    "allow_consecutive": false,
    "forbidden_zones": ["high_poi_density"]
  },
  "annexes": [
    {
      "id": "alphabet_morse",
      "title": "Alphabet Morse & Mnémoniques",
      "file": "assets/tables/alphabet_morse.html"
    }
  ],
  "assets": []
}
```

---

### Étape 3 : Découpler la Logique du Rendu

1. **Supprimer toute dépendance à ReportLab / Canvas** : Les appels à `c.drawString` ou `c.drawImage` doivent être éliminés de la logique.
2. **Implémenter une fonction pure de transformation** :
   - En TypeScript (`logic/index.ts`) :
     ```typescript
     export function encodeMorse(plainText: string): { encoded_text: string; morse_tokens: string[] } {
       const MORSE_MAP: Record<string, string> = { A: '.-', B: '-...', C: '-.-.', ... };
       const tokens = plainText.toUpperCase().split('').map(c => MORSE_MAP[c] || c);
       return {
         encoded_text: tokens.join(' '),
         morse_tokens: tokens
       };
     }
     ```
   - En Python (`logic/main.py`) :
     ```python
     def transform(plain_text: str, config: dict = None) -> dict:
         morse_dict = {'A': '.-', 'B': '-...', 'C': '-.-.', ...}
         encoded = " ".join(morse_dict.get(c.upper(), c) for c in plain_text)
         return {
             "module_id": "morse",
             "solution_text": plain_text,
             "encoded_text": encoded,
             "render_type": "text"
         }
     ```

---

### Étape 4 : Isoler les Assets et Annexes

- Déplacez les polices personnalisées vers `assets/fonts/`.
- Déplacez les fiches d'aide pédagogique (fiches solutions / annexes participantes) vers `assets/tables/` au format SVG ou HTML autonome.
- Fournissez une icône `icon.svg` au ratio 1:1 pour l'affichage dans le Hub.

---

### Étape 5 : Packager et Valider l'Archive ZIP

1. Assemblez l'arborescence :
   ```bash
   zip -r morse-2.0.0.zip manifest.json README.md icon.svg logic/ assets/
   ```
2. Validez le paquet via l'outil Hub ou la CLI MCP :
   ```bash
   scout-hub validate morse-2.0.0.zip
   ```
3. Calculez le hash SHA-256 pour la publication S3 :
   ```powershell
   Get-FileHash -Algorithm SHA256 morse-2.0.0.zip
   ```

---

## 4. Grille d'Évaluation de Conformité v2.0

Avant de publier un module sur le Hub, vérifiez les critères suivants :

- [ ] Le fichier `manifest.json` déclare `schema_version: "2.0"` et respecte le schéma JSON.
- [ ] Le champ `data_capability` est renseigné avec une valeur valide (`map_path`, `numeric`, `alphabetic`, `alphanumeric`, `symbolic_visual`).
- [ ] Le code du module ne contient aucun chemin absolu ni appel système externe interdit.
- [ ] Le module est autonome : toutes ses polices et tables d'annexes sont incluses dans le paquet ZIP.
- [ ] L'archive ne dépasse pas 50 Mo et ne contient aucun fichier exécutable binaire non autorisé (.exe, .dll, .so).
- [ ] L'encodage et le décodage d'un jeu de test de référence s'exécutent en moins de 100 ms.
