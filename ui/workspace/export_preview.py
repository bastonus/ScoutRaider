"""
Export Preview Dialog — Fenêtre de confirmation post-génération PDF.
Design glassmorphism sombre. Ouvre les PDFs nativement (sans WebEngineView).
"""
import os
import subprocess
import sys
from datetime import datetime

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QFrame, QWidget, QSizePolicy, QGraphicsDropShadowEffect
)
from PySide6.QtCore import Qt, QPropertyAnimation, QEasingCurve, QRect
from PySide6.QtGui import QColor, QFont, QPixmap, QIcon


def _fmt_size(path):
    """Retourne la taille du fichier en Ko/Mo."""
    try:
        sz = os.path.getsize(path)
        if sz > 1_000_000:
            return f"{sz / 1_000_000:.1f} Mo"
        return f"{sz / 1_000:.0f} Ko"
    except Exception:
        return "–"


def _open_file(path):
    """Ouvre un fichier avec l'application par défaut du système."""
    if not os.path.exists(path):
        return
    if sys.platform == "win32":
        os.startfile(path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    else:
        subprocess.Popen(["xdg-open", path])


def _open_folder(path):
    folder = os.path.dirname(os.path.abspath(path))
    if sys.platform == "win32":
        subprocess.Popen(f'explorer "{folder}"')
    elif sys.platform == "darwin":
        subprocess.Popen(["open", folder])
    else:
        subprocess.Popen(["xdg-open", folder])


DIALOG_STYLE = """
QDialog {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
        stop:0 #0f0f1a, stop:1 #1a1a2e);
    color: #e2e8f0;
    font-family: 'Segoe UI', Arial, sans-serif;
}
QLabel {
    color: #e2e8f0;
}
QFrame#card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
}
QPushButton {
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 20px;
    border: none;
    color: white;
}
QPushButton#btn_main {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #4f46e5, stop:1 #7c3aed);
}
QPushButton#btn_main:hover {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #6366f1, stop:1 #8b5cf6);
}
QPushButton#btn_secondary {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #0ea5e9, stop:1 #38bdf8);
}
QPushButton#btn_secondary:hover {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #38bdf8, stop:1 #7dd3fc);
}
QPushButton#btn_folder {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #94a3b8;
    font-size: 12px;
    padding: 8px 14px;
}
QPushButton#btn_folder:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #e2e8f0;
}
QPushButton#btn_close {
    background: transparent;
    color: #64748b;
    font-size: 11px;
    padding: 8px 14px;
}
QPushButton#btn_close:hover {
    color: #94a3b8;
}
"""


class _PdfCard(QFrame):
    """Carte représentant un PDF généré."""
    def __init__(self, label: str, emoji: str, path: str, accent: str, parent=None):
        super().__init__(parent)
        self.setObjectName("card")
        self._path = path
        exists = os.path.exists(path)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(6)

        # Header row
        header = QHBoxLayout()
        ico = QLabel(emoji)
        ico.setStyleSheet(f"font-size: 22px;")
        header.addWidget(ico)

        title = QLabel(label)
        title.setStyleSheet(f"font-size: 14px; font-weight: 700; color: {accent};")
        header.addWidget(title, 1)
        layout.addLayout(header)

        # Filename
        fname = QLabel(os.path.basename(path))
        fname.setStyleSheet("font-size: 11px; color: #64748b; font-family: 'Courier New', monospace;")
        fname.setWordWrap(True)
        layout.addWidget(fname)

        # Meta row
        meta = QLabel()
        if exists:
            size = _fmt_size(path)
            mtime = datetime.fromtimestamp(os.path.getmtime(path)).strftime("%d/%m/%Y %H:%M")
            meta.setText(f"✓  {size}  ·  {mtime}")
            meta.setStyleSheet("font-size: 11px; color: #22c55e;")
        else:
            meta.setText("⚠  Fichier introuvable")
            meta.setStyleSheet("font-size: 11px; color: #f59e0b;")
        layout.addWidget(meta)


class ExportPreviewDialog(QDialog):
    """
    Fenêtre de confirmation après génération PDF.
    Design glassmorphism sombre, sans WebEngineView.
    """

    def __init__(self, pdf_participant_path: str, pdf_solution_path: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Export réussi — Scout Design Suite")
        self.setModal(True)
        self.setMinimumWidth(520)
        self.setMaximumWidth(640)
        self.setStyleSheet(DIALOG_STYLE)
        self.setWindowFlags(Qt.Dialog | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground, False)

        self._pdf_part = pdf_participant_path
        self._pdf_sol = pdf_solution_path

        root = QVBoxLayout(self)
        root.setContentsMargins(28, 24, 28, 24)
        root.setSpacing(18)

        # ── HEADER ────────────────────────────────────────────
        hdr = QHBoxLayout()
        check = QLabel("✅")
        check.setStyleSheet("font-size: 32px;")
        hdr.addWidget(check)

        title_col = QVBoxLayout()
        title_col.setSpacing(2)
        t1 = QLabel("Carnets générés avec succès")
        t1.setStyleSheet("font-size: 18px; font-weight: 800; color: #f1f5f9;")
        t2 = QLabel("Les deux PDFs sont prêts à être imprimés ou partagés.")
        t2.setStyleSheet("font-size: 12px; color: #64748b;")
        title_col.addWidget(t1)
        title_col.addWidget(t2)
        hdr.addLayout(title_col, 1)
        root.addLayout(hdr)

        # ── SEPARATOR ─────────────────────────────────────────
        sep = QFrame()
        sep.setFrameShape(QFrame.HLine)
        sep.setStyleSheet("border: none; border-top: 1px solid rgba(255,255,255,0.08);")
        root.addWidget(sep)

        # ── PDF CARDS ─────────────────────────────────────────
        root.addWidget(_PdfCard(
            "Carnet Participant",
            "📘",
            pdf_participant_path,
            "#818cf8"
        ))
        root.addWidget(_PdfCard(
            "Carnet Solution (Chefs)",
            "📕",
            pdf_solution_path,
            "#f87171"
        ))

        # ── ACTIONS ───────────────────────────────────────────
        actions = QVBoxLayout()
        actions.setSpacing(8)

        # Row 1: open PDFs
        row1 = QHBoxLayout()
        row1.setSpacing(10)

        btn_part = QPushButton("📘  Ouvrir Carnet Participant")
        btn_part.setObjectName("btn_main")
        btn_part.setCursor(Qt.PointingHandCursor)
        btn_part.clicked.connect(lambda: _open_file(self._pdf_part))
        row1.addWidget(btn_part)

        btn_sol = QPushButton("📕  Ouvrir Carnet Solution")
        btn_sol.setObjectName("btn_secondary")
        btn_sol.setCursor(Qt.PointingHandCursor)
        btn_sol.clicked.connect(lambda: _open_file(self._pdf_sol))
        row1.addWidget(btn_sol)
        actions.addLayout(row1)

        # Row 2: folder + close
        row2 = QHBoxLayout()
        row2.setSpacing(10)

        btn_folder = QPushButton("📂  Ouvrir le dossier")
        btn_folder.setObjectName("btn_folder")
        btn_folder.setCursor(Qt.PointingHandCursor)
        btn_folder.clicked.connect(lambda: _open_folder(self._pdf_part))
        row2.addWidget(btn_folder)

        row2.addStretch(1)

        btn_close = QPushButton("Fermer")
        btn_close.setObjectName("btn_close")
        btn_close.setCursor(Qt.PointingHandCursor)
        btn_close.clicked.connect(self.accept)
        row2.addWidget(btn_close)
        actions.addLayout(row2)

        root.addLayout(actions)

    def mousePressEvent(self, event):
        """Permettre de déplacer la fenêtre sans barre de titre."""
        if event.button() == Qt.LeftButton:
            self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.LeftButton and hasattr(self, '_drag_pos'):
            self.move(event.globalPosition().toPoint() - self._drag_pos)
