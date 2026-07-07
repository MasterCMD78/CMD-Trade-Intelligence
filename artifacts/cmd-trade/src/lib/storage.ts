/**
 * Safe localStorage wrapper.
 *
 * `localStorage` can throw a SecurityError in sandboxed iframe contexts
 * (e.g. some Replit preview configurations) or when the user has blocked
 * storage access.  All access goes through these helpers so that a storage
 * failure degrades gracefully (unauthenticated session) rather than crashing
 * the React tree.
 */

function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// Checked once at module load; result is cached.
const _available = isStorageAvailable();

export const storage = {
  available: _available,

  get(key: string): string | null {
    if (!_available) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  set(key: string, value: string): void {
    if (!_available) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Quota exceeded or security error — silently discard.
    }
  },

  remove(key: string): void {
    if (!_available) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently discard.
    }
  },

  clear(...keys: string[]): void {
    for (const key of keys) this.remove(key);
  },
};
