"""
Help Dialog — Guide du Raid, Roadmap, Suggestions.
Provides a 3-tab dialog with rich HTML content styled for the dark theme.
"""
import webbrowser

from PySide6.QtWidgets import (QDialog, QVBoxLayout, QTabWidget, QTextBrowser,
                                QPushButton, QHBoxLayout, QLabel, QWidget)
from PySide6.QtCore import Qt, QUrl


# ─── Shared Style ──────────────────────────────────────────
_CSS = """
body {
    background-color: #2b2b2b;
    color: #cccccc;
    font-family: 'Segoe UI', sans-serif;
    font-size: 12px;
    padding: 12px 18px;
    line-height: 1.6;
}
h1 { color: #ffffff; font-size: 20px; margin-bottom: 4px; }
h2 { color: #2d8ceb; font-size: 16px; margin-top: 18px; border-bottom: 1px solid #444; padding-bottom: 4px; }
h3 { color: #9cdcfe; font-size: 14px; margin-top: 14px; }
ul { padding-left: 20px; }
li { margin-bottom: 4px; }
a { color: #4fc3f7; text-decoration: none; }
a:hover { text-decoration: underline; }
code { background: #1e1e1e; padding: 2px 5px; border-radius: 3px; color: #ce9178; }
.warning-box {
    background-color: #4a2c00;
    border: 2px solid #ff9800;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 10px 0 16px 0;
    color: #ffe0b2;
    font-size: 12px;
}
.warning-box b { color: #ffcc02; }
.info-box {
    background-color: #1a3a5c;
    border: 1px solid #2d8ceb;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 10px 0;
    color: #bbdefb;
}
.feature-tag {
    display: inline-block;
    background: #2d8ceb;
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    margin-right: 4px;
}
"""


def _wrap_html(body: str) -> str:
    return f"<html><head><style>{_CSS}</style></head><body>{body}</body></html>"


# ═══════════════════════════════════════════════════════════
#  TAB 1: Guide du Raid
# ═══════════════════════════════════════════════════════════

_GUIDE_HTML = _wrap_html("""
<h1>📖 Guide — Créer un Raid avec ScoutRaider Suite</h1>

<div class="warning-box">
    <b>⚠️ AVERTISSEMENT DE SÉCURITÉ — LIRE IMPÉRATIVEMENT</b><br><br>
    Les azimuts, métrages et instructions générés par cette application sont calculés
    <b>algorithmiquement</b> et peuvent contenir des <b>erreurs</b>.<br><br>
    <b>Avant d'envoyer des scouts sur le terrain, il est IMPÉRATIF de :</b>
    <ul>
        <li>✅ <b>Vérifier manuellement</b> chaque azimut et chaque distance sur une carte IGN papier</li>
        <li>✅ <b>Reconnaître l'itinéraire</b> sur le terrain avant le jour J</li>
        <li>✅ <b>Corriger les azimuts</b> si nécessaire avec l'outil Azimut (A) dans l'application</li>
        <li>✅ <b>Tester le carnet</b> en conditions réelles avec un chef avant de le distribuer</li>
        <li>✅ <b>Prévoir un plan B</b> en cas d'erreur d'orientation (points de ralliement, téléphone d'urgence)</li>
    </ul>
    L'équipe de développement <b>décline toute responsabilité</b> en cas d'erreur
    d'orientation liée à des données générées automatiquement.
</div>

<h2>Étape 1 — Tracer l'itinéraire</h2>
<ol>
    <li>Sélectionne l'outil <b>Route (R)</b> dans la barre d'outils à gauche.</li>
    <li><b>Clique sur la carte</b> pour poser ton point de départ (A).</li>
    <li>Clique à nouveau pour ajouter des étapes intermédiaires (B, C, D…).</li>
    <li>Le moteur calcule automatiquement la route pédestre entre chaque étape via BRouter.</li>
    <li>Tu peux aussi <b>chercher une adresse</b> dans le panneau Itinéraire à gauche.</li>
</ol>
<p><b>💡 Astuce :</b> utilise la <b>vue satellite</b> (bouton en haut à droite de la carte) pour vérifier le terrain.</p>

<h2>Étape 2 — Segmenter le tracé</h2>
<ol>
    <li>Va dans l'onglet <b>Segmentation</b> (panneau gauche).</li>
    <li>Ajuste la <b>sensibilité virage</b> et la <b>longueur minimale</b> des segments.</li>
    <li>Clique sur <b>« Recalculer les segments »</b>.</li>
    <li>Le tracé est découpé en tronçons avec un azimut et un métrage pour chacun.</li>
</ol>

<h2>Étape 3 — Affiner les nœuds et azimuts</h2>
<ol>
    <li><b>Outil Nœuds (N)</b> : clique sur le tracé pour ajouter un nœud, Alt+Clic pour supprimer.</li>
    <li><b>Outil Azimut (A)</b> : glisse la poignée bleue pour corriger manuellement un azimut.</li>
    <li><b>⚠️ Vérifie chaque azimut !</b> Les calculs automatiques peuvent diverger de la réalité terrain.</li>
</ol>

<h2>Étape 4 — Encoder les épreuves</h2>
<ol>
    <li>Sélectionne l'outil <b>Encodage (E)</b>.</li>
    <li>Clique sur un tronçon → choisis le module (épreuve) à assigner.</li>
    <li>Ou utilise la <b>sélection rectangulaire</b> pour assigner en masse.</li>
    <li>Tu peux aussi laisser l'<b>Orchestrateur automatique</b> répartir les épreuves
        (panneau Difficulté → bouton « Organiser »).</li>
</ol>

<h2>Étape 5 — Choisir le thème et la difficulté</h2>
<ol>
    <li>Dans le panneau <b>Difficulté</b> (à droite), choisis un preset de difficulté.</li>
    <li>Sélectionne le <b>thème visuel</b> du carnet (Contrebandier, Vikings, Mafia…).</li>
    <li>Lance la validation pour vérifier les contraintes de placement.</li>
</ol>

<h2>Étape 6 — Exporter le carnet PDF</h2>
<ol>
    <li>Clique sur <b>Fichier → Exporter en PDF</b> (ou Ctrl+E).</li>
    <li>Deux fichiers sont générés :</li>
    <ul>
        <li><b>Carnet Participant</b> : le livret avec les indices encodés.</li>
        <li><b>Carnet Solution</b> : le corrigé pour les chefs avec les repérages GPS.</li>
    </ul>
    <li><b>⚠️ Relis et teste le carnet</b> avant de l'imprimer et le distribuer !</li>
</ol>

<h2>Conseils pour un bon Raid</h2>
<ul>
    <li>🗺️ <b>Kilométrage recommandé :</b> 10-15 km (Promesse), 15-20 km/jour (2nde Classe), 20-25 km/jour (1ère Classe)</li>
    <li>🧭 <b>Varier les épreuves :</b> alterner azimut-distance, Morse, Vigenère, carte IGN…</li>
    <li>⛺ <b>Sécurité :</b> points téléphone, plan de repli, trousse de secours, eau 2L/jour minimum</li>
    <li>📐 <b>Croquis :</b> prévoir les emplacements de croquis panoramiques et topographiques</li>
</ul>
""")


# ═══════════════════════════════════════════════════════════
#  TAB 2: Roadmap / Prochaines Fonctionnalités
# ═══════════════════════════════════════════════════════════

_ROADMAP_HTML = _wrap_html("""
<h1>🚀 Prochaines fonctionnalités</h1>

<p>ScoutRaider Suite est en <b>version Beta</b>. Voici les améliorations prévues :</p>

<h2>🔴 Priorité Haute</h2>
<ul>
    <li><b>Distribution & Auto-updater</b> — Déploiement via installeurs et mise à jour automatique à l'ouverture de l'application</li>
    <li><b>Refonte de la recherche « Inline »</b> — Autocomplétion façon Google Maps intégrée au panneau</li>
    <li><b>Drag & Drop des étapes</b> — Réordonner les étapes par glisser-déposer + déplacement sur la carte</li>
    <li><b>Import GPX / KML</b> — Importer des tracés depuis d'autres applications GPS</li>
    <li><b>Export multi-format</b> — Export HTML, DOCX en plus du PDF et CSV</li>
</ul>

<h2>🟡 Améliorations Prévues</h2>
<ul>
    <li><b>Panneau Thème séparé</b> — Interface dédiée pour personnaliser l'apparence du carnet</li>
    <li><b>Épreuves expandables</b> — Descriptions, contraintes et preview au survol des modules</li>
    <li><b>Modules auto-découverts</b> — Charger automatiquement tout nouveau module ajouté au dossier</li>
    <li><b>Mode clair / sombre</b> — Thème de l'interface adaptable</li>
    <li><b>Écran d'accueil</b> — Page de bienvenue avec projets récents</li>
</ul>

<h2>🟢 Améliorations Mineures</h2>
<ul>
    <li><b>Onglets multi-projets</b> — Travailler sur plusieurs itinéraires en parallèle</li>
    <li><b>Icônes SVG</b> — Remplacer les boutons texte par des icônes professionnelles</li>
    <li><b>Micro-animations</b> — Transitions fluides et effets au survol</li>
    <li><b>Curseurs personnalisés</b> — Curseurs adaptés pour chaque outil</li>
</ul>

<div class="info-box">
    <b>💡 Votre avis compte !</b><br>
    Ces priorités peuvent évoluer selon vos retours. N'hésitez pas à voter
    pour les fonctionnalités qui vous intéressent le plus en ouvrant une Issue sur GitHub.
</div>
""")


# ═══════════════════════════════════════════════════════════
#  TAB 3: Suggestions
# ═══════════════════════════════════════════════════════════

_SUGGESTIONS_HTML = _wrap_html("""
<h1>💡 Suggestions & Feedback</h1>

<p>ScoutRaider Suite est un projet collaboratif. Vos retours sont essentiels
pour améliorer l'outil !</p>

<h2>Comment contribuer ?</h2>

<div class="info-box">
    <b>🐛 Signaler un bug</b><br>
    Vous avez trouvé un problème ? Décrivez-le avec le plus de détails possible
    (étapes pour reproduire, capture d'écran) en créant une <b>Issue</b> sur GitHub.
</div>

<div class="info-box">
    <b>💡 Proposer une fonctionnalité</b><br>
    Vous avez une idée d'amélioration ? Ouvrez une Issue avec le tag
    <code>[Feature Request]</code> et décrivez votre besoin.
</div>

<div class="info-box">
    <b>📧 Contact direct</b><br>
    Pour toute question générale, contactez l'équipe via le dépôt GitHub
    ou par les canaux habituels de l'association.
</div>

<h2>Lien vers le dépôt</h2>
<p style="font-size: 14px; text-align: center; margin: 20px 0;">
    👉 <a href="__GITHUB_URL__">Ouvrir le dépôt GitHub</a><br><br>
    👉 <a href="__GITHUB_ISSUES_URL__">Créer une Issue (bug ou suggestion)</a>
</p>

<p style="color: #888; text-align: center; margin-top: 30px;">
    Merci de contribuer à un meilleur outil pour nos scouts ! 🏕️
</p>
""")


class HelpDialog(QDialog):
    """Three-tab help dialog: Guide du Raid, Roadmap, Suggestions."""

    def __init__(self, parent=None, initial_tab: int = 0):
        super().__init__(parent)
        self.setWindowTitle("Aide — ScoutRaider Suite")
        self.setMinimumSize(720, 600)
        self.resize(780, 650)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # ── Tab Widget ──
        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)

        # Tab 1: Guide
        self.tabs.addTab(self._make_browser(_GUIDE_HTML), "📖 Guide du Raid")

        # Tab 2: Roadmap
        self.tabs.addTab(self._make_browser(_ROADMAP_HTML), "🚀 Prochaines fonctionnalités")

        # Tab 3: Suggestions (inject real URLs)
        try:
            from version import GITHUB_URL, GITHUB_ISSUES_URL
        except ImportError:
            GITHUB_URL = "https://github.com/VOTRE_ORGA/scout-design-suite"
            GITHUB_ISSUES_URL = f"{GITHUB_URL}/issues"

        sug_html = _SUGGESTIONS_HTML.replace("__GITHUB_URL__", GITHUB_URL)
        sug_html = sug_html.replace("__GITHUB_ISSUES_URL__", GITHUB_ISSUES_URL)
        self.tabs.addTab(self._make_browser(sug_html), "💡 Suggestions")

        self.tabs.setCurrentIndex(initial_tab)
        layout.addWidget(self.tabs)

        # ── Bottom bar ──
        bottom = QHBoxLayout()
        bottom.setContentsMargins(12, 8, 12, 8)

        try:
            from version import __version__
            ver_label = QLabel(f"ScoutRaider Suite v{__version__}")
        except ImportError:
            ver_label = QLabel("ScoutRaider Suite")
        ver_label.setStyleSheet("color: #666; font-size: 10px;")
        bottom.addWidget(ver_label)

        bottom.addStretch()

        close_btn = QPushButton("Fermer")
        close_btn.setFixedWidth(100)
        close_btn.clicked.connect(self.accept)
        bottom.addWidget(close_btn)

        layout.addLayout(bottom)

    def _make_browser(self, html: str) -> QTextBrowser:
        """Create a styled QTextBrowser with the given HTML content."""
        browser = QTextBrowser()
        browser.setOpenExternalLinks(True)
        browser.setHtml(html)
        browser.setStyleSheet("""
            QTextBrowser {
                background-color: #2b2b2b;
                border: none;
            }
        """)
        return browser
