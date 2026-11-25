# src

## Overview
Frontend React TypeScript single-page application core source tree.

## Interface
- `[App.tsx] type ViewMode`
- `[App.tsx] type SectionId`
- `[AppContext.tsx] function buildAreaDisplayCoords()`
- `[AppContext.tsx] function useApp()`
- `[AppContext.tsx] type AppAction`
- `[AppContext.tsx] const AppContext`
- `[AppContext.tsx] const AppProvider`
- `[AuthContext.tsx] function AuthProvider()`
- `[AuthContext.tsx] function useAuth()`
- `[AuthContext.tsx] interface AccessDeniedInfo`
- `[AuthContext.tsx] type CloudSyncStatus`
- `[AuthContext.tsx] type DocumentRole`
- `[RouterRoot.tsx] function RouterRoot()`

### Subdirectories
- [components](./components/README.md) - React UI component library structured into layout, map canvas, panels, and textual editor.
- `context/` - Specialized React contexts (`index.ts` barrel export) provided by `AppProvider` in `AppContext.tsx`:
  - `RoutesContext` (`RoutesContext.tsx`) - `RoutesContext`, `RoutesContextValue`, `useRoutes()` for routes, stages, itineraries, and polygonalization state.
  - `AnnotationsContext` (`AnnotationsContext.tsx`) - `AnnotationsContext`, `AnnotationsContextValue`, `useAnnotations()` for annotation layers, point/area/draw/text annotations, and layer ordering.
  - `CarnetContext` (`CarnetContext.tsx`) - `CarnetContext`, `CarnetContextValue`, `useCarnet()` for carnet steps, carnet view settings, annexes, custom assignments/languages, and segment POIs.
  - `UIContext` (`UIContext.tsx`) - `UIContext`, `UIContextValue`, `useUI()` for active mode/tool, document metadata, theme/preset, map/API settings, notifications, and cloud sync status.
- `hooks/` - Domain hook barrel export (`index.ts`) re-exporting `useRoutes`, `useAnnotations`, `useCarnet`, and `useUI` from `../context/`.
- [logic](./logic/README.md) - Frontend business logic engines: routing, polygonization, state management, and export rendering.
- [modules](./modules/README.md) - Feature module extensions providing specialized raid puzzles and tools.
- [pages](./pages/README.md) - Top-level application view pages and route entry points.
- [services](./services/README.md) - Frontend client services interfacing with REST APIs, cloud storage, and AI assistants.
- [types](./types/README.md) - TypeScript type declarations and shared data schemas across the frontend.

## Invariants
- `useRoutes()`, `useAnnotations()`, `useCarnet()`, and `useUI()` must be called within `AppProvider` (which wraps `RoutesContext.Provider`, `AnnotationsContext.Provider`, `CarnetContext.Provider`, and `UIContext.Provider`).

## Side Effects
- Browser storage access (localStorage)
- DOM / browser window side effects
- IPC calls via window.electronAPI

## Verification
- Typecheck: `npm run typecheck` (`tsc --noEmit`)
- Unit tests: `npm test` (`vitest run`)
- Production bundle: `npm run build` (`vite build`)
