/**
 * Mock Clock for testing
 * Controls time for testing time-dependent logic
 */

import { Clock } from "../types/clock";

/**
 * Test helper: Wait for a promise to resolve
 */
export function waitForPromise() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Timer for mock clock
 */
interface MockTimer {
  id: number;
  callback: () => void;
  delay: number;
  startTime: number;
}

/**
 * Mock Clock implementation for testing
 */
export class MockClock implements Clock {
  private currentTime: Date;
  private initialTime: Date;
  private timers: Map<number, NodeJS.Timeout> = new Map();
  private mockTimers: MockTimer[] = [];
  private nextTimerId = 1;

  constructor(initialTime?: Date) {
    this.initialTime = initialTime || new Date("2024-01-01T00:00:00.000Z");
    this.currentTime = new Date(this.initialTime);
  }

  /**
   * Set current time
   */
  setTime(date: Date): void {
    this.currentTime = date;
  }

  /**
   * Advance time by ms milliseconds and trigger any timers that have expired
   */
  advance(ms: number): void {
    const startTime = this.currentTime.getTime();
    const endTime = startTime + ms;

    // Set new time
    this.currentTime = new Date(endTime);

    // Find timers that should fire, sort by their scheduled time
    const timersToFire = this.mockTimers
      .filter((timer) => startTime + timer.delay <= endTime)
      .sort((a, b) => a.startTime + a.delay - (b.startTime + b.delay));

    // Execute timers
    for (const timer of timersToFire) {
      const index = this.mockTimers.indexOf(timer);
      if (index > -1) {
        this.mockTimers.splice(index, 1);
        timer.callback();
      }
    }
  }

  /**
   * Set a timer that will execute after ms milliseconds
   * This is a mock version of setTimeout that respects the mock clock
   */
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout {
    const timer: MockTimer = {
      id: this.nextTimerId++,
      callback,
      delay: ms,
      startTime: this.currentTime.getTime(),
    };
    this.mockTimers.push(timer);
    // Return a fake NodeJS.Timeout object
    return timer.id as unknown as NodeJS.Timeout;
  }

  /**
   * Clear a mock timer
   */
  clearTimeout(id: NodeJS.Timeout | number): void {
    const timerId = typeof id === "object" ? (id as any) : id;
    const index = this.mockTimers.findIndex((timer) => timer.id === timerId);
    if (index > -1) {
      this.mockTimers.splice(index, 1);
    }
  }

  /**
   * Get current time
   */
  now(): Date {
    return new Date(this.currentTime);
  }

  /**
   * Sleep for ms milliseconds
   * In test environment, advances time instead of real waiting
   */
  async sleep(ms: number): Promise<void> {
    // In test environment, advance time instead of real waiting
    if (process.env.NODE_ENV === "test") {
      this.advance(ms);
      // Still return a promise to ensure async execution
      return new Promise((resolve) => setImmediate(resolve));
    }

    // For integration tests, use real timer but still track it
    return new Promise((resolve) => {
      const timerId = this.nextTimerId++;
      const timeout = setTimeout(() => {
        this.timers.delete(timerId);
        resolve();
      }, ms);
      this.timers.set(timerId, timeout);
    });
  }

  /**
   * Clear all timers
   */
  clearTimers(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Get elapsed time since start
   */
  getElapsedTime(): number {
    return (
      this.currentTime.getTime() -
      (this.initialTime?.getTime() ||
        new Date("2024-01-01T00:00:00.000Z").getTime())
    );
  }
}
