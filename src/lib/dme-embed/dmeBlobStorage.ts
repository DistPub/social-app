/* web-only: DME file-byte (blob) delegation layer — IS_WEB guards make all functions no-ops on native */
import {IS_WEB} from '#/env'

/**
 * IndexedDB database + object store for per-DID DME file-byte storage.
 *
 * This is fatesky's FIRST-PARTY IndexedDB, so it survives the Safari ITP /
 * storage-partition eviction that wipes the embed iframe's own third-party
 * IndexedDB (`dme-file-cache`). File bytes (images / voice / video) are too
 * large and binary for the localStorage-backed `STORAGE_*` KV channel, so they
 * live here instead.
 */
const DB_NAME = 'dme-blob-storage'
const STORE_NAME = 'blobs'

/**
 * Full key format: `dme-blob:${did}:${fileId}`.
 * The DID prefix guarantees per-account isolation — account A can NEVER read
 * account B's bytes, even though they share one database.
 */
function blobKey(did: string, fileId: string): string {
  return `dme-blob:${did}:${fileId}`
}

type BlobRecord = {
  value: string // base64 file bytes
  mimeType: string
}

// Lazily opened + cached. On native (`!IS_WEB`) it is never created because
// the guarded functions below never call `openDb()`.
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function store(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

/**
 * Persist a file's bytes for the given DID. No-op on native.
 */
export async function setDmeBlob(
  did: string,
  fileId: string,
  value: string,
  mimeType: string,
): Promise<void> {
  if (!IS_WEB) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const req = store(db, 'readwrite').put(
        {value, mimeType},
        blobKey(did, fileId),
      )
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Silently ignore — private mode, quota, or IndexedDB unavailable.
  }
}

/**
 * Load a file's bytes for the given DID. Returns null when not found, on
 * native, or on any read error.
 */
export async function getDmeBlob(
  did: string,
  fileId: string,
): Promise<{value: string; mimeType: string} | null> {
  if (!IS_WEB) return null
  try {
    const db = await openDb()
    const record = await new Promise<BlobRecord | undefined>(
      (resolve, reject) => {
        const req = store(db, 'readonly').get(blobKey(did, fileId))
        req.onsuccess = () => resolve(req.result as BlobRecord | undefined)
        req.onerror = () => reject(req.error)
      },
    )
    if (!record) return null
    return {value: record.value, mimeType: record.mimeType}
  } catch {
    return null
  }
}

/**
 * Delete a single file's bytes for the given DID. No-op on native.
 */
export async function removeDmeBlob(
  did: string,
  fileId: string,
): Promise<void> {
  if (!IS_WEB) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const req = store(db, 'readwrite').delete(blobKey(did, fileId))
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Silently ignore.
  }
}

/**
 * Delete ALL file bytes for the given DID. Owned by fatesky (e.g. on account
 * removal); the embed never forces this. No-op on native.
 */
export async function clearDmeBlobs(did: string): Promise<void> {
  if (!IS_WEB) return
  try {
    const db = await openDb()
    const prefix = `dme-blob:${did}:`
    await new Promise<void>((resolve, reject) => {
      const req = store(db, 'readwrite').openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) {
          resolve()
          return
        }
        const key = cursor.key
        if (typeof key === 'string' && key.startsWith(prefix)) {
          cursor.delete()
        }
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Silently ignore.
  }
}
