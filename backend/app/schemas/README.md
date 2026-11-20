# schemas

## Overview
Pydantic request and response schemas defining API data validation contracts.

## Interface
- `[auth.py] class UserBase`
- `[auth.py] class UserCreate`
- `[auth.py] class UserLogin`
- `[auth.py]   UserLogin.check_username_or_email()`
- `[auth.py] class RefreshRequest`
- `[auth.py] class UserResponse`
- `[auth.py] class Token`
- `[auth.py] class TokenPayload`
- `[document.py] class DocumentBase`
- `[document.py] class DocumentCreate`
- `[document.py] class DocumentUpdate`
- `[document.py] class DocumentResponse`
- `[document.py] class DocumentListItem`
- `[document.py] class AssetResponse`
- `[document.py] class AssetUploadResponse`
- `[document.py] class ExportOptions`
- `[document.py] class ShareLinkCreate`
- `[document.py] class ShareLinkResponse`

## Invariants
- [auth.py] Enforces: ValueError("Either username or email must be provided")

## Side Effects
- None

## Verification
- Run: `pytest tests/ -v`
