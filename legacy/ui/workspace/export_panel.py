import os
import shutil
from PySide6.QtWidgets import (
    QVBoxLayout, QHBoxLayout, QPushButton,
    QLabel, QTabWidget, QWidget, QCheckBox, QComboBox, QFrame, QGroupBox, QScrollArea,
    QProgressBar, QFileDialog, QMessageBox
)
from PySide6.QtCore import Signal, Qt

# ── Dependency availability ──────────────────────────────
def _check_dep(pkg_name):
    import importlib
    try:
        importlib.import_module(pkg_name)
        return True
    except ImportError:
        return False

_HAS_DOCX = _check_dep("docx")
_HAS_ODT  = _check_dep("odf")       # odfpy
_HAS_HTML = True  # export_html.py has no external dependencies


EXPORT_STYLE = """
QWidget#export_panel_root {
    background-color: transparent;
}
QTabWidget::pane {
    border: none;
    background-color: transparent;
    margin-top: -1px;
}
QTabBar::tab {
    background-color: #3c3c3c;
    color: #999999;
    padding: 6px 14px;
    border: none;
    border-bottom: 2px solid transparent;
    font-weight: 600;
    font-size: 10px;
    min-width: 50px;
}
QTabBar::tab:selected {
    background-color: #4a4a4a;
    color: #ffffff;
    border-bottom: 2px solid #2d8ceb;
}
QTabBar::tab:hover:!selected {
    color: #cccccc;
    background-color: #454545;
    border-bottom: 2px solid #555555;
}
QPushButton#btn_export {
    background-color: #2d8ceb;
    color: white; font-size: 13px; font-weight: 700; padding: 10px;
    border: 1px solid #2577cc;
}
QPushButton#btn_export:hover { background-color: #3d9cff; }
QPushButton#btn_export:disabled { background-color: #3c3c3c; color: #666666; border-color: #363636; }

QPushButton#btn_action {
    background-color: #4a4a4a; color: #cccccc; font-size: 11px; padding: 8px;
    border: 1px solid #3c3c3c;
}
QPushButton#btn_action:hover { background-color: #555555; border-color: #4a4a4a; }

QLabel#info_lbl { color: #999999; font-style: italic; font-size: 11px; }
QLabel#header_lbl { color: #cccccc; font-size: 13px; font-weight: bold; }

QProgressBar {
    background-color: #2b2b2b;
    border: 1px solid #1d1d1d;
    height: 6px;
    text-align: center;
    color: transparent;
}
QProgressBar::chunk { background: #2d8ceb; }
"""

class ExportPanel(QWidget):
    export_pdf_requested = Signal(dict)
    export_html_requested = Signal()
    export_docx_requested = Signal()
    export_odt_requested = Signal()
    export_csv_requested = Signal(dict)
    cancel_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("export_panel_root")
        self.setStyleSheet(EXPORT_STYLE)
        self.generated_files = [] # List of (label, path)
        
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        content = QWidget()
        self.l_content = QVBoxLayout(content)
        self.l_content.setContentsMargins(12, 12, 12, 12)
        self.l_content.setSpacing(10)
        
        header = QLabel("Exportation du Carnet")
        header.setObjectName("header_lbl")
        self.l_content.addWidget(header)
        
        # --- PROGRESS SECTION ---
        self.progress_group = QGroupBox("G\u00C9N\u00C9RATION EN COURS...")
        self.progress_group.setVisible(False)
        prog_v = QVBoxLayout(self.progress_group)
        self.lbl_status = QLabel("Pr\u00E9paration...")
        self.lbl_status.setStyleSheet("color: #2d8ceb; font-size: 11px;")
        
        prog_row = QHBoxLayout()
        self.progress_bar = QProgressBar()
        self.btn_cancel_export = QPushButton("\u2716") # Cross icon
        self.btn_cancel_export.setFixedSize(24, 24)
        self.btn_cancel_export.setToolTip("Annuler l'exportation")
        self.btn_cancel_export.setStyleSheet("background: #991b1b; color: white; border-radius: 4px; font-weight: bold;")
        self.btn_cancel_export.clicked.connect(lambda: self.cancel_requested.emit())
        
        prog_row.addWidget(self.progress_bar)
        prog_row.addWidget(self.btn_cancel_export)
        
        prog_v.addWidget(self.lbl_status)
        prog_v.addLayout(prog_row)
        self.l_content.addWidget(self.progress_group)

        # --- RESULTS SECTION ---
        self.results_group = QGroupBox("R\u00C9SULTATS")
        self.results_group.setVisible(False)
        self.results_layout = QVBoxLayout(self.results_group)
        self.l_content.addWidget(self.results_group)
        
        self.desc = QLabel("Choisissez un format pour g\u00E9n\u00E9rer vos documents finaux.")
        self.desc.setStyleSheet("color: #999999; font-size: 11px; margin-bottom: 10px;")
        self.l_content.addWidget(self.desc)
        
        self.export_tabs = QTabWidget()
        
        # --- PDF Tab ---
        tab_pdf = QWidget()
        l_pdf = QVBoxLayout(tab_pdf)
        info_pdf = QLabel("Format de r\u00E9f\u00E9rence pour l'impression (Livret A5/A4).")
        info_pdf.setObjectName("info_lbl"); info_pdf.setWordWrap(True)
        l_pdf.addWidget(info_pdf)
        grp_pdf = QGroupBox("OPTIONS PDF")
        grp_layout = QVBoxLayout(grp_pdf)
        self.chk_pdf_annexes = QCheckBox("Inclure les annexes (Morse, etc.)")
        self.chk_pdf_annexes.setChecked(True)
        self.cmb_pdf_reso = QComboBox()
        self.cmb_pdf_reso.addItems(["Normale (150dpi)", "Haute (300dpi)", "Basse (72dpi)"])
        grp_layout.addWidget(QLabel("R\u00E9solution carte :"))
        grp_layout.addWidget(self.cmb_pdf_reso)
        grp_layout.addWidget(self.chk_pdf_annexes)
        l_pdf.addWidget(grp_pdf)
        l_pdf.addStretch()
        self.btn_export_pdf = QPushButton("G\u00E9n\u00E9rer le PDF")
        self.btn_export_pdf.setObjectName("btn_export"); self.btn_export_pdf.setCursor(Qt.PointingHandCursor)
        self.btn_export_pdf.clicked.connect(self._on_pdf_export_clicked)
        l_pdf.addWidget(self.btn_export_pdf)
        self.export_tabs.addTab(tab_pdf, "PDF")
        
        # --- HTML Tab ---
        tab_html = QWidget()
        l_html = QVBoxLayout(tab_html)
        info_html = QLabel("Page interactive pour consultation sur smartphone/tablette.")
        info_html.setObjectName("info_lbl"); info_html.setWordWrap(True)
        l_html.addWidget(info_html)
        if not _HAS_HTML:
            l_html.addWidget(self._dep_banner("weasyprint", "pip install weasyprint"))
            l_html.addStretch()
            self.btn_export_html = QPushButton("Générer le Web")
            self.btn_export_html.setObjectName("btn_export")
            self.btn_export_html.setEnabled(False)
        else:
            l_html.addStretch()
            self.btn_export_html = QPushButton("Générer le Web")
            self.btn_export_html.setObjectName("btn_export"); self.btn_export_html.setCursor(Qt.PointingHandCursor)
            self.btn_export_html.clicked.connect(lambda: self.export_html_requested.emit())
        l_html.addWidget(self.btn_export_html)
        self.export_tabs.addTab(tab_html, "HTML")
        
        # --- Word Tab ---
        tab_docx = QWidget()
        l_docx = QVBoxLayout(tab_docx)
        info_docx = QLabel("Fichier Word (.docx) pour une mise en page manuelle poussée.")
        info_docx.setObjectName("info_lbl"); info_docx.setWordWrap(True)
        l_docx.addWidget(info_docx)
        if not _HAS_DOCX:
            l_docx.addWidget(self._dep_banner("python-docx", "pip install python-docx"))
            l_docx.addStretch()
            self.btn_export_docx = QPushButton("Générer Word")
            self.btn_export_docx.setObjectName("btn_export")
            self.btn_export_docx.setEnabled(False)
        else:
            l_docx.addStretch()
            self.btn_export_docx = QPushButton("Générer Word")
            self.btn_export_docx.setObjectName("btn_export"); self.btn_export_docx.setCursor(Qt.PointingHandCursor)
            self.btn_export_docx.clicked.connect(lambda: self.export_docx_requested.emit())
        l_docx.addWidget(self.btn_export_docx)
        self.export_tabs.addTab(tab_docx, "WORD")
        
        # --- LibreOffice Tab ---
        tab_odt = QWidget()
        l_odt = QVBoxLayout(tab_odt)
        info_odt = QLabel("Format OpenDocument (.odt) pour LibreOffice.")
        info_odt.setObjectName("info_lbl"); info_odt.setWordWrap(True)
        l_odt.addWidget(info_odt)
        if not _HAS_ODT:
            l_odt.addWidget(self._dep_banner("odfpy", "pip install odfpy"))
            l_odt.addStretch()
            self.btn_export_odt = QPushButton("Générer ODT")
            self.btn_export_odt.setObjectName("btn_export")
            self.btn_export_odt.setEnabled(False)
        else:
            l_odt.addStretch()
            self.btn_export_odt = QPushButton("Générer ODT")
            self.btn_export_odt.setObjectName("btn_export"); self.btn_export_odt.setCursor(Qt.PointingHandCursor)
            self.btn_export_odt.clicked.connect(lambda: self.export_odt_requested.emit())
        l_odt.addWidget(self.btn_export_odt)
        self.export_tabs.addTab(tab_odt, "ODT")
        
        # --- CSV Tab ---
        tab_csv = QWidget()
        l_csv = QVBoxLayout(tab_csv)
        info_csv = QLabel("Export brut des donn\u00E9es pour tableur (Excel).")
        info_csv.setObjectName("info_lbl"); info_csv.setWordWrap(True)
        l_csv.addWidget(info_csv)
        grp_csv = QGroupBox("OPTIONS CSV")
        grp_layout2 = QVBoxLayout(grp_csv)
        self.cmb_csv_sep = QComboBox(); self.cmb_csv_sep.addItems([";", ","])
        self.cmb_csv_enc = QComboBox(); self.cmb_csv_enc.addItems(["UTF-8 avec BOM", "UTF-8", "Latin-1"])
        grp_layout2.addWidget(QLabel("S\u00E9parateur :")); grp_layout2.addWidget(self.cmb_csv_sep)
        grp_layout2.addWidget(QLabel("Encodage :")); grp_layout2.addWidget(self.cmb_csv_enc)
        l_csv.addWidget(grp_csv); l_csv.addStretch()
        self.btn_export_csv = QPushButton("Exporter CSV")
        self.btn_export_csv.setObjectName("btn_export"); self.btn_export_csv.setCursor(Qt.PointingHandCursor)
        self.btn_export_csv.clicked.connect(self._on_csv_export_clicked)
        l_csv.addWidget(self.btn_export_csv)
        self.export_tabs.addTab(tab_csv, "CSV")
        
        self.l_content.addWidget(self.export_tabs)
        self.l_content.addStretch()
        
        scroll.setWidget(content)
        main_layout.addWidget(scroll)

    @staticmethod
    def _dep_banner(package_name, install_cmd):
        """Returns a styled QFrame explaining how to install a missing package."""
        frame = QFrame()
        frame.setStyleSheet(
            "QFrame { background: rgba(243,156,18,0.08); border: 1px solid rgba(243,156,18,0.3); padding: 4px; margin-top: 8px; }"
        )
        lay = QVBoxLayout(frame)
        lay.setContentsMargins(10, 8, 10, 8)
        lbl = QLabel(
            f"⚠ <b>{package_name}</b> n'est pas installé.<br>"
            f"<span style='color:#999;font-size:10px;'>Installez-le puis relancez l'application :</span>"
        )
        lbl.setWordWrap(True)
        lbl.setStyleSheet("color: #f39c12; font-size: 11px;")
        cmd = QLabel(f"<code>{install_cmd}</code>")
        cmd.setStyleSheet(
            "background: #2b2b2b; color: #cccccc; font-size: 11px; padding: 4px 8px; border: 1px solid #1d1d1d;"
        )
        lay.addWidget(lbl)
        lay.addWidget(cmd)
        return frame

    def _on_pdf_export_clicked(self):
        self.export_pdf_requested.emit({
            "resolution": self.cmb_pdf_reso.currentText(),
            "include_annexes": self.chk_pdf_annexes.isChecked()
        })

    def _on_csv_export_clicked(self):
        self.export_csv_requested.emit({
            "separator": self.cmb_csv_sep.currentText(),
            "encoding": self.cmb_csv_enc.currentText()
        })

    # --- ASYNC METHODS ---

    def start_progress(self):
        self.progress_group.setVisible(True)
        self.progress_bar.setValue(0)
        self.lbl_status.setText("Lancement de la d\u00E9coupe...")
        self.export_tabs.setEnabled(False)
        self.results_group.setVisible(False)
        # Clear old results
        while self.results_layout.count():
            w = self.results_layout.takeAt(0).widget()
            if w: w.deleteLater()

    def update_progress(self, msg, p):
        self.lbl_status.setText(msg)
        if p >= 0:
            self.progress_bar.setValue(p)

    def finish_progress(self, success, error_msg, pdf_part, pdf_sol):
        self.progress_group.setVisible(False)
        self.export_tabs.setEnabled(True)
        
        if not success:
            QMessageBox.critical(self, "Erreur d'export", f"La g\u00E9n\u00E9ration a \u00E9chou\u00E9 :\n{error_msg}")
            return

        self.results_group.setVisible(True)
        self.generated_files = []
        if pdf_part: self.generated_files.append(("Carnet Participant", pdf_part))
        if pdf_sol:  self.generated_files.append(("Carnet Solution", pdf_sol))

        # Global preview button (opens all files in one dialog)
        if self.generated_files:
            btn_preview_all = QPushButton("👁  Prévisualiser tous les fichiers")
            btn_preview_all.setObjectName("btn_export")
            btn_preview_all.setCursor(Qt.PointingHandCursor)
            btn_preview_all.clicked.connect(self._open_preview_all)
            self.results_layout.addWidget(btn_preview_all)

        for label, path in self.generated_files:
            self._add_result_item(label, path)

    def _open_preview_all(self):
        from ui.workspace.preview_dialog import PreviewDialog
        dlg = PreviewDialog(self.generated_files, self)
        dlg.exec()

    def _add_result_item(self, label, path):
        item_w = QWidget()
        item_l = QVBoxLayout(item_w)
        item_l.setContentsMargins(0, 4, 0, 4)
        
        title = QLabel(f"<b>{label}</b>")
        title.setStyleSheet("font-size: 11px; color: #cccccc;")
        item_l.addWidget(title)
        
        btn_row = QHBoxLayout()
        btn_preview = QPushButton("👁  Prévisualiser")
        btn_preview.setObjectName("btn_action")
        btn_preview.setCursor(Qt.PointingHandCursor)
        btn_preview.clicked.connect(lambda checked=False, p=path, l=label: self._open_single_preview(l, p))

        btn_open = QPushButton("\u1F441  Ouvrir")
        btn_open.setObjectName("btn_action")
        btn_open.clicked.connect(lambda: os.startfile(path))
        
        btn_save = QPushButton("\u1F4BE  Enregistrer sous...")
        btn_save.setObjectName("btn_action")
        btn_save.clicked.connect(lambda checked=False, p=path, l=label: self._save_file_as(p, l))
        
        btn_row.addWidget(btn_preview)
        btn_row.addWidget(btn_open)
        btn_row.addWidget(btn_save)
        item_l.addLayout(btn_row)
        
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setStyleSheet("background: rgba(255,255,255,0.05);")
        item_l.addWidget(line)
        
        self.results_layout.addWidget(item_w)

    def _open_single_preview(self, label, path):
        from ui.workspace.preview_dialog import PreviewDialog
        dlg = PreviewDialog([(label, path)], self)
        dlg.exec()

    def _save_file_as(self, source_path, label):
        ext = os.path.splitext(source_path)[1]
        default_name = f"{label.replace(' ', '_')}{ext}"
        target_path, _ = QFileDialog.getSaveFileName(self, f"Enregistrer {label}", default_name, f"Fichiers (*{ext})")
        
        if target_path:
            try:
                shutil.copy(source_path, target_path)
                QMessageBox.information(self, "Succ\u00E8s", f"Fichier enregistr\u00E9 :\n{target_path}")
            except Exception as e:
                QMessageBox.critical(self, "Erreur", f"Impossible d'enregistrer le fichier :\n{e}")

    def _on_pdf_export_clicked(self):
        self.export_pdf_requested.emit({
            "resolution": self.cmb_pdf_reso.currentText(),
            "include_annexes": self.chk_pdf_annexes.isChecked()
        })

    def _on_csv_export_clicked(self):
        self.export_csv_requested.emit({
            "separator": self.cmb_csv_sep.currentText(),
            "encoding": self.cmb_csv_enc.currentText()
        })
