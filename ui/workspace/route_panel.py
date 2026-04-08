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
    QMessageBox, QScrollArea, QCheckBox, QSizePolicy, QFrame, QSpacerItem
)
from PySide6.QtCore import Qt, Signal, QTimer, QSize, QRect, QSettings
from PySide6.QtGui  import QColor, QPainter, QPen, QFont, QBrush

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
_ACCENT       = "#2d8ceb"
_ACCENT_HOVER = "#4da3f2"
_BG_PANEL     = "#2b2b2b"
_BG_DARK      = "#3c3c3c"
_BG_MID       = "#484848"
_BG_LIGHT     = "#535353"
_TEXT          = "#cccccc"
_TEXT_DIM      = "#888888"
_RED           = "#e74c3c"
_GREEN         = "#27ae60"
_CIRCLE_SZ     = 22
_CONNECTOR_W   = 22          # width of vertical connector column


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
        self.setFixedSize(size, size)

    def set_letter(self, letter):
        self._letter = letter
        self.update()

    def paintEvent(self, _evt):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        r = self.rect().adjusted(1, 1, -1, -1)
        p.setPen(QPen(QColor(_ACCENT), 1.5))
        p.setBrush(QColor("#ffffff"))
        p.drawEllipse(r)
        f = p.font()
        f.setBold(True)
        f.setPixelSize(max(9, self._sz // 2))
        p.setFont(f)
        p.setPen(QColor(_ACCENT))
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

        row = QHBoxLayout(self)
        row.setContentsMargins(0, 3, 0, 3)
        row.setSpacing(6)

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
                background: {_BG_DARK}; color: {_TEXT};
                border: 1px solid {_BG_MID}; border-radius: 3px;
                padding: 4px 8px; font-size: 11px;
                font-family: 'Consolas', 'Courier New', monospace;
            }}
            QLineEdit:focus {{ border-color: {_ACCENT}; }}
        """)
        self.input.textChanged.connect(lambda txt: self.text_changed.emit(self.index, txt))
        self.input.focus_received.connect(lambda: self.focus_received.emit(self.index))
        self.input.focus_lost.connect(lambda: self.focus_lost.emit(self.index))
        row.addWidget(self.input, 1)

        # 3. Pick-on-map button
        self.btn_pick = QPushButton("⌖")
        self.btn_pick.setFixedSize(22, 22)
        self.btn_pick.setToolTip("Pointer sur la carte")
        self.btn_pick.setCursor(Qt.PointingHandCursor)
        self.btn_pick.setStyleSheet(f"""
            QPushButton {{ background: transparent; color: {_TEXT_DIM};
                           border: none; font-size: 15px; }}
            QPushButton:hover {{ color: {_ACCENT}; }}
        """)
        self.btn_pick.clicked.connect(lambda: self.pick_requested.emit(self.index))
        row.addWidget(self.btn_pick)

        # 4. Delete button
        self.btn_del = QPushButton("✕")
        self.btn_del.setFixedSize(22, 22)
        self.btn_del.setToolTip("Supprimer cette étape")
        self.btn_del.setCursor(Qt.PointingHandCursor)
        self.btn_del.setStyleSheet(f"""
            QPushButton {{ background: transparent; color: {_TEXT_DIM};
                           border: none; font-size: 12px; }}
            QPushButton:hover {{ color: {_RED}; }}
        """)
        self.btn_del.clicked.connect(lambda: self.delete_requested.emit(self.index))
        row.addWidget(self.btn_del)


class ConnectorRow(QWidget):
    """Thin vertical dashed line + distance label between two stages."""

    def __init__(self, distance_text="", parent=None):
        super().__init__(parent)
        self._text = distance_text
        self.setFixedHeight(20)

    def paintEvent(self, _evt):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        # Center the line under the circle column (circle is ~11px from left edge)
        cx = _CIRCLE_SZ // 2
        pen = QPen(QColor(_ACCENT), 1.5, Qt.DashLine)
        p.setPen(pen)
        p.drawLine(cx, 0, cx, self.height())

        if self._text:
            f = p.font()
            f.setPixelSize(9)
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

        row = QHBoxLayout(self)
        row.setContentsMargins(0, 3, 0, 3)
        row.setSpacing(6)

        # Circle (dimmed, shows next letter)
        self.circle = LetterCircle(next_letter, _CIRCLE_SZ)
        row.addWidget(self.circle)

        # Search input
        self.input = SearchInput()
        self.input.setPlaceholderText("Ajouter une étape…")
        self.input.setStyleSheet(f"""
            QLineEdit {{
                background: transparent; color: {_TEXT_DIM};
                border: 1px dashed {_BG_MID}; border-radius: 3px;
                padding: 4px 8px; font-size: 11px;
            }}
            QLineEdit:focus {{
                background: {_BG_DARK}; color: {_TEXT};
                border-style: solid; border-color: {_ACCENT};
            }}
        """)
        self.input.textChanged.connect(lambda txt: self.text_changed.emit(txt))
        self.input.focus_received.connect(self.focus_received.emit)
        self.input.focus_lost.connect(self.focus_lost.emit)
        row.addWidget(self.input, 1)

        # Pick on map
        self.btn_pick = QPushButton("⌖")
        self.btn_pick.setFixedSize(22, 22)
        self.btn_pick.setToolTip("Pointer sur la carte")
        self.btn_pick.setCursor(Qt.PointingHandCursor)
        self.btn_pick.setStyleSheet(f"""
            QPushButton {{ background: transparent; color: {_TEXT_DIM};
                           border: none; font-size: 15px; }}
            QPushButton:hover {{ color: {_ACCENT}; }}
        """)
        self.btn_pick.clicked.connect(lambda: self.pick_requested.emit())
        row.addWidget(self.btn_pick)

        # Add button
        self.btn_add = QPushButton("+")
        self.btn_add.setFixedSize(22, 22)
        self.btn_add.setCursor(Qt.PointingHandCursor)
        self.btn_add.setStyleSheet(f"""
            QPushButton {{ background: transparent; color: {_GREEN};
                           border: none; font-size: 16px; font-weight: bold; }}
            QPushButton:hover {{ color: #2ecc71; }}
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

        self._build_ui()

    # ═══════════════════════════════════════════════════════
    #  UI CONSTRUCTION
    # ═══════════════════════════════════════════════════════

    def _build_ui(self):
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

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
        self._stage_layout.setSpacing(0)
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

        sep = QFrame()
        sep.setFrameShape(QFrame.HLine)
        sep.setStyleSheet(f"color: {_BG_MID};")
        b_lay.addWidget(sep)

        self.cb_small_roads = QCheckBox("Chemins et petites routes uniquement")
        self.cb_small_roads.setChecked(True)
        self.cb_small_roads.setStyleSheet(f"QCheckBox{{color:{_TEXT_DIM};font-size:10px;padding:4px 0;}}")
        b_lay.addWidget(self.cb_small_roads)

        tl = QHBoxLayout()
        tl.setSpacing(4)
        for label, slot, extra_css in [
            ("↔ Inverser",  self._reverse_active, ""),
            ("📂 Importer", self.import_file,      ""),
            ("🗑 Vider",    self._clear_all_itinerary,
             f"QPushButton:hover{{background:{_RED};color:white;border-color:{_RED};}}"),
        ]:
            btn = QPushButton(label)
            btn.setCursor(Qt.PointingHandCursor)
            btn.setStyleSheet(self._tool_css() + extra_css)
            btn.clicked.connect(slot)
            tl.addWidget(btn)

        b_lay.addLayout(tl)
        outer.addWidget(self._bottom_controls)

        # Initial build
        self._rebuild_stage_list()

    # ── CSS helpers ────────────────────────────────────

    @staticmethod
    def _tool_css():
        return f"""
            QPushButton{{background:{_BG_DARK};color:{_TEXT};
                         border:1px solid {_BG_MID};border-radius:3px;
                         padding:5px 0;font-size:10px;}}
            QPushButton:hover{{background:#505050;border-color:{_ACCENT};}}
        """

    def _mksugg(self):
        w = QListWidget(self)
        w.setStyleSheet(f"""
            QListWidget{{
                background: {_BG_DARK};
                border: 1px solid {_ACCENT};
                border-top: none;
                border-bottom-left-radius: 3px;
                border-bottom-right-radius: 3px;
                margin-left: 28px;
                margin-right: 56px;
                outline: none;
            }}
            QListWidget::item{{
                height: 26px;
                padding: 0 8px;
                color: {_TEXT};
                font-size: 11px;
                font-family: 'Consolas', 'Courier New', monospace;
            }}
            QListWidget::item:hover{{
                background: {_ACCENT};
                color: #ffffff;
            }}
        """)
        w.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        self.suggestion_wrapper = SuggestionWrapper(w, self)
        self.suggestion_wrapper.setVisible(False)
        return w

    # ═══════════════════════════════════════════════════════
    #  STAGE LIST — rebuild from state
    # ═══════════════════════════════════════════════════════

    def _rebuild_stage_list(self):
        """Recreate all stage rows from the state manager."""
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
                        dist_str = f"{dist_m/1000:.1f} km" if dist_m >= 1000 else f"{int(dist_m)} m"
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

    # ═══════════════════════════════════════════════════════
    #  SEARCH / AUTOCOMPLETE
    # ═══════════════════════════════════════════════════════

    def _on_stage_text_changed(self, index, text):
        """Triggered when a stage row input changes — start search timer."""
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
        self._active_search_input = self._add_row.input
        self._active_search_is_add = True
        self._active_search_index = -1
        if text.strip() == "":
            self._show_default_suggestions()
        else:
            self._search_timer.start(400)

    def _on_stage_focus_received(self, index):
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
        ideal_height = count * 26 + 2  # 26px per item + 2px for top/bottom borders

        view_height = self._stages_scroll.viewport().height()
        target_h = target_widget.height() if target_widget else 30
        available_height = max(26, view_height - target_h)
        
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
        if not self._active_search_input:
            return
        text = self._active_search_input.text().strip()
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
        self.list_suggestions.clear()

        if error and not results:
            err_msg = self._GEOCODE_ERRORS.get(error, f"⚠ Erreur : {error}")
            item = QListWidgetItem(err_msg)
            item.setFlags(item.flags() & ~Qt.ItemIsSelectable)
            self.list_suggestions.addItem(item)
            main_win = self.window()
            if hasattr(main_win, 'statusBar'):
                main_win.statusBar().showMessage(err_msg, 4000)
        else:
            display_results = results[:5] if len(results) > 6 else results
            for r in display_results:
                item = QListWidgetItem(f"{r['label']} ({r.get('postcode', '')})")
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
        self.list_suggestions.clear()
        
        item = QListWidgetItem("📍 Votre position")
        item.setData(Qt.UserRole, {"type": "location", "label": "📍 Votre position"})
        self.list_suggestions.addItem(item)
        
        hist = self._get_history()
        for h_item in hist:
            lbl = h_item.get("label", "")
            it = QListWidgetItem(f"🕒 {lbl}")
            it.setData(Qt.UserRole, {"type": "history", "label": lbl, "lat": h_item.get("lat"), "lon": h_item.get("lon")})
            self.list_suggestions.addItem(it)
            
        self._position_and_show_suggestions()

    def _on_suggestion_clicked(self, item):
        """User picked an address from the autocomplete list."""
        res = item.data(Qt.UserRole)
        
        if res == "SHOW_MORE":
            self.list_suggestions.clear()
            for r in self._full_suggestions:
                it = QListWidgetItem(f"{r['label']} ({r.get('postcode', '')})")
                it.setData(Qt.UserRole, r)
                self.list_suggestions.addItem(it)
            self._position_and_show_suggestions()
            return

        if not res:
            return

        self._hide_suggestions()

        if res.get("type") == "location":
            main_win = self.window()
            if hasattr(main_win, "map_view") and getattr(main_win.map_view, "_last_known_user_pos", None):
                lat, lon = main_win.map_view._last_known_user_pos
            else:
                lat, lon = (48.8566, 2.3522)
            address = "📍 Votre Position"
        elif res.get("type") == "history":
            address = res["label"]
            lat, lon = res["lat"], res["lon"]
        else:
            address = res["label"]
            lat, lon = res["lat"], res["lon"]
            self._add_to_history({"label": address, "lat": lat, "lon": lon})

        if self._active_search_is_add:
            # Add as new stage
            self._create_stage_from_search(address, [lat, lon])
        else:
            # Update existing stage
            self._update_stage(self._active_search_index,
                               address=address,
                               coords=[lat, lon])

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
        if getattr(self, '_wants_scroll_bottom', False):
            self._stages_scroll.verticalScrollBar().setValue(max_val)

    def _scroll_to_bottom(self):
        """Ask the layout to lock scroll to bottom when its resizing is ready."""
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
        if not text.strip():
            return
        stages = self.state_manager.get_state("stages", [])
        next_letter = chr(65 + len(stages))
        stages.append({"label": next_letter, "address": text})
        self.state_manager.update_state("stages", stages)
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
