# Module: loader_gpx

## Rôle
Chargeur et analyseur de fichiers GPX (format standard international des GPS de randonnée et montres Garmin/Suunto).
Extrait la polyline, les altitudes échantillonnées et la liste des waypoints/balises.

## Spécification Hub v2
- **Resource Type**: `path_provider`
- **Formats supportés**: `.gpx`, `.xml`
- **Extraction altimétrique**: Oui (D+/D-)
