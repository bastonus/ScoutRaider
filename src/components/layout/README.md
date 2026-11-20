# layout

## Overview
Application shell layout components: window menu bar, tabs, command palette, and sidebars.

## Interface
- `[ChromeTabs.tsx] function ChromeTabs()`
- `[CommandPalette.tsx] function CommandPalette()`
- `[CommandPalette.tsx] interface CommandPaletteProps`
- `[CustomTab.tsx] function TabRenderer()`
- `[FleurDeLysLogo.tsx] function FleurDeLysLogo()`
- `[MenuBar.tsx] function MenuBar()`
- `[MetroTimeline.tsx] function MetroTimeline()`
- `[MetroTimeline.tsx] const MODULE_DRAG_TYPE`
- `[ProjectWorkspace.tsx] function ProjectWorkspace()`
- `[RightSidebar.tsx] function RightSidebar()`
- `[RightSidebar.tsx] type SectionId`

## Invariants
- None

## Side Effects
- DOM / browser window side effects
- IPC calls via window.electronAPI

## Verification
- Run: `npm run build`
