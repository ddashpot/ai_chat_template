// 暗号化（難読化ではない）。
// 既定(auto): 非抽出(extractable:false)の AES-GCM 鍵を IndexedDB に保存して自動解錠。
// 任意(passphrase): PBKDF2 でパスフレーズから鍵を導出（鍵は保存しない）。
const KEY_DB = "chatapp-crypto";
const KEY_STORE = "keys";
const KEY_ID = "vaultKey";
const enc = new TextEncoder();
const dec = new TextDecoder();

function openKeyDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(KEY_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly").objectStore(store).get(key);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = () => reject(tx.error);
  });
}

function idbPut(db, store, key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite").objectStore(store).put(val, key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// auto モード: 端末に束縛された非抽出鍵を取得（なければ生成）。
export async function getAutoKey() {
  const db = await openKeyDB();
  let key = await idbGet(db, KEY_STORE, KEY_ID);
  if (!key) {
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await idbPut(db, KEY_STORE, KEY_ID, key); // CryptoKey は構造化複製で IDB に保存できる
  }
  return key;
}

// passphrase モード: PBKDF2 で鍵を導出（鍵は保存しない）。salt は vault メタに平文保存で可。
export async function deriveKey(passphrase, saltB64) {
  const salt = saltB64 ? b64ToBuf(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
  return { key, salt: bufToB64(salt) };
}

export async function encryptJSON(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { v: 1, iv: bufToB64(iv), ct: bufToB64(new Uint8Array(ct)) };
}

export async function decryptJSON(envelope, key) {
  const iv = b64ToBuf(envelope.iv);
  const ct = b64ToBuf(envelope.ct);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(dec.decode(plain));
}

function bufToB64(buf) {
  let s = ""; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64); const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
