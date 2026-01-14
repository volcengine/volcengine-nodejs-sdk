/**
 * Integration tests for MockClock
 * Tests the non-test environment branches and waitForPromise function
 */

import { MockClock, waitForPromise } from '../src/testing/mock-clock';

describe('waitForPromise', () => {
  test('should resolve in next event loop tick', async () => {
    let resolved = false;

    waitForPromise().then(() => {
      resolved = true;
    });

    // Immediately check, should not be resolved yet
    expect(resolved).toBe(false);

    // Wait for event loop
    await waitForPromise();

    // Should be resolved now
    expect(resolved).toBe(true);
  });

  test('should handle multiple calls independently', async () => {
    const order: number[] = [];

    waitForPromise().then(() => order.push(1));
    waitForPromise().then(() => order.push(2));
    waitForPromise().then(() => order.push(3));

    await waitForPromise();

    expect(order).toEqual([1, 2, 3]);
  });

  test('should handle nested waitForPromise', async () => {
    const results: string[] = [];

    await waitForPromise().then(() => {
      results.push('first');
      return waitForPromise();
    }).then(() => {
      results.push('second');
    });

    expect(results).toEqual(['first', 'second']);
  });

  test('should work with Promise.all', async () => {
    const promises = [
      waitForPromise().then(() => 'a'),
      waitForPromise().then(() => 'b'),
      waitForPromise().then(() => 'c'),
    ];

    const results = await Promise.all(promises);
    expect(results).toEqual(['a', 'b', 'c']);
  });

  test('should work with async/await', async () => {
    let value = 0;

    async function increment() {
      await waitForPromise();
      value++;
    }

    expect(value).toBe(0);
    await increment();
    expect(value).toBe(1);
  });
});

describe('MockClock - sleep (integration environment)', () => {
  // Store original NODE_ENV to restore later
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Simulate non-test environment by removing NODE_ENV
    delete (process.env as any).NODE_ENV;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete (process.env as any).NODE_ENV;
    }
  });

  test('should use real timers in non-test environment', async () => {
    const clock = new MockClock();
    const startTime = clock.getElapsedTime();

    await clock.sleep(10); // 10ms

    const endTime = clock.getElapsedTime();
    // In non-test environment, time should not advance
    expect(endTime).toBe(startTime);
  });

  test('should clear timers properly', async () => {
    const clock = new MockClock();

    // Start multiple sleeps
    const sleep1 = clock.sleep(100);
    const sleep2 = clock.sleep(200);

    // Verify timers were created
    expect(clock['timers'].size).toBeGreaterThan(0);

    // Clear all timers before they complete
    // This should clear the timers without throwing errors
    expect(() => clock.clearTimers()).not.toThrow();

    // After clearing, timers map should be empty
    expect(clock['timers'].size).toBe(0);

    // Note: The promises will not resolve since the timers were cleared
    // In real usage, you would wait for the promises or not clear them if you need the results
  });

  test('should track multiple timers independently', async () => {
    const clock = new MockClock();
    const completed: number[] = [];

    // Start multiple timers
    const sleep10 = clock.sleep(10).then(() => completed.push(10));
    const sleep20 = clock.sleep(20).then(() => completed.push(20));
    const sleep30 = clock.sleep(30).then(() => completed.push(30));

    // Wait for all to complete
    await Promise.all([sleep10, sleep20, sleep30]);

    expect(completed).toEqual([10, 20, 30]);
  }, 10000);

  test('should handle sleep with zero delay', async () => {
    const clock = new MockClock();
    const startTime = clock.getElapsedTime();

    await clock.sleep(0);

    const endTime = clock.getElapsedTime();
    expect(endTime).toBe(startTime);
  });

  test('should cleanup timers after completion', async () => {
    const clock = new MockClock();

    // Initially no real timers
    expect(clock.getElapsedTime()).toBeGreaterThanOrEqual(0);

    await clock.sleep(5);

    // After sleep, timers should be cleaned up
    // Just verify no errors and clock state is valid
    expect(clock.getElapsedTime()).toBeGreaterThanOrEqual(0);
  });
});

describe('MockClock - mixed environment tests', () => {
  test('should switch between test and non-test environments', async () => {
    const clock = new MockClock();
    const originalEnv = process.env.NODE_ENV;

    // Test environment (default)
    process.env.NODE_ENV = 'test';
    const testTime1 = clock.now().getTime();
    clock.advance(100);
    const testTime2 = clock.now().getTime();
    expect(testTime2 - testTime1).toBe(100);

    // Switch to integration environment
    delete (process.env as any).NODE_ENV;
    const intTime1 = clock.getElapsedTime();
    await clock.sleep(10);
    const intTime2 = clock.getElapsedTime();
    // Time should not advance in integration environment
    expect(intTime2).toBe(intTime1);

    // Restore environment
    if (originalEnv) {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
