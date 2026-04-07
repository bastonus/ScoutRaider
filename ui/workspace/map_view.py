import os
import json
from PySide6.QtWidgets import QWidget, QVBoxLayout
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebEngineCore import QWebEnginePage
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtCore import QObject, Slot, Signal, QUrl

class Bridge(QObject):
    segmentClicked = Signal(int)
    methodDropped = Signal(str, int)
    segmentMenuRequested = Signal(int, float, float)
    nodeMenuRequested = Signal(int, float, float)
    azimutUpdated = Signal(int, int) # idx, new_azi
    segmentsMerged = Signal(int)    # idx (merge with next)
    nodeAdded = Signal(float, float, int) # lat, lng, segment_idx
    nodeRemoved = Signal(int) # point_idx
    nodeMoved = Signal(int, float, float) # point_idx, lat, lng
    batchAssign = Signal(str, str) # method_id, json_list_str
    nativeRouteCreated = Signal(str) # GeoJSON string
    baseMapChanged = Signal(str)     # Layer name string
    mapClicked = Signal(float, float) # lat, lon
    searchSuggestionsRequested = Signal(str)
    togglePickingRequested = Signal(bool)
    calculateRouteRequested = Signal(str)
    calculateWithPointsRequested = Signal(str, str, str) # profile, json_points, server_url
    resetRouteRequested = Signal()
    stageClicked = Signal(int)          # stage index clicked
    stageHovered = Signal(int)          # stage index hovered (-1 = unhover)
    stageDeleteRequested = Signal(int)  # stage index to delete (right-click)
    routeAlternativeSelected = Signal(int) # alternative index chosen
    dangerValidated = Signal(int) # route_idx to validate
    
    @Slot(int)
    def onDangerValidated(self, route_idx):
        self.dangerValidated.emit(route_idx)
    def onRouteAlternativeSelected(self, idx):
        self.routeAlternativeSelected.emit(idx)
    
    @Slot(int)
    def onSegmentClicked(self, segment_id):
        self.segmentClicked.emit(segment_id)
        
    @Slot(str, int)
    def onDropMethod(self, methodName, segment_id):
        self.methodDropped.emit(methodName, segment_id)
        
    @Slot(int, float, float)
    def onSegmentContextMenu(self, segment_id, lat, lng):
        self.segmentMenuRequested.emit(segment_id, lat, lng)
        
    @Slot(int, float, float)
    def onNodeContextMenu(self, node_id, lat, lng):
        self.nodeMenuRequested.emit(node_id, lat, lng)

    @Slot(int, int)
    def onUpdateAzimut(self, segment_id, new_azi):
        self.azimutUpdated.emit(segment_id, new_azi)

    @Slot(int)
    def onMergeSegments(self, segment_id):
        self.segmentsMerged.emit(segment_id)

    @Slot(float, float, int)
    def onAddNode(self, lat, lng, segment_idx):
        self.nodeAdded.emit(lat, lng, segment_idx)

    @Slot(int)
    def onRemoveNode(self, point_idx):
        self.nodeRemoved.emit(point_idx)

    @Slot(int, float, float)
    def onMoveNode(self, point_idx, lat, lng):
        self.nodeMoved.emit(point_idx, lat, lng)

    @Slot(str, str)
    def onBatchAssign(self, method_id, json_list_str):
        self.batchAssign.emit(method_id, json_list_str)

    @Slot(str)
    def onNativeRouteCreated(self, geojson_str):
        self.nativeRouteCreated.emit(geojson_str)

    @Slot(str)
    def onBaseMapChanged(self, layer_name):
        self.baseMapChanged.emit(layer_name)

    @Slot(str)
    def requestSuggestions(self, query):
        self.searchSuggestionsRequested.emit(query)

    @Slot(float, float)
    def onMapClick(self, lat, lng):
        self.mapClicked.emit(lat, lng)

    @Slot(bool)
    def onTogglePicking(self, enabled):
        self.togglePickingRequested.emit(enabled)

    @Slot(str)
    def onCalculateRoute(self, profile):
        self.calculateRouteRequested.emit(profile)

    @Slot(str, str, str)
    def onCalculateWithPoints(self, profile, json_points, server_url=""):
        self.calculateWithPointsRequested.emit(profile, json_points, server_url)

    @Slot()
    def onResetRoute(self):
        self.resetRouteRequested.emit()

    @Slot(int)
    def onStageClicked(self, stageIdx):
        self.stageClicked.emit(stageIdx)

    @Slot(int)
    def onStageHovered(self, stageIdx):
        self.stageHovered.emit(stageIdx)

    @Slot(int)
    def onStageDelete(self, stageIdx):
        self.stageDeleteRequested.emit(stageIdx)

    @Slot(int)
    def onRouteAlternativeSelected(self, idx):
        self.routeAlternativeSelected.emit(idx)

class MapView(QWidget):
    segment_selected = Signal(int)
    method_dropped = Signal(str, int)
    segment_menu_requested = Signal(int, float, float)
    node_menu_requested = Signal(int, float, float)
    azimut_updated = Signal(int, int)
    segments_merged = Signal(int)
    node_added = Signal(float, float, int)
    node_removed = Signal(int)
    node_moved = Signal(int, float, float)
    batch_assign = Signal(str, str)
    native_route_created = Signal(str)
    basemap_changed = Signal(str)
    map_clicked = Signal(float, float)
    search_suggestions_requested = Signal(str)
    toggle_picking_requested = Signal(bool)
    calculate_route_requested = Signal(str)
    calculate_route_with_points_requested = Signal(str, str, str)
    reset_route_requested = Signal()
    stage_clicked = Signal(int)
    stage_hovered = Signal(int)
    stage_delete_requested = Signal(int)
    route_alternative_selected = Signal(int)
    danger_validated = Signal(int)

    # Thread-safe cross-thread signal for OS Location
    _geo_signal = Signal(float, float)

    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        self.web_view = QWebEngineView()
        self.web_view.settings().setAttribute(self.web_view.settings().WebAttribute.LocalContentCanAccessRemoteUrls, True)
        self.web_view.settings().setAttribute(self.web_view.settings().WebAttribute.LocalContentCanAccessFileUrls, True)
        layout.addWidget(self.web_view)
        
        self.channel = QWebChannel()
        self.bridge = Bridge()
        
        # Connect bridge signals to MapView signals
        self.bridge.segmentClicked.connect(self.segment_selected.emit)
        self.bridge.methodDropped.connect(self.method_dropped.emit)
        self.bridge.segmentMenuRequested.connect(self.segment_menu_requested.emit)
        self.bridge.nodeMenuRequested.connect(self.node_menu_requested.emit)
        self.bridge.azimutUpdated.connect(self.azimut_updated.emit)
        self.bridge.segmentsMerged.connect(self.segments_merged.emit)
        self.bridge.nodeAdded.connect(self.node_added.emit)
        self.bridge.nodeRemoved.connect(self.node_removed.emit)
        self.bridge.nodeMoved.connect(self.node_moved.emit)
        self.bridge.batchAssign.connect(self.batch_assign.emit)
        self.bridge.calculateWithPointsRequested.connect(self.calculate_route_with_points_requested.emit)
        self.bridge.resetRouteRequested.connect(self.reset_route_requested.emit)
        self.bridge.baseMapChanged.connect(self.basemap_changed.emit)
        self.bridge.mapClicked.connect(self.map_clicked.emit)
        self.bridge.searchSuggestionsRequested.connect(self.search_suggestions_requested.emit)
        self.bridge.togglePickingRequested.connect(self.toggle_picking_requested.emit)
        self.bridge.calculateRouteRequested.connect(self.calculate_route_requested.emit)
        self.bridge.stageClicked.connect(self.stage_clicked.emit)
        self.bridge.stageHovered.connect(self.stage_hovered.emit)
        self.bridge.stageDeleteRequested.connect(self.stage_delete_requested.emit)
        self.bridge.routeAlternativeSelected.connect(self.route_alternative_selected.emit)
        self.bridge.dangerValidated.connect(self.danger_validated.emit)

        self.channel.registerObject("bridge", self.bridge)
        self.web_view.page().setWebChannel(self.channel)
        
        # Grant geolocation permission automatically
        self.web_view.page().featurePermissionRequested.connect(self._on_permission_requested)
        
        # Load map template
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        template_path = os.path.join(curr_dir, "map_template.html")
        self.web_view.setUrl(QUrl.fromLocalFile(template_path))
        
        # Connect geolocation signal bridge
        self._geo_signal.connect(self._apply_native_geolocation)

        # Native OS Geolocation for accurate user position
        self._start_native_geolocation()
    
    def _on_permission_requested(self, origin, feature):
        """Auto-grant geolocation and other permissions."""
        if feature == QWebEnginePage.Feature.Geolocation:
            self.web_view.page().setFeaturePermission(
                origin, feature, QWebEnginePage.PermissionPolicy.PermissionGrantedByUser)
        else:
            self.web_view.page().setFeaturePermission(
                origin, feature, QWebEnginePage.PermissionPolicy.PermissionDeniedByUser)

    def _start_native_geolocation(self):
        """Use native OS geolocation with explicit permission requests."""
        import platform
        import threading
        from PySide6.QtCore import QTimer

        systeme = platform.system()
        
        if systeme == 'Windows':
            def fetch_windows_loc():
                try:
                    import asyncio
                    from datetime import timedelta
                    from winsdk.windows.devices.geolocation import Geolocator

                    async def demander_permission_windows():
                        geolocator = Geolocator()
                        geolocator.desired_accuracy = 1 # PositionAccuracy.High
                        
                        status = await geolocator.request_access_async()
                        if status == 1: # 1 = Autorisé
                            # Force fresh lock (0s max age) with 10s timeout
                            pos = await geolocator.get_geoposition_async(timedelta(seconds=0), timedelta(seconds=10))
                            if pos and pos.coordinate:
                                lat = pos.coordinate.latitude
                                lon = pos.coordinate.longitude
                                # SAFELY emit to main GUI thread via Signal
                                self._geo_signal.emit(lat, lon)
                        else:
                            self.logger.debug("Windows location permission denied by user or OS.")
                    
                    # Run asyncio loop in background thread
                    asyncio.run(demander_permission_windows())
                except ImportError:
                    self.logger.debug("winsdk module missing. Please install it with 'pip install winsdk'.")
                except Exception as e:
                    self.logger.debug(f"Windows geolocation error: {e}")
                    
            threading.Thread(target=fetch_windows_loc, daemon=True).start()
        else:
            # Fallback for Linux/macOS could go here, or just ignore since requested for Windows.
            self.logger.debug(f"Geolocation not explicitly configured for OS: {systeme}")

    def _apply_native_geolocation(self, lat, lon):
        """Handle native position update and center the map."""
        if not getattr(self, '_geo_centered', False):
            self._geo_centered = True
            # Center map on user location
            js = f"""
                if (typeof map !== 'undefined' && map) {{
                    map.setView([{lat}, {lon}], 14, {{animate: true}});
                    L.circleMarker([{lat}, {lon}], {{
                        radius: 8, color: '#10b981', fillColor: '#10b981',
                        fillOpacity: 0.3, weight: 2
                    }}).addTo(map);
                }} else {{
                    // Map not ready yet, update globals so initMap catches it
                    window._preGeoLat = {lat};
                    window._preGeoLon = {lon};
                    window._preGeoReady = true;
                }}
            """
            self.web_view.page().runJavaScript(js)
        
    def on_bridge_segment_clicked(self, seg_id):
        self.segment_selected.emit(seg_id)
        
    def render_geojson(self, geojson):
        # Escaping is important, but json.dumps handles structure
        js = f"if (typeof renderGeoJSONOnly === 'function') {{ renderGeoJSONOnly({json.dumps(geojson)}); }}"
        self.web_view.page().runJavaScript(js)
        
    def render_segments(self, segments, assignments, violations=None, fit_bounds=True, geojson=None, danger_pois=None):
        show_arrows = self.state_manager.get_state("show_azimuth_arrows", True)
        fit_js = "true" if fit_bounds else "false"
        stages = self.state_manager.get_state("stages", [])
        vios_js = json.dumps(violations) if violations else "{}"
        geo_js = json.dumps(geojson) if geojson else "null"
        poi_js = json.dumps(danger_pois) if danger_pois else "null"
        js = f"if (typeof renderSegments === 'function') {{ renderSegments({json.dumps(segments)}, {json.dumps(assignments)}, {'true' if show_arrows else 'false'}, {fit_js}, {json.dumps(stages)}, {vios_js}, {geo_js}, {poi_js}); }}"
        self.web_view.page().runJavaScript(js)

    def set_interaction_tool(self, tool_id):
        js = f"if (typeof setActiveTool === 'function') {{ setActiveTool({json.dumps(tool_id)}); }}"
        self.web_view.page().runJavaScript(js)
        
    def select_segment(self, idx):
        self.web_view.page().runJavaScript(f"if (typeof selectSegment === 'function') {{ selectSegment({idx}); }}")

    def show_search_suggestions(self, results):
        """Sends search results back to the JS floating search bar."""
        import json
        json_str = json.dumps(results)
        self.web_view.page().runJavaScript(f"if(window.showSuggestions) window.showSuggestions({json_str});")

    def center_on(self, lat, lon, zoom=13):
        self.web_view.page().runJavaScript(f"if(typeof map !== 'undefined' && map) map.setView([{lat}, {lon}], {zoom});")

    def render_waypoints(self, stages):
        """Send stages list to JS for waypoint rendering."""
        import json as _json
        js = f"if(typeof renderWaypoints === 'function') renderWaypoints({_json.dumps(stages)});"
        self.web_view.page().runJavaScript(js)

    def show_dashed_preview(self, lat, lon, stage_idx=-1):
        """Show a dashed blue preview line from a point."""
        self.web_view.page().runJavaScript(f"if(typeof showDashedPreview === 'function') showDashedPreview({lat}, {lon}, {stage_idx});")

    def hide_dashed_preview(self):
        self.web_view.page().runJavaScript("if(typeof hideDashedPreview === 'function') hideDashedPreview();")

    def show_loading(self, text="Calcul en cours..."):
        import json as _json
        self.web_view.page().runJavaScript(f"if(window.showLoading) window.showLoading({_json.dumps(text)});")

    def hide_loading(self):
        self.web_view.page().runJavaScript("if(window.hideLoading) window.hideLoading();")

    def show_route_alternatives(self, alts):
        import json
        self.web_view.page().runJavaScript(f"if(window.showRouteAlternatives) window.showRouteAlternatives({json.dumps(alts)});")

    def clear_route_alternatives(self):
        self.web_view.page().runJavaScript("if(window.clearRouteAlternatives) window.clearRouteAlternatives();")

    def show_status_message(self, message, level="error"):
        import json
        self.web_view.page().runJavaScript(f"if(window.showStatusMessage) window.showStatusMessage({json.dumps(message)}, '{level}');")
