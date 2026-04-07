import os
import time
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QLabel, 
                               QPushButton, QProgressBar, QMessageBox)
from PySide6.QtCore import Qt, QThread, Signal

class ExportWorker(QThread):
    progress = Signal(int, str) # progress_value, message
    finished = Signal(bool, str) # success, result_message

    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager

    def run(self):
        try:
            from main_orchestrator import Orchestrator
            
            self.progress.emit(10, "1/4 : Initialisation de l'Orchestrateur...")
            orchestrator = Orchestrator(self.state_manager)
            
            self.progress.emit(40, "2/4 : Exécution des règles de distribution...")
            # If we're fully integrated, Orchestrator should understand "state_manager.get_state('polygonal_steps')"
            # We will call a custom method on the Orchestrator for GUI mode
            plan = orchestrator.run_from_gui()
            
            self.progress.emit(70, "3/4 : Compilation des PDFs et modules...")
            
            # The orchestrator handles assembling the carnet in run_from_gui()
            
            self.progress.emit(100, "Génération terminée !")
            
            output_dir = os.path.join(os.getcwd(), "output_carnet")
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
                
            self.finished.emit(True, f"Carnet généré avec succès dans {output_dir}")
            
        except Exception as e:
            self.finished.emit(False, str(e))

class Step6Export(QWidget):
    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        
        layout = QVBoxLayout(self)

        lbl_title = QLabel("Compilation et Exportation")
        lbl_title.setStyleSheet("font-size: 18px; font-weight: bold;")
        lbl_title.setAlignment(Qt.AlignCenter)
        layout.addWidget(lbl_title)

        lbl_desc = QLabel("Votre parcours est prêt à être compilé.")
        lbl_desc.setAlignment(Qt.AlignCenter)
        layout.addWidget(lbl_desc)

        layout.addSpacing(20)

        self.btn_generate = QPushButton("🚀 Générer le Carnet Scout")
        self.btn_generate.setStyleSheet("font-size: 16px; padding: 15px; background-color: #28a745; color: white;")
        self.btn_generate.clicked.connect(self.start_generation)
        layout.addWidget(self.btn_generate)

        layout.addSpacing(20)

        self.lbl_progress = QLabel("")
        self.lbl_progress.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.lbl_progress)

        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)

        layout.addStretch()

        self.worker = None

    def start_generation(self):
        self.btn_generate.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.lbl_progress.setText("Démarrage...")
        
        # Validation checks
        if not self.state_manager.get_state("geojson_data"):
            QMessageBox.warning(self, "Attention", "Aucun fichier GeoJSON importé !")
            self.reset_ui()
            return
            
        # Start Worker
        self.worker = ExportWorker(self.state_manager)
        self.worker.progress.connect(self.update_progress)
        self.worker.finished.connect(self.on_finished)
        self.worker.start()

    def update_progress(self, val, msg):
        self.progress_bar.setValue(val)
        self.lbl_progress.setText(msg)

    def on_finished(self, success, msg):
        self.reset_ui()
        if success:
            QMessageBox.information(self, "Succès", msg)
            self._open_folder("output_carnet")
        else:
            QMessageBox.critical(self, "Erreur", f"Échec de la génération :\n{msg}")

    def reset_ui(self):
        self.btn_generate.setEnabled(True)
        self.lbl_progress.setText("")
        self.progress_bar.setVisible(False)
        
    def _open_folder(self, folder_path):
        import sys
        import subprocess
        full_path = os.path.abspath(folder_path)
        if sys.platform == 'win32':
            os.startfile(full_path)
        elif sys.platform == 'darwin':
            subprocess.Popen(['open', full_path])
        else:
            subprocess.Popen(['xdg-open', full_path])

    def update_from_state(self):
        # We don't dynamically update anything visually based on state,
        # but we could show a summary of what's going to be generated.
        pass
