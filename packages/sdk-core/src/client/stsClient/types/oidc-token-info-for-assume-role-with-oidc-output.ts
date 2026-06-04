/* tslint:disable */
/* eslint-disable */
/**
 * sts
 *
 * OpenAPI spec version: common-version
 */

/**
 * OIDC Token 信息。
 *
 * @see https://www.volcengine.com/docs/6257/1494877
 * @export
 * @interface OIDCTokenInfoForAssumeRoleWithOIDCOutput
 */
export interface OIDCTokenInfoForAssumeRoleWithOIDCOutput {
  /**
   * OIDC 主体标识（sub）。
   *
   * @type {string}
   * @memberof OIDCTokenInfoForAssumeRoleWithOIDCOutput
   */
  Subject?: string;

  /**
   * OIDC 颁发者（iss）。
   *
   * @type {string}
   * @memberof OIDCTokenInfoForAssumeRoleWithOIDCOutput
   */
  Issuer?: string;

  /**
   * OIDC 客户端 ID 列表（aud）。
   *
   * @type {Array<string>}
   * @memberof OIDCTokenInfoForAssumeRoleWithOIDCOutput
   */
  ClientIds?: Array<string>;

  /**
   * Token 过期时间。
   *
   * @type {string}
   * @memberof OIDCTokenInfoForAssumeRoleWithOIDCOutput
   */
  ExpirationTime?: string;

  /**
   * Token 签发时间。
   *
   * @type {string}
   * @memberof OIDCTokenInfoForAssumeRoleWithOIDCOutput
   */
  IssuanceTime?: string;
}
