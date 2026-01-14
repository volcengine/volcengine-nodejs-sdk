import { uriEscape, canonicalQueryString } from "../src/utils/signer";

describe("uriEscape", () => {
  it("should not escape unreserved characters (RFC 3986)", () => {
    const unreserved = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    expect(uriEscape(unreserved)).toBe(unreserved);
  });

  it("should escape reserved characters", () => {
    // ! ' ( ) * are sub-delimiters but AWS/Volcengine requires them to be escaped
    const special = "!'()*";
    const escaped = uriEscape(special);
    // ! -> %21
    // ' -> %27
    // ( -> %28
    // ) -> %29
    // * -> %2A
    expect(escaped).toBe("%21%27%28%29%2A");
  });

  it("should escape other characters", () => {
    expect(uriEscape(" ")).toBe("%20");
    expect(uriEscape("/")).toBe("%2F");
    expect(uriEscape("=")).toBe("%3D");
    expect(uriEscape("&")).toBe("%26");
    expect(uriEscape("@")).toBe("%40");
  });
});

describe("canonicalQueryString", () => {
  it("should ignore empty keys", () => {
    const params = {
      "": "empty_key",
      "valid": "value"
    };
    expect(canonicalQueryString(params)).toBe("valid=value");
  });

  it("should handle empty values", () => {
      const params = {
          "key": ""
      };
      // Expect key=
      expect(canonicalQueryString(params)).toBe("key=");
  });

  it("should sort keys", () => {
      const params = {
          "b": "2",
          "a": "1"
      };
      expect(canonicalQueryString(params)).toBe("a=1&b=2");
  });

  it("should encode keys and values", () => {
      const params = {
          "a/b": "c d"
      };
      // a/b -> a%2Fb
      // c d -> c%20d
      expect(canonicalQueryString(params)).toBe("a%2Fb=c%20d");
  });
});
