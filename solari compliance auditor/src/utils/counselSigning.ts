/**
 * Phase fix: counsel overrides used to be plaintext name/email/bar_number
 * fields with nothing proving who actually submitted them - anyone could
 * type any name into the form. This generates a real ECDSA P-256 keypair
 * in the browser (Web Crypto API), signs the override payload, and sends
 * the signature + public key to the backend, which independently
 * recomputes and verifies it (see counsel_signing.py) rather than trusting
 * a client-asserted claim.
 *
 * What this proves: whoever submitted the override held the private key
 * for the given public key, and the payload hasn't been altered since
 * signing. What it does NOT prove: that the key belongs to the named
 * person - key-to-identity binding is the same self-asserted trust model
 * as an unverified PGP/SSH key, not a certified digital identity. That
 * limitation is real and should stay visible in the UI, not implied away.
 */

const STORAGE_KEY = 'solari_counsel_signing_keypair_jwk_v1';

interface StoredKeypairJwk {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

/**
 * Gets the browser's persistent counsel-signing keypair, generating one on
 * first use. Stored in localStorage as exportable JWK - this is a
 * convenience/demo-scope choice (a real deployment might use a hardware
 * key or non-extractable key + server-side registration instead). Anyone
 * with access to this browser's localStorage can sign as this key; treat
 * it like any other locally-stored credential.
 */
async function getOrCreateKeypair(): Promise<CryptoKeyPair> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed: StoredKeypairJwk = JSON.parse(stored);
      const publicKey = await crypto.subtle.importKey(
        'jwk', parsed.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']
      );
      const privateKey = await crypto.subtle.importKey(
        'jwk', parsed.privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']
      );
      return { publicKey, privateKey };
    } catch {
      // Fall through to regenerate if the stored key is corrupt.
    }
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
  );
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ publicKey: publicKeyJwk, privateKey: privateKeyJwk }));
  return keyPair;
}

async function exportPublicKeySpkiBase64(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

/**
 * Must byte-for-byte match counsel_signing.py:canonical_override_payload -
 * same key order, same compact (no-whitespace) JSON serialization. Any
 * drift between the two means every signature fails verification (fails
 * closed, which is the safe direction, but it's still worth keeping these
 * two in sync deliberately rather than by accident).
 */
function buildCanonicalOverridePayload(fields: {
  contractId: string; clauseId: string; verdict: string;
  counselName: string; counselEmail: string; barNumber: string; justification: string;
}): string {
  return JSON.stringify({
    contractId: fields.contractId,
    clauseId: fields.clauseId,
    verdict: fields.verdict,
    counselName: fields.counselName,
    counselEmail: fields.counselEmail,
    barNumber: fields.barNumber,
    justification: fields.justification,
  });
}

export interface SignedOverride {
  signature: string;   // base64, raw IEEE P1363 (r||s) format - server converts to DER
  publicKey: string;   // base64 SPKI DER
}

/**
 * Signs an override payload with this browser's counsel-signing key,
 * generating one on first use. Returns the signature and public key to
 * attach to the override request.
 */
export async function signOverride(fields: {
  contractId: string; clauseId: string; verdict: string;
  counselName: string; counselEmail: string; barNumber: string; justification: string;
}): Promise<SignedOverride> {
  const keyPair = await getOrCreateKeypair();
  const canonical = buildCanonicalOverridePayload(fields);
  const data = new TextEncoder().encode(canonical);

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, data
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  const publicKey = await exportPublicKeySpkiBase64(keyPair.publicKey);

  return { signature, publicKey };
}

/** SHA-256 fingerprint of this browser's current public signing key, for display ("Signing as key abc123..."). */
export async function getSigningKeyFingerprint(): Promise<string> {
  const keyPair = await getOrCreateKeypair();
  const spkiBase64 = await exportPublicKeySpkiBase64(keyPair.publicKey);
  const bytes = Uint8Array.from(atob(spkiBase64), (c) => c.charCodeAt(0));
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
