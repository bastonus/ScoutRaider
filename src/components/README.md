# components

## Overview
React UI component library structured into four groups (`layout/`, `map/`, `panels/`, `textual/`), styled using the CSS design tokens in `src/index.css`.

## Subdirectories & Boundaries
- `layout/` ([layout](./layout/README.md)) - Application shell layout components: window menu bar, tabs, command palette, timeline, workspace shell, and right sidebar (`ChromeTabs.tsx`, `CommandPalette.tsx`, `CustomTab.tsx`, `FleurDeLysLogo.tsx`, `MenuBar.tsx`, `MetroTimeline.tsx`, `ProjectWorkspace.tsx`, `RightSidebar.tsx`).
- `map/` ([map](./map/README.md)) - Interactive map canvas components: Leaflet/OpenLayers layers, route/annotation layers, toolbars, modals, overlays, and HUD (`ActiveRouteLayer.tsx`, `AnnotationModals.tsx`, `AnnotationsMapLayer.tsx`, `ControlToolbar.tsx`, `CursorPreviewLine.tsx`, `DrawAnnotationsLayer.tsx`, `ElevationProfileBar.tsx`, `FloatingSearch.tsx`, `FloatingToolbar.tsx`, `HelpModal.tsx`, `InactiveItinerariesLayer.tsx`, `InfoPills.tsx`, `InteractiveStages.tsx`, `LegendOverlay.tsx`, `MapComponent.tsx`, `MapHUD.tsx`, `MapSettings.tsx`, `MapSettingsModal.tsx`, `MapWorkspace.tsx`, `NotificationOverlay.tsx`, `RouteRubberbandLayer.tsx`, `TextAnnotationsLayer.tsx`, `Transformer.tsx`).
- `panels/` ([panels](./panels/README.md)) - Sidebar panels and modals for route editing, layer management, libraries, exports, preferences, themes, and cloud/auth (`AICopilotModal.tsx`, `AuthModal.tsx`, `CloudProjectsModal.tsx`, `CsvSettingsModal.tsx`, `DifficultyLibrary.tsx`, `DocAccessDeniedModal.tsx`, `ExportJobItem.tsx`, `ExportModal.tsx`, `ExportPanel.tsx`, `LayerManagerPanel.tsx`, `LeftSidebarPanel.tsx`, `LibraryBase.tsx`, `LibraryPanel.tsx`, `MapLibraryPanel.tsx`, `MarketplaceModal.tsx`, `ModuleEditorModal.tsx`, `PreferencesModal.tsx`, `PresetEditorModal.tsx`, `ProjectsDashboardModal.tsx`, `RoutePanel.tsx`, `ShareModal.tsx`, `ThemeEditorModal.tsx`, `ThemePanel.tsx`, `UnifiedResourceHub.tsx`).
- `textual/` ([textual](./textual/README.md)) - Rich textual carnet editor components: inline block editors, slash commands, context menu, minimap, cipher selectors, and markdown rendering (`AnnexeToggle.tsx`, `BlockGutter.tsx`, `CarnetElevationBlock.tsx`, `CarnetStepBlock.tsx`, `CodeBlockPicker.tsx`, `FontSelector.tsx`, `InlineEditor.tsx`, `MarkdownRenderer.tsx`, `MiniMap.tsx`, `SlashCommandPalette.tsx`, `StepInsertSeparator.tsx`, `StepSeparator.tsx`, `TextualHeader.tsx`, `TextualView.tsx`, `UnifiedContextMenu.tsx`, `WarningCard.tsx`, `WritingAids.tsx`).

## Design Tokens (`src/index.css`)
Components consume the dark technical CAD/SIG token system defined under `:root` in `src/index.css`:

- **Surfaces**: `--bg-base` / `--bg-app` (`#09090B`), `--bg-dark` / `--bg-panel` (`#121215`), `--bg-surface` (`#18181B`), `--bg-elevated` (`#1C1C21`), `--bg-hover` (`#27272A`), `--bg-active` (`#303036`).
- **Borders**: `--bg-border` / `--border-subtle` (`#27272A`), `--border-strong` (`#3F3F46`), `--border-focus` (`#52525B`).
- **Accents**:
  - Primary blue: `--accent-primary` / `--accent-default` (`#2563EB`), `--accent-primary-text` (`#FFFFFF`), `--accent-primary-hover` / `--accent-muted` / `--accent-pill` (`#1D4ED8`), `--accent-hover` (`#3B82F6`), `--accent-transparent` (`rgba(37, 99, 235, 0.12)`), `--accent-glow` (`transparent`).
  - Secondary amber: `--accent-secondary` (`#F59E0B`), `--accent-secondary-transparent` (`rgba(245, 158, 11, 0.10)`).
- **Semantic Statuses**:
  - Success: `--semantic-green` / `--semantic-success` (`#22C55E`), `--semantic-success-bg` (`rgba(34, 197, 94, 0.10)`).
  - Warning: `--semantic-orange` / `--semantic-warning` (`#F59E0B`), `--semantic-orange-bg` (`rgba(245, 158, 11, 0.10)`).
  - Danger: `--semantic-red` / `--semantic-danger` (`#EF4444`), `--semantic-danger-bg` (`rgba(239, 68, 68, 0.10)`).
- **Text & Contrast**: `--text-primary` (`#FAFAFA`), `--text-default` (`#D4D4D8`), `--text-muted` (`#A1A1AA`), `--text-dim` (`#71717A`).
- **Border Radii**: `--radius-xs` (`6px`), `--radius-sm` (`12px`), `--radius-md` / `--radius-main` (`18px`), `--radius-lg` (`22px`), `--radius-toolbar` (`16px`), `--radius-pill` (`9999px`).
- **Typography & Ciphers**: `--font-ui` (`'Plus Jakarta Sans', ...`), `--font-mono` (`'JetBrains Mono', ...`), `@font-face` cipher fonts (`Maritime`, `Morse`, `TemplarsCipherPlus`), and inline cipher selectors (`morse`/`.font-morse`/`[data-cipher="morse"]`, `templier`/`.font-templier`/`[data-cipher="templier"]`, `maritime`/`.font-maritime`/`[data-cipher="maritime"]`, `.font-mono-tag`/`[data-cipher="code"]`).
- **Elevation, Shadows & Motion**: `--glass-bg` (`#121215`), `--glass-border` (`#27272A`), `--shadow-glass`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow` (`none`), `--transition-fast` (`100ms ease`), plus safe-area insets (`--sat`, `--sab`, `--sal`, `--sar`).
- **Layout & Accessibility Rules**:
  - **Scrollable CSS Grids (`UnifiedResourceHub`, `ProjectsHomePage`)**: Always use `grid-auto-rows: max-content` (NEVER `grid-auto-rows: 1fr`) on height-constrained `overflow-y: auto` flex/grid containers, and avoid forcing `height: 100%` on grid card items. Using `1fr` inside a fixed-height scrollable container divides the viewport height across all rows and squishes cards into thin horizontal slivers.
  - **Modals & Overlays**: Use `src/components/common/Modal.tsx` (`role="dialog"`, `aria-modal="true"`, `Escape`, focus trap, `overscroll-behavior: contain`) and `ConfirmDialog.tsx` instead of `window.confirm()`.
