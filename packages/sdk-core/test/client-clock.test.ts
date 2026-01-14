import { Client } from "../src/index";
import { MockClock } from "../src/testing/mock-clock";

describe("Client with MockClock", () => {
  test("should use mock clock", async () => {
    // Arrange
    const mockClock = new MockClock();
    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      clock: mockClock,
    });

    // Act
    const startTime = mockClock.now();
    await mockClock.sleep(1000);
    const endTime = mockClock.now();

    // Assert
    expect(endTime.getTime() - startTime.getTime()).toBe(1000);
    expect(mockClock.getElapsedTime()).toBe(1000);
  });

  test("clock can advance time", async () => {
    // Arrange
    const mockClock = new MockClock();

    // Act
    await mockClock.sleep(500);
    await mockClock.sleep(1000);

    // Assert
    expect(mockClock.getElapsedTime()).toBe(1500);
  });
});
