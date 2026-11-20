# backend

## Overview
ScoutRaider asynchronous FastAPI backend providing cloud persistence, REST API, and document compilation.

## Stack

- **FastAPI** - Framework API moderne, rapide, avec support async
- **PostgreSQL 16** - Base de données relationnelle
- **SQLAlchemy 2.0** - ORM async
- **Alembic** - Migrations de base de données
- **Garage S3** - Stockage objets compatible S3 (auto-hébergé sur Coolify)
- **WeasyPrint** - Génération PDF depuis HTML
- **Pillow** - Traitement d'images (optimisation WebP)
- **Pydantic v2** - Validation de données

## Structure

```
backend/
├── app/
│   ├── main.py              # Point d'entrée FastAPI
│   ├── config.py            # Configuration Pydantic Settings
│   ├── database.py          # Connexion DB + sessions
│   ├── models/              # Modèles SQLAlchemy
│   ├── schemas/             # Schémas Pydantic (API)
│   ├── api/                 # Routes FastAPI
│   │   ├── auth.py          # Auth (register, login, JWT)
│   │   ├── documents.py     # CRUD documents
│   │   ├── assets.py        # Upload/download assets
│   │   ├── export.py        # Export PDF / .srproj
│   │   ├── share.py         # Partage documents
│   │   ├── import_export.py # Import .srproj / migration .srdoc
│   │   ├── projects.py      # Alias et partage projets
│   │   └── hub.py           # Hub v2 : catalogue, validation, dépendances, cartes
│   ├── modules/             # Registre modulaire v2, sandboxing, extraction sécurisée ZIP
│   ├── mcp/                 # Serveur Model Context Protocol (Agent-First)
│   ├── diffraction/         # Solveur probabiliste CSP d'affectation de modules
│   └── services/
│       ├── auth.py          # Service authentification
│       ├── s3_client.py     # Client Garage S3
│       ├── image_processor.py # Optimisation images
│       ├── pdf_generator.py # Génération PDF WeasyPrint
│       └── archive.py       # Archives .srproj (ZIP)
├── alembic/                 # Migrations DB
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

## Développement local

### Prérequis

- Python 3.12+
- PostgreSQL 16
- Garage S3 (ou MinIO pour dev local)

### Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configuration
cp .env.example .env
# Éditer .env avec vos valeurs

# Base de données
alembic upgrade head

# Démarrer
uvicorn app.main:app --reload --port 8000
```

### Variables d'environnement (.env)

```env
# Database
DB_USER=scoutraider
DB_PASS=your_secure_password
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASS}@localhost:5432/scoutraider

# JWT
SECRET_KEY=your-32-char-min-secret-key
ALGORITHM=HS256

# Garage S3 (Local MinIO/Garage ou distant Coolify)
GARAGE_ENDPOINT=https://s3-scoutraider.silverhorse.fr
GARAGE_PUBLIC_URL=https://s3-scoutraider.silverhorse.fr
GARAGE_ACCESS_KEY=your_access_key
GARAGE_SECRET_KEY=your_secret_key
GARAGE_BUCKET=scoutraider-assets
GARAGE_REGION=garage
```

> **Note Production (Coolify)** : En production, l'endpoint public et interne est `https://s3-scoutraider.silverhorse.fr` avec addressing style `path`. La connectivité S3 peut être vérifiée instantanément via la route `/health/s3`.

### Garage S3 local (MinIO compatible)

```bash
docker run -d --name garage \
  -e GARAGE_ACCESS_KEY=testkey \
  -e GARAGE_SECRET_KEY=testsecret \
  -e GARAGE_REGION=garage \
  -p 3900:3900 \
  -v garage_data:/data \
  -v garage_meta:/meta \
  garage:latest
```

## Interface
- `None` (configuration / migration files only)

### Subdirectories
- [alembic](./alembic/README.md) - Alembic environment configuration and migration runner for PostgreSQL schema evolution.
- [app](./app/README.md) - FastAPI core application setup, dependency injection, and middleware orchestration.

## Invariants
- None

## Side Effects
- Filesystem operations (file read/write)

## Verification
- Run: `pytest tests/ -v`
