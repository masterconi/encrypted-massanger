/**
 * Nonce Tracker - Prevents Replay Attacks
 * 
 * Tracks used nonces within a time window to prevent handshake replay attacks.
 * Uses LRU-style eviction to bound memory usage.
 */

export interface NonceTrackerConfig {
  ttlMs?: number;
  maxSize?: number;
  cleanupIntervalMs?: number;
}

export class NonceTracker {
  private used: Map<string, number> = new Map();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: NonceTrackerConfig = {}) {
    this.ttlMs = config.ttlMs || 300000; // 5 minutes default
    this.maxSize = config.maxSize || 100000; // 100k nonces max
    
    if (config.cleanupIntervalMs !== 0) {
      const interval = config.cleanupIntervalMs || 60000;
      this.cleanupTimer = setInterval(() => this.cleanup(), interval);
    }
  }

  /**
   * Check if nonce is unique (not seen before or expired)
   * Returns true if nonce is valid and unique
   */
  check(nonce: Uint8Array): boolean {
    const key = this.nonceToKey(nonce);
    const existing = this.used.get(key);
    const now = Date.now();

    // If nonce exists and hasn't expired, it's a replay
    if (existing !== undefined && (now - existing) < this.ttlMs) {
      return false; // REPLAY DETECTED
    }

    // Enforce size limit (prevent memory exhaustion)
    if (this.used.size >= this.maxSize) {
      this.evictOldest();
    }

    // Mark nonce as used
    this.used.set(key, now);
    return true; // VALID UNIQUE NONCE
  }

  /**
   * Clean up expired nonces
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, timestamp] of this.used.entries()) {
      if ((now - timestamp) > this.ttlMs) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.used.delete(key);
    }
  }

  /**
   * Evict oldest entries when max size reached
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, timestamp] of this.used.entries()) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.used.delete(oldestKey);
    }
  }

  /**
   * Convert nonce to string key for Map
   */
  private nonceToKey(nonce: Uint8Array): string {
    return Array.from(nonce)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Get current size
   */
  get size(): number {
    return this.used.size;
  }

  /**
   * Clear all nonces and stop cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.used.clear();
  }
}
