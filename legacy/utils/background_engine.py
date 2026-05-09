import queue
import time
import logging
import traceback
from PySide6.QtCore import QThread, Signal

class JobType:
    ROUTE_LEG = "route_leg"
    AZIMUT_LEG = "azimut_leg"

class JobQueueWorker(QThread):
    """
    Moteur asynchrone pour la génération incrémentale d'itinéraires.
    Utilise une file d'attente à priorité :
     - ROUTE_LEG a une plus haute priorité (0) pour s'afficher très vite sur la carte.
     - AZIMUT_LEG a une priorité moindre (1) et se fait une fois la route calculée.
    """
    job_started = Signal(str, str)            # job_id, job_type
    job_finished = Signal(str, str, object)   # job_id, job_type, result
    job_failed = Signal(str, str, str)        # job_id, job_type, error_msg

    def __init__(self, ign_client):
        super().__init__()
        self.ign_client = ign_client
        self.q = queue.PriorityQueue()
        self._running = True
        self.logger = logging.getLogger("BackgroundEngine")
        
        import itertools
        self._counter = itertools.count()

    def enqueue_route_leg(self, job_id, p1, p2, profile='pedestrian', small_roads_only=False):
        """Met en file d'attente un calcul de tracé BRouter (Priorité 0)."""
        count = next(self._counter)
        self.q.put((0, count, job_id, JobType.ROUTE_LEG, (p1, p2, profile, small_roads_only)))

    def enqueue_azimut_leg(self, job_id, geojson_data, force_intersections, settings):
        """Met en file d'attente une polygonalisation (Overpass+Maths) (Priorité 1)."""
        count = next(self._counter)
        self.q.put((1, count, job_id, JobType.AZIMUT_LEG, (geojson_data, force_intersections, settings)))

    def clear_queue(self):
        """Vide la file d'attente."""
        while not self.q.empty():
            try:
                self.q.get_nowait()
                self.q.task_done()
            except queue.Empty:
                break

    def run(self):
        while self._running:
            try:
                priority, count, job_id, job_type, args = self.q.get(timeout=0.2)
            except queue.Empty:
                continue

            if not self._running:
                break

            self.job_started.emit(job_id, job_type)
            try:
                if job_type == JobType.ROUTE_LEG:
                    res = self._process_route_leg(*args)
                elif job_type == JobType.AZIMUT_LEG:
                    res = self._process_azimut_leg(*args)
                else:
                    res = None
                self.job_finished.emit(job_id, job_type, res)
            except Exception as e:
                self.logger.error(f"Erreur sur le job {job_id} ({job_type}): {traceback.format_exc()}")
                self.job_failed.emit(job_id, job_type, str(e))
            finally:
                self.q.task_done()

    def stop(self):
        self._running = False

    def _process_route_leg(self, p1, p2, profile, small_roads_only):
        alts = self.ign_client.compute_route_alternatives(
            p1, p2, profile, max_alts=1, small_roads_only=small_roads_only
        )
        if not alts:
            coords = [[p1[1], p1[0]], [p2[1], p2[0]]]
            return coords, None
        best_coords = alts[0]["geometry"].get("coordinates", [])
        return best_coords, alts

    def _process_azimut_leg(self, geojson, force_intersections, settings):
        # Import retardé pour éviter les pépins de Thread/Qt en global
        import sys
        import os
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if project_root not in sys.path:
            sys.path.insert(0, project_root)
        import refactor_polygonalisation

        pts, indices, count = refactor_polygonalisation.analyze_trajectory(geojson, force_intersections)
        
        tol = settings.get("tolerance", 45)
        min_dist = settings.get("min_dist", 80)
        offroad = settings.get("allow_offroad", False)
        
        processed_features = refactor_polygonalisation.solve_polygonalisation(
            pts, indices, tol, min_dist, offroad, force_intersections, [], []
        )
        
        segments = []
        for feat in processed_features:
            p = feat.get('properties', {})
            geom = feat.get('geometry', {})
            segments.append({
                'azimut': p.get('azimut', 0),
                'distance': p.get('metrage', 0),
                'coords': geom.get('coordinates', []),
                'properties': p
            })
        return segments
