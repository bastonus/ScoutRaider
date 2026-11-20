# services

## Overview
Business logic services managing authentication, S3 assets, PDF compilation, and project archives.

## Interface
- `[archive.py] class ArchiveService`
- `[archive.py]   ArchiveService.create_srproj()`
- `[archive.py]   ArchiveService.extract_srproj()`
- `[archive.py]   ArchiveService.validate_srproj()`
- `[auth.py] def verify_password()`
- `[auth.py] def get_password_hash()`
- `[auth.py] def create_access_token()`
- `[auth.py] def create_refresh_token()`
- `[auth.py] def decode_token()`
- `[auth.py] def get_user_by_email()`
- `[auth.py] def get_user_by_username()`
- `[auth.py] def get_user_by_id()`
- `[auth.py] def authenticate_user()`
- `[auth.py] def create_user()`
- `[auth.py] def update_last_login()`
- `[image_processor.py] def optimize_image()`
- `[image_processor.py] def create_thumbnail()`
- `[image_processor.py] def get_image_info()`
- `[image_processor.py] def validate_image()`
- `[pdf_generator.py] class PDFGenerator`
- `[pdf_generator.py]   PDFGenerator.__init__()`
- `[pdf_generator.py]   PDFGenerator.generate_pdf()`
- `[pdf_generator.py]   PDFGenerator.generate_pdf_to_file()`
- `[pdf_generator.py] def generate_pdf_from_html()`
- `[s3_client.py] class GarageClient`
- *(and 7 more exported symbols)*

## Invariants
- [archive.py] Enforces: ValueError(f"manifest.json invalide: {e}")
- [archive.py] Enforces: ValueError("manifest.json introuvable dans l'archive")
- [auth.py] Enforces: ValueError("Le mot de passe ne peut pas contenir de caractère nul")
- [s3_client.py] Enforces: FileNotFoundError(f"Asset {asset_id} not found")

## Side Effects
- Database state mutations (commit/execute)
- Filesystem operations (file read/write)
- Network / HTTP / S3 external requests

## Verification
- Run: `pytest tests/ -v`
