# -*- coding: utf-8 -*-
"""
Route Panel  --  Google Maps-style stage-based itinerary manager.

Layout:
  (A) ── 48.8566, 2.3522 ──────────── [⌖] [✕]
   ╎    1.2 km
  (B) ── 48.8700, 2.3300 ──────────── [⌖] [✕]
   ╎
  (C) ── Rechercher... ─────────────── [⌖] [+]

  [ Inverser ]  [ Importer ]  [ Vider ]
"""
import os, sys, json, logging

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QLineEdit,
    QGroupBox, QListWidget, QListWidgetItem, QMenu, QFileDialog,
    QMessageBox, QScrollArea, QCheckBox, QSizePolicy, QFrame, QSpacerItem,
    QDialog, QSlider
)
from PySide6.QtCore import Qt, Signal, QTimer, QSize, QRect, QSettings, QObject, Slot, QUrl
from PySide6.QtGui  import QColor, QPainter, QPen, QFont, QBrush, QIcon
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel

from utils.route_engine import (
    create_route, create_route_from_feature_collection,
    reverse_route, split_route, merge_routes, duplicate_route,
    add_waypoint, remove_waypoint, get_chained_geojson,
    compute_route_distance,
)
from utils.ign_client import IGNClient

# ────────────────────────────────────────────────────────
#  THEME CONSTANTS  (Photoshop CC dark)
# ────────────────────────────────────────────────────────
_ACCENT       = "#2563eb"
_ACCENT_HOVER = "#3b82f6"
_BG_PANEL     = "#2b2b2b"
_BG_DARK      = "#252526"
_BG_MID       = "#484848"
_BG_LIGHT     = "#535353"
_TEXT          = "#e2e8f0"
_TEXT_DIM      = "#94a3b8"
_RED           = "#ef4444"
_GREEN         = "#27ae60"
_CIRCLE_SZ     = 22
_CONNECTOR_W   = 22          # width of vertical connector column
_ICONS_DIR     = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")


class RoutePanelWebBridge(QObject):
    stageTextChanged = Signal(int, str)
    addTextChanged = Signal(str)
    stageDeleted = Signal(int)
    addRequested = Signal(str)
    stageFocused = Signal(int)
    addFocused = Signal()
    suggestionChosen = Signal(int)
    openAdvanced = Signal()
    insertTextChanged = Signal(int, str)
    insertFocused = Signal(int)
    insertRequested = Signal(int, str)

    @Slot(int, str)
    def onStageTextChanged(self, index, text):
        self.stageTextChanged.emit(index, text)

    @Slot(str)
    def onAddTextChanged(self, text):
        self.addTextChanged.emit(text)

    @Slot(int)
    def onDeleteStage(self, index):
        self.stageDeleted.emit(index)

    @Slot(str)
    def onAddRequested(self, text):
        self.addRequested.emit(text)

    @Slot(int)
    def onStageFocused(self, index):
        self.stageFocused.emit(index)

    @Slot()
    def onAddFocused(self):
        self.addFocused.emit()

    @Slot(int)
    def onSuggestionChosen(self, index):
        self.suggestionChosen.emit(index)

    @Slot()
    def onOpenAdvanced(self):
        self.openAdvanced.emit()

    @Slot(int, str)
    def onInsertTextChanged(self, after_index, text):
        self.insertTextChanged.emit(after_index, text)

    @Slot(int)
    def onInsertFocused(self, after_index):
        self.insertFocused.emit(after_index)

    @Slot(int, str)
    def onInsertRequested(self, after_index, text):
        self.insertRequested.emit(after_index, text)


# ────────────────────────────────────────────────────────
#  LETTER CIRCLE (painted inline)
# ────────────────────────────────────────────────────────

class SearchInput(QLineEdit):
    """Custom QLineEdit that emits a signal on focus."""
    focus_received = Signal()
    focus_lost = Signal()

    def focusInEvent(self, event):
        super().focusInEvent(event)
        self.focus_received.emit()

    def focusOutEvent(self, event):
        super().focusOutEvent(event)
        self.focus_lost.emit()

class LetterCircle(QWidget):
    """Compact circle with a bold letter."""

    def __init__(self, letter="A", size=_CIRCLE_SZ, parent=None):
        super().__init__(parent)
        self._letter = letter
        self._sz = size
        self._is_dim = False
        self.setFixedSize(size, size)

    def set_letter(self, letter):
        self._letter = letter
        self.update()

    def set_dimmed(self, dimmed):
        self._is_dim = bool(dimmed)
        self.update()

    def paintEvent(self, _evt):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        r = self.rect().adjusted(1, 1, -1, -1)
        if self._is_dim:
            p.setPen(QPen(QColor(_BG_MID), 1.5))
            p.setBrush(QColor(_BG_PANEL))
        else:
            p.setPen(QPen(QColor(_ACCENT), 1.5))
            p.setBrush(QColor("#ffffff"))
        p.drawEllipse(r)
        f = p.font()
        f.setBold(True)
        f.setPixelSize(max(9, self._sz // 2))
        p.setFont(f)
        p.setPen(QColor(_TEXT_DIM if self._is_dim else _ACCENT))
        p.drawText(r, Qt.AlignCenter, self._letter)
        p.end()


# ────────────────────────────────────────────────────────
#  STAGE ROW  — one point in the timeline
# ────────────────────────────────────────────────────────
#
#  Layout (Google Maps style, circle on LEFT):
#
#   (A) │  48.85660, 2.35220          [⌖] [✕]
#    ╎  │  ↕ 1.2 km  (distance label, only between rows)
#   (B) │  48.87000, 2.33000          [⌖] [✕]
#

class StageRow(QWidget):
    """One stage point with: circle | address/coords | pick button | delete button."""
    pick_requested   = Signal(int)
    delete_requested = Signal(int)
    text_changed     = Signal(int, str)   # for search trigger
    focus_received   = Signal(int)        # NEW: focus received
    focus_lost       = Signal(int)
    center_requested = Signal(int)        # NEW: click circle to center map

    def __init__(self, index, letter="A", display_text="", parent=None):
        super().__init__(parent)
        self.index = index
        self.setObjectName("stagePill")

        row = QHBoxLayout(self)
        row.setContentsMargins(8, 5, 8, 5)
        row.setSpacing(8)

        # 1. Letter circle — click to center map on this stage
        self.circle = LetterCircle(letter, _CIRCLE_SZ)
        self.circle.setCursor(Qt.PointingHandCursor)
        self.circle.setToolTip("Cliquer pour centrer la carte sur cette étape")
        self.circle.mousePressEvent = lambda e: self.center_requested.emit(self.index)
        row.addWidget(self.circle)

        # 2. Address / coordinate input
        self.input = SearchInput(display_text)
        self.input.setPlaceholderText(f"Point {letter}…")
        self.input.setStyleSheet(f"""
            QLineEdit {{
                background: transparent;
                color: #ffffff;
                border: none;
                padding: 2px 0;
                font-size: 12px;
                font-family: 'Inter', 'Segoe UI', sans-serif;
            }}
            QLineEdit:focus {{
                color: #ffffff;
            }}
        """)
        self.input.textChanged.connect(lambda txt: self.text_changed.emit(self.index, txt))
        self.input.focus_received.connect(lambda: self.focus_received.emit(self.index))
        self.input.focus_lost.connect(lambda: self.focus_lost.emit(self.index))
        row.addWidget(self.input, 1)

        # 3. Delete button (single right action, like the demo)
        self.btn_del = QPushButton("")
        self.btn_del.setFixedSize(22, 22)
        self.btn_del.setToolTip("Supprimer cette étape")
        self.btn_del.setCursor(Qt.PointingHandCursor)
        self.btn_del.setIcon(RoutePanel._icon("x"))
        self.btn_del.setIconSize(QSize(12, 12))
        self.btn_del.setStyleSheet(f"""
            QPushButton {{ background: transparent; color: {_RED};
                           border: none; font-size: 12px; border-radius: 6px; }}
            QPushButton:hover {{ color: #ffffff; background: rgba(239,68,68,0.25); }}
        """)
        self.btn_del.clicked.connect(lambda: self.delete_requested.emit(self.index))
        row.addWidget(self.btn_del)


class ConnectorRow(QWidget):
    """Thin vertical dashed line + distance label between two stages."""

    def __init__(self, distance_text="", parent=None):
        super().__init__(parent)
        self._text = distance_text
        self.setFixedHeight(16)

    def paintEvent(self, _evt):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        # Center the line under the circle column (circle is ~11px from left edge)
        cx = _CIRCLE_SZ // 2
        pen = QPen(QColor(_BG_MID), 1.5, Qt.DashLine)
        p.setPen(pen)
        p.drawLine(cx, 0, cx, self.height())

        if self._text:
            f = p.font()
            f.setPixelSize(10)
            f.setBold(True)
            p.setFont(f)
            fm = p.fontMetrics()
            tw = fm.horizontalAdvance(self._text)
            tx = cx + 12
            ty = self.height() // 2 + fm.ascent() // 2 - 1
            p.setPen(QColor(_TEXT_DIM))
            p.drawText(tx, ty, self._text)
        p.end()

class SuggestionWrapper(QWidget):
    """Wrapper that paints the continuing dashed line along the left of the results."""
    def __init__(self, list_widget, parent=None):
        super().__init__(parent)
        self.list_widget = list_widget
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        lay.addWidget(list_widget)

    def paintEvent(self, _evt):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        cx = _CIRCLE_SZ // 2
        pen = QPen(QColor(_ACCENT), 1.5, Qt.DashLine)
        p.setPen(pen)
        p.drawLine(cx, 0, cx, self.height())
        p.end()

class AddRow(QWidget):
    """Terminal row: search input with + button to add a new destination."""
    add_requested  = Signal(str)
    pick_requested = Signal()
    text_changed   = Signal(str)
    focus_received = Signal()
    focus_lost     = Signal()

    def __init__(self, next_letter="C", parent=None):
        super().__init__(parent)
        self._letter = next_letter
        self.setObjectName("stagePill")

        row = QHBoxLayout(self)
        row.setContentsMargins(8, 5, 8, 5)
        row.setSpacing(8)

        # Circle (dimmed, shows next letter)
        self.circle = LetterCircle(next_letter, _CIRCLE_SZ)
        self.circle.set_dimmed(True)
        row.addWidget(self.circle)

        # Search input
        self.input = SearchInput()
        self.input.setPlaceholderText("Ajouter une étape…")
        self.input.setStyleSheet(f"""
            QLineEdit {{
                background: transparent;
                color: {_TEXT_DIM};
                border: none;
                padding: 2px 0;
                font-size: 12px;
            }}
            QLineEdit:focus {{
                color: {_TEXT};
            }}
        """)
        self.input.textChanged.connect(lambda txt: self.text_changed.emit(txt))
        self.input.focus_received.connect(self.focus_received.emit)
        self.input.focus_lost.connect(self.focus_lost.emit)
        row.addWidget(self.input, 1)

        # Add button (single right action for add row)
        self.btn_add = QPushButton("")
        self.btn_add.setFixedSize(22, 22)
        self.btn_add.setCursor(Qt.PointingHandCursor)
        self.btn_add.setIcon(RoutePanel._icon("plus"))
        self.btn_add.setIconSize(QSize(12, 12))
        self.btn_add.setStyleSheet(f"""
            QPushButton {{ background: transparent; color: #22c55e;
                           border: none; font-size: 16px; font-weight: bold; border-radius: 6px; }}
            QPushButton:hover {{ color: #ffffff; background: rgba(34,197,94,0.25); }}
        """)
        self.btn_add.clicked.connect(lambda: self.add_requested.emit(self.input.text()))
        row.addWidget(self.btn_add)


# ────────────────────────────────────────────────────────
#  MAIN PANEL
# ────────────────────────────────────────────────────────

class RoutePanel(QWidget):
    """Itinerary manager with a clean Google Maps-style vertical timeline."""

    routes_changed       = Signal()
    map_needs_update     = Signal()
    active_route_changed = Signal(str)
    stages_reordered     = Signal(list)
    stage_center_requested = Signal(int)  # NEW: emits stage index to center map on
    advanced_params_applied = Signal(dict)

    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        self.ign_client    = IGNClient()
        self.logger        = logging.getLogger("RoutePanel")

        # Search debounce
        self._search_timer = QTimer()
        self._search_timer.setSingleShot(True)
        self._search_timer.timeout.connect(self._do_search)

        self._active_search_input = None
        self._active_search_is_add = False   # True when searching from the AddRow
        self._active_search_index = -1
        self._suggestions = []
        self._active_search_text = ""
        self._web_suggestions = []
        self._use_web_ui = True
        self._web_ready = False
        self._active_insert_after = None
        self._location_lookup_pending = False

        self._build_ui()

    # ═══════════════════════════════════════════════════════
    #  UI CONSTRUCTION
    # ═══════════════════════════════════════════════════════

    def _build_ui(self):
        if self._use_web_ui:
            outer = QVBoxLayout(self)
            outer.setContentsMargins(0, 0, 0, 0)
            outer.setSpacing(0)

            self.web = QWebEngineView(self)
            outer.addWidget(self.web)

            self._web_bridge = RoutePanelWebBridge()
            self._web_bridge.stageTextChanged.connect(self._on_stage_text_changed)
            self._web_bridge.addTextChanged.connect(self._on_add_text_changed)
            self._web_bridge.stageDeleted.connect(self._on_stage_delete_requested)
            self._web_bridge.addRequested.connect(self._on_add_requested)
            self._web_bridge.stageFocused.connect(self._on_stage_focus_received)
            self._web_bridge.addFocused.connect(self._on_add_focus_received)
            self._web_bridge.insertFocused.connect(self._on_insert_focus_received)
            self._web_bridge.suggestionChosen.connect(self._on_suggestion_selected_from_web)
            self._web_bridge.openAdvanced.connect(self._open_advanced_params_dialog)
            self._web_bridge.insertTextChanged.connect(self._on_insert_text_changed)
            self._web_bridge.insertRequested.connect(self._on_insert_requested)

            self._web_channel = QWebChannel(self.web.page())
            self._web_channel.registerObject("routeBridge", self._web_bridge)
            self.web.page().setWebChannel(self._web_channel)
            self.web.loadFinished.connect(self._on_web_loaded)
            self.web.setHtml(self._route_panel_html(), QUrl.fromLocalFile(os.path.dirname(os.path.abspath(__file__)) + os.sep))

            self._rebuild_stage_list()
            return

        outer = QVBoxLayout(self)
        outer.setContentsMargins(8, 8, 8, 8)
        outer.setSpacing(8)

        self.setStyleSheet(f"""
            QWidget {{
                color: {_TEXT};
                font-family: 'Inter', 'Segoe UI', sans-serif;
                font-size: 12px;
            }}
            QWidget#stagePill {{
                background: #3c3c3c;
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 14px;
            }}
            QWidget#stagePill:focus-within {{
                border: 1px solid {_ACCENT};
                background: #252526;
            }}
        """)

        # ── Header (exact demo spirit) ────────────────────────────
        header = QWidget()
        h_lay = QHBoxLayout(header)
        h_lay.setContentsMargins(4, 0, 4, 0)
        h_lay.setSpacing(6)
        lbl = QLabel("ÉTAPES")
        lbl.setStyleSheet(f"color:{_TEXT_DIM}; font-size:11px; font-weight:700; letter-spacing:1px;")
        h_lay.addWidget(lbl)
        h_lay.addStretch(1)
        btn_import = QPushButton("")
        btn_import.setFixedSize(28, 28)
        btn_import.setCursor(Qt.PointingHandCursor)
        btn_import.setToolTip("Importer")
        btn_import.setIcon(self._icon("folder-open"))
        btn_import.setIconSize(QSize(14, 14))
        btn_import.setStyleSheet(
            f"QPushButton{{border:none;background:transparent;color:{_TEXT_DIM};border-radius:9px;}}"
            f"QPushButton:hover{{background:rgba(37,99,235,0.15);color:{_ACCENT};}}"
        )
        btn_import.clicked.connect(self.import_file)
        h_lay.addWidget(btn_import)
        outer.addWidget(header)

        # ── Stages List (Scrollable, max 3 stages visual limit) ──
        self._stages_scroll = QScrollArea()
        self._stages_scroll.setWidgetResizable(True)
        self._stages_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._stages_scroll.setStyleSheet("QScrollArea{border:none;background:transparent;}")

        # Hook to reliably auto-scroll to bottom on layout expansions
        self._wants_scroll_bottom = False
        bar = self._stages_scroll.verticalScrollBar()
        bar.rangeChanged.connect(self._on_scroll_range_changed)

        stages_inner = QWidget()
        self._stage_layout = QVBoxLayout(stages_inner)
        self._stage_layout.setContentsMargins(8, 8, 8, 8)
        self._stage_layout.setSpacing(6)
        stages_inner.setStyleSheet(f"""
            QWidget {{
                background: {_BG_PANEL};
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 12px;
            }}
        """)
        self._stages_scroll.setWidget(stages_inner)

        outer.addWidget(self._stages_scroll)

        # ── Inline Results (Search / History) ────────────────────
        self.list_suggestions = self._mksugg()
        self.list_suggestions.itemClicked.connect(self._on_suggestion_clicked)
        # Note: Do not add list_suggestions to outer layout statically
        
        # ── Controls bottom pane ──────────────────────────────────
        self._bottom_controls = QWidget()
        b_lay = QVBoxLayout(self._bottom_controls)
        b_lay.setContentsMargins(8, 0, 8, 8)
        b_lay.setSpacing(10)

        sep = QFrame()
        sep.setFrameShape(QFrame.HLine)
        sep.setStyleSheet(f"color: {_BG_MID};")
        b_lay.addWidget(sep)
        self.btn_advanced = QPushButton(" Paramètres avancés")
        self.btn_advanced.setCursor(Qt.PointingHandCursor)
        self.btn_advanced.setIcon(self._icon("settings"))
        self.btn_advanced.setIconSize(QSize(12, 12))
        self.btn_advanced.setStyleSheet(
            f"""
            QPushButton {{
                background: transparent;
                color: {_TEXT_DIM};
                border: 1px solid {_BG_MID};
                border-radius: 14px;
                padding: 7px 14px;
                font-size: 11px;
                font-weight: 700;
            }}
            QPushButton:hover {{
                border-color: {_ACCENT};
                color: #ffffff;
                background: rgba(37,99,235,0.15);
            }}
            """
        )
        self.btn_advanced.clicked.connect(self._open_advanced_params_dialog)
        b_lay.addWidget(self.btn_advanced, alignment=Qt.AlignHCenter)
        outer.addWidget(self._bottom_controls)

        # Initial build
        self._rebuild_stage_list()

    # ── CSS helpers ────────────────────────────────────

    @staticmethod
    def _tool_css():
        return f"""
            QPushButton{{background:{_BG_DARK};color:{_TEXT};
                         border:1px solid rgba(255,255,255,0.10);border-radius:9px;
                         padding:6px 10px;font-size:11px;font-weight:600;}}
            QPushButton:hover{{background:{_BG_MID};border-color:{_ACCENT_HOVER};color:#fff;}}
        """

    @staticmethod
    def _icon(name):
        return QIcon(os.path.join(_ICONS_DIR, f"{name}.svg"))

    def _route_panel_html(self):
        return """
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" />
<script src="qrc:///qtwebchannel/qwebchannel.js"></script>
<style>
body{margin:0;background:#2b2b2b;color:#e2e8f0;font:12px Inter,Segoe UI,sans-serif}
.root{padding:8px;display:flex;flex-direction:column;gap:8px;height:100vh;box-sizing:border-box;background:transparent}
.head{display:flex;justify-content:space-between;align-items:center;padding:2px 6px}
.head .actions{display:flex;align-items:center;gap:6px}
.head .title{display:flex;align-items:center;gap:8px}
.head .t{font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:.08em}
.head .total{font-size:10px;color:#cbd5e1;font-weight:700;letter-spacing:.04em}
.icon-btn{width:22px;height:22px;border:none;background:transparent;color:#94a3b8;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.icon-btn img{width:12px;height:12px;opacity:.95}
.head .icon-btn img{width:14px;height:14px}
.icon-btn:hover{background:rgba(37,99,235,.15)}
.btn.del img{filter: brightness(0) saturate(100%) invert(49%) sepia(57%) saturate(2387%) hue-rotate(329deg) brightness(102%) contrast(88%);}
.btn.add img{filter: brightness(0) saturate(100%) invert(64%) sepia(59%) saturate(2233%) hue-rotate(92deg) brightness(98%) contrast(78%);}
.srow img,.head .icon-btn img,.adv img{filter: brightness(0) saturate(100%) invert(72%) sepia(13%) saturate(476%) hue-rotate(176deg) brightness(87%) contrast(86%);}
.panel{flex:1;border:none;border-radius:0;background:transparent;padding:0;overflow:auto}
.panel{scrollbar-width:thin;scrollbar-color:rgba(148,163,184,.35) transparent}
.panel::-webkit-scrollbar{width:6px}
.panel::-webkit-scrollbar-track{background:transparent}
.panel::-webkit-scrollbar-thumb{background:rgba(148,163,184,.35);border-radius:8px}
.panel::-webkit-scrollbar-thumb:hover{background:rgba(148,163,184,.55)}
.pill{display:flex;align-items:center;gap:8px;background:#3c3c3c;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:5px 8px;margin:0}
.pill.active{border-color:#2563eb;box-shadow:0 0 0 1px rgba(37,99,235,.25) inset}
.letter{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;background:#fff;border:2px solid #2563eb;color:#2563eb;font-size:11px}
.letter.dim{background:#2b2b2b;border-color:#484848;color:#94a3b8}
.inp{flex:1;background:transparent;border:none;color:#fff;outline:none;font-size:12px}
.conn{height:14px;margin:6px 0 6px 18px;border-left:2px dashed #484848;display:flex;align-items:center;padding-left:12px;color:#94a3b8;font-weight:700;font-size:10px}
.insert-btn{width:18px;height:18px;border-radius:9px;border:1px solid #484848;background:#252526;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin-left:6px}
.insert-btn img{width:10px;height:10px;filter: brightness(0) saturate(100%) invert(72%) sepia(13%) saturate(476%) hue-rotate(176deg) brightness(87%) contrast(86%)}
.insert-btn:hover{border-color:#2563eb;background:rgba(37,99,235,.15)}
.sugg{margin-left:0;margin-right:0;margin-top:4px;border:1px solid #2563eb;border-radius:9px;background:#252526;padding:2px}
.srow{height:30px;display:flex;align-items:center;gap:8px;padding:0 10px;border-radius:6px;cursor:pointer}
.srow:hover{background:rgba(37,99,235,.15)}
.srow img{width:12px;height:12px;opacity:.95}
.footer{display:none}
</style></head>
<body><div class="root"><div class="head"><div class="title"><div class="t">ÉTAPES</div><div id="totalDist" class="total"></div></div><div class="actions"><button class="icon-btn" title="Paramètres avancés" onclick="window.routeBridge&&routeBridge.onOpenAdvanced()"><img src="icons/settings.svg"></button><button class="icon-btn" title="Importer GeoJSON" onclick="window.routeBridge&&routeBridge.onAddRequested('__IMPORT__')"><img src="icons/folder-open.svg"></button></div></div><div id="panel" class="panel"></div><div class="footer"><button class="adv" onclick="window.routeBridge&&routeBridge.onOpenAdvanced()"><img src="icons/settings.svg">Paramètres avancés</button></div></div>
<script>
let bridge=null,state={stages:[],dists:[],total:''},suggestions=[],active={kind:'add',index:-1};
let drafts={stage:{},add:'',insert:{}};
let lastCount=0;
let restoringFocus=false;
let rendering=false;
let keepFocus=false;
new QWebChannel(qt.webChannelTransport,ch=>{bridge=ch.objects.routeBridge;window.routeBridge=bridge;});
function setState(payload){
  const prev=lastCount;
  state=payload||{stages:[],dists:[],total:''};
  lastCount=(state.stages||[]).length;
  const newDrafts={};
  Object.keys(drafts.stage||{}).forEach(k=>{
    const idx=parseInt(k,10);
    if(!Number.isNaN(idx) && idx>=0 && idx<lastCount) newDrafts[idx]=drafts.stage[k];
  });
  drafts.stage=newDrafts;
  const insertDrafts={};
  Object.keys(drafts.insert||{}).forEach(k=>{
    const idx=parseInt(k,10);
    if(!Number.isNaN(idx) && idx>=0 && idx<lastCount) insertDrafts[idx]=drafts.insert[k];
  });
  drafts.insert=insertDrafts;
  if(active.kind==='stage' && active.index>=lastCount){
    active={kind:(lastCount===0?'add':null),index:-1};
    suggestions=[];
  }
  if(active.kind==='insert' && active.index>=lastCount-1){
    active={kind:(lastCount===0?'add':null),index:-1};
    suggestions=[];
  }
  if(lastCount===0){ active={kind:'add',index:-1}; }
  render();
  if(lastCount>prev){
    requestAnimationFrame(()=>{
      const p=document.getElementById('panel');
      if(p) p.scrollTop=p.scrollHeight;
    });
  }
}
function setSuggestions(payload){suggestions=payload||[];render();}
function focusStage(i){
  if(restoringFocus) return;
  active={kind:'stage',index:i};
  if(bridge) bridge.onStageFocused(i);
}
function focusAdd(){
  if(restoringFocus) return;
  active={kind:'add',index:-1};
  if(bridge) bridge.onAddFocused();
}
function focusInsert(afterIdx){
  if(restoringFocus) return;
  active={kind:'insert',index:afterIdx};
  if(bridge) bridge.onInsertFocused(afterIdx);
}
function restoreFocusAfterRender(){
  if(!keepFocus) return;
  let el=null;
  if(active.kind==='stage' && active.index>=0){
    el=document.getElementById('stageInput-'+active.index);
  }else if(active.kind==='add'){
    el=document.getElementById('addInput');
  }else if(active.kind==='insert'){
    el=document.getElementById('insertInput-'+active.index);
  }
  if(el){
    if(document.activeElement===el) return;
    const pos=(el.value||'').length;
    restoringFocus=true;
    el.focus();
    try{ el.setSelectionRange(pos,pos); }catch(_e){}
    setTimeout(()=>{restoringFocus=false;},0);
  }
}
function clearDraft(kind, idx){
  if(kind==='stage'){
    delete drafts.stage[idx];
  }else if(kind==='add'){
    drafts.add='';
  }else if(kind==='insert'){
    delete drafts.insert[idx];
  }
}
function exitInsertMode(){
  active={kind:'add',index:-1};
  keepFocus=false;
  suggestions=[];
  render();
}
function render(){
  if(rendering) return;
  rendering=true;
  const totalEl=document.getElementById('totalDist');
  if(totalEl){ totalEl.textContent=state.total||''; }
  const p=document.getElementById('panel'); let h='';
  (state.stages||[]).forEach((s,i)=>{ if(i>0){
    const betweenBtn = `<button class="insert-btn" title="Insérer une étape ici" onmousedown="keepFocus=true;focusInsert(${i-1})"><img src="icons/plus.svg"></button>`;
    h+=`<div class="conn">${(state.dists||[])[i-1]||''}${betweenBtn}</div>`;
  }
    const useDraft = (active.kind==='stage' && active.index===i && drafts.stage[i]!==undefined);
    const val = useDraft ? drafts.stage[i] : (s.display||'');
    const activeCls = (active.kind==='stage'&&active.index===i)?' active':'';
    h+=`<div class="pill${activeCls}"><div class="letter">${s.label||String.fromCharCode(65+i)}</div><input class="inp" id="stageInput-${i}" value="${String(val).replaceAll('"','&quot;')}" onfocus="keepFocus=true;focusStage(${i})" oninput="keepFocus=true;drafts.stage[${i}]=this.value; bridge&&bridge.onStageTextChanged(${i},this.value)"><button class="icon-btn btn del" title="Supprimer cette étape" onclick="bridge&&bridge.onDeleteStage(${i})"><img src="icons/trash-2.svg"></button></div>`;
    if(active.kind==='stage'&&active.index===i&&suggestions.length){h+=`<div class="sugg">${suggestions.map((x,idx)=>`<div class="srow" onmousedown="bridge&&bridge.onSuggestionChosen(${idx})">${x.icon?`<img src="${x.icon}">`:''}<span>${x.label}</span></div>`).join('')}</div>`}
    if(active.kind==='insert'&&active.index===i){
      const insertVal = drafts.insert[i] || '';
      const insertLetter = String.fromCharCode(65 + i + 1);
      h+=`<div class="conn"></div><div class="pill active"><div class="letter">${insertLetter}</div><input class="inp" id="insertInput-${i}" placeholder="Ajouter une étape..." value="${String(insertVal).replaceAll('"','&quot;')}" onfocus="keepFocus=true;focusInsert(${i})" oninput="keepFocus=true;drafts.insert[${i}]=this.value; bridge&&bridge.onInsertTextChanged(${i},this.value)"></div>`;
      if(suggestions.length){h+=`<div class="sugg">${suggestions.map((x,idx)=>`<div class="srow" onmousedown="bridge&&bridge.onSuggestionChosen(${idx})">${x.icon?`<img src="${x.icon}">`:''}<span>${x.label}</span></div>`).join('')}</div>`}
    }
  });
  if((state.stages||[]).length){h+='<div class="conn"></div>'}
  const hasStages=(state.stages||[]).length>0;
  const nl=String.fromCharCode(65+(state.stages||[]).length);
  const addCls = (active.kind==='add' || !hasStages)?' active':'';
  h+=`<div class="pill${addCls}"><div class="letter${hasStages?' dim':''}">${nl}</div><input class="inp" placeholder="Ajouter une étape..." value="${String(drafts.add||'').replaceAll('"','&quot;')}" onfocus="keepFocus=true;focusAdd()" oninput="keepFocus=true;drafts.add=this.value; bridge&&bridge.onAddTextChanged(this.value)" id="addInput"></div>`;
  if(active.kind==='add'&&suggestions.length){h+=`<div class="sugg">${suggestions.map((x,idx)=>`<div class="srow" onmousedown="bridge&&bridge.onSuggestionChosen(${idx})">${x.icon?`<img src="${x.icon}">`:''}<span>${x.label}</span></div>`).join('')}</div>`}
  p.innerHTML=h;
  restoreFocusAfterRender();
  const sugg=p.querySelector('.sugg');
  if(sugg){ sugg.scrollIntoView({block:'nearest'}); }
  rendering=false;
}
document.addEventListener('mousedown',(ev)=>{
  const t=ev.target;
  const inside=t && t.closest && (t.closest('.pill') || t.closest('.sugg'));
  if(!inside){
    keepFocus=false;
    active={kind:null,index:-1};
    suggestions=[];
    render();
  }
}, true);
</script></body></html>
"""

    def _push_state_to_web(self):
        if not hasattr(self, "web") or not self._web_ready:
            return
        stages = self.state_manager.get_state("stages", [])
        routes = self.state_manager.get_state("routes", [])
        payload_stages = []
        dists = []
        total_m = 0
        for i, stage in enumerate(stages):
            payload_stages.append({"label": stage.get("label", chr(65 + i)), "display": self._format_stage_text(stage)})
            if i > 0:
                dist_m = 0
                if i - 1 < len(routes):
                    dist_m = routes[i - 1].get("distance_m", 0) or 0
                if dist_m <= 0:
                    dist_m = self._distance_m_between(stages[i - 1], stage)
                if dist_m > 0:
                    total_m += dist_m
                dists.append(f"{dist_m/1000:.1f} km" if dist_m >= 1000 else (f"{int(dist_m)} m" if dist_m > 0 else ""))
        total_txt = ""
        if total_m > 0:
            total_txt = f"Total {total_m/1000:.1f} km" if total_m >= 1000 else f"Total {int(total_m)} m"
        js = f"setState({json.dumps({'stages': payload_stages, 'dists': dists, 'total': total_txt})});"
        self.web.page().runJavaScript(js)

    def _push_suggestions_to_web(self):
        if hasattr(self, "web") and self._web_ready:
            self.web.page().runJavaScript(f"setSuggestions({json.dumps(self._web_suggestions)});")

    def _on_web_loaded(self, ok):
        self._web_ready = bool(ok)
        if self._web_ready:
            self._push_state_to_web()
            self._push_suggestions_to_web()

    def _on_suggestion_selected_from_web(self, index):
        if index < 0 or index >= len(self._web_suggestions):
            return
        res = self._web_suggestions[index].get("payload")
        if not res:
            return
        self._apply_suggestion_payload(res)

    def _open_advanced_params_dialog(self):
        settings = self.state_manager.get_state("polygonalization_settings", {})
        small_roads_only = self.state_manager.get_state("small_roads_only", True)

        dialog = QDialog(self)
        dialog.setWindowTitle("Paramètres avancés de l'itinéraire")
        dialog.setModal(True)
        dialog.setFixedWidth(360)
        dialog.setStyleSheet(f"""
            QDialog {{
                background: rgba(30, 32, 38, 0.93);
                color: #e2e8f0;
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 0px;
            }}
            QLabel {{
                color: #e2e8f0;
                font-size: 12px;
            }}
            QLabel#popupTitle {{
                font-size: 14px;
                font-weight: 700;
                color: #ffffff;
            }}
            QLabel#sectionLabel {{
                color: #94a3b8;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
            }}
            QCheckBox {{
                color: #e2e8f0;
                font-size: 12px;
                spacing: 6px;
            }}
            QCheckBox::indicator {{
                width: 14px;
                height: 14px;
                border: 1px solid #94a3b8;
                background: #252526;
                border-radius: 4px;
            }}
            QCheckBox::indicator:checked {{
                background: #2563eb;
                border-color: #2563eb;
            }}
            QPushButton {{
                background: #3c3c3c;
                color: #e2e8f0;
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 14px;
                padding: 6px 10px;
                font-size: 11px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background: #484848;
                border-color: #3b82f6;
                color: #ffffff;
            }}
            QPushButton#primaryBtn {{
                background: #2563eb;
                border-color: #2563eb;
                color: #ffffff;
                font-weight: 700;
            }}
            QPushButton#primaryBtn:hover {{
                background: #3b82f6;
                border-color: #3b82f6;
            }}
            QPushButton#dangerBtn {{
                color: #ef4444;
                border-color: rgba(239,68,68,0.35);
            }}
            QSlider::groove:horizontal {{
                border: 0;
                height: 4px;
                background: #3c3c3c;
                border-radius: 2px;
            }}
            QSlider::handle:horizontal {{
                width: 14px;
                margin: -5px 0;
                border-radius: 7px;
                background: #ffffff;
                border: 3px solid #2563eb;
            }}
        """)
        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(18, 18, 18, 18)
        layout.setSpacing(12)

        header = QHBoxLayout()
        icon_chip = QLabel()
        icon_chip.setFixedSize(32, 32)
        icon_chip.setStyleSheet("background: rgba(255,255,255,0.05); border-radius: 8px;")
        icon_chip.setAlignment(Qt.AlignCenter)
        icon_chip.setPixmap(self._icon("settings").pixmap(16, 16))
        header.addWidget(icon_chip)

        title = QLabel("Paramètres de l'itinéraire")
        title.setObjectName("popupTitle")
        header.addWidget(title)
        header.addStretch(1)

        btn_close = QPushButton("")
        btn_close.setFixedSize(26, 26)
        btn_close.setIcon(self._icon("x"))
        btn_close.setIconSize(QSize(12, 12))
        btn_close.clicked.connect(dialog.reject)
        header.addWidget(btn_close)
        layout.addLayout(header)

        sep = QFrame()
        sep.setFrameShape(QFrame.HLine)
        sep.setStyleSheet("color: rgba(255,255,255,0.08);")
        layout.addWidget(sep)

        cb_small_roads = QCheckBox("Chemins et forêts uniquement")
        cb_small_roads.setChecked(bool(small_roads_only))
        layout.addWidget(cb_small_roads)

        cb_line = QCheckBox("Mode ligne droite")
        cb_line.setChecked(bool(settings.get("allow_offroad", False)))
        layout.addWidget(cb_line)

        cb_intersections = QCheckBox("Polygonalisation aux carrefours")
        cb_intersections.setChecked(bool(settings.get("force_intersections", True)))
        layout.addWidget(cb_intersections)

        row_tol = QHBoxLayout()
        lbl_tol = QLabel("Finesse de virage")
        lbl_tol.setObjectName("sectionLabel")
        val_tol = QLabel(f"{int(settings.get('tolerance', 45))}°")
        val_tol.setStyleSheet("font-family: Consolas; color: #ffffff; font-weight: 700;")
        row_tol.addWidget(lbl_tol)
        row_tol.addStretch(1)
        row_tol.addWidget(val_tol)
        layout.addLayout(row_tol)

        slider_tol = QSlider(Qt.Horizontal)
        slider_tol.setMinimum(0)
        slider_tol.setMaximum(90)
        slider_tol.setValue(int(settings.get("tolerance", 45)))
        slider_tol.valueChanged.connect(lambda v: val_tol.setText(f"{v}°"))
        layout.addWidget(slider_tol)

        row_dist = QHBoxLayout()
        lbl_dist = QLabel("Distance minimale")
        lbl_dist.setObjectName("sectionLabel")
        val_dist = QLabel(f"{int(settings.get('min_dist', 80))} m")
        val_dist.setStyleSheet("font-family: Consolas; color: #ffffff; font-weight: 700;")
        row_dist.addWidget(lbl_dist)
        row_dist.addStretch(1)
        row_dist.addWidget(val_dist)
        layout.addLayout(row_dist)

        slider_dist = QSlider(Qt.Horizontal)
        slider_dist.setMinimum(10)
        slider_dist.setMaximum(250)
        slider_dist.setValue(int(settings.get("min_dist", 80)))
        slider_dist.valueChanged.connect(lambda v: val_dist.setText(f"{v} m"))
        layout.addWidget(slider_dist)

        row_actions = QHBoxLayout()
        btn_reverse = QPushButton(" Inverser l'itinéraire")
        btn_reverse.setCursor(Qt.PointingHandCursor)
        btn_reverse.setIcon(self._icon("arrow-up-down"))
        btn_reverse.setIconSize(QSize(12, 12))
        btn_reverse.clicked.connect(self._reverse_active)
        row_actions.addWidget(btn_reverse)

        btn_clear = QPushButton("")
        btn_clear.setFixedWidth(44)
        btn_clear.setCursor(Qt.PointingHandCursor)
        btn_clear.setIcon(self._icon("trash-2"))
        btn_clear.setIconSize(QSize(12, 12))
        btn_clear.setObjectName("dangerBtn")
        btn_clear.clicked.connect(self._clear_all_itinerary)
        row_actions.addWidget(btn_clear)
        layout.addLayout(row_actions)

        btn_apply = QPushButton("Appliquer et recalculer")
        btn_apply.setCursor(Qt.PointingHandCursor)
        btn_apply.setObjectName("primaryBtn")
        layout.addWidget(btn_apply)

        def apply_and_close():
            payload = {
                "small_roads_only": cb_small_roads.isChecked(),
                "allow_offroad": cb_line.isChecked(),
                "force_intersections": cb_intersections.isChecked(),
                "tolerance": slider_tol.value(),
                "min_dist": slider_dist.value(),
            }
            self.advanced_params_applied.emit(payload)
            dialog.accept()

        btn_apply.clicked.connect(apply_and_close)
        dialog.exec()

    def _mksugg(self):
        w = QListWidget(self)
        w.setStyleSheet(f"""
            QListWidget{{
                background: #252526;
                border: 1px solid #2563eb;
                border-top: 1px solid #2563eb;
                border-radius: 9px;
                margin-left: 28px;
                margin-right: 8px;
                outline: none;
                padding: 2px;
            }}
            QListWidget::item{{
                height: 30px;
                padding: 0 10px;
                color: #e2e8f0;
                font-size: 12px;
                font-family: 'Inter', 'Segoe UI', sans-serif;
                border-radius: 6px;
                margin: 1px;
            }}
            QListWidget::item:hover{{
                background: rgba(37,99,235,0.15);
                color: #ffffff;
            }}
            QListWidget::item:selected{{
                background: rgba(37,99,235,0.22);
                color: #ffffff;
            }}
        """)
        w.setIconSize(QSize(13, 13))
        w.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        self.suggestion_wrapper = SuggestionWrapper(w, self)
        self.suggestion_wrapper.setVisible(False)
        return w

    # ═══════════════════════════════════════════════════════
    #  STAGE LIST — rebuild from state
    # ═══════════════════════════════════════════════════════

    def _rebuild_stage_list(self):
        """Recreate all stage rows from the state manager."""
        if self._use_web_ui:
            self._push_state_to_web()
            return

        # Prévention du crash: extraire la liste de suggestions avant la purge du layout
        self._stage_layout.removeWidget(self.suggestion_wrapper)
        self.suggestion_wrapper.setParent(self)
        self.suggestion_wrapper.setVisible(False)

        # Clear existing widgets & stretches
        while self._stage_layout.count():
            child = self._stage_layout.takeAt(0)
            if child.widget() and child.widget() is not self.suggestion_wrapper:
                child.widget().deleteLater()
            elif child.spacerItem():
                pass

        stages = self.state_manager.get_state("stages", [])
        routes = self.state_manager.get_state("routes", [])

        # Auto-scroll trigger if stages were added (e.g. from map click)
        should_scroll = False
        if not hasattr(self, "_last_stage_count"):
            self._last_stage_count = 0
        if len(stages) > self._last_stage_count:
            should_scroll = True
        self._last_stage_count = len(stages)

        for i, stage in enumerate(stages):
            # Connector from previous stage
            if i > 0:
                dist_str = ""
                if (i - 1) < len(routes):
                    dist_m = routes[i - 1].get("distance_m", 0)
                    if dist_m > 0:
                        dist_str = f"{dist_m/1000:.1f} KM" if dist_m >= 1000 else f"{int(dist_m)} M"
                if not dist_str and i - 1 < len(stages):
                    fallback_m = self._distance_m_between(stages[i - 1], stage)
                    if fallback_m > 0:
                        dist_str = f"{fallback_m/1000:.1f} KM" if fallback_m >= 1000 else f"{int(fallback_m)} M"
                conn = ConnectorRow(dist_str)
                self._stage_layout.addWidget(conn)

            # Build display text: show coords, address, or empty
            display = self._format_stage_text(stage)
            row = StageRow(i, stage.get("label", chr(65 + i)), display)
            row.pick_requested.connect(self._on_stage_pick_requested)
            row.delete_requested.connect(self._on_stage_delete_requested)
            row.text_changed.connect(self._on_stage_text_changed)
            row.focus_received.connect(self._on_stage_focus_received)
            row.focus_lost.connect(self._on_stage_focus_lost)
            row.center_requested.connect(self._on_stage_center_requested)
            self._stage_layout.addWidget(row)

        # Connector before add row
        if stages:
            conn = ConnectorRow()
            self._stage_layout.addWidget(conn)

        # Terminal add row
        next_letter = chr(65 + len(stages)) if stages else "A"
        self._add_row = AddRow(next_letter)
        self._add_row.add_requested.connect(self._on_add_requested)
        self._add_row.pick_requested.connect(lambda: self._on_stage_pick_requested(len(stages)))
        self._add_row.text_changed.connect(self._on_add_text_changed)
        self._add_row.focus_received.connect(self._on_add_focus_received)
        self._add_row.focus_lost.connect(self._on_add_focus_lost)
        self._stage_layout.addWidget(self._add_row)
        
        # Add stretch to push items to the top if there is extra space
        self._stage_layout.addStretch(1)
        
        if should_scroll:
            self._scroll_to_bottom()

    @staticmethod
    def _format_stage_text(stage):
        """Format a stage dict into a display string (address or coords)."""
        addr = stage.get("address", "")
        lat  = stage.get("lat")
        lon  = stage.get("lon")
        if addr:
            return addr
        if lat is not None and lon is not None:
            return f"{lat:.5f}, {lon:.5f}"
        return ""

    @staticmethod
    def _distance_m_between(stg_a, stg_b):
        lat1, lon1 = stg_a.get("lat"), stg_a.get("lon")
        lat2, lon2 = stg_b.get("lat"), stg_b.get("lon")
        if None in (lat1, lon1, lat2, lon2):
            return 0
        from math import radians, sin, cos, asin, sqrt
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
        c = 2 * asin(sqrt(a))
        return int(6371000 * c)

    # ═══════════════════════════════════════════════════════
    #  SEARCH / AUTOCOMPLETE
    # ═══════════════════════════════════════════════════════

    def _on_stage_text_changed(self, index, text):
        """Triggered when a stage row input changes — start search timer."""
        if self._use_web_ui:
            self._active_search_is_add = False
            self._active_search_index = index
            self._active_search_text = text or ""
            if not self._active_search_text.strip():
                self._show_default_suggestions()
            else:
                self._search_timer.start(400)
            return
        stages = self.state_manager.get_state("stages", [])
        if 0 <= index < len(stages):
            row_widget = self._find_stage_row(index)
            if row_widget:
                self._active_search_input = row_widget.input
                self._active_search_is_add = False
                self._active_search_index = index
                if text.strip() == "":
                    self._show_default_suggestions()
                else:
                    self._search_timer.start(400)

    def _on_add_text_changed(self, text):
        """Triggered when the Add row input changes."""
        if self._use_web_ui:
            self._active_search_is_add = True
            self._active_search_index = -1
            self._active_search_text = text or ""
            if not self._active_search_text.strip():
                self._show_default_suggestions()
            else:
                self._search_timer.start(400)
            return
        self._active_search_input = self._add_row.input
        self._active_search_is_add = True
        self._active_search_index = -1
        if text.strip() == "":
            self._show_default_suggestions()
        else:
            self._search_timer.start(400)

    def _on_insert_text_changed(self, after_index, text):
        if self._use_web_ui:
            self._active_search_is_add = True
            self._active_insert_after = int(after_index)
            self._active_search_index = -1
            self._active_search_text = text or ""
            if not self._active_search_text.strip():
                self._show_default_suggestions()
            else:
                self._search_timer.start(400)

    def _on_insert_focus_received(self, after_index):
        main_win = self.window()
        if hasattr(main_win, "set_active_tool"):
            main_win.set_active_tool("route")
        if hasattr(main_win, "set_stage_anchor"):
            main_win.set_stage_anchor(int(after_index))
        if self._use_web_ui:
            self._active_search_is_add = True
            self._active_insert_after = int(after_index)
            self._active_search_index = -1
            self._active_search_text = ""
            self._show_default_suggestions()

    def _on_insert_requested(self, after_index, text):
        if not text or not text.strip():
            return
        self.state_manager.push_to_history()
        stages = self.state_manager.get_state("stages", [])
        insert_pos = int(after_index) + 1
        if insert_pos < 0 or insert_pos > len(stages):
            return
        stages.insert(insert_pos, {"label": "-", "address": text.strip()})
        for i, s in enumerate(stages):
            s["label"] = chr(65 + i)
        self.state_manager.update_state("stages", stages)
        self._active_insert_after = None
        self._active_search_text = ""
        self._hide_suggestions()
        self._rebuild_stage_list()
        main_win = self.window()
        if hasattr(main_win, "set_stage_anchor") and stages:
            main_win.set_stage_anchor(len(stages) - 1)

    def _on_stage_focus_received(self, index):
        main_win = self.window()
        if hasattr(main_win, "set_active_tool"):
            main_win.set_active_tool("route")
        if hasattr(main_win, "set_stage_anchor"):
            main_win.set_stage_anchor(index)
        if self._use_web_ui:
            self._active_search_is_add = False
            self._active_search_index = index
            self._active_insert_after = None
            self._active_search_text = ""
            self._show_default_suggestions()
            return
        stages = self.state_manager.get_state("stages", [])
        if 0 <= index < len(stages):
            row_widget = self._find_stage_row(index)
            if row_widget:
                self._active_search_input = row_widget.input
                self._active_search_is_add = False
                self._active_search_index = index
                self._stages_scroll.ensureWidgetVisible(row_widget)
                if not row_widget.input.text().strip():
                    self._show_default_suggestions()

    def _on_add_focus_received(self):
        main_win = self.window()
        if hasattr(main_win, "set_active_tool"):
            main_win.set_active_tool("route")
        if self._use_web_ui:
            self._active_search_is_add = True
            self._active_search_index = -1
            self._active_insert_after = None
            self._active_search_text = ""
            self._show_default_suggestions()
            return
        self._active_search_input = self._add_row.input
        self._active_search_is_add = True
        self._active_search_index = -1
        self._stages_scroll.ensureWidgetVisible(self._add_row)
        if not self._add_row.input.text().strip():
            self._show_default_suggestions()

    def _on_stage_focus_lost(self, index):
        self._handle_focus_lost()

    def _on_add_focus_lost(self):
        self._handle_focus_lost()

    def _handle_focus_lost(self):
        QTimer.singleShot(150, self._check_focus_and_hide)

    def _check_focus_and_hide(self):
        if not self.suggestion_wrapper.isVisible():
            return
        if self.list_suggestions.hasFocus() or self.list_suggestions.underMouse():
            return
        if self._active_search_input and self._active_search_input.hasFocus():
            return
        self._hide_suggestions()

    def _hide_suggestions(self):
        if self._use_web_ui:
            self._web_suggestions = []
            self._push_suggestions_to_web()
            return
        self.suggestion_wrapper.setVisible(False)
        if hasattr(self, '_last_target') and self._last_target:
            try:
                self._last_target.layout().setContentsMargins(0, 3, 0, 3)
            except RuntimeError:
                pass
            self._last_target = None

    def _position_and_show_suggestions(self):
        count = self.list_suggestions.count()
        if count == 0:
            self._hide_suggestions()
            return

        target_widget = self._add_row if self._active_search_is_add else self._find_stage_row(self._active_search_index)
        
        if hasattr(self, '_last_target') and self._last_target and self._last_target != target_widget:
            try:
                self._last_target.layout().setContentsMargins(0, 3, 0, 3)
            except RuntimeError:
                pass
                
        if target_widget:
            self._last_target = target_widget
            target_widget.layout().setContentsMargins(0, 3, 0, 0)
            
            idx = self._stage_layout.indexOf(target_widget)
            if idx >= 0:
                self._stage_layout.insertWidget(idx + 1, self.suggestion_wrapper)
        self.list_suggestions.setFixedHeight(999)  # Give room to force layout
        self.suggestion_wrapper.setVisible(True)
        QTimer.singleShot(10, lambda: self._finalize_suggestions_layout(target_widget, count))

    def _finalize_suggestions_layout(self, target_widget, count):
        # Because we fixed item heights via stylesheet
        ideal_height = count * 30 + 2  # 30px per item + 2px for top/bottom borders

        view_height = self._stages_scroll.viewport().height()
        target_h = target_widget.height() if target_widget else 30
        available_height = max(30, view_height - target_h)
        
        if ideal_height > available_height:
            self.list_suggestions.setFixedHeight(available_height)
            self.list_suggestions.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        else:
            self.list_suggestions.setFixedHeight(ideal_height)
            self.list_suggestions.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
            
        QTimer.singleShot(10, lambda: self._scroll_to_results(target_widget))

    def _scroll_to_results(self, target_widget):
        if not target_widget:
            return
            
        scrollbar = self._stages_scroll.verticalScrollBar()
        target_y = target_widget.geometry().top()
        bottom_y = self.suggestion_wrapper.geometry().bottom()
        
        view_height = self._stages_scroll.viewport().height()
        current_bottom = scrollbar.value() + view_height
        
        if bottom_y > current_bottom:
            new_scroll = bottom_y - view_height + 4
            new_scroll = min(new_scroll, target_y)
            scrollbar.setValue(new_scroll)
        else:
            self._stages_scroll.ensureWidgetVisible(target_widget)

    # ── Error messages for geocoding feedback ──────────
    _GEOCODE_ERRORS = {
        "query_too_short": "⚠ Saisissez au moins 3 caractères",
        "bad_request":    "⚠ Requête invalide — vérifiez l'adresse",
        "timeout":        "⚠ Serveur lent — réessayez dans un instant",
        "network_error":  "⚠ Pas de connexion réseau",
        "parse_error":    "⚠ Réponse inattendue du serveur",
    }

    def _do_search(self):
        """Execute the debounced address search."""
        if self._use_web_ui:
            text = (self._active_search_text or "").strip()
        else:
            if not self._active_search_input:
                return
            text = self._active_search_input.text().strip()
        if not text:
            self._show_default_suggestions()
            return
        if len(text) < 3:
            if not text:
                self._show_default_suggestions()
            else:
                self._hide_suggestions()
            return

        response = self.ign_client.search_address(text, limit=15)

        if isinstance(response, dict):
            results = response.get("results", [])
            error   = response.get("error")
        else:
            results = response
            error   = None

        self._full_suggestions = results
        if not self._use_web_ui:
            self.list_suggestions.clear()

        if error and not results:
            err_msg = self._GEOCODE_ERRORS.get(error, f"⚠ Erreur : {error}")
            if not self._use_web_ui:
                item = QListWidgetItem(err_msg)
                item.setFlags(item.flags() & ~Qt.ItemIsSelectable)
                self.list_suggestions.addItem(item)
            else:
                self._web_suggestions = [{"label": err_msg, "icon": "", "payload": None}]
            main_win = self.window()
            if hasattr(main_win, 'statusBar'):
                main_win.statusBar().showMessage(err_msg, 4000)
        else:
            display_results = results[:5] if len(results) > 6 else results
            if self._use_web_ui:
                self._web_suggestions = [
                    {"label": f"{r['label']} ({r.get('postcode', '')})", "icon": "icons/map-pin.svg", "payload": r}
                    for r in display_results
                ]
            else:
                for r in display_results:
                    item = QListWidgetItem(f"{r['label']} ({r.get('postcode', '')})")
                    item.setIcon(self._icon("map-pin"))
                    item.setData(Qt.UserRole, r)
                    self.list_suggestions.addItem(item)
                if len(results) > 6:
                    more = QListWidgetItem("[+] Afficher plus de résultats...")
                    more.setData(Qt.UserRole, "SHOW_MORE")
                    more.setForeground(QColor(_ACCENT))
                    f = more.font()
                    f.setItalic(True)
                    more.setFont(f)
                    self.list_suggestions.addItem(more)

        if results or error:
            if self._use_web_ui:
                self._push_suggestions_to_web()
            else:
                self._position_and_show_suggestions()
        else:
            self._hide_suggestions()

    def _get_history(self):
        settings = QSettings("ESTP", "Scouts")
        return settings.value("search_history", [])

    def _add_to_history(self, item_dict):
        settings = QSettings("ESTP", "Scouts")
        hist = self._get_history()
        hist = [h for h in hist if h.get("label") != item_dict["label"]]
        hist.insert(0, item_dict)
        settings.setValue("search_history", hist[:5])

    def _show_default_suggestions(self):
        self._full_suggestions = []
        if not self._use_web_ui:
            self.list_suggestions.clear()
        else:
            self._web_suggestions = []
        
        if self._use_web_ui:
            self._web_suggestions.append({"label": "Votre position", "icon": "icons/map-pin.svg", "payload": {"type": "location", "label": "Votre position"}})
        else:
            item = QListWidgetItem("Votre position")
            item.setIcon(self._icon("map-pin"))
            item.setData(Qt.UserRole, {"type": "location", "label": "Votre position"})
            self.list_suggestions.addItem(item)
        
        hist = self._get_history()
        for h_item in hist:
            lbl = h_item.get("label", "")
            payload = {"type": "history", "label": lbl, "lat": h_item.get("lat"), "lon": h_item.get("lon")}
            if self._use_web_ui:
                self._web_suggestions.append({"label": lbl, "icon": "icons/history.svg", "payload": payload})
            else:
                it = QListWidgetItem(lbl)
                it.setIcon(self._icon("history"))
                it.setData(Qt.UserRole, payload)
                self.list_suggestions.addItem(it)
        if self._use_web_ui:
            self._push_suggestions_to_web()
        else:
            self._position_and_show_suggestions()

    def _on_suggestion_clicked(self, item):
        """User picked an address from the autocomplete list."""
        res = item.data(Qt.UserRole)
        
        if res == "SHOW_MORE":
            self.list_suggestions.clear()
            for r in self._full_suggestions:
                it = QListWidgetItem(f"{r['label']} ({r.get('postcode', '')})")
                it.setIcon(self._icon("map-pin"))
                it.setData(Qt.UserRole, r)
                self.list_suggestions.addItem(it)
            self._position_and_show_suggestions()
            return

        if res:
            self._apply_suggestion_payload(res)

    def _apply_suggestion_payload(self, res):
        self._hide_suggestions()
        was_add = self._active_search_is_add
        target_idx = self._active_search_index
        insert_after = self._active_insert_after
        if res.get("type") == "location":
            if self._location_lookup_pending:
                return
            address = "Votre position"
            main_win = self.window()
            map_view = getattr(main_win, "map_view", None)
            pos = getattr(map_view, "_last_known_user_pos", None) if map_view is not None else None
            if pos and len(pos) == 2:
                self._apply_suggestion_coords(address, float(pos[0]), float(pos[1]), was_add, target_idx, insert_after)
                return

            if map_view is None:
                return

            self._location_lookup_pending = True
            finished = {"done": False}

            def _finish_ok(lat_v, lon_v):
                if finished["done"]:
                    return
                finished["done"] = True
                self._location_lookup_pending = False
                try:
                    map_view._geo_signal.disconnect(_on_geo_received)
                except Exception:
                    pass
                self._apply_suggestion_coords(address, float(lat_v), float(lon_v), was_add, target_idx, insert_after)

            def _finish_fail():
                if finished["done"]:
                    return
                finished["done"] = True
                self._location_lookup_pending = False
                try:
                    map_view._geo_signal.disconnect(_on_geo_received)
                except Exception:
                    pass
                if hasattr(main_win, "statusBar"):
                    main_win.statusBar().showMessage("Position indisponible (géolocalisation échouée)", 3000)

            def _on_geo_received(lat_v, lon_v):
                _finish_ok(lat_v, lon_v)

            def _on_timeout():
                pos_now = getattr(map_view, "_last_known_user_pos", None)
                if pos_now and len(pos_now) == 2:
                    _finish_ok(pos_now[0], pos_now[1])
                else:
                    _finish_fail()

            map_view._geo_signal.connect(_on_geo_received)
            if hasattr(map_view, "request_user_location"):
                map_view.request_user_location()
            else:
                if hasattr(map_view, "web_view") and map_view.web_view is not None:
                    map_view.web_view.page().runJavaScript(
                        "(function(){var b=document.getElementById('tb-geolocate'); if(b){b.click();}})();"
                    )
                if hasattr(map_view, "_start_native_geolocation"):
                    map_view._start_native_geolocation()
            QTimer.singleShot(4000, _on_timeout)
            return
        elif res.get("type") == "history":
            address = res["label"]
            lat, lon = res["lat"], res["lon"]
        else:
            address = res["label"]
            lat, lon = res["lat"], res["lon"]
            self._add_to_history({"label": address, "lat": lat, "lon": lon})
        self._apply_suggestion_coords(address, lat, lon, was_add, target_idx, insert_after)

    def _apply_suggestion_coords(self, address, lat, lon, was_add, target_idx, insert_after):
        self.state_manager.push_to_history()
        if was_add:
            if insert_after is not None:
                self._create_stage_from_search_after(insert_after, address, [lat, lon])
            else:
                self._create_stage_from_search(address, [lat, lon])
            stages = self.state_manager.get_state("stages", [])
            new_idx = len(stages) - 1
            main_win = self.window()
            if hasattr(main_win, "set_stage_anchor") and new_idx >= 0:
                main_win.set_stage_anchor(new_idx)
        else:
            self._update_stage(target_idx, address=address, coords=[lat, lon])
            main_win = self.window()
            if hasattr(main_win, "set_stage_anchor") and target_idx >= 0:
                main_win.set_stage_anchor(target_idx)

        if self._use_web_ui and hasattr(self, "web") and self._web_ready:
            if was_add:
                if insert_after is not None:
                    self.web.page().runJavaScript(
                        f"clearDraft('insert', {int(insert_after)}); exitInsertMode();"
                    )
                else:
                    self.web.page().runJavaScript("clearDraft('add', -1);")
            else:
                self.web.page().runJavaScript(f"clearDraft('stage', {int(target_idx)});")

        # Keep search state coherent after selection to avoid stale target insertion.
        self._active_search_text = ""
        self._active_search_is_add = True
        self._active_search_index = -1
        self._active_insert_after = None

    def _find_stage_row(self, index):
        """Find a StageRow widget by stage index in the layout."""
        for i in range(self._stage_layout.count()):
            w = self._stage_layout.itemAt(i).widget()
            if isinstance(w, StageRow) and w.index == index:
                return w
        return None

    # ═══════════════════════════════════════════════════════
    #  STAGE OPERATIONS
    # ═══════════════════════════════════════════════════════

    def _on_scroll_range_changed(self, min_val, max_val):
        """Native hook: guarantees scroll locks to bottom if an insertion requested it."""
        if self._use_web_ui or not hasattr(self, "_stages_scroll"):
            return
        if getattr(self, '_wants_scroll_bottom', False):
            self._stages_scroll.verticalScrollBar().setValue(max_val)

    def _scroll_to_bottom(self):
        """Ask the layout to lock scroll to bottom when its resizing is ready."""
        if self._use_web_ui:
            if hasattr(self, "web") and self._web_ready:
                self.web.page().runJavaScript(
                    "(function(){var p=document.getElementById('panel'); if(p){p.scrollTop=p.scrollHeight;}})();"
                )
            return
        if not hasattr(self, "_stages_scroll"):
            return
        self._wants_scroll_bottom = True
        
        # Trigger an explicit scroll jump in case range is already fully finalized
        bar = self._stages_scroll.verticalScrollBar()
        bar.setValue(bar.maximum())
        
        # Disable auto-lock after layout has had time to completely settle
        QTimer.singleShot(400, lambda: setattr(self, '_wants_scroll_bottom', False))

    def _create_stage_from_search(self, label, coords):
        """Add a new stage via the search/add row."""
        stages = self.state_manager.get_state("stages", [])
        next_letter = chr(65 + len(stages))
        new_stage = {
            "label": next_letter,
            "address": label,
            "lat": coords[0],
            "lon": coords[1],
        }
        stages.append(new_stage)
        self.state_manager.update_state("stages", stages)

        main_win = self.window()
        self._rebuild_stage_list()
        QTimer.singleShot(50, self._scroll_to_bottom)
        
        if hasattr(main_win, "_refresh_stages"):
            main_win._refresh_stages()
            
        if hasattr(main_win, "_calculate_route_for_stages") and len(stages) >= 2:
            main_win._calculate_route_for_stages(stages)
        else:
            self.map_needs_update.emit()

    def _create_stage_from_search_after(self, after_index, label, coords):
        stages = self.state_manager.get_state("stages", [])
        insert_pos = int(after_index) + 1
        if insert_pos < 0 or insert_pos > len(stages):
            return self._create_stage_from_search(label, coords)

        stages.insert(insert_pos, {
            "label": "-",
            "address": label,
            "lat": coords[0],
            "lon": coords[1],
        })
        for i, s in enumerate(stages):
            s["label"] = chr(65 + i)
        self.state_manager.update_state("stages", stages)

        main_win = self.window()
        self._rebuild_stage_list()
        if hasattr(main_win, "_refresh_stages"):
            main_win._refresh_stages()
        if hasattr(main_win, "_calculate_route_for_stages") and len(stages) >= 2:
            main_win._calculate_route_for_stages(stages)
        else:
            self.map_needs_update.emit()

    def create_route_from_terminal(self, address, coords=None):
        """Public API — called from the AddRow or externally."""
        if coords:
            self._create_stage_from_search(address, coords)
        else:
            # No coords, just text — add a placeholder
            stages = self.state_manager.get_state("stages", [])
            next_letter = chr(65 + len(stages))
            stages.append({"label": next_letter, "address": address})
            self.state_manager.update_state("stages", stages)
            self._rebuild_stage_list()
            QTimer.singleShot(50, self._scroll_to_bottom)

    def _update_stage(self, index, address=None, coords=None):
        """Update an existing stage's address/coords and refresh."""
        stages = self.state_manager.get_state("stages", [])
        if not (0 <= index < len(stages)):
            return
        if address:
            stages[index]["address"] = address
        if coords:
            stages[index]["lat"] = coords[0]
            stages[index]["lon"] = coords[1]
        self.state_manager.update_state("stages", stages)

        # Recalculate routes if we have ≥2 stages with coords
        valid = [s for s in stages if s.get("lat") is not None]
        main_win = self.window()
        
        self._rebuild_stage_list()
        if hasattr(main_win, "_refresh_stages"):
            main_win._refresh_stages()
            
        if len(valid) >= 2 and hasattr(main_win, "_calculate_route_for_stages"):
            main_win._calculate_route_for_stages(stages)

    def _on_add_requested(self, text):
        """+ button clicked in the add row."""
        main_win = self.window()
        if hasattr(main_win, "set_active_tool"):
            main_win.set_active_tool("route")
        if text == "__IMPORT__":
            self.import_file()
            return
        if not text.strip():
            return
        self.state_manager.push_to_history()
        stages = self.state_manager.get_state("stages", [])
        next_letter = chr(65 + len(stages))
        stages.append({"label": next_letter, "address": text})
        self.state_manager.update_state("stages", stages)
        self._active_insert_after = None
        self._rebuild_stage_list()
        QTimer.singleShot(50, self._scroll_to_bottom)

    def _on_stage_pick_requested(self, index):
        """Map pick button clicked for a stage."""
        main_win = self.window()
        if hasattr(main_win, "set_active_tool"):
            main_win.set_active_tool("route")

    def _on_stage_delete_requested(self, index):
        """Delete button clicked on a stage."""
        main_win = self.window()
        if hasattr(main_win, "on_stage_delete_requested"):
            main_win.on_stage_delete_requested(index)
        else:
            # Fallback: handle locally
            stages = self.state_manager.get_state("stages", [])
            if 0 <= index < len(stages):
                self.state_manager.push_to_history()
                stages.pop(index)
                for i, s in enumerate(stages):
                    s["label"] = chr(65 + i)
                self.state_manager.update_state("stages", stages)
                if len(stages) >= 2:
                    if hasattr(main_win, "_calculate_route_for_stages"):
                        main_win._calculate_route_for_stages(stages)
                self._rebuild_stage_list()
                self.routes_changed.emit()
                self.map_needs_update.emit()

    def _on_selection_changed(self, row):
        """Center the map on a clicked stage (legacy list-based override)."""
        self._on_stage_center_requested(row)

    def _on_stage_center_requested(self, index):
        """Center the map on stage `index` and emit signal for main window."""
        stages = self.state_manager.get_state("stages", [])
        if 0 <= index < len(stages):
            stage = stages[index]
            lat, lon = stage.get("lat"), stage.get("lon")
            if lat is not None and lon is not None:
                # Emit signal so main window can react
                self.stage_center_requested.emit(index)
                # Also call map directly if accessible
                main_win = self.window()
                if hasattr(main_win, "map_view"):
                    main_win.map_view.center_on(lat, lon, zoom=16)

    # ═══════════════════════════════════════════════════════
    #  STATE HELPERS
    # ═══════════════════════════════════════════════════════

    def _add_route_to_state(self, new_route):
        routes = self.state_manager.get_state("routes", [])
        new_route["order"] = len(routes)
        routes.append(new_route)
        self.state_manager.update_state("routes", routes)
        self.state_manager.update_state("active_route_id", new_route["id"])
        chain = [r["id"] for r in routes if r.get("visible", True)]
        self.state_manager.update_state("route_chain", chain)
        self._sync_geojson_data()
        self._rebuild_stage_list()
        self.routes_changed.emit()
        self.map_needs_update.emit()

    def _sync_geojson_data(self):
        routes = self.state_manager.get_state("routes", [])
        chain  = self.state_manager.get_state("route_chain", [])
        merged = get_chained_geojson(routes, chain if chain else None)
        self.state_manager.update_state("geojson_data", merged)

    def _clear_all_itinerary(self):
        """Removes all stages and routes."""
        ans = QMessageBox.question(self, "Confirmer",
                                   "Supprimer tout l'itinéraire ?")
        if ans == QMessageBox.Yes:
            self.state_manager.push_to_history()
            self.state_manager.update_state("stages", [])
            self.state_manager.update_state("routes", [])
            self.state_manager.update_state("active_route_id", None)
            self.state_manager.update_state("route_chain", [])
            self.state_manager.update_state("geojson_data", None)
            self._rebuild_stage_list()
            self.routes_changed.emit()
            self.map_needs_update.emit()

    # ═══════════════════════════════════════════════════════
    #  ITINERARY OPERATIONS
    # ═══════════════════════════════════════════════════════

    def _reverse_active(self):
        stages = self.state_manager.get_state("stages", [])
        if len(stages) < 2:
            return
        
        self.state_manager.push_to_history()
        
        # Reverse the stages and re-label
        stages.reverse()
        for i, s in enumerate(stages):
            s["label"] = chr(65 + i)
        
        self.state_manager.update_state("stages", stages)
        
        # Trigger formal route recalculation (which handles routes, snapping, and polygonalization restoral)
        main_win = self.window()
        if hasattr(main_win, "_calculate_route_for_stages"):
            main_win._calculate_route_for_stages(stages)
        else:
            self._rebuild_stage_list()
            self.routes_changed.emit()
            self.map_needs_update.emit()

    def _on_context_menu(self, pos):
        pass  # Reserved for future right-click actions

    def import_file(self):
        filepath, _ = QFileDialog.getOpenFileName(
            self, "Importer un fichier", "",
            "GeoJSON (*.geojson *.json);;Tous (*.*)")
        if not filepath:
            return
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.loads(f.read())
            geometry = None
            name = os.path.basename(filepath).rsplit(".", 1)[0]
            if data.get("type") == "FeatureCollection":
                for feat in data.get("features", []):
                    g = feat.get("geometry", {})
                    if g.get("type") in ("LineString", "MultiLineString"):
                        geometry = g
                        if feat.get("properties", {}).get("name"):
                            name = feat["properties"]["name"]
                        break
            elif data.get("type") == "Feature":
                geometry = data.get("geometry")
            elif data.get("type") in ("LineString", "MultiLineString"):
                geometry = data
            if not geometry:
                QMessageBox.warning(self, "Import", "Aucune LineString trouvée.")
                return
            new_route = create_route(name, geometry)
            self._add_route_to_state(new_route)

            # Feature 7: Auto-recalculate missing segmentation
            main_win = self.window()
            if hasattr(main_win, "tools_panel"):
                main_win.tools_panel.run_polygonalization()

        except Exception as e:
            QMessageBox.warning(self, "Erreur d'import", str(e))

    # ═══════════════════════════════════════════════════════
    #  PUBLIC API  (called from main.py)
    # ═══════════════════════════════════════════════════════

    def refresh_from_state(self):
        """Full refresh from state — called by main window."""
        self._active_search_text = ""
        self._active_search_is_add = True
        self._active_search_index = -1
        self._active_insert_after = None
        self._hide_suggestions()
        self._rebuild_stage_list()

    def set_state_manager(self, state_manager):
        """Rebind this panel to a different StateManager (multi-tab support)."""
        self.state_manager = state_manager
        self.refresh_from_state()

    # Legacy compatibility aliases
    _rebuild_list = refresh_from_state

    @staticmethod
    def _find_map_view():
        try:
            from PySide6.QtWidgets import QApplication
            from ui.workspace.map_view import MapView
            for w in QApplication.allWidgets():
                if isinstance(w, MapView):
                    return w
        except Exception:
            pass
        return None
