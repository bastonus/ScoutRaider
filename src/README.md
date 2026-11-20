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
- [logic](./logic/README.md) - Frontend business logic engines: routing, polygonization, state management, and export rendering.
- [modules](./modules/README.md) - Feature module extensions providing specialized raid puzzles and tools.
- [pages](./pages/README.md) - Top-level application view pages and route entry points.
- [services](./services/README.md) - Frontend client services interfacing with REST APIs, cloud storage, and AI assistants.
- [types](./types/README.md) - TypeScript type declarations and shared data schemas across the frontend.

## Invariants
- None

## Side Effects
- Browser storage access (localStorage)
- DOM / browser window side effects
- IPC calls via window.electronAPI

## Verification
- Run: `npm run build`
