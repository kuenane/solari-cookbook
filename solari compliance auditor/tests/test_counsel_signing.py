"""
Tests for counsel_signing.py. Regression coverage for the original gap:
counsel overrides had no way to prove who submitted them - just plaintext
name/bar-number fields anyone could type in. These tests generate a real
ECDSA P-256 keypair (mirroring what the browser does via Web Crypto in
src/utils/counselSigning.ts), sign a payload the same way, and confirm the
server-side verifier accepts a genuine signature and rejects a tampered one.
"""
import base64
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from counsel_signing import canonical_override_payload, verify_counsel_signature


FIELDS = dict(
    contract_id="contract-001", clause_id="clause-001", verdict="baseline_met",
    counsel_name="Test Counsel", counsel_email="counsel@example.com",
    bar_number="TEST-BAR-001", justification="Explicit encryption-at-rest covenant added in redline v2.",
)


def _generate_keypair_and_sign(fields: dict):
    """Mirrors the browser: generate P-256 key, sign canonical payload, export raw r||s + SPKI DER."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    payload = canonical_override_payload(**fields)
    der_signature = private_key.sign(payload, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_signature)
    raw_signature = r.to_bytes(32, "big") + s.to_bytes(32, "big")

    spki_der = public_key.public_bytes(
        encoding=serialization.Encoding.DER, format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return (
        base64.b64encode(raw_signature).decode(),
        base64.b64encode(spki_der).decode(),
    )


def test_valid_signature_verifies():
    signature_b64, public_key_b64 = _generate_keypair_and_sign(FIELDS)
    result = verify_counsel_signature(signature_b64, public_key_b64, **FIELDS)
    assert result.attempted is True
    assert result.verified is True
    assert result.public_key_fingerprint is not None
    assert len(result.public_key_fingerprint) == 16


def test_tampered_payload_after_signing_fails_verification():
    """
    The exact scenario a signature exists to catch: sign one justification,
    then submit a different one. Must fail closed, not silently pass.
    """
    signature_b64, public_key_b64 = _generate_keypair_and_sign(FIELDS)
    tampered_fields = {**FIELDS, "justification": "Completely different, unsigned text."}
    result = verify_counsel_signature(signature_b64, public_key_b64, **tampered_fields)
    assert result.verified is False
    assert result.attempted is True


def test_wrong_public_key_fails_verification():
    """Signature from key A must not verify against key B's public key."""
    signature_b64, _ = _generate_keypair_and_sign(FIELDS)
    _, other_public_key_b64 = _generate_keypair_and_sign(FIELDS)
    result = verify_counsel_signature(signature_b64, other_public_key_b64, **FIELDS)
    assert result.verified is False


def test_no_signature_is_not_attempted_not_a_false_pass():
    """
    Missing signature must report attempted=False, verified=False - never
    silently treated as verified=True just because nothing was submitted.
    """
    result = verify_counsel_signature(None, None, **FIELDS)
    assert result.attempted is False
    assert result.verified is False


def test_malformed_public_key_fails_closed():
    signature_b64, _ = _generate_keypair_and_sign(FIELDS)
    result = verify_counsel_signature(signature_b64, "not-valid-base64-der-key", **FIELDS)
    assert result.attempted is True
    assert result.verified is False
