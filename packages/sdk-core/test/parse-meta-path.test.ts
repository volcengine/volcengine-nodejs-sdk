import { parseMetaPath } from "../src/utils/meta";

describe("parseMetaPath", () => {
  describe("Valid inputs", () => {
    test("should parse valid metaPath with correct format", () => {
      const result = parseMetaPath(
        "/GetUser/2020-01-01/iam/GET/application_json"
      );

      expect(result).toEqual({
        action: "GetUser",
        version: "2020-01-01",
        serviceName: "iam",
        method: "GET", // Should be uppercased
        contentType: "application/json", // _ should be replaced with /
      });
    });

    test("should parse metaPath without leading slash", () => {
      const result = parseMetaPath(
        "CreateBucket/2020-08-01/tos/PUT/application_json"
      );

      expect(result).toEqual({
        action: "CreateBucket",
        version: "2020-08-01",
        serviceName: "tos",
        method: "PUT",
        contentType: "application/json",
      });
    });

    test("should handle POST method with contentType application_json", () => {
      const result = parseMetaPath(
        "/CreateUser/2020-01-01/iam/POST/application_json"
      );

      expect(result).toEqual({
        action: "CreateUser",
        version: "2020-01-01",
        serviceName: "iam",
        method: "POST",
        contentType: "application/json",
      });
    });

    test("should parse metaPath with multiple underscores in contentType", () => {
      const result = parseMetaPath(
        "/Action/Version/service/GET/text_plain_charset_utf-8"
      );

      expect(result).toEqual({
        action: "Action",
        version: "Version",
        serviceName: "service",
        method: "GET",
        contentType: "text/plain/charset/utf-8", // _ replaced with / globally
      });
    });

    test("should parse metaPath with lowercase method", () => {
      const result = parseMetaPath(
        "/DeleteUser/2020-01-01/iam/delete/application_json"
      );

      expect(result.method).toBe("DELETE"); // Should normalize to uppercase
    });

    test("should parse metaPath with mixed case method", () => {
      const result = parseMetaPath(
        "/UpdateUser/2020-01-01/iam/Patch/application_json"
      );

      expect(result.method).toBe("PATCH"); // Should normalize to uppercase
    });

    test("should handle GET method with contentType application_json", () => {
      const result = parseMetaPath(
        "/GetUser/2020-01-01/iam/GET/application_json"
      );

      expect(result).toEqual({
        action: "GetUser",
        version: "2020-01-01",
        serviceName: "iam",
        method: "GET",
        contentType: "application/json",
      });
    });

    test("should normalize method regardless of case", () => {
      const result = parseMetaPath(
        "/Action/2020-01-01/service/get/application_json"
      );

      expect(result.method).toBe("GET");
    });

    test("should replace all underscores in contentType", () => {
      const result = parseMetaPath(
        "/Action/2020-01-01/service/GET/app_json_charset_utf-8_boundary_x"
      );

      expect(result.contentType).toBe("app/json/charset/utf-8/boundary/x"); // All underscores replaced with slash globally
    });
  });

  describe("Invalid inputs", () => {
    test("should throw error for empty string", () => {
      expect(() => parseMetaPath("")).toThrow("Invalid metaPath format");
    });

    test("should throw error for string with only slashes", () => {
      expect(() => parseMetaPath("///")).toThrow("Invalid metaPath format");
    });

    test("should throw error for path with too few parts", () => {
      expect(() => parseMetaPath("/Action/Version/service")).toThrow(
        "Invalid metaPath format"
      );
    });

    test("should throw error for path with too many parts", () => {
      expect(() =>
        parseMetaPath("/Action/Version/service/GET/json/extra")
      ).toThrow("Invalid metaPath format");
    });

    test("should throw error for path with only 4 parts", () => {
      expect(() => parseMetaPath("Action/Version/service/GET")).toThrow(
        "Invalid metaPath format"
      );
    });

    test("should throw error for path with 6 parts", () => {
      expect(() =>
        parseMetaPath("/Action/Version/service/GET/json/extra")
      ).toThrow("Invalid metaPath format");
    });

    test("should throw error for path with only slashes and fewer parts", () => {
      expect(() => parseMetaPath("/a/b/c/d")).toThrow(
        "Invalid metaPath format"
      );
    });
  });

  describe("Edge cases", () => {
    test("should handle special characters in action name", () => {
      const result = parseMetaPath(
        "/GetUser_v2/2020-01-01/iam/GET/application_json"
      );

      expect(result.action).toBe("GetUser_v2");
    });

    test("should handle version with dots and dashes", () => {
      const result = parseMetaPath(
        "/GetUser/2020-01-01-beta/iam/GET/application_json"
      );

      expect(result.version).toBe("2020-01-01-beta");
    });

    test("should handle service name with hyphens", () => {
      const result = parseMetaPath(
        "/GetUser/2020-01-01/ve-tos/GET/application_json"
      );

      expect(result.serviceName).toBe("ve-tos");
    });

    test("should handle contentType without underscores", () => {
      const result = parseMetaPath(
        "/Action/Version/service/GET/applicationjson"
      );

      expect(result.contentType).toBe("applicationjson");
    });

    test("should handle method in different cases", () => {
      const result1 = parseMetaPath(
        "/Action/Version/service/get/application_json"
      );
      expect(result1.method).toBe("GET");

      const result2 = parseMetaPath(
        "/Action/Version/service/Post/application_json"
      );
      expect(result2.method).toBe("POST");

      const result3 = parseMetaPath(
        "/Action/Version/service/pUt/application_json"
      );
      expect(result3.method).toBe("PUT");
    });

    test("should handle contentType starting or ending with underscore", () => {
      const result1 = parseMetaPath("/Action/Version/service/GET/_json");
      expect(result1.contentType).toBe("/json");

      const result2 = parseMetaPath("/Action/Version/service/GET/application_");
      expect(result2.contentType).toBe("application/");
    });

    test("should handle consecutive underscores in contentType", () => {
      const result = parseMetaPath("/Action/Version/service/GET/app__json");

      expect(result.contentType).toBe("app//json");
    });
  });
});
