/**
 * Presign URL Integration Test
 *
 * 这是一个真实请求的集成测试，需要配置真实的 AK/SK 才能运行
 * 运行方式: AK=xxx SK=xxx pnpm test -- test/presign-integration.test.ts
 */

import { presignUrl } from "../src/utils/signer";
import axios from "axios";

// 从环境变量获取凭证
const AK = process.env.AK || "";
const SK = process.env.SK || "";

// 是否跳过集成测试
const SKIP_INTEGRATION = !AK || !SK;

describe("Presign URL Integration Tests", () => {
  // 如果没有配置凭证，跳过测试
  const testFn = SKIP_INTEGRATION ? test.skip : test;

  testFn("IAM GetUser request - real API call", async () => {
    const region = "cn-beijing";
    const service = "iam";

    const url = presignUrl({
      method: "GET",
      uri: "/",
      query: {
        Action: "GetUser",
        UserName: "xxxx",
        Version: "2018-01-01",
      },
      region,
      serviceName: service,
      accessKeyId: AK,
      secretAccessKey: SK,
      host: "open.volcengineapi.com",
    });

    console.log("Generated URL:", url);

    // 验证 URL 包含签名参数
    expect(url).toContain("X-Signature=");
    expect(url).toContain("X-Credential=");
    expect(url).toContain("X-Algorithm=HMAC-SHA256");

    // 发起真实请求
    try {
      const response = await axios.get(url, {
        validateStatus: () => true, // 不抛出 HTTP 错误
      });

      console.log("HTTP Status:", response.status);
      console.log("Response:", JSON.stringify(response.data, null, 2));

      // 验证签名是否正确（不应该返回签名错误）
      const responseStr = JSON.stringify(response.data);
      expect(responseStr).not.toContain("SignatureDoesNotMatch");

      // 如果用户存在，应该返回 200
      // 如果用户不存在，可能返回 404 或其他错误，但不应该是签名错误
      if (response.status === 200) {
        console.log("✅ API call successful!");
      } else {
        console.log(
          `⚠️ API returned status ${response.status}, but signature is valid`
        );
      }
    } catch (error: any) {
      console.error("Request failed:", error.message);
      throw error;
    }
  });

  // 不需要凭证的测试：验证 URL 格式
  test("presignUrl generates correct format for IAM request", () => {
    const url = presignUrl({
      method: "GET",
      uri: "/",
      query: {
        Action: "GetUser",
        UserName: "testuser",
        Version: "2018-01-01",
      },
      region: "cn-beijing",
      serviceName: "iam",
      accessKeyId: "AKTEST123",
      secretAccessKey: "SKTEST456",
      host: "open.volcengineapi.com",
      timestamp: "20240101T120000Z",
    });

    // 验证 URL 结构
    expect(url).toContain("https://open.volcengineapi.com/?");
    expect(url).toContain("Action=GetUser");
    expect(url).toContain("UserName=testuser");
    expect(url).toContain("Version=2018-01-01");
    expect(url).toContain("X-Algorithm=HMAC-SHA256");
    expect(url).toContain("X-Credential=AKTEST123%2F20240101%2Fcn-beijing%2Fiam%2Frequest");
    expect(url).toContain("X-Date=20240101T120000Z");
    expect(url).toContain("X-NotSignBody=");
    expect(url).toContain("X-SignedHeaders=");
    expect(url).toContain("X-SignedQueries=");
    expect(url).toContain("X-Signature=");
  });
});