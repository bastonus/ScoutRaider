# alembic

## Overview
Alembic environment configuration and migration runner for PostgreSQL schema evolution.

## Interface
- `[env.py] def run_migrations_offline()`
- `[env.py] def do_run_migrations()`
- `[env.py] def run_async_migrations()`

### Subdirectories
- [versions](./versions/README.md) - Database schema migration revisions managed by Alembic for PostgreSQL.

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `pytest tests/ -v`
