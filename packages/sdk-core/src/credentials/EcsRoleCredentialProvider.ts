import http from "http";
import type { CredentialValue, Provider } from "./types";

// ---------------------------------------------------------------------------
// ECS IMDSv2 endpoint 与协议常量
// ---------------------------------------------------------------------------
const IMDS_ENDPOINT = "100.96.0.96";
const IMDS_TOKEN_PATH = "/latest/api/token"; // PUT
const IMDS_ROLE_NAME_PATH =
  "/volcstack/latest/iam/security_credentials?type=user&format=json"; // GET
const IMDS_CREDENTIALS_PATH =
  "/volcstack/latest/iam/security_credentials/{role_name}"; // GET

// ECS IMDSv2 headers
const IMDS_TOKEN_TTL_HEADER = "X-volc-ecs-metadata-token-ttl-seconds";
const IMDS_TOKEN_HEADER = "X-volc-ecs-metadata-token";
const IMDS_TOKEN_TTL_SECONDS = "21600"; // 6 小时

// ECS IMDSv2 响应字段名
const FIELD_AK = "AccessKeyId";
const FIELD_SK = "SecretAccessKey";
const FIELD_TOKEN = "SessionToken";
const FIELD_EXPIRATION = "ExpiredTime";

export interface EcsRoleCredentialProviderOptions {
  /** IAM 角色名。优先级：构造参数 > 环境变量 VOLCENGINE_ECS_METADATA > IMDS 自动获取 */
  roleName?: string;
  /** 连接超时(秒)，默认 1 */
  connectTimeout?: number;
  /** 读超时(秒)，默认 1 */
  readTimeout?: number;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 重试间隔(秒)，默认 1 */
  retryInterval?: number;
  /** 提前刷新窗口(秒)，默认 300（5 分钟） */
  expiredBufferSeconds?: number;
}

/**
 * 通过 ECS 实例元数据服务（IMDSv2）获取 IAM 角色的 STS 临时凭证。
 *
 * 协议流程：
 *   Step 1: PUT /latest/api/token → 获取 IMDSv2 token（每次刷新都重新获取，不缓存）
 *   Step 2: 确定 roleName：构造参数 > 环境变量 > GET ?type=user&format=json 自动获取
 *   Step 3: GET /volcstack/latest/iam/security_credentials/{roleName} → 获取 STS 凭证
 *
 * 开关：VOLCENGINE_ECS_METADATA_DISABLED=true → 构造时直接抛异常
 *
 * 特性：
 *   - 临时凭证，支持自动刷新（过期前 expiredBufferSeconds 触发）
 *   - 并发请求合并（pendingRefresh 锁，等价于 Python 的 threading.Lock）
 *   - 超时 + 重试策略，保证非 ECS 环境下不长时间阻塞
 */
export class EcsRoleCredentialProvider implements Provider {
  readonly providerName = "EcsRoleCredentialProvider";

  private readonly roleName?: string;
  private readonly connectTimeout: number;
  private readonly readTimeout: number;
  private readonly maxRetries: number;
  private readonly retryInterval: number;
  private readonly expiredBufferSeconds: number;

  private credentials: CredentialValue | null = null;
  private expiredTime: number | null = null; // unix 秒
  private pendingRefresh: Promise<void> | null = null;

  constructor(options: EcsRoleCredentialProviderOptions = {}) {
    const disabled = (
      process.env.VOLCENGINE_ECS_METADATA_DISABLED || ""
    ).toLowerCase();
    if (disabled === "true") {
      throw new Error(
        `${this.providerName}: IMDS credentials are disabled via VOLCENGINE_ECS_METADATA_DISABLED=true.`,
      );
    }

    this.roleName = options.roleName;
    this.connectTimeout = options.connectTimeout ?? 1;
    this.readTimeout = options.readTimeout ?? 1;
    this.maxRetries = Math.max(options.maxRetries ?? 3, 1);
    this.retryInterval = options.retryInterval ?? 1;
    this.expiredBufferSeconds = options.expiredBufferSeconds ?? 300;
  }

  // ---------------------------------------------------------------------------
  // 对外接口
  // ---------------------------------------------------------------------------

  /** 返回当前缓存的凭证（可能为 null） */
  retrieve(): CredentialValue | null {
    return this.credentials;
  }

  /** 判断凭证是否已过期或即将过期 */
  isExpired(): boolean {
    return (
      this.credentials === null ||
      (this.expiredTime !== null &&
        this.expiredTime < Date.now() / 1000 + this.expiredBufferSeconds)
    );
  }

  /** 刷新凭证（并发安全，多次调用只触发一次实际请求） */
  async refresh(): Promise<void> {
    if (this.pendingRefresh) {
      return this.pendingRefresh;
    }
    if (this.isExpired()) {
      this.pendingRefresh = this.refreshCredentials();
      try {
        await this.pendingRefresh;
      } finally {
        this.pendingRefresh = null;
      }
    }
  }

  /** Provider 接口：获取凭证（自动刷新） */
  async resolveCredentials(): Promise<CredentialValue> {
    await this.refresh();

    if (!this.credentials) {
      throw new Error(`${this.providerName}: 刷新后仍无法获取有效凭证`);
    }
    return this.credentials;
  }

  // ---------------------------------------------------------------------------
  // Step 1: 获取 IMDSv2 token（每次刷新都重新获取，不缓存）
  // PUT http://100.96.0.96/latest/api/token
  // Header: X-volc-ecs-metadata-token-ttl-seconds: 21600
  // ---------------------------------------------------------------------------

  private async getImdsv2Token(): Promise<string> {
    const body = await this.doRequest(IMDS_TOKEN_PATH, "PUT", {
      [IMDS_TOKEN_TTL_HEADER]: IMDS_TOKEN_TTL_SECONDS,
    });
    const token = body.trim();
    if (!token) {
      throw new Error(`${this.providerName}: IMDSv2 token 端点返回空响应`);
    }
    return token;
  }

  // ---------------------------------------------------------------------------
  // Step 2: roleName 解析
  // 优先级：构造参数 > 环境变量 VOLCENGINE_ECS_METADATA > IMDS 自动获取
  // 不缓存 — 角色可能在实例上动态绑定/解绑，且 IMDS 是本地调用（~1-5ms）
  // ---------------------------------------------------------------------------

  private async resolveRoleName(imdsToken: string): Promise<string> {
    if (this.roleName) {
      return this.roleName;
    }

    const envRole = (process.env.VOLCENGINE_ECS_METADATA || "").trim();
    if (envRole) {
      return envRole;
    }

    return this.autoDetectRoleName(imdsToken);
  }

  /**
   * GET /volcstack/latest/iam/security_credentials?type=user&format=json
   * 响应可能是 JSON 数组或换行分隔的纯文本
   */
  private async autoDetectRoleName(imdsToken: string): Promise<string> {
    const body = await this.doRequest(IMDS_ROLE_NAME_PATH, "GET", {
      [IMDS_TOKEN_HEADER]: imdsToken,
    });

    let roles: string[];
    try {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) {
        roles = parsed
          .map((r: any) => (typeof r === "string" ? r.trim() : String(r)))
          .filter(Boolean);
      } else {
        throw new Error("not an array");
      }
    } catch {
      // 兜底：按换行分割纯文本响应
      roles = body
        .trim()
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean);
    }

    if (roles.length === 0) {
      throw new Error(`${this.providerName}: 未通过 IMDS 发现任何 IAM 角色`);
    }

    if (roles.length > 1) {
      console.warn(
        `${this.providerName}: 通过 IMDS 发现多个 IAM 角色: ${JSON.stringify(
          roles,
        )}。` +
          `使用第一个 '${roles[0]}'。` +
          `请设置 VOLCENGINE_ECS_METADATA 或显式传入 roleName 以避免歧义。`,
      );
    }

    return roles[0];
  }

  // ---------------------------------------------------------------------------
  // Step 3: 获取 STS 凭证
  // GET http://100.96.0.96/volcstack/latest/iam/security_credentials/{roleName}
  // Header: X-volc-ecs-metadata-token: <token>
  // ---------------------------------------------------------------------------

  private async refreshCredentials(): Promise<void> {
    // Step 1: 获取 IMDSv2 token（每次刷新都重新获取）
    const imdsToken = await this.getImdsv2Token();

    // Step 2: 确定 roleName
    const roleName = await this.resolveRoleName(imdsToken);

    // Step 3: GET 获取凭证
    const credPath = IMDS_CREDENTIALS_PATH.replace(
      "{role_name}",
      encodeURIComponent(roleName),
    );
    const body = await this.doRequest(credPath, "GET", {
      [IMDS_TOKEN_HEADER]: imdsToken,
    });

    let data: any;
    try {
      data = JSON.parse(body);
    } catch (e: any) {
      throw new Error(`${this.providerName}: 解析 IMDS 响应失败: ${e.message}`);
    }

    const ak = data[FIELD_AK];
    const sk = data[FIELD_SK];
    const token = data[FIELD_TOKEN];
    const expirationStr = data[FIELD_EXPIRATION];

    if (!ak || !sk) {
      throw new Error(`${this.providerName}: IMDS 响应缺少必要的凭证字段`);
    }

    // 解析过期时间
    if (expirationStr) {
      const t = new Date(expirationStr).getTime();
      this.expiredTime = Number.isNaN(t) ? null : t / 1000;
    } else {
      this.expiredTime = null;
    }

    this.credentials = {
      accessKeyId: ak,
      secretAccessKey: sk,
      sessionToken: token || undefined,
      providerName: this.providerName,
    };
  }

  // ---------------------------------------------------------------------------
  // HTTP 请求（带重试）
  // ---------------------------------------------------------------------------

  private async doRequest(
    path: string,
    method: string,
    extraHeaders?: Record<string, string>,
  ): Promise<string> {
    const timeoutMs = (this.connectTimeout + this.readTimeout) * 1000;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.httpRequest(path, method, extraHeaders, timeoutMs);
      } catch (e: any) {
        lastError = e;
        // 最后一次不再等待
        if (attempt < this.maxRetries - 1) {
          await this.sleep(this.retryInterval * 1000);
        }
      }
    }

    throw new Error(
      `${this.providerName}: 请求 ${path} 失败（已重试 ${this.maxRetries} 次）: ${lastError?.message}`,
    );
  }

  private httpRequest(
    path: string,
    method: string,
    headers: Record<string, string> | undefined,
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          protocol: "http:",
          hostname: IMDS_ENDPOINT,
          port: 80,
          path,
          method,
          headers,
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (d: any) =>
            chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)),
          );
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf-8");
            if (
              !res.statusCode ||
              res.statusCode < 200 ||
              res.statusCode >= 300
            ) {
              reject(new Error(`IMDS 请求失败: HTTP ${res.statusCode} ${raw}`));
              return;
            }
            resolve(raw);
          });
        },
      );

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy(new Error("IMDS 请求超时"));
      });
      req.end();
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
