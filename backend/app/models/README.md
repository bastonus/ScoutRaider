# models

## Overview
SQLAlchemy ORM database models defining relational schema for users, documents, and assets.

## Interface
- `[document.py] def utc_now()`
- `[document.py] class JSONDict`
- `[document.py]   JSONDict.load_dialect_impl()`
- `[document.py]   JSONDict.process_bind_param()`
- `[document.py]   JSONDict.process_result_value()`
- `[document.py] class Document`
- `[document.py] class Asset`
- `[document.py] class ShareLink`
- `[user.py] def utc_now()`
- `[user.py] class User`

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `pytest tests/ -v`
