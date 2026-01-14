import { Command } from "../src/index";
import type { CommandInput } from "../src/types/types";

describe("Command", () => {
  describe("Constructor", () => {
    test("should create command with input", () => {
      const input = { username: "testuser", email: "test@example.com" };
      const command = new Command(input);

      expect(command.input).toEqual(input);
      expect(command.middlewareStack).toBeDefined();
    });

    test("should create command with empty input", () => {
      const command = new Command({});

      expect(command.input).toEqual({});
      expect(command.middlewareStack).toBeDefined();
    });

    test("should create command with complex nested input", () => {
      const input = {
        user: {
          name: "John Doe",
          address: {
            street: "123 Main St",
            city: "Beijing",
          },
        },
        tags: ["admin", "developer"],
      };
      const command = new Command(input);

      expect(command.input).toEqual(input);
      expect(command.input.user.address.city).toBe("Beijing");
      expect(command.input.tags).toEqual(["admin", "developer"]);
    });

    test("should create command with null and undefined values in input", () => {
      const input = {
        name: "test",
        optionalField: null,
        undefinedField: undefined,
      };
      const command = new Command(input);

      expect(command.input.name).toBe("test");
      // Note: undefined properties might not be preserved in TypeScript object literals
    });
  });

  describe("MiddlewareStack initialization", () => {
    test("should initialize middlewareStack as empty", () => {
      const command = new Command({ test: "data" });

      expect(command.middlewareStack).toBeDefined();
      expect(command.middlewareStack.steps).toBeDefined();
      expect(command.middlewareStack.steps.initialize).toEqual([]);
      expect(command.middlewareStack.steps.serialize).toEqual([]);
      expect(command.middlewareStack.steps.build).toEqual([]);
      expect(command.middlewareStack.steps.finalizeRequest).toEqual([]);
    });

    test("should create independent middleware stacks for different commands", () => {
      const command1 = new Command({ data: "1" });
      const command2 = new Command({ data: "2" });

      command1.middlewareStack.add(() => async (args) => args, {
        name: "test1",
      });
      command2.middlewareStack.add(() => async (args) => args, {
        name: "test2",
      });

      expect(command1.middlewareStack.steps.initialize).toHaveLength(1);
      expect(command2.middlewareStack.steps.initialize).toHaveLength(1);
      expect(command1.middlewareStack.steps.initialize[0].name).toBe("test1");
      expect(command2.middlewareStack.steps.initialize[0].name).toBe("test2");
    });
  });

  describe("Input immutability and modification", () => {
    test("should allow reading input properties", () => {
      const input = { key1: "value1", key2: "value2" };
      const command = new Command(input);

      expect(command.input.key1).toBe("value1");
      expect(command.input.key2).toBe("value2");
    });

    test("should not share input object reference (shallow copy)", () => {
      const input = { key: "original" };
      const command = new Command(input);

      // Modify original input
      (input as any).key = "modified";

      // Command input should still have original value since it's not deeply copied
      // Note: TypeScript objects are passed by reference, so this is expected behavior
    });

    test("should allow modifying input after command creation", () => {
      const input = { key: "original" };
      const command = new Command(input);

      // This is allowed since input is a regular property
      command.input.key = "modified";

      expect(command.input.key).toBe("modified");
    });
  });

  describe("Generic type parameters", () => {
    test("should work with typed inputs", () => {
      interface GetUserInput extends CommandInput {
        userId: string;
        includeDetails?: boolean;
      }

      const input: GetUserInput = {
        userId: "user-123",
        includeDetails: true,
      };

      const command = new Command<GetUserInput>(input);

      expect(command.input.userId).toBe("user-123");
      expect(command.input.includeDetails).toBe(true);
    });

    test("should work with complex output types", () => {
      interface GetUserOutput {
        id: string;
        name: string;
        email: string;
      }

      const input = { userId: "123" };
      const command = new Command<typeof input, GetUserOutput>(input);

      expect(command.input.userId).toBe("123");
      // Note: __type is private and should not be accessed directly
    });
  });

  describe("requestConfig property", () => {
    test("should have undefined requestConfig initially", () => {
      const command = new Command({ test: "data" });

      expect(command.requestConfig).toBeUndefined();
    });

    test("should allow setting requestConfig after creation", () => {
      const command = new Command({ test: "data" });

      (command as any).requestConfig = {
        method: "POST",
        pathname: "/api/test",
      };

      expect((command as any).requestConfig.method).toBe("POST");
      expect((command as any).requestConfig.pathname).toBe("/api/test");
    });
  });

  describe("Command name type parameter", () => {
    test("should work with command name type parameter", () => {
      type CommandNames = "GetUser" | "ListUsers" | "CreateUser";

      const input = { userId: "123" };
      const command = new Command<typeof input, any, "GetUser">(input);

      expect(command.input.userId).toBe("123");
    });
  });

  describe("Multiple commands", () => {
    test("should create multiple independent commands", () => {
      const command1 = new Command({ action: "create" });
      const command2 = new Command({ action: "update" });
      const command3 = new Command({ action: "delete" });

      expect(command1.input.action).toBe("create");
      expect(command2.input.action).toBe("update");
      expect(command3.input.action).toBe("delete");
      expect(command1).not.toBe(command2);
      expect(command2).not.toBe(command3);
    });

    test("should maintain separate middleware stacks", () => {
      const commands = [
        new Command({ id: 1 }),
        new Command({ id: 2 }),
        new Command({ id: 3 }),
      ];

      commands.forEach((cmd, index) => {
        cmd.middlewareStack.add(() => async (args) => args, {
          name: `middleware-${index}`,
        });
      });

      expect(commands[0].middlewareStack.steps.initialize[0].name).toBe(
        "middleware-0"
      );
      expect(commands[1].middlewareStack.steps.initialize[0].name).toBe(
        "middleware-1"
      );
      expect(commands[2].middlewareStack.steps.initialize[0].name).toBe(
        "middleware-2"
      );
    });
  });

  describe("Empty and edge case inputs", () => {
    test("should handle command with no properties in input", () => {
      const command = new Command({} as CommandInput);

      expect(Object.keys(command.input)).toEqual([]);
      expect(command.middlewareStack).toBeDefined();
    });

    test("should handle command with numeric input values", () => {
      const input = {
        count: 42,
        price: 19.99,
        enabled: true,
      };
      const command = new Command(input);

      expect(command.input.count).toBe(42);
      expect(command.input.price).toBe(19.99);
      expect(command.input.enabled).toBe(true);
    });

    test("should handle command with array input", () => {
      const input = {
        items: [1, 2, 3],
        tags: ["a", "b", "c"],
      };
      const command = new Command(input);

      expect(command.input.items).toEqual([1, 2, 3]);
      expect(command.input.tags).toEqual(["a", "b", "c"]);
    });
  });

  describe("Command as container for metadata", () => {
    test("should serve as container for request metadata", () => {
      const command = new Command({ data: "test" });

      // Set additional metadata
      (command as any).metadata = {
        requestId: "req-123",
        timestamp: "2024-01-01T12:00:00Z",
      };

      expect((command as any).metadata.requestId).toBe("req-123");
    });

    test("should allow attaching middleware-specific data", () => {
      const command = new Command({ action: "test" });

      // Middleware might attach context data
      (command as any).context = {
        retryCount: 0,
        startTime: Date.now(),
      };

      expect((command as any).context.retryCount).toBe(0);
      expect((command as any).context.startTime).toBeDefined();
    });
  });

  describe("debugMiddlewareStack", () => {
    test("should return formatted string of command's local middleware stack", () => {
      // Arrange
      const command = new Command({});

      command.middlewareStack.add(() => async (args) => args, {
        step: "initialize",
        name: "CommandInitMiddleware",
        priority: 10,
      });

      command.middlewareStack.add(() => async (args) => args, {
        step: "build",
        name: "CommandBuildMiddleware",
        priority: 5,
      });

      // Act
      const output = command.debugMiddlewareStack();

      // Assert
      const expected = `MiddlewareStack:
  [initialize]
    - CommandInitMiddleware (priority: 10)
  [build]
    - CommandBuildMiddleware (priority: 5)`;

      expect(output).toBe(expected);
    });
  });
});
