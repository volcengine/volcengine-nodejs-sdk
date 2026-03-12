/**
 * Circuit breaker with slow-start strategy.
 *
 * After reset(durationMs):
 * - No requests allowed during the cooldown period
 * - After cooldown: allow 1, then 2, 4, 8... requests (exponential)
 * - After 10s past cooldown: allow all
 */
export class Breaker {
  private allowTime: number; // timestamp (ms)
  private waiters = new Map<string, number>(); // id → index
  private nextIndex = 0;

  constructor() {
    this.allowTime = Date.now();
  }

  /**
   * Check if a request with given waitIndex is allowed through.
   */
  private allow(waitIndex: number): boolean {
    const elapsed = (Date.now() - this.allowTime) / 1000;
    if (elapsed <= 0) return false;
    if (elapsed > 10) return true;
    return waitIndex < Math.pow(2, elapsed);
  }

  private getAllowedDelayMs(): number {
    const delay = this.allowTime - Date.now();
    return delay < 1000 ? 1000 : delay;
  }

  /**
   * Reset the breaker — block all requests for `durationMs`.
   */
  reset(durationMs: number): void {
    this.allowTime = Date.now() + durationMs;
  }

  /**
   * Wait until the breaker allows this request through.
   */
  async wait(): Promise<void> {
    const id = String(this.nextIndex++);
    const idx = this.waiters.size;
    this.waiters.set(id, idx);

    try {
      while (!this.allow(idx)) {
        await new Promise((r) => setTimeout(r, this.getAllowedDelayMs()));
      }
    } finally {
      this.waiters.delete(id);
    }
  }
}
