"""
ExportGallery — panneau d'exportation intégré à chaque onglet de projet.

Fonctionnement :
  • Titre + sous-titre en haut à gauche.
  • Ligne d'options compacte (format + options format-spécifiques) + bouton « Exporter »
    sur une même bande sous le titre.
  • Pendant l'export le bouton + options sont remplacés par une barre de progression inline.
  • Après chaque export, l'entrée s'ajoute dans la galerie (persist en mémoire).
"""

import os
import shutil

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QProgressBar, QScrollArea, QFrame, QComboBox, QCheckBox,
    QGroupBox, QFileDialog, QMessageBox, QSizePolicy,
    QStackedWidget,
)
from PySide6.QtCore import Signal, Qt

# ── dep checks ───────────────────────────────────────────────────────────────
def _has(pkg):
    import importlib
    try:
        importlib.import_module(pkg); return True
    except ImportError:
        return False

_HAS_DOCX = _has("docx")
_HAS_ODT  = _has("odf")

# ─────────────────────────────────────────────────────────────────────────────
#  STYLE
# ─────────────────────────────────────────────────────────────────────────────
GALLERY_STYLE = """
QWidget#gallery_root {
    background: #1e1e1e;
}
QLabel#title_lbl {
    color: #cccccc;
    font-size: 15px;
    font-weight: 700;
}
QLabel#sub_lbl {
    color: #888888;
    font-size: 11px;
}
/* ── Options bar ── */
QWidget#options_bar {
    background: #252525;
    border-bottom: 1px solid #333;
}
QLabel#opt_lbl {
    color: #aaaaaa;
    font-size: 11px;
}
QPushButton#btn_export_main {
    background: #2d8ceb;
    color: white;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 18px;
    border: none;
    border-radius: 4px;
    min-width: 110px;
    min-height: 28px;
}
QPushButton#btn_export_main:hover  { background: #3d9cff; }
QPushButton#btn_export_main:disabled { background: #3a3a3a; color: #666; }

/* ── Progress bar ── */
QWidget#progress_bar_widget {
    background: #252525;
    border-bottom: 1px solid #333;
}
QLabel#lbl_prog_status {
    color: #2d8ceb;
    font-size: 11px;
    font-weight: 600;
}
QPushButton#btn_cancel_inline {
    background: #991b1b;
    color: white;
    font-weight: 700;
    border: none;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 11px;
}
QPushButton#btn_cancel_inline:hover { background: #be2222; }

QProgressBar {
    background: #2b2b2b;
    border: 1px solid #1d1d1d;
    border-radius: 3px;
    height: 8px;
    text-align: center;
    color: transparent;
}
QProgressBar::chunk { background: #2d8ceb; border-radius: 3px; }

QComboBox {
    color: #cccccc;
    font-size: 11px;
    background: #2c2c2c;
    border: 1px solid #3a3a3a;
    border-radius: 3px;
    padding: 3px 6px;
    min-height: 22px;
}
QComboBox::drop-down { border: none; }
QComboBox QAbstractItemView {
    background: #2c2c2c; color: #ccc;
    selection-background-color: #2d8ceb;
}
QCheckBox {
    color: #cccccc;
    font-size: 11px;
}

/* ── Export cards ── */
QFrame#export_card {
    background: #252525;
    border: 1px solid #333333;
    border-radius: 6px;
}
QPushButton#btn_card_action {
    background: #2c2c2c;
    color: #bbbbbb;
    font-size: 10px;
    border: 1px solid #383838;
    border-radius: 3px;
    padding: 4px 8px;
}
QPushButton#btn_card_action:hover { background: #383838; color: #ffffff; }
"""


# ─────────────────────────────────────────────────────────────────────────────
#  FORMAT OPTIONS  (one widget per format, swapped by the combo)
# ─────────────────────────────────────────────────────────────────────────────
class _ExportOptionsBar(QWidget):
    """
    Horizontal bar: [Format ▼] [format-specific opts …] [▶ Exporter]
    Emits export_triggered(fmt, opts) when the button is clicked.
    Wraps to a second line automatically thanks to QVBoxLayout outer + QHBoxLayout inner rows.
    """
    export_triggered = Signal(str, dict)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("options_bar")

        root = QVBoxLayout(self)
        root.setContentsMargins(12, 8, 12, 8)
        root.setSpacing(6)

        # ── Row 1 : format selector + export button ──────────────────────────
        row1 = QHBoxLayout()
        row1.setSpacing(8)

        fmt_lbl = QLabel("Format :")
        fmt_lbl.setObjectName("opt_lbl")
        self.cmb_fmt = QComboBox()
        self.cmb_fmt.addItems(["PDF", "HTML (BETA)", "WORD .docx (BETA)", "ODT (BETA)", "CSV"])
        self.cmb_fmt.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        self.cmb_fmt.setFixedWidth(130)

        row1.addWidget(fmt_lbl)
        row1.addWidget(self.cmb_fmt)
        row1.addStretch()

        self.btn_export = QPushButton("▶  Exporter")
        self.btn_export.setObjectName("btn_export_main")
        self.btn_export.setCursor(Qt.PointingHandCursor)
        self.btn_export.clicked.connect(self._on_clicked)
        row1.addWidget(self.btn_export)
        root.addLayout(row1)

        # ── Row 2 : format-specific options ─────────────────────────────────
        self._opt_stack = QStackedWidget()
        self._opt_stack.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)

        # PDF
        pdf_w = QWidget()
        pdf_l = QHBoxLayout(pdf_w); pdf_l.setContentsMargins(0,0,0,0); pdf_l.setSpacing(10)
        reso_lbl = QLabel("Résolution :")
        reso_lbl.setObjectName("opt_lbl")
        self.cmb_pdf_reso = QComboBox()
        self.cmb_pdf_reso.addItems(["Normale (150dpi)", "Haute (300dpi)", "Basse (72dpi)"])
        self.cmb_pdf_reso.setFixedWidth(150)
        self.chk_pdf_annexes = QCheckBox("Inclure les annexes (Morse, etc.)")
        self.chk_pdf_annexes.setChecked(True)
        pdf_l.addWidget(reso_lbl)
        pdf_l.addWidget(self.cmb_pdf_reso)
        pdf_l.addWidget(self.chk_pdf_annexes)
        pdf_l.addStretch()
        self._opt_stack.addWidget(pdf_w)  # 0

        # HTML (no options)
        self._opt_stack.addWidget(QWidget())  # 1

        # DOCX
        docx_w = QWidget()
        if not _HAS_DOCX:
            dl = QHBoxLayout(docx_w); dl.setContentsMargins(0,0,0,0)
            dl.addWidget(QLabel("⚠ python-docx non installé"))
        self._opt_stack.addWidget(docx_w)  # 2

        # ODT
        odt_w = QWidget()
        if not _HAS_ODT:
            ol = QHBoxLayout(odt_w); ol.setContentsMargins(0,0,0,0)
            ol.addWidget(QLabel("⚠ odfpy non installé"))
        self._opt_stack.addWidget(odt_w)  # 3

        # CSV
        csv_w = QWidget()
        cv = QHBoxLayout(csv_w); cv.setContentsMargins(0,0,0,0); cv.setSpacing(10)
        sep_lbl = QLabel("Séparateur :"); sep_lbl.setObjectName("opt_lbl")
        self.cmb_csv_sep = QComboBox(); self.cmb_csv_sep.addItems([";", ","]); self.cmb_csv_sep.setFixedWidth(50)
        enc_lbl = QLabel("Encodage :"); enc_lbl.setObjectName("opt_lbl")
        self.cmb_csv_enc = QComboBox(); self.cmb_csv_enc.addItems(["UTF-8 avec BOM", "UTF-8", "Latin-1"]); self.cmb_csv_enc.setFixedWidth(140)
        cv.addWidget(sep_lbl); cv.addWidget(self.cmb_csv_sep)
        cv.addWidget(enc_lbl); cv.addWidget(self.cmb_csv_enc)
        cv.addStretch()
        self._opt_stack.addWidget(csv_w)  # 4

        root.addWidget(self._opt_stack)
        self.cmb_fmt.currentIndexChanged.connect(self._opt_stack.setCurrentIndex)

    def _on_clicked(self):
        self.export_triggered.emit(self._fmt_key(), self._opts())

    def _fmt_key(self):
        return ["pdf", "html", "docx", "odt", "csv"][self.cmb_fmt.currentIndex()]

    def _opts(self):
        idx = self.cmb_fmt.currentIndex()
        if idx == 0:
            return {"resolution": self.cmb_pdf_reso.currentText(),
                    "include_annexes": self.chk_pdf_annexes.isChecked()}
        if idx == 4:
            return {"separator": self.cmb_csv_sep.currentText(),
                    "encoding": self.cmb_csv_enc.currentText()}
        return {}

    def current_fmt_key(self):
        return self._fmt_key()


# ─────────────────────────────────────────────────────────────────────────────
#  PROGRESS BAR WIDGET (replaces options bar during export)
# ─────────────────────────────────────────────────────────────────────────────
class _ProgressWidget(QWidget):
    cancel_clicked = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("progress_bar_widget")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 8, 12, 8)
        layout.setSpacing(4)

        self.lbl_status = QLabel("Préparation...")
        self.lbl_status.setObjectName("lbl_prog_status")
        layout.addWidget(self.lbl_status)

        row = QHBoxLayout()
        self.bar = QProgressBar()
        self.bar.setValue(0)
        self.btn_cancel = QPushButton("✕ Annuler")
        self.btn_cancel.setObjectName("btn_cancel_inline")
        self.btn_cancel.setFixedWidth(80)
        self.btn_cancel.clicked.connect(self.cancel_clicked)
        row.addWidget(self.bar)
        row.addWidget(self.btn_cancel)
        layout.addLayout(row)


# ─────────────────────────────────────────────────────────────────────────────
#  SINGLE EXPORT CARD
# ─────────────────────────────────────────────────────────────────────────────
_FORMAT_COLORS = {
    "pdf":  ("#c0392b", "#fff"),
    "html": ("#2980b9", "#fff"),
    "docx": ("#1e6ea6", "#fff"),
    "odt":  ("#27ae60", "#fff"),
    "csv":  ("#7f8c8d", "#fff"),
}

class _ExportCard(QFrame):
    def __init__(self, label: str, path: str, fmt: str, parent=None):
        super().__init__(parent)
        self.setObjectName("export_card")
        self._path = path
        self._label = label
        self._fmt = fmt

        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 8, 10, 8)
        layout.setSpacing(6)

        # Badge + label
        top = QHBoxLayout()
        bg, fg = _FORMAT_COLORS.get(fmt, ("#555", "#fff"))
        badge = QLabel(fmt.upper())
        badge.setStyleSheet(
            f"background: {bg}; color: {fg}; font-size: 9px; font-weight: 800; "
            f"padding: 2px 6px; border-radius: 3px;"
        )
        badge.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        name_lbl = QLabel(f"<b>{label}</b>")
        name_lbl.setStyleSheet("color: #cccccc; font-size: 11px;")
        name_lbl.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        top.addWidget(badge)
        top.addSpacing(6)
        top.addWidget(name_lbl)
        layout.addLayout(top)

        path_lbl = QLabel(os.path.basename(path))
        path_lbl.setStyleSheet("color: #666; font-size: 10px;")
        layout.addWidget(path_lbl)

        btn_row = QHBoxLayout(); btn_row.setSpacing(6)
        for text, slot in [
            ("👁 Aperçu",         self._preview),
            ("🖹 Ouvrir",          self._open),
            ("💾 Enregistrer...", self._save_as),
        ]:
            b = QPushButton(text)
            b.setObjectName("btn_card_action")
            b.setCursor(Qt.PointingHandCursor)
            b.clicked.connect(slot)
            btn_row.addWidget(b)
        btn_row.addStretch()
        layout.addLayout(btn_row)

    def _preview(self):
        if not os.path.exists(self._path):
            QMessageBox.warning(self, "Fichier introuvable", f"Le fichier n'existe plus :\n{self._path}")
            return
        from ui.workspace.preview_dialog import PreviewDialog
        dlg = PreviewDialog([(self._label, self._path)], self)
        dlg.exec()

    def _open(self):
        if not os.path.exists(self._path):
            QMessageBox.warning(self, "Fichier introuvable", f"Le fichier n'existe plus :\n{self._path}")
            return
        os.startfile(self._path)

    def _save_as(self):
        ext = os.path.splitext(self._path)[1]
        target, _ = QFileDialog.getSaveFileName(
            self, f"Enregistrer {self._label}",
            f"{self._label.replace(' ', '_')}{ext}", f"Fichiers (*{ext})")
        if target:
            try:
                shutil.copy(self._path, target)
                QMessageBox.information(self, "Succès", f"Fichier enregistré :\n{target}")
            except Exception as e:
                QMessageBox.critical(self, "Erreur", str(e))


# ─────────────────────────────────────────────────────────────────────────────
#  EXPORT GALLERY  (main widget)
# ─────────────────────────────────────────────────────────────────────────────
class ExportGallery(QWidget):
    """
    Panel hébergé dans l'onglet « Exportation » d'un ProjectTab.

    Signaux:
        export_requested(fmt: str, opts: dict)
        cancel_requested()
    """
    export_requested = Signal(str, dict)
    cancel_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("gallery_root")
        self.setStyleSheet(GALLERY_STYLE)
        self._entries: list = []

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # ── TITLE AREA ───────────────────────────────────────────────────────
        title_area = QWidget()
        title_area.setStyleSheet("background: #1e1e1e;")
        tl = QVBoxLayout(title_area)
        tl.setContentsMargins(16, 12, 16, 8)
        tl.setSpacing(2)
        title = QLabel("Exportation")
        title.setObjectName("title_lbl")
        sub = QLabel("Tous les exports du projet courant")
        sub.setObjectName("sub_lbl")
        tl.addWidget(title)
        tl.addWidget(sub)
        root.addWidget(title_area)

        # ── OPTIONS / PROGRESS (stacked, same height slot) ───────────────────
        self._mode_stack = QStackedWidget()
        self._mode_stack.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)

        self._options_bar = _ExportOptionsBar()
        self._options_bar.export_triggered.connect(self._on_export_triggered)
        self._mode_stack.addWidget(self._options_bar)  # 0

        self._progress_widget = _ProgressWidget()
        self._progress_widget.cancel_clicked.connect(lambda: self.cancel_requested.emit())
        self._mode_stack.addWidget(self._progress_widget)  # 1

        self._mode_stack.setCurrentIndex(0)
        root.addWidget(self._mode_stack)

        # ── SEPARATOR ────────────────────────────────────────────────────────
        sep = QFrame()
        sep.setFrameShape(QFrame.HLine)
        sep.setStyleSheet("background: #2c2c2c; margin: 0;")
        sep.setFixedHeight(1)
        root.addWidget(sep)

        # ── GALLERY ─────────────────────────────────────────────────────────
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setStyleSheet("QScrollArea { border: none; background: #1e1e1e; }")

        self._gallery_container = QWidget()
        self._gallery_container.setStyleSheet("background: #1e1e1e;")
        self._gallery_layout = QVBoxLayout(self._gallery_container)
        self._gallery_layout.setContentsMargins(16, 12, 16, 12)
        self._gallery_layout.setSpacing(8)

        self._empty_lbl = QLabel(
            "Aucun export pour ce projet.\n"
            "Cliquez sur « Exporter » pour générer votre premier document."
        )
        self._empty_lbl.setAlignment(Qt.AlignCenter)
        self._empty_lbl.setStyleSheet(
            "color: #555; font-size: 12px; margin-top: 40px;"
        )
        self._empty_lbl.setWordWrap(True)
        self._gallery_layout.addWidget(self._empty_lbl)
        self._gallery_layout.addStretch()

        self._scroll.setWidget(self._gallery_container)
        root.addWidget(self._scroll)

    # ─────────────────────────────────────────────────────────────────────────
    #  Public API
    # ─────────────────────────────────────────────────────────────────────────

    def start_progress(self):
        self._progress_widget.bar.setValue(0)
        self._progress_widget.lbl_status.setText("Préparation...")
        self._mode_stack.setCurrentIndex(1)

    def update_progress(self, msg: str, pct: int):
        self._progress_widget.lbl_status.setText(msg)
        if pct >= 0:
            self._progress_widget.bar.setValue(pct)

    def finish_progress(self, success: bool, error_msg: str,
                        path_participant: str, path_solution: str):
        self._mode_stack.setCurrentIndex(0)
        if not success:
            QMessageBox.critical(self, "Erreur d'export",
                                 f"La génération a échoué :\n\n{error_msg}")
            return
        fmt = self._options_bar.current_fmt_key()
        if path_participant:
            self._add_entry("Carnet Participant", path_participant, fmt)
        if path_solution:
            self._add_entry("Carnet Solution", path_solution, fmt)

    def add_entry(self, label: str, path: str, fmt: str):
        """Programmatically add an entry (e.g. from CSV export)."""
        self._add_entry(label, path, fmt)

    # ─────────────────────────────────────────────────────────────────────────
    #  Internals
    # ─────────────────────────────────────────────────────────────────────────

    def _on_export_triggered(self, fmt: str, opts: dict):
        self.export_requested.emit(fmt, opts)

    def _add_entry(self, label: str, path: str, fmt: str):
        if not self._entries:
            self._empty_lbl.setVisible(False)
            # Remove trailing stretch
            item = self._gallery_layout.takeAt(self._gallery_layout.count() - 1)
            if item:
                del item

        self._entries.append((label, path, fmt))
        card = _ExportCard(label, path, fmt, self._gallery_container)
        self._gallery_layout.addWidget(card)
