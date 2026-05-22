/**
 * Generates RS256 JWT key pair for NirmalMandi auth service.
 * Run once: node scripts/generate-keys.js
 * Paste output into your .env file.
 */
const { generateKeyPairSync } = require('crypto');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const privB64 = Buffer.from(privateKey).toString('base64');
const pubB64  = Buffer.from(publicKey).toString('base64');

console.log('\n=== COPY THESE INTO YOUR .env FILE ===\n');
console.log(`JWT_PRIVATE_KEY=${privB64}`);
console.log(`\nJWT_PUBLIC_KEY=${pubB64}`);
console.log('\n======================================\n');
