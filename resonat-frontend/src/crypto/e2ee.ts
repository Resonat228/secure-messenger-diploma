// src/crypto/e2ee.ts
import _sodium from "libsodium-wrappers";

let sodiumReady: Promise<typeof _sodium> | null = null;

async function getSodium() {
  if (!sodiumReady) {
    sodiumReady = (async () => {
      await _sodium.ready;
      return _sodium;
    })();
  }
  return sodiumReady;
}



const LOCAL_STORAGE_KEY = "resonat_private_key";

export async function getOrCreateUserKeyPair() {
  const sodium = await getSodium();

  
  const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (existing) {
    const sk = sodium.from_base64(existing, sodium.base64_variants.ORIGINAL);
    const pk = sodium.crypto_scalarmult_base(sk);
    return { pk, sk };
  }

  
  const sk = sodium.randombytes_buf(sodium.crypto_scalarmult_SCALARBYTES);
  const pk = sodium.crypto_scalarmult_base(sk);

  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    sodium.to_base64(sk, sodium.base64_variants.ORIGINAL)
  );

  return { pk, sk };
}

export function keyToBase64(key: Uint8Array): string {
  return _sodium.to_base64(key, _sodium.base64_variants.ORIGINAL);
}

export function keyFromBase64(b64: string): Uint8Array {
  return _sodium.from_base64(b64, _sodium.base64_variants.ORIGINAL);
}



export async function deriveSharedKey(
  mySecretKeyB64: string,
  otherPublicKeyB64: string
): Promise<string> {
  const sodium = await getSodium();

  const mySk = keyFromBase64(mySecretKeyB64);
  const otherPk = keyFromBase64(otherPublicKeyB64);

  const shared = sodium.crypto_scalarmult(mySk, otherPk); 

  
  const key = sodium.crypto_generichash(
    sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
    shared
  );

  return keyToBase64(key); 
}

 

export async function encryptMessage(
  sharedKeyB64: string,
  plaintext: string
): Promise<{ ciphertext: string; nonce: string }> {
  const sodium = await getSodium();

  const key = keyFromBase64(sharedKeyB64);
  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
  );
  const cipher = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null,
    null,
    nonce,
    key
  );

  return {
    ciphertext: sodium.to_base64(
      cipher,
      sodium.base64_variants.URLSAFE_NO_PADDING
    ),
    nonce: sodium.to_base64(
      nonce,
      sodium.base64_variants.URLSAFE_NO_PADDING
    ),
  };
}

export async function decryptMessage(
  sharedKeyB64: string,
  ciphertextB64: string,
  nonceB64: string
): Promise<string | null> {
  const sodium = await getSodium();
  const key = keyFromBase64(sharedKeyB64);

  try {
    const cipher = sodium.from_base64(
      ciphertextB64,
      sodium.base64_variants.URLSAFE_NO_PADDING
    );
    const nonce = sodium.from_base64(
      nonceB64,
      sodium.base64_variants.URLSAFE_NO_PADDING
    );

    const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      cipher,
      null,
      nonce,
      key
    );

    return sodium.to_string(plain);
  } catch {
    return null;
  }
}
