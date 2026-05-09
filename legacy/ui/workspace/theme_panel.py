"""
Theme panel rendered as embedded HTML (DesignSystem-style cards),
with backend hooks kept in Python.
"""
import os
import sys
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from PySide6.QtWidgets import QWidget, QVBoxLayout
from PySide6.QtCore import QObject, Signal, Slot
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel


_ICONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")


class ThemePanelWebBridge(QObject):
    themeSelected = Signal(str)
    openEditor = Signal()

    @Slot(str)
    def onThemeSelected(self, theme_name):
        self.themeSelected.emit(theme_name)

    @Slot()
    def onOpenEditor(self):
        self.openEditor.emit()


class ThemePanel(QWidget):
    def __init__(self, state_manager):
        super().__init__()
        self.setObjectName("theme_panel_root")
        self.state_manager = state_manager
        self._web_ready = False

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self.web = QWebEngineView(self)
        self.web.settings().setAttribute(self.web.settings().WebAttribute.LocalContentCanAccessFileUrls, True)
        self.web.settings().setAttribute(self.web.settings().WebAttribute.LocalContentCanAccessRemoteUrls, True)
        layout.addWidget(self.web)

        self._bridge = ThemePanelWebBridge()
        self._bridge.themeSelected.connect(self._on_theme_selected_from_web)
        self._bridge.openEditor.connect(self._open_theme_editor)

        channel = QWebChannel(self.web.page())
        channel.registerObject("themeBridge", self._bridge)
        self.web.page().setWebChannel(channel)

        self.web.setHtml(self._theme_panel_html())
        self.web.loadFinished.connect(self._on_web_loaded)

    def _theme_panel_html(self):
        icons_base = _ICONS_DIR.replace("\\", "/")
        return f"""
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" />
<script src="qrc:///qtwebchannel/qwebchannel.js"></script>
<style>
  :root {{
    --bg-dark:#252526; --bg-panel:#2b2b2b; --bg-surface:#3c3c3c; --bg-border:#484848;
    --glass-border:rgba(255,255,255,0.10); --glass-bg:rgba(30,32,38,0.93);
    --text-primary:#ffffff; --text-default:#e2e8f0; --text-dim:#94a3b8;
    --accent-default:#2563eb; --accent-hover:#3b82f6; --accent-transparent:rgba(37,99,235,0.15);
    --radius-lg:12px; --radius-md:9px; --radius-pill:14px;
    --font-ui:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{ margin:0; background:var(--bg-panel); color:var(--text-default); font:13px/1.4 var(--font-ui); }}
  .root {{ height:100vh; padding:10px; display:flex; flex-direction:column; gap:10px; overflow:hidden; }}
  .panel {{ background:transparent; border:none; padding:0; display:flex; flex-direction:column; gap:12px; min-height:0; flex:1; overflow:hidden; }}

  /* Header */
  .panel-header {{ display:flex; align-items:center; justify-content:space-between; }}
  .panel-header h2 {{ margin:0; font-size:13px; font-weight:700; letter-spacing:-0.01em; color:var(--text-primary); }}

  /* Buttons */
  .btn {{ border:1px solid var(--glass-border); background:var(--bg-surface); color:var(--text-default);
    border-radius:var(--radius-md); padding:6px 12px; font-size:12px; font-weight:600;
    font-family:var(--font-ui); cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:all .15s; }}
  .btn:hover {{ background:var(--bg-border); border-color:var(--accent-hover); color:#fff; }}
  .btn-primary {{ background:var(--accent-default); border-color:var(--accent-default); color:#fff; }}
  .btn-primary:hover {{ background:var(--accent-hover); }}
  .btn-pill {{ border-radius:var(--radius-pill); }}
  .btn-sm {{ padding:4px 10px; font-size:11px; }}
  .btn img, .card-new img {{ filter:brightness(0) invert(1); }}
  .btn img {{ width:13px; height:13px; }}
  .btn.btn-primary img {{ width:13px; height:13px; }}

  /* Search */
  .search-bar {{ display:flex; align-items:center; gap:8px; background:var(--bg-dark);
    border:1px solid var(--bg-border); border-radius:var(--radius-md); padding:0 12px; height:34px; }}
  .search-bar:focus-within {{ border-color:var(--accent-default); }}
  .search-bar input {{ background:transparent; border:none; outline:none; color:#fff; font-size:12px; width:100%; font-family:var(--font-ui); }}
  .search-bar input::placeholder {{ color:var(--text-dim); }}
  .search-bar img {{ width:14px; height:14px; flex-shrink:0;
    filter:brightness(0) saturate(100%) invert(60%) sepia(10%) saturate(500%) hue-rotate(176deg); }}

  /* Card grid */
  .card-grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
    gap:10px; overflow-y:auto; padding-right:2px; min-height:0; flex:1; }}

  /* Module card — matches demo exactly */
  .module-card {{ background:var(--bg-dark); border:1px solid var(--glass-border);
    border-radius:var(--radius-lg); overflow:hidden; cursor:pointer;
    transition:border-color .2s, transform .15s, box-shadow .2s;
    display:flex; flex-direction:column; }}
  .module-card:hover {{ border-color:var(--accent-default); transform:translateY(-2px);
    box-shadow:0 6px 20px rgba(0,0,0,0.35); }}
  .module-card.sel {{ border-color:rgba(37,99,235,0.6);
    box-shadow:0 0 0 1px rgba(37,99,235,0.3) inset; }}

  /* Card image — 72px like demo */
  .card-img {{ height:72px; display:flex; align-items:center; justify-content:center;
    position:relative; overflow:hidden; background-size:cover; background-position:center; }}
  .card-img::after {{ content:''; position:absolute; inset:0; background:rgba(0,0,0,0.25); }}
  .card-img img {{ position:relative; z-index:1; width:28px; height:28px;
    filter:brightness(0) invert(1); opacity:0.9; }}

  /* Card body */
  .card-body {{ padding:10px; display:flex; flex-direction:column; gap:3px; flex:1; }}
  .card-name {{ font-size:12px; font-weight:700; color:var(--text-primary); }}
  .card-desc {{ font-size:10px; color:var(--text-dim); line-height:1.4; }}

  /* New card */
  .card-new {{ background:var(--bg-surface); border:1.5px dashed var(--bg-border);
    border-radius:var(--radius-lg); min-height:130px;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:6px; cursor:pointer; color:var(--text-dim); transition:.2s;
    font-size:11px; font-weight:600; }}
  .card-new:hover {{ border-color:var(--accent-default); color:var(--accent-hover); background:var(--accent-transparent); }}
  .card-new img {{ width:20px; height:20px; }}
</style></head>
<body><div class="root"><div class="panel">
<div class="panel-header"><h2>Bibliothèque de thèmes</h2><button class="btn btn-primary btn-pill btn-sm" onclick="bridge&&bridge.onOpenEditor()"><img src="file:///{icons_base}/plus.svg"> Nouveau</button></div>
<div class="search-bar"><img src="file:///{icons_base}/search.svg"><input id="q" type="text" placeholder="Rechercher un thème..." oninput="render()"></div>
<div id="grid" class="card-grid"></div>
</div></div>
<script>
let bridge=null,themeState={{themes:[],selected:"Neutre"}};
new QWebChannel(qt.webChannelTransport,ch=>{{bridge=ch.objects.themeBridge;window.themeBridge=bridge;}});
function setThemeState(payload){{themeState=payload||{{themes:[],selected:"Neutre"}};render();}}
function safeName(n){{return String(n||'').replaceAll("'","\\\\'");}}
function render(){{
  const q=(document.getElementById('q')?.value||'').toLowerCase().trim();
  const list=(themeState.themes||[]).filter(t=>!q||String(t.name).toLowerCase().includes(q));
  const g=document.getElementById('grid');
  g.innerHTML=list.map(t=>`<div class="module-card${{t.name===themeState.selected?' sel':''}}" onclick="bridge&&bridge.onThemeSelected('${{safeName(t.name)}}')"><div class="card-img" style="${{t.preview?`background-image:url('${{t.preview}}');`:`background:${{t.gradient||'linear-gradient(135deg,#374151,#6b7280)'}};`}}"><img src="${{t.icon||''}}"></div><div class="card-body"><div class="card-name">${{t.name}}</div><div class="card-desc">${{t.desc||''}}</div></div></div>`).join('')+`<div class="card-new" onclick="bridge&&bridge.onOpenEditor()"><img src="file:///{icons_base}/plus.svg">Nouveau thème</div>`;
}}
</script></body></html>
"""

    @staticmethod
    def _theme_icon_url(icon_name):
        raw = str(icon_name or "").strip()
        if not raw:
            raw = "globe-off.svg"
        if raw.startswith("http://") or raw.startswith("https://") or raw.startswith("file:///"):
            return raw
        abs_path = raw if os.path.isabs(raw) else os.path.join(_ICONS_DIR, raw)
        if not os.path.exists(abs_path):
            abs_path = os.path.join(_ICONS_DIR, "globe-off.svg")
        return f"file:///{abs_path.replace(os.sep, '/')}"

    @staticmethod
    def _theme_gradient(theme_name):
        nm = (theme_name or "").lower()
        if "viking" in nm:
            return "linear-gradient(135deg,#1e3a5f,#2563eb)"
        if "cheval" in nm or "roi" in nm or "napoléon" in nm or "napoleon" in nm:
            return "linear-gradient(135deg,#78350f,#d97706)"
        if "mafia" in nm or "ww" in nm or "guerre" in nm:
            return "linear-gradient(135deg,#4b5563,#6b7280)"
        if "anneaux" in nm or "gaulois" in nm:
            return "linear-gradient(135deg,#065f46,#10b981)"
        return "linear-gradient(135deg,#374151,#6b7280)"

    def _build_theme_payload(self):
        selected = self.state_manager.get_state("theme_id", "Neutre")
        themes = []
        theme_data = self._load_themes_data()
        for t in sorted(theme_data.keys()):
            data = theme_data.get(t, {}) or {}
            themes.append({
                "name": t,
                "desc": data.get("description") or self._theme_desc(t),
                "icon": self._theme_icon_url(data.get("icon") or self._theme_icon_name(t)),
                "gradient": data.get("card_gradient") or self._theme_gradient(t),
                "preview": self._theme_preview_url(data.get("preview_image")),
            })
        return {"themes": themes, "selected": selected}

    @staticmethod
    def _theme_icon_name(theme_name):
        nm = (theme_name or "").lower()
        if "viking" in nm:
            return "map-pin.svg"
        if "cheval" in nm or "roi" in nm or "napol" in nm:
            return "drafting-compass.svg"
        if "mafia" in nm or "ww" in nm or "guerre" in nm:
            return "msg-lock.svg"
        if "anneaux" in nm or "gaulois" in nm:
            return "history.svg"
        return "globe-off.svg"

    @staticmethod
    def _theme_preview_url(preview_value):
        if not preview_value:
            return ""
        raw = str(preview_value).strip()
        if not raw:
            return ""
        if raw.startswith("http://") or raw.startswith("https://") or raw.startswith("file:///"):
            return raw
        abs_path = raw if os.path.isabs(raw) else os.path.join(PROJECT_ROOT, raw)
        if not os.path.exists(abs_path):
            return ""
        return f"file:///{abs_path.replace(os.sep, '/')}"

    @staticmethod
    def _theme_desc(theme_name):
        nm = (theme_name or "").lower()
        if "neutre" in nm:
            return "Sans identité thématique"
        if "viking" in nm:
            return "Fjords et drakkars nordiques"
        if "cheval" in nm:
            return "Tournois et blasons médiévaux"
        return "Style narratif pour le carnet"

    def _push_state_to_web(self):
        if not self._web_ready:
            return
        payload = self._build_theme_payload()
        self.web.page().runJavaScript(f"setThemeState({json.dumps(payload)});")

    def _on_web_loaded(self, ok):
        self._web_ready = bool(ok)
        if self._web_ready:
            self._push_state_to_web()

    def _on_theme_selected_from_web(self, theme_name):
        if not theme_name:
            return
        if theme_name != self.state_manager.get_state("theme_id", "Neutre"):
            self.state_manager.update_state("theme_id", theme_name)
        self._push_state_to_web()

    def _open_theme_editor(self):
        from ui.workspace.theme_editor_panel import ThemeEditorDialog
        dlg = ThemeEditorDialog(self)
        if dlg.exec():
            self._push_state_to_web()

    @staticmethod
    def _load_theme_names():
        theme_file = os.path.join(PROJECT_ROOT, "config", "themes.json")
        themes = ["Neutre"]
        if os.path.exists(theme_file):
            try:
                with open(theme_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                themes = [k for k in data.keys() if k != "_help"]
            except Exception:
                pass
        return themes

    @staticmethod
    def _load_themes_data():
        theme_file = os.path.join(PROJECT_ROOT, "config", "themes.json")
        if not os.path.exists(theme_file):
            return {"Neutre": {}}
        try:
            with open(theme_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {k: v for k, v in data.items() if k != "_help"}
        except Exception:
            return {"Neutre": {}}

    def refresh_from_state(self):
        self._push_state_to_web()

    def set_state_manager(self, state_manager):
        """Rebind this panel to a different StateManager (multi-tab support)."""
        self.state_manager = state_manager
        self.refresh_from_state()

