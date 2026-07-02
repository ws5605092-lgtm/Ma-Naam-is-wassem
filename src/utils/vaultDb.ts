import { VaultFile, VaultFolder, SecurityLog } from '../types';

// Storage key for salt
const SALT_KEY = 'calc_vault_salt';
const ITERATIONS = 10000;

/**
 * Gets or creates a unique salt for PBKDF2 key derivation.
 * Saved in localStorage.
 */
function getOrCreateSalt(): Uint8Array {
  let saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    saltStr = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(SALT_KEY, saltStr);
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(saltStr.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Derives a CryptoKey from a user PIN using PBKDF2 and AES-GCM.
 */
export async function deriveKeyFromPin(pin: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  const salt = getOrCreateSalt();

  // Import raw pin bytes
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  // Derive AES-GCM 256-bit key
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an ArrayBuffer with AES-GCM using the derived CryptoKey.
 * Returns the encrypted ArrayBuffer and Hex IV.
 */
export async function encryptBuffer(buffer: ArrayBuffer, key: CryptoKey): Promise<{ encryptedData: ArrayBuffer; ivHex: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    buffer
  );

  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  return {
    encryptedData: encrypted,
    ivHex
  };
}

/**
 * Decrypts an encrypted ArrayBuffer using AES-GCM and the derived CryptoKey.
 */
export async function decryptBuffer(encryptedBuffer: ArrayBuffer, key: CryptoKey, ivHex: string): Promise<ArrayBuffer> {
  const iv = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    iv[i] = parseInt(ivHex.slice(i * 2, i * 2 + 2), 16);
  }

  return window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encryptedBuffer
  );
}

/**
 * Simple SHA-256 hashing for password/PIN verification.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- IndexedDB Management ---

const DB_NAME = 'CalculatorVaultDB';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id' });
      }
    };
  });
}

// --- DB Operations ---

export async function saveFile(file: VaultFile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore(transaction.objectStoreNames[0]);
    const request = store.put(file);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getFiles(folderId?: string): Promise<VaultFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readonly');
    const store = transaction.objectStore('files');
    const request = store.getAll();

    request.onsuccess = () => {
      let files = request.result as VaultFile[];
      if (folderId) {
        files = files.filter(f => f.folderId === folderId);
      }
      resolve(files);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function moveFile(id: string, folderId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const file = getReq.result as VaultFile;
      if (file) {
        file.folderId = folderId;
        const putReq = store.put(file);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        reject(new Error('File not found'));
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getFolders(): Promise<VaultFolder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('folders', 'readonly');
    const store = transaction.objectStore('folders');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as VaultFolder[]);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFolder(folder: VaultFolder): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('folders', 'readwrite');
    const store = transaction.objectStore('folders');
    const request = store.put(folder);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await openDB();
  
  // First, move all files in this folder to 'root'
  const files = await getFiles();
  const filesInFolder = files.filter(f => f.folderId === id);
  
  const movePromises = filesInFolder.map(f => moveFile(f.id, 'root'));
  await Promise.all(movePromises);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('folders', 'readwrite');
    const store = transaction.objectStore('folders');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getLogs(): Promise<SecurityLog[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('logs', 'readonly');
    const store = transaction.objectStore('logs');
    const request = store.getAll();

    request.onsuccess = () => {
      const logs = request.result as SecurityLog[];
      // Sort newest first
      logs.sort((a, b) => b.timestamp - a.timestamp);
      resolve(logs);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addLog(log: Omit<SecurityLog, 'id'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('logs', 'readwrite');
    const store = transaction.objectStore('logs');
    const newLog: SecurityLog = {
      ...log,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    };
    const request = store.put(newLog);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllData(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['files', 'folders', 'logs'], 'readwrite');
    
    const filesStore = transaction.objectStore('files');
    const foldersStore = transaction.objectStore('folders');
    const logsStore = transaction.objectStore('logs');

    filesStore.clear();
    foldersStore.clear();
    logsStore.clear();

    transaction.oncomplete = () => {
      localStorage.removeItem(SALT_KEY);
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}
