/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const SALT_SIZE = 8;
const IV_SIZE = 12;
const AUTH_TAG_SIZE = 16;

function deriveKey(key, salt) {
  return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');
}

/**
 * Provides an AES-GCM symmetric encryption using a key derivation from a generic password.
 * The resulting string is a base64 encoded buffer of the salt, iv, auth and encrypted text.
 * Using GCM has the advantage over plain AES, that the validity of the key can be verified.
 * (similar to a AES + HMAC approach).
 *
 * result = base64( salt | iv | auth | enc )
 *
 * @param {string} key encryption key / password
 * @param {string} text Plain text to encrypt
 * @return {string} base64 encoded digest.
 */
function encrypt(key, text) {
  const salt = crypto.randomBytes(SALT_SIZE);
  const iv = crypto.randomBytes(IV_SIZE);
  const derivedKey = deriveKey(key, salt);
  const cipher = crypto.createCipheriv(ALGO, derivedKey, iv);

  const data = [salt, iv, null];
  data.push(cipher.update(text, 'utf8'));
  data.push(cipher.final());
  data[2] = cipher.getAuthTag();
  return Buffer.concat(data).toString('base64');
}

/**
 * Decrypts a AES-GCM encrypted digest.
 * @param {string} key encryption key / password
 * @param {string} digest the encrypted text
 * @returns {string} the plain text
 * @throws an error if the given key cannot decrypt the digest.
 */
function decrypt(key, digest) {
  const data = Buffer.from(digest, 'base64');
  const salt = data.slice(0, SALT_SIZE);
  const iv = data.slice(SALT_SIZE, SALT_SIZE + IV_SIZE);
  const authTag = data.slice(SALT_SIZE + IV_SIZE, SALT_SIZE + IV_SIZE + AUTH_TAG_SIZE);
  const enc = data.slice(SALT_SIZE + IV_SIZE + AUTH_TAG_SIZE);

  const derivedKey = deriveKey(key, salt);
  const decipher = crypto.createDecipheriv(ALGO, derivedKey, iv);
  decipher.setAuthTag(authTag);

  let str = decipher.update(enc, null, 'utf8');
  str += decipher.final('utf8');
  return str;
}

/**
 * Returns the first valid credentials from the given mountpoint or null.
 * @param {logger} log a logger
 * @param {MountPoint} mp a fstab mountpoint
 * @param {string} key encryption key
 * @returns {object} the credentials object or null.
 */
function getCredentials(log, mp, key) {
  let { credentials = [] } = mp;
  if (!Array.isArray(credentials)) {
    credentials = [credentials];
  }
  for (let i = 0; i < credentials.length; i += 1) {
    const text = credentials[i];
    if (text) {
      try {
        return JSON.parse(decrypt(key, text, log));
      } catch (e) {
        log.warn(`decrypted credentials in ${mp.path}.credentials[${i}] not valid: ${e.message}.`);
      }
    }
  }
  return null;
}

module.exports = {
  encrypt,
  decrypt,
  getCredentials,
};
