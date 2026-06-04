/**
 * 所有凭证 Provider 返回的凭证值。
 */
export interface CredentialValue {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /** 生成该凭证的 Provider 名称 */
  providerName: string;
}

/**
 * 所有凭证 Provider 必须实现的基础接口。
 *
 * 参考 Java SDK 的 Provider 接口，适配 Node.js 异步模式。
 */
export interface Provider {
  /** 唯一名称，用于调试和错误报告 */
  readonly providerName: string;

  /**
   * 解析凭证。支持缓存/刷新的实现应在内部自行处理过期逻辑。
   *
   * @throws Error 当无法获取凭证时抛出异常
   */
  resolveCredentials(): Promise<CredentialValue>;
}
