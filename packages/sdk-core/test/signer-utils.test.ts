import { hexEncodedBodyHash, calculateSHA256 } from "../src/utils/signer";

describe("signer utils", () => {
  it("should calculate correct hash for Buffer", () => {
    const buffer = Buffer.from("hello world");
    const hash = hexEncodedBodyHash({}, buffer);
    const expectedHash = calculateSHA256(buffer);
    expect(hash).toBe(expectedHash);
  });

  it("should calculate correct hash for string", () => {
    const str = "hello world";
    const hash = hexEncodedBodyHash({}, str);
    const expectedHash = calculateSHA256(str);
    expect(hash).toBe(expectedHash);
  });

  it("should calculate correct hash for object (JSON)", () => {
    const obj = { hello: "world" };
    const hash = hexEncodedBodyHash({}, obj);
    const expectedHash = calculateSHA256(JSON.stringify(obj));
    expect(hash).toBe(expectedHash);
  });
});
