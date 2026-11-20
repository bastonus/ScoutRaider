# versions

## Overview
Database schema migration revisions managed by Alembic for PostgreSQL.

## Interface
- `[001_initial.py] def upgrade()`
- `[001_initial.py] def downgrade()`

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `pytest tests/ -v`
