# logic

## Overview
Frontend business logic engines: routing, polygonization, state management, and export rendering.

## Interface
- `[AIService.ts] class AIService`
- `[AIService.ts] interface AIConfig`
- `[AIService.ts] interface StagePayload`
- `[AIService.ts] interface NarrativeResponse`
- `[AIService.ts] interface RiddleResponse`
- `[AIService.ts] interface SafetyAlert`
- `[AIService.ts] interface SafetyAuditResponse`
- `[AIService.ts] interface ConnectorInfo`
- `[BackgroundEngine.ts] function clearRouteCache()`
- `[BackgroundEngine.ts] function invalidateRouteCacheForLeg()`
- `[BackgroundEngine.ts] class BackgroundEngine`
- `[BackgroundEngine.ts] const backgroundEngine`
- `[CarnetEngine.ts] class CarnetEngine`
- `[CloudAuthService.ts] function generateDocId()`
- `[CloudAuthService.ts] class AccessDeniedError`
- `[CloudAuthService.ts] class CloudAuthService`
- `[CloudAuthService.ts] interface UserProfile`
- `[CloudAuthService.ts] interface CloudProjectSummary`
- `[CloudAuthService.ts] interface Collaborator`
- `[CloudAuthService.ts] interface ProjectAccessRequest`
- `[CloudAuthService.ts] interface ProjectSharingDetails`
- `[CloudAuthService.ts] interface MarketplaceModule`
- `[CloudAuthService.ts] interface UserLibraryItem`
- `[ConstraintChecker.ts] class ConstraintChecker`
- `[ElevationService.ts] class ElevationService`
- *(and 131 more exported symbols)*

## Invariants
- [AIService.ts] Requires: !(!res.ok)
- [CloudAuthService.ts] Requires: !(!res.ok)
- [ElevationService.ts] Requires: !(!resp.ok)
- [IGNClient.ts] Requires: !(!response.ok)

## Side Effects
- Browser storage access (localStorage)
- DOM / browser window side effects
- IPC calls via window.electronAPI
- Network HTTP API calls (fetch/axios)

## Verification
- Run: `npm run build`
