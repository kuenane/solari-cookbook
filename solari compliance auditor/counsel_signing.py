"""
Counsel signature verification for the override/sign-off flow.

Previously, a counsel override was just plaintext name/email/bar_number/
justification fields recorded into the hash-chained ledger. That's
tamper-evident against later edits to the ledger file, but it does not
verify that the named person actually submitted the override - anyone
could type any name into the form.

This module verifies a real ECDSA P-256 signature (generated client-side
via the browser's Web Crypto API - see src/utils/counselSigning.ts) over
the canonical override payload. What this DOES prove: whoever submitted
this override held the private key corresponding to the given public key,
and the payload has not been altered since it was signed. What this does
NOT prove: that the key belongs to the named person - key-to-identity
binding is on the person's own key custody, the same caveat that applies
to an unverified PGP/SSH key. This is documented explicitly rather than
implied away.
"""
import base64
import hashlib
from dataclasses import dataclass
from typing import Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature


def canonical_override_payload(
    contract_id: str, clause_id: str, verdict: str, counsel_name: str,
    counsel_email: str, bar_number: str, justification: str,
) -> bytes:
    """
    Must byte-for-byte match what the frontend signs (see
    src/utils/counselSigning.ts:buildCanonicalOverridePayload). Any
    mismatch here means every signature verification fails closed - which
    is the safe failure direction for a signature check.
    """
    import json
    payload = {
        "contractId": contract_id,
        "clauseId": clause_id,
        "verdict": verdict,
        "counselName": counsel_name,
        "counselEmail": counsel_email,
        "barNumber": bar_number,
        "justification": justification,
    }
    return json.dumps(payload, separators=(",", ":")).encode("utf-8")


def _raw_ecdsa_to_der(raw_sig: bytes) -> bytes:
    """
    Web Crypto's ECDSA signatures are raw IEEE P1363 format (r || s, each
    32 bytes for P-256) - not the DER encoding the `cryptography` library
    expects. Convert rather than requiring an extra JS dependency to do it
    client-side.
    """
    if len(raw_sig) != 64:
        raise ValueError(f"Expected 64-byte raw P-256 signature, got {len(raw_sig)} bytes")
    r = int.from_bytes(raw_sig[:32], "big")
    s = int.from_bytes(raw_sig[32:], "big")
    return encode_dss_signature(r, s)


@dataclass
class SignatureVerification:
    attempted: bool
    verified: bool
    public_key_fingerprint: Optional[str] = None
    reason: Optional[str] = None


def verify_counsel_signature(
    signature_b64: Optional[str],
    public_key_spki_b64: Optional[str],
    contract_id: str, clause_id: str, verdict: str,
    counsel_name: str, counsel_email: str, bar_number: str, justification: str,
) -> SignatureVerification:
    """
    Verifies an ECDSA P-256 signature over the canonical override payload.
    Fails closed: any missing field, malformed key, or verification
    failure returns verified=False with a reason - never silently treated
    as a pass.
    """
    if not signature_b64 or not public_key_spki_b64:
        return SignatureVerification(attempted=False, verified=False, reason="No signature submitted")

    try:
        public_key_der = base64.b64decode(public_key_spki_b64)
        public_key = serialization.load_der_public_key(public_key_der)
        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            return SignatureVerification(attempted=True, verified=False, reason="Public key is not an EC key")

        fingerprint = hashlib.sha256(public_key_der).hexdigest()[:16]
        signature_der = _raw_ecdsa_to_der(base64.b64decode(signature_b64))
        payload = canonical_override_payload(
            contract_id, clause_id, verdict, counsel_name, counsel_email, bar_number, justification
        )

        public_key.verify(signature_der, payload, ec.ECDSA(hashes.SHA256()))
        return SignatureVerification(attempted=True, verified=True, public_key_fingerprint=fingerprint)

    except InvalidSignature:
        return SignatureVerification(attempted=True, verified=False, reason="Signature does not match payload - tampered or wrong key")
    except Exception as e:
        return SignatureVerification(attempted=True, verified=False, reason=f"Verification error: {e}")
