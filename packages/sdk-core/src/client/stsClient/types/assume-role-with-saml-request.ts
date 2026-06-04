/* tslint:disable */
/* eslint-disable */
/**
 * sts
 *
 * OpenAPI spec version: common-version
 */

/**
 * AssumeRoleWithSAML 请求参数。
 *
 * @see https://www.volcengine.com/docs/6257/1631607
 * @export
 * @interface AssumeRoleWithSAMLRequest
 */
export interface AssumeRoleWithSAMLRequest {
  /**
   * 需要扮演的角色 Trn，格式为 trn:iam::${AccountId}:role/${RoleName}。
   *
   * @type {string}
   * @memberof AssumeRoleWithSAMLRequest
   */
  RoleTrn: string;

  /**
   * SAML 外部身份提供商 TRN，格式为 trn:iam::${AccountId}:saml-provider/${ProviderName}。
   *
   * @type {string}
   * @memberof AssumeRoleWithSAMLRequest
   */
  SAMLProviderTrn: string;

  /**
   * Base64 编码后的 SAML 断言。
   *
   * @type {string}
   * @memberof AssumeRoleWithSAMLRequest
   */
  SAMLResp: string;

  /**
   * 角色内联策略，用于进一步限制临时凭证的权限。长度不超过 2048 字符。
   *
   * @type {string}
   * @memberof AssumeRoleWithSAMLRequest
   */
  Policy?: string;

  /**
   * 临时密钥有效时长（单位：秒），最短 900 秒，最长为角色最大会话时长值，默认 3600 秒。
   *
   * @type {number}
   * @memberof AssumeRoleWithSAMLRequest
   */
  DurationSeconds?: number;
}
