import os
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QRadioButton, QButtonGroup, QPushButton, 
                               QGroupBox)
from PySide6.QtCore import Qt

class Step3Mode(QWidget):
    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        
        layout = QVBoxLayout(self)

        lbl_title = QLabel("Choix du Mode de Distribution")
        lbl_title.setStyleSheet("font-size: 16px; font-weight: bold;")
        layout.addWidget(lbl_title)

        lbl_desc = QLabel("Comment souhaitez-vous répartir les codes sur les différents tronçons du parcours ?")
        layout.addWidget(lbl_desc)

        group_box = QGroupBox("Mode de Génération")
        group_layout = QVBoxLayout()

        self.btn_group = QButtonGroup(self)

        self.radio_auto = QRadioButton("🧠 Mode Automatique (Recommandé)")
        self.radio_auto.setToolTip("L'Orchestrateur répartit intelligemment les codes selon les presets et les règles globales.")
        self.radio_auto.setChecked(True)
        self.btn_group.addButton(self.radio_auto, 1)
        group_layout.addWidget(self.radio_auto)

        lbl_auto_desc = QLabel("   Utilise le gestionnaire de Presets, tire au sort selon les probabilités tout en respectant l'espacement et l'anti-répétition.")
        lbl_auto_desc.setStyleSheet("color: gray; font-style: italic;")
        group_layout.addWidget(lbl_auto_desc)

        group_layout.addSpacing(15)

        self.radio_manual = QRadioButton("🖐️ Mode Manuel (Expert)")
        self.radio_manual.setToolTip("Vous affectez vous-même chaque tronçon (bifurcation) à un code spécifique.")
        self.btn_group.addButton(self.radio_manual, 2)
        group_layout.addWidget(self.radio_manual)

        lbl_manual_desc = QLabel("   Ouvre une interface listant tous les azimuts où vous choisissez le module exact pour chaque étape.")
        lbl_manual_desc.setStyleSheet("color: gray; font-style: italic;")
        group_layout.addWidget(lbl_manual_desc)

        group_box.setLayout(group_layout)
        layout.addWidget(group_box)
        layout.addStretch()

        self.btn_group.buttonClicked.connect(self.on_mode_changed)

    def on_mode_changed(self, button):
        if self.radio_auto.isChecked():
            self.state_manager.update_state("distribution_mode", "auto")
        else:
            self.state_manager.update_state("distribution_mode", "manual")

    def update_from_state(self):
        mode = self.state_manager.get_state("distribution_mode", "auto")
        if mode == "auto":
            self.radio_auto.setChecked(True)
        else:
            self.radio_manual.setChecked(True)
