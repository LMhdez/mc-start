// Desencripta resultados privados no navegador para manter PBKDF2 fora do CPU budget do Worker.
(function attachPrivateStatusCrypto(global) {
  "use strict";

  function decodeBase64(value) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Invalid encrypted status envelope");
    }
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  async function decryptPrivateStatus(envelope, password) {
    if (!envelope || typeof envelope !== "object" ||
        typeof password !== "string" || password.length === 0) {
      throw new Error("Invalid encrypted status input");
    }

    const salt = decodeBase64(envelope.salt);
    const iv = decodeBase64(envelope.iv);
    const data = decodeBase64(envelope.data);
    if (salt.length !== 16 || iv.length !== 12 || data.length < 16) {
      throw new Error("Invalid encrypted status envelope");
    }

    const material = await global.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    const key = await global.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    const clear = await global.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    return JSON.parse(new TextDecoder().decode(clear));
  }

  global.decryptPrivateStatus = decryptPrivateStatus;
})(globalThis);
