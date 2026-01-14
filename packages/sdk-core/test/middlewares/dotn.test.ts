import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { dotNMiddleware } from "../../src/middlewares/dotn";
import { Args, MiddlewareContext } from "../../src/middlewares/types";

describe("dotNMiddleware", () => {
  const next = jest.fn();
  const context: MiddlewareContext = {
    clientName: "TestClient",
    commandName: "TestCommand",
    clientConfig: {},
  } as MiddlewareContext;

  beforeEach(() => {
    next.mockReset();
    next.mockImplementation(async (args: any) => {
      return { ...args, response: {} };
    });
  });

  it("should flatten params for GET request", async () => {
    const args: Args = {
      input: {},
      request: {
        method: "GET",
        params: {
          Filter: {
            Name: "instance-id",
            Values: ["i-123", "i-456"],
          },
          PageNumber: 1,
        },
        headers: {},
        pathname: "/",
      },
    };

    await dotNMiddleware.middleware(next as any, context)(args);

    const request = (next.mock.calls[0][0] as Args).request;
    expect(request.params).toEqual({
      "Filter.Name": "instance-id",
      "Filter.Values.1": "i-123",
      "Filter.Values.2": "i-456",
      PageNumber: 1,
    });
  });

  it("should flatten body for POST form-urlencoded request", async () => {
    const args: Args = {
      input: {},
      request: {
        method: "POST",
        headers: {},
        pathname: "/",
        body: {
          Complex: {
            A: 1,
            B: 2,
          },
          Simple: 3,
        },
      },
    };

    // Set content type in context
    const postContext = {
      ...context,
      contentType: "application/x-www-form-urlencoded",
    };

    await dotNMiddleware.middleware(next as any, postContext)(args);

    const request = (next.mock.calls[0][0] as Args).request;
    expect(request.body).toEqual({
      "Complex.A": 1,
      "Complex.B": 2,
      Simple: 3,
    });
  });

  it("should NOT flatten body for POST JSON request", async () => {
    const args: Args = {
      input: {},
      request: {
        method: "POST",
        headers: {},
        pathname: "/",
        body: {
          Complex: { A: 1 },
        },
      },
    };

    // Content type is JSON
    const jsonContext = {
      ...context,
      contentType: "application/json",
    };

    await dotNMiddleware.middleware(next as any, jsonContext)(args);

    const request = (next.mock.calls[0][0] as Args).request;
    // Body should remain unchanged
    expect(request.body).toEqual({
      Complex: { A: 1 },
    });
  });

  it("should handle nested arrays and objects correctly", async () => {
    const args: Args = {
      input: {},
      request: {
        method: "GET",
        params: {
          List: [
            { Id: 1, Tags: ["a", "b"] },
            { Id: 2, Config: { Enabled: true } },
          ],
        },
        headers: {},
        pathname: "/",
      },
    };

    await dotNMiddleware.middleware(next as any, context)(args);

    const request = (next.mock.calls[0][0] as Args).request;
    expect(request.params).toEqual({
      "List.1.Id": 1,
      "List.1.Tags.1": "a",
      "List.1.Tags.2": "b",
      "List.2.Id": 2,
      "List.2.Config.Enabled": true,
    });
  });

  it("should handle null and undefined values gracefully", async () => {
    const args: Args = {
      input: {},
      request: {
        method: "GET",
        params: {
          NullVal: null,
          UndefinedVal: undefined, // undefined might be ignored or treated as value depending on implementation
          Simple: "value",
        },
        headers: {},
        pathname: "/",
      },
    };

    await dotNMiddleware.middleware(next as any, context)(args);

    const request = (next.mock.calls[0][0] as Args).request;
    // Implementation check: typeof null is 'object' and value !== null check exists in code
    // So null should be treated as primitive value in `flatten` -> result[prefix] = value
    expect(request.params).toMatchObject({
      Simple: "value",
    });
    // undefined usually doesn't appear in Object.entries or keys if not set,
    // but if explicitly set:
    // flatDotN uses Object.keys(obj).forEach.
    // If key exists and value is undefined:
    // typeof undefined is 'undefined', so it goes to else branch -> result[prefix] = value.
    if ("NullVal" in request.params!) {
      expect(request.params!["NullVal"]).toBeNull();
    }
    if ("UndefinedVal" in request.params!) {
      expect(request.params!["UndefinedVal"]).toBeUndefined();
    }
  });

  it("should NOT flatten for non-supported methods (e.g. PUT)", async () => {
    const args: Args = {
      input: {},
      request: {
        method: "PUT",
        params: { A: { B: 1 } },
        body: { C: { D: 2 } },
        headers: {},
        pathname: "/",
      },
    };

    const putContext = {
      ...context,
      contentType: "application/x-www-form-urlencoded",
    };

    await dotNMiddleware.middleware(next as any, putContext)(args);

    const request = (next.mock.calls[0][0] as Args).request;
    // Should remain unchanged
    expect(request.params).toEqual({ A: { B: 1 } });
    expect(request.body).toEqual({ C: { D: 2 } });
  });

  it("should handle empty params/body", async () => {
    const args: Args = {
      input: {},
      request: {
        method: "GET",
        params: {}, // Empty
        headers: {},
        pathname: "/",
      },
    };

    await dotNMiddleware.middleware(next as any, context)(args);
    const request = (next.mock.calls[0][0] as Args).request;
    expect(request.params).toEqual({});
  });
});
