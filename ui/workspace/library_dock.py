"""
Library Dock — Challenge modules list with drag-and-drop support.
Includes a "+" button to import new module folders.
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QListWidget, 
                               QListWidgetItem, QLabel, QPushButton, QFileDialog,
                               QMessageBox)
from PySide6.QtCore import Qt, QMimeData
from PySide6.QtGui import QDrag, QPixmap, QColor, QIcon, QPainter, QBrush


# Human-readable names for each module
MODULE_LABELS = {
    "carte_ign": "Carte IGN",
    "drapeaux": "Drapeaux de signalisation",
    "morse": "Code Morse",
    "avocat": "Chiffre Avocat",
    "cassis": "Chiffre Cassis",
    "gilwell": "Gilwell (Scouts)",
    "templier": "Code Templier",
    "texte_clair": "Texte clair",
    "vigenere": "Chiffre de Vigenère",
    "maritime": "Pavillons maritimes",
    "polybe": "Carré de Polybe",
}

# Color codes matching map JS modColors
MOD_COLORS = {
    'carte_ign': '#3b82f6', 'drapeaux': '#f59e0b', 'gilwell': '#8b5cf6',
    'morse': '#ef4444', 'vigenere': '#ec4899', 'templier': '#f97316',
    'texte_clair': '#10b981', 'avocat': '#14b8a6', 'cassis': '#a855f7',
    'maritime': '#06b6d4', 'polybe': '#f43f5e',
}


class DraggableListWidget(QListWidget):
    """List widget with drag support for module modules."""
    def startDrag(self, supportedActions):
        item = self.currentItem()
        if not item: return
        drag = QDrag(self)
        mimeData = QMimeData()
        method_id = item.data(Qt.UserRole)
        mimeData.setText(method_id)
        drag.setMimeData(mimeData)
        drag.exec(supportedActions)


class LibraryDock(QWidget):
    """Challenge library — drag modules onto map segments."""
    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(4)
        
        # Header with "+" button
        header = QHBoxLayout()
        hint = QLabel("Glissez un encodage sur un tronçon")
        hint.setAlignment(Qt.AlignCenter)
        hint.setToolTip("Chaque type d'encodage chiffre les directions différemment dans le PDF final")
        header.addWidget(hint, 1)
        
        self.btn_add = QPushButton("+")
        self.btn_add.setFixedSize(24, 24)
        self.btn_add.setToolTip("Importer un nouveau dossier de module")
        self.btn_add.clicked.connect(self._import_module)
        header.addWidget(self.btn_add)
        layout.addLayout(header)
        
        self.list_widget = DraggableListWidget()
        self.list_widget.setDragEnabled(True)
        self.list_widget.setStyleSheet("""
            QListWidget {
                background: #252526;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 6px;
            }
            QListWidget::item {
                padding: 6px 8px;
                color: #ccc;
                font-size: 12px;
                border-radius: 4px;
                margin-bottom: 2px;
            }
            QListWidget::item:hover {
                background: #007acc;
                color: #fff;
            }
            QListWidget::item:selected {
                background: #007acc;
                color: #fff;
            }
        """)
        self.load_methods()
        layout.addWidget(self.list_widget)

    def load_methods(self):
        self.list_widget.clear()
        methods = ["carte_ign", "drapeaux", "morse", "avocat", "cassis", "gilwell", "templier", "texte_clair"]
        modules_dir = os.path.join(PROJECT_ROOT, "modules")
        if os.path.exists(modules_dir):
            for d in os.listdir(modules_dir):
                if os.path.isdir(os.path.join(modules_dir, d)) and d not in methods:
                    methods.append(d)

        for m in sorted(methods):
            display_name = MODULE_LABELS.get(m, m.replace('_', ' ').title())
            color = MOD_COLORS.get(m, '#6b7280')
            
            # Create colored circle icon
            pm = QPixmap(12, 12)
            pm.fill(Qt.transparent)
            painter = QPainter(pm)
            painter.setRenderHint(QPainter.Antialiasing)
            painter.setBrush(QBrush(QColor(color)))
            painter.setPen(Qt.NoPen)
            painter.drawEllipse(1, 1, 10, 10)
            painter.end()
            
            item = QListWidgetItem(QIcon(pm), "  " + display_name)
            item.setData(Qt.UserRole, m)
            item.setToolTip(f"Module: {m}")
            self.list_widget.addItem(item)

    def _import_module(self):
        """Open a folder dialog pointing to modules/ to add a new module."""
        modules_dir = os.path.join(PROJECT_ROOT, "modules")
        folder = QFileDialog.getExistingDirectory(
            self, "Sélectionner dossier du module", modules_dir)
        if not folder:
            return
        
        folder_name = os.path.basename(folder)
        target = os.path.join(modules_dir, folder_name)
        
        if os.path.exists(target):
            QMessageBox.information(self, "Déjà installé", 
                f"Le module '{folder_name}' est déjà installé.")
        else:
            # Copy or link the folder
            import shutil
            try:
                shutil.copytree(folder, target)
                QMessageBox.information(self, "Importé", 
                    f"Le module '{folder_name}' a été importé.")
            except Exception as e:
                QMessageBox.critical(self, "Erreur", str(e))
                return
        
        self.load_methods()

    def set_state_manager(self, state_manager):
        """Rebind this panel to a different StateManager (multi-tab support)."""
        self.state_manager = state_manager
        # Library content is static (module list), no state-driven refresh needed

