/**
 * Encrypt data using AES-GCM with Web Crypto API
 * @param data - Plain text to encrypt
 * @param secret - 32-byte hex string secret key
 * @returns Base64 encoded string (IV + ciphertext)
 */
export async function encrypt(data: string, secret: string): Promise<string> {
  // Convert hex secret to ArrayBuffer
  const keyData = hexToArrayBuffer(secret);
  
  // Import key for AES-GCM
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encode data to UTF-8
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Return as base64
  return arrayBufferToBase64(combined);
}

/**
 * Decrypt data using AES-GCM with Web Crypto API
 * @param encryptedData - Base64 encoded string (IV + ciphertext)
 * @param secret - 32-byte hex string secret key
 * @returns Decrypted plain text
 */
export async function decrypt(encryptedData: string, secret: string): Promise<string> {
  // Convert hex secret to ArrayBuffer
  const keyData = hexToArrayBuffer(secret);

  // Import key for AES-GCM
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decode base64
  const combined = base64ToArrayBuffer(encryptedData);

  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  // Decode UTF-8
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Helper functions
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
