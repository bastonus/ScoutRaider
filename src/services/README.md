# services

## Overview
Frontend client services interfacing with REST APIs, cloud storage, and AI assistants.

## Interface
- `[api.ts] function checkBackendHealth()`
- `[api.ts] interface AuthTokens`
- `[api.ts] interface UserProfile`
- `[api.ts] interface AssetUploadResponse`
- `[api.ts] interface DocumentListItem`
- `[api.ts] interface DocumentCreate`
- `[api.ts] interface ExportOptions`
- `[api.ts] interface ShareToken`
- `[api.ts] const authApi`
- `[api.ts] const assetsApi`
- `[api.ts] const documentsApi`
- `[api.ts] const exportApi`
- `[api.ts] const importApi`
- `[api.ts] const shareApi`
- `[cloudSync.ts] function useCloudSync()`
- `[cloudSync.ts] class CloudSyncService`
- `[cloudSync.ts] const cloudSync`
- `[localDB.ts] function saveDocumentLocal()`
- `[localDB.ts] function getDocumentLocal()`
- `[localDB.ts] function getAllDocumentsLocal()`
- `[localDB.ts] function deleteDocumentLocal()`
- `[localDB.ts] function markDocumentSynced()`
- `[localDB.ts] function markDocumentDirty()`
- `[localDB.ts] function cacheAsset()`
- `[localDB.ts] function getCachedAsset()`
- *(and 33 more exported symbols)*

## Invariants
- [api.ts] Requires: !(!response.ok)
- [api.ts] Requires: !(!refresh)
- [cloudSync.ts] Requires: !(!state.cloud_project_id)
- [syncService.ts] Requires: !(!blob)

## Side Effects
- Browser storage access (localStorage)
- DOM / browser window side effects
- Network HTTP API calls (fetch/axios)

## Verification
- Run: `npm run build`
