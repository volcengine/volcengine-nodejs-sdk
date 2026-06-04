/* tslint:disable */
/* eslint-disable */
/**
 * sts
 *
 * OpenAPI spec version: common-version
 */

/**
 * AssumeRoleWithOIDC 请求参数。
 *
 * @see https://www.volcengine.com/docs/6257/1494877
 * @export
 * @interface AssumeRoleWithOIDCRequest
 */
export interface AssumeRoleWithOIDCRequest {
  /**
   * 需要扮演的角色 Trn，格式为 trn:iam::${AccountId}:role/${RoleName}。
   *
   * @type {string}
   * @memberof AssumeRoleWithOIDCRequest
   */
  RoleTrn: string;

  /**
   * 由外部 IdP 签发的 OIDC 令牌（OIDC Token）。长度：4~65536 个字符。
   *
   * @type {string}
   * @memberof AssumeRoleWithOIDCRequest
   */
  OIDCToken: string;

  /**
   * 角色会话名称，长度 2-64 字符，支持英文、数字和 .-_@ 符号。
   *
   * @type {string}
   * @memberof AssumeRoleWithOIDCRequest
   */
  RoleSessionName: string;

  /**
   * 角色内联策略，用于进一步限制临时凭证的权限。长度不超过 2048 字符。
   *
   * @type {string}
   * @memberof AssumeRoleWithOIDCRequest
   */
  Policy?: string;

  /**
   * 临时密钥有效时长（单位：秒），最短 900 秒，最长为角色最大会话时长值，默认 3600 秒。
   *
   * @type {number}
   * @memberof AssumeRoleWithOIDCRequest
   */
  DurationSeconds?: number;
}
