# map

## Overview
Interactive map canvas components: Leaflet/OpenLayers layers, toolbar, overlays, and HUD.

## Interface
- `[ActiveRouteLayer.tsx] function ActiveRouteLayer()`
- `[AnnotationModals.tsx] function calculatePolygonArea()`
- `[AnnotationModals.tsx] function formatArea()`
- `[AnnotationModals.tsx] function PointAnnotationModal()`
- `[AnnotationModals.tsx] function AreaAnnotationModal()`
- `[AnnotationModals.tsx] const PRESET_COLORS`
- `[AnnotationModals.tsx] const ICONS_CONFIG`
- `[AnnotationsMapLayer.tsx] function AnnotationsMapLayer()`
- `[ControlToolbar.tsx] function ControlToolbar()`
- `[CursorPreviewLine.tsx] function CursorPreviewLine()`
- `[DrawAnnotationsLayer.tsx] function DrawAnnotationsLayer()`
- `[ElevationProfileBar.tsx] function ElevationProfileBar()`
- `[FloatingSearch.tsx] function FloatingSearch()`
- `[FloatingToolbar.tsx] function FloatingToolbar()`
- `[HelpModal.tsx] function HelpModal()`
- `[InactiveItinerariesLayer.tsx] function InactiveItinerariesLayer()`
- `[InfoPills.tsx] function InfoPills()`
- `[InteractiveStages.tsx] function InteractiveStages()`
- `[LegendOverlay.tsx] function LegendOverlay()`
- `[MapComponent.tsx] function MapComponent()`
- `[MapComponent.tsx] const mapRef`
- `[MapHUD.tsx] function MapHUD()`
- `[MapSettings.tsx] function MapSettings()`
- `[MapSettingsModal.tsx] function MapSettingsModal()`
- `[MapWorkspace.tsx] function MapWorkspace()`
- *(and 5 more exported symbols)*

## Invariants
- None

## Side Effects
- Browser storage access (localStorage)
- DOM / browser window side effects
- Network HTTP API calls (fetch/axios)

## Verification
- Run: `npm run build`
