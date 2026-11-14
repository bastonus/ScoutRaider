"""
Prompt templates and system personas for ScoutRaider AI.
"""

SCOUT_MASTER_SYSTEM_PROMPT = """Tu es l'Archi-Maître de Raid de ScoutRaider, un expert aguerri en topographie scoute, en cryptographie médiévale et moderne, et en pédagogie scoute de terrain (FSE, SGDF, SUF, Scouts Neutres).
Ton rôle est de créer des carnets de raid immersifs, palpitants, stimulants pour les patrouilles, tout en veillant scrupuleusement à la sécurité (distances réalistes, dénivelé, points d'eau, sécurité routière, respect de la nature).
Tu écris avec un style soigné, vivant, adapté à l'imaginaire scout (chevalerie, bâtisseurs, pisteurs, marins, résistants).
Réponds impérativement au format JSON structuré lorsque demandé.
"""

NARRATIVE_PROMPT_TEMPLATE = """Génère une trame narrative captivante pour un carnet de raid.
Thème choisi : {theme}
Tonalité : {target_tone}
Branche scoute : {scout_branch}

Étapes du raid :
{stages_json}

Consignes :
1. Crée une introduction épique qui plonge la patrouille dans l'univers (mission, contexte, objectif final).
2. Pour chaque étape, crée un texte court d'ambiance qui introduit la progression et donne envie de déchiffrer les indications de marche.
3. Rédige une conclusion finale pour le point d'arrivée (bivouac ou trésor).
4. Suggère une ambiance musicale ou un chant scout adapté.

Réponds sous la forme d'un objet JSON strict :
{{
  "theme_title": "Titre immersif du raid",
  "intro_story": "Texte d'introduction...",
  "stage_stories": [
    {{
      "stage_index": 0,
      "title": "Nom immersif de l'étape",
      "story_snippet": "Récit d'ambiance...",
      "moral_or_challenge": "Défi facultatif pour la patrouille"
    }}
  ],
  "outro_story": "Texte de conclusion...",
  "suggested_music_or_atmosphere": "Idée de chant ou ambiance"
}}
"""

RIDDLE_PROMPT_TEMPLATE = """Crée une énigme scoute liée au point d'intérêt suivant :
Nom du POI : {poi_name}
Type : {poi_type}
Indice historique ou culturel : {historical_hint}
Difficulté : {difficulty}
Module de chiffrement visé : {target_module}

Consignes :
- L'énigme doit porter sur l'histoire, la faune, la flore ou l'architecture du lieu.
- La réponse doit être un mot ou une courte phrase sans accents complexes (idéal pour être codé ensuite en Morse, César, Polybe ou Templier).
- Fournis un conseil pédagogique pour l'animateur.

Réponds sous la forme d'un objet JSON strict :
{{
  "riddle_text": "Texte de l'énigme en rimes ou prose captivante",
  "solution_word": "MOTCLEF",
  "pedagogical_tip": "Conseil pour vérifier la réponse sur place"
}}
"""

SAFETY_AUDIT_PROMPT_TEMPLATE = """Tu es un instructeur national en sécurité des raids et randonnées scoutes.
Analyse la sécurité de l'itinéraire suivant :
Distance totale : {total_distance_km} km
Dénivelé positif cumulé : {total_elevation_gain_m} m
Saison / Météo : {season_or_weather}
Catégorie d'âge : {age_category}

Détail des étapes :
{stages_json}

Évalue rigoureusement :
1. La fatigue physique par rapport à l'âge des participants (rappel : 12-15 km/jour max pour 12-14 ans, 20-25 km pour aînés).
2. Le dénivelé cumulé.
3. Les risques potentiels (manque d'eau, traversées de grands axes routiers, sentiers escarpés, zones d'évacuation d'urgence).
4. Le respect du rythme de progression.

Réponds sous la forme d'un objet JSON strict :
{{
  "global_rating": "safe" | "challenging" | "dangerous",
  "summary": "Résumé de l'audit pour la maîtrise...",
  "alerts": [
    {{
      "severity": "info" | "warning" | "critical",
      "stage_index": 1,
      "title": "Alerte dénivelé ou distance",
      "description": "Détail du risque...",
      "recommendation": "Mesure préventive..."
    }}
  ],
  "water_points_advice": "Conseils d'approvisionnement en eau...",
  "emergency_contacts_needed": ["Numéro SAMU 15 / 112", "Gendarmerie locale", "Mairie"]
}}
"""
