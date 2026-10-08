/* web-only: DME storage delegation layer — IS_WEB guards make all functions no-ops on native */
import {IS_WEB} from '#/env'

/**
 * localStorage key prefix for per-DID DME storage.
 * Full key format: `dme-storage:${did}`
 */
const STORAGE_KEY_PREFIX = 'dme-storage:'

function storageKey(did: string): string {
  return `${STORAGE_KEY_PREFIX}${did}`
}

/**
 * Load all stored key-value pairs for the given DID.
 * Returns an empty object on native, on read failure, or when no data exists.
 */
export function loadDmeStorage(did: string): Record<string, string> {
  if (!IS_WEB) return {}
  try {
    const raw = localStorage.getItem(storageKey(did))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * Set a single key-value pair for the given DID.
 * Reads the existing blob, updates the key, and writes back.
 * No-op on native.
 */
export function setDmeStorageItem(did: string, key: string, value: string): void {
  if (!IS_WEB) return
  try {
    const blob = loadDmeStorage(did)
    blob[key] = value
    localStorage.setItem(storageKey(did), JSON.stringify(blob))
  } catch {
    // Silently ignore — privacy mode or Safari may block localStorage
  }
}

/**
 * Remove a single key for the given DID.
 * If the blob becomes empty after removal, the entire entry is removed from localStorage.
 * No-op on native.
 */
export function removeDmeStorageItem(did: string, key: string): void {
  if (!IS_WEB) return
  try {
    const blob = loadDmeStorage(did)
    delete blob[key]
    if (Object.keys(blob).length === 0) {
      localStorage.removeItem(storageKey(did))
    } else {
      localStorage.setItem(storageKey(did), JSON.stringify(blob))
    }
  } catch {
    // Silently ignore
  }
}

/**
 * Clear all stored data for the given DID.
 * No-op on native.
 */
export function clearDmeStorage(did: string): void {
  if (!IS_WEB) return
  try {
    localStorage.removeItem(storageKey(did))
  } catch {
    // Silently ignore
  }
}

/**
 * Clear all DME storage entries across all accounts.
 * Iterates localStorage and removes all keys starting with the DME storage prefix.
 * No-op on native.
 */
export function clearAllDmeStorage(): void {
  if (!IS_WEB) return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch {
    // Silently ignore
  }
}
