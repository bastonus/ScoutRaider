"""
test_auth_password.py — Tests de non-regression sur l'authentification.

Contexte : passlib 1.7.4 est incompatible avec bcrypt >= 4.1. Son auto-test de
backend hashe un mot de passe de 255 octets pour detecter le wraparound bug, et
bcrypt >= 4.1 leve "ValueError: password cannot be longer than 72 bytes" au lieu
de tronquer silencieusement -> l'echec survenait au premier hash/verify
(inscription ET connexion en erreur 500).

Ces tests verrouillent le comportement attendu avec la lib `bcrypt` directe.
"""

import os
import sys
import uuid
from datetime import timedelta

# Permet d'executer ce fichier seul : pytest backend/app/tests/test_auth_password.py
sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
)

from app.services.auth import (  # noqa: E402
    BCRYPT_MAX_PASSWORD_BYTES,
    BCRYPT_ROUNDS,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)


def test_hash_is_bcrypt_with_expected_rounds():
    hashed = get_password_hash("motdepasse123")
    assert hashed.startswith(f"$2b${BCRYPT_ROUNDS}$")


def test_hash_and_verify_roundtrip():
    hashed = get_password_hash("motdepasse123")
    assert verify_password("motdepasse123", hashed) is True


def test_verify_rejects_wrong_password():
    hashed = get_password_hash("motdepasse123")
    assert verify_password("mauvaisMotDePasse", hashed) is False


def test_hashes_are_salted():
    assert get_password_hash("motdepasse123") != get_password_hash("motdepasse123")


def test_verify_with_invalid_hash_returns_false():
    assert verify_password("motdepasse123", "pas-un-hash") is False
    assert verify_password("motdepasse123", "") is False


def test_long_password_is_truncated_consistently():
    """Au-dela de 72 octets, bcrypt tronque : le hash et la verification doivent rester coherents."""
    long_password = "a" * 120
    hashed = get_password_hash(long_password)
    assert verify_password(long_password, hashed) is True
    assert verify_password(long_password[:BCRYPT_MAX_PASSWORD_BYTES], hashed) is True
    assert verify_password("b" * 120, hashed) is False


def test_password_with_null_byte_is_rejected():
    try:
        get_password_hash("abcdefghi\x00jkl")
    except ValueError:
        return
    raise AssertionError("Un mot de passe contenant un NUL doit etre refuse")


def test_access_and_refresh_tokens_are_decodable():
    user_id = uuid.uuid4()
    access = create_access_token(user_id, expires_delta=timedelta(minutes=5))
    refresh = create_refresh_token(user_id)

    access_payload = decode_token(access)
    refresh_payload = decode_token(refresh)

    assert access_payload is not None and access_payload.type == "access"
    assert refresh_payload is not None and refresh_payload.type == "refresh"
    assert access_payload.sub == user_id
    assert refresh_payload.sub == user_id


def test_expired_token_is_not_decodable():
    token = create_access_token(uuid.uuid4(), expires_delta=timedelta(seconds=-10))
    assert decode_token(token) is None
