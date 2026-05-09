import os
import folium
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QSlider, QCheckBox, QPushButton, QGroupBox)
from PySide6.QtCore import Qt, Signal, QThread, QObject
from PySide6.QtWebEngineWidgets import QWebEngineView

from utils.presets_manager import PresetsManager
import refactor_polygonalisation

class PolyWorker(QThread):
    finished = Signal(object) # Envoie la carte html générée

    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager

    def run(self):
        # Récupération des paramètres
        tol = self.state_manager.get_state("polygonalization_settings").get("tolerance", 20)
        hors_piste = self.state_manager.get_state("polygonalization_settings").get("allow_offroad", False)
        forcer_car = self.state_manager.get_state("polygonalization_settings").get("force_intersections", True)
        min_dist = self.state_manager.get_state("polygonalization_settings").get("min_dist", 10)
        geojson = self.state_manager.get_state("geojson_data")
        
        # Call the real algorithm
        if geojson:
            processed_features = refactor_polygonalisation.process_trajectory_data(
                geojson, tol, hors_piste, forcer_car, min_dist
            )
            
            # Format to segments for state
            segments = []
            for feat in processed_features:
                p = feat.get('properties', {})
                geom = feat.get('geometry', {})
                coords = geom.get('coordinates', [])
                segments.append({
                    'azimut': p.get('azimut', 0),
                    'distance': p.get('metrage', 0),
                    'coords': coords,
                    'properties': p
                })
            
            self.state_manager.update_state("polygonal_steps", segments)
            
            # Draw real segments on map
            lats = [p[1] for seg in segments for p in seg['coords']]
            lons = [p[0] for seg in segments for p in seg['coords']]
            if lats and lons:
                m = folium.Map(location=[sum(lats)/len(lats), sum(lons)/len(lons)], zoom_start=14)
                
                # Draw path
                for seg in segments:
                    folium.PolyLine([(c[1], c[0]) for c in seg['coords']], color="red", weight=4).add_to(m)
                    
                    # Add marker at intersections
                    if seg['coords']:
                        c = seg['coords'][0]
                        folium.CircleMarker(location=[c[1], c[0]], radius=5, color="black", fill=True).add_to(m)
            else:
                m = folium.Map(location=[48.8566, 2.3522], zoom_start=13)
        else:
            m = folium.Map(location=[48.8566, 2.3522], zoom_start=13)

        html_path = os.path.join(os.getcwd(), "temp_map.html")
        m.save(html_path)
        
        self.finished.emit(html_path)

class Step2Polygon(QWidget):
    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        self.worker = None

        layout = QVBoxLayout(self)

        # Settings Group
        settings_group = QGroupBox("Paramètres de Polygonalisation")
        settings_layout = QVBoxLayout()

        # Contrôle Principal (Slider)
        slider_layout = QHBoxLayout()
        self.lbl_tolerance = QLabel("Précision du tracé (Tolérance Angulaire) : 20°")
        self.slider_tol = QSlider(Qt.Horizontal)
        self.slider_tol.setMinimum(5)
        self.slider_tol.setMaximum(60)
        self.slider_tol.setValue(20)
        self.slider_tol.valueChanged.connect(self.on_slider_changed)
        
        slider_layout.addWidget(self.lbl_tolerance)
        slider_layout.addWidget(self.slider_tol)
        settings_layout.addLayout(slider_layout)

        # Contrôles Intelligents (Switch/Checkbox)
        self.chk_hors_piste = QCheckBox("Autoriser le hors-piste")
        self.chk_hors_piste.stateChanged.connect(self.on_setting_changed)
        settings_layout.addWidget(self.chk_hors_piste)

        # Contrôle des Carrefours
        self.chk_carrefours = QCheckBox("Forcer la détection des intersections (Accrochage routier)")
        self.chk_carrefours.setChecked(True)
        self.chk_carrefours.stateChanged.connect(self.on_setting_changed)
        settings_layout.addWidget(self.chk_carrefours)

        # Bouton de Bypass
        self.btn_bypass = QPushButton("Ignorer : tracé déjà optimisé (Bypass)")
        self.btn_bypass.setCheckable(True)
        self.btn_bypass.clicked.connect(self.on_bypass_toggled)
        settings_layout.addWidget(self.btn_bypass)

        settings_group.setLayout(settings_layout)
        layout.addWidget(settings_group)

        # Carte Live (WebEngineView)
        self.map_view = QWebEngineView()
        self.map_view.setMinimumHeight(400)
        layout.addWidget(self.map_view)

        # Initial map load
        self.update_live_feedback()

    def on_slider_changed(self, value):
        self.lbl_tolerance.setText(f"Précision du tracé (Tolérance Angulaire) : {value}°")
        self.on_setting_changed()

    def on_bypass_toggled(self, checked):
        # Désactiver les autres contrôles si bypass est activé
        self.slider_tol.setDisabled(checked)
        self.chk_hors_piste.setDisabled(checked)
        self.chk_carrefours.setDisabled(checked)
        
        settings = self.state_manager.get_state("polygonalization_settings")
        settings["bypassed"] = checked
        self.state_manager.update_state("polygonalization_settings", settings)
        
        if not checked:
            self.update_live_feedback()

    def on_setting_changed(self):
        settings = {
            "tolerance": self.slider_tol.value(),
            "allow_offroad": self.chk_hors_piste.isChecked(),
            "force_intersections": self.chk_carrefours.isChecked(),
            "bypassed": self.btn_bypass.isChecked()
        }
        self.state_manager.update_state("polygonalization_settings", settings)
        self.update_live_feedback()

    def update_live_feedback(self):
        if self.btn_bypass.isChecked():
            return
            
        # Stop previous worker if still running
        if self.worker and self.worker.isRunning():
            self.worker.terminate()
            
        self.worker = PolyWorker(self.state_manager)
        self.worker.finished.connect(self.on_map_generated)
        self.worker.start()

    def on_map_generated(self, html_path):
        import urllib.request
        local_url = "file:///" + html_path.replace("\\", "/")
        self.map_view.setUrl(local_url)
