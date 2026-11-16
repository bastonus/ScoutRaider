# ScoutRaider Backend

API backend pour l'application ScoutRaider - Éditeur de carnets de raid.

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
│   │   └── import_export.py # Import .srproj / migration .srdoc
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

# Garage S3
GARAGE_ENDPOINT=http://localhost:3900
GARAGE_PUBLIC_URL=http://localhost:3900
GARAGE_ACCESS_KEY=your_access_key
GARAGE_SECRET_KEY=your_secret_key
GARAGE_BUCKET=scoutraider-assets
GARAGE_REGION=garage
```

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

## API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion (retourne access + refresh tokens)
- `POST /api/auth/refresh` - Rafraîchir access token
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Profil utilisateur

### Documents
- `POST /api/documents` - Créer document
- `GET /api/documents` - Lister documents (pagination, recherche)
- `GET /api/documents/{id}` - Récupérer document complet
- `PUT /api/documents/{id}` - Mettre à jour (optimistic locking via If-Match)
- `DELETE /api/documents/{id}` - Supprimer (soft delete)
- `POST /api/documents/{id}/duplicate` - Dupliquer

### Assets
- `POST /api/assets?document_id=` - Upload asset (image/font)
- `GET /api/assets/{asset_id}` - Infos asset
- `GET /api/assets/{asset_id}/download` - Télécharger
- `GET /api/assets/{asset_id}/url?expiry=` - URL signée
- `DELETE /api/assets/{asset_id}` - Supprimer

### Export
- `POST /api/documents/{id}/export/pdf` - Export PDF (WeasyPrint)
- `GET /api/documents/{id}/export/srproj` - Export archive .srproj

### Partage
- `POST /api/documents/{id}/share` - Créer lien partage
- `GET /api/documents/{id}/share` - Lister liens
- `DELETE /api/documents/{id}/share/{token}` - Révoquer
- `GET /api/documents/shared/{token}` - Accès public via token

### Import
- `POST /api/documents/import` - Import .srproj
- `POST /api/documents/migrate-srdoc` - Migration .srdoc → .srproj

## Format .srproj

Archive ZIP contenant:
```
archive.srproj/
├── manifest.json          # DocumentV2 complet
└── assets/
    ├── fonts/             # Polices .woff2
    ├── images/            # Images .webp
    └── maps/              # Cartes (optionnel)
```

## Déploiement Coolify

### Services requis

1. **PostgreSQL 16** - Base de données
2. **Garage S3** - Stockage objets (déjà configuré: `s3-scoutraider.silverhorse.fr`)
3. **Backend API** - Container Docker

### Variables Coolify

```env
DB_USER=scoutraider
DB_PASS=secure_password
SECRET_KEY=generate_with_openssl_rand_base64_32
GARAGE_ACCESS_KEY=from_garage_admin
GARAGE_SECRET_KEY=from_garage_admin
GARAGE_ENDPOINT=https://s3-scoutraider.silverhorse.fr
GARAGE_PUBLIC_URL=https://s3-scoutraider.silverhorse.fr
CORS_ORIGINS=["https://scoutraider.app","https://app.scoutraider.app"]
```

### Commandes Coolify

```bash
# Build & Deploy
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d

# Migrations
docker compose -f docker-compose.yml run migrate

# Logs
docker compose -f docker-compose.yml logs -f backend
```

## Tests

```bash
# Lancer les tests
pytest tests/ -v

# Coverage
pytest tests/ --cov=app --cov-report=html
```

## Architecture des données

### DocumentV2 (manifest.json)

```json
{
  "schemaVersion": "2.0",
  "id": "uuid",
  "title": "Carnet de Raid",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z",
  "version": 1,
  "assets": {
    "fonts": [...],
    "images": {...}
  },
  "pageLayout": {...},
  "blocks": [...],
  "settings": {...}
}
```

### Blocs supportés

- `rich_text` - Texte riche (paragraphes, titres, images inline)
- `crypto_block` - Texte chiffré (Vigenère, Morse, Polybe, etc.)
- `map_snippet` - Extrait de carte statique
- `elevation_profile` - Profil altimétrique SVG
- `route_table` - Tableau récapitulatif itinéraire
- `annexe` - Tables de décodage
- `title_page` - Page de garde
- `page_break` - Saut de page

### Mécanisme locked / autoUpdate

- `locked: true` - Bloc généré automatiquement, protégé contre édition manuelle
- `autoUpdate: true` - Recalculé si `dependsOn` change
- `dependsOn: ["route_main", "segment_3"]` - IDs sources

## Sécurité

- JWT avec access token (7j) + refresh token (30j, cookie HttpOnly)
- Bcrypt pour hash mots de passe
- Optimistic locking sur documents (header If-Match)
- URLs signées pour assets (expiration configurable)
- CORS restrictif
- Rate limiting (100 req/min par défaut)

## Monitoring

- Health check: `GET /health`
- Logs structurés JSON (structlog)
- Métriques: durée requêtes, status codes, erreurs

## Licence

Propriétaire - ScoutRaider Suite