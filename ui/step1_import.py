import os
import json
import folium
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QPushButton, QFileDialog, QMessageBox)
from PySide6.QtWebEngineWidgets import QWebEngineView

class Step1Import(QWidget):
    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        
        layout = QVBoxLayout(self)

        top_layout = QHBoxLayout()
        self.lbl_status = QLabel("Aucun fichier GeoJSON importé.")
        self.btn_import = QPushButton("Importer fichier(s) GeoJSON")
        self.btn_import.clicked.connect(self.import_geojson)
        
        top_layout.addWidget(self.btn_import)
        top_layout.addWidget(self.lbl_status)
        top_layout.addStretch()
        layout.addLayout(top_layout)

        # Carte Live (WebEngineView)
        self.map_view = QWebEngineView()
        self.map_view.setMinimumHeight(400)
        layout.addWidget(self.map_view)

        # Draw empty map initially
        self.draw_map(None)

    def import_geojson(self):
        filepaths, _ = QFileDialog.getOpenFileNames(self, "Ouvrir GeoJSON", "", "GeoJSON Files (*.geojson *.json)")
        if not filepaths:
            return

        combined_features = []
        try:
            for fp in filepaths:
                with open(fp, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if 'features' in data:
                        combined_features.extend(data['features'])
                    elif data.get('type') == 'Feature':
                        combined_features.append(data)
                        
            if not combined_features:
                raise ValueError("Aucune feature trouvée dans les fichiers.")
                
            geojson_data = {
                "type": "FeatureCollection",
                "features": combined_features
            }
            
            self.state_manager.update_state("geojson_data", geojson_data)
            self.lbl_status.setText(f"{len(filepaths)} fichier(s) importé(s) ({len(combined_features)} features).")
            self.draw_map(geojson_data)
            
        except Exception as e:
            QMessageBox.critical(self, "Erreur", f"Erreur lors de l'import : {str(e)}")

    def draw_map(self, geojson_data):
        if not geojson_data:
            m = folium.Map(location=[48.8566, 2.3522], zoom_start=5)
        else:
            # Find bounds
            all_coords = []
            for feat in geojson_data.get('features', []):
                geom = feat.get('geometry', {})
                if geom.get('type') == 'LineString':
                    all_coords.extend(geom.get('coordinates', []))
                    
            if all_coords:
                lats = [p[1] for p in all_coords]
                lons = [p[0] for p in all_coords]
                center = [sum(lats)/len(lats), sum(lons)/len(lons)]
                m = folium.Map(location=center, zoom_start=14)
                
                folium.GeoJson(
                    geojson_data,
                    style_function=lambda x: {'color': 'blue', 'weight': 4}
                ).add_to(m)
            else:
                m = folium.Map(location=[48.8566, 2.3522], zoom_start=5)

        html_path = os.path.join(os.getcwd(), "temp_import_map.html")
        m.save(html_path)
        
        import urllib.request
        local_url = "file:///" + html_path.replace("\\", "/")
        self.map_view.setUrl(local_url)

    def update_from_state(self):
        data = self.state_manager.get_state("geojson_data")
        if data:
            self.lbl_status.setText("Projet chargé. Données GeoJSON présentes.")
            self.draw_map(data)
        else:
            self.lbl_status.setText("Aucun fichier GeoJSON importé.")
            self.draw_map(None)
