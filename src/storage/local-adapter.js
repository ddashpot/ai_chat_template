import { StorageAdapter } from "./storage-interface.js";

const DB = "chatapp-data";
const STORE = "vault";
const KEY = "main";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class LocalAdapter extends StorageAdapter {
  async load() {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      tx.onsuccess = () => resolve(tx.result || null);
      tx.onerror = () => reject(tx.error);
    });
  }
  async save(envelope) {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(envelope, KEY);
      tx.onsuccess = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async clear() {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite").objectStore(STORE).delete(KEY);
      tx.onsuccess = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  meta() { return { kind: "local", label: "ローカル (IndexedDB)" }; }
}
