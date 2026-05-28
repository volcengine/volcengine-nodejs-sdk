/* tslint:disable */
/* eslint-disable */
/**
 * sts
 *
 * OpenAPI spec version: common-version
 */

/**
 * SAML 断言中的部分信息。
 *
 * @see https://www.volcengine.com/docs/6257/1631607
 * @export
 * @interface SAMLAssertionInfoForAssumeRoleWithSAMLOutput
 */
export interface SAMLAssertionInfoForAssumeRoleWithSAMLOutput {
  /**
   * SAML 主体类型。
   *
   * @type {string}
   * @memberof SAMLAssertionInfoForAssumeRoleWithSAMLOutput
   */
  SubjectType?: string;

  /**
   * SAML 主体标识。
   *
   * @type {string}
   * @memberof SAMLAssertionInfoForAssumeRoleWithSAMLOutput
   */
  Subject?: string;

  /**
   * SAML 断言颁发者。
   *
   * @type {string}
   * @memberof SAMLAssertionInfoForAssumeRoleWithSAMLOutput
   */
  Issuer?: string;

  /**
   * SAML 断言接收方。
   *
   * @type {string}
   * @memberof SAMLAssertionInfoForAssumeRoleWithSAMLOutput
   */
  Recipient?: string;
}
