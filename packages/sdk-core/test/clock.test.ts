import { RealClock } from "../src/types/clock";
import { MockClock } from "../src/testing/mock-clock";

describe("Clock", () => {
  describe("RealClock", () => {
    test("should return current time", () => {
      const clock = new RealClock();
      const now = clock.now();
      expect(now).toBeInstanceOf(Date);
    });

    test("should sleep for specified duration", async () => {
      const clock = new RealClock();
      const start = Date.now();
      await clock.sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90);
      expect(end - start).toBeLessThan(150);
    });
  });

  describe("MockClock", () => {
    test("should create with default time", () => {
      const clock = new MockClock();
      const now = clock.now();
      expect(now).toBeInstanceOf(Date);
    });

    test("should create with custom initial time", () => {
      const initialTime = new Date("2024-01-01T12:00:00.000Z");
      const clock = new MockClock(initialTime);
      expect(clock.now()).toEqual(initialTime);
    });

    test("should get current time", () => {
      const clock = new MockClock(new Date("2024-01-01T12:00:00.000Z"));
      let now = clock.now();
      expect(now.toISOString()).toBe("2024-01-01T12:00:00.000Z");

      clock.advance(1000);
      now = clock.now();
      expect(now.toISOString()).toBe("2024-01-01T12:00:01.000Z");
    });

    test("should advance time by milliseconds", () => {
      const clock = new MockClock(new Date("2024-01-01T12:00:00.000Z"));
      clock.advance(1000);
      expect(clock.now().getTime()).toBe(
        new Date("2024-01-01T12:00:01.000Z").getTime()
      );

      clock.advance(5000);
      expect(clock.now().getTime()).toBe(
        new Date("2024-01-01T12:00:06.000Z").getTime()
      );
    });

    test("should set time", () => {
      const clock = new MockClock(new Date("2024-01-01T12:00:00.000Z"));
      const newTime = new Date("2024-12-31T23:59:59.000Z");
      clock.setTime(newTime);
      expect(clock.now()).toEqual(newTime);
    });

    test("should sleep without real delay in test mode", async () => {
      const clock = new MockClock(new Date("2024-01-01T12:00:00.000Z"));
      const startTime = clock.now();

      await clock.sleep(1000);

      const endTime = clock.now();
      expect(endTime.getTime() - startTime.getTime()).toBe(1000);
      expect(clock.getElapsedTime()).toBe(1000);
    });

    test("should track elapsed time", () => {
      const clock = new MockClock(new Date("2024-01-01T00:00:00.000Z"));
      expect(clock.getElapsedTime()).toBe(0);

      clock.advance(1000);
      expect(clock.getElapsedTime()).toBe(1000);

      clock.advance(5000);
      expect(clock.getElapsedTime()).toBe(6000);
    });

    test("should clear timers", () => {
      const clock = new MockClock();
      clock.clearTimers();
      expect(() => clock.clearTimers()).not.toThrow();
    });

    test("should handle multiple sleep calls without real waiting", async () => {
      const clock = new MockClock(new Date("2024-01-01T12:00:00.000Z"));

      const startTime = clock.now();
      await clock.sleep(500);
      await clock.sleep(1000);
      await clock.sleep(2500);

      expect(clock.getElapsedTime()).toBe(4000);
      expect(clock.now().getTime() - startTime.getTime()).toBe(4000);
    });

    test("should not actually wait in test mode", async () => {
      const clock = new MockClock();
      const start = Date.now();

      await clock.sleep(10000);

      const end = Date.now();
      expect(end - start).toBeLessThan(100); // Should be nearly instant
      expect(clock.getElapsedTime()).toBe(10000); // Clock advanced
    });
  });
});
