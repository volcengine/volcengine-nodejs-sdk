import {
  signRequest,
  calculateSHA256,
  canonicalQueryString,
  getDateTime,
  createCanonicalRequest,
  canonicalUri,
  createScope,
  createStringToSign,
  addRequiredHeaders,
  sortParams,
  presignUrl,
  UNSIGNED_PAYLOAD,
} from "../src/utils/signer";

describe("Signer (Functional API)", () => {
  describe("Core signing function", () => {
    test("signRequest should generate valid signature", () => {
      const result = signRequest({
        method: "GET",
        uri: "/test",
        query: { foo: "bar" },
        headers: {},
        region: "cn-beijing",
        serviceName: "test-service",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        host: "example.com",
      });

      expect(result).toHaveProperty("headers");
      expect(result).toHaveProperty("signature");
      expect(result).toHaveProperty("authorization");
      expect(result.headers["Authorization"]).toContain("HMAC-SHA256");
      expect(result.headers["x-date"]).toBeDefined();
      expect(result.authorization).toContain("Credential=test-key");
    });

    test("signRequest with session token", () => {
      const result = signRequest({
        method: "GET",
        uri: "/",
        query: {},
        headers: {},
        region: "cn-beijing",
        serviceName: "sts",
        accessKeyId: "key",
        secretAccessKey: "secret",
        sessionToken: "session-token-123",
        host: "test.com",
      });

      expect(result.headers["x-security-token"]).toBe("session-token-123");
      expect(result.headers["Authorization"]).toContain("HMAC-SHA256");
    });

    test("signRequest with POST body", () => {
      const result = signRequest({
        method: "POST",
        uri: "/api/data",
        query: {},
        headers: { "content-type": "application/json" },
        body: { data: "test-payload" },
        region: "cn-beijing",
        serviceName: "test-service",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        host: "api.example.com",
      });

      expect(result.headers["x-content-sha256"]).toBeDefined();
      expect(result.headers["Authorization"]).toContain("HMAC-SHA256");
    });

    test("signRequest with timestamp override", () => {
      const customTimestamp = "20240101T120000Z";
      const result = signRequest({
        method: "GET",
        uri: "/",
        query: {},
        headers: {},
        region: "cn-beijing",
        serviceName: "test",
        accessKeyId: "key",
        secretAccessKey: "secret",
        host: "test.com",
        timestamp: customTimestamp,
      });

      expect(result.headers["x-date"]).toBe(customTimestamp);
    });
  });

  describe("Utility functions", () => {
    test("canonicalQueryString should sort and encode params", () => {
      const result = canonicalQueryString({ b: "2", a: "1", c: null });
      expect(result).toBe("a=1&b=2");
    });

    test("canonicalQueryString should handle array values", () => {
      const result = canonicalQueryString({ items: ["z", "a", "m"] });
      expect(result).toContain("items=a");
      expect(result).toContain("items=m");
      expect(result).toContain("items=z");
    });

    test("calculateSHA256 should compute hash correctly", () => {
      const hash = calculateSHA256("test");
      expect(hash).toBe(
        "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
      );
    });

    test("calculateSHA256 should handle empty string", () => {
      const hash = calculateSHA256("");
      expect(hash).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );
    });

    test("getDateTime should return ISO timestamp without separators", () => {
      const now = new Date("2024-01-01T12:00:00.000Z");
      const timestamp = getDateTime(now);
      expect(timestamp).toMatch(/^\d{8}T\d{6}Z$/); // YYYYMMDDTHHMMSSZ format
      expect(timestamp).toContain("20240101");
    });

    test("createCanonicalRequest should format request correctly", () => {
      const canonical = createCanonicalRequest(
        "POST",
        "/api/test",
        { foo: "bar" },
        { host: "example.com" },
        "payload-hash"
      );

      // Verify canonical request contains all required components
      expect(canonical).toContain("POST");
      expect(canonical).toContain("/api/test");
      expect(canonical).toContain("foo=bar"); // Query string
      expect(canonical).toContain("host:example.com"); // Headers section
      expect(canonical).toContain("payload-hash"); // Payload
      expect(canonical.split("\n")).toHaveLength(7); // 7 lines (METHOD, URI, QUERY, HEADERS, empty, SIGNED_HEADERS, PAYLOAD)
    });
  });

  describe("Signature verification", () => {
    test("signRequest produces consistent signatures for same input", () => {
      const params = {
        method: "GET" as const,
        uri: "/test",
        query: { foo: "bar" },
        headers: {},
        region: "cn-beijing",
        serviceName: "test",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        host: "example.com",
        timestamp: "20240101T120000Z",
      };

      const result1 = signRequest(params);
      const result2 = signRequest(params);

      expect(result1.signature).toBe(result2.signature);
      expect(result1.authorization).toBe(result2.authorization);
    });

    test("signRequest produces different signatures for different secrets", () => {
      const params1 = {
        method: "GET",
        uri: "/test",
        query: {},
        headers: {},
        region: "cn-beijing",
        serviceName: "test",
        accessKeyId: "key",
        secretAccessKey: "secret1",
        host: "example.com",
        timestamp: "20240101T120000Z",
      };

      const params2 = {
        ...params1,
        secretAccessKey: "secret2",
      };

      const result1 = signRequest(params1);
      const result2 = signRequest(params2);

      expect(result1.signature).not.toBe(result2.signature);
      expect(result1.authorization).not.toBe(result2.authorization);
    });

    test("signRequest includes all required Authorization components", () => {
      const result = signRequest({
        method: "GET",
        uri: "/",
        query: {},
        headers: {},
        region: "cn-beijing",
        serviceName: "test-service",
        accessKeyId: "my-access-key",
        secretAccessKey: "my-secret-key",
        host: "example.com",
        timestamp: "20240101T120000Z",
      });

      const auth = result.authorization;
      expect(auth).toContain("HMAC-SHA256 Credential=my-access-key");
      expect(auth).toContain("SignedHeaders=");
      expect(auth).toContain("Signature=");
    });
  });

  describe("Helper functions", () => {
    describe("canonicalUri", () => {
      test("should return path as is when provided", () => {
        expect(canonicalUri("/api/test")).toBe("/api/test");
        expect(canonicalUri("/")).toBe("/");
        expect(canonicalUri("/path/to/resource")).toBe("/path/to/resource");
      });

      test("should return default root path when path is undefined", () => {
        expect(canonicalUri(undefined)).toBe("/");
      });

      test("should return default root path when path is empty string", () => {
        expect(canonicalUri("")).toBe("/");
      });
    });

    describe("createScope", () => {
      test("should create scope with date, region, and service", () => {
        const scope = createScope("20240101T120000Z", "cn-beijing", "iam");
        expect(scope).toBe("20240101/cn-beijing/iam/request");
      });

      test("should extract only date part (first 8 characters) from timestamp", () => {
        const scope = createScope("20241231T235959Z", "us-east-1", "tos");
        expect(scope).toBe("20241231/us-east-1/tos/request");
      });

      test("should handle different regions and services", () => {
        expect(createScope("20240101T000000Z", "cn-beijing", "ecs")).toBe(
          "20240101/cn-beijing/ecs/request"
        );
        expect(createScope("20240102T120000Z", "ap-southeast-1", "rds")).toBe(
          "20240102/ap-southeast-1/rds/request"
        );
      });
    });

    describe("createStringToSign", () => {
      test("should create string to sign with algorithm, timestamp, scope, and hashed canonical request", () => {
        const stringToSign = createStringToSign(
          "20240101T120000Z",
          "cn-beijing",
          "iam",
          "GET\n/\n\nhost:example.com\n\nhost\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );

        expect(stringToSign).toContain("HMAC-SHA256");
        expect(stringToSign).toContain("20240101T120000Z");
        expect(stringToSign).toContain("20240101/cn-beijing/iam/request");
      });

      test("should handle different canonical request formats", () => {
        const canonicalRequest =
          "POST\n/api/data\nparam=value\nhost:example.com\nhost\ncontent-type:application/json\n\nhost;content-type\nabc123hash";
        const stringToSign = createStringToSign(
          "20240102T130000Z",
          "us-east-1",
          "tos",
          canonicalRequest
        );

        expect(stringToSign).toContain("HMAC-SHA256");
        expect(stringToSign).toContain("20240102T130000Z");
        expect(stringToSign).toContain("20240102/us-east-1/tos/request");
      });
    });

    describe("addRequiredHeaders", () => {
      test("should add X-Date and host headers", () => {
        const headers = addRequiredHeaders(
          {},
          "20240101T120000Z",
          "example.com"
        );

        expect(headers["x-date"]).toBe("20240101T120000Z");
        expect(headers["host"]).toBe("example.com");
      });

      test("should add X-Security-Token when sessionToken is provided", () => {
        const headers = addRequiredHeaders(
          {},
          "20240101T120000Z",
          "example.com",
          "session-token-123"
        );

        expect(headers["x-security-token"]).toBe("session-token-123");
        expect(headers["x-date"]).toBe("20240101T120000Z");
      });

      test("should compute and add X-Content-Sha256 when body is provided", () => {
        const headers = addRequiredHeaders(
          {},
          "20240101T120000Z",
          "example.com",
          undefined,
          { data: "test" }
        );

        expect(headers["x-content-sha256"]).toBeDefined();
      });

      test("should preserve existing headers and add required ones", () => {
        const headers = addRequiredHeaders(
          { "content-type": "application/json", "custom-header": "value" },
          "20240101T120000Z",
          "example.com"
        );

        expect(headers["content-type"]).toBe("application/json");
        expect(headers["custom-header"]).toBe("value");
        expect(headers["x-date"]).toBe("20240101T120000Z");
        expect(headers["host"]).toBe("example.com");
      });

      test("should not overwrite existing host header if present", () => {
        const headers = addRequiredHeaders(
          { host: "existing-host.com" },
          "20240101T120000Z",
          "new-host.com"
        );

        expect(headers["host"]).toBe("existing-host.com");
      });

      test("should not add X-Content-Sha256 if not present in headers and no body provided", () => {
        const headers = addRequiredHeaders(
          {},
          "20240101T120000Z",
          "example.com"
        );

        expect(headers["x-content-sha256"]).toBeUndefined();
      });

      test("should add X-Content-Sha256 if already present in headers even without body", () => {
        const headers = addRequiredHeaders(
          { "x-content-sha256": "precomputed-hash" },
          "20240101T120000Z",
          "example.com"
        );

        expect(headers["x-content-sha256"]).toBe("precomputed-hash");
      });
    });

    describe("sortParams", () => {
      test("should sort params by key alphabetically", () => {
        const sorted = sortParams({ zebra: "z", alpha: "a", beta: "b" });
        expect(Object.keys(sorted)).toEqual(["alpha", "beta", "zebra"]);
      });

      test("should filter out undefined and null values", () => {
        const sorted = sortParams({
          a: "value1",
          b: undefined,
          c: null,
          d: "value2",
          e: undefined,
        });
        expect(Object.keys(sorted)).toEqual(["a", "d"]);
        expect(sorted).toEqual({ a: "value1", d: "value2" });
      });

      test("should return empty object for empty input", () => {
        expect(sortParams({})).toEqual({});
      });

      test("should return empty object for null/undefined input", () => {
        expect(sortParams({} as any)).toEqual({});
        expect(sortParams(null as any)).toEqual({});
        expect(sortParams(undefined as any)).toEqual({});
      });

      test("should handle numeric and boolean values", () => {
        const sorted = sortParams({ age: 25, active: true, name: "test" });
        expect(Object.keys(sorted)).toEqual(["active", "age", "name"]);
        expect(sorted).toEqual({ active: true, age: 25, name: "test" });
      });

      test("should handle special characters in keys", () => {
        const sorted = sortParams({
          "key-with-dash": "a",
          key_with_underscore: "b",
          "key.with.dot": "c",
        });
        const keys = Object.keys(sorted);
        // Sorting by ASCII: '-' (45), '.' (46), '_' (95)
        expect(keys).toEqual([
          "key-with-dash",
          "key.with.dot",
          "key_with_underscore",
        ]);
      });
    });
  });

  describe("Presign URL", () => {
    test("presignUrl should generate valid presigned URL", () => {
      const url = presignUrl({
        method: "GET",
        uri: "/test/object.txt",
        query: { "response-content-type": "application/octet-stream" },
        region: "cn-beijing",
        serviceName: "tos",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        host: "open.volcengineapi.com",
        timestamp: "20240101T120000Z",
      });

      // 验证 URL 格式
      expect(url).toContain("https://open.volcengineapi.com");
      expect(url).toContain("/test/object.txt");

      // 验证必要的签名参数
      expect(url).toContain("X-Algorithm=HMAC-SHA256");
      expect(url).toContain("X-Credential=test-key");
      expect(url).toContain("X-Date=20240101T120000Z");
      expect(url).toContain("X-NotSignBody=");
      expect(url).toContain("X-SignedHeaders=");
      expect(url).toContain("X-SignedQueries=");
      expect(url).toContain("X-Signature=");

      // 验证原始查询参数也被包含
      expect(url).toContain("response-content-type=application%2Foctet-stream");
    });

    test("presignUrl should include session token when provided", () => {
      const url = presignUrl({
        method: "GET",
        uri: "/",
        region: "cn-beijing",
        serviceName: "tos",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        sessionToken: "session-token-123",
        host: "open.volcengineapi.com",
        timestamp: "20240101T120000Z",
      });

      expect(url).toContain("X-Security-Token=session-token-123");
    });

    test("presignUrl should use custom protocol", () => {
      const url = presignUrl({
        method: "GET",
        uri: "/",
        region: "cn-beijing",
        serviceName: "tos",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        host: "localhost:8080",
        timestamp: "20240101T120000Z",
        protocol: "http",
      });

      expect(url.startsWith("http://localhost:8080")).toBe(true);
    });

    test("presignUrl should produce consistent URLs for same input", () => {
      const params = {
        method: "GET" as const,
        uri: "/bucket/key",
        query: { foo: "bar" },
        region: "cn-beijing",
        serviceName: "tos",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        host: "open.volcengineapi.com",
        timestamp: "20240101T120000Z",
      };

      const url1 = presignUrl(params);
      const url2 = presignUrl(params);

      expect(url1).toBe(url2);
    });

    test("presignUrl should produce different URLs for different secrets", () => {
      const baseParams = {
        method: "GET" as const,
        uri: "/bucket/key",
        region: "cn-beijing",
        serviceName: "tos",
        accessKeyId: "test-key",
        host: "open.volcengineapi.com",
        timestamp: "20240101T120000Z",
      };

      const url1 = presignUrl({ ...baseParams, secretAccessKey: "secret1" });
      const url2 = presignUrl({ ...baseParams, secretAccessKey: "secret2" });

      // Signature 部分应该不同
      const sig1 = url1.match(/X-Signature=([^&]+)/)?.[1];
      const sig2 = url2.match(/X-Signature=([^&]+)/)?.[1];

      expect(sig1).not.toBe(sig2);
    });

    test("presignUrl should properly encode special characters in URI", () => {
      const url = presignUrl({
        method: "GET",
        uri: "/bucket/path with spaces/file[1].txt",
        region: "cn-beijing",
        serviceName: "tos",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        host: "open.volcengineapi.com",
        timestamp: "20240101T120000Z",
      });

      // URI 应该被正确编码
      expect(url).toContain("path%20with%20spaces");
      expect(url).toContain("file%5B1%5D.txt");
    });

    test("presignUrl should include X-SignedQueries with sorted keys", () => {
      const url = presignUrl({
        method: "GET",
        uri: "/",
        query: { zebra: "z", alpha: "a" },
        region: "cn-beijing",
        serviceName: "tos",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        host: "open.volcengineapi.com",
        timestamp: "20240101T120000Z",
      });

      // X-SignedQueries 应该包含排序后的所有查询参数
      expect(url).toContain("X-SignedQueries=");
      // 解码后验证包含 alpha 和 zebra
      const decodedUrl = decodeURIComponent(url);
      expect(decodedUrl).toContain("alpha");
      expect(decodedUrl).toContain("zebra");
    });

    test("UNSIGNED_PAYLOAD constant should be defined", () => {
      expect(UNSIGNED_PAYLOAD).toBe("UNSIGNED-PAYLOAD");
    });
  });
});
