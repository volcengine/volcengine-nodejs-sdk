import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { getDefaultEndpointByServiceInfo } from "../src/utils/endpoint";
import * as envUtils from "../src/utils/env";
import * as fs from "fs";

// Mock the dependencies
jest.mock("../src/utils/env");
jest.mock("fs");

describe("getDefaultEndpointByServiceInfo", () => {
  const mockLoadEnv = envUtils.loadEnv as jest.MockedFunction<
    typeof envUtils.loadEnv
  >;
  const mockReadFileSync = fs.readFileSync as jest.MockedFunction<
    typeof fs.readFileSync
  >;

  beforeEach(() => {
    jest.resetAllMocks();
    // Default mock implementation for loadEnv
    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: false,
      bootstrapRegionListConf: undefined,
    });
  });

  it("should return default endpoint for non-bootstrap region", () => {
    const service = "vpc";
    const region = "cn-beijing"; // Not in bootstrap list
    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // endpoint.ts: const endpoint = "open.volcengineapi.com";
    expect(endpoint).toBe("open.volcengineapi.com");
  });

  it("should return correct endpoint for global service in bootstrap region", () => {
    const service = "iam"; // IsGlobal: true
    const region = "cn-beijing-autodriving"; // In bootstrap list

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // iam is global, so expected: iam.volcengineapi.com
    expect(endpoint).toBe("iam.volcengineapi.com");
  });

  it("should return correct endpoint for regional service in bootstrap region", () => {
    const service = "vpc"; // IsGlobal: false
    const region = "cn-beijing-autodriving";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // vpc is regional, expected: vpc.cn-beijing-autodriving.volcengineapi.com
    expect(endpoint).toBe("vpc.cn-beijing-autodriving.volcengineapi.com");
  });

  it("should handle dualstack enabled via argument", () => {
    const service = "iam";
    const region = "cn-beijing-autodriving";
    const useDualStack = true;

    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      undefined,
      useDualStack
    );

    // dualstack suffix: .volcengine-api.com
    expect(endpoint).toBe("iam.volcengine-api.com");
  });

  it("should handle dualstack enabled via env", () => {
    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: true,
      bootstrapRegionListConf: undefined,
    });

    const service = "vpc";
    const region = "cn-beijing-autodriving";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    expect(endpoint).toBe("vpc.cn-beijing-autodriving.volcengine-api.com");
  });

  it("should prioritize useDualStack argument over env variable", () => {
    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: true, // Env says true
      bootstrapRegionListConf: undefined,
    });

    const service = "vpc";
    const region = "cn-beijing-autodriving";

    // Argument says false
    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      undefined,
      false
    );

    // Should NOT have dualstack suffix
    expect(endpoint).toBe("vpc.cn-beijing-autodriving.volcengineapi.com");
  });

  it("should respect custom bootstrap region", () => {
    const service = "vpc";
    const region = "custom-region";
    const customBootstrapRegion = { "custom-region": {} };

    const endpoint = getDefaultEndpointByServiceInfo(
      service,
      region,
      customBootstrapRegion
    );

    expect(endpoint).toBe("vpc.custom-region.volcengineapi.com");
  });

  it("should read bootstrap region from file if configured", () => {
    const region = "file-region";
    const service = "vpc";

    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: false,
      bootstrapRegionListConf: "/path/to/conf",
    });

    mockReadFileSync.mockReturnValue("file-region\nanother-region");

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    expect(endpoint).toBe("vpc.file-region.volcengineapi.com");
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining("/path/to/conf"),
      "utf8"
    );
  });

  it("should standardize service code (replace _ with -)", () => {
    const service = "cloud_detect"; // In map: cloud_detect
    const region = "cn-beijing-autodriving";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // cloud_detect -> cloud-detect
    expect(endpoint).toBe(
      "cloud-detect.cn-beijing-autodriving.volcengineapi.com"
    );
  });

  it("should return default endpoint for unknown service in bootstrap region", () => {
    const service = "unknown_service";
    const region = "cn-beijing-autodriving";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // unknown_service is not in the defaultEndpoint map, so it returns the default endpoint
    expect(endpoint).toBe("open.volcengineapi.com");
  });

  it("should return global endpoint if RegionEndpointMap does not contain the region", () => {
    const service = "vpc";
    const region = "cn-beijing-autodriving";

    const endpoint = getDefaultEndpointByServiceInfo(service, region);
    expect(endpoint).toBe("vpc.cn-beijing-autodriving.volcengineapi.com");
  });

  it("should handle error when reading bootstrap region file", () => {
    const region = "file-region";
    const service = "vpc";

    mockLoadEnv.mockReturnValue({
      credentials: {},
      enableDualstack: false,
      bootstrapRegionListConf: "/path/to/conf",
    });

    mockReadFileSync.mockImplementation(() => {
      throw new Error("File not found");
    });

    const endpoint = getDefaultEndpointByServiceInfo(service, region);

    // Should fallback to checking other bootstrap sources, eventually failing to match 'file-region'
    // So it returns the default endpoint (open.volcengineapi.com)
    expect(endpoint).toBe("open.volcengineapi.com");
  });
});
